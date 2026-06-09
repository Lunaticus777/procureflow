import React from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Requisitions from './pages/Requisitions'
import Quotations from './pages/Quotations'
import Orders from './pages/Orders'
import ClientPayments from './pages/ClientPayments'
import TransportAgenda from './pages/TransportAgenda'
import Transport from './pages/Transport'
import Suppliers from './pages/Suppliers'
import SupplierDetail from './pages/SupplierDetail'
import Stock from './pages/Stock'
import Clients from './pages/Clients'
import Affaires from './pages/Affaires'
import AffaireFinancials from './pages/AffaireFinancials'
import ResetPassword from './pages/ResetPassword'

const PAGE_TITLES = {
  '/': 'Geral',
  '/requisitions': 'Requisições',
  '/quotations': 'Cotações',
  '/orders': 'Encomendas',
  '/payments': 'Pagamentos',
  '/transport': 'Agenda de Transportes',
  '/carriers': 'Transportadores',
  '/suppliers': 'Avaliação de Fornecedores',
  '/supplier-detail': 'Fornecedores',
  '/stock': 'Stock',
  '/clients': 'Clientes',
  '/affaires': 'Negócios / Obras',
  '/financials': 'Viabilidade Financeira',
}

function Layout() {
  const { session, signOut, loading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [userRole, setUserRole] = React.useState(null)
  const [empCode, setEmpCode] = React.useState('')

  React.useEffect(() => {
    if (session?.user?.email) {
      import('./lib/supabase').then(({ supabase }) => {
        supabase.from('employees').select('role, emp_code, full_name').eq('email', session.user.email).single()
          .then(({ data }) => {
            if (data) { setUserRole(data.role); setEmpCode(data.emp_code||'') }
          })
      })
    }
  }, [session])

  if (loading) return <div className="loading"><i className="ti ti-loader-2" /> A carregar...</div>
  if (!session) return <Login />

  const isAdmin = userRole === 'admin'
  const nav = (path) => navigate(path)
  const isActive = (path) => location.pathname === path ? 'nav-item active' : 'nav-item'
  const title = PAGE_TITLES[location.pathname] || 'ProcureFlow'
  const email = session.user?.email || ''
  const initials = empCode ? empCode.slice(-2) : email.slice(0, 2).toUpperCase()

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="logo">
          <div className="logo-name"><i className="ti ti-building-warehouse" style={{fontSize:16,verticalAlign:'-2px',marginRight:6}} />ProcureFlow</div>
          <div className="logo-sub">Gestão de Procurement</div>
        </div>
        <nav className="nav">
          <div className="nav-section">Principal</div>
          <div className={isActive('/')} onClick={()=>nav('/')}><i className="ti ti-dashboard" />Geral</div>
          <div className={isActive('/stock')} onClick={()=>nav('/stock')}><i className="ti ti-package" />Stock</div>

          <div className="nav-section">Clientes</div>
          <div className={isActive('/clients')} onClick={()=>nav('/clients')}><i className="ti ti-users" />Clientes</div>
          <div className={isActive('/affaires')} onClick={()=>nav('/affaires')}><i className="ti ti-building" />Negócios / Obras</div>
          {isAdmin && <div className={isActive('/financials')} onClick={()=>nav('/financials')}><i className="ti ti-chart-bar" />Viabilidade</div>}

          <div className="nav-section">Compras</div>
          <div className={isActive('/requisitions')} onClick={()=>nav('/requisitions')}><i className="ti ti-clipboard-list" />Requisições</div>
          <div className={isActive('/quotations')} onClick={()=>nav('/quotations')}><i className="ti ti-file-invoice" />Cotações</div>
          <div className={isActive('/orders')} onClick={()=>nav('/orders')}><i className="ti ti-shopping-cart" />Encomendas</div>

          <div className="nav-section">Financeiro</div>
          <div className={isActive('/payments')} onClick={()=>nav('/payments')}><i className="ti ti-credit-card" />Pagamentos</div>

          <div className="nav-section">Logística</div>
          <div className={isActive('/transport')} onClick={()=>nav('/transport')}><i className="ti ti-calendar" />Agenda</div>
          <div className={isActive('/carriers')} onClick={()=>nav('/carriers')}><i className="ti ti-truck" />Transportadores</div>

          <div className="nav-section">Fornecedores</div>
          <div className={isActive('/supplier-detail')} onClick={()=>nav('/supplier-detail')}><i className="ti ti-address-book" />Ficheiro</div>
          <div className={isActive('/suppliers')} onClick={()=>nav('/suppliers')}><i className="ti ti-star" />Avaliações</div>
        </nav>
        <div className="user-area">
          <div className="avatar">{initials}</div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:12,fontWeight:500,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{email}</div>
            {isAdmin && <div style={{fontSize:10,background:'var(--blue)',color:'white',borderRadius:10,padding:'1px 6px',marginTop:2}}>Admin</div>}
          </div>
          <button onClick={signOut} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)',fontSize:16}} title="Sair"><i className="ti ti-logout" /></button>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="topbar-title">{title}</div>
          <div className="topbar-actions">
            <button className="btn btn-primary" onClick={()=>{ nav('/affaires'); setTimeout(()=>{ const btn = document.querySelector('[data-new-affaire]'); if(btn) btn.click() }, 100) }} style={{fontSize:13}}>
              <i className="ti ti-plus" />Novo Negócio
            </button>
            <button className="btn" onClick={()=>nav('/requisitions')} style={{fontSize:13}}>
              <i className="ti ti-clipboard-list" />Requisição
            </button>
          </div>
        </header>
        <main className="content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/requisitions" element={<Requisitions />} />
            <Route path="/quotations" element={<Quotations />} />
            <Route path="/orders" element={<Orders />} />
            <Route path="/payments" element={<ClientPayments />} />
            <Route path="/transport" element={<TransportAgenda />} />
            <Route path="/carriers" element={<Transport />} />
            <Route path="/suppliers" element={<Suppliers />} />
            <Route path="/supplier-detail" element={<SupplierDetail />} />
            <Route path="/stock" element={<Stock />} />
            <Route path="/clients" element={<Clients />} />
            <Route path="/affaires" element={<Affaires />} />
            <Route path="/financials" element={<AffaireFinancials />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}

export default function App() {
  // Handle password reset link directly
  if (window.location.hash.includes('type=recovery') || window.location.hash.includes('access_token')) {
    return <AuthProvider><BrowserRouter><ResetPassword /></BrowserRouter></AuthProvider>
  }
  return (
    <AuthProvider>
      <BrowserRouter>
        <Layout />
      </BrowserRouter>
    </AuthProvider>
  )
}
