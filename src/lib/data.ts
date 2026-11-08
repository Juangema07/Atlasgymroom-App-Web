import { supabase, supabaseConfigured } from './supabase'
import { ENTITY_TABLES, entityStore, localDb, makeId, nowIso, type EntityTable, type OutboxItem, type Row } from './localdb'

export type SaveResult = { synced: boolean; localOnly?: boolean; message?: string }

async function hasSession() {
  if (!supabase) return false
  const { data } = await supabase.auth.getSession()
  return Boolean(data.session)
}

async function enqueue(item: Omit<OutboxItem, 'attempts'>) {
  await localDb.outbox.put({ ...item, attempts: 0 })
}

export async function listRows(table: EntityTable): Promise<Row[]> {
  if (supabase && await hasSession() && navigator.onLine) {
    const { data, error } = await supabase.from(table).select('*')
    if (!error && data) {
      const store = entityStore(table)
      for (const remote of data as Row[]) {
        const queued = await localDb.outbox.toArray()
        const pending = queued.some(item => (item.kind === 'upsert' && item.table === table && item.payload?.id === remote.id) || item.optimistic?.some(ref => ref.table === table && ref.id === remote.id))
        if (!pending) await store.put(remote)
      }
    }
  }
  return entityStore(table).toArray()
}

export async function saveRow(table: EntityTable, input: Row): Promise<SaveResult> {
  const stamp = nowIso()
  const row = { ...input, updated_at: stamp, created_at: input.created_at ?? stamp }
  const previous = await entityStore(table).get(row.id)
  await entityStore(table).put(row)

  if (!supabaseConfigured || !supabase) return { synced: false, localOnly: true, message: 'Guardado solo en este dispositivo.' }
  if (!await hasSession()) throw new Error('Inicia sesión para sincronizar los cambios.')
  if (!navigator.onLine) {
    await enqueue({ id: makeId(), kind: 'upsert', table, payload: row, created_at: stamp })
    return { synced: false, message: 'Guardado localmente. Pendiente de sincronización.' }
  }

  const { error } = await supabase.from(table).upsert(row, { onConflict: 'id' })
  if (error) {
    if (!('code' in error) || !error.code) {
      await enqueue({ id: makeId(), kind: 'upsert', table, payload: row, created_at: stamp })
      return { synced: false, message: `Guardado localmente; sincronización pendiente: ${error.message}` }
    }
    if (previous) await entityStore(table).put(previous)
    else await entityStore(table).delete(row.id)
    return { synced: false, message: `El servidor rechazó el registro y no lo guardó: ${error.message}` }
  }
  return { synced: true }
}

export async function runBusinessRpc(
  rpc: 'create_product' | 'record_membership_payment' | 'complete_sale' | 'register_day_pass' | 'record_expense' | 'receive_purchase' | 'open_cash_session' | 'close_cash_session',
  args: Record<string, any>,
  optimistic: Array<{ table: EntityTable; row: Row }> = [],
): Promise<SaveResult> {
  const stamp = nowIso()
  const previous = await Promise.all(optimistic.map(async item => ({ table: item.table, id: item.row.id, row: await entityStore(item.table).get(item.row.id) })))
  for (const item of optimistic) await entityStore(item.table).put(item.row)

  if (!supabaseConfigured || !supabase) return { synced: false, localOnly: true, message: 'Movimiento guardado solo en este dispositivo.' }
  if (!await hasSession()) throw new Error('Inicia sesión para sincronizar los cambios.')

  if (!navigator.onLine) {
    await enqueue({ id: makeId(), kind: 'rpc', payload: { rpc, args }, optimistic: optimistic.map(item => ({ table: item.table, id: item.row.id })), created_at: stamp })
    return { synced: false, message: 'Movimiento guardado localmente. Se enviará al recuperar Internet.' }
  }

  const { error } = await supabase.rpc(rpc, args)
  if (error) {
    // El identificador del movimiento viaja en los argumentos. Las funciones SQL son idempotentes.
    if (!('code' in error) || !error.code) {
      await enqueue({ id: makeId(), kind: 'rpc', payload: { rpc, args }, optimistic: optimistic.map(item => ({ table: item.table, id: item.row.id })), created_at: stamp })
      return { synced: false, message: `Movimiento local; sincronización pendiente: ${error.message}` }
    }
    for (const item of previous) { if (item.row) await entityStore(item.table).put(item.row); else await entityStore(item.table).delete(item.id) }
    return { synced: false, message: `El servidor rechazó la operación: ${error.message}` }
  }
  return { synced: true }
}

export async function syncPending(): Promise<{ synced: number; pending: number }> {
  if (!supabase || !await hasSession() || !navigator.onLine) return { synced: 0, pending: await localDb.outbox.count() }
  const queue = await localDb.outbox.orderBy('created_at').toArray()
  let synced = 0
  for (const item of queue) {
    try {
      if (item.kind === 'upsert' && item.table) {
        const { error } = await supabase.from(item.table).upsert(item.payload, { onConflict: 'id' })
        if (error) throw error
      } else if (item.kind === 'rpc') {
        const { rpc, args } = item.payload
        const { error } = await supabase.rpc(rpc, args)
        if (error) throw error
      }
      await localDb.outbox.delete(item.id)
      synced += 1
    } catch (error) {
      await localDb.outbox.put({
        ...item,
        attempts: item.attempts + 1,
        last_error: error instanceof Error ? error.message : 'Error de sincronización',
      })
      // Mantener el orden: no enviar movimientos posteriores si falla uno previo.
      break
    }
  }
  return { synced, pending: await localDb.outbox.count() }
}

export async function queueStatus() {
  return { count: await localDb.outbox.count(), items: await localDb.outbox.orderBy('created_at').toArray() }
}

export async function exportLocalBackup(): Promise<string> {
  const backup: Record<string, Row[]> = {}
  for (const table of ENTITY_TABLES) backup[table] = await entityStore(table).toArray()
  return JSON.stringify({ app: 'Atlasgymroom', exported_at: nowIso(), version: 1, data: backup }, null, 2)
}

export async function importLocalBackup(raw: string) {
  const parsed = JSON.parse(raw)
  if (parsed?.app !== 'Atlasgymroom' || !parsed?.data) throw new Error('El archivo no parece ser un respaldo de Atlasgymroom.')
  for (const table of ENTITY_TABLES) {
    const rows = parsed.data[table]
    if (Array.isArray(rows)) await entityStore(table).bulkPut(rows)
  }
}
