import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import {
  Activity, ArrowDownRight, ArrowUpRight, BarChart3, CalendarDays,
  Check, CircleDollarSign, ClipboardList, Cloud, CloudOff,
  Download, Dumbbell, FileDown, FileUp, Home, LogOut, Menu,
  Package, Plus, RefreshCw, Search, Settings, Shield, ShoppingBag, ShoppingCart, Users, ImagePlus, Tag, Zap,
  Wallet, X, Pencil, Receipt, AlertTriangle, UserRound, LockKeyhole, Pause, Play,
} from 'lucide-react'
import { supabase, supabaseConfigured } from './lib/supabase'
import {
  exportLocalBackup, importLocalBackup, listRows, queueStatus, resetLocalTestData, runBusinessRpc,
  saveRow, syncPending, updateRow,
} from './lib/data'
import { makeId, nowIso, type EntityTable, type Row } from './lib/localdb'

type Section = 'Inicio' | 'Miembros' | 'Planes' | 'Asistencia' | 'Pase diario' | 'Pagos' | 'Ventas' | 'Productos' | 'Compras' | 'Gastos' | 'Caja' | 'Informes' | 'Equipo' | 'Auditoría' | 'Configuración' | 'Tarifas' | 'Cuentas por Cobrar Pagos' | 'Congelar Pagos' | 'Notas Débito' | 'Notas Crédito' | 'Cuentas por Cobrar Ventas' | 'Lista de Precios' | 'Evoluciones' | 'Rutinas' | 'Ejercicios' | 'Proveedores' | 'Empleados' | 'Cuentas por Pagar Compras' | 'Documento Soporte' | 'Notas Ajuste' | 'Tipos de Gastos' | 'Ajuste Cartera' | 'Categorías de Producto' | 'Ajustes de Inventario' | 'Regularizaciones de Inventario' | 'Kardex de Inventario' | 'Configuración de Reservaciones' | 'Clases' | 'Reservaciones' | 'Mi Sucursal' | 'Menú de Navegación' | 'Roles' | 'Usuarios' | 'Configuración de Correos' | 'Plantilla de Correos' | 'Notificaciones' | 'Historial de Correos'
type Field = { key: string; label: string; type?: string; required?: boolean; disabled?: boolean; placeholder?: string; options?: { value: string; label: string }[] }
type ModuleConfig = { table: EntityTable; title: string; description: string; fields: Field[]; columns: { key: string; label: string }[] }

type NavLeaf = { label: string; target: Section }
type NavGroup = { label: string; icon: typeof Home; target?: Section; items?: NavLeaf[]; ownerOnly?: boolean }
const navGroups: NavGroup[] = [
  { label: 'Tablero', icon: Home, target: 'Inicio' },
  { label: 'Asistencia', icon: Activity, items: [{ label: 'Lista de asistencia', target: 'Asistencia' }, { label: 'Pase diario', target: 'Pase diario' }] },
  { label: 'Administración', icon: Settings, ownerOnly: true, items: [
    { label: 'Auditorías', target: 'Auditoría' }, { label: 'Configuración', target: 'Configuración' },
    { label: 'Menú de navegación', target: 'Menú de Navegación' }, { label: 'Mi sucursal', target: 'Mi Sucursal' },
    { label: 'Roles', target: 'Roles' }, { label: 'Usuarios', target: 'Usuarios' },
    { label: 'Configuración de correos', target: 'Configuración de Correos' }, { label: 'Plantilla de correos', target: 'Plantilla de Correos' },
    { label: 'Notificaciones', target: 'Notificaciones' }, { label: 'Historial de correos', target: 'Historial de Correos' },
  ] },
  { label: 'Pagos', icon: CircleDollarSign, items: [
    { label: 'Tarifas', target: 'Tarifas' }, { label: 'Pagos', target: 'Pagos' },
    { label: 'Cuentas por cobrar pagos', target: 'Cuentas por Cobrar Pagos' }, { label: 'Congelar pagos', target: 'Congelar Pagos' },
  ] },
  { label: 'Ventas', icon: ShoppingBag, items: [
    { label: 'Ventas', target: 'Ventas' }, { label: 'Notas débito', target: 'Notas Débito' },
    { label: 'Notas crédito', target: 'Notas Crédito' }, { label: 'Cuentas por cobrar ventas', target: 'Cuentas por Cobrar Ventas' },
    { label: 'Lista de precios', target: 'Lista de Precios' },
  ] },
  { label: 'Clientes', icon: Users, items: [
    { label: 'Clientes', target: 'Miembros' }, { label: 'Evoluciones', target: 'Evoluciones' },
    { label: 'Rutinas', target: 'Rutinas' }, { label: 'Ejercicios', target: 'Ejercicios' },
  ] },
  { label: 'Terceros', icon: UserRound, items: [
    { label: 'Proveedores', target: 'Proveedores' }, { label: 'Empleados', target: 'Empleados' },
  ] },
  { label: 'Egresos', icon: Receipt, items: [
    { label: 'Compras', target: 'Compras' }, { label: 'Cuentas por pagar compras', target: 'Cuentas por Pagar Compras' },
    { label: 'Documento soporte', target: 'Documento Soporte' }, { label: 'Notas ajuste', target: 'Notas Ajuste' },
    { label: 'Tipos de gastos', target: 'Tipos de Gastos' }, { label: 'Gastos', target: 'Gastos' }, { label: 'Ajuste cartera', target: 'Ajuste Cartera' },
  ] },
  { label: 'Productos', icon: Package, items: [
    { label: 'Categorías de producto', target: 'Categorías de Producto' }, { label: 'Productos', target: 'Productos' },
    { label: 'Ajustes de inventario', target: 'Ajustes de Inventario' }, { label: 'Regularizaciones de inventario', target: 'Regularizaciones de Inventario' },
    { label: 'Kardex de inventario', target: 'Kardex de Inventario' },
  ] },
  { label: 'Reservaciones', icon: CalendarDays, items: [
    { label: 'Configuración', target: 'Configuración de Reservaciones' }, { label: 'Clases', target: 'Clases' }, { label: 'Reservaciones', target: 'Reservaciones' },
  ] },
  { label: 'Caja', icon: Wallet, target: 'Caja' },
  { label: 'Informes', icon: BarChart3, target: 'Informes' },
]
const methods = [{ value: 'cash', label: 'Efectivo' }, { value: 'transfer', label: 'Transferencia' }, { value: 'nequi', label: 'Nequi' }, { value: 'card', label: 'Datáfono / tarjeta' }, { value: 'other', label: 'Otro' }]
const statuses = [{ value: 'active', label: 'Activo' }, { value: 'inactive', label: 'Inactivo' }, { value: 'expired', label: 'Vencido' }, { value: 'debt', label: 'Con saldo pendiente' }]
const defaultTariffs: Row[] = [
  { id: '10000000-0000-4000-8000-000000000001', name: 'Diario', plan_type: 'normal', duration_days: 1, ticket_quantity: 0, price: 4000, active: true, allow_price_change: true, start_time: '05:00', end_time: '22:00', second_start_time: '12:00', second_end_time: '12:00', available_days: 'Lun,Mar,Mie,Jue,Vie,Sab,Dom', includes_tax: false, sale_price: 0, taxes: '', notes: 'Acceso por un día' },
  { id: '10000000-0000-4000-8000-000000000002', name: 'Quincenal', plan_type: 'normal', duration_days: 15, ticket_quantity: 0, price: 30000, active: true, allow_price_change: true, start_time: '05:00', end_time: '22:00', second_start_time: '12:00', second_end_time: '12:00', available_days: 'Lun,Mar,Mie,Jue,Vie,Sab,Dom', includes_tax: false, sale_price: 0, taxes: '', notes: 'Tarifa por 15 días' },
  { id: '10000000-0000-4000-8000-000000000003', name: 'Mensual', plan_type: 'normal', duration_days: 30, ticket_quantity: 0, price: 60000, active: true, allow_price_change: true, start_time: '05:00', end_time: '22:00', second_start_time: '12:00', second_end_time: '12:00', available_days: 'Lun,Mar,Mie,Jue,Vie,Sab,Dom', includes_tax: false, sale_price: 0, taxes: '', notes: 'Tarifa por 30 días' },
  { id: '10000000-0000-4000-8000-000000000004', name: 'Ticket 5 días', plan_type: 'ticket', duration_days: 5, ticket_quantity: 5, price: 0, active: false, allow_price_change: true, start_time: '05:00', end_time: '22:00', second_start_time: '12:00', second_end_time: '12:00', available_days: 'Lun,Mar,Mie,Jue,Vie,Sab,Dom', includes_tax: false, sale_price: 0, taxes: '', notes: 'Definir precio y activar antes de vender' },
  { id: '10000000-0000-4000-8000-000000000005', name: 'Ticket 10 días', plan_type: 'ticket', duration_days: 10, ticket_quantity: 10, price: 0, active: false, allow_price_change: true, start_time: '05:00', end_time: '22:00', second_start_time: '12:00', second_end_time: '12:00', available_days: 'Lun,Mar,Mie,Jue,Vie,Sab,Dom', includes_tax: false, sale_price: 0, taxes: '', notes: 'Definir precio y activar antes de vender' },
  { id: '10000000-0000-4000-8000-000000000006', name: 'Ticket 15 días', plan_type: 'ticket', duration_days: 15, ticket_quantity: 15, price: 0, active: false, allow_price_change: true, start_time: '05:00', end_time: '22:00', second_start_time: '12:00', second_end_time: '12:00', available_days: 'Lun,Mar,Mie,Jue,Vie,Sab,Dom', includes_tax: false, sale_price: 0, taxes: '', notes: 'Definir precio y activar antes de vender' },
]
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
      { key: 'full_name', label: 'Nombre completo', required: true }, { key: 'document', label: 'Cédula (obligatoria)', required: true, placeholder: 'Número de identificación' },
      { key: 'phone', label: 'Teléfono' }, { key: 'email', label: 'Correo', type: 'email' },
      { key: 'birth_date', label: 'Fecha de nacimiento', type: 'date' }, { key: 'current_plan_id', label: 'Plan', type: 'select', options: [{ value: '', label: 'Sin plan asignado' }, ...planOptions] },
      { key: 'start_date', label: 'Inicio', type: 'date' }, { key: 'end_date', label: 'Vencimiento', type: 'date' },
      { key: 'status', label: 'Estado', type: 'select', options: statuses }, { key: 'notes', label: 'Notas', type: 'textarea' },
    ], columns: [{ key: 'full_name', label: 'Nombre' }, { key: 'document', label: 'Cédula' }, { key: 'phone', label: 'Teléfono' }, { key: 'status', label: 'Estado' }, { key: 'end_date', label: 'Vence' }] },
    Planes: { table: 'plans', title: 'Tarifas', description: 'Configura duración, precio, horarios, días disponibles e información tributaria.', fields: [
      { key: 'name', label: 'Nombre de la tarifa', required: true },
      { key: 'plan_type', label: 'Tipo de tarifa', type: 'select', options: [{ value: 'normal', label: 'Normal' }, { value: 'ticket', label: 'Ticket por días' }] },
      { key: 'price', label: 'Valor (COP)', type: 'number', required: true },
      { key: 'duration_days', label: 'Cantidad de días', type: 'number', required: true },
      { key: 'ticket_quantity', label: 'Cantidad de tiquetes', type: 'number' },
      { key: 'allow_price_change', label: 'Modificar precio', type: 'select', options: [{ value: 'true', label: 'Sí' }, { value: 'false', label: 'No' }] },
      { key: 'active', label: 'Estado', type: 'select', options: [{ value: 'true', label: 'Activa' }, { value: 'false', label: 'Inactiva' }] },
      { key: 'start_time', label: 'Hora desde', type: 'time' }, { key: 'end_time', label: 'Hora hasta', type: 'time' },
      { key: 'second_start_time', label: 'Hora desde 2', type: 'time' }, { key: 'second_end_time', label: 'Hora hasta 2', type: 'time' },
      { key: 'available_days', label: 'Disponible los días', placeholder: 'Lun,Mar,Mie,Jue,Vie,Sab,Dom' },
      { key: 'tax_classification', label: 'Clasificación tributaria' }, { key: 'internal_code', label: 'Código interno (DIAN)' },
      { key: 'sale_price', label: 'Precio (valor de venta)', type: 'number' },
      { key: 'includes_tax', label: 'Incluye impuestos', type: 'select', options: [{ value: 'true', label: 'Sí' }, { value: 'false', label: 'No' }] },
      { key: 'taxes', label: 'Impuestos / observaciones', type: 'textarea' },
      { key: 'notes', label: 'Descripción', type: 'textarea' },
    ], columns: [{ key: 'name', label: 'Tarifa' }, { key: 'duration_days', label: 'Días' }, { key: 'ticket_quantity', label: 'Tiquetes' }, { key: 'price', label: 'Precio' }, { key: 'active', label: 'Estado' }] },
    Asistencia: { table: 'attendance', title: 'Asistencia', description: 'Registra entradas de socios o visitantes.', fields: [
      { key: 'member_id', label: 'Socio', type: 'select', options: [{ value: '', label: 'No es socio / visitante' }, ...memberOptions] },
      { key: 'visitor_name', label: 'Nombre del visitante' }, { key: 'entry_type', label: 'Tipo', type: 'select', options: [{ value: 'member', label: 'Socio' }, { value: 'day_pass', label: 'Pase diario' }] },
      { key: 'notes', label: 'Notas' },
    ], columns: [{ key: 'member_id', label: 'Socio' }, { key: 'visitor_name', label: 'Visitante' }, { key: 'entry_type', label: 'Tipo' }, { key: 'entered_at', label: 'Hora' }] },
    'Pase diario': { table: 'day_passes', title: 'Pases diarios', description: 'Entradas de visitantes sin crear una membresía.', fields: [], columns: [{ key: 'visitor_name', label: 'Visitante' }, { key: 'amount', label: 'Tarifa' }, { key: 'method', label: 'Método' }, { key: 'visited_at', label: 'Fecha' }] },
    Pagos: { table: 'payments', title: 'Pagos y mensualidades', description: 'Historial de cobros, abonos y saldos pendientes.', fields: [], columns: [{ key: 'member_id', label: 'Socio' }, { key: 'amount', label: 'Valor' }, { key: 'amount_paid', label: 'Recibido' }, { key: 'status', label: 'Estado' }, { key: 'paid_at', label: 'Fecha' }] },
    Productos: { table: 'products', title: 'Productos e inventario', description: 'Catálogo, precios, costos y existencias.', fields: [
      { key: 'name', label: 'Nombre del producto', required: true }, { key: 'category', label: 'Categoría', placeholder: 'Bebidas, suplementos, accesorios…' }, { key: 'sku', label: 'Código / SKU' }, { key: 'description', label: 'Descripción' },
      { key: 'cost', label: 'Costo (COP)', type: 'number' }, { key: 'price', label: 'Precio (COP)', type: 'number', required: true },
      { key: 'stock', label: 'Existencias iniciales', type: 'number', required: true }, { key: 'min_stock', label: 'Stock mínimo', type: 'number' },
    ], columns: [{ key: 'name', label: 'Producto' }, { key: 'category', label: 'Categoría' }, { key: 'stock', label: 'Existencias' }, { key: 'min_stock', label: 'Mínimo' }, { key: 'price', label: 'Precio' }] },
    Compras: { table: 'purchases', title: 'Compras', description: 'Registra entradas de mercancía y proveedores.', fields: [], columns: [{ key: 'supplier', label: 'Proveedor' }, { key: 'description', label: 'Descripción' }, { key: 'total_amount', label: 'Total' }, { key: 'purchased_at', label: 'Fecha' }] },
    Gastos: { table: 'expenses', title: 'Gastos y egresos', description: 'Registra salidas y conserva el responsable del movimiento.', fields: [], columns: [{ key: 'category', label: 'Categoría' }, { key: 'description', label: 'Concepto' }, { key: 'amount', label: 'Valor' }, { key: 'method', label: 'Método' }, { key: 'expense_date', label: 'Fecha' }] },
    Ventas: { table: 'sales', title: 'Punto de venta', description: 'Agrega productos al carrito y confirma la venta.', fields: [], columns: [{ key: 'id', label: 'Venta' }, { key: 'total', label: 'Total' }, { key: 'amount_paid', label: 'Recibido' }, { key: 'status', label: 'Estado' }, { key: 'sold_at', label: 'Fecha' }] },
    Equipo: { table: 'profiles', title: 'Equipo y usuarios', description: 'Usuarios individuales. Las cuentas se crean desde Supabase Auth.', fields: [], columns: [{ key: 'full_name', label: 'Nombre' }, { key: 'role', label: 'Rol' }, { key: 'active', label: 'Activo' }] },
    Auditoría: { table: 'audit_logs', title: 'Auditoría', description: 'Historial de modificaciones registradas en la base de datos.', fields: [], columns: [{ key: 'entity_table', label: 'Módulo' }, { key: 'action', label: 'Acción' }, { key: 'entity_id', label: 'Registro' }, { key: 'changed_at', label: 'Fecha' }] },
  }
  const normalized: Section = section === 'Tarifas' || section === 'Lista de Precios' ? 'Planes' : section === 'Cuentas por Cobrar Pagos' ? 'Pagos' : section === 'Congelar Pagos' ? 'Miembros' : section
  const config = base[normalized] as ModuleConfig | undefined
  if (!config) return null
  if (section === 'Cuentas por Cobrar Pagos') return { ...config, title: 'Cuentas por cobrar pagos', description: 'Abonos pendientes y saldos que faltan por recibir.' }
  if (section === 'Congelar Pagos') return { ...config, title: 'Congelar pagos', description: 'Clientes con actividad pausada y acciones para reactivar su tarifa.' }
  return config
}

export default function App() {
  const [section, setSection] = useState<Section>('Inicio')
  const [menuOpen, setMenuOpen] = useState(false)
  const [session, setSession] = useState<Session | null>(null)
  const [authLoading, setAuthLoading] = useState(Boolean(supabaseConfigured))
  const [recoveryMode, setRecoveryMode] = useState(false)
  const [profile, setProfile] = useState<Row | null>(null)
  const [rows, setRows] = useState<Record<string, Row[]>>({})
  const [search, setSearch] = useState('')
  const [attendanceLookup, setAttendanceLookup] = useState('')
  const [memberLookup, setMemberLookup] = useState('')
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({ Asistencia: true, Pagos: true, Clientes: true })
  const [dialog, setDialog] = useState<'record' | 'payment' | 'balance' | 'daypass' | 'expense' | 'sale' | 'purchase' | 'cash' | null>(null)
  const [editing, setEditing] = useState<Row | null>(null)
  const [form, setForm] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState('')
  const [syncCount, setSyncCount] = useState(0)
  const [saleLines, setSaleLines] = useState<{ product_id: string; quantity: number }[]>([])
  const [purchaseLines, setPurchaseLines] = useState<{ product_id: string; quantity: number; unit_cost: number }[]>([])
  const [productImageFile, setProductImageFile] = useState<File | null>(null)
  const [productImagePreview, setProductImagePreview] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const refresh = useCallback(async () => {
    const names: EntityTable[] = ['profiles','plans','members','payments','attendance','day_passes','products','sales','sale_items','stock_movements','purchases','purchase_items','expenses','cash_sessions','cash_movements','audit_logs','gym_records']
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
    const { data: listener } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next)
      if (event === 'PASSWORD_RECOVERY') setRecoveryMode(true)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (session?.user) {
      supabase?.from('profiles').select('*').eq('id', session.user.id).maybeSingle().then(({ data }) => setProfile(data))
      void syncPending().then(() => refresh())
    } else if (!supabaseConfigured) {
      setProfile({ id: 'local-owner', full_name: 'Administrador local', role: 'owner', active: true })
      void (async () => {
        const currentPlans = await listRows('plans')
        for (const plan of defaultTariffs) if (!currentPlans.some(row => row.name.toLowerCase() === plan.name.toLowerCase())) await saveRow('plans', { ...plan, created_by: null, created_at: nowIso(), updated_at: nowIso() })
        await refresh()
      })()
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
  const scopedRows = moduleConfig?.table === 'gym_records' ? moduleRows.filter(row => row.record_type === section) : section === 'Cuentas por Cobrar Pagos' ? moduleRows.filter(row => Number(row.amount || 0) > Number(row.amount_paid || 0) && row.status !== 'voided') : section === 'Cuentas por Cobrar Ventas' ? moduleRows.filter(row => Number(row.total || 0) > Number(row.amount_paid || 0) && row.status !== 'voided') : section === 'Cuentas por Pagar Compras' ? moduleRows.filter(row => Number(row.total_amount || 0) > Number(row.amount_paid || 0)) : section === 'Congelar Pagos' ? moduleRows.filter(row => Boolean(row.paused_at)) : moduleRows
  const filteredRows = scopedRows.filter(row => JSON.stringify(row).toLowerCase().includes(search.toLowerCase()))

  async function signIn(email: string, password: string) {
    if (!supabase) return
    setBusy(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setBusy(false)
    if (error) setToast(error.message)
  }
  async function requestPasswordRecovery(email: string) {
    if (!supabase || !email.trim()) { setToast('Escribe tu correo electrónico.'); return }
    setBusy(true)
    const redirectTo = window.location.origin + import.meta.env.BASE_URL
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo })
    setBusy(false)
    setToast(error ? error.message : 'Te enviamos un enlace. Revisa tu correo y abre el enlace más reciente en este mismo sitio.')
  }
  async function saveNewPassword(password: string) {
    if (!supabase) return
    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (error) { setToast(error.message); return }
    await supabase.auth.signOut()
    setSession(null)
    setRecoveryMode(false)
    setToast('Contraseña actualizada. Ya puedes iniciar sesión con la nueva contraseña.')
  }
  async function signOut() { await supabase?.auth.signOut(); setSection('Inicio') }

  function notify(message: string) { setToast(message); window.setTimeout(() => setToast(''), 5000) }
  function openRecord(edit?: Row) {
    if (!moduleConfig) return
    setEditing(edit || null)
    setProductImageFile(null); setProductImagePreview(edit?.image_url || '')
    const initial: Record<string, string> = {}
    moduleConfig.fields.forEach(f => { initial[f.key] = edit?.[f.key] == null ? '' : String(edit[f.key]) })
    setForm(initial)
    setDialog('record')
  }
  function openSpecial(which: NonNullable<typeof dialog>) {
    setEditing(null); setProductImageFile(null); setProductImagePreview(''); setForm(which === 'daypass' ? { visitor_name: 'Entrada general', amount: '4000', method: 'cash' } : {}); setSaleLines([]); setPurchaseLines([]); setDialog(which)
  }

  function openMemberPayment(member: Row) {
    const plan = rows.plans?.find(p => p.id === member.current_plan_id && p.active !== false)
    const amount = String(plan?.price ?? '')
    setEditing(null)
    setForm({ member_id: member.id, plan_id: plan?.id || '', amount, amount_paid: amount, method: 'cash' })
    setDialog('payment')
  }

  async function toggleMemberPause(member: Row) {
    const isPaused = Boolean(member.paused_at)
    if (!isPaused && (member.status !== 'active' || (member.end_date && member.end_date < today()))) { notify('Solo puedes congelar una tarifa que esté vigente.'); return }
    let updated: Row
    if (isPaused) {
      const start = new Date(String(member.paused_at) + 'T12:00:00-05:00')
      const end = new Date(today() + 'T12:00:00-05:00')
      const pausedDays = Math.max(0, Math.floor((end.getTime() - start.getTime()) / 86400000))
      updated = { ...member, status: 'active', paused_at: null, paused_days: Number(member.paused_days || 0) + pausedDays, end_date: member.end_date ? datePlusDays(String(member.end_date), pausedDays) : null, updated_at: nowIso() }
    } else {
      updated = { ...member, status: 'inactive', paused_at: today(), updated_at: nowIso() }
    }
    setBusy(true)
    const result = await updateRow('members', updated)
    setBusy(false)
    setDialog(null)
    notify(result.message || (isPaused ? 'Actividad reactivada; se compensaron los días pausados.' : 'Actividad pausada; la tarifa queda congelada hasta reactivarla.'))
    await refresh()
  }

  async function registerMemberEntry(member: Row) {
    const valid = member.status === 'active' && !member.paused_at && Boolean(member.current_plan_id) && Boolean(member.end_date) && member.end_date >= today()
    if (!valid) { notify(`${member.full_name}: la tarifa está vencida o pausada. Abre su ficha y registra un pago para habilitar el ingreso.`); return }
    const alreadyEntered = (rows.attendance || []).some(a => a.member_id === member.id && dateInBogota(a.entered_at) === today())
    if (alreadyEntered) { notify(member.full_name + ' ya tiene una entrada registrada hoy.'); setAttendanceLookup(''); return }
    const id = makeId()
    const row: Row = { id, member_id: member.id, visitor_name: null, entry_type: 'member', entered_at: nowIso(), created_by: session?.user.id || null, created_at: nowIso() }
    setBusy(true)
    const result = await runBusinessRpc('register_attendance', { p_attendance: row }, [{ table: 'attendance', row }])
    setBusy(false)
    notify(result.message || `Ingreso registrado: ${member.full_name}`)
    setAttendanceLookup('')
    await refresh()
  }

  async function submitRecord(event: FormEvent) {
    event.preventDefault()
    if (!moduleConfig) return
    const row: Row = { ...(editing || {}), id: editing?.id || makeId(), ...Object.fromEntries(Object.entries(form).map(([key,value]) => [key, value === '' ? null : value])), created_by: editing?.created_by || session?.user.id || null, updated_at: nowIso() }
    for (const field of moduleConfig.fields) {
      if (field.type === 'number') row[field.key] = Number(form[field.key] || 0)
      if (['active','allow_price_change','includes_tax'].includes(field.key)) row[field.key] = form[field.key] === 'true'
    }
    if (section === 'Miembros') {
      row.status ||= 'active'; row.current_plan_id ||= null
      const document = String(row.document || '').trim().replace(/\s+/g, '')
      if (!document) { notify('La cédula es obligatoria para registrar un cliente.'); return }
      if (members.some(m => String(m.document || '').replace(/\\s+/g, '') === document && m.id !== row.id)) { notify('Ya existe un cliente registrado con esa cédula.'); return }
      row.document = document
    }
    if (section === 'Productos') { row.stock = Number(row.stock || 0); row.min_stock = Number(row.min_stock || 0); row.cost = Number(row.cost || 0); row.price = Number(row.price || 0); row.category = String(row.category || 'Otros').trim() || 'Otros'; row.active = true }
    if (section === 'Asistencia') {
      row.member_id ||= null; row.visitor_name ||= null; row.entry_type ||= row.member_id ? 'member' : 'day_pass'
      if (row.member_id) { const linked = rows.members?.find(m => m.id === row.member_id); if (!linked || linked.status !== 'active' || linked.paused_at || !linked.current_plan_id || !linked.end_date || linked.end_date < today()) { notify('El cliente no tiene una tarifa vigente.'); return } if ((rows.attendance || []).some(a => a.member_id === row.member_id && dateInBogota(a.entered_at) === today())) { notify('Este cliente ya tiene una entrada registrada hoy.'); return } }
      if (!row.member_id && !row.visitor_name) { notify('Selecciona un cliente o escribe el nombre del visitante.'); return }
      row.entered_at = nowIso()
    }
    if (section === 'Planes') row.active = form.active !== 'false'
    if (moduleConfig.table === 'gym_records') { row.record_type = section; row.amount = Number(row.amount || 0) }
    setBusy(true)
    if (section === 'Productos' && productImageFile) {
      try {
        const blob = await compressProductImage(productImageFile)
        if (supabaseConfigured && supabase) {
          if (!navigator.onLine) throw new Error('Conéctate a Internet para subir la imagen del producto.')
          const path = `${row.id}/${makeId()}.webp`
          const { data: uploaded, error } = await supabase.storage.from('product-images').upload(path, blob, { contentType: 'image/webp', upsert: false })
          if (error) throw error
          row.image_url = supabase.storage.from('product-images').getPublicUrl(uploaded.path).data.publicUrl
        } else {
          row.image_url = await blobToDataUrl(blob)
        }
      } catch (error) {
        setBusy(false); notify(error instanceof Error ? error.message : 'No se pudo procesar la imagen.'); return
      }
    }
    const stockMovementId = makeId()
    const result = section === 'Productos' && !editing
      ? await runBusinessRpc('create_product', { p_product: { ...row, stock_movement_id: stockMovementId } }, [
          { table: 'products', row },
          ...(Number(row.stock) > 0 ? [{ table: 'stock_movements' as const, row: { id: stockMovementId, product_id: row.id, movement_type: 'adjustment', quantity: Number(row.stock), notes: 'Existencias iniciales', created_by: session?.user.id || null, created_at: nowIso() } }] : []),
        ])
      : section === 'Productos' && editing
        ? await updateRow(moduleConfig.table, row)
        : section === 'Asistencia'
          ? await runBusinessRpc('register_attendance', { p_attendance: row }, [{ table: 'attendance', row }])
          : await saveRow(moduleConfig.table, row)
    setBusy(false); setDialog(null); setProductImageFile(null); setProductImagePreview(''); notify(result.message || (result.synced ? 'Registro guardado y sincronizado.' : 'Registro guardado localmente.'))
    await refresh()
  }

  async function submitPayment(event: FormEvent) {
    event.preventDefault()
    const id = makeId()
    const amount = Number(form.amount || 0), amount_paid = Number(form.amount_paid === undefined || form.amount_paid === '' ? form.amount || 0 : form.amount_paid)
    const payment: Row = { id, member_id: form.member_id, plan_id: form.plan_id || null, amount, amount_paid, method: form.method || 'cash', status: amount_paid === 0 ? 'pending' : amount_paid < amount ? 'partial' : 'paid', paid_at: amount_paid > 0 ? nowIso() : null, notes: form.notes || null, created_by: session?.user.id || null, created_at: nowIso() }
    const member = rows.members?.find(m => m.id === form.member_id)
    const plan = rows.plans?.find(p => p.id === form.plan_id && p.active !== false)
    if (!member || !plan || amount <= 0 || amount_paid < 0 || amount_paid > amount) { notify('Selecciona un cliente y una tarifa activa; revisa el valor y el dinero recibido.'); return }
    if (plan.allow_price_change === false && amount !== Number(plan.price)) { notify('Esta tarifa no permite modificar su precio.'); return }
    const optimistic: { table: EntityTable; row: Row }[] = [{ table: 'payments', row: payment }]
    const cashMovementId = makeId()
    if (amount_paid > 0) optimistic.push({ table: 'cash_movements', row: { id: cashMovementId, cash_session_id: activeSession?.id || null, direction: 'income', amount: amount_paid, method: form.method || 'cash', description: 'Pago de mensualidad', reference_id: id, created_by: session?.user.id || null, created_at: nowIso() } })
    if (member && plan && amount_paid >= amount && amount > 0) {
      const beginDate = member.end_date && member.end_date >= today() && member.status === 'active' && !member.paused_at ? datePlusDays(member.end_date, 1) : today()
      const endDate = datePlusDays(beginDate, Number(plan.duration_days) - 1)
      optimistic.push({ table: 'members' as const, row: { ...member, current_plan_id: plan.id, start_date: beginDate, end_date: endDate, status: 'active', paused_at: null, updated_at: nowIso() } })
    }
    setBusy(true)
    const result = await runBusinessRpc('record_membership_payment', { p_payment: { ...payment, cash_movement_id: cashMovementId } }, optimistic)
    setBusy(false); setDialog(null); notify(result.message || (result.synced ? 'Pago registrado y mensualidad actualizada.' : 'Pago guardado localmente, pendiente de sincronización.'))
    await refresh()
  }

  async function submitBalancePayment(event: FormEvent) {
    event.preventDefault()
    if (!editing) return
    const due = Math.max(0, Number(editing.amount || 0) - Number(editing.amount_paid || 0))
    const amount = Number(form.amount_paid || 0)
    if (amount <= 0 || amount > due) { notify('El abono debe ser mayor que cero y no superar el saldo pendiente.'); return }
    const cashMovementId = makeId()
    const nextPaid = Number(editing.amount_paid || 0) + amount
    const updated: Row = { ...editing, amount_paid: nextPaid, status: nextPaid >= Number(editing.amount) ? 'paid' : 'partial', paid_at: nextPaid >= Number(editing.amount) ? nowIso() : editing.paid_at, updated_at: nowIso() }
    const member = rows.members?.find(m => m.id === editing.member_id)
    const plan = rows.plans?.find(p => p.id === editing.plan_id)
    const optimistic: { table: EntityTable; row: Row }[] = [
      { table: 'payments', row: updated },
      { table: 'cash_movements', row: { id: cashMovementId, cash_session_id: activeSession?.id || null, direction: 'income', amount, method: form.method || 'cash', description: 'Abono a cuenta por cobrar', reference_id: editing.id, created_by: session?.user.id || null, created_at: nowIso() } },
    ]
    if (nextPaid >= Number(editing.amount) && member && plan) {
      const beginDate = member.end_date && member.end_date >= today() && member.status === 'active' ? datePlusDays(String(member.end_date), 1) : today()
      optimistic.push({ table: 'members', row: { ...member, current_plan_id: plan.id, start_date: beginDate, end_date: datePlusDays(beginDate, Number(plan.duration_days) - 1), status: 'active', paused_at: null, updated_at: nowIso() } })
    }
    setBusy(true)
    const result = await runBusinessRpc('collect_payment_balance', { p_payment_id: editing.id, p_amount: amount, p_method: form.method || 'cash', p_cash_movement_id: cashMovementId }, optimistic)
    setBusy(false); setDialog(null); setEditing(null)
    notify(result.message || (result.synced ? 'Abono registrado correctamente.' : 'Abono guardado localmente, pendiente de sincronización.'))
    await refresh()
  }

  async function submitDayPass(event: FormEvent) {
    event.preventDefault()
    const id = makeId()
    const attendanceId = makeId(), cashMovementId = makeId()
    if (Number(form.amount || 0) <= 0) { notify('El valor de la entrada debe ser mayor que cero.'); return }
    const visitorName = String(form.visitor_name || '').trim() || 'Entrada general'
    const pass: Row = { id, attendance_id: attendanceId, cash_movement_id: cashMovementId, visitor_name: visitorName, amount: Number(form.amount || 0), method: form.method || 'cash', notes: form.notes || null, visited_at: nowIso(), created_by: session?.user.id || null, created_at: nowIso() }
    const attendance: Row = { id: attendanceId, member_id: null, visitor_name: visitorName, entry_type: 'day_pass', entered_at: nowIso(), created_by: session?.user.id || null, created_at: nowIso() }
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
    if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(amount_paid) || amount_paid < 0 || amount_paid > total) { notify('El dinero recibido debe estar entre cero y el total de la venta.'); return }
    const sale: Row = { id, cash_movement_id: cashMovementId, member_id: null, total, amount_paid, method: form.method || 'cash', status: amount_paid === 0 ? 'pending' : amount_paid < total ? 'partial' : 'paid', sold_at: nowIso(), created_by: session?.user.id || null, created_at: nowIso() }
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
  async function runDemoAction(action: 'seed' | 'reset') {
    const phrase = action === 'seed' ? 'CARGAR DEMO' : 'LIMPIAR DEMO'
    const confirmation = window.prompt(action === 'seed'
      ? 'Se crearán registros ficticios para probar los módulos. No se modificarán tus datos reales. Escribe CARGAR DEMO.'
      : 'Se eliminarán únicamente los registros DEMO. Los datos reales, usuarios y tarifas se conservarán. Escribe LIMPIAR DEMO.')
    if (confirmation !== phrase) { notify('Operación cancelada.'); return }
    setBusy(true)
    try {
      if (!supabase || !session || !navigator.onLine) throw new Error('Conéctate e inicia sesión como propietario para gestionar los datos de demostración.')
      const { error } = await supabase.rpc(action === 'seed' ? 'seed_demo_data' : 'reset_demo_data')
      if (error) throw error
      await refresh(); setSaleLines([]); setPurchaseLines([])
      notify(action === 'seed' ? 'Datos ficticios cargados. Ya puedes probar los módulos.' : 'Datos DEMO eliminados. Tus datos reales se conservaron.')
    } catch (error) { notify(error instanceof Error ? error.message : 'No se pudo completar la operación.') }
    finally { setBusy(false) }
  }
  async function seedDemoData() { await runDemoAction('seed') }
  async function resetTestData() {
    const confirmation = window.prompt('Se eliminarán todos los registros operativos del gimnasio (clientes, pagos, asistencias, ventas, productos, inventario, compras, gastos, caja y auditoría). Se conservarán tu cuenta de propietario y las tarifas/planes. Escribe REINICIAR para continuar.')
    if (confirmation !== 'REINICIAR') { notify('Operación cancelada.'); return }
    setBusy(true)
    try {
      if (!supabase || !session || !navigator.onLine) throw new Error('Conéctate e inicia sesión como propietario para reiniciar los registros.')
      const { error } = await supabase.rpc('reset_test_data')
      if (error) throw error
      await refresh(); setSaleLines([]); setPurchaseLines([])
      notify('Registros operativos reiniciados. Tu cuenta y las tarifas se conservaron.')
    } catch (error) { notify(error instanceof Error ? error.message : 'No se pudo reiniciar los registros.') }
    finally { setBusy(false) }
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
  if (supabaseConfigured && recoveryMode && session) return <PasswordRecovery onSave={saveNewPassword} busy={busy} toast={toast} />
  if (supabaseConfigured && !session) return <Login onSignIn={signIn} onForgotPassword={requestPasswordRecovery} busy={busy} toast={toast} />
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
      <div className="workspace-label">MENÚ PRINCIPAL</div>
      <nav className="grouped-navigation">{navGroups.filter(group => !group.ownerOnly || isOwner).map(({ label, icon: Icon, target, items }) => items ? <div className="nav-group" key={label}>
        <button className={items.some(item => item.target === section) ? 'nav-item nav-parent active-parent' : 'nav-item nav-parent'} onClick={() => setExpandedGroups(v => ({ ...v, [label]: !v[label] }))}><Icon size={18}/><span>{label}</span><span className="nav-chevron">{expandedGroups[label] ? '⌄' : '›'}</span></button>
        {expandedGroups[label] && <div className="nav-submenu">{items.map(item => <button key={item.target} className={section === item.target ? 'nav-subitem active' : 'nav-subitem'} onClick={() => handleSection(item.target)}><span className="nav-dash">–</span>{item.label}{item.target === 'Miembros' && <b className="nav-count">{members.length}</b>}</button>)}</div>}
      </div> : <button key={label} className={section === target ? 'nav-item active' : 'nav-item'} onClick={() => handleSection(target!)}><Icon size={18}/><span>{label}</span></button>)}</nav>
      <div className="workspace-label admin-label">PROGRAMA</div>
      <nav><button className="nav-item" onClick={() => handleSection('Configuración')}><Shield size={18}/><span>Política de privacidad</span></button><button className="nav-item" onClick={() => notify('El buzón de sugerencias estará disponible en una próxima versión.')}><ClipboardList size={18}/><span>Buzón de sugerencias</span></button></nav>
      <div className="sidebar-bottom"><div className="help-card"><div className="help-icon"><Shield size={17}/></div><strong>Registros bajo control</strong><p>Movimientos financieros con trazabilidad. No se borran desde la aplicación.</p></div><div className="profile"><div className="avatar owner">{userLabel.slice(0,2).toUpperCase()}</div><div className="profile-copy"><strong>{userLabel}</strong><small>{supabaseConfigured ? (isOwner ? 'Propietario' : 'Empleado de caja') : 'Modo local · sin cuenta'}</small></div>{supabaseConfigured && <button className="profile-action" title="Cerrar sesión" onClick={signOut}><LogOut size={15}/></button>}</div></div>
    </aside>
    {menuOpen && <button className="scrim" aria-label="Cerrar menú" onClick={() => setMenuOpen(false)}/>}
    <main className="main-content">
      <header className="topbar"><div className="topbar-left"><button className="menu-toggle" onClick={() => setMenuOpen(true)}><Menu/></button><div className="breadcrumb">Atlasgymroom <span>/</span> <strong>{section}</strong></div></div><div className="topbar-actions"><div className={`status-pill ${supabaseConfigured ? 'connected' : 'local'}`}>{supabaseConfigured ? <><Cloud size={13}/> Supabase</> : <><CloudOff size={13}/> Solo este dispositivo</>}</div><button className="sync-button" onClick={() => void sync()} title="Sincronizar"><RefreshCw size={15}/><span>{syncCount ? `${syncCount} pendientes` : 'Sin pendientes'}</span></button><div className="avatar owner">{userLabel.slice(0,2).toUpperCase()}</div></div></header>
      <section className="command-dock" aria-label="Accesos rápidos">
        <div className="command-dock-title"><Zap size={17}/><span>OPERACIÓN INMEDIATA</span><small>Acciones de un toque</small></div>
        <button className="command-tile entry-tile" onClick={() => openSpecial('daypass')}><span><Zap size={19}/></span><strong>Cobrar entrada</strong><small>$4.000 · sin cliente</small></button>
        <button className="command-tile" onClick={() => openSpecial('payment')}><span><CircleDollarSign size={19}/></span><strong>Pago mensualidad</strong><small>Renovar tarifa</small></button>
        <button className="command-tile" onClick={() => openSpecial('sale')}><span><ShoppingCart size={19}/></span><strong>Nueva venta</strong><small>Catálogo visual</small></button>
        <button className="command-tile" onClick={() => { setSection('Miembros');setEditing(null);setProductImageFile(null);setForm({full_name:'',document:'',phone:'',email:'',birth_date:'',current_plan_id:'',start_date:'',end_date:'',status:'active',notes:''});setDialog('record') }}><span><UserRound size={19}/></span><strong>Nuevo cliente</strong><small>Crear ficha</small></button>
        <button className="command-tile" onClick={() => { setSection('Productos');setEditing(null);setProductImageFile(null);setProductImagePreview('');setForm({name:'',category:'',sku:'',description:'',cost:'0',price:'',stock:'0',min_stock:'0'});setDialog('record') }}><span><ImagePlus size={19}/></span><strong>Añadir producto</strong><small>Imagen y categoría</small></button>
        <button className="command-tile" onClick={() => { setSection('Caja');openSpecial('cash') }}><span><Wallet size={19}/></span><strong>Control de caja</strong><small>Abrir / cerrar</small></button>
        <button className="command-tile" onClick={() => handleSection('Informes')}><span><BarChart3 size={19}/></span><strong>Ver informes</strong><small>Gráficas y totales</small></button>
      </section>
      <section className="front-desk-bar">
        <div className="desk-search"><label><Activity size={15}/> Registrar asistencia</label><input value={attendanceLookup} onChange={e=>setAttendanceLookup(e.target.value)} placeholder="Cédula o nombre del cliente…"/>{attendanceLookup.trim() && <div className="lookup-results">{members.filter(m=>String(m.document||'').toLowerCase().includes(attendanceLookup.toLowerCase())||String(m.full_name||'').toLowerCase().includes(attendanceLookup.toLowerCase())).slice(0,6).map(m=><button key={m.id} disabled={busy} onClick={()=>void registerMemberEntry(m)}><span><strong>{m.full_name}</strong><small>C.C. {m.document} · {m.end_date && m.end_date >= today() && m.status==='active'?'Tarifa vigente':'Revisar tarifa'}</small></span><b>Registrar entrada</b></button>)}{!members.some(m=>String(m.document||'').toLowerCase().includes(attendanceLookup.toLowerCase())||String(m.full_name||'').toLowerCase().includes(attendanceLookup.toLowerCase()))&&<p>No encontramos ese cliente. Regístralo desde Clientes.</p>}</div>}</div>
        <div className="desk-search"><label><Users size={15}/> Buscar / gestionar cliente</label><input value={memberLookup} onChange={e=>setMemberLookup(e.target.value)} placeholder="Cédula o nombre para abrir su ficha…"/>{memberLookup.trim() && <div className="lookup-results">{members.filter(m=>String(m.document||'').toLowerCase().includes(memberLookup.toLowerCase())||String(m.full_name||'').toLowerCase().includes(memberLookup.toLowerCase())).slice(0,6).map(m=><div className="lookup-member-row" key={m.id}><span><strong>{m.full_name}</strong><small>C.C. {m.document} · {m.paused_at?'Pausado':m.end_date && m.end_date < today()?'Vencido':'Activo'}</small></span><div><button onClick={()=>{setSection('Miembros');setMemberLookup('');setSearch('');setEditing(m);const initial:Record<string,string>={};configFor('Miembros',rows)?.fields.forEach(f=>initial[f.key]=m[f.key]==null?'':String(m[f.key]));setForm(initial);setDialog('record')}}>Abrir ficha</button><button onClick={()=>{setMemberLookup('');openMemberPayment(m)}}>Pago</button><button onClick={()=>{setMemberLookup('');void toggleMemberPause(m)}}>{m.paused_at?'Reactivar':'Pausar'}</button></div></div>)}</div>}</div>
        <div className="desk-shortcuts"><button onClick={()=>{setSection('Miembros');setEditing(null);const fields=configFor('Miembros',rows)?.fields||[];const blank:Record<string,string>={};fields.forEach(field=>blank[field.key]='');setForm(blank);setDialog('record')}}><Plus size={15}/> Nuevo cliente</button><button onClick={()=>openSpecial('payment')}><CircleDollarSign size={15}/> Registrar pago</button><button onClick={()=>handleSection('Tarifas')}><ClipboardList size={15}/> Tarifas</button></div>
      </section>
      {!supabaseConfigured && <div className="local-warning"><AlertTriangle size={16}/><span><strong>Modo local:</strong> la información se guarda solo en este navegador. Configura Supabase y accede con una cuenta antes de registrar datos reales.</span></div>}
      {supabaseConfigured && syncCount > 0 && <div className="sync-warning"><CloudOff size={15}/><span>{syncCount} operación(es) esperando sincronización. No cierres ni borres los datos del navegador hasta recuperar la conexión.</span><button onClick={() => void sync()}>Reintentar</button></div>}
      <div className="page">
        {section === 'Inicio' && <Dashboard activeMembers={activeMembers} expiredMembers={expiredMembers} total={members.length} todayIncome={todayIncome} todayAttendances={(rows.attendance || []).filter(a => dateInBogota(a.entered_at) === today()).length} expiring={members.filter(m => m.end_date && m.end_date >= today() && m.end_date <= datePlusDays(today(), 7)).length} stockLow={stockLow} rows={rows} onNavigate={handleSection} />}
        {section === 'Caja' && <CashPage session={activeSession} sessions={rows.cash_sessions || []} movements={rows.cash_movements || []} onOpen={() => openSpecial('cash')} onClose={() => openSpecial('cash')} />}
        {section === 'Informes' && <Reports rows={rows} />}
        {section === 'Configuración' && <SettingsPage onBackup={backup} onRestore={() => fileRef.current?.click()} onReset={resetTestData} onSeed={seedDemoData} busy={busy} />}
        {section === 'Productos' && <ProductCatalog products={filteredRows} onCreate={openCreate} onEdit={openRecord}/>}
        {moduleConfig && section !== 'Productos' && <DataModule config={moduleConfig} rows={filteredRows} isOwner={Boolean(isOwner)} search={search} setSearch={setSearch} onCreate={openCreate} onEdit={openRecord} onTogglePause={toggleMemberPause} onMemberPayment={openMemberPayment} onCollectBalance={payment => { setEditing(payment); setForm({ amount_paid: String(Math.max(0, Number(payment.amount || 0) - Number(payment.amount_paid || 0))), method: 'cash' }); setDialog('balance') }} memberName={memberName} productName={productName} planName={planName} />}
        {!moduleConfig && section !== 'Inicio' && section !== 'Caja' && section !== 'Informes' && section !== 'Configuración' && <PlaceholderModule title={section} />}
        {section === 'Equipo' && !isOwner && <AccessDenied/>}
        {section === 'Auditoría' && !isOwner && <AccessDenied/>}
        <footer>© 2026 Atlasgymroom <span>Gestión clara para entrenar mejor.</span></footer>
      </div>
    </main>

    {dialog && dialog !== 'cash' && <Modal title={dialogTitle(dialog, editing)} onClose={() => setDialog(null)}>
      {dialog === 'record' && moduleConfig && <form className="form-grid" onSubmit={submitRecord}>
        {section === 'Productos' && <div className="image-upload-panel full"><div className="product-image-preview">{productImagePreview ? <img src={productImagePreview} alt="Vista previa del producto"/> : <div><ImagePlus size={30}/><span>Imagen del producto</span></div>}</div><label className="image-upload-control"><ImagePlus size={16}/> Elegir imagen<input type="file" accept="image/*" onChange={e=>{const file=e.target.files?.[0];if(file){setProductImageFile(file);setProductImagePreview(URL.createObjectURL(file))}}}/></label><small>La imagen se optimiza automáticamente. Puedes dejarla vacía y añadirla después.</small></div>}
        {section === 'Miembros' && editing && <div className="member-modal-actions full"><button type="button" className="secondary-button" onClick={() => openMemberPayment(editing)}><CircleDollarSign size={15}/> Registrar pago</button><button type="button" className="secondary-button" onClick={() => void toggleMemberPause(editing)}>{editing.paused_at ? <Play size={15}/> : <Pause size={15}/>} {editing.paused_at ? 'Reactivar actividad' : 'Pausar actividad'}</button></div>}
        {moduleConfig.fields.map(field => <FieldInput key={field.key} field={moduleConfig.table === 'products' && editing && field.key === 'stock' ? { ...field, disabled: true } : field} value={form[field.key] || ''} onChange={value => setForm(v => ({ ...v, [field.key]: value }))} />)}
        <div className="form-actions"><button type="button" className="secondary-button" onClick={() => setDialog(null)}>Cancelar</button><button disabled={busy} className="primary-button"><Check size={16}/>{busy ? 'Guardando…' : 'Guardar registro'}</button></div>
      </form>}
      {dialog === 'balance' && editing && <form className="form-grid" onSubmit={submitBalancePayment}><div className="balance-summary full"><strong>{memberName(editing.member_id)}</strong><span>Saldo pendiente: {formatMoney(Number(editing.amount || 0)-Number(editing.amount_paid || 0))}</span></div><FieldInput field={{ key: 'amount_paid', label: 'Abono recibido (COP)', type: 'number', required: true }} value={form.amount_paid || ''} onChange={v => setForm(f => ({ ...f, amount_paid: v }))}/><FieldInput field={{ key: 'method', label: 'Método de pago', type: 'select', options: methods }} value={form.method || 'cash'} onChange={v => setForm(f => ({ ...f, method: v }))}/><p className="form-hint full">Solo registra transferencias o Nequi después de confirmar el abono en la cuenta. El abono no debe superar el saldo pendiente.</p><FormActions busy={busy} onCancel={() => setDialog(null)}/></form>}
      {dialog === 'payment' && <form className="form-grid" onSubmit={submitPayment}>
        <FieldInput field={{ key: 'member_id', label: 'Socio', type: 'select', options: memberOptions, required: true }} value={form.member_id || ''} onChange={v => { const member = rows.members?.find(m => m.id === v); const plan = rows.plans?.find(p => p.id === member?.current_plan_id && p.active !== false); setForm(f => ({ ...f, member_id: v, plan_id: plan?.id || '', amount: plan ? String(plan.price) : f.amount, amount_paid: plan ? String(plan.price) : f.amount_paid })) }}/>
        <FieldInput field={{ key: 'plan_id', label: 'Tarifa', type: 'select', required: true, options: (rows.plans || []).filter(p => p.active !== false).map(p => ({ value: p.id, label: p.name })) }} value={form.plan_id || ''} onChange={v => { const plan = rows.plans?.find(p => p.id === v); setForm(f => ({ ...f, plan_id: v, amount: plan ? String(plan.price) : f.amount, amount_paid: plan ? String(plan.price) : f.amount_paid })) }}/>
        <FieldInput field={{ key: 'amount', label: 'Valor a cobrar (COP)', type: 'number', required: true, disabled: rows.plans?.find(p => p.id === form.plan_id)?.allow_price_change === false }} value={form.amount || ''} onChange={v => setForm(f => ({ ...f, amount: v }))}/>
        <FieldInput field={{ key: 'amount_paid', label: 'Dinero recibido (COP)', type: 'number', required: true }} value={form.amount_paid ?? form.amount ?? ''} onChange={v => setForm(f => ({ ...f, amount_paid: v }))}/>
        <FieldInput field={{ key: 'method', label: 'Método de pago', type: 'select', options: methods }} value={form.method || 'cash'} onChange={v => setForm(f => ({ ...f, method: v }))}/>
        <FieldInput field={{ key: 'notes', label: 'Observaciones' }} value={form.notes || ''} onChange={v => setForm(f => ({ ...f, notes: v }))}/>
        <p className="form-hint full">Las tarifas Diario, Quincenal, Mensual y los tickets de 5, 10 y 15 días están precargados. El saldo pendiente no se suma a la caja. La vigencia se extiende cuando el pago queda completo. En transferencias y Nequi, registra el dinero recibido solo después de confirmar el abono en la cuenta; una captura no es confirmación.</p>
        <FormActions busy={busy} onCancel={() => setDialog(null)}/>
      </form>}
      {dialog === 'daypass' && <form className="entry-cash-form" onSubmit={submitDayPass}>
        <div className="entry-cash-hero"><span className="entry-cash-icon"><Zap size={23}/></span><div><small>COBRO RÁPIDO · SIN REGISTRAR CLIENTE</small><h3>Entrada general</h3><p>Registra el ingreso y el pago sin pedir nombre, cédula ni crear una ficha.</p></div></div>
        <div className="entry-price-card"><span>Tarifa de entrada diaria</span><strong>$ 4.000</strong></div>
        <FieldInput field={{key:'amount',label:'Valor recibido (COP)',type:'number',required:true}} value={form.amount||'4000'} onChange={v=>setForm(f=>({...f,amount:v}))}/>
        <FieldInput field={{key:'method',label:'Medio de pago',type:'select',options:methods}} value={form.method||'cash'} onChange={v=>setForm(f=>({...f,method:v}))}/>
        <p className="form-hint">Se guardará como “Entrada general”. Para Nequi o transferencia, confirma el pago antes de marcarlo recibido.</p>
        <FormActions busy={busy} onCancel={()=>setDialog(null)}/>
      </form>}
      {dialog === 'expense' && <form className="form-grid" onSubmit={submitExpense}>
        <FieldInput field={{ key: 'category', label: 'Categoría', required: true, options: undefined }} value={form.category || ''} onChange={v => setForm(f => ({ ...f, category: v }))}/>
        <FieldInput field={{ key: 'description', label: 'Concepto', required: true }} value={form.description || ''} onChange={v => setForm(f => ({ ...f, description: v }))}/>
        <FieldInput field={{ key: 'amount', label: 'Valor (COP)', type: 'number', required: true }} value={form.amount || ''} onChange={v => setForm(f => ({ ...f, amount: v }))}/>
        <FieldInput field={{ key: 'method', label: 'Método', type: 'select', options: methods }} value={form.method || 'cash'} onChange={v => setForm(f => ({ ...f, method: v }))}/>
        <FieldInput field={{ key: 'notes', label: 'Observaciones' }} value={form.notes || ''} onChange={v => setForm(f => ({ ...f, notes: v }))}/>
        <FormActions busy={busy} onCancel={() => setDialog(null)}/>
      </form>}
      {dialog === 'sale' && <form className="pos-screen" onSubmit={submitSale}>
        <div className="pos-main">
          <div className="pos-section-head"><div><span className="pos-step">01</span><div><strong>Catálogo de productos</strong><small>Selecciona una tarjeta para añadirla al carrito</small></div></div><span className="pos-count">{(rows.products||[]).filter(p=>p.active!==false).length} productos</span></div>
          <POSCatalog products={(rows.products||[]).filter(p=>p.active!==false)} onAdd={id=>setSaleLines(old=>{const p=rows.products?.find(x=>x.id===id);if(!p)return old;const found=old.find(x=>x.product_id===id);const next=(found?.quantity||0)+1;if(next>Number(p.stock||0)){notify('No hay más existencias disponibles de '+p.name);return old}return found?old.map(x=>x.product_id===id?{...x,quantity:next}:x):[...old,{product_id:id,quantity:1}]})}/>
          <div className="pos-section-head cart-head"><div><span className="pos-step">02</span><div><strong>Carrito</strong><small>{saleLines.reduce((n,l)=>n+l.quantity,0)} unidad(es) seleccionadas</small></div></div></div>
          <LineList lines={saleLines} products={rows.products||[]} onChange={setSaleLines}/>
        </div>
        <aside className="pos-receipt">
          <div className="receipt-heading"><ShoppingCart size={18}/><strong>Caja de venta</strong><span>VENTA RÁPIDA</span></div>
          <div className="receipt-stat"><span>Referencias</span><b>{saleLines.length}</b></div>
          <div className="receipt-stat"><span>Unidades</span><b>{saleLines.reduce((n,l)=>n+l.quantity,0)}</b></div>
          <div className="receipt-grand"><small>Total a cobrar</small><strong>{formatMoney(saleLines.reduce((sum,l)=>sum+Number(rows.products?.find(p=>p.id===l.product_id)?.price||0)*l.quantity,0))}</strong></div>
          <FieldInput field={{key:'amount_paid',label:'Dinero recibido',type:'number',placeholder:'Vacío = pago completo'}} value={form.amount_paid||''} onChange={v=>setForm(f=>({...f,amount_paid:v}))}/>
          <FieldInput field={{key:'method',label:'Medio de pago',type:'select',options:methods}} value={form.method||'cash'} onChange={v=>setForm(f=>({...f,method:v}))}/>
          <div className="receipt-due"><span>Saldo pendiente</span><b>{formatMoney(Math.max(0,saleLines.reduce((sum,l)=>sum+Number(rows.products?.find(p=>p.id===l.product_id)?.price||0)*l.quantity,0)-Number(form.amount_paid||0)))}</b></div>
          <p className="receipt-hint">No necesitas identificar al comprador. Solo marca la venta. El efectivo recibido entra a caja y el inventario se actualiza.</p>
          <button className="pos-confirm" disabled={busy||!saleLines.length}><Check size={17}/>{busy?'Registrando…':'Marcar venta'}</button>
          <button type="button" className="pos-cancel" onClick={()=>{setSaleLines([]);setForm({method:'cash'});setDialog(null)}}>Cancelar</button>
        </aside>
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

function Login({ onSignIn, onForgotPassword, busy, toast }: { onSignIn: (email: string, password: string) => void; onForgotPassword: (email: string) => void; busy: boolean; toast: string }) {
  const [email,setEmail] = useState(''); const [password,setPassword] = useState('')
  return <div className="auth-screen"><form className="auth-card" onSubmit={e => { e.preventDefault(); onSignIn(email,password) }}><div className="brand-mark"><Dumbbell size={23}/></div><div className="eyebrow">ATLASGYMROOM</div><h1>Bienvenido</h1><p>Ingresa con tu cuenta individual para administrar el gimnasio.</p><label>Correo electrónico<input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="username"/></label><label>Contraseña<input type="password" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password"/></label><button className="primary-button auth-submit" disabled={busy}><LockKeyhole size={16}/>{busy ? 'Ingresando…' : 'Iniciar sesión'}</button><button type="button" className="auth-link" disabled={busy || !email.trim()} onClick={() => onForgotPassword(email)}>Olvidé mi contraseña</button>{toast && <div className="auth-error">{toast}</div>}<small>Las cuentas las crea el propietario desde Supabase Auth. No hay registro público.</small></form></div>
}

function PasswordRecovery({ onSave, busy, toast }: { onSave: (password: string) => void; busy: boolean; toast: string }) {
  const [password,setPassword] = useState(''); const [confirm,setConfirm] = useState('')
  const mismatch = confirm.length > 0 && password !== confirm
  return <div className="auth-screen"><form className="auth-card" onSubmit={e => { e.preventDefault(); if (password.length < 8 || password !== confirm) return; onSave(password) }}><div className="brand-mark"><LockKeyhole size={23}/></div><div className="eyebrow">ATLASGYMROOM · SEGURIDAD</div><h1>Nueva contraseña</h1><p>Elige una contraseña nueva para recuperar el acceso a tu cuenta.</p><label>Nueva contraseña<input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} autoComplete="new-password"/></label><label>Confirmar contraseña<input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required minLength={8} autoComplete="new-password"/></label>{mismatch && <div className="auth-error">Las contraseñas no coinciden.</div>}<button className="primary-button auth-submit" disabled={busy || password.length < 8 || password !== confirm}><LockKeyhole size={16}/>{busy ? 'Guardando…' : 'Guardar nueva contraseña'}</button>{toast && <div className="auth-error">{toast}</div>}<small>Usa al menos 8 caracteres. Al guardar, volverás al inicio de sesión.</small></form></div>
}
function Dashboard(props: { activeMembers: number; expiredMembers: number; total: number; todayIncome: number; todayAttendances: number; expiring: number; stockLow: Row[]; rows: Record<string,Row[]>; onNavigate:(s:Section)=>void }) {
  const day=today(),weekStart=datePlusDays(day,-6),monthStart=day.slice(0,7)+'-01'
  const payments=props.rows.payments||[],sales=props.rows.sales||[],passes=props.rows.day_passes||[],products=props.rows.products||[]
  const recent=[...payments,...sales,...passes].sort((a,b)=>String(b.created_at||b.sold_at||b.visited_at).localeCompare(String(a.created_at||a.sold_at||a.visited_at))).slice(0,6)
  const creditBalance=payments.filter(p=>p.status!=='voided').reduce((sum,p)=>sum+Math.max(0,Number(p.amount||0)-Number(p.amount_paid||0)),0)
  const newClients=(props.rows.members||[]).filter(m=>dateInBogota(m.created_at)>=weekStart&&dateInBogota(m.created_at)<=day).length
  const birthdays=(props.rows.members||[]).filter(m=>String(m.birth_date||'').slice(5)===day.slice(5))
  const totalFor=(items:Row[],start:string,dateField:string,amountField:string)=>items.filter(x=>dateInBogota(x[dateField]||x.created_at)>=start&&dateInBogota(x[dateField]||x.created_at)<=day).reduce((sum,x)=>sum+Number(x[amountField]||0),0)
  const paymentToday=totalFor(payments,day,'paid_at','amount_paid'),paymentWeek=totalFor(payments,weekStart,'paid_at','amount_paid'),paymentMonth=totalFor(payments,monthStart,'paid_at','amount_paid')
  const salesToday=totalFor(sales,day,'sold_at','amount_paid'),salesWeek=totalFor(sales,weekStart,'sold_at','amount_paid'),salesMonth=totalFor(sales,monthStart,'sold_at','amount_paid')
  const trend=Array.from({length:7},(_,i)=>{const date=datePlusDays(day,i-6);const p=payments.filter(x=>dateInBogota(x.paid_at||x.created_at)===date).reduce((n,x)=>n+Number(x.amount_paid||0),0);const v=sales.filter(x=>dateInBogota(x.sold_at||x.created_at)===date).reduce((n,x)=>n+Number(x.amount_paid||0),0);const d=passes.filter(x=>dateInBogota(x.visited_at||x.created_at)===date).reduce((n,x)=>n+Number(x.amount||0),0);return {label:new Date(date+'T12:00:00-05:00').toLocaleDateString('es-CO',{weekday:'short'}),value:p+v+d}})
  const categorySales=new Map<string,number>()
  for(const item of props.rows.sale_items||[]){const product=products.find(p=>p.id===item.product_id);const key=String(product?.category||'Otros');categorySales.set(key,(categorySales.get(key)||0)+Number(item.line_total||Number(item.unit_price||0)*Number(item.quantity||0)))}
  const categoryData=Array.from(categorySales.entries()).map(([label,value])=>({label,value})).sort((a,b)=>b.value-a.value).slice(0,5)
  const todayLabel=new Date().toLocaleDateString('es-CO',{timeZone:'America/Bogota',weekday:'long',day:'numeric',month:'long',year:'numeric'})
  return <div className="command-center">
    <div className="control-room-heading"><div><div className="eyebrow">CENTRO DE MANDO · ATLASGYMROOM</div><h1>Panel de operaciones</h1><p>{todayLabel} · Estado general del gimnasio</p></div><div className="control-room-status"><span className="live-dot"/> Operación del día</div></div>
    <div className="overview-metrics">
      <div className="overview-card metric-primary"><div className="metric-top"><span>INGRESOS HOY</span><CircleDollarSign size={18}/></div><strong>{formatMoney(props.todayIncome)}</strong><small>Pagos + ventas + entradas</small><div className="metric-spark"><span style={{width:Math.max(8,Math.min(100,props.todayIncome/Math.max(1,...trend.map(x=>x.value))*100))+'%'}}/></div></div>
      <div className="overview-card"><div className="metric-top"><span>CLIENTES ACTIVOS</span><Users size={18}/></div><strong>{props.activeMembers}</strong><small>{props.total} registrados en total</small><button onClick={()=>props.onNavigate('Miembros')}>Abrir clientes <ArrowUpRight size={13}/></button></div>
      <div className="overview-card"><div className="metric-top"><span>ENTRADAS HOY</span><Activity size={18}/></div><strong>{props.todayAttendances}</strong><small>Asistencias registradas</small><button onClick={()=>props.onNavigate('Asistencia')}>Ver asistencia <ArrowUpRight size={13}/></button></div>
      <div className="overview-card"><div className="metric-top"><span>POR VENCER</span><CalendarDays size={18}/></div><strong>{props.expiring}</strong><small>{props.expiredMembers} membresías vencidas</small><button onClick={()=>props.onNavigate('Congelar Pagos')}>Revisar cartera <ArrowUpRight size={13}/></button></div>
    </div>
    <div className="analytics-grid">
      <section className="analytics-panel revenue-panel"><div className="analytics-heading"><div><span className="eyebrow">RENDIMIENTO</span><h2>Ingresos de los últimos 7 días</h2><p>Dinero efectivamente recibido por fecha</p></div><span className="chart-period">7 DÍAS</span></div><TrendChart data={trend}/><div className="chart-legend"><span><i className="legend-payments"/>Pagos, ventas y entradas</span></div></section>
      <section className="analytics-panel category-panel"><div className="analytics-heading"><div><span className="eyebrow">PRODUCTOS</span><h2>Ventas por categoría</h2><p>Valor acumulado de los artículos vendidos</p></div><Tag size={18}/></div>{categoryData.length?<CategoryBars data={categoryData}/>:<div className="chart-empty"><ShoppingBag size={26}/><span>Las ventas por categoría aparecerán aquí.</span></div>}</section>
    </div>
    <div className="command-lower-grid">
      <section className="analytics-panel action-panel"><div className="analytics-heading"><div><span className="eyebrow">ACCESO INMEDIATO</span><h2>Acciones frecuentes</h2></div></div><div className="quick-grid"><Quick icon={<Zap/>} label="Cobrar entrada" onClick={()=>props.onNavigate('Pase diario')}/><Quick icon={<CircleDollarSign/>} label="Registrar pago" onClick={()=>props.onNavigate('Pagos')}/><Quick icon={<ShoppingCart/>} label="Nueva venta" onClick={()=>props.onNavigate('Ventas')}/><Quick icon={<UserRound/>} label="Nuevo cliente" onClick={()=>props.onNavigate('Miembros')}/><Quick icon={<Package/>} label="Productos" onClick={()=>props.onNavigate('Productos')}/><Quick icon={<Wallet/>} label="Caja" onClick={()=>props.onNavigate('Caja')}/></div></section>
      <section className="analytics-panel operations-panel"><div className="analytics-heading"><div><span className="eyebrow">TAREAS DEL DÍA</span><h2>Estado operativo</h2></div></div><div className="operation-line"><span><i className="state-dot warn"/>Membresías por vencer</span><b>{props.expiring}</b></div><div className="operation-line"><span><i className="state-dot danger"/>Clientes vencidos</span><b>{props.expiredMembers}</b></div><div className="operation-line"><span><i className="state-dot warn"/>Productos con stock bajo</span><b>{props.stockLow.length}</b></div><div className="operation-line"><span><i className="state-dot good"/>Nuevos clientes esta semana</span><b>{newClients}</b></div><div className="operation-line"><span><i className="state-dot"/>Saldos pendientes de pagos</span><b>{formatMoney(creditBalance)}</b></div><div className="operation-line"><span><i className="state-dot good"/>Cumpleaños de hoy</span><b>{birthdays.length}</b></div>{birthdays.length>0&&<small className="birthday-names">{birthdays.slice(0,3).map(x=>x.full_name).join(' · ')}</small>}</section>
    </div>
    <section className="analytics-panel recent-panel"><div className="analytics-heading"><div><span className="eyebrow">MOVIMIENTOS</span><h2>Actividad reciente</h2></div><button className="text-button" onClick={()=>props.onNavigate('Informes')}>Ver informes <ArrowUpRight size={15}/></button></div>{recent.length?<div className="activity-list">{recent.map((r,i)=><div className="activity-row" key={r.id}><div className={`avatar ${i%2?'blue':'lime'}`}>{r.total!=null?<ShoppingBag size={16}/>:r.visitor_name?<Zap size={16}/>:<CircleDollarSign size={16}/>}</div><div className="activity-person"><strong>{r.visitor_name||r.notes||(r.member_id?'Pago de cliente':r.total!=null?'Venta de productos':'Entrada diaria')}</strong><small>{r.status||r.method||'Registrado'}</small></div><div className="activity-time">{formatDate(r.created_at||r.sold_at||r.visited_at)}</div><strong className="activity-amount">{formatMoney(r.amount_paid??r.amount??r.total)}</strong></div>)}</div>:<Empty text="Todavía no hay movimientos. Usa los accesos rápidos para iniciar las pruebas."/>}</section>
    <div className="finance-periods"><div><span>INGRESOS POR PAGOS · HOY</span><b>{formatMoney(paymentToday)}</b></div><div><span>INGRESOS POR PAGOS · SEMANA</span><b>{formatMoney(paymentWeek)}</b></div><div><span>INGRESOS POR PAGOS · MES</span><b>{formatMoney(paymentMonth)}</b></div><div><span>VENTAS · HOY / SEMANA / MES</span><b>{formatMoney(salesToday)} / {formatMoney(salesWeek)} / {formatMoney(salesMonth)}</b></div></div>
  </div>
}
function TrendChart({data}:{data:{label:string;value:number}[]}) {
 const max=Math.max(1,...data.map(x=>x.value));const points=data.map((item,i)=>`${32+i*(536/Math.max(1,data.length-1))},${144-(item.value/max)*112}`).join(' ')
 return <div className="trend-chart"><svg viewBox="0 0 600 180" role="img" aria-label="Gráfica de ingresos de los últimos siete días"><defs><linearGradient id="trendFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#d9f29d" stopOpacity=".38"/><stop offset="100%" stopColor="#d9f29d" stopOpacity="0"/></linearGradient></defs><path d={`M ${points.replace(/ /g,' L ')} L 568 154 L 32 154 Z`} fill="url(#trendFill)"/><polyline points={points} fill="none" stroke="#b7e86e" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>{data.map((item,i)=>{const x=32+i*(536/Math.max(1,data.length-1)),y=144-(item.value/max)*112;return <g key={item.label+i}><circle cx={x} cy={y} r="5" fill="#e4f6c4" stroke="#6d933d" strokeWidth="2"/><text x={x} y="174" textAnchor="middle" fill="#8d9a91" fontSize="10">{item.label}</text></g>})}</svg><div className="trend-max">{formatMoney(max)}</div></div>
}
function CategoryBars({data}:{data:{label:string;value:number}[]}) {
 const max=Math.max(1,...data.map(x=>x.value))
 return <div className="category-bars">{data.map(item=><div className="category-bar-row" key={item.label}><div><span>{item.label}</span><b>{formatMoney(item.value)}</b></div><div className="category-bar-track"><i style={{width:Math.max(3,item.value/max*100)+'%'}}/></div></div>)}</div>
}

function PlaceholderModule({ title }: { title: Section }) {
  const descriptions: Partial<Record<Section, string>> = {
    'Notas Débito': 'Ajustes de venta con trazabilidad; falta definir numeración y proceso contable.',
    'Notas Crédito': 'Devoluciones o correcciones de ventas; no se borrarán movimientos originales.',
    'Cuentas por Cobrar Ventas': 'Consulta de saldos de ventas. El cobro de abonos a ventas aún requiere su operación transaccional.',
    'Evoluciones': 'Seguimiento de medidas y avances físicos de los clientes.',
    'Rutinas': 'Planes de entrenamiento asignados a cada cliente.',
    'Ejercicios': 'Catálogo de ejercicios para construir rutinas.',
    'Proveedores': 'Directorio de proveedores para asociar a compras.',
    'Empleados': 'Directorio del equipo; las cuentas de acceso se gestionan desde autenticación.',
    'Cuentas por Pagar Compras': 'Saldos pendientes de compras y proveedores.',
    'Documento Soporte': 'Documentos de soporte de compras y gastos; requiere definir flujo tributario.',
    'Notas Ajuste': 'Ajustes de compras y gastos, conservando trazabilidad.',
    'Tipos de Gastos': 'Catálogo de categorías para clasificar egresos.',
    'Ajuste Cartera': 'Ajustes auditados de saldos pendientes.',
    'Categorías de Producto': 'Organización del catálogo por categorías.',
    'Ajustes de Inventario': 'Entradas y salidas justificadas de existencias.',
    'Regularizaciones de Inventario': 'Conteos físicos y conciliación de diferencias.',
    'Kardex de Inventario': 'Historial cronológico de movimientos por producto.',
    'Configuración de Reservaciones': 'Horarios, cupos y reglas para las reservas.',
    'Clases': 'Programación de clases y cupos.',
    'Reservaciones': 'Agenda de reservas y asistencia a clases.',
    'Mi Sucursal': 'Datos generales y horarios del gimnasio.',
    'Menú de Navegación': 'Organización de las opciones del sistema.',
    'Roles': 'Permisos detallados por módulo para los usuarios.',
    'Usuarios': 'Gestión de cuentas y acceso del personal.',
    'Configuración de Correos': 'Configuración de notificaciones por correo.',
    'Plantilla de Correos': 'Plantillas de mensajes del sistema.',
    'Notificaciones': 'Avisos operativos y recordatorios.',
    'Historial de Correos': 'Registro de notificaciones enviadas.',
  }
  return <section className="panel placeholder-module"><div className="eyebrow">MÓDULO DEL SISTEMA</div><h1>{title}</h1><p>{descriptions[title] || 'Este apartado conserva el nombre y la organización del programa actual.'}</p><div className="placeholder-note"><Shield size={17}/> Se activará cuando tenga sus tablas, permisos y pruebas completas.</div></section>
}

function DataModule({ config, rows, isOwner, search, setSearch, onCreate, onEdit, onTogglePause, onMemberPayment, onCollectBalance, memberName, productName, planName }: { config: ModuleConfig; rows: Row[]; isOwner:boolean; search:string; setSearch:(v:string)=>void; onCreate:()=>void; onEdit:(row:Row)=>void; onTogglePause:(row:Row)=>void; onMemberPayment:(row:Row)=>void; onCollectBalance:(row:Row)=>void; memberName:(id:unknown)=>string; productName:(id:unknown)=>string; planName:(id:unknown)=>string }) {
  const valueFor = (row:Row,key:string) => {
    const value = row[key]
    if (key === 'member_id') return memberName(value)
    if (key === 'product_id') return productName(value)
    if (key === 'plan_id' || key === 'current_plan_id') return planName(value)
    if (key.includes('amount') || key === 'price' || key === 'cost' || key === 'total') return formatMoney(value)
    if (key.includes('date') || key.endsWith('_at')) return formatDate(value)
    if (key === 'active') return value ? 'Activo' : 'Inactivo'
    if (key === 'status') return row.paused_at ? 'Pausado' : ({ active:'Activo',inactive:'Inactivo',expired:'Vencido',debt:'Con saldo',paid:'Pagado',partial:'Abono parcial',pending:'Pendiente',voided:'Anulado',open:'Abierta',closed:'Cerrada' } as Record<string,string>)[String(value)] || String(value || '—')
    if (key === 'method') return ({cash:'Efectivo',transfer:'Transferencia',nequi:'Nequi',card:'Tarjeta',other:'Otro'} as Record<string,string>)[String(value)] || value
    if (key === 'role') return value === 'owner' ? 'Propietario' : 'Caja'
    if (key === 'id') return String(value || '').slice(0,8)
    return value == null || value === '' ? '—' : String(value)
  }
  const canEdit = config.table === 'members' || config.table === 'gym_records' || (isOwner && (config.table === 'plans' || config.table === 'products'))
  const showActions = canEdit || config.table === 'payments'
  return <><div className="module-heading"><div><div className="eyebrow">GESTIÓN</div><h1>{config.title}</h1><p>{config.description}</p></div>{config.fields.length > 0 && config.title !== 'Congelar pagos' && (config.table !== 'plans' && config.table !== 'products' || isOwner) && <button className="primary-button" onClick={onCreate}><Plus size={16}/> Nuevo registro</button>}{config.table === 'day_passes' && <button className="primary-button" onClick={onCreate}><Plus size={16}/> Nuevo pase</button>}{config.table === 'payments' && <button className="primary-button" onClick={onCreate}><Plus size={16}/> Registrar pago</button>}{config.table === 'sales' && <button className="primary-button" onClick={onCreate}><Plus size={16}/> Nueva venta</button>}{config.table === 'purchases' && <button className="primary-button" onClick={onCreate}><Plus size={16}/> Registrar compra</button>}{config.table === 'expenses' && <button className="primary-button" onClick={onCreate}><Plus size={16}/> Registrar gasto</button>}</div>
    <section className="panel data-panel"><div className="table-toolbar"><div className="module-count">{rows.length} registro(s)</div><div className="search-box"><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar…"/></div></div>
      {rows.length ? <div className="table-wrap"><table><thead><tr>{config.columns.map(c=><th key={c.key}>{c.label}</th>)}{showActions && <th>Acciones</th>}</tr></thead><tbody>{rows.map(row=><tr key={row.id}>{config.columns.map(c=><td key={c.key}>{valueFor(row,c.key)}</td>)}{showActions && <td className="action-cell">{canEdit && <button className="table-action" onClick={()=>onEdit(row)} title="Editar"><Pencil size={14}/></button>}{config.table==='members' && <><button className="table-action" onClick={()=>onMemberPayment(row)} title="Registrar pago"><CircleDollarSign size={14}/></button><button className="table-action" onClick={()=>onTogglePause(row)} title={row.paused_at?'Reactivar actividad':'Pausar actividad'}>{row.paused_at?<Play size={14}/>:<Pause size={14}/>}</button></>}{config.table==='payments' && Number(row.amount||0)>Number(row.amount_paid||0) && row.status!=='voided' && <button className="table-action" onClick={()=>onCollectBalance(row)} title="Cobrar saldo">Abonar</button>}</td>}</tr>)}</tbody></table></div> : <Empty text={search ? 'No hay resultados para esa búsqueda.' : 'Todavía no hay registros en este módulo.'}/>}
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

function SettingsPage({ onBackup, onRestore, onReset, onSeed, busy }: { onBackup:()=>void; onRestore:()=>void; onReset:()=>void; onSeed:()=>void; busy:boolean }) {
  return <><div className="module-heading"><div><div className="eyebrow">SISTEMA</div><h1>Configuración</h1><p>Respaldo, continuidad y limpieza del entorno de pruebas.</p></div></div><div className="content-grid"><section className="panel setting-card"><div className="setting-icon"><FileDown/></div><h2>Respaldo local</h2><p>Descarga un archivo JSON con los datos guardados en este navegador. El respaldo puede contener información personal; protégelo.</p><button className="primary-button" onClick={onBackup}><Download size={16}/> Exportar respaldo</button></section><section className="panel setting-card"><div className="setting-icon"><FileUp/></div><h2>Restaurar respaldo</h2><p>Importa un respaldo previamente exportado en el dispositivo actual. Los registros se agregan o actualizan.</p><button className="secondary-button" onClick={onRestore}><FileUp size={16}/> Seleccionar archivo</button></section></div><section className="panel setting-card"><div className="setting-icon"><Activity/></div><h2>Modo de demostración</h2><p>Carga registros ficticios para probar miembros, pagos, asistencias, productos, ventas, compras, gastos e informes. Quedan identificados como DEMO.</p><button className="primary-button" disabled={busy} onClick={onSeed}><Plus size={16}/> {busy?"Procesando…":"Cargar datos de demostración"}</button></section><section className="panel reset-test-panel"><div className="reset-test-icon"><RefreshCw size={20}/></div><div><h2>Reiniciar todos los registros</h2><p>Elimina los registros operativos del gimnasio, incluidos clientes, pagos, asistencias, ventas, productos, inventario, compras, gastos, caja y auditoría. Conserva tu cuenta de propietario y las tarifas/planes.</p><small>Confirma escribiendo REINICIAR. Esta acción no se puede deshacer; exporta un respaldo antes.</small></div><button className="danger-button" disabled={busy} onClick={onReset}>{busy?"Procesando…":"Reiniciar registros"}</button></section><section className="panel reset-test-panel"><div className="reset-test-icon"><Activity size={20}/></div><div><h2>Limpiar datos de demostración</h2><p>Elimina únicamente registros DEMO. Conserva datos reales, usuarios y tarifas.</p><small>Confirma escribiendo LIMPIAR DEMO.</small></div><button className="secondary-button" disabled={busy} onClick={onReset}>{busy?"Procesando…":"Limpiar pruebas"}</button></section><section className="panel security-panel"><Shield/><div><h2>Seguridad y acceso</h2><p>Con Supabase, los usuarios se autentican individualmente y la base de datos aplica permisos RLS. Los roles se administran desde el perfil del usuario. No compartas contraseñas ni claves secretas.</p></div></section></>
}

function AccessDenied(){return <div className="panel access-denied"><Shield size={25}/><h2>Acceso reservado al propietario</h2><p>Este módulo contiene información administrativa. Solicita al propietario que revise los permisos de tu cuenta.</p></div>}
function Stat({icon,label,value,change,tint}:{icon:ReactNode;label:string;value:string;change:string;tint:string}){return <div className="stat-card"><div className={`stat-icon ${tint}`}>{icon}</div><span className="stat-label">{label}</span><strong className="stat-value">{value}</strong><small className="neutral">{change}</small></div>}
function Quick({icon,label,onClick}:{icon:ReactNode;label:string;onClick:()=>void}){return <button className="quick-action" onClick={onClick}><span>{icon}</span><strong>{label}</strong><ArrowUpRight size={15}/></button>}
function Empty({text}:{text:string}){return <div className="empty-state"><ClipboardList size={24}/><p>{text}</p></div>}
function Modal({title,children,onClose}:{title:string;children:ReactNode;onClose:()=>void}){return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><section className="modal"><div className="modal-heading"><h2>{title}</h2><button onClick={onClose}><X size={18}/></button></div>{children}</section></div>}
function FieldInput({field,value,onChange}:{field:Field;value:string;onChange:(v:string)=>void}){return <label className={field.type==='textarea'?'field full':'field'}>{field.label}{field.type==='select'?<select disabled={field.disabled} value={value} onChange={e=>onChange(e.target.value)} required={field.required}><option value="">Seleccionar…</option>{field.options?.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select>:field.type==='textarea'?<textarea disabled={field.disabled} value={value} onChange={e=>onChange(e.target.value)} placeholder={field.placeholder} required={field.required}/>:<input disabled={field.disabled} type={field.type||'text'} value={value} onChange={e=>onChange(e.target.value)} placeholder={field.placeholder} required={field.required} min={field.type==='number'?0:undefined}/>}</label>}
function FormActions({busy,onCancel}:{busy:boolean;onCancel:()=>void}){return <div className="form-actions"><button type="button" className="secondary-button" onClick={onCancel}>Cancelar</button><button disabled={busy} className="primary-button"><Check size={16}/>{busy?'Procesando…':'Confirmar registro'}</button></div>}
async function compressProductImage(file:File):Promise<Blob>{
 const bitmap=await createImageBitmap(file);const scale=Math.min(1,720/Math.max(bitmap.width,bitmap.height));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));const context=canvas.getContext('2d');if(!context)throw new Error('No fue posible procesar la imagen');context.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error('No se pudo convertir la imagen')),'image/webp',0.78));return blob
}
async function blobToDataUrl(blob:Blob):Promise<string>{return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error('No se pudo leer la imagen'));reader.readAsDataURL(blob)})}
function POSCatalog({products,onAdd}:{products:Row[];onAdd:(id:string)=>void}) {
 const [category,setCategory]=useState('Todas');const [query,setQuery]=useState('')
 const categories=['Todas',...Array.from(new Set(products.map(p=>String(p.category||'Otros')))).sort()]
 const shown=products.filter(p=>(category==='Todas'||String(p.category||'Otros')===category)&&String(p.name||'').toLowerCase().includes(query.toLowerCase()))
 return <div className="pos-catalog"><div className="pos-catalog-toolbar"><div className="pos-categories">{categories.map(cat=><button type="button" className={category===cat?'selected':''} key={cat} onClick={()=>setCategory(cat)}>{cat}</button>)}</div><label className="pos-catalog-search"><Search size={15}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar producto…"/></label></div><div className="pos-product-grid">{shown.map(p=><button type="button" key={p.id} className="pos-product-card" disabled={Number(p.stock||0)<=0} onClick={()=>onAdd(p.id)}><div className="pos-product-art">{p.image_url?<img src={p.image_url} alt={p.name}/>:<div className="pos-product-placeholder"><Package size={28}/><small>{p.category||'Producto'}</small></div>}<span className="pos-add-icon"><Plus size={16}/></span></div><div className="pos-product-meta"><small>{p.category||'Otros'}</small><strong>{p.name}</strong><div><b>{formatMoney(p.price)}</b><span>{Number(p.stock||0)<=0?'Agotado':String(p.stock)+' disp.'}</span></div></div></button>)}</div>{!shown.length&&<Empty text="No hay productos en esta categoría o búsqueda."/>}</div>
}
function ProductAdder({options,onAdd}:{options:{value:string;label:string}[];onAdd:(id:string,qty:number)=>void}) {
 const [id,setId]=useState('');const [qty,setQty]=useState('1')
 return <div className="product-adder"><select value={id} onChange={e=>setId(e.target.value)}><option value="">Selecciona producto…</option>{options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select><input aria-label="Cantidad" type="number" min="1" value={qty} onChange={e=>setQty(e.target.value)}/><button type="button" className="secondary-button" disabled={!id||Number(qty)<1} onClick={()=>{onAdd(id,Number(qty));setId('');setQty('1')}}><Plus size={15}/> Agregar</button></div>
}
function ProductCatalog({products,onCreate,onEdit}:{products:Row[];onCreate:()=>void;onEdit:(p:Row)=>void}) {
 const [category,setCategory]=useState('Todas');const [query,setQuery]=useState('')
 const categories=['Todas',...Array.from(new Set(products.map(p=>String(p.category||'Otros')))).sort()]
 const shown=products.filter(p=>(category==='Todas'||String(p.category||'Otros')===category)&&JSON.stringify(p).toLowerCase().includes(query.toLowerCase()))
 return <><div className="module-heading product-heading"><div><div className="eyebrow">INVENTARIO VISUAL</div><h1>Catálogo de productos</h1><p>Organiza por categorías, imágenes, precios y existencias.</p></div><button className="primary-button" onClick={onCreate}><Plus size={16}/> Añadir producto</button></div><div className="product-shelf-toolbar"><div className="pos-categories">{categories.map(cat=><button type="button" className={category===cat?'selected':''} key={cat} onClick={()=>setCategory(cat)}>{cat}</button>)}</div><label className="pos-catalog-search"><Search size={15}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar producto o código…"/></label></div><div className="product-shelf-grid">{shown.map(p=><button className="shelf-product-card" key={p.id} onClick={()=>onEdit(p)}><div className="shelf-product-image">{p.image_url?<img src={p.image_url} alt={p.name}/>:<div><Package size={30}/><small>Sin imagen</small></div>}<span className="shelf-category">{p.category||'Otros'}</span></div><div className="shelf-product-info"><strong>{p.name}</strong><small>{p.sku||'Sin código'}</small><div><b>{formatMoney(p.price)}</b><span className={Number(p.stock)<=Number(p.min_stock||0)?'low-stock':'stock-ok'}>{p.stock} unidades</span></div></div></button>)}</div>{!shown.length&&<Empty text="No hay productos registrados. Añade el primero para crear el catálogo."/>}</>
}
function LineList({lines,products,onChange}:{lines:{product_id:string;quantity:number}[];products:Row[];onChange:(v:{product_id:string;quantity:number}[])=>void}) {
 return <div className="cart-lines">{lines.map(line=>{const p=products.find(x=>x.id===line.product_id);const stock=Number(p?.stock||0);return <div className="cart-line" key={line.product_id}><div className="cart-product">{p?.image_url?<img src={p.image_url} alt=""/>:<span className="cart-mini-placeholder"><Package size={15}/></span>}<span><strong>{p?.name||'Producto no disponible'}</strong><small>{p?.category||'Otros'} · Disponible: {stock}</small></span></div><div className="cart-quantity"><button type="button" disabled={line.quantity<=1} onClick={()=>onChange(lines.map(x=>x.product_id===line.product_id?{...x,quantity:Math.max(1,x.quantity-1)}:x))}>−</button><b>{line.quantity}</b><button type="button" disabled={line.quantity>=stock} onClick={()=>onChange(lines.map(x=>x.product_id===line.product_id?{...x,quantity:Math.min(stock,x.quantity+1)}:x))}>+</button></div><strong className="cart-line-total">{formatMoney(Number(p?.price||0)*line.quantity)}</strong><button className="cart-remove" type="button" aria-label="Quitar producto" onClick={()=>onChange(lines.filter(x=>x.product_id!==line.product_id))}><X size={14}/></button></div>})}{!lines.length&&<div className="cart-empty"><ShoppingBag size={25}/><strong>El carrito está esperando productos</strong><small>Toca una tarjeta del catálogo para añadirla.</small></div>}</div>
}
function PurchaseLineList({lines,products,onChange}:{lines:{product_id:string;quantity:number;unit_cost:number}[];products:Row[];onChange:(v:{product_id:string;quantity:number;unit_cost:number}[])=>void}){return <div className="cart-lines">{lines.map((line,i)=>{const p=products.find(x=>x.id===line.product_id);return <div key={i}><span>{p?.name} × {line.quantity} <small>({formatMoney(line.unit_cost)} c/u)</small></span><strong>{formatMoney(line.unit_cost*line.quantity)}</strong><button type="button" onClick={()=>onChange(lines.filter((_,idx)=>idx!==i))}><X size={14}/></button></div>})}{!lines.length&&<small>Aún no hay productos comprados.</small>}</div>}
function dialogTitle(dialog: string, editing: Row|null){if(dialog==='record')return editing?'Editar registro':'Nuevo registro';return ({payment:'Registrar pago / mensualidad',balance:'Cobrar saldo pendiente',daypass:'Registrar pase diario',expense:'Registrar gasto',sale:'Nueva venta',purchase:'Registrar compra',cash:'Control de caja'} as Record<string,string>)[dialog]||'Movimiento'}
