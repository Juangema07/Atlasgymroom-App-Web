import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import {
  Activity, ArrowDownRight, ArrowUpRight, BarChart3, CalendarDays,
  Check, CircleDollarSign, ClipboardList, Cloud, CloudOff,
  Download, Dumbbell, FileDown, FileUp, Home, LogOut, Menu,
  Package, Plus, RefreshCw, Search, Settings, Shield, ShoppingBag, ShoppingCart, Users, ImagePlus, Tag, Zap, UserPlus, Printer, Mail,
  Wallet, X, Pencil, Receipt, AlertTriangle, UserRound, LockKeyhole, Pause, Play,
} from 'lucide-react'
import { supabase, supabaseConfigured } from './lib/supabase'
import {
  clearLocalCache, exportLocalBackup, importLocalBackup, listRows, queueStatus, runBusinessRpc,
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
const documentTypes = [
  { value: 'cedula_ciudadania', label: 'Cédula de ciudadanía (CC)' },
  { value: 'tarjeta_identidad', label: 'Tarjeta de identidad (TI)' },
  { value: 'cedula_extranjeria', label: 'Cédula de extranjería (CE)' },
  { value: 'pasaporte', label: 'Pasaporte' },
  { value: 'permiso_proteccion_temporal', label: 'Permiso por Protección Temporal (PPT)' },
  { value: 'nit', label: 'NIT' },
  { value: 'otro', label: 'Otro documento' },
]
const documentTypeLabel = (value: unknown) => documentTypes.find(option => option.value === String(value || 'cedula_ciudadania'))?.label || 'Cédula de ciudadanía (CC)'
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
      { key: 'full_name', label: 'Nombre completo', required: true },
      { key: 'document_type', label: 'Tipo de documento', type: 'select', required: true, options: documentTypes },
      { key: 'document', label: 'Número de documento (obligatorio)', required: true, placeholder: 'Escribe el número de identificación' },
      { key: 'phone', label: 'Teléfono' }, { key: 'email', label: 'Correo', type: 'email' },
      { key: 'birth_date', label: 'Fecha de nacimiento', type: 'date' }, { key: 'current_plan_id', label: 'Plan', type: 'select', options: [{ value: '', label: 'Sin plan asignado' }, ...planOptions] },
      { key: 'start_date', label: 'Inicio', type: 'date' }, { key: 'end_date', label: 'Vencimiento', type: 'date' },
      { key: 'status', label: 'Estado', type: 'select', options: statuses }, { key: 'notes', label: 'Notas', type: 'textarea' },
    ], columns: [{ key: 'full_name', label: 'Nombre' }, { key: 'document_type', label: 'Tipo de documento' }, { key: 'document', label: 'Número' }, { key: 'phone', label: 'Teléfono' }, { key: 'status', label: 'Estado' }, { key: 'end_date', label: 'Vence' }] },
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
      { key: 'name', label: 'Nombre del producto', required: true }, { key: 'category', label: 'Categoría', type: 'select', options: [{value:'Otros',label:'Otros'}, ...(rows.gym_records || []).filter(record => record.module_key === 'product_categories' && record.status !== 'inactive').map(record => ({value:String(record.title),label:String(record.title)}))] }, { key: 'sku', label: 'Código / SKU' }, { key: 'description', label: 'Descripción' },
      { key: 'cost', label: 'Costo (COP)', type: 'number' }, { key: 'price', label: 'Precio (COP)', type: 'number', required: true },
      { key: 'stock', label: 'Existencias iniciales', type: 'number', required: true }, { key: 'min_stock', label: 'Stock mínimo', type: 'number' },
    ], columns: [{ key: 'name', label: 'Producto' }, { key: 'category', label: 'Categoría' }, { key: 'stock', label: 'Existencias' }, { key: 'min_stock', label: 'Mínimo' }, { key: 'price', label: 'Precio' }] },
    Compras: { table: 'purchases', title: 'Compras', description: 'Registra entradas de mercancía y proveedores.', fields: [], columns: [{ key: 'supplier', label: 'Proveedor' }, { key: 'description', label: 'Descripción' }, { key: 'total_amount', label: 'Total' }, { key: 'purchased_at', label: 'Fecha' }] },
    Gastos: { table: 'expenses', title: 'Gastos y egresos', description: 'Registra salidas y conserva el responsable del movimiento.', fields: [], columns: [{ key: 'category', label: 'Categoría' }, { key: 'description', label: 'Concepto' }, { key: 'amount', label: 'Valor' }, { key: 'method', label: 'Método' }, { key: 'expense_date', label: 'Fecha' }] },
    Ventas: { table: 'sales', title: 'Punto de venta', description: 'Agrega productos al carrito y confirma la venta.', fields: [], columns: [{ key: 'id', label: 'Venta' }, { key: 'total', label: 'Total' }, { key: 'amount_paid', label: 'Recibido' }, { key: 'status', label: 'Estado' }, { key: 'sold_at', label: 'Fecha' }] },
    Equipo: { table: 'profiles', title: 'Equipo y usuarios', description: 'Usuarios individuales. Las cuentas se crean desde Supabase Auth.', fields: [], columns: [{ key: 'full_name', label: 'Nombre' }, { key: 'role', label: 'Rol' }, { key: 'active', label: 'Activo' }] },
    Auditoría: { table: 'audit_logs', title: 'Auditoría', description: 'Historial de modificaciones registradas en la base de datos.', fields: [], columns: [{ key: 'entity_table', label: 'Módulo' }, { key: 'action', label: 'Acción' }, { key: 'entity_id', label: 'Registro' }, { key: 'changed_at', label: 'Fecha' }] },
  }

  const aux: Partial<Record<Section, ModuleConfig>> = {
    'Evoluciones': { table:'gym_records', title:'Evoluciones', description:'Seguimiento de sesiones y avances de entrenamiento. No sustituye una historia clínica.', fields:[
      {key:'person_name',label:'Socio',required:true},{key:'record_date',label:'Fecha',type:'date',required:true},
      {key:'detail_session',label:'Sesión / actividad'},{key:'detail_notes',label:'Observaciones de entrenamiento',type:'textarea'},
    ], columns:[{key:'person_name',label:'Socio'},{key:'record_date',label:'Fecha'},{key:'detail_session',label:'Actividad'},{key:'status',label:'Estado'}] },
    'Rutinas': { table:'gym_records', title:'Rutinas', description:'Crea y administra rutinas asignadas a los socios.', fields:[
      {key:'title',label:'Nombre de la rutina',required:true},{key:'person_name',label:'Socio asignado'},
      {key:'date_start',label:'Fecha de inicio',type:'date'},{key:'date_end',label:'Fecha de finalización',type:'date'},
      {key:'status',label:'Estado',type:'select',options:[{value:'active',label:'Activa'},{value:'paused',label:'Pausada'},{value:'completed',label:'Completada'}]},
      {key:'detail_days_per_week',label:'Días por semana',type:'number'},{key:'detail_goal',label:'Objetivo'},{key:'detail_exercises',label:'Ejercicios / series / repeticiones',type:'textarea'},
    ], columns:[{key:'title',label:'Rutina'},{key:'person_name',label:'Socio'},{key:'date_start',label:'Inicio'},{key:'date_end',label:'Fin'},{key:'status',label:'Estado'}] },
    'Ejercicios': { table:'gym_records', title:'Ejercicios', description:'Catálogo de ejercicios e instrucciones para construir rutinas.', fields:[
      {key:'title',label:'Nombre del ejercicio',required:true},{key:'status',label:'Estado',type:'select',options:[{value:'active',label:'Activo'},{value:'inactive',label:'Inactivo'}]},
      {key:'detail_muscle_group',label:'Grupo muscular'},{key:'detail_equipment',label:'Equipo'},{key:'detail_instructions',label:'Instrucciones',type:'textarea'},
    ], columns:[{key:'title',label:'Ejercicio'},{key:'detail_muscle_group',label:'Grupo'},{key:'detail_equipment',label:'Equipo'},{key:'status',label:'Estado'}] },
    'Proveedores': { table:'gym_records', title:'Proveedores', description:'Directorio de proveedores para asociar a compras.', fields:[
      {key:'person_name',label:'Nombre del contacto',required:true},{key:'detail_business_name',label:'Empresa'},{key:'phone',label:'Teléfono'},{key:'email',label:'Correo',type:'email'},
      {key:'detail_tax_id',label:'NIT / identificación'},{key:'detail_address',label:'Dirección'},{key:'status',label:'Estado',type:'select',options:[{value:'active',label:'Activo'},{value:'inactive',label:'Inactivo'}]},
      {key:'notes',label:'Notas',type:'textarea'},
    ], columns:[{key:'person_name',label:'Contacto'},{key:'detail_business_name',label:'Empresa'},{key:'phone',label:'Teléfono'},{key:'email',label:'Correo'},{key:'status',label:'Estado'}] },
    'Empleados': { table:'gym_records', title:'Personal', description:'Directorio operativo del equipo. Las cuentas y permisos de acceso se administran en Usuarios.', fields:[
      {key:'person_name',label:'Nombre completo',required:true},{key:'phone',label:'Teléfono'},{key:'email',label:'Correo',type:'email'},
      {key:'detail_position',label:'Cargo / función'},{key:'status',label:'Estado',type:'select',options:[{value:'active',label:'Activo'},{value:'inactive',label:'Inactivo'}]},{key:'notes',label:'Notas',type:'textarea'},
    ], columns:[{key:'person_name',label:'Nombre'},{key:'detail_position',label:'Cargo'},{key:'phone',label:'Teléfono'},{key:'email',label:'Correo'},{key:'status',label:'Estado'}] },
    'Cuentas por Cobrar Ventas': { table:'sales', title:'Cuentas por cobrar de ventas', description:'Ventas con saldos pendientes. Registra abonos sin borrar el movimiento original.', fields:[], columns:[
      {key:'id',label:'Venta'},{key:'total',label:'Total'},{key:'amount_paid',label:'Recibido'},{key:'status',label:'Estado'},{key:'sold_at',label:'Fecha'}
    ] },
    'Cuentas por Pagar Compras': { table:'purchases', title:'Cuentas por pagar de compras', description:'Compras con saldo pendiente y registro de abonos.', fields:[], columns:[
      {key:'supplier',label:'Proveedor'},{key:'description',label:'Concepto'},{key:'total_amount',label:'Total'},{key:'amount_paid',label:'Pagado'},{key:'purchased_at',label:'Fecha'}
    ] },
    'Notas Débito': { table:'gym_records', title:'Notas débito · registro interno', description:'Registra solicitudes de ajuste a ventas. No genera una nota electrónica ni modifica automáticamente la contabilidad.', fields:[
      {key:'title',label:'Concepto',required:true},{key:'person_name',label:'Cliente / tercero'},{key:'record_date',label:'Fecha',type:'date'},
      {key:'amount',label:'Valor solicitado (COP)',type:'number'},{key:'detail_reference',label:'Venta / referencia'},{key:'notes',label:'Motivo y soporte',type:'textarea'},
    ], columns:[{key:'title',label:'Concepto'},{key:'person_name',label:'Tercero'},{key:'amount',label:'Valor'},{key:'record_date',label:'Fecha'},{key:'status',label:'Estado'}] },
    'Notas Crédito': { table:'gym_records', title:'Notas crédito · registro interno', description:'Registra solicitudes de devolución o corrección conservando la referencia original. No emite documento electrónico.', fields:[
      {key:'title',label:'Concepto',required:true},{key:'person_name',label:'Cliente / tercero'},{key:'record_date',label:'Fecha',type:'date'},
      {key:'amount',label:'Valor solicitado (COP)',type:'number'},{key:'detail_reference',label:'Venta / referencia'},{key:'notes',label:'Motivo y soporte',type:'textarea'},
    ], columns:[{key:'title',label:'Concepto'},{key:'person_name',label:'Tercero'},{key:'amount',label:'Valor'},{key:'record_date',label:'Fecha'},{key:'status',label:'Estado'}] },
    'Documento Soporte': { table:'gym_records', title:'Documentos soporte · control interno', description:'Lleva el registro de documentos recibidos y referencias. No genera Documento Soporte electrónico DIAN.', fields:[
      {key:'title',label:'Documento / concepto',required:true},{key:'person_name',label:'Proveedor / tercero'},{key:'record_date',label:'Fecha',type:'date'},
      {key:'amount',label:'Valor (COP)',type:'number'},{key:'detail_document_number',label:'Número de documento'},{key:'detail_file_reference',label:'Referencia del archivo'},{key:'notes',label:'Observaciones',type:'textarea'},
    ], columns:[{key:'title',label:'Documento'},{key:'person_name',label:'Tercero'},{key:'detail_document_number',label:'Número'},{key:'amount',label:'Valor'},{key:'record_date',label:'Fecha'}] },
    'Notas Ajuste': { table:'gym_records', title:'Notas de ajuste · registro interno', description:'Registra correcciones administrativas de compras y gastos para revisión.', fields:[
      {key:'title',label:'Concepto',required:true},{key:'person_name',label:'Proveedor / tercero'},{key:'record_date',label:'Fecha',type:'date'},
      {key:'amount',label:'Valor (COP)',type:'number'},{key:'detail_reference',label:'Compra / referencia'},{key:'notes',label:'Motivo',type:'textarea'},
    ], columns:[{key:'title',label:'Concepto'},{key:'person_name',label:'Tercero'},{key:'amount',label:'Valor'},{key:'record_date',label:'Fecha'},{key:'status',label:'Estado'}] },
    'Tipos de Gastos': { table:'gym_records', title:'Tipos de gastos', description:'Catálogo de categorías para clasificar los egresos.', fields:[
      {key:'title',label:'Nombre de categoría',required:true},{key:'status',label:'Estado',type:'select',options:[{value:'active',label:'Activa'},{value:'inactive',label:'Inactiva'}]},{key:'notes',label:'Descripción',type:'textarea'},
    ], columns:[{key:'title',label:'Categoría'},{key:'notes',label:'Descripción'},{key:'status',label:'Estado'}] },
    'Ajuste Cartera': { table:'gym_records', title:'Ajuste de cartera · solicitudes', description:'Documenta una solicitud de corrección; no altera saldos contables ni pagos automáticamente.', fields:[
      {key:'title',label:'Concepto',required:true},{key:'person_name',label:'Cliente / tercero'},{key:'record_date',label:'Fecha',type:'date'},
      {key:'amount',label:'Valor solicitado (COP)',type:'number'},{key:'detail_reference',label:'Cuenta / referencia'},{key:'notes',label:'Motivo de la solicitud',type:'textarea'},
    ], columns:[{key:'title',label:'Concepto'},{key:'person_name',label:'Tercero'},{key:'amount',label:'Valor'},{key:'record_date',label:'Fecha'},{key:'status',label:'Estado'}] },
    'Categorías de Producto': { table:'gym_records', title:'Categorías de producto', description:'Administra categorías para organizar el catálogo. Elige la categoría al crear o editar un producto.', fields:[
      {key:'title',label:'Nombre de categoría',required:true},{key:'status',label:'Estado',type:'select',options:[{value:'active',label:'Activa'},{value:'inactive',label:'Inactiva'}]},{key:'notes',label:'Descripción',type:'textarea'},
    ], columns:[{key:'title',label:'Categoría'},{key:'notes',label:'Descripción'},{key:'status',label:'Estado'}] },
    'Ajustes de Inventario': { table:'gym_records', title:'Ajustes de inventario', description:'Registra ajustes justificados. Cada ajuste aprobado actualiza el stock y crea un movimiento en Kardex.', fields:[
      {key:'title',label:'Motivo del ajuste',required:true},{key:'record_date',label:'Fecha',type:'date',required:true},
      {key:'detail_product_id',label:'Producto',type:'select',options:[{value:'',label:'Seleccionar producto'},...(rows.products||[]).map(p=>({value:p.id,label:p.name}))],required:true},
      {key:'detail_quantity',label:'Cantidad',type:'number',required:true},{key:'detail_direction',label:'Tipo',type:'select',options:[{value:'increase',label:'Entrada / sumar'},{value:'decrease',label:'Salida / restar'}],required:true},
      {key:'notes',label:'Justificación',type:'textarea',required:true},
    ], columns:[{key:'title',label:'Motivo'},{key:'detail_product_id',label:'Producto'},{key:'detail_quantity',label:'Cantidad'},{key:'record_date',label:'Fecha'},{key:'status',label:'Estado'}] },
    'Regularizaciones de Inventario': { table:'gym_records', title:'Conteos y regularizaciones', description:'Registra conteos físicos. La diferencia queda como borrador hasta que se confirme mediante un ajuste auditado.', fields:[
      {key:'title',label:'Conteo / referencia',required:true},{key:'record_date',label:'Fecha',type:'date',required:true},
      {key:'detail_product_id',label:'Producto',type:'select',options:[{value:'',label:'Seleccionar producto'},...(rows.products||[]).map(p=>({value:p.id,label:p.name}))],required:true},
      {key:'detail_counted_stock',label:'Existencia contada',type:'number',required:true},{key:'notes',label:'Observaciones',type:'textarea'},
    ], columns:[{key:'title',label:'Conteo'},{key:'detail_product_id',label:'Producto'},{key:'detail_counted_stock',label:'Contado'},{key:'record_date',label:'Fecha'},{key:'status',label:'Estado'}] },
    'Kardex de Inventario': { table:'stock_movements', title:'Kardex de inventario', description:'Consulta los movimientos reales de inventario; este historial no permite editar ni borrar operaciones.', fields:[], columns:[
      {key:'product_id',label:'Producto'},{key:'movement_type',label:'Movimiento'},{key:'quantity',label:'Cantidad'},{key:'notes',label:'Motivo'},{key:'created_at',label:'Fecha'}
    ] },
    'Configuración de Reservaciones': { table:'gym_records', title:'Configuración de reservaciones', description:'Define reglas internas, horarios y cupos de referencia. Aún no hay motor externo de reservas ni bloqueo automático de cupos.', fields:[
      {key:'title',label:'Nombre de la regla',required:true},{key:'status',label:'Estado',type:'select',options:[{value:'active',label:'Activa'},{value:'inactive',label:'Inactiva'}]},
      {key:'detail_days',label:'Días disponibles'},{key:'detail_start_time',label:'Hora de inicio',type:'time'},{key:'detail_end_time',label:'Hora de fin',type:'time'},
      {key:'detail_capacity',label:'Cupo de referencia',type:'number'},{key:'notes',label:'Condiciones',type:'textarea'},
    ], columns:[{key:'title',label:'Regla'},{key:'detail_days',label:'Días'},{key:'detail_capacity',label:'Cupo'},{key:'status',label:'Estado'}] },
    'Clases': { table:'gym_records', title:'Clases', description:'Programa clases y conserva fecha, instructor y cupo previsto.', fields:[
      {key:'title',label:'Nombre de la clase',required:true},{key:'record_date',label:'Fecha',type:'date',required:true},{key:'detail_start_time',label:'Inicio',type:'time'},{key:'detail_end_time',label:'Fin',type:'time'},
      {key:'detail_instructor',label:'Instructor'},{key:'detail_capacity',label:'Cupo',type:'number'},{key:'status',label:'Estado',type:'select',options:[{value:'scheduled',label:'Programada'},{value:'cancelled',label:'Cancelada'},{value:'completed',label:'Realizada'}]},{key:'notes',label:'Descripción',type:'textarea'},
    ], columns:[{key:'title',label:'Clase'},{key:'record_date',label:'Fecha'},{key:'detail_start_time',label:'Inicio'},{key:'detail_instructor',label:'Instructor'},{key:'status',label:'Estado'}] },
    'Reservaciones': { table:'gym_records', title:'Reservaciones', description:'Agenda manual de reservas y su estado. La validación automática de cupos y recordatorios aún no está conectada.', fields:[
      {key:'title',label:'Actividad / clase',required:true},{key:'person_name',label:'Socio / persona',required:true},{key:'phone',label:'Teléfono'},
      {key:'record_date',label:'Fecha de reserva',type:'date',required:true},{key:'detail_start_time',label:'Hora',type:'time'},
      {key:'status',label:'Estado',type:'select',options:[{value:'reserved',label:'Reservada'},{value:'attended',label:'Asistió'},{value:'cancelled',label:'Cancelada'}]},{key:'notes',label:'Notas',type:'textarea'},
    ], columns:[{key:'title',label:'Actividad'},{key:'person_name',label:'Persona'},{key:'record_date',label:'Fecha'},{key:'detail_start_time',label:'Hora'},{key:'status',label:'Estado'}] },
    'Mi Sucursal': { table:'gym_records', title:'Mi sucursal', description:'Guarda los datos de referencia de la sede del gimnasio.', fields:[
      {key:'title',label:'Nombre de la sede',required:true},{key:'phone',label:'Teléfono'},{key:'email',label:'Correo',type:'email'},
      {key:'detail_address',label:'Dirección'},{key:'detail_opening_hours',label:'Horarios',type:'textarea'},{key:'notes',label:'Información adicional',type:'textarea'},
    ], columns:[{key:'title',label:'Sede'},{key:'phone',label:'Teléfono'},{key:'email',label:'Correo'},{key:'detail_address',label:'Dirección'}] },
    'Menú de Navegación': { table:'gym_records', title:'Menú de navegación', description:'Administra notas y organización de navegación; los permisos efectivos se controlan desde Usuarios.', fields:[
      {key:'title',label:'Nombre del apartado',required:true},{key:'detail_group',label:'Grupo del menú'},{key:'detail_order',label:'Orden',type:'number'},{key:'status',label:'Estado',type:'select',options:[{value:'active',label:'Visible'},{value:'inactive',label:'Oculto'}]},{key:'notes',label:'Descripción',type:'textarea'},
    ], columns:[{key:'title',label:'Apartado'},{key:'detail_group',label:'Grupo'},{key:'detail_order',label:'Orden'},{key:'status',label:'Estado'}] },
    'Roles': { table:'gym_records', title:'Perfiles de permisos', description:'Guarda perfiles de permisos de referencia. Los permisos que realmente se aplican se administran usuario por usuario en Usuarios.', fields:[
      {key:'title',label:'Nombre del perfil',required:true},{key:'notes',label:'Descripción',type:'textarea'},{key:'status',label:'Estado',type:'select',options:[{value:'active',label:'Activo'},{value:'inactive',label:'Inactivo'}]},
    ], columns:[{key:'title',label:'Perfil'},{key:'notes',label:'Descripción'},{key:'status',label:'Estado'}] },
    'Configuración de Correos': { table:'gym_records', title:'Configuración de correos', description:'El envío de invitaciones usa Supabase Auth. SMTP, URL del sitio y plantillas de autenticación deben configurarse en el panel Supabase; no guardes contraseñas SMTP aquí.', fields:[
      {key:'title',label:'Nombre de la configuración',required:true},{key:'detail_sender_name',label:'Nombre del remitente'},{key:'detail_sender_email',label:'Correo del remitente',type:'email'},{key:'notes',label:'Notas de configuración',type:'textarea'},
    ], columns:[{key:'title',label:'Configuración'},{key:'detail_sender_name',label:'Remitente'},{key:'detail_sender_email',label:'Correo'}] },
    'Plantilla de Correos': { table:'gym_records', title:'Plantillas de correos', description:'Edita textos de referencia. El envío automático de estas plantillas no está conectado todavía.', fields:[
      {key:'title',label:'Nombre de plantilla',required:true},{key:'detail_subject',label:'Asunto'},{key:'detail_body',label:'Contenido',type:'textarea'},{key:'status',label:'Estado',type:'select',options:[{value:'active',label:'Activa'},{value:'inactive',label:'Inactiva'}]},
    ], columns:[{key:'title',label:'Plantilla'},{key:'detail_subject',label:'Asunto'},{key:'status',label:'Estado'}] },
    'Notificaciones': { table:'gym_records', title:'Notificaciones internas', description:'Registra avisos internos para consulta en la administración. Push y correo masivo no están conectados.', fields:[
      {key:'title',label:'Aviso',required:true},{key:'person_name',label:'Destinatario / grupo'},{key:'record_date',label:'Fecha',type:'date'},{key:'status',label:'Estado',type:'select',options:[{value:'draft',label:'Borrador'},{value:'active',label:'Activo'},{value:'closed',label:'Cerrado'}]},{key:'notes',label:'Mensaje',type:'textarea'},
    ], columns:[{key:'title',label:'Aviso'},{key:'person_name',label:'Destinatario'},{key:'record_date',label:'Fecha'},{key:'status',label:'Estado'}] },
    'Historial de Correos': { table:'gym_records', title:'Historial de correos', description:'Consulta solicitudes de invitación registradas. El estado refleja la solicitud a Supabase Auth, no confirma entrega o lectura del correo.', fields:[], columns:[
      {key:'title',label:'Evento'},{key:'person_name',label:'Persona'},{key:'email',label:'Correo'},{key:'status',label:'Estado'},{key:'record_date',label:'Fecha'}
    ] },
  }

  const normalized: Section = section === 'Tarifas' || section === 'Lista de Precios' ? 'Planes' : section === 'Cuentas por Cobrar Pagos' ? 'Pagos' : section === 'Congelar Pagos' ? 'Miembros' : section
  const config = (base[normalized] || aux[section]) as ModuleConfig | undefined
  if (!config) return null
  if (section === 'Cuentas por Cobrar Pagos') return { ...config, title: 'Cuentas por cobrar pagos', description: 'Abonos pendientes y saldos que faltan por recibir.' }
  if (section === 'Congelar Pagos') return { ...config, title: 'Congelar pagos', description: 'Clientes con actividad pausada y acciones para reactivar su tarifa.' }
  return config
}


const permissionKeyMap: Partial<Record<Section, string>> = {
  'Inicio':'dashboard','Miembros':'members','Planes':'plans','Tarifas':'plans','Lista de Precios':'plans',
  'Asistencia':'attendance','Pase diario':'day_pass','Pagos':'payments','Cuentas por Cobrar Pagos':'payments',
  'Congelar Pagos':'members','Ventas':'sales','Notas Débito':'sales_adjustments','Notas Crédito':'sales_adjustments',
  'Cuentas por Cobrar Ventas':'receivables_sales','Productos':'products','Compras':'purchases',
  'Cuentas por Pagar Compras':'purchases','Gastos':'expenses','Tipos de Gastos':'expense_types',
  'Ajuste Cartera':'receivables_adjustments','Categorías de Producto':'product_categories',
  'Ajustes de Inventario':'inventory_adjustments','Regularizaciones de Inventario':'inventory_counts',
  'Kardex de Inventario':'inventory_ledger','Evoluciones':'evolutions','Rutinas':'routines','Ejercicios':'exercises',
  'Proveedores':'suppliers','Empleados':'employees','Documento Soporte':'supporting_documents','Notas Ajuste':'purchase_adjustments',
  'Configuración de Reservaciones':'booking_settings','Clases':'classes','Reservaciones':'reservations',
  'Mi Sucursal':'branch','Menú de Navegación':'navigation','Roles':'roles','Usuarios':'users',
  'Configuración de Correos':'email_settings','Plantilla de Correos':'email_templates',
  'Notificaciones':'notifications','Historial de Correos':'email_history','Caja':'cash','Informes':'reports',
  'Auditoría':'audit','Configuración':'settings','Equipo':'employees',
};
function permissionKeyFor(section: Section): string { return permissionKeyMap[section] || 'misc' }

const permissionGroups = [
  { title:'Inicio y análisis', modules:[{key:'dashboard',label:'Panel de operaciones',actions:['view']},{key:'reports',label:'Informes',actions:['view']}] },
  { title:'Clientes y asistencia', modules:[
    {key:'members',label:'Miembros',actions:['view','create','update']},{key:'attendance',label:'Asistencia',actions:['view','create']},
    {key:'day_pass',label:'Pases diarios',actions:['view','create']},{key:'evolutions',label:'Evoluciones',actions:['view','create','update']},
    {key:'routines',label:'Rutinas',actions:['view','create','update']},{key:'exercises',label:'Ejercicios',actions:['view','create','update']},
  ] },
  { title:'Pagos y ventas', modules:[
    {key:'plans',label:'Tarifas y listas de precios',actions:['view','create','update']},{key:'payments',label:'Pagos y cartera de pagos',actions:['view','create','update']},
    {key:'sales',label:'Ventas',actions:['view','create','update']},{key:'receivables_sales',label:'Cartera de ventas',actions:['view','update']},
    {key:'sales_adjustments',label:'Notas débito y crédito',actions:['view','create','update']},{key:'receivables_adjustments',label:'Ajustes de cartera',actions:['view','create','update']},
  ] },
  { title:'Productos e inventario', modules:[
    {key:'products',label:'Productos',actions:['view','create','update']},{key:'product_categories',label:'Categorías',actions:['view','create','update']},
    {key:'inventory_adjustments',label:'Ajustes de inventario',actions:['view','create']},{key:'inventory_counts',label:'Conteos y regularizaciones',actions:['view','create','update']},
    {key:'inventory_ledger',label:'Kardex',actions:['view']},
  ] },
  { title:'Compras y egresos', modules:[
    {key:'suppliers',label:'Proveedores',actions:['view','create','update']},{key:'purchases',label:'Compras y cuentas por pagar',actions:['view','create','update']},
    {key:'supporting_documents',label:'Documentos soporte',actions:['view','create','update']},{key:'purchase_adjustments',label:'Notas de ajuste',actions:['view','create','update']},
    {key:'expenses',label:'Gastos',actions:['view','create','update']},{key:'expense_types',label:'Tipos de gastos',actions:['view','create','update']},
  ] },
  { title:'Caja y agenda', modules:[
    {key:'cash',label:'Caja',actions:['view','create','close']},{key:'booking_settings',label:'Configuración de reservaciones',actions:['view','create','update']},
    {key:'classes',label:'Clases',actions:['view','create','update']},{key:'reservations',label:'Reservaciones',actions:['view','create','update']},
  ] },
  { title:'Administración', modules:[
    {key:'employees',label:'Empleados y equipo',actions:['view','create','update']},{key:'branch',label:'Mi sucursal',actions:['view','update']},
    {key:'navigation',label:'Menú de navegación',actions:['view','update']},{key:'roles',label:'Roles',actions:['view','update']},
    {key:'users',label:'Usuarios',actions:['view','create','update']},{key:'audit',label:'Auditoría',actions:['view']},
  ] },
  { title:'Comunicaciones', modules:[
    {key:'email_settings',label:'Configuración de correos',actions:['view']},{key:'email_templates',label:'Plantillas de correos',actions:['view','create','update']},
    {key:'notifications',label:'Notificaciones internas',actions:['view','create','update']},{key:'email_history',label:'Historial de correos',actions:['view']},
  ] },
];
const actionLabels: Record<string,string> = {view:'Consultar',create:'Crear',update:'Editar',close:'Cerrar'};
const defaultCashierPermissions: Record<string,Record<string,boolean>> = {
  dashboard:{view:true},members:{view:true,create:true,update:true},attendance:{view:true,create:true},
  day_pass:{view:true,create:true},payments:{view:true,create:true,update:true},
  sales:{view:true,create:true,update:true},products:{view:true},cash:{view:true,create:true,close:true},reports:{view:true},
};

export default function App() {
  const [section, setSection] = useState<Section>('Inicio')
  const [menuOpen, setMenuOpen] = useState(false)
  const [session, setSession] = useState<Session | null>(null)
  const [authLoading, setAuthLoading] = useState(Boolean(supabaseConfigured))
  const [recoveryMode, setRecoveryMode] = useState(false)
  const [profile, setProfile] = useState<Row | null>(null)
  const [profileLoading, setProfileLoading] = useState(Boolean(supabaseConfigured));
  const [termsRecord, setTermsRecord] = useState<Row | null>(null);
  const [termsStatus, setTermsStatus] = useState<'loading'|'required'|'accepted'|'error'>(supabaseConfigured ? 'loading' : 'accepted');
  const [termsError, setTermsError] = useState('');
  const [termsBusy, setTermsBusy] = useState(false);
  const [userAcceptances, setUserAcceptances] = useState<Row[]>([]);
  const [permissionHistory, setPermissionHistory] = useState<Row[]>([]);

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
  const [cashPrintRecord, setCashPrintRecord] = useState<Row | null>(null)
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
    let cancelled = false;
    const loadAccount = async () => {
      if (session?.user && supabase) {
        setProfileLoading(true);
        setTermsStatus('loading');
        setTermsError('');
        setProfile(null);
        const { data: profileData, error: profileError } = await supabase
          .from('profiles').select('*').eq('id', session.user.id).maybeSingle();
        if (cancelled) return;
        if (profileError || !profileData) {
          setProfileLoading(false);
          setTermsStatus('error');
          setTermsError(profileError?.message || 'La cuenta no tiene un perfil de acceso asociado.');
          return;
        }
        setProfile(profileData);
        setProfileLoading(false);
        if (profileData.active === false) {
          setTermsStatus('accepted');
          return;
        }
        const { data: activeTerms, error: termsQueryError } = await supabase
          .from('app_terms_versions').select('version,title,body,published_at').eq('active', true).maybeSingle();
        if (cancelled) return;
        if (termsQueryError || !activeTerms) {
          setTermsStatus('error');
          setTermsError(termsQueryError?.message || 'No hay una versión activa de los términos.');
          return;
        }
        setTermsRecord(activeTerms);
        const { data: acceptance, error: acceptanceError } = await supabase
          .from('user_terms_acceptances').select('id,terms_version,accepted_at,permissions_version')
          .eq('user_id', session.user.id).eq('terms_version', activeTerms.version)
          .eq('permissions_version', Number(profileData.permissions_version || 1)).maybeSingle();
        if (cancelled) return;
        if (acceptanceError) {
          setTermsStatus('error');
          setTermsError(acceptanceError.message);
          return;
        }
        setTermsStatus(acceptance ? 'accepted' : 'required');
        if (profileData.role === 'owner') {
          const { data: allAcceptances } = await supabase
            .from('user_terms_acceptances').select('user_id,terms_version,accepted_at')
            .order('accepted_at', { ascending:false });
          if (!cancelled && allAcceptances) setUserAcceptances(allAcceptances as Row[]);
          const { data: historyRows } = await supabase
            .from('user_permission_history')
            .select('user_id,changed_by,previous_permissions,new_permissions,permissions_version,changed_at')
            .order('changed_at',{ascending:false});
          if (!cancelled && historyRows) setPermissionHistory(historyRows as Row[]);
        }
        if (acceptance) void syncPending().then(() => refresh());
      } else if (!supabaseConfigured) {
        setProfile({ id:'local-owner',full_name:'Administrador local',role:'owner',active:true });
        setProfileLoading(false);
        setTermsStatus('accepted');
        void (async () => {
          const currentPlans = await listRows('plans');
          for (const plan of defaultTariffs) if (!currentPlans.some(row => row.name.toLowerCase() === plan.name.toLowerCase())) {
            await saveRow('plans', { ...plan, created_by:null, created_at:nowIso(), updated_at:nowIso() });
          }
          await refresh();
        })();
      } else {
        setRows({});
        setProfile(null);
        setProfileLoading(false);
        setTermsRecord(null);
        setTermsStatus('loading');
        setUserAcceptances([]);
        setPermissionHistory([]);
      }
    };
    void loadAccount();
    return () => { cancelled = true; };
  }, [session, refresh]);

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
  const isOwner = profile?.role === 'owner' && profile?.active !== false
  const canModule = (target: Section, action: string = 'view') => {
    if (profile?.active === false) return false;
    if (['Usuarios','Equipo','Configuración'].includes(target)) return profile?.role === 'owner';
    if (profile?.role === 'owner') return true;
    return profile?.permissions?.[permissionKeyFor(target)]?.[action] === true;
  };
  const moduleConfig = canModule(section, 'view') ? configFor(section, rows) : null
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
  async function signOut() {
    const pending = await queueStatus()
    if (pending.count) {
      notify('Hay movimientos sin sincronizar. Conéctate y sincronízalos antes de cerrar sesión para no perderlos.')
      return
    }
    await clearLocalCache()
    await supabase?.auth.signOut()
    setRows({})
    setProfile(null)
    setSection('Inicio')
  }

  async function acceptTerms() {
    if (!supabase || !session?.user || !termsRecord) return;
    setTermsBusy(true);
    setTermsError('');
    const { error } = await supabase.from('user_terms_acceptances').insert({
      user_id: session.user.id,
      terms_version: termsRecord.version,
      permissions_version: Number(profile?.permissions_version || 1),
    });
    if (error && error.code !== '23505') {
      setTermsError(error.message || 'No se pudo guardar la aceptación.');
      setTermsBusy(false);
      return;
    }
    setTermsStatus('accepted');
    setTermsBusy(false);
    notify('Aceptación registrada. Ya puedes utilizar los apartados autorizados.');
    if (profile?.role === 'owner') {
      const { data } = await supabase.from('user_terms_acceptances').select('user_id,terms_version,accepted_at').order('accepted_at',{ascending:false});
      if (data) setUserAcceptances(data as Row[]);
      const {data:historyRows}=await supabase.from('user_permission_history').select('user_id,changed_by,previous_permissions,new_permissions,permissions_version,changed_at').order('changed_at',{ascending:false});
      if (historyRows) setPermissionHistory(historyRows as Row[]);
    }
    void syncPending().then(() => refresh());
  }

  async function createStaffUser(payload: { full_name: string; email: string; role: 'owner' | 'cashier'; permissions: Record<string,Record<string,boolean>> }) {
    if (!supabase || !isOwner) throw new Error('Solo un administrador puede crear usuarios.');
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-user', { body: payload });
      if (error) throw new Error(error.message || 'No se pudo enviar la invitación.');
      await refresh();
      notify(String(data?.message || 'Invitación creada correctamente.'));
    } finally {
      setBusy(false);
    }
  }

  async function updateStaffPermissions(userId:string, permissions:Record<string,Record<string,boolean>>, permissionsVersion:number) {
    if (!supabase || !isOwner) throw new Error('Solo un administrador puede cambiar permisos.');
    setBusy(true);
    const { error } = await supabase.rpc('update_user_permissions', {
      p_user_id:userId,
      p_permissions:permissions,
      p_expected_version:permissionsVersion,
    });
    setBusy(false);
    if (error) throw new Error(error.message || 'No se pudieron guardar los permisos.');
    await refresh();
    notify('Permisos actualizados. La persona deberá revisar y aceptar nuevamente los términos y permisos al volver a entrar.');
  }

  async function toggleStaffActive(user:Row) {
    if (!supabase || !isOwner) throw new Error('Solo un administrador puede modificar cuentas.');
    if (user.id === session?.user.id) { notify('No puedes desactivar la cuenta que estás utilizando.'); return; }
    setBusy(true);
    const { error } = await supabase.from('profiles').update({ active:user.active === false }).eq('id',user.id);
    setBusy(false);
    if (error) throw new Error(error.message || 'No se pudo actualizar el estado de la cuenta.');
    await refresh();
    notify(user.active === false ? 'Cuenta reactivada.' : 'Cuenta desactivada. Los permisos dejarán de autorizar operaciones.');
  }

  function printCashReport(record: Row) {
    setCashPrintRecord(record)
    window.setTimeout(() => window.print(), 250)
  }

  function notify(message: string) { setToast(message); window.setTimeout(() => setToast(''), 5000) }
  function openRecord(edit?: Row) {
    if (!moduleConfig) return
    setEditing(edit || null)
    setProductImageFile(null); setProductImagePreview(edit?.image_url || '')
    const initial: Record<string, string> = {}
    moduleConfig.fields.forEach(f => { const value = f.key.startsWith('detail_') ? edit?.details?.[f.key.slice(7)] : edit?.[f.key]; initial[f.key] = value == null ? '' : String(value) })
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
      const documentType = String(row.document_type || 'cedula_ciudadania').trim()
      const document = String(row.document || '').trim().replace(/\s+/g, '')
      if (!documentType || !documentTypes.some(option => option.value === documentType)) { notify('Selecciona un tipo de documento válido.'); return }
      if (!document) { notify('El número de documento es obligatorio para registrar un cliente.'); return }
      const normalizedDocument = document.replace(/\s+/g, '').toUpperCase()
      if (members.some(m => String(m.document || '').replace(/\s+/g, '').toUpperCase() === normalizedDocument && String(m.document_type || 'cedula_ciudadania') === documentType && m.id !== row.id)) { notify('Ya existe un cliente con ese tipo y número de documento.'); return }
      row.document_type = documentType
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
    if (moduleConfig.table === 'gym_records') {
      const detailValues = Object.fromEntries(Object.entries(form)
        .filter(([key]) => key.startsWith('detail_'))
        .map(([key,value]) => [key.slice(7), value === '' ? null : value]));
      for (const key of Object.keys(row)) if (key.startsWith('detail_')) delete row[key];
      row.details = { ...(editing?.details || {}), ...detailValues };
      row.record_type = section;
      row.module_key = permissionKeyFor(section);
      row.amount = Number(row.amount || 0);
    }
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
    try {
      const stockMovementId = makeId();
      let result;
      if (section === 'Productos' && !editing) {
        result = await runBusinessRpc('create_product', { p_product: { ...row, stock_movement_id: stockMovementId } }, [
          { table: 'products', row },
          ...(Number(row.stock) > 0 ? [{ table: 'stock_movements' as const, row: { id: stockMovementId, product_id: row.id, movement_type: 'adjustment', quantity: Number(row.stock), notes: 'Existencias iniciales', created_by: session?.user.id || null, created_at: nowIso() } }] : []),
        ]);
      } else if (section === 'Productos' && editing) {
        result = await updateRow(moduleConfig.table, row);
      } else if (section === 'Asistencia') {
        result = await runBusinessRpc('register_attendance', { p_attendance: row }, [{ table: 'attendance', row }]);
      } else if (section === 'Ajustes de Inventario') {
        const details = row.details || {};
        const product = rows.products?.find(p => p.id === details.product_id);
        const quantity = Number(details.quantity || 0);
        const delta = details.direction === 'decrease' ? -quantity : quantity;
        if (!product || !Number.isInteger(quantity) || quantity <= 0 || delta === 0) {
          notify('Selecciona un producto y una cantidad válida para el ajuste.'); return;
        }
        const movement = { id:stockMovementId,product_id:product.id,movement_type:'adjustment',quantity:delta,notes:String(row.notes || row.title),created_by:session?.user.id || null,created_at:nowIso() };
        result = await runBusinessRpc('adjust_product_stock', {
          p_product_id:product.id,p_delta:delta,p_reason:String(row.notes || row.title),p_movement_id:stockMovementId,
        }, [
          { table:'products',row:{...product,stock:Number(product.stock)+delta,updated_at:nowIso()} },
          { table:'stock_movements',row:movement },
        ]);
        if (result.message?.startsWith('El servidor rechazó')) { notify(result.message); return; }
        const recordResult = await saveRow('gym_records', {...row,status:result.synced?'applied':'pending_sync'});
        if (recordResult.message?.startsWith('El servidor rechazó')) { notify(recordResult.message); return; }
      } else {
        result = await saveRow(moduleConfig.table, row);
      }
      if (result.message?.startsWith('El servidor rechazó')) { notify(result.message); return }
      setDialog(null); setProductImageFile(null); setProductImagePreview('')
      notify(result.message || (result.synced ? 'Registro guardado y sincronizado.' : 'Registro guardado localmente.'))
      await refresh()
    } catch (error) {
      notify(error instanceof Error ? error.message : 'No se pudo guardar el registro. Revisa los datos e inténtalo de nuevo.')
    } finally {
      setBusy(false)
    }
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
    event.preventDefault();
    if (!editing) return;
    const isSale = section === 'Cuentas por Cobrar Ventas';
    const isPurchase = section === 'Cuentas por Pagar Compras';
    const amountField = isSale ? 'total' : isPurchase ? 'total_amount' : 'amount';
    const total = Number(editing[amountField] || 0);
    const due = Math.max(0,total-Number(editing.amount_paid||0));
    const amount = Number(form.amount_paid||0);
    if (!Number.isFinite(amount) || amount<=0 || amount>due) {
      notify('El abono debe ser mayor que cero y no superar el saldo pendiente.'); return;
    }
    const cashMovementId = makeId();
    const nextPaid = Number(editing.amount_paid||0)+amount;
    const updated: Row = {
      ...editing,amount_paid:nextPaid,
      status:nextPaid>=total?'paid':'partial',
      paid_at:!isSale&&!isPurchase&&nextPaid>=total?nowIso():editing.paid_at,
      updated_at:nowIso(),
    };
    const movement: Row = {
      id:cashMovementId,cash_session_id:activeSession?.id||null,
      direction:isPurchase?'expense':'income',amount,method:form.method||'cash',
      description:isSale?'Abono a cuenta por cobrar de venta':isPurchase?'Abono a cuenta por pagar de compra':'Abono a cuenta por cobrar',
      reference_id:editing.id,created_by:session?.user.id||null,created_at:nowIso(),
    };
    const table: EntityTable = isSale?'sales':isPurchase?'purchases':'payments';
    const optimistic: {table:EntityTable;row:Row}[] = [
      {table,row:updated},
      {table:'cash_movements',row:movement},
    ];
    if (!isSale && !isPurchase && nextPaid>=total) {
      const member=rows.members?.find(m=>m.id===editing.member_id);
      const plan=rows.plans?.find(p=>p.id===editing.plan_id);
      if(member&&plan){
        const beginDate=member.end_date&&member.end_date>=today()&&member.status==='active'?datePlusDays(String(member.end_date),1):today();
        optimistic.push({table:'members',row:{...member,current_plan_id:plan.id,start_date:beginDate,end_date:datePlusDays(beginDate,Number(plan.duration_days)-1),status:'active',paused_at:null,updated_at:nowIso()}});
      }
    }
    const rpc = isSale?'collect_sales_balance':isPurchase?'collect_purchase_balance':'collect_payment_balance';
    const args = isSale
      ? {p_sale_id:editing.id,p_amount:amount,p_method:form.method||'cash',p_cash_movement_id:cashMovementId}
      : isPurchase
        ? {p_purchase_id:editing.id,p_amount:amount,p_method:form.method||'cash',p_cash_movement_id:cashMovementId}
        : {p_payment_id:editing.id,p_amount:amount,p_method:form.method||'cash',p_cash_movement_id:cashMovementId};
    setBusy(true);
    const result = await runBusinessRpc(rpc,args,optimistic);
    setBusy(false);
    if (result.message?.startsWith('El servidor rechazó')) { notify(result.message); return; }
    setDialog(null);setEditing(null);
    notify(result.message||(result.synced?'Abono registrado correctamente.':'Abono guardado localmente, pendiente de sincronización.'));
    await refresh();
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
    const result = await runBusinessRpc('close_cash_session', { p_session_id: activeSession.id, p_counted_cash: counted }, [{ table: 'cash_sessions', row: { ...activeSession, status: 'closed', expected_cash: expected, counted_cash: counted, difference: counted - expected, closed_at: nowIso(), closed_by: session?.user.id || null, updated_at: nowIso() } }])
    setBusy(false); setDialog(null); notify(result.message || 'Solicitud de cierre de caja guardada.'); await refresh()
  }

  async function backup() {
    const json = await exportLocalBackup()
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `atlasgymrun-respaldo-${today()}.json`; anchor.click(); URL.revokeObjectURL(url)
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
  async function resetDemoData() { await runDemoAction('reset') }
  const handleSection = (label: Section) => { setSection(label); setMenuOpen(false); setSearch(''); setToast('') }
  const openCreate = () => {
    if (section === 'Ventas') openSpecial('sale')
    else if (section === 'Pagos') openSpecial('payment')
    else if (section === 'Pase diario') openSpecial('daypass')
    else if (section === 'Gastos') openSpecial('expense')
    else if (section === 'Compras') openSpecial('purchase')
    else openRecord()
  }

  if (authLoading || (supabaseConfigured && session && (profileLoading || termsStatus==='loading'))) return <div className="auth-screen"><div className="auth-card"><div className="brand-mark"><Dumbbell/></div><p>Comprobando permisos y aceptación…</p></div></div>
  if (supabaseConfigured && recoveryMode && session) return <PasswordRecovery onSave={saveNewPassword} busy={busy} toast={toast} />
  if (supabaseConfigured && !session) return <Login onSignIn={signIn} onForgotPassword={requestPasswordRecovery} busy={busy} toast={toast} />
  if (supabaseConfigured && session && termsStatus==='error') return <AccountHold message={termsError || 'No se pudo verificar el estado de tu cuenta.'} onSignOut={signOut}/>
  if (supabaseConfigured && session && profile?.active===false) return <AccountDisabled onSignOut={signOut}/>
  if (supabaseConfigured && session && termsStatus==='required' && termsRecord) return <TermsAcceptance terms={termsRecord} profile={profile || {}} onAccept={acceptTerms} busy={termsBusy} error={termsError}/>
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
      <div className="brand"><div className="brand-mark"><Dumbbell size={21}/></div><div><strong>ATLAS<span>GYMRUN</span></strong><small>GESTIÓN DE GIMNASIO</small></div><button className="mobile-close" onClick={() => setMenuOpen(false)}><X/></button></div>
      <div className="workspace-label">MENÚ PRINCIPAL</div>
      <nav className="grouped-navigation">{navGroups.filter(group => group.items ? group.items.some(item => canModule(item.target, 'view') && (item.target !== 'Usuarios' || isOwner)) : Boolean(group.target && canModule(group.target, 'view'))).map(({ label, icon: Icon, target, items }) => items ? <div className="nav-group" key={label}>
        <button className={items.some(item => item.target === section) ? 'nav-item nav-parent active-parent' : 'nav-item nav-parent'} onClick={() => setExpandedGroups(v => ({ ...v, [label]: !v[label] }))}><Icon size={18}/><span>{label}</span><span className="nav-chevron">{expandedGroups[label] ? '⌄' : '›'}</span></button>
        {expandedGroups[label] && <div className="nav-submenu">{items.filter(item => canModule(item.target, 'view') && (item.target !== 'Usuarios' || isOwner)).map(item => <button key={item.target} className={section === item.target ? 'nav-subitem active' : 'nav-subitem'} onClick={() => handleSection(item.target)}><span className="nav-dash">–</span>{item.label}{item.target === 'Miembros' && <b className="nav-count">{members.length}</b>}</button>)}</div>}
      </div> : <button key={label} className={section === target ? 'nav-item active' : 'nav-item'} onClick={() => handleSection(target!)}><Icon size={18}/><span>{label}</span></button>)}</nav>
      {isOwner && <><div className="workspace-label admin-label">PROGRAMA</div>
      <nav><button className="nav-item" onClick={() => handleSection('Configuración')}><Shield size={18}/><span>Configuración del sistema</span></button><button className="nav-item" onClick={() => notify('El buzón de sugerencias estará disponible en una próxima versión.')}><ClipboardList size={18}/><span>Buzón de sugerencias</span></button></nav></>}
      <div className="sidebar-bottom"><div className="help-card"><div className="help-icon"><Shield size={17}/></div><strong>Registros bajo control</strong><p>Movimientos financieros con trazabilidad. No se borran desde la aplicación.</p></div><div className="profile"><div className="avatar owner">{userLabel.slice(0,2).toUpperCase()}</div><div className="profile-copy"><strong>{userLabel}</strong><small>{supabaseConfigured ? (isOwner ? 'Administrador' : 'Trabajador') : 'Modo local · sin cuenta'}</small></div>{supabaseConfigured && <button className="profile-action" title="Cerrar sesión" onClick={signOut}><LogOut size={15}/></button>}</div></div>
    </aside>
    {menuOpen && <button className="scrim" aria-label="Cerrar menú" onClick={() => setMenuOpen(false)}/>}
    <main className="main-content">
      <header className="topbar"><div className="topbar-left"><button className="menu-toggle" onClick={() => setMenuOpen(true)}><Menu/></button><div className="breadcrumb">Atlasgymrun <span>/</span> <strong>{section}</strong></div></div><div className="topbar-actions"><div className={`status-pill ${supabaseConfigured ? 'connected' : 'local'}`}>{supabaseConfigured ? <><Cloud size={13}/> Supabase</> : <><CloudOff size={13}/> Solo este dispositivo</>}</div><button className="sync-button" onClick={() => void sync()} title="Sincronizar"><RefreshCw size={15}/><span>{syncCount ? `${syncCount} pendientes` : 'Sin pendientes'}</span></button><div className="avatar owner">{userLabel.slice(0,2).toUpperCase()}</div></div></header>
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
        <div className="desk-search"><label><Activity size={15}/> Registrar asistencia</label><input value={attendanceLookup} onChange={e=>setAttendanceLookup(e.target.value)} placeholder="Documento o nombre del cliente…"/>{attendanceLookup.trim() && <div className="lookup-results">{members.filter(m=>String(m.document||'').toLowerCase().includes(attendanceLookup.toLowerCase())||String(m.full_name||'').toLowerCase().includes(attendanceLookup.toLowerCase())).slice(0,6).map(m=><button key={m.id} disabled={busy} onClick={()=>void registerMemberEntry(m)}><span><strong>{m.full_name}</strong><small>{documentTypeLabel(m.document_type)} · {m.document} · {m.end_date && m.end_date >= today() && m.status==='active'?'Tarifa vigente':'Revisar tarifa'}</small></span><b>Registrar entrada</b></button>)}{!members.some(m=>String(m.document||'').toLowerCase().includes(attendanceLookup.toLowerCase())||String(m.full_name||'').toLowerCase().includes(attendanceLookup.toLowerCase()))&&<p>No encontramos ese cliente. Regístralo desde Clientes.</p>}</div>}</div>
        <div className="desk-search"><label><Users size={15}/> Buscar / gestionar cliente</label><input value={memberLookup} onChange={e=>setMemberLookup(e.target.value)} placeholder="Documento o nombre para abrir su ficha…"/>{memberLookup.trim() && <div className="lookup-results">{members.filter(m=>String(m.document||'').toLowerCase().includes(memberLookup.toLowerCase())||String(m.full_name||'').toLowerCase().includes(memberLookup.toLowerCase())).slice(0,6).map(m=><div className="lookup-member-row" key={m.id}><span><strong>{m.full_name}</strong><small>{documentTypeLabel(m.document_type)} · {m.document} · {m.paused_at?'Pausado':m.end_date && m.end_date < today()?'Vencido':'Activo'}</small></span><div><button onClick={()=>{setSection('Miembros');setMemberLookup('');setSearch('');setEditing(m);const initial:Record<string,string>={};configFor('Miembros',rows)?.fields.forEach(f=>initial[f.key]=m[f.key]==null?'':String(m[f.key]));setForm(initial);setDialog('record')}}>Abrir ficha</button><button onClick={()=>{setMemberLookup('');openMemberPayment(m)}}>Pago</button><button onClick={()=>{setMemberLookup('');void toggleMemberPause(m)}}>{m.paused_at?'Reactivar':'Pausar'}</button></div></div>)}</div>}</div>
        <div className="desk-shortcuts"><button onClick={()=>{setSection('Miembros');setEditing(null);const fields=configFor('Miembros',rows)?.fields||[];const blank:Record<string,string>={};fields.forEach(field=>blank[field.key]='');setForm(blank);setDialog('record')}}><Plus size={15}/> Nuevo cliente</button><button onClick={()=>openSpecial('payment')}><CircleDollarSign size={15}/> Registrar pago</button><button onClick={()=>handleSection('Tarifas')}><ClipboardList size={15}/> Tarifas</button></div>
      </section>
      {!supabaseConfigured && <div className="local-warning"><AlertTriangle size={16}/><span><strong>Modo local:</strong> la información se guarda solo en este navegador. Configura Supabase y accede con una cuenta antes de registrar datos reales.</span></div>}
      {supabaseConfigured && syncCount > 0 && <div className="sync-warning"><CloudOff size={15}/><span>{syncCount} operación(es) esperando sincronización. No cierres ni borres los datos del navegador hasta recuperar la conexión.</span><button onClick={() => void sync()}>Reintentar</button></div>}
      <div className="page">
        {section === 'Inicio' && (canModule('Inicio','view') ? <Dashboard activeMembers={activeMembers} expiredMembers={expiredMembers} total={members.length} todayIncome={todayIncome} todayAttendances={(rows.attendance || []).filter(a => dateInBogota(a.entered_at) === today()).length} expiring={members.filter(m => m.end_date && m.end_date >= today() && m.end_date <= datePlusDays(today(), 7)).length} stockLow={stockLow} rows={rows} onNavigate={handleSection} /> : <AccessDenied />)}
        {section === 'Caja' && (canModule('Caja','view') ? <CashPage session={activeSession} sessions={rows.cash_sessions || []} movements={rows.cash_movements || []} profiles={rows.profiles || []} canOpen={canModule('Caja','create')} canClose={canModule('Caja','close')} onOpen={() => openSpecial('cash')} onClose={() => openSpecial('cash')} onPrint={printCashReport} /> : <AccessDenied />)}
        {section === 'Informes' && (canModule('Informes','view') ? <Reports rows={rows} /> : <AccessDenied />)}
        {section === 'Configuración' && (isOwner ? <SettingsPage onBackup={backup} onRestore={() => fileRef.current?.click()} onResetDemo={resetDemoData} onSeed={seedDemoData} busy={busy} /> : <AccessDenied />)}
        {section === 'Productos' && (moduleConfig ? <ProductCatalog products={filteredRows} onCreate={openCreate} onEdit={openRecord} canCreate={canModule('Productos','create')} canUpdate={canModule('Productos','update')}/> : <AccessDenied />)}
        {moduleConfig && section !== 'Productos' && <DataModule config={moduleConfig} rows={filteredRows} canCreate={canModule(section,'create')} canUpdate={canModule(section,'update')} canCharge={canModule('Pagos','create')} search={search} setSearch={setSearch} onCreate={openCreate} onEdit={openRecord} onTogglePause={toggleMemberPause} onMemberPayment={openMemberPayment} onCollectBalance={record => { const total=Number(record.total??record.total_amount??record.amount??0); setEditing(record); setForm({ amount_paid: String(Math.max(0,total-Number(record.amount_paid||0))), method: 'cash' }); setDialog('balance') }} memberName={memberName} productName={productName} planName={planName} />}
        {section === 'Usuarios' && (isOwner ? <UsersPage users={rows.profiles || []} onCreate={createStaffUser} onUpdatePermissions={updateStaffPermissions} onToggleActive={toggleStaffActive} acceptances={userAcceptances} permissionHistory={permissionHistory} activeTermsVersion={String(termsRecord?.version||'')} busy={busy} /> : <AccessDenied />)}
        {!moduleConfig && !['Inicio','Caja','Informes','Configuración','Usuarios'].includes(section) && (canModule(section,'view') ? <PlaceholderModule title={section} /> : <AccessDenied />)}
        {section === 'Equipo' && !isOwner && <AccessDenied/>}
        <footer>© 2026 Atlasgymrun <span>Gestión clara para entrenar mejor.</span></footer>
      </div>
    </main>

    {dialog && dialog !== 'cash' && <Modal variant={dialog === 'record' ? 'drawer' : 'center'} title={dialogTitle(dialog, editing)} onClose={() => setDialog(null)}>
      {dialog === 'record' && moduleConfig && <form className="form-grid" onSubmit={submitRecord}>
        {section === 'Productos' && <div className="image-upload-panel full"><div className="product-image-preview">{productImagePreview ? <img src={productImagePreview} alt="Vista previa del producto"/> : <div><ImagePlus size={30}/><span>Imagen del producto</span></div>}</div><label className="image-upload-control"><ImagePlus size={16}/> Elegir imagen<input type="file" accept="image/*" onChange={e=>{const file=e.target.files?.[0];if(file){setProductImageFile(file);setProductImagePreview(URL.createObjectURL(file))}}}/></label><small>La imagen se optimiza automáticamente. Puedes dejarla vacía y añadirla después.</small></div>}
        {section === 'Miembros' && editing && <div className="member-modal-actions full"><button type="button" className="secondary-button" onClick={() => openMemberPayment(editing)}><CircleDollarSign size={15}/> Registrar pago</button><button type="button" className="secondary-button" onClick={() => void toggleMemberPause(editing)}>{editing.paused_at ? <Play size={15}/> : <Pause size={15}/>} {editing.paused_at ? 'Reactivar actividad' : 'Pausar actividad'}</button></div>}
        {moduleConfig.fields.map(field => <FieldInput key={field.key} field={moduleConfig.table === 'products' && editing && field.key === 'stock' ? { ...field, disabled: true } : field} value={form[field.key] || (section === 'Miembros' && field.key === 'document_type' ? 'cedula_ciudadania' : '')} onChange={value => setForm(v => ({ ...v, [field.key]: value }))} />)}
        <div className="form-actions"><button type="button" className="secondary-button" onClick={() => setDialog(null)}>Cancelar</button><button disabled={busy} className="primary-button"><Check size={16}/>{busy ? 'Guardando…' : 'Guardar registro'}</button></div>
      </form>}
      {dialog === 'balance' && editing && <form className="form-grid" onSubmit={submitBalancePayment}><div className="balance-summary full"><strong>{section==='Cuentas por Cobrar Ventas'?'Venta #'+String(editing.id||'').slice(0,8):section==='Cuentas por Pagar Compras'?(editing.supplier||editing.description||'Compra'):memberName(editing.member_id)}</strong><span>Saldo pendiente: {formatMoney(Number(editing.total??editing.total_amount??editing.amount??0)-Number(editing.amount_paid||0))}</span></div><FieldInput field={{ key: 'amount_paid', label: 'Abono recibido (COP)', type: 'number', required: true }} value={form.amount_paid || ''} onChange={v => setForm(f => ({ ...f, amount_paid: v }))}/><FieldInput field={{ key: 'method', label: 'Método de pago', type: 'select', options: methods }} value={form.method || 'cash'} onChange={v => setForm(f => ({ ...f, method: v }))}/><p className="form-hint full">Solo registra transferencias o Nequi después de confirmar el abono en la cuenta. El abono no debe superar el saldo pendiente.</p><FormActions busy={busy} onCancel={() => setDialog(null)}/></form>}
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
    {cashPrintRecord && <CashClosePrint session={cashPrintRecord} movements={rows.cash_movements || []} profiles={rows.profiles || []} />}
    <input ref={fileRef} type="file" accept="application/json" hidden onChange={e => void restore(e.target.files?.[0])}/>
    {toast && <div className="toast"><Check size={16}/>{toast}<button onClick={() => setToast('')}><X size={14}/></button></div>}
  </div>
}

function Login({ onSignIn, onForgotPassword, busy, toast }: { onSignIn: (email: string, password: string) => void; onForgotPassword: (email: string) => void; busy: boolean; toast: string }) {
  const [email,setEmail] = useState(''); const [password,setPassword] = useState('')
  return <div className="auth-screen"><form className="auth-card" onSubmit={e => { e.preventDefault(); onSignIn(email,password) }}><div className="brand-mark"><Dumbbell size={23}/></div><div className="eyebrow">ATLASGYMRUN</div><h1>Bienvenido</h1><p>Ingresa con tu cuenta individual para administrar el gimnasio.</p><label>Correo electrónico<input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="username"/></label><label>Contraseña<input type="password" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password"/></label><button className="primary-button auth-submit" disabled={busy}><LockKeyhole size={16}/>{busy ? 'Ingresando…' : 'Iniciar sesión'}</button><button type="button" className="auth-link" disabled={busy || !email.trim()} onClick={() => onForgotPassword(email)}>Olvidé mi contraseña</button>{toast && <div className="auth-error">{toast}</div>}<small>Las cuentas las crea el propietario desde Supabase Auth. No hay registro público.</small></form></div>
}

function PasswordRecovery({ onSave, busy, toast }: { onSave: (password: string) => void; busy: boolean; toast: string }) {
  const [password,setPassword] = useState(''); const [confirm,setConfirm] = useState('')
  const mismatch = confirm.length > 0 && password !== confirm
  return <div className="auth-screen"><form className="auth-card" onSubmit={e => { e.preventDefault(); if (password.length < 8 || password !== confirm) return; onSave(password) }}><div className="brand-mark"><LockKeyhole size={23}/></div><div className="eyebrow">ATLASGYMRUN · SEGURIDAD</div><h1>Nueva contraseña</h1><p>Elige una contraseña nueva para recuperar el acceso a tu cuenta.</p><label>Nueva contraseña<input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} autoComplete="new-password"/></label><label>Confirmar contraseña<input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required minLength={8} autoComplete="new-password"/></label>{mismatch && <div className="auth-error">Las contraseñas no coinciden.</div>}<button className="primary-button auth-submit" disabled={busy || password.length < 8 || password !== confirm}><LockKeyhole size={16}/>{busy ? 'Guardando…' : 'Guardar nueva contraseña'}</button>{toast && <div className="auth-error">{toast}</div>}<small>Usa al menos 8 caracteres. Al guardar, volverás al inicio de sesión.</small></form></div>
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
    <div className="control-room-heading"><div><div className="eyebrow">CENTRO DE MANDO · ATLASGYMRUN</div><h1>Panel de operaciones</h1><p>{todayLabel} · Estado general del gimnasio</p></div><div className="control-room-status"><span className="live-dot"/> Operación del día</div></div>
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

function DataModule({ config, rows, canCreate, canUpdate, canCharge, search, setSearch, onCreate, onEdit, onTogglePause, onMemberPayment, onCollectBalance, memberName, productName, planName }: { config: ModuleConfig; rows: Row[]; canCreate:boolean; canUpdate:boolean; canCharge:boolean; search:string; setSearch:(v:string)=>void; onCreate:()=>void; onEdit:(row:Row)=>void; onTogglePause:(row:Row)=>void; onMemberPayment:(row:Row)=>void; onCollectBalance:(row:Row)=>void; memberName:(id:unknown)=>string; productName:(id:unknown)=>string; planName:(id:unknown)=>string }) {
  const [layout,setLayout]=useState<'table'|'cards'>('table')
  const [quickFilter,setQuickFilter]=useState('all')
  const [sort,setSort]=useState<{key:string;direction:'asc'|'desc'}>({key:'',direction:'asc'})
  useEffect(()=>{setQuickFilter('all');setSort({key:'',direction:'asc'})},[config.table])

  const valueFor = (row:Row,key:string) => {
    const value = row[key]
    if (key === 'member_id') return memberName(value)
    if (key === 'document_type') return documentTypeLabel(value)
    if (key === 'product_id') return productName(value)
    if (key === 'detail_product_id') return productName(row.details?.product_id)
    if (key.startsWith('detail_')) return row.details?.[key.slice(7)] ?? '—'
    if (key === 'plan_id' || key === 'current_plan_id') return planName(value)
    if (key.includes('amount') || key === 'price' || key === 'cost' || key === 'total') return formatMoney(value)
    if (key.includes('date') || key.endsWith('_at')) return formatDate(value)
    if (key === 'active') return value ? 'Activo' : 'Inactivo'
    if (key === 'status') return row.paused_at ? 'Pausado' : ({ active:'Activo',inactive:'Inactivo',expired:'Vencido',debt:'Con saldo',paid:'Pagado',partial:'Abono parcial',pending:'Pendiente',voided:'Anulado',open:'Abierta',closed:'Cerrada' } as Record<string,string>)[String(value)] || String(value || '—')
    if (key === 'method') return ({cash:'Efectivo',transfer:'Transferencia',nequi:'Nequi',card:'Tarjeta',other:'Otro'} as Record<string,string>)[String(value)] || value
    if (key === 'role') return value === 'owner' ? 'Administrador' : 'Trabajador'
    if (key === 'id') return String(value || '').slice(0,8)
    return value == null || value === '' ? '—' : String(value)
  }

  const canEdit = canUpdate && ['members','gym_records','plans','products'].includes(config.table)
  const showActions = canEdit || (canCharge && config.table === 'members') || (canUpdate && ['payments','sales','purchases'].includes(config.table))
  const filterOptions = config.table === 'members'
    ? [{value:'all',label:'Todos'},{value:'active',label:'Activos'},{value:'expiring',label:'Por vencer'},{value:'expired',label:'Vencidos'},{value:'paused',label:'Pausados'},{value:'inactive',label:'Inactivos'}]
    : config.table === 'payments'
      ? [{value:'all',label:'Todos'},{value:'pending',label:'Con saldo'},{value:'paid',label:'Pagados'}]
      : config.table === 'plans'
        ? [{value:'all',label:'Todas'},{value:'active',label:'Activas'},{value:'inactive',label:'Inactivas'}]
        : []

  const memberIsActive = (row:Row) => row.status === 'active' && !row.paused_at && (!row.end_date || String(row.end_date) >= today())
  const visibleRows = rows.filter(row => {
    if (quickFilter === 'all') return true
    if (quickFilter === 'paused') return Boolean(row.paused_at)
    if (quickFilter === 'active') return config.table === 'members' ? memberIsActive(row) : row.status === 'active' || row.active === true
    if (quickFilter === 'expiring') return config.table === 'members' && memberIsActive(row) && Boolean(row.end_date) && String(row.end_date) <= datePlusDays(today(), 7)
    if (quickFilter === 'expired') return config.table === 'members' && !row.paused_at && Boolean(row.end_date) && String(row.end_date) < today()
    if (quickFilter === 'inactive') return !row.paused_at && (row.status === 'inactive' || row.active === false)
    if (quickFilter === 'pending') return Number(row.total ?? row.total_amount ?? row.amount ?? 0) > Number(row.amount_paid || 0) && row.status !== 'voided'
    if (quickFilter === 'paid') return row.status === 'paid' || Number(row.amount || 0) <= Number(row.amount_paid || 0)
    return true
  })

  const orderedRows = sort.key ? [...visibleRows].sort((a,b) => {
    const left = a[sort.key], right = b[sort.key]
    let result = 0
    if (sort.key.includes('date') || sort.key.endsWith('_at')) {
      const leftTime = left ? new Date(String(left)).getTime() : 0
      const rightTime = right ? new Date(String(right)).getTime() : 0
      result = leftTime - rightTime
    } else if (['amount','amount_paid','price','cost','total','total_amount','stock','min_stock','duration_days','ticket_quantity'].includes(sort.key)) {
      result = Number(left || 0) - Number(right || 0)
    } else {
      result = String(valueFor(a,sort.key) ?? '').localeCompare(String(valueFor(b,sort.key) ?? ''),'es',{numeric:true,sensitivity:'base'})
    }
    return sort.direction === 'asc' ? result : -result
  }) : visibleRows

  const toggleSort = (key:string) => setSort(current => ({key,direction:current.key===key && current.direction==='asc'?'desc':'asc'}))
  const actionsFor = (row:Row) => <>{canEdit && <button className="table-action" onClick={()=>onEdit(row)} title="Editar registro"><Pencil size={14}/></button>}{config.table==='members' && <>{canCharge && <button className="table-action" onClick={()=>onMemberPayment(row)} title="Registrar pago"><CircleDollarSign size={14}/></button>}{canUpdate && <button className="table-action" onClick={()=>onTogglePause(row)} title={row.paused_at?'Reactivar actividad':'Pausar actividad'}>{row.paused_at?<Play size={14}/>:<Pause size={14}/>}</button>}</>}{canUpdate && ['payments','sales','purchases'].includes(config.table) && Number(row[config.table==='sales'?'total':config.table==='purchases'?'total_amount':'amount']||0)>Number(row.amount_paid||0) && row.status!=='voided' && <button className="table-action" onClick={()=>onCollectBalance(row)} title="Registrar abono">Abonar</button>}</>

  return <><div className="module-heading"><div><div className="eyebrow">GESTIÓN</div><h1>{config.title}</h1><p>{config.description}</p></div>{canCreate && config.fields.length > 0 && config.title !== 'Congelar pagos' && <button className="primary-button" onClick={onCreate}><Plus size={16}/> Nuevo registro</button>}{canCreate && config.table === 'day_passes' && <button className="primary-button" onClick={onCreate}><Plus size={16}/> Nuevo pase</button>}{canCreate && config.table === 'payments' && config.title !== 'Cuentas por cobrar pagos' && <button className="primary-button" onClick={onCreate}><Plus size={16}/> Registrar pago</button>}{canCreate && config.table === 'sales' && config.title !== 'Cuentas por cobrar de ventas' && <button className="primary-button" onClick={onCreate}><Plus size={16}/> Nueva venta</button>}{canCreate && config.table === 'purchases' && config.title !== 'Cuentas por pagar de compras' && <button className="primary-button" onClick={onCreate}><Plus size={16}/> Registrar compra</button>}{canCreate && config.table === 'expenses' && <button className="primary-button" onClick={onCreate}><Plus size={16}/> Registrar gasto</button>}</div>
    <section className="panel data-panel admin-data-panel">
      <div className="admin-data-toolbar">
        <div className="admin-data-summary"><strong>{orderedRows.length}</strong><span>de {rows.length} registro(s)</span></div>
        <label className="search-box"><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar por nombre, documento, valor…"/></label>
        {search.trim() && <button type="button" className="admin-clear-search" onClick={()=>setSearch('')}><X size={14}/> Limpiar</button>}
        <div className="admin-view-switch" aria-label="Tipo de vista"><button type="button" className={layout==='table'?'selected':''} onClick={()=>setLayout('table')}>Tabla</button><button type="button" className={layout==='cards'?'selected':''} onClick={()=>setLayout('cards')}>Tarjetas</button></div>
      </div>
      {filterOptions.length>0 && <div className="admin-quick-filters">{filterOptions.map(option=><button type="button" key={option.value} className={quickFilter===option.value?'selected':''} onClick={()=>setQuickFilter(option.value)}>{option.label}</button>)}</div>}
      {orderedRows.length ? layout==='table' ? <div className="table-wrap"><table><thead><tr>{config.columns.map(c=><th key={c.key} aria-sort={sort.key===c.key?(sort.direction==='asc'?'ascending':'descending'):'none'}><button type="button" className="table-sort-button" onClick={()=>toggleSort(c.key)}>{c.label}<span>{sort.key===c.key?(sort.direction==='asc'?'↑':'↓'):'↕'}</span></button></th>)}{showActions && <th>Acciones</th>}</tr></thead><tbody>{orderedRows.map(row=><tr key={row.id}>{config.columns.map(c=><td key={c.key}>{valueFor(row,c.key)}</td>)}{showActions && <td className="action-cell">{actionsFor(row)}</td>}</tr>)}</tbody></table></div> : <div className="admin-record-grid">{orderedRows.map(row=><article className="admin-record-card" key={row.id}><div className="admin-record-card-heading"><strong>{valueFor(row,config.columns[0]?.key || 'id')}</strong>{config.columns[1]&&<small>{config.columns[1].label}: {valueFor(row,config.columns[1].key)}</small>}</div><dl>{config.columns.slice(2).map(column=><div key={column.key}><dt>{column.label}</dt><dd>{valueFor(row,column.key)}</dd></div>)}</dl>{showActions&&<div className="admin-record-actions">{actionsFor(row)}</div>}</article>)}</div> : <Empty text={search || quickFilter!=='all' ? 'No hay registros que coincidan con estos filtros.' : 'Todavía no hay registros en este módulo.'}/>}
    </section>
    {config.table==='products' && <div className="module-footnote"><AlertTriangle size={14}/> Los ajustes directos de existencias deben justificarse. Próxima mejora: pantalla dedicada para ajustes auditados.</div>}
  </>
}
function CashPage({ session, sessions, movements, profiles, canOpen, canClose, onOpen, onClose, onPrint }: { session?:Row; sessions:Row[]; movements:Row[]; profiles:Row[]; canOpen:boolean; canClose:boolean; onOpen:()=>void; onClose:()=>void; onPrint:(row:Row)=>void }) {
  const currentMovements = session ? movements.filter(m=>m.cash_session_id===session.id) : []
  const cashIncome = currentMovements.filter(m=>m.method==='cash'&&m.direction==='income').reduce((s,m)=>s+Number(m.amount),0)
  const cashExpense = currentMovements.filter(m=>m.method==='cash'&&m.direction==='expense').reduce((s,m)=>s+Number(m.amount),0)
  const expected = Number(session?.initial_cash || 0) + cashIncome - cashExpense
  const profileName = (id:unknown) => profiles.find(p=>p.id===id)?.full_name || 'Usuario'
  const closedSessions = sessions.filter(s=>s.status==='closed').sort((a,b)=>String(b.closed_at||'').localeCompare(String(a.closed_at||'')))
  return <><div className="module-heading"><div><div className="eyebrow">CONTROL FINANCIERO</div><h1>Caja</h1><p>Apertura, movimientos y cierre con diferencia de efectivo.</p></div>{session ? (canClose ? <button className="primary-button" onClick={onClose}>Cerrar caja</button> : <span className="users-state">Caja abierta · sin permiso de cierre</span>) : (canOpen ? <button className="primary-button" onClick={onOpen}><Plus size={16}/> Abrir caja</button> : null)}</div>
    <div className="stats-grid cash-stats"><Stat icon={<Wallet/>} label="Estado de caja" value={session?'Abierta':'Cerrada'} change={session?formatDate(session.opened_at):'Sin sesión activa'} tint="green"/><Stat icon={<CircleDollarSign/>} label="Base inicial" value={formatMoney(session?.initial_cash)} change="Efectivo de apertura" tint="blue"/><Stat icon={<ArrowUpRight/>} label="Ingresos en efectivo" value={formatMoney(cashIncome)} change="Solo dinero recibido" tint="yellow"/><Stat icon={<ArrowDownRight/>} label="Efectivo esperado" value={formatMoney(expected)} change="Base + ingresos − egresos" tint="purple"/></div>
    <section className="panel data-panel"><div className="panel-heading"><div><h2>Movimientos de esta caja</h2><p>Otros métodos de pago se muestran en registros, pero no suman al efectivo.</p></div></div>{currentMovements.length ? <div className="table-wrap"><table><thead><tr><th>Tipo</th><th>Descripción</th><th>Método</th><th>Valor</th><th>Fecha</th></tr></thead><tbody>{currentMovements.map(m=><tr key={m.id}><td>{m.direction==='income'?'Ingreso':'Salida'}</td><td>{m.description}</td><td>{m.method}</td><td>{formatMoney(m.amount)}</td><td>{formatDate(m.created_at)}</td></tr>)}</tbody></table></div> : <Empty text="Sin movimientos vinculados a la caja abierta."/ >}</section>
    <section className="panel data-panel"><div className="panel-heading"><div><h2>Cierres anteriores</h2><p>Descarga el comprobante completo de cada cierre en PDF.</p></div></div>{closedSessions.length ? <div className="table-wrap"><table><thead><tr><th>Apertura</th><th>Cierre</th><th>Responsable</th><th>Esperado</th><th>Contado</th><th>Diferencia</th><th>PDF</th></tr></thead><tbody>{closedSessions.map(s=><tr key={s.id}><td>{formatDate(s.opened_at)}</td><td>{formatDate(s.closed_at)}</td><td>{profileName(s.closed_by || s.opened_by)}</td><td>{formatMoney(s.expected_cash)}</td><td>{formatMoney(s.counted_cash)}</td><td className={Number(s.difference)===0?'cash-difference-ok':'cash-difference-alert'}>{formatMoney(s.difference)}</td><td><button className="table-action cash-print-button" title="Imprimir o guardar cierre en PDF" onClick={()=>onPrint(s)}><Printer size={15}/></button></td></tr>)}</tbody></table></div>:<Empty text="Aún no hay cierres guardados."/ >}</section>
  </>
}

function CashClosePrint({ session, movements, profiles }: { session:Row; movements:Row[]; profiles:Row[] }) {
  const entries = movements.filter(m=>m.cash_session_id===session.id).sort((a,b)=>String(a.created_at||'').localeCompare(String(b.created_at||'')))
  const cash = entries.filter(m=>m.method==='cash')
  const other = entries.filter(m=>m.method!=='cash')
  const sum = (items:Row[],direction:string) => items.filter(m=>m.direction===direction).reduce((total,m)=>total+Number(m.amount||0),0)
  const cashIncome=sum(cash,'income'), cashExpense=sum(cash,'expense')
  const otherIncome=sum(other,'income'), otherExpense=sum(other,'expense')
  const name=(id:unknown)=>profiles.find(p=>p.id===id)?.full_name || 'Usuario'
  const method=(value:unknown)=>({cash:'Efectivo',transfer:'Transferencia',nequi:'Nequi',card:'Tarjeta / datáfono',other:'Otro'} as Record<string,string>)[String(value)]||String(value||'—')
  return <article className="cash-print-document">
    <header className="cash-print-header"><div className="cash-print-brand"><span className="cash-print-mark">A</span><div><strong>ATLASGYMRUN</strong><small>GESTIÓN DE GIMNASIO</small></div></div><div className="cash-print-title"><h1>Comprobante de cierre de caja</h1><p>Documento interno · No reemplaza comprobantes bancarios ni fiscales</p></div></header>
    <div className="cash-print-meta"><div><small>Fecha de apertura</small><strong>{formatDate(session.opened_at)} · {new Date(String(session.opened_at)).toLocaleTimeString('es-CO',{timeZone:'America/Bogota',hour:'2-digit',minute:'2-digit'})}</strong></div><div><small>Fecha de cierre</small><strong>{formatDate(session.closed_at)} · {session.closed_at?new Date(String(session.closed_at)).toLocaleTimeString('es-CO',{timeZone:'America/Bogota',hour:'2-digit',minute:'2-digit'}):'—'}</strong></div><div><small>Abrió la caja</small><strong>{name(session.opened_by)}</strong></div><div><small>Cerró la caja</small><strong>{name(session.closed_by || session.opened_by)}</strong></div></div>
    <section className="cash-print-summary"><div><small>Base inicial</small><strong>{formatMoney(session.initial_cash)}</strong></div><div><small>Ingresos efectivo</small><strong>{formatMoney(cashIncome)}</strong></div><div><small>Egresos efectivo</small><strong>{formatMoney(cashExpense)}</strong></div><div><small>Efectivo esperado</small><strong>{formatMoney(session.expected_cash)}</strong></div><div><small>Efectivo contado</small><strong>{formatMoney(session.counted_cash)}</strong></div><div className={Number(session.difference)===0?'neutral':'difference'}><small>Diferencia</small><strong>{formatMoney(session.difference)}</strong></div></section>
    <section className="cash-print-other"><h2>Movimientos por medios no efectivo</h2><div><span>Ingresos no efectivo</span><strong>{formatMoney(otherIncome)}</strong></div><div><span>Egresos no efectivo</span><strong>{formatMoney(otherExpense)}</strong></div></section>
    <h2 className="cash-print-section-title">Detalle de movimientos ({entries.length})</h2>
    {entries.length ? <table className="cash-print-table"><thead><tr><th>Fecha y hora</th><th>Tipo</th><th>Concepto</th><th>Medio</th><th>Valor</th></tr></thead><tbody>{entries.map(m=><tr key={m.id}><td>{new Date(String(m.created_at)).toLocaleString('es-CO',{timeZone:'America/Bogota'})}</td><td>{m.direction==='income'?'Ingreso':'Egreso'}</td><td>{m.description||'—'}</td><td>{method(m.method)}</td><td>{formatMoney(m.amount)}</td></tr>)}</tbody></table> : <p className="cash-print-empty">No se registraron movimientos durante esta sesión.</p>}
    {session.notes && <div className="cash-print-notes"><strong>Observaciones de apertura:</strong> {session.notes}</div>}
    <footer className="cash-print-footer"><span>Atlasgymrun · Reporte generado {new Date().toLocaleString('es-CO',{timeZone:'America/Bogota'})}</span><span>Conservar junto con el arqueo físico de caja.</span></footer>
  </article>
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

function SettingsPage({ onBackup, onRestore, onResetDemo, onSeed, busy }: { onBackup:()=>void; onRestore:()=>void; onResetDemo:()=>void; onSeed:()=>void; busy:boolean }) {
  return <><div className="module-heading"><div><div className="eyebrow">SISTEMA</div><h1>Configuración</h1><p>Respaldo, continuidad y entorno de pruebas.</p></div></div><div className="content-grid"><section className="panel setting-card"><div className="setting-icon"><FileDown/></div><h2>Respaldo local</h2><p>Descarga un archivo JSON con los datos guardados en este navegador. El respaldo puede contener información personal; protégelo.</p><button className="primary-button" onClick={onBackup}><Download size={16}/> Exportar respaldo</button></section><section className="panel setting-card"><div className="setting-icon"><FileUp/></div><h2>Restaurar respaldo</h2><p>Importa un respaldo previamente exportado en el dispositivo actual. Los registros se agregan o actualizan.</p><button className="secondary-button" onClick={onRestore}><FileUp size={16}/> Seleccionar archivo</button></section></div><section className="panel setting-card"><div className="setting-icon"><Activity/></div><h2>Modo de demostración</h2><p>Carga registros ficticios para probar miembros, pagos, asistencias, productos, ventas, compras, gastos e informes. Quedan identificados como DEMO y pueden limpiarse sin tocar los datos reales.</p><button className="primary-button" disabled={busy} onClick={onSeed}><Plus size={16}/> {busy?"Procesando…":"Cargar datos de demostración"}</button><button className="secondary-button" disabled={busy} onClick={onResetDemo}>Limpiar datos DEMO</button></section><section className="panel security-panel"><Shield/><div><h2>Seguridad y acceso</h2><p>Las cuentas son individuales. Los administradores invitan usuarios desde el módulo Usuarios y asignan el nivel Administrador o Trabajador. No compartas contraseñas ni claves secretas.</p></div></section></>
}
function AccessDenied(){return <div className="panel access-denied"><Shield size={25}/><h2>No tienes permiso para este apartado</h2><p>El administrador puede habilitar la consulta o las acciones necesarias desde Usuarios y permisos.</p></div>}

function AccountHold({message,onSignOut}:{message:string;onSignOut:()=>void}) {
 return <div className="auth-screen"><section className="auth-card"><div className="brand-mark"><Shield/></div><div className="eyebrow">ATLASGYMRUN · ACCESO</div><h1>No se pudo validar tu cuenta</h1><p>{message}</p><button className="primary-button auth-submit" onClick={onSignOut}>Cerrar sesión</button></section></div>;
}
function AccountDisabled({onSignOut}:{onSignOut:()=>void}) {
 return <div className="auth-screen"><section className="auth-card"><div className="brand-mark"><Shield/></div><div className="eyebrow">ATLASGYMRUN · ACCESO</div><h1>Cuenta desactivada</h1><p>El administrador desactivó este acceso. Ponte en contacto con el responsable del gimnasio si consideras que se trata de un error.</p><button className="primary-button auth-submit" onClick={onSignOut}>Cerrar sesión</button></section></div>;
}
function TermsAcceptance({terms,profile,onAccept,busy,error}:{terms:Row;profile:Row;onAccept:()=>void;busy:boolean;error:string}) {
 const [checked,setChecked]=useState(false);
 const role=profile.role==='owner'?'Administrador':'Trabajador';
 const allowed=permissionGroups.map(group=>({...group,modules:group.modules.filter(module=>module.actions.some(action=>profile.role==='owner'||profile.permissions?.[module.key]?.[action]===true))})).filter(group=>group.modules.length);
 return <div className="terms-screen"><section className="terms-card">
   <div className="brand"><div className="brand-mark"><Dumbbell size={21}/></div><div><strong>ATLAS<span>GYMRUN</span></strong><small>GESTIÓN DE GIMNASIO</small></div></div>
   <div className="eyebrow">PRIMER ACCESO · ACEPTACIÓN DIGITAL</div><h1>{terms.title||'Términos y condiciones de uso'}</h1>
   <p className="terms-intro">Antes de entrar, revisa las condiciones de uso y los permisos que el administrador asignó a tu cuenta.</p>
   <div className="terms-version">Versión {terms.version} · Perfil: {role}</div>
   <div className="terms-body">{String(terms.body||'').split('\n').map((line,index)=><p key={index}>{line||' '}</p>)}</div>
   <section className="terms-permissions"><h2>Permisos de esta cuenta</h2>
     {profile.role==='owner'?<p>Tu cuenta de administrador tiene acceso completo a todos los apartados y acciones.</p>:allowed.length?allowed.map(group=><div key={group.title}><strong>{group.title}</strong><ul>{group.modules.map(module=><li key={module.key}>{module.label}: {module.actions.filter(action=>profile.permissions?.[module.key]?.[action]===true).map(action=>actionLabels[action]).join(', ')}</li>)}</ul></div>):<p>Tu cuenta no tiene módulos habilitados. El administrador debe asignar permisos antes de que puedas trabajar.</p>}
   </section>
   <label className="terms-check"><input type="checkbox" checked={checked} onChange={event=>setChecked(event.target.checked)}/><span>He leído y acepto estos términos y el alcance de los permisos mostrados para mi cuenta.</span></label>
   {error&&<div className="auth-error">{error}</div>}
   <button className="primary-button auth-submit" disabled={!checked||busy} onClick={onAccept}>{busy?'Guardando aceptación…':'Aceptar y continuar'}</button>
   <small>La aceptación queda asociada a tu usuario, la versión mostrada y la fecha registrada por el servidor.</small>
 </section></div>;
}
function PermissionMatrix({value,onChange}:{value:Record<string,Record<string,boolean>>;onChange:(next:Record<string,Record<string,boolean>>)=>void}) {
  function setPermission(moduleKey:string,action:string,enabled:boolean) {
    const current={...(value[moduleKey]||{})};
    if (action==='view' && !enabled) {
      for (const key of Object.keys(current)) current[key]=false;
      current.view=false;
    } else {
      current[action]=enabled;
      if (enabled && action!=='view') current.view=true;
    }
    onChange({...value,[moduleKey]:current});
  }
  return <div className="permission-matrix">
    {permissionGroups.map(group=><section className="permission-group" key={group.title}>
      <h3>{group.title}</h3>
      {group.modules.map(module=><div className="permission-row" key={module.key}>
        <strong>{module.label}</strong>
        <div>{module.actions.map(action=><label key={action}>
          <input type="checkbox" checked={value[module.key]?.[action]===true} onChange={event=>setPermission(module.key,action,event.target.checked)}/>
          <span>{actionLabels[action]||action}</span>
        </label>)}</div>
      </div>)}
    </section>)}
  </div>;
}

function UsersPage({ users,onCreate,busy,onUpdatePermissions,onToggleActive,acceptances,permissionHistory,activeTermsVersion }: {
  users:Row[];
  onCreate:(payload:{full_name:string;email:string;role:'owner'|'cashier';permissions:Record<string,Record<string,boolean>>})=>Promise<void>;
  busy:boolean;
  onUpdatePermissions:(id:string,permissions:Record<string,Record<string,boolean>>,permissionsVersion:number)=>Promise<void>;
  onToggleActive:(user:Row)=>Promise<void>;
  acceptances:Row[];
  permissionHistory:Row[];
  activeTermsVersion:string;
}) {
  const [fullName,setFullName]=useState('');
  const [email,setEmail]=useState('');
  const [role,setRole]=useState<'owner'|'cashier'>('cashier');
  const [permissions,setPermissions]=useState<Record<string,Record<string,boolean>>>(()=>JSON.parse(JSON.stringify(defaultCashierPermissions)));
  const [selectedUser,setSelectedUser]=useState<Row|null>(null);
  const [historyUser,setHistoryUser]=useState<Row|null>(null);
  const [editPermissions,setEditPermissions]=useState<Record<string,Record<string,boolean>>>({});
  const [feedback,setFeedback]=useState('');
  const [error,setError]=useState(false);
  async function submit(event:FormEvent) {
    event.preventDefault();setFeedback('');setError(false);
    try {
      await onCreate({full_name:fullName.trim(),email:email.trim(),role,permissions:role==='owner'?{}:permissions});
      setFeedback('Invitación creada. La persona debe abrir el correo, activar la cuenta y aceptar los términos.');
      setFullName('');setEmail('');setRole('cashier');setPermissions(JSON.parse(JSON.stringify(defaultCashierPermissions)));
    } catch(err) {
      setError(true);setFeedback(err instanceof Error?err.message:'No se pudo crear la cuenta.');
    }
  }
  async function savePermissions() {
    if(!selectedUser)return;
    try {
      await onUpdatePermissions(selectedUser.id,editPermissions,Number(selectedUser.permissions_version||1));
      setSelectedUser(null);
      setFeedback('Permisos actualizados correctamente.');
    } catch(err) {
      setError(true);setFeedback(err instanceof Error?err.message:'No se pudieron actualizar los permisos.');
    }
  }
  async function changeActive(user:Row) {
    try { await onToggleActive(user); }
    catch(err) { setError(true);setFeedback(err instanceof Error?err.message:'No se pudo cambiar el estado.'); }
  }
  const roleLabel=(value:unknown)=>value==='owner'?'Administrador':'Trabajador';
  const acceptanceByUser=new Map<string,Row>();
  for (const item of acceptances) if (!acceptanceByUser.has(String(item.user_id))) acceptanceByUser.set(String(item.user_id),item);
  return <>
    <div className="module-heading"><div><div className="eyebrow">ADMINISTRACIÓN DE ACCESOS</div><h1>Usuarios y permisos</h1><p>Invita personas, asigna el acceso exacto y consulta quién aceptó las condiciones.</p></div></div>
    <div className="users-layout">
      <section className="panel users-create-panel">
        <div className="panel-heading"><div><h2><UserPlus size={17}/> Invitar usuario</h2><p>La invitación se envía por Supabase Auth. Después de activar su cuenta, verá sus términos y permisos antes de entrar.</p></div></div>
        <form className="users-create-form" onSubmit={submit}>
          <label>Nombre completo<input value={fullName} onChange={e=>setFullName(e.target.value)} required minLength={2} maxLength={100} placeholder="Nombre de la persona"/></label>
          <label>Correo electrónico<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required maxLength={254} placeholder="persona@correo.com"/></label>
          <label>Nivel de acceso<select value={role} onChange={e=>{const next=e.target.value as 'owner'|'cashier';setRole(next);if(next==='cashier')setPermissions(JSON.parse(JSON.stringify(defaultCashierPermissions)));}}>
            <option value="cashier">Trabajador · permisos personalizados</option><option value="owner">Administrador · acceso completo</option>
          </select></label>
          {role==='owner' ? <div className="users-role-help"><Shield size={16}/><span>El administrador tiene acceso completo a todos los módulos y puede gestionar usuarios, permisos y configuración.</span></div> :
            <details className="permission-details" open><summary>Configurar permisos del trabajador</summary><p>Los permisos marcados se mostrarán en el menú y se validarán también en la base de datos. No existe permiso para borrar movimientos financieros.</p><PermissionMatrix value={permissions} onChange={setPermissions}/></details>}
          <button className="primary-button" disabled={busy}><Mail size={16}/>{busy?'Enviando invitación…':'Enviar invitación'}</button>
          {feedback&&<p className={error?'users-feedback error':'users-feedback'}>{feedback}</p>}
        </form>
      </section>
      <section className="panel users-list-panel">
        <div className="panel-heading"><div><h2>Personal registrado</h2><p>{users.length} cuenta(s) con perfil</p></div></div>
        {users.length?<div className="users-list">{users.map(user=>{
          const acceptance=acceptanceByUser.get(user.id);
          return <div className="users-list-row users-list-row-expanded" key={user.id}>
            <div className="users-avatar">{String(user.full_name||'U').slice(0,1).toUpperCase()}</div>
            <div className="users-info"><strong>{user.full_name||'Usuario'}</strong><small>{user.email||user.id}</small><small>{acceptance && acceptance.terms_version===activeTermsVersion && Number(acceptance.permissions_version||1)===Number(user.permissions_version||1) ? 'Aceptó '+acceptance.terms_version+' · '+formatDate(acceptance.accepted_at) : 'Debe aceptar términos/permisos vigentes'}</small></div>
            <span className={user.role==='owner'?'users-role admin':'users-role worker'}>{roleLabel(user.role)}</span>
            <span className={user.active===false?'users-state inactive':'users-state'}>{user.active===false?'Desactivado':'Activo'}</span>
            {user.role!=='owner'&&<div className="users-row-actions">
              <button type="button" className="secondary-button" onClick={()=>{setSelectedUser(user);setEditPermissions(JSON.parse(JSON.stringify(user.permissions||{})));}}>Permisos</button>
              <button type="button" className="secondary-button" onClick={()=>setHistoryUser(user)}>Historial</button>
              <button type="button" className="secondary-button" onClick={()=>void changeActive(user)}>{user.active===false?'Reactivar':'Desactivar'}</button>
            </div>}
          </div>;
        })}</div>:<Empty text="Todavía no hay usuarios registrados."/>}
      </section>
    </div>
    {historyUser&&<section className="panel permission-edit-panel">
      <div className="panel-heading"><div><h2>Historial de permisos · {historyUser.full_name}</h2><p>Registro de versiones anteriores y nuevas de los permisos asignados.</p></div><button type="button" className="secondary-button" onClick={()=>setHistoryUser(null)}>Cerrar</button></div>
      {permissionHistory.filter(item=>item.user_id===historyUser.id).length ? <div className="table-wrap"><table><thead><tr><th>Fecha</th><th>Versión</th><th>Permisos antes</th><th>Permisos después</th></tr></thead><tbody>
        {permissionHistory.filter(item=>item.user_id===historyUser.id).map((item,index)=>{
          const count=(value:unknown)=>Object.values((value||{}) as Record<string,Record<string,boolean>>).reduce((sum,actions)=>sum+Object.values(actions||{}).filter(Boolean).length,0);
          return <tr key={String(item.permissions_version||index)}><td>{formatDate(item.changed_at)}</td><td>{item.permissions_version}</td><td>{count(item.previous_permissions)} acción(es)</td><td>{count(item.new_permissions)} acción(es)</td></tr>;
        })}
      </tbody></table></div> : <Empty text="Aún no hay cambios de permisos registrados para esta cuenta."/>}
    </section>}
    {selectedUser&&<section className="panel permission-edit-panel">
      <div className="panel-heading"><div><h2>Permisos de {selectedUser.full_name}</h2><p>Los cambios se guardan en el perfil y se aplican a las próximas consultas y operaciones.</p></div><button type="button" className="secondary-button" onClick={()=>setSelectedUser(null)}>Cerrar</button></div>
      <PermissionMatrix value={editPermissions} onChange={setEditPermissions}/>
      <div className="form-actions"><button type="button" className="secondary-button" onClick={()=>setSelectedUser(null)}>Cancelar</button><button type="button" className="primary-button" disabled={busy} onClick={()=>void savePermissions()}>{busy?'Guardando…':'Guardar permisos'}</button></div>
    </section>}
  </>;
}
function Stat({icon,label,value,change,tint}:{icon:ReactNode;label:string;value:string;change:string;tint:string}){return <div className="stat-card"><div className={`stat-icon ${tint}`}>{icon}</div><span className="stat-label">{label}</span><strong className="stat-value">{value}</strong><small className="neutral">{change}</small></div>}
function Quick({icon,label,onClick}:{icon:ReactNode;label:string;onClick:()=>void}){return <button className="quick-action" onClick={onClick}><span>{icon}</span><strong>{label}</strong><ArrowUpRight size={15}/></button>}
function Empty({text}:{text:string}){return <div className="empty-state"><ClipboardList size={24}/><p>{text}</p></div>}
function Modal({title,children,onClose,variant='center'}:{title:string;children:ReactNode;onClose:()=>void;variant?:'center'|'drawer'}){const drawer=variant==='drawer';return <div className={drawer?'modal-backdrop modal-drawer-backdrop':'modal-backdrop'} onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><section className={drawer?'modal modal-drawer':'modal'}><div className="modal-heading"><h2>{title}</h2><button onClick={onClose} aria-label="Cerrar"><X size={18}/></button></div>{children}</section></div>}
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
function ProductCatalog({products,onCreate,onEdit,canCreate,canUpdate}:{products:Row[];onCreate:()=>void;onEdit:(p:Row)=>void;canCreate:boolean;canUpdate:boolean}) {
 const [category,setCategory]=useState('Todas');const [query,setQuery]=useState('')
 const categories=['Todas',...Array.from(new Set(products.map(p=>String(p.category||'Otros')))).sort()]
 const shown=products.filter(p=>(category==='Todas'||String(p.category||'Otros')===category)&&JSON.stringify(p).toLowerCase().includes(query.toLowerCase()))
 return <><div className="module-heading product-heading"><div><div className="eyebrow">INVENTARIO VISUAL</div><h1>Catálogo de productos</h1><p>Organiza por categorías, imágenes, precios y existencias.</p></div>{canCreate && <button className="primary-button" onClick={onCreate}><Plus size={16}/> Añadir producto</button>}</div><div className="product-shelf-toolbar"><div className="pos-categories">{categories.map(cat=><button type="button" className={category===cat?'selected':''} key={cat} onClick={()=>setCategory(cat)}>{cat}</button>)}</div><label className="pos-catalog-search"><Search size={15}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar producto o código…"/></label></div><div className="product-shelf-grid">{shown.map(p=><button className="shelf-product-card" key={p.id} disabled={!canUpdate} onClick={()=>canUpdate&&onEdit(p)}><div className="shelf-product-image">{p.image_url?<img src={p.image_url} alt={p.name}/>:<div><Package size={30}/><small>Sin imagen</small></div>}<span className="shelf-category">{p.category||'Otros'}</span></div><div className="shelf-product-info"><strong>{p.name}</strong><small>{p.sku||'Sin código'}</small><div><b>{formatMoney(p.price)}</b><span className={Number(p.stock)<=Number(p.min_stock||0)?'low-stock':'stock-ok'}>{p.stock} unidades</span></div></div></button>)}</div>{!shown.length&&<Empty text="No hay productos registrados. Añade el primero para crear el catálogo."/>}</>
}
function LineList({lines,products,onChange}:{lines:{product_id:string;quantity:number}[];products:Row[];onChange:(v:{product_id:string;quantity:number}[])=>void}) {
 return <div className="cart-lines">{lines.map(line=>{const p=products.find(x=>x.id===line.product_id);const stock=Number(p?.stock||0);return <div className="cart-line" key={line.product_id}><div className="cart-product">{p?.image_url?<img src={p.image_url} alt=""/>:<span className="cart-mini-placeholder"><Package size={15}/></span>}<span><strong>{p?.name||'Producto no disponible'}</strong><small>{p?.category||'Otros'} · Disponible: {stock}</small></span></div><div className="cart-quantity"><button type="button" disabled={line.quantity<=1} onClick={()=>onChange(lines.map(x=>x.product_id===line.product_id?{...x,quantity:Math.max(1,x.quantity-1)}:x))}>−</button><b>{line.quantity}</b><button type="button" disabled={line.quantity>=stock} onClick={()=>onChange(lines.map(x=>x.product_id===line.product_id?{...x,quantity:Math.min(stock,x.quantity+1)}:x))}>+</button></div><strong className="cart-line-total">{formatMoney(Number(p?.price||0)*line.quantity)}</strong><button className="cart-remove" type="button" aria-label="Quitar producto" onClick={()=>onChange(lines.filter(x=>x.product_id!==line.product_id))}><X size={14}/></button></div>})}{!lines.length&&<div className="cart-empty"><ShoppingBag size={25}/><strong>El carrito está esperando productos</strong><small>Toca una tarjeta del catálogo para añadirla.</small></div>}</div>
}
function PurchaseLineList({lines,products,onChange}:{lines:{product_id:string;quantity:number;unit_cost:number}[];products:Row[];onChange:(v:{product_id:string;quantity:number;unit_cost:number}[])=>void}){return <div className="cart-lines">{lines.map((line,i)=>{const p=products.find(x=>x.id===line.product_id);return <div key={i}><span>{p?.name} × {line.quantity} <small>({formatMoney(line.unit_cost)} c/u)</small></span><strong>{formatMoney(line.unit_cost*line.quantity)}</strong><button type="button" onClick={()=>onChange(lines.filter((_,idx)=>idx!==i))}><X size={14}/></button></div>})}{!lines.length&&<small>Aún no hay productos comprados.</small>}</div>}
function dialogTitle(dialog: string, editing: Row|null){if(dialog==='record')return editing?'Editar registro':'Nuevo registro';return ({payment:'Registrar pago / mensualidad',balance:'Cobrar saldo pendiente',daypass:'Registrar pase diario',expense:'Registrar gasto',sale:'Nueva venta',purchase:'Registrar compra',cash:'Control de caja'} as Record<string,string>)[dialog]||'Movimiento'}
