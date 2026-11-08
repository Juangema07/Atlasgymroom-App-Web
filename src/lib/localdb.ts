import Dexie, { type Table } from 'dexie'

export const ENTITY_TABLES = [
  'profiles', 'plans', 'members', 'payments', 'attendance', 'day_passes',
  'products', 'sales', 'sale_items', 'stock_movements', 'purchases',
  'purchase_items', 'expenses', 'cash_sessions', 'cash_movements', 'audit_logs',
] as const

export type EntityTable = typeof ENTITY_TABLES[number]
export type Row = Record<string, any> & { id: string; updated_at?: string; created_at?: string }

export type OutboxItem = {
  id: string
  kind: 'upsert' | 'update' | 'rpc'
  table?: EntityTable
  payload: any
  created_at: string
  attempts: number
  last_error?: string
  optimistic?: { table: EntityTable; id: string }[]
}

class AtlasLocalDatabase extends Dexie {
  outbox!: Table<OutboxItem, string>
  constructor() {
    super('AtlasgymroomLocal')
    const stores: Record<string, string> = { outbox: 'id, created_at, kind' }
    for (const name of ENTITY_TABLES) stores[name] = 'id, updated_at, created_at'
    this.version(1).stores(stores)
  }
}

export const localDb = new AtlasLocalDatabase()
export const makeId = () => crypto.randomUUID()
export const nowIso = () => new Date().toISOString()
export const entityStore = (name: EntityTable) => localDb.table(name) as Table<Row, string>
