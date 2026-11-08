import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import {
  Activity, ArrowDownRight, ArrowUpRight, BarChart3, CalendarDays,
  Check, CircleDollarSign, ClipboardList, Cloud, CloudOff,
  Download, Dumbbell, FileDown, FileUp, Home, LogOut, Menu,
  Package, Plus, RefreshCw, Search, Settings, Shield, ShoppingBag, Users,
  Wallet, X, Pencil, Receipt, AlertTriangle, UserRound, Boxes, LockKeyhole,
} from 'lucide-react'
import { supabase, supabaseConfigured } from './lib/supabase'
import {
  exportLocalBackup, importLocalBackup, listRows, queueStatus, runBusinessRpc,
  saveRow, syncPending,
} from './lib/data'
import { makeId, nowIso, type EntityTable, type Row } from './lib/localdb'

type Section = 'Inicio' | 'Miembros' | 'Planes' | 'Asistencia' | 'Pase diario' | 'Pagos' | 'Ventas' | 'Productos' | 'Compras' | 'Gastos' | 'Caja' | 'Informes' | 'Equipo' | 'Auditoría' | 'Configuración'
type Field = { key: string; label: string; type?: string; required?: boolean; disabled?: boolean; placeholder?: string; options?: { value: string; label: string }[] }
type ModuleConfig = { table: EntityTable; title: string; description: string; fields: Field[]; columns: { key: string; label: string }[] }

const navigation: { label: Section; icon: typeof Home }[] = [
  { label: 'Inicio', icon: Home }, { label: 'Miembros', icon: Users }, { label: 'Planes', icon: ClipboardList },
  { label: 'Asistencia', icon: Activity }, { label: 'Pase diario', icon: CalendarDays }, { label: 'Pagos', icon: CircleDollarSign },
  { label: 'Ventas', icon: ShoppingBag }, { label: 'Productos', icon: Package }, { label: 'Compras', icon: Boxes },
  { label: 'Gastos', icon: Receipt }, { label: 'Caja', icon: Wallet }, { label: 'Informes', icon: BarChart3 },
]
const adminNavigation: { label: Section; icon: typeof Home }[] = [
  { label: 'Equipo', icon: UserRound }, { label: 'Auditoría', icon: Shield }, { label: 'Configuración', icon: Settings },
]
const methods = [{ value: 'cash', label: 'Efectivo' }, { value: 'transfer', label: 'Transferencia' }, { value: 'nequi', label: 'Nequi' }, { value: 'card', label: 'Datáfono / tarjeta' }, { value: 'other', label: 'Otro' }]
const statuses = [{ value: 'active', label: 'Activo' }, { value: 'inactive', label: 'Inactivo' }, { value: 'expired', label: 'Vencido' }, { value: 'debt', label: 'Con saldo pendiente' }]
const currency = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
const formatMoney = (value: unknown) => currency.format(Number(value || 0))
const bogotaDate = (value: Date) => {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(value)
  const part = (name: string) => parts.find(p => p.type === name)?.value || ''
  return `${part('year')}-${part('month')}-${part('day')}`
}
const today = () => bogotaDate(new Date())
const datePlusDays = (date: string, days: number) => {
  const value = new Date(`${date}T12:00:00-05:00`)
  value.setDate(value.getDate() + days)
  return bogotaDate(value)
}
const dateInBogota = (value: unknown) => {
  if (!value) return ''
  const raw = String(value)
  return raw.length === 10 && raw[4] === '-' && raw[7] === '-' ? raw : bogotaDate(new Date(raw))
}
const formatDate = (value: unknown) => {
  if (!value) return '—'
  const raw = String(value)
  const parsed = raw.length === 10 && raw[4] === '-' && raw[7] === '-' ? new Date(`${raw}T12:00:00-05:00`) : new Date(raw)
  return parsed.toLocaleDateString('es-CO', { timeZone: 'America/Bogota' })
}

function configFor(section: Section, rows: Record<string, Row[]>): ModuleConfig | null {
  const memberOptions = (rows.members || []).map(m => ({ value: m.id, label: m.full_name }))
  const planOptions = (rows.plans || []).map(p => ({ value: p.id, label: p.name }))
  const base: Partial<Record<Section, ModuleConfig>> = {
    Miembros: { table: 'members', title: 'Miembros', description: 'Perfiles, estado y vigencia de los socios.', fields: [
      { key: 'full_name', label: 'Nombre completo', required: true }, { key: 'document', label: 'Documento', placeholder: 'Opcional' },
      { key: 'phone', label: 'Teléfono' }, { key: 'email', label: 'Correo', type: 'email' },
      { key: 'birth_date', label: 'Fecha de nacimiento', type: 'date' }, { key: 'current_plan_id', label: 'Plan', type: 'select', options: [{ value: '', label: 'Sin plan asignado' }, ...planOptions] },
      { key: 'start_date', label: 'Inicio', type: 'date' }, { key: 'end_date', label: 'Vencimiento', type: 'date' },
      { key: 'status', label: 'Estado', type: 'select', options: statuses }, { key: 'notes', label: 'Notas', type: 'textarea' },
    ], columns: [{ key: 'full_name', label: 'Nombre' }, { key: 'phone', label: 'Teléfono' }, { key: 'status', label: 'Estado' }, { key: 'end_date', label: 'Vence' }] },
    Planes: { table: 'plans', title: 'Planes y tarifas', description: 'Configura membresías, duración y precio.', fields: [
      { key: 'name', label: 'Nombre del plan', required: true }, { key: 'duration_days', label: 'Duración en días', type: 'number', required: true },
      { key: 'price', label: 'Precio (COP)', type: 'number', required: true }, { key: 'active', label: 'Estado', type: 'select', options: [{ value: 'true', label: 'Activo' }, { value: 'false', label: 'Inactivo' }] },
      { key: 'notes', label: 'Descripción', type: 'textarea' },
    ], columns: [{ key: 'name', label: 'Plan' }, { key: 'duration_days', label: 'Días' }, { key: 'price', label: 'Precio' }, { key: 'active', label: 'Estado' }] },
    Asistencia: { table: 'attendance', title: 'Asistencia', description: 'Registra entradas de socios o visitantes.', fields: [
      { key: 'member_id', label: 'Socio', type: 'select', options: [{ value: '', label: 'No es socio / visitante' }, ...memberOptions] },
      { key: 'visitor_name', label: 'Nombre del visitante' }, { key: 'entry_type', label: 'Tipo', type: 'select', options: [{ value: 'member', label: 'Socio' }, { value: 'day_pass', label: 'Pase diario' }] },
      { key: 'notes', label: 'Notas' },
    ], columns: [{ key: 'member_id', label: 'Socio' }, { key: 'visitor_name', label: 'Visitante' }, { key: 'entry_type', label: 'Tipo' }, { key: 'entered_at', label: 'Hora' }] },
    'Pase diario': { table: 'day_passes', title: 'Pases diarios', description: 'Entradas de visitantes sin crear una membresía.', fields: [], columns: [{ key: 'visitor_name', label: 'Visitante' }, { key: 'amount', label: 'Tarifa' }, { key: 'method', label: 'Método' }, { key: 'visited_at', label: 'Fecha' }] },
    Pagos: { table: 'payments', title: 'Pagos y mensualidades', description: 'Historial de cobros, abonos y saldos pendientes.', fields: [], columns: [{ key: 'member_id', label: 'Socio' }, { key: 'amount', label: 'Valor' }, { key: 'amount_paid', label: 'Recibido' }, { key: 'status', label: 'Estado' }, { key: 'paid_at', label: 'Fecha' }] },
    Productos: { table: 'products', title: 'Productos e inventario', description: 'Catálogo, precios, costos y existencias.', fields: [
      { key: 'name', label: 'Nombre', required: true }, { key: 'sku', label: 'Código / SKU' }, { key: 'description', label: 'Descripción' },
      { key: 'cost', label: 'Costo (COP)', type: 'number' }, { key: 'price', label: 'Precio (COP)', type: 'number', required: true },
      { key: 'stock', label: 'Existencias iniciales', type: 'number', required: true }, { key: 'min_stock', label: 'Stock mínimo', type: 'number' },
    ], columns: [{ key: 'name', label: 'Producto' }, { key: 'stock', label: 'Existencias' }, { key: 'min_stock', label: 'Mínimo' }, { key: 'price', label: 'Precio' }] },
    Compras: { table: 'purchases', title: 'Compras', description: 'Registra entradas de mercancía y proveedores.', fields: [], columns: [{ key: 'supplier', label: 'Proveedor' }, { key: 'description', label: 'Descripción' }, { key: 'total_amount', label: 'Total' }, { key: 'purchased_at', label: 'Fecha' }] },
    Gastos: { table: 'expenses', title: 'Gastos y egresos', description: 'Registra salidas y conserva el responsable del movimiento.', fields: [], columns: [{ key: 'category', label: 'Categoría' }, { key: 'description', label: 'Concepto' }, { key: 'amount', label: 'Valor' }, { key: 'method', label: 'Método' }, { key: 'expense_date', label: 'Fecha' }] },
    Ventas: { table: 'sales', title: 'Punto de venta', description: 'Agrega productos al carrito y confirma la venta.', fields: [], columns: [{ key: 'id', label: 'Venta' }, { key: 'total', label: 'Total' }, { key: 'amount_paid', label: 'Recibido' }, { key: 'status', label: 'Estado' }, { key: 'sold_at', label: 'Fecha' }] },
    Equipo: { table: 'profiles', title: 'Equipo y usuarios', description: 'Usuarios individuales. Las cuentas se crean desde Supabase Auth.', fields: [], columns: [{ key: 'full_name', label: 'Nombre' }, { key: 'role', label: 'Rol' }, { key: 'active', label: 'Activo' }] },
    Auditoría: { table: 'audit_logs', title: 'Auditoría', description: 'Historial de modificaciones registradas en la base de datos.', fields: [], columns: [{ key: 'entity_table', label: 'Módulo' }, { key: 'action', label: 'Acción' }, { key: 'entity_id', label: 'Registro' }, { key: 'changed_at', label: 'Fecha' }] },
  }
  return base[section] as ModuleConfig || null
}

export default function App() {
  const [section, setSection] = useState<Section>('Inicio')
  const [menuOpen, setMenuOpen] = useState(false)
  const [session, setSession] = useState<Session | null>(null)
  const [authLoading, setAuthLoading] = useState(Boolean(supabaseConfigured))
  const [profile, setProfile] = useState<Row | null>(null)
  const [rows, setRows] = useState<Record<string, Row[]>>({})
  const [search, setSearch] = useState('')
  const [dialog, setDialog] = useState<'record' | 'payment' | 'daypass' | 'expense' | 'sale' | 'purchase' | 'cash' | null>(null)
  const [editing, setEditing] = useState<Row | null>(null)
  const [form, setForm] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState('')
  const [syncCount, setSyncCount] = useState(0)
  const [saleLines, setSaleLines] = useState<{ product_id: string; quantity: number }[]>([])
  const [purchaseLines, setPurchaseLines] = useState<{ product_id: string; quantity: number; unit_cost: number }[]>([])
  const fileRef = useRef<HTMLInputElement>(null)

  const refresh = useCallback(async () => {
    const names: EntityTable[] = ['profiles','plans','members','payments','attendance','day_passes','products','sales','sale_items','stock_movements','purchases','purchase_items','expenses','cash_sessions','cash_movements','audit_logs']
    const values = await Promise.all(names.map(async name => [name, await listRows(name)] as const))
    setRows(Object.fromEntries(values))
    const queue = await queueStatus()
    setSyncCount(queue.count)
  }, [])

  const sync = useCallback(async () => {
    const result = await syncPending()
    setSyncCount(result.pending)
    if (result.synced) {
      setToast(`Sincronizados ${result.synced} movimiento(s).`)
      await refresh()
    }
  }, [refresh])

  useEffect(() => {
    if (!supabase) { setAuthLoading(false); return }
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setAuthLoading(false) })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (session?.user) {
      supabase?.from('profiles').select('*').eq('id', session.user.id).maybeSingle().then(({ data }) => setProfile(data))
      void syncPending().then(() => refresh())
    } else if (!supabaseConfigured) {
      setProfile({ id: 'local-owner', full_name: 'Administrador local', role: 'owner', active: true })
      void refresh()
    } else {
      setRows({})
      setProfile(null)
    }
  }, [session, refresh])

  useEffect(() => {
    const onOnline = () => { void sync() }
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [sync])

  const memberName = (id: unknown) => rows.members?.find(m => m.id === id)?.full_name || '—'
  const productName = (id: unknown) => rows.products?.find(p => p.id === id)?.name || '—'
  const planName = (id: unknown) => rows.plans?.find(p => p.id === id)?.name || '—'
  const memberOptions = useMemo(() => (rows.members || []).map(m => ({ value: m.id, label: m.full_name })), [rows.members])
  const productOptions = useMemo(() => (rows.products || []).filter(p => p.active !== false).map(p => ({ value: p.id, label: `${p.name} · ${formatMoney(p.price)} · Stock ${p.stock}` })), [rows.products])
  const activeSession = (rows.cash_sessions || []).find(s => s.status === 'open')
  const isOwner = profile?.role === 'owner'
  const moduleConfig = configFor(section, rows)
  const moduleRows = moduleConfig ? (rows[moduleConfig.table] || []) : []
  const filteredRows = moduleRows.filter(row => JSON.stringify(row).toLowerCase().includes(search.toLowerCase()))

  async function signIn(email: string, password: string) {
    if (!supabase) return
    setBusy(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setBusy(false)
    if (error) setToast(error.message)
  }
  async function signOut() { await supabase?.auth.signOut(); setSection('Inicio') }

  function notify(message: string) { setToast(message); window.setTimeout(() => setToast(''), 5000) }
  function openRecord(edit?: Row) {
    if (!moduleConfig) return
    setEditing(edit || null)
    const initial: Record<string, string> = {}
    moduleConfig.fields.forEach(f => { initial[f.key] = edit?.[f.key] == null ? '' : String(edit[f.key]) })
    setForm(initial)
    setDialog('record')
  }
  function openSpecial(which: NonNullable<typeof dialog>) {
    setEditing(null); setForm({}); setSaleLines([]); setPurchaseLines([]); setDialog(which)
  }

  async function submitRecord(event: FormEvent) {
    event.preventDefault()
    if (!moduleConfig) return
    const row: Row = { ...(editing || {}), id: editing?.id || makeId(), ...Object.fromEntries(Object.entries(form).map(([key,value]) => [key, value === '' ? null : value])), created_by: editing?.created_by || session?.user.id || null, updated_at: nowIso() }
    for (const field of moduleConfig.fields) {
      if (field.type === 'number') row[field.key] = Number(form[field.key] || 0)
      if (field.key === 'active' || field.key === 'status' && section === 'Planes') row[field.key] = form[field.key] === 'true'
    }
    if (section === 'Miembros') { row.status ||= 'active'; row.current_plan_id ||= null }
    if (section === 'Productos') { row.stock = Number(row.stock || 0); row.min_stock = Number(row.min_stock || 0); row.cost = Number(row.cost || 0); row.active = true }
    if (section === 'Asistencia') { row.member_id ||= null; row.visitor_name ||= null; row.entry_type ||= row.member_id ? 'member' : 'day_pass'; row.entered_at = nowIso() }
    if (section === 'Planes') row.active = form.active !== 'false'
    setBusy(true)
    const stockMovementId = makeId()
    const result = section === 'Productos' && !editing
      ? await runBusinessRpc('create_product', { p_product: { ...row, stock_movement_id: stockMovementId } }, [
          { table: 'products', row },
          ...(Number(row.stock) > 0 ? [{ table: 'stock_movements' as const, row: { id: stockMovementId, product_id: row.id, movement_type: 'adjustment', quantity: Number(row.stock), notes: 'Existencias iniciales', created_by: session?.user.id || null, created_at: nowIso() } }] : []),
        ])
      : section === 'Productos' && editing
        ? await updateRow(moduleConfig.table, row)
        : await saveRow(moduleConfig.table, row)
    setBusy(false); setDialog(null); notify(result.message || (result.synced ? 'Registro guardado y sincronizado.' : 'Registro guardado localmente.'))
    await refresh()
  }

  async function submitPayment(event: FormEvent) {
    event.preventDefault()
    const id = makeId()
    const amount = Number(form.amount || 0), amount_paid = Number(form.amount_paid === undefined || form.amount_paid === '' ? form.amount || 0 : form.amount_paid)
    const payment: Row = { id, member_id: form.member_id, plan_id: form.plan_id || null, amount, amount_paid, method: form.method || 'cash', status: amount_paid === 0 ? 'pending' : amount_paid < amount ? 'partial' : 'paid', paid_at: amount_paid > 0 ? nowIso() : null, notes: form.notes || null, created_by: session?.user.id || null, created_at: nowIso() }
    const member = rows.members?.find(m => m.id === form.member_id)
    const plan = rows.plans?.find(p => p.id === form.plan_id)
    const optimistic: { table: EntityTable; row: Row }[] = [{ table: 'payments', row: payment }]
    const cashMovementId = makeId()
    if (amount_paid > 0) optimistic.push({ table: 'cash_movements', row: { id: cashMovementId, cash_session_id: activeSession?.id || null, direction: 'income', amount: amount_paid, method: form.method || 'cash', description: 'Pago de mensualidad', reference_id: id, created_by: session?.user.id || null, created_at: nowIso() } })
    if (member && plan && amount_paid >= amount && amount > 0) {
      const beginDate = member.end_date && member.end_date >= today() ? datePlusDays(member.end_date, 1) : today()
      const endDate = datePlusDays(beginDate, Number(plan.duration_days) - 1)
      optimistic.push({ table: 'members' as const, row: { ...member, current_plan_id: plan.id, start_date: beginDate, end_date: endDate, status: 'active', updated_at: nowIso() } })
    }
    setBusy(true)
    const result = await runBusinessRpc('record_membership_payment', { p_payment: { ...payment, cash_movement_id: cashMovementId } }, optimistic)
    setBusy(false); setDialog(null); notify(result.message || (result.synced ? 'Pago registrado y mensualidad actualizada.' : 'Pago guardado localmente, pendiente de sincronización.'))
    await refresh()
  }

  async function submitDayPass(event: FormEvent) {
    event.preventDefault()
    const id = makeId()
    const attendanceId = makeId(), cashMovementId = makeId()
    const pass: Row = { id, attendance_id: attendanceId, cash_movement_id: cashMovementId, visitor_name: form.visitor_name, amount: Number(form.amount || 0), method: form.method || 'cash', notes: form.notes || null, visited_at: nowIso(), created_by: session?.user.id || null, created_at: nowIso() }
    const attendance: Row = { id: attendanceId, member_id: null, visitor_name: pass.visitor_name, entry_type: 'day_pass', entered_at: nowIso(), created_by: session?.user.id || null, created_at: nowIso() }
    setBusy(true)
    const optimistic: { table: EntityTable; row: Row }[] = [{ table: 'day_passes', row: pass }, { table: 'attendance', row: attendance }]
    if (Number(pass.amount) > 0) optimistic.push({ table: 'cash_movements', row: { id: cashMovementId, cash_session_id: activeSession?.id || null, direction: 'income', amount: Number(pass.amount), method: pass.method, description: 'Pase diario', reference_id: id, created_by: session?.user.id || null, created_at: nowIso() } })
    const result = await runBusinessRpc('register_day_pass', { p_day_pass: pass }, optimistic)
    setBusy(false); setDialog(null); notify(result.message || 'Pase diario registrado.'); await refresh()
  }

  async function submitExpense(event: FormEvent) {
    event.preventDefault()
    const cashMovementId = makeId()
    const expense: Row = { id: makeId(), category: form.category, description: form.description, amount: Number(form.amount || 0), method: form.method || 'cash', expense_date: nowIso(), notes: form.notes || null, created_by: session?.user.id || null, created_at: nowIso() }
    setBusy(true)
    const optimistic: { table: EntityTable; row: Row }[] = [{ table: 'expenses', row: expense }, { table: 'cash_movements', row: { id: cashMovementId, cash_session_id: activeSession?.id || null, direction: 'expense', amount: Number(expense.amount), method: expense.method, description: expense.description, reference_id: expense.id, created_by: session?.user.id || null, created_at: nowIso() } }]
    const result = await runBusinessRpc('record_expense', { p_expense: { ...expense, cash_movement_id: cashMovementId } }, optimistic)
    setBusy(false); setDialog(null); notify(result.message || 'Gasto registrado.'); await refresh()
  }

  async function submitSale(event: FormEvent) {
    event.preventDefault()
    if (!saleLines.length) { notify('Agrega al menos un producto.'); return }
    const id = makeId()
    const items = saleLines.map(line => {
      const product = rows.products?.find(p => p.id === line.product_id)!
      return { id: makeId(), stock_movement_id: makeId(), product_id: product.id, quantity: line.quantity, unit_price: Number(product.price), line_total: Number(product.price) * line.quantity }
    })
    const total = items.reduce((sum, item) => sum + item.line_total, 0)
    const insufficient = items.find(item => Number(rows.products?.find(p => p.id === item.product_id)?.stock || 0) < item.quantity)
    if (insufficient) { notify('No hay existencias suficientes para uno de los productos.'); return }
    const amount_paid = Number(form.amount_paid === '' || form.amount_paid == null ? total : form.amount_paid)
    const cashMovementId = makeId()
    const sale: Row = { id, cash_movement_id: cashMovementId, member_id: form.member_id || null, total, amount_paid, method: form.method || 'cash', status: amount_paid === 0 ? 'pending' : amount_paid < total ? 'partial' : 'paid', sold_at: nowIso(), created_by: session?.user.id || null, created_at: nowIso() }
    const optimistic: { table: EntityTable; row: Row }[] = [{ table: 'sales', row: sale }]
    if (amount_paid > 0) optimistic.push({ table: 'cash_movements', row: { id: cashMovementId, cash_session_id: activeSession?.id || null, direction: 'income', amount: amount_paid, method: form.method || 'cash', description: 'Venta de productos', reference_id: id, created_by: session?.user.id || null, created_at: nowIso() } })
    items.forEach(item => {
      optimistic.push({ table: 'sale_items', row: { ...item, sale_id: id, created_at: nowIso() } })
      const product = rows.products?.find(p => p.id === item.product_id)
      if (product) optimistic.push({ table: 'products', row: { ...product, stock: Math.max(0, Number(product.stock) - item.quantity), updated_at: nowIso() } })
      optimistic.push({ table: 'stock_movements', row: { id: item.stock_movement_id, product_id: item.product_id, movement_type: 'sale', quantity: -item.quantity, reference_id: id, created_by: session?.user.id || null, created_at: nowIso() } })
    })
    setBusy(true)
    const result = await runBusinessRpc('complete_sale', { p_sale: sale, p_items: items }, optimistic)
    setBusy(false); setDialog(null); notify(result.message || (result.synced ? 'Venta confirmada e inventario actualizado.' : 'Venta guardada localmente.')); await refresh()
  }

  async function submitPurchase(event: FormEvent) {
    event.preventDefault()
    if (!purchaseLines.length) { notify('Agrega al menos un producto comprado.'); return }
    const id = makeId()
    const items = purchaseLines.map(line => ({ id: makeId(), stock_movement_id: makeId(), product_id: line.product_id, quantity: line.quantity, unit_cost: line.unit_cost }))
    const total_amount = items.reduce((sum, item) => sum + item.quantity * item.unit_cost, 0)
    const cashMovementId = makeId()
    const purchase: Row = { id, cash_movement_id: cashMovementId, supplier: form.supplier || null, description: form.description, total_amount, amount_paid: Number(form.amount_paid || 0), method: form.method || 'cash', purchased_at: nowIso(), notes: form.notes || null, created_by: session?.user.id || null, created_at: nowIso() }
    const optimistic: { table: EntityTable; row: Row }[] = [{ table: 'purchases', row: purchase }]
    if (Number(purchase.amount_paid) > 0) optimistic.push({ table: 'cash_movements', row: { id: cashMovementId, cash_session_id: activeSession?.id || null, direction: 'expense', amount: Number(purchase.amount_paid), method: form.method || 'cash', description: 'Compra de inventario', reference_id: id, created_by: session?.user.id || null, created_at: nowIso() } })
    items.forEach(item => {
      optimistic.push({ table: 'purchase_items', row: { ...item, purchase_id: id, created_at: nowIso() } })
      const product = rows.products?.find(p => p.id === item.product_id)
      if (product) optimistic.push({ table: 'products', row: { ...product, stock: Number(product.stock) + item.quantity, cost: item.unit_cost, updated_at: nowIso() } })
      optimistic.push({ table: 'stock_movements', row: { id: item.stock_movement_id, product_id: item.product_id, movement_type: 'purchase', quantity: item.quantity, reference_id: id, created_by: session?.user.id || null, created_at: nowIso() } })
    })
    setBusy(true)
    const result = await runBusinessRpc('receive_purchase', { p_purchase: purchase, p_items: items }, optimistic)
    setBusy(false); setDialog(null); notify(result.message || 'Compra registrada y existencias actualizadas.'); await refresh()
  }

  async function openCash(event: FormEvent) {
    event.preventDefault()
    const row: Row = { id: makeId(), opened_by: session?.user.id || null, opened_at: nowIso(), initial_cash: Number(form.initial_cash || 0), status: 'open', notes: form.notes || null, created_at: nowIso() }
    setBusy(true)
    const result = await runBusinessRpc('open_cash_session', { p_session: row }, [{ table: 'cash_sessions', row }])
    setBusy(false); setDialog(null); notify(result.message || 'Caja abierta.'); await refresh()
  }

  async function closeCash(event: FormEvent) {
    event.preventDefault()
    if (!activeSession) return
    const counted = Number(form.counted_cash || 0)
    const cashRows = (rows.cash_movements || []).filter(m => m.cash_session_id === activeSession.id && m.method === 'cash')
    const expected = Number(activeSession.initial_cash || 0) + cashRows.reduce((sum,m) => sum + (m.direction === 'income' ? Number(m.amount) : -Number(m.amount)), 0)
    setBusy(true)
    const result = await runBusinessRpc('close_cash_session', { p_session_id: activeSession.id, p_counted_cash: counted }, [{ table: 'cash_sessions', row: { ...activeSession, status: 'closed', expected_cash: expected, counted_cash: counted, difference: counted - expected, closed_at: nowIso(), updated_at: nowIso() } }])
    setBusy(false); setDialog(null); notify(result.message || 'Solicitud de cierre de caja guardada.'); await refresh()
  }

  async function backup() {
    const json = await exportLocalBackup()
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `atlasgymroom-respaldo-${today()}.json`; anchor.click(); URL.revokeObjectURL(url)
  }
  async function restore(file?: File) {
    if (!file) return
    try { await importLocalBackup(await file.text()); await refresh(); notify('Respaldo importado en este dispositivo.') }
    catch (error) { notify(error instanceof Error ? error.message : 'No se pudo importar el respaldo.') }
  }

  const handleSection = (label: Section) => { setSection(label); setMenuOpen(false); setSearch(''); setToast('') }
  const openCreate = () => {
    if (section === 'Ventas') openSpecial('sale')
    else if (section === 'Pagos') openSpecial('payment')
    else if (section === 'Pase diario') openSpecial('daypass')
    else if (section === 'Gastos') openSpecial('expense')
    else if (section === 'Compras') openSpecial('purchase')
    else openRecord()
  }

  if (authLoading) return <div className="auth-screen"><div className="auth-card"><div className="brand-mark"><Dumbbell/></div><p>Comprobando acceso seguro…</p></div></div>
  if (supabaseConfigured && !session) return <Login onSignIn={signIn} busy={busy} toast={toast} />
    const members = rows.members || []
  const recentPayments = rows.payments || []
  const activeMembers = members.filter(m => m.status === 'active' && (!m.end_date || m.end_date >= today())).length
  const expiredMembers = members.filter(m => m.end_date && m.end_date < today()).length
  const todayPayments = recentPayments.filter(p => dateInBogota(p.paid_at || p.created_at) === today())
  const todayIncome = todayPayments.reduce((sum,p) => sum + Number(p.amount_paid || 0), 0) + (rows.sales || []).filter(s => dateInBogota(s.sold_at) === today()).reduce((sum,s) => sum + Number(s.amount_paid || 0),0) + (rows.day_passes || []).filter(p => dateInBogota(p.visited_at) === today()).reduce((sum,p) => sum + Number(p.amount || 0),0)
  const stockLow = (rows.products || []).filter(p => Number(p.stock) <= Number(p.min_stock || 0))
  const userLabel = profile?.full_name || session?.user.email || 'Administrador local'

  return <div className="app-shell">
    <aside className={`sidebar ${menuOpen ? 'sidebar-open' : ''}`}>
      <div className="brand"><div className="brand-mark"><Dumbbell size={21}/></div><div><strong>ATLAS<span>GYMROOM</span></strong><small>GESTIÓN DE GIMNASIO</small></div><button className="mobile-close" onClick={() => setMenuOpen(false)}><X/></button></div>
      <div className="workspace-label">OPERACIÓN DIARIA</div>
      <nav>{navigation.map(({ label, icon: Icon }) => <button key={label} className={section === label ? 'nav-item active' : 'nav-item'} onClick={() => handleSection(label)}><Icon size={18}/><span>{label}</span>{label === 'Miembros' && <b className="nav-count">{members.length}</b>}</button>)}</nav>
      {isOwner && <><div className="workspace-label admin-label">ADMINISTRACIÓN</div><nav>{adminNavigation.map(({ label, icon: Icon }) => <button key={label} className={section === label ? 'nav-item active' : 'nav-item'} onClick={() => handleSection(label)}><Icon size={18}/><span>{label}</span></button>)}</nav></>}
      <div className="sidebar-bottom"><div className="help-card"><div className="help-icon"><Shield size={17}/></div><strong>Registros bajo control</strong><p>Movimientos financieros con trazabilidad. No se borran desde la aplicación.</p></div><div className="profile"><div className="avatar owner">{userLabel.slice(0,2).toUpperCase()}</div><div className="profile-copy"><strong>{userLabel}</strong><small>{supabaseConfigured ? (isOwner ? 'Propietario' : 'Empleado de caja') : 'Modo local · sin cuenta'}</small></div>{supabaseConfigured && <button className="profile-action" title="Cerrar sesión" onClick={signOut}><LogOut size={15}/></button>}</div></div>
    </aside>
    {menuOpen && <button className="scrim" aria-label="Cerrar menú" onClick={() => setMenuOpen(false)}/>}
    <main className="main-content">
      <header className="topbar"><div className="topbar-left"><button className="menu-toggle" onClick={() => setMenuOpen(true)}><Menu/></button><div className="breadcrumb">Atlasgymroom <span>/</span> <strong>{section}</strong></div></div><div className="topbar-actions"><div className={`status-pill ${supabaseConfigured ? 'connected' : 'local'}`}>{supabaseConfigured ? <><Cloud size={13}/> Supabase</> : <><CloudOff size={13}/> Solo este dispositivo</>}</div><button className="sync-button" onClick={() => void sync()} title="Sincronizar"><RefreshCw size={15}/><span>{syncCount ? `${syncCount} pendientes` : 'Sin pendientes'}</span></button><div className="avatar owner">{userLabel.slice(0,2).toUpperCase()}</div></div></header>
      {!supabaseConfigured && <div className="local-warning"><AlertTriangle size={16}/><span><strong>Modo local:</strong> la información se guarda solo en este navegador. Configura Supabase y accede con una cuenta antes de registrar datos reales.</span></div>}
      {supabaseConfigured && syncCount > 0 && <div className="sync-warning"><CloudOff size={15}/><span>{syncCount} operación(es) esperando sincronización. No cierres ni borres los datos del navegador hasta recuperar la conexión.</span><button onClick={() => void sync()}>Reintentar</button></div>}
      <div className="page">
        {section === 'Inicio' && <Dashboard activeMembers={activeMembers} expiredMembers={expiredMembers} total={members.length} todayIncome={todayIncome} todayAttendances={(rows.attendance || []).filter(a => dateInBogota(a.entered_at) === today()).length} expiring={members.filter(m => m.end_date && m.end_date >= today() && m.end_date <= datePlusDays(today(), 7)).length} stockLow={stockLow} rows={rows} onNavigate={handleSection} />}
        {section === 'Caja' && <CashPage session={activeSession} sessions={rows.cash_sessions || []} movements={rows.cash_movements || []} onOpen={() => openSpecial('cash')} onClose={() => openSpecial('cash')} />}
        {section === 'Informes' && <Reports rows={rows} />}
        {section === 'Configuración' && <SettingsPage onBackup={backup} onRestore={() => fileRef.current?.click()} />}
        {moduleConfig && <DataModule config={moduleConfig} rows={filteredRows} isOwner={Boolean(isOwner)} search={search} setSearch={setSearch} onCreate={openCreate} onEdit={openRecord} memberName={memberName} productName={productName} planName={planName} />}
        {section === 'Equipo' && !isOwner && <AccessDenied/>}
        {section === 'Auditoría' && !isOwner && <AccessDenied/>}
        <footer>© 2026 Atlasgymroom <span>Gestión clara para entrenar mejor.</span></footer>
      </div>
    </main>

    {dialog && dialog !== 'cash' && <Modal title={dialogTitle(dialog, editing)} onClose={() => setDialog(null)}>
      {dialog === 'record' && moduleConfig && <form className="form-grid" onSubmit={submitRecord}>
        {moduleConfig.fields.map(field => <FieldInput key={field.key} field={moduleConfig.table === 'products' && editing && field.key === 'stock' ? { ...field, disabled: true } : field} value={form[field.key] || ''} onChange={value => setForm(v => ({ ...v, [field.key]: value }))} />)}
        <div className="form-actions"><button type="button" className="secondary-button" onClick={() => setDialog(null)}>Cancelar</button><button disabled={busy} className="primary-button"><Check size={16}/>{busy ? 'Guardando…' : 'Guardar registro'}</button></div>
      </form>}
      {dialog === 'payment' && <form className="form-grid" onSubmit={submitPayment}>
        <FieldInput field={{ key: 'member_id', label: 'Socio', type: 'select', options: memberOptions, required: true }} value={form.member_id || ''} onChange={v => setForm(f => ({ ...f, member_id: v }))}/>
        <FieldInput field={{ key: 'plan_id', label: 'Plan a renovar', type: 'select', options: (rows.plans || []).filter(p => p.active !== false).map(p => ({ value: p.id, label: p.name })) }} value={form.plan_id || ''} onChange={v => setForm(f => ({ ...f, plan_id: v }))}/>
        <FieldInput field={{ key: 'amount', label: 'Valor a cobrar (COP)', type: 'number', required: true }} value={form.amount || ''} onChange={v => setForm(f => ({ ...f, amount: v }))}/>
        <FieldInput field={{ key: 'amount_paid', label: 'Dinero recibido (COP)', type: 'number', required: true }} value={form.amount_paid ?? form.amount ?? ''} onChange={v => setForm(f => ({ ...f, amount_paid: v }))}/>
        <FieldInput field={{ key: 'method', label: 'Método de pago', type: 'select', options: methods }} value={form.method || 'cash'} onChange={v => setForm(f => ({ ...f, method: v }))}/>
        <FieldInput field={{ key: 'notes', label: 'Observaciones' }} value={form.notes || ''} onChange={v => setForm(f => ({ ...f, notes: v }))}/>
        <p className="form-hint full">El saldo pendiente no se suma a la caja. La vigencia se extiende cuando el pago queda completo. En transferencias y Nequi, registra el dinero recibido solo después de confirmar el abono en la cuenta; una captura no es confirmación.</p>
        <FormActions busy={busy} onCancel={() => setDialog(null)}/>
      </form>}
      {dialog === 'daypass' && <form className="form-grid" onSubmit={submitDayPass}>
        <FieldInput field={{ key: 'visitor_name', label: 'Nombre del visitante', required: true }} value={form.visitor_name || ''} onChange={v => setForm(f => ({ ...f, visitor_name: v }))}/>
        <FieldInput field={{ key: 'amount', label: 'Tarifa (COP)', type: 'number', required: true }} value={form.amount || ''} onChange={v => setForm(f => ({ ...f, amount: v }))}/>
        <FieldInput field={{ key: 'method', label: 'Método de pago', type: 'select', options: methods }} value={form.method || 'cash'} onChange={v => setForm(f => ({ ...f, method: v }))}/>
        <FieldInput field={{ key: 'notes', label: 'Observaciones' }} value={form.notes || ''} onChange={v => setForm(f => ({ ...f, notes: v }))}/>
        <p className="form-hint full">Se registra como pase diario y asistencia, sin crear un socio permanente. En transferencias y Nequi, confirma el abono real antes de marcar el pago como recibido.</p>
        <FormActions busy={busy} onCancel={() => setDialog(null)}/>
      </form>}
      {dialog === 'expense' && <form className="form-grid" onSubmit={submitExpense}>
        <FieldInput field={{ key: 'category', label: 'Categoría', required: true, options: undefined }} value={form.category || ''} onChange={v => setForm(f => ({ ...f, category: v }))}/>
        <FieldInput field={{ key: 'description', label: 'Concepto', required: true }} value={form.description || ''} onChange={v => setForm(f => ({ ...f, description: v }))}/>
        <FieldInput field={{ key: 'amount', label: 'Valor (COP)', type: 'number', required: true }} value={form.amount || ''} onChange={v => setForm(f => ({ ...f, amount: v }))}/>
        <FieldInput field={{ key: 'method', label: 'Método', type: 'select', options: methods }} value={form.method || 'cash'} onChange={v => setForm(f => ({ ...f, method: v }))}/>
        <FieldInput field={{ key: 'notes', label: 'Observaciones' }} value={form.notes || ''} onChange={v => setForm(f => ({ ...f, notes: v }))}/>
        <FormActions busy={busy} onCancel={() => setDialog(null)}/>
      </form>}
      {dialog === 'sale' && <form className="form-grid" onSubmit={submitSale}>
        <FieldInput field={{ key: 'member_id', label: 'Comprador (opcional)', type: 'select', options: [{ value: '', label: 'Venta sin identificar' }, ...memberOptions] }} value={form.member_id || ''} onChange={v => setForm(f => ({ ...f, member_id: v }))}/>
        <ProductAdder options={productOptions} onAdd={(id, qty) => setSaleLines(old => { const found = old.find(x => x.product_id === id); return found ? old.map(x => x.product_id === id ? { ...x, quantity: x.quantity + qty } : x) : [...old, { product_id: id, quantity: qty }] })}/>
        <LineList lines={saleLines} products={rows.products || []} onChange={setSaleLines}/>
        <div className="cart-total"><span>Total de venta</span><strong>{formatMoney(saleLines.reduce((sum,l) => sum + Number(rows.products?.find(p => p.id === l.product_id)?.price || 0) * l.quantity, 0))}</strong></div>
        <FieldInput field={{ key: 'amount_paid', label: 'Dinero recibido (COP)', type: 'number' }} value={form.amount_paid || ''} onChange={v => setForm(f => ({ ...f, amount_paid: v }))}/>
        <FieldInput field={{ key: 'method', label: 'Método de pago', type: 'select', options: methods }} value={form.method || 'cash'} onChange={v => setForm(f => ({ ...f, method: v }))}/>
        <p className="form-hint full">Deja el dinero recibido vacío para registrar la venta como pagada en su totalidad. El inventario baja al confirmar.</p>
        <FormActions busy={busy} onCancel={() => setDialog(null)} />
      </form>}
      {dialog === 'purchase' && <form className="form-grid" onSubmit={submitPurchase}>
        <FieldInput field={{ key: 'supplier', label: 'Proveedor' }} value={form.supplier || ''} onChange={v => setForm(f => ({ ...f, supplier: v }))}/>
        <FieldInput field={{ key: 'description', label: 'Descripción de la compra', required: true }} value={form.description || ''} onChange={v => setForm(f => ({ ...f, description: v }))}/>
        <ProductAdder options={productOptions} onAdd={(id, qty) => { const product = rows.products?.find(p => p.id === id); setPurchaseLines(old => [...old, { product_id: id, quantity: qty, unit_cost: Number(product?.cost || 0) }]) }}/>
        <PurchaseLineList lines={purchaseLines} products={rows.products || []} onChange={setPurchaseLines}/>
        <div className="cart-total"><span>Total compra</span><strong>{formatMoney(purchaseLines.reduce((sum,l) => sum + l.unit_cost * l.quantity, 0))}</strong></div>
        <FieldInput field={{ key: 'amount_paid', label: 'Valor pagado (COP)', type: 'number' }} value={form.amount_paid || ''} onChange={v => setForm(f => ({ ...f, amount_paid: v }))}/>
        <FieldInput field={{ key: 'method', label: 'Método', type: 'select', options: methods }} value={form.method || 'cash'} onChange={v => setForm(f => ({ ...f, method: v }))}/>
        <FormActions busy={busy} onCancel={() => setDialog(null)}/>
      </form>}
    </Modal>}
    {section === 'Caja' && dialog === 'cash' && <Modal title={activeSession ? 'Cerrar caja' : 'Abrir caja'} onClose={() => setDialog(null)}>
      {activeSession ? <form className="form-grid" onSubmit={closeCash}><FieldInput field={{ key: 'counted_cash', label: 'Efectivo contado (COP)', type: 'number', required: true }} value={form.counted_cash || ''} onChange={v => setForm(f => ({ ...f, counted_cash: v }))}/><p className="form-hint full">El sistema comparará el efectivo contado con el saldo esperado a partir de la apertura y movimientos en efectivo.</p><FormActions busy={busy} onCancel={() => setDialog(null)} /></form> :
      <form className="form-grid" onSubmit={openCash}><FieldInput field={{ key: 'initial_cash', label: 'Base inicial (COP)', type: 'number', required: true }} value={form.initial_cash || ''} onChange={v => setForm(f => ({ ...f, initial_cash: v }))}/><FieldInput field={{ key: 'notes', label: 'Notas' }} value={form.notes || ''} onChange={v => setForm(f => ({ ...f, notes: v }))}/><FormActions busy={busy} onCancel={() => setDialog(null)} /></form>}
    </Modal>}
    <input ref={fileRef} type="file" accept="application/json" hidden onChange={e => void restore(e.target.files?.[0])}/>
    {toast && <div className="toast"><Check size={16}/>{toast}<button onClick={() => setToast('')}><X size={14}/></button></div>}
  </div>
}

function Login({ onSignIn, busy, toast }: { onSignIn: (email: string, password: string) => void; busy: boolean; toast: string }) {
  const [email,setEmail] = useState(''); const [password,setPassword] = useState('')
  return <div className="auth-screen"><form className="auth-card" onSubmit={e => { e.preventDefault(); onSignIn(email,password) }}><div className="brand-mark"><Dumbbell size={23}/></div><div className="eyebrow">ATLASGYMROOM</div><h1>Bienvenido</h1><p>Ingresa con tu cuenta individual para administrar el gimnasio.</p><label>Correo electrónico<input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="username"/></label><label>Contraseña<input type="password" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password"/></label><button className="primary-button auth-submit" disabled={busy}><LockKeyhole size={16}/>{busy ? 'Ingresando…' : 'Iniciar sesión'}</button>{toast && <div className="auth-error">{toast}</div>}<small>Las cuentas las crea el propietario desde Supabase Auth. No hay registro público.</small></form></div>
}

function Dashboard(props: { activeMembers: number; expiredMembers: number; total: number; todayIncome: number; todayAttendances: number; expiring: number; stockLow: Row[]; rows: Record<string,Row[]>; onNavigate:(s:Section)=>void }) {
  const recent = [...(props.rows.payments || []), ...(props.rows.sales || []), ...(props.rows.day_passes || [])].sort((a,b) => String(b.created_at || b.sold_at || b.visited_at).localeCompare(String(a.created_at || a.sold_at || a.visited_at))).slice(0,5)
  return <><div className="welcome-row"><div><div className="eyebrow">{new Date().toLocaleDateString('es-CO',{timeZone:'America/Bogota',weekday:'long',day:'numeric',month:'long',year:'numeric'}).toUpperCase()}</div><h1>¡Vamos con toda! <span>💪</span></h1><p className="subheading">Resumen operativo de Atlasgymroom.</p></div><div className="date-button"><CalendarDays size={16}/> Hoy</div></div>
    <div className="stats-grid"><Stat icon={<Users/>} label="Socios registrados" value={String(props.total)} change={`${props.activeMembers} activos`} tint="green"/><Stat icon={<Activity/>} label="Asistencias de hoy" value={String(props.todayAttendances)} change="Entradas registradas" tint="blue"/><Stat icon={<CircleDollarSign/>} label="Dinero recibido hoy" value={formatMoney(props.todayIncome)} change="Pagos y ventas" tint="yellow"/><Stat icon={<CalendarDays/>} label="Por vencer en 7 días" value={String(props.expiring)} change={`${props.expiredMembers} vencidos`} tint="purple"/></div>
    <div className="content-grid"><section className="panel"><div className="panel-heading"><div><h2>Movimientos recientes</h2><p>Pagos, ventas y pases diarios</p></div><button className="text-button" onClick={() => props.onNavigate('Informes')}>Ver informes <ArrowUpRight size={15}/></button></div>
      {recent.length ? <div className="activity-list">{recent.map((r,i) => <div className="activity-row" key={r.id}><div className={`avatar ${i%2?'blue':'lime'}`}>{String(r.id).slice(0,2).toUpperCase()}</div><div className="activity-person"><strong>{r.visitor_name || r.notes || (r.member_id ? 'Pago de socio' : r.total != null ? 'Venta de productos' : 'Movimiento')}</strong><small>{r.status || r.method || 'Registrado'}</small></div><div className="activity-time">{formatDate(r.created_at || r.sold_at || r.visited_at)}</div><strong className="activity-amount">{formatMoney(r.amount_paid ?? r.amount ?? r.total)}</strong></div>)}</div> : <Empty text="Aún no hay movimientos. Registra el primer socio, pago o venta."/>}</section>
      <section className="panel"><div className="panel-heading"><div><h2>Accesos rápidos</h2><p>Operaciones frecuentes</p></div></div><div className="quick-grid"><Quick icon={<UserRound/>} label="Nuevo miembro" onClick={() => props.onNavigate('Miembros')}/><Quick icon={<Activity/>} label="Registrar entrada" onClick={() => props.onNavigate('Asistencia')}/><Quick icon={<CircleDollarSign/>} label="Cobrar mensualidad" onClick={() => props.onNavigate('Pagos')}/><Quick icon={<ShoppingBag/>} label="Nueva venta" onClick={() => props.onNavigate('Ventas')}/></div></section></div>
    <section className="panel bottom-panel"><div className="panel-heading"><div><h2>Alertas de operación</h2><p>Elementos que necesitan revisión</p></div></div><div className="alerts-grid"><div><strong>{props.expiredMembers}</strong><span>Socios vencidos</span></div><div><strong>{props.stockLow.length}</strong><span>Productos con stock bajo</span></div><div><strong>{props.expiring}</strong><span>Vencimientos próximos</span></div></div>{props.stockLow.length>0 && <div className="low-stock-list">{props.stockLow.slice(0,4).map(p=><span key={p.id}>{p.name} · {p.stock} unidades</span>)}</div>}</section>
  </>
}

function DataModule({ config, rows, isOwner, search, setSearch, onCreate, onEdit, memberName, productName, planName }: { config: ModuleConfig; rows: Row[]; isOwner:boolean; search:string; setSearch:(v:string)=>void; onCreate:()=>void; onEdit:(row:Row)=>void; memberName:(id:unknown)=>string; productName:(id:unknown)=>string; planName:(id:unknown)=>string }) {
  const valueFor = (row:Row,key:string) => {
    const value = row[key]
    if (key === 'member_id') return memberName(value)
    if (key === 'product_id') return productName(value)
    if (key === 'plan_id' || key === 'current_plan_id') return planName(value)
    if (key.includes('amount') || key === 'price' || key === 'cost' || key === 'total') return formatMoney(value)
    if (key.includes('date') || key.endsWith('_at')) return formatDate(value)
    if (key === 'active') return value ? 'Activo' : 'Inactivo'
    if (key === 'status') return ({ active:'Activo',inactive:'Inactivo',expired:'Vencido',debt:'Con saldo',paid:'Pagado',partial:'Abono parcial',pending:'Pendiente',voided:'Anulado',open:'Abierta',closed:'Cerrada' } as Record<string,string>)[String(value)] || String(value || '—')
    if (key === 'method') return ({cash:'Efectivo',transfer:'Transferencia',nequi:'Nequi',card:'Tarjeta',other:'Otro'} as Record<string,string>)[String(value)] || value
    if (key === 'role') return value === 'owner' ? 'Propietario' : 'Caja'
    if (key === 'id') return String(value || '').slice(0,8)
    return value == null || value === '' ? '—' : String(value)
  }
  const canEdit = config.table === 'members' || (isOwner && (config.table === 'plans' || config.table === 'products'))
  return <><div className="module-heading"><div><div className="eyebrow">GESTIÓN</div><h1>{config.title}</h1><p>{config.description}</p></div>{config.fields.length > 0 && (config.table !== 'plans' && config.table !== 'products' || isOwner) && <button className="primary-button" onClick={onCreate}><Plus size={16}/> Nuevo registro</button>}{config.table === 'day_passes' && <button className="primary-button" onClick={onCreate}><Plus size={16}/> Nuevo pase</button>}{config.table === 'payments' && <button className="primary-button" onClick={onCreate}><Plus size={16}/> Registrar pago</button>}{config.table === 'sales' && <button className="primary-button" onClick={onCreate}><Plus size={16}/> Nueva venta</button>}{config.table === 'purchases' && <button className="primary-button" onClick={onCreate}><Plus size={16}/> Registrar compra</button>}{config.table === 'expenses' && <button className="primary-button" onClick={onCreate}><Plus size={16}/> Registrar gasto</button>}</div>
    <section className="panel data-panel"><div className="table-toolbar"><div className="module-count">{rows.length} registro(s)</div><div className="search-box"><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar…"/></div></div>
      {rows.length ? <div className="table-wrap"><table><thead><tr>{config.columns.map(c=><th key={c.key}>{c.label}</th>)}{canEdit && <th/>}</tr></thead><tbody>{rows.map(row=><tr key={row.id}>{config.columns.map(c=><td key={c.key}>{valueFor(row,c.key)}</td>)}{canEdit && <td className="action-cell"><button className="table-action" onClick={()=>onEdit(row)} title="Editar"><Pencil size={14}/></button></td>}</tr>)}</tbody></table></div> : <Empty text={search ? 'No hay resultados para esa búsqueda.' : 'Todavía no hay registros en este módulo.'}/>}
    </section>
    {config.table==='products' && <div className="module-footnote"><AlertTriangle size={14}/> Los ajustes directos de existencias deben justificarse. Próxima mejora: pantalla dedicada para ajustes auditados.</div>}
  </>
}

function CashPage({ session, sessions, movements, onOpen, onClose }: { session?:Row; sessions:Row[]; movements:Row[]; onOpen:()=>void; onClose:()=>void }) {
  const currentMovements = session ? movements.filter(m=>m.cash_session_id===session.id) : []
  const cashIncome = currentMovements.filter(m=>m.method==='cash'&&m.direction==='income').reduce((s,m)=>s+Number(m.amount),0)
  const cashExpense = currentMovements.filter(m=>m.method==='cash'&&m.direction==='expense').reduce((s,m)=>s+Number(m.amount),0)
  const expected = Number(session?.initial_cash || 0) + cashIncome - cashExpense
  return <><div className="module-heading"><div><div className="eyebrow">CONTROL FINANCIERO</div><h1>Caja</h1><p>Apertura, movimientos y cierre con diferencia de efectivo.</p></div>{session ? <button className="primary-button" onClick={onClose}>Cerrar caja</button> : <button className="primary-button" onClick={onOpen}><Plus size={16}/> Abrir caja</button>}</div>
    <div className="stats-grid cash-stats"><Stat icon={<Wallet/>} label="Estado de caja" value={session?'Abierta':'Cerrada'} change={session?formatDate(session.opened_at):'Sin sesión activa'} tint="green"/><Stat icon={<CircleDollarSign/>} label="Base inicial" value={formatMoney(session?.initial_cash)} change="Efectivo de apertura" tint="blue"/><Stat icon={<ArrowUpRight/>} label="Ingresos en efectivo" value={formatMoney(cashIncome)} change="Solo dinero recibido" tint="yellow"/><Stat icon={<ArrowDownRight/>} label="Efectivo esperado" value={formatMoney(expected)} change="Base + ingresos − egresos" tint="purple"/></div>
    <section className="panel data-panel"><div className="panel-heading"><div><h2>Movimientos de esta caja</h2><p>Otros métodos de pago se muestran en registros, pero no suman al efectivo.</p></div></div>{currentMovements.length ? <div className="table-wrap"><table><thead><tr><th>Tipo</th><th>Descripción</th><th>Método</th><th>Valor</th><th>Fecha</th></tr></thead><tbody>{currentMovements.map(m=><tr key={m.id}><td>{m.direction==='income'?'Ingreso':'Salida'}</td><td>{m.description}</td><td>{m.method}</td><td>{formatMoney(m.amount)}</td><td>{formatDate(m.created_at)}</td></tr>)}</tbody></table></div> : <Empty text="Sin movimientos vinculados a la caja abierta."/ >}</section>
    <section className="panel data-panel"><div className="panel-heading"><div><h2>Cierres anteriores</h2><p>Historial de sesiones de caja.</p></div></div>{sessions.filter(s=>s.status==='closed').length ? <div className="table-wrap"><table><thead><tr><th>Apertura</th><th>Cierre</th><th>Esperado</th><th>Contado</th><th>Diferencia</th></tr></thead><tbody>{sessions.filter(s=>s.status==='closed').map(s=><tr key={s.id}><td>{formatDate(s.opened_at)}</td><td>{formatDate(s.closed_at)}</td><td>{formatMoney(s.expected_cash)}</td><td>{formatMoney(s.counted_cash)}</td><td>{formatMoney(s.difference)}</td></tr>)}</tbody></table></div>:<Empty text="Aún no hay cierres guardados."/ >}</section>
  </>
}

function Reports({ rows }: { rows:Record<string,Row[]> }) {
  const payments = rows.payments || [], sales = rows.sales || [], expenses = rows.expenses || [], passes=rows.day_passes||[]
  const income = [...payments,...sales,...passes].reduce((s,r)=>s+Number(r.amount_paid ?? r.amount ?? 0),0)
  const spent = expenses.reduce((s,r)=>s+Number(r.amount||0),0)
  const saleUnits = (rows.sale_items||[]).reduce((s,r)=>s+Number(r.quantity||0),0)
  return <><div className="module-heading"><div><div className="eyebrow">ANÁLISIS</div><h1>Informes</h1><p>Resumen acumulado de los registros disponibles en esta cuenta/dispositivo.</p></div><button className="secondary-button" onClick={()=>window.print()}><FileDown size={16}/> Imprimir / Guardar PDF</button></div>
    <div className="stats-grid"><Stat icon={<ArrowUpRight/>} label="Dinero recibido" value={formatMoney(income)} change="Mensualidades, ventas y pases" tint="green"/><Stat icon={<ArrowDownRight/>} label="Gastos registrados" value={formatMoney(spent)} change="Egresos" tint="yellow"/><Stat icon={<BarChart3/>} label="Saldo simple" value={formatMoney(income-spent)} change="Ingresos menos gastos" tint="blue"/><Stat icon={<ShoppingBag/>} label="Unidades vendidas" value={String(saleUnits)} change={`${sales.length} ventas`} tint="purple"/></div>
    <div className="content-grid"><section className="panel"><div className="panel-heading"><div><h2>Ingresos por concepto</h2><p>Acumulado de movimientos registrados</p></div></div><div className="report-line"><span>Mensualidades</span><strong>{formatMoney(payments.reduce((s,r)=>s+Number(r.amount_paid||0),0))}</strong></div><div className="report-line"><span>Ventas</span><strong>{formatMoney(sales.reduce((s,r)=>s+Number(r.amount_paid||0),0))}</strong></div><div className="report-line"><span>Pases diarios</span><strong>{formatMoney(passes.reduce((s,r)=>s+Number(r.amount||0),0))}</strong></div></section><section className="panel"><div className="panel-heading"><div><h2>Resumen operativo</h2><p>Volumen de registros</p></div></div>{[['Miembros',(rows.members||[]).length],['Asistencias',(rows.attendance||[]).length],['Productos',(rows.products||[]).length],['Compras',(rows.purchases||[]).length],['Gastos',expenses.length]].map(([name,count])=><div className="report-line" key={String(name)}><span>{name}</span><strong>{count}</strong></div>)}</section></div>
    <p className="module-footnote"><AlertTriangle size={14}/> Los informes de esta versión muestran acumulados de los datos sincronizados/locales cargados; faltan filtros avanzados por periodo y formatos personalizados del gimnasio.</p>
  </>
}

function SettingsPage({ onBackup, onRestore }: { onBackup:()=>void; onRestore:()=>void }) {
  return <><div className="module-heading"><div><div className="eyebrow">SISTEMA</div><h1>Configuración</h1><p>Conexión, respaldos y continuidad operativa.</p></div></div><div className="content-grid"><section className="panel setting-card"><div className="setting-icon"><FileDown/></div><h2>Respaldo local</h2><p>Descarga un archivo JSON con los datos guardados en este navegador. El respaldo puede contener información personal; protégelo.</p><button className="primary-button" onClick={onBackup}><Download size={16}/> Exportar respaldo</button></section><section className="panel setting-card"><div className="setting-icon"><FileUp/></div><h2>Restaurar respaldo</h2><p>Importa un respaldo previamente exportado en el dispositivo actual. Los registros se agregan o actualizan; no se eliminan datos existentes.</p><button className="secondary-button" onClick={onRestore}><FileUp size={16}/> Seleccionar archivo</button></section></div><section className="panel security-panel"><Shield/><div><h2>Seguridad y acceso</h2><p>Con Supabase, los usuarios se autentican individualmente y la base de datos aplica permisos RLS. Los roles se administran desde el perfil del usuario. No compartas contraseñas ni claves secretas.</p></div></section></>
}

function AccessDenied(){return <div className="panel access-denied"><Shield size={25}/><h2>Acceso reservado al propietario</h2><p>Este módulo contiene información administrativa. Solicita al propietario que revise los permisos de tu cuenta.</p></div>}
function Stat({icon,label,value,change,tint}:{icon:ReactNode;label:string;value:string;change:string;tint:string}){return <div className="stat-card"><div className={`stat-icon ${tint}`}>{icon}</div><span className="stat-label">{label}</span><strong className="stat-value">{value}</strong><small className="neutral">{change}</small></div>}
function Quick({icon,label,onClick}:{icon:ReactNode;label:string;onClick:()=>void}){return <button className="quick-action" onClick={onClick}><span>{icon}</span><strong>{label}</strong><ArrowUpRight size={15}/></button>}
function Empty({text}:{text:string}){return <div className="empty-state"><ClipboardList size={24}/><p>{text}</p></div>}
function Modal({title,children,onClose}:{title:string;children:ReactNode;onClose:()=>void}){return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><section className="modal"><div className="modal-heading"><h2>{title}</h2><button onClick={onClose}><X size={18}/></button></div>{children}</section></div>}
function FieldInput({field,value,onChange}:{field:Field;value:string;onChange:(v:string)=>void}){return <label className={field.type==='textarea'?'field full':'field'}>{field.label}{field.type==='select'?<select disabled={field.disabled} value={value} onChange={e=>onChange(e.target.value)} required={field.required}><option value="">Seleccionar…</option>{field.options?.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select>:field.type==='textarea'?<textarea disabled={field.disabled} value={value} onChange={e=>onChange(e.target.value)} placeholder={field.placeholder} required={field.required}/>:<input disabled={field.disabled} type={field.type||'text'} value={value} onChange={e=>onChange(e.target.value)} placeholder={field.placeholder} required={field.required} min={field.type==='number'?0:undefined}/>}</label>}
function FormActions({busy,onCancel}:{busy:boolean;onCancel:()=>void}){return <div className="form-actions"><button type="button" className="secondary-button" onClick={onCancel}>Cancelar</button><button disabled={busy} className="primary-button"><Check size={16}/>{busy?'Procesando…':'Confirmar registro'}</button></div>}
function ProductAdder({options,onAdd}:{options:{value:string;label:string}[];onAdd:(id:string,qty:number)=>void}){const [id,setId]=useState('');const [qty,setQty]=useState('1');return <div className="product-adder"><select value={id} onChange={e=>setId(e.target.value)}><option value="">Selecciona producto…</option>{options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select><input aria-label="Cantidad" type="number" min="1" value={qty} onChange={e=>setQty(e.target.value)}/><button type="button" className="secondary-button" disabled={!id||Number(qty)<1} onClick={()=>{onAdd(id,Number(qty));setId('');setQty('1')}}><Plus size={15}/> Agregar</button></div>}
function LineList({lines,products,onChange}:{lines:{product_id:string;quantity:number}[];products:Row[];onChange:(v:{product_id:string;quantity:number}[])=>void}){return <div className="cart-lines">{lines.map(line=>{const p=products.find(x=>x.id===line.product_id);return <div key={line.product_id}><span>{p?.name} × {line.quantity}</span><strong>{formatMoney(Number(p?.price||0)*line.quantity)}</strong><button type="button" onClick={()=>onChange(lines.filter(x=>x.product_id!==line.product_id))}><X size={14}/></button></div>})}{!lines.length&&<small>Aún no hay productos agregados.</small>}</div>}
function PurchaseLineList({lines,products,onChange}:{lines:{product_id:string;quantity:number;unit_cost:number}[];products:Row[];onChange:(v:{product_id:string;quantity:number;unit_cost:number}[])=>void}){return <div className="cart-lines">{lines.map((line,i)=>{const p=products.find(x=>x.id===line.product_id);return <div key={i}><span>{p?.name} × {line.quantity} <small>({formatMoney(line.unit_cost)} c/u)</small></span><strong>{formatMoney(line.unit_cost*line.quantity)}</strong><button type="button" onClick={()=>onChange(lines.filter((_,idx)=>idx!==i))}><X size={14}/></button></div>})}{!lines.length&&<small>Aún no hay productos comprados.</small>}</div>}
function dialogTitle(dialog: string, editing: Row|null){if(dialog==='record')return editing?'Editar registro':'Nuevo registro';return ({payment:'Registrar mensualidad',daypass:'Registrar pase diario',expense:'Registrar gasto',sale:'Nueva venta',purchase:'Registrar compra',cash:'Control de caja'} as Record<string,string>)[dialog]||'Movimiento'}
