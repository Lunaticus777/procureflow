import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Dashboard() {
  const [stats, setStats] = useState({ requisitions:0, quotations:0, orders:0, alerts:0 })
  const [recentReqs, setRecentReqs] = useState([])
  const [stockAlerts, setStockAlerts] = useState([])
  const [upcomingDeliveries, setUpcomingDeliveries] = useState([])
  const [upcomingTransports, setUpcomingTransports] = useState([])
  const [loading, setLoading] = useState(true)

  const today = new Date().toISOString().split('T')[0]
  const in5days = new Date(); in5days.setDate(in5days.getDate()+5)
  const in5daysStr = in5days.toISOString().split('T')[0]

  useEffect(() => {
    async function load() {
      const [
        { count: rCount }, { count: qCount }, { count: oCount },
        { data: alerts }, { data: reqs },
        { data: deliveries }, { data: transports }
      ] = await Promise.all([
        supabase.from('requisitions').select('*',{count:'exact',head:true}).neq('status','Entregue').neq('status','Cancelado'),
        supabase.from('quotations').select('*',{count:'exact',head:true}).eq('selected',false),
        supabase.from('orders').select('*',{count:'exact',head:true}).neq('status','Entregue').neq('status','Cancelado'),
        supabase.from('stock_alerts').select('*').limit(5),
        supabase.from('requisitions').select('*, employees(full_name,emp_code), affaires(name,ref_number)').order('created_at',{ascending:false}).limit(5),
        supabase.from('orders').select('*, suppliers(name), requisitions(description,affaires(name))').gte('expected_date',today).lte('expected_date',in5daysStr).neq('status','Entregue').order('expected_date'),
        supabase.from('transport_agenda').select('*, carriers(name,phone)').gte('planned_date',today).lte('planned_date',in5daysStr).order('planned_date'),
      ])
      setStats({ requisitions:rCount||0, quotations:qCount||0, orders:oCount||0, alerts:alerts?.length||0 })
      setStockAlerts(alerts||[])
      setRecentReqs(reqs||[])
      setUpcomingDeliveries(deliveries||[])
      setUpcomingTransports(transports||[])
      setLoading(false)
    }
    load()
  }, [])

  const statusClass = { 'Pendente':'badge-pending','Em cotação':'badge-quotation','Aprovado':'badge-approved','Encomendado':'badge-ordered','Em trânsito':'badge-transit','Entregue':'badge-delivered' }
  const prioClass = { 'Alta':'prio-high','Média':'prio-med','Baixa':'prio-low' }

  const daysUntil = (dateStr) => {
    const diff = Math.ceil((new Date(dateStr) - new Date()) / 86400000)
    return diff
  }

  if (loading) return <div className="loading"><i className="ti ti-loader-2"/>A carregar...</div>

  return (
    <div>
      <div className="metrics">
        <div className="metric">
          <div className="metric-label"><i className="ti ti-clipboard-list" style={{fontSize:12}}/> Requisições abertas</div>
          <div className="metric-value text-blue">{stats.requisitions}</div>
        </div>
        <div className="metric">
          <div className="metric-label"><i className="ti ti-file-invoice" style={{fontSize:12}}/> Cotações em análise</div>
          <div className="metric-value">{stats.quotations}</div>
        </div>
        <div className="metric">
          <div className="metric-label"><i className="ti ti-shopping-cart" style={{fontSize:12}}/> Encomendas ativas</div>
          <div className="metric-value">{stats.orders}</div>
        </div>
        <div className="metric">
          <div className="metric-label"><i className="ti ti-alert-triangle" style={{fontSize:12}}/> Alertas de stock</div>
          <div className="metric-value text-red">{stats.alerts}</div>
        </div>
      </div>

      {/* Alertas de entrega próxima */}
      {upcomingDeliveries.length > 0 && (
        <div style={{background:'var(--blue-light)',border:'0.5px solid var(--blue)',borderRadius:'var(--radius-lg)',padding:'12px 16px',marginBottom:16}}>
          <div style={{fontWeight:600,fontSize:13,color:'var(--blue)',marginBottom:8}}><i className="ti ti-truck" style={{marginRight:6}}/>📦 Entregas nos próximos 5 dias</div>
          {upcomingDeliveries.map(o => {
            const days = daysUntil(o.expected_date)
            return (
              <div key={o.id} style={{display:'flex',justifyContent:'space-between',padding:'5px 0',borderBottom:'0.5px solid rgba(24,95,165,0.2)',fontSize:13}}>
                <div>
                  <span style={{fontWeight:500}}>{o.ref_number}</span>
                  <span style={{color:'var(--text-muted)',marginLeft:8}}>{o.requisitions?.description?.slice(0,50)}</span>
                  <span style={{color:'var(--text-muted)',marginLeft:8}}>— {o.suppliers?.name}</span>
                  {o.requisitions?.affaires && <span style={{color:'var(--blue)',marginLeft:8,fontSize:11}}>{o.requisitions.affaires.name}</span>}
                </div>
                <span style={{fontWeight:600,color:days<=1?'var(--red)':days<=2?'var(--amber)':'var(--blue)',flexShrink:0,marginLeft:12}}>
                  {days===0?'Hoje!':days===1?'Amanhã!':days<=2?`${days} dias ⚠️`:`${days} dias`}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* Alertas de transporte próximo */}
      {upcomingTransports.length > 0 && (
        <div style={{background:'var(--amber-light)',border:'0.5px solid var(--amber)',borderRadius:'var(--radius-lg)',padding:'12px 16px',marginBottom:16}}>
          <div style={{fontWeight:600,fontSize:13,color:'#633806',marginBottom:8}}><i className="ti ti-truck-delivery" style={{marginRight:6}}/>🚚 Transportes nos próximos 5 dias</div>
          {upcomingTransports.map(t => {
            const days = daysUntil(t.planned_date)
            const needsCall = t.contact_status === 'Por fazer'
            return (
              <div key={t.id} style={{display:'flex',justifyContent:'space-between',padding:'5px 0',borderBottom:'0.5px solid rgba(186,117,23,0.2)',fontSize:13}}>
                <div>
                  <span style={{fontWeight:500}}>{t.carriers?.name}</span>
                  {t.load_description && <span style={{color:'var(--text-muted)',marginLeft:8}}>{t.load_description?.slice(0,50)}</span>}
                  {needsCall && <span style={{color:'var(--red)',marginLeft:8,fontSize:11,fontWeight:600}}>⚠️ Contactar: {t.carriers?.phone}</span>}
                </div>
                <span style={{fontWeight:600,color:days<=1?'var(--red)':days<=2?'var(--amber)':'#633806',flexShrink:0,marginLeft:12}}>
                  {days===0?'Hoje!':days===1?'Amanhã!':days<=2?`${days} dias ⚠️`:`${days} dias`}
                </span>
              </div>
            )
          })}
        </div>
      )}

      <div className="two-col">
        <div className="card">
          <div className="card-header"><span className="card-title">Requisições recentes</span></div>
          {recentReqs.length===0
            ? <div className="empty">Sem requisições.</div>
            : <table>
                <thead><tr><th>Ref.</th><th>Descrição</th><th>Obra</th><th>Por</th><th>Prio.</th><th>Estado</th></tr></thead>
                <tbody>
                  {recentReqs.map(r=>(
                    <tr key={r.id}>
                      <td style={{fontWeight:500}}>{r.ref_number}</td>
                      <td style={{maxWidth:140,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',fontSize:12}}>{r.description}</td>
                      <td style={{fontSize:11,color:'var(--blue)'}}>{r.affaires?.ref_number||'—'}</td>
                      <td style={{fontSize:11,color:'var(--text-muted)'}}>{r.employees?.emp_code||'—'}</td>
                      <td><span className={prioClass[r.priority]||''}>{r.priority}</span></td>
                      <td><span className={`badge ${statusClass[r.status]||''}`}>{r.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
          }
        </div>

        <div className="card">
          <div className="card-header"><span className="card-title">Alertas de stock mínimo</span></div>
          {stockAlerts.length===0
            ? <div className="empty">Stock em ordem!</div>
            : stockAlerts.map(a=>(
                <div key={a.id} style={{display:'flex',alignItems:'center',gap:12,padding:'8px 0',borderBottom:'0.5px solid var(--border)'}}>
                  <div style={{width:32,height:32,borderRadius:'var(--radius)',background:a.alert_level==='Rotura'?'var(--red-light)':'var(--amber-light)',color:a.alert_level==='Rotura'?'#A32D2D':'#633806',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,flexShrink:0}}>
                    <i className={`ti ${a.alert_level==='Rotura'?'ti-bolt':'ti-alert-triangle'}`}/>
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:500,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{a.description}</div>
                    <div style={{fontSize:11,color:'var(--text-muted)'}}>Stock: {a.stock_current} / mín: {a.stock_min} {a.unit}</div>
                    <div className="stock-bar"><div className={`stock-fill ${a.alert_level==='Rotura'?'fill-red':'fill-amber'}`} style={{width:`${Math.min(100,a.pct_of_min||0)}%`}}/></div>
                  </div>
                  <span className={`badge ${a.alert_level==='Rotura'?'badge-critical':'badge-warning'}`}>{a.alert_level}</span>
                </div>
              ))
          }
        </div>
      </div>
    </div>
  )
}
