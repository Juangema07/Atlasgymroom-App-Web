import { useState } from 'react'
import {
  Activity, ArrowDownRight, ArrowUpRight, BarChart3, Bell, CalendarDays,
  ChevronDown, CircleDollarSign, ClipboardList, Dumbbell, Home, Menu,
  Package, Plus, Search, Settings, ShoppingBag, Users, Wallet, X
} from 'lucide-react'

type Section = 'Inicio' | 'Miembros' | 'Asistencia' | 'Pase diario' | 'Ventas' | 'Inventario' | 'Caja' | 'Informes'
const navigation: { label: Section; icon: typeof Home }[] = [
  { label: 'Inicio', icon: Home }, { label: 'Miembros', icon: Users },
  { label: 'Asistencia', icon: Activity }, { label: 'Pase diario', icon: CalendarDays },
  { label: 'Ventas', icon: ShoppingBag }, { label: 'Inventario', icon: Package },
  { label: 'Caja', icon: Wallet }, { label: 'Informes', icon: BarChart3 },
]
const activity = [
  { initials: 'CM', name: 'Carlos Martínez', detail: 'Renovación mensual', time: '08:42 a. m.', amount: '$ 85.000', color: 'lime' },
  { initials: 'SP', name: 'Sofía Pérez', detail: 'Pase diario', time: '08:18 a. m.', amount: '$ 4.000', color: 'violet' },
  { initials: 'JR', name: 'Juan Rodríguez', detail: 'Venta · Agua', time: '07:56 a. m.', amount: '$ 2.500', color: 'blue' },
  { initials: 'AL', name: 'Andrea López', detail: 'Renovación mensual', time: '07:31 a. m.', amount: '$ 85.000', color: 'orange' },
]

export default function App() {
  const [section, setSection] = useState<Section>('Inicio')
  const [menuOpen, setMenuOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [notice, setNotice] = useState('')
  const choose = (label: Section) => { setSection(label); setMenuOpen(false); setNotice('') }

  return <div className="app-shell">
    <aside className={`sidebar ${menuOpen ? 'sidebar-open' : ''}`}>
      <div className="brand"><div className="brand-mark"><Dumbbell size={21}/></div><div><strong>ATLAS<span>GYMROOM</span></strong><small>GESTIÓN DE GIMNASIO</small></div><button className="mobile-close" onClick={() => setMenuOpen(false)}><X/></button></div>
      <div className="workspace-label">MENÚ PRINCIPAL</div>
      <nav>{navigation.map(({label, icon: Icon}) => <button key={label} className={section === label ? 'nav-item active' : 'nav-item'} onClick={() => choose(label)}><Icon size={18}/><span>{label}</span>{label === 'Miembros' && <b className="nav-count">128</b>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="help-card"><div className="help-icon"><Dumbbell size={17}/></div><strong>¡A darle con toda!</strong><p>Un día más construyendo hábitos fuertes.</p></div><button className="nav-item"><Settings size={18}/><span>Configuración</span></button><div className="profile"><div className="avatar owner">AG</div><div><strong>Administrador</strong><small>Propietario</small></div><ChevronDown size={16}/></div></div>
    </aside>
    {menuOpen && <button className="scrim" aria-label="Cerrar menú" onClick={() => setMenuOpen(false)}/>}
    <main className="main-content">
      <header className="topbar"><div className="topbar-left"><button className="menu-toggle" onClick={() => setMenuOpen(true)}><Menu/></button><div className="breadcrumb">Atlasgymroom <span>/</span> <strong>{section}</strong></div></div><div className="topbar-actions"><div className="status-pill"><i/> Sistema de prueba</div><button className="icon-button" aria-label="Notificaciones"><Bell size={19}/><em/></button><div className="avatar owner">AG</div></div></header>
      <div className="page">
        {section === 'Inicio' ? <>
          <div className="welcome-row"><div><div className="eyebrow">SÁBADO, 7 DE NOVIEMBRE DE 2026</div><h1>¡Vamos con toda! <span>💪</span></h1><p className="subheading">Este es el resumen de tu gimnasio hoy.</p></div><button className="date-button"><CalendarDays size={16}/> Hoy <ChevronDown size={15}/></button></div>
          <div className="stats-grid">
            <Stat icon={<Users/>} label="Miembros activos" value="128" change="+8 este mes" trend="up" tint="green"/>
            <Stat icon={<Activity/>} label="Asistencias hoy" value="46" change="+12% vs. ayer" trend="up" tint="blue"/>
            <Stat icon={<CircleDollarSign/>} label="Ingresos del día" value="$ 342.000" change="+8,4% vs. ayer" trend="up" tint="yellow"/>
            <Stat icon={<Wallet/>} label="Membresías por vencer" value="12" change="Próximos 7 días" trend="down" tint="purple"/>
          </div>
          <div className="content-grid">
            <section className="panel activity-panel"><div className="panel-heading"><div><h2>Actividad reciente</h2><p>Los últimos movimientos del gimnasio</p></div><button className="text-button" onClick={() => choose('Informes')}>Ver todo <ArrowUpRight size={15}/></button></div><div className="activity-list">{activity.map((item) => <div className="activity-row" key={item.name}><div className={`avatar ${item.color}`}>{item.initials}</div><div className="activity-person"><strong>{item.name}</strong><small>{item.detail}</small></div><div className="activity-time">{item.time}</div><strong className="activity-amount">{item.amount}</strong></div>)}</div></section>
            <section className="panel quick-panel"><div className="panel-heading"><div><h2>Accesos rápidos</h2><p>Lo que más necesitas, a un clic</p></div></div><div className="quick-grid"><Quick icon={<Users/>} label="Nuevo miembro" onClick={() => choose('Miembros')}/><Quick icon={<ClipboardList/>} label="Registrar asistencia" onClick={() => choose('Asistencia')}/><Quick icon={<ShoppingBag/>} label="Nueva venta" onClick={() => choose('Ventas')}/><Quick icon={<CircleDollarSign/>} label="Registrar pago" onClick={() => choose('Caja')}/></div></section>
          </div>
          <section className="panel bottom-panel"><div className="panel-heading"><div><h2>Resumen de operación</h2><p>Indicadores de ejemplo para validar el diseño</p></div><span className="muted-tag">DATOS FICTICIOS</span></div><div className="summary-grid"><div><span>Ingresos del mes</span><strong>$ 4.820.000</strong><small className="positive"><ArrowUpRight size={14}/> 6,2% frente al mes anterior</small></div><div><span>Miembros nuevos</span><strong>18</strong><small className="positive"><ArrowUpRight size={14}/> 4 más que el mes anterior</small></div><div><span>Productos con poco stock</span><strong>3</strong><small className="warning"><ArrowDownRight size={14}/> Requieren revisión</small></div></div></section>
        </> : <section className="module-panel panel"><div className="module-icon"><Dumbbell size={25}/></div><div className="eyebrow">MÓDULO EN CONSTRUCCIÓN</div><h1>{section}</h1><p>Esta sección ya está contemplada en la estructura de Atlasgymroom. Aquí construiremos un flujo rápido y sencillo para el trabajo diario.</p><div className="module-search"><Search size={18}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder={`Buscar en ${section.toLowerCase()}...`}/></div><button className="primary-button" onClick={() => setNotice('La pantalla es una maqueta; todavía no guarda información.')}><Plus size={17}/> Acción de ejemplo</button>{notice && <p className="notice">{notice}</p>}<div className="module-note"><strong>Próximo paso</strong><span>Definir los campos y permisos de este módulo antes de conectarlo a datos reales.</span></div></section>}
        <footer>© 2026 Atlasgymroom <span>Hecho para entrenar mejor.</span></footer>
      </div>
    </main>
  </div>
}
function Stat({icon,label,value,change,trend,tint}:{icon:React.ReactNode;label:string;value:string;change:string;trend:'up'|'down';tint:string}) {
  return <div className="stat-card"><div className={`stat-icon ${tint}`}>{icon}</div><span className="stat-label">{label}</span><strong className="stat-value">{value}</strong><small className={trend === 'up' ? 'positive' : 'neutral'}>{trend === 'up' ? <ArrowUpRight size={14}/> : <CalendarDays size={13}/>} {change}</small></div>
}
function Quick({icon,label,onClick}:{icon:React.ReactNode;label:string;onClick:()=>void}) {
  return <button className="quick-action" onClick={onClick}><span>{icon}</span><strong>{label}</strong><ArrowUpRight size={15}/></button>
}