import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Dashboard() {
  const [stats, setStats] = useState({ requisitions:0, quotations:0, orders:0, alerts:0 })
  const [recentReqs, setRecentReqs] = useState([])
  const [stockAlerts, setStockAlerts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [{ count: rCount }, { count: qCount }, { count: oCount }, { data: alerts }, { data: reqs }] = await Promise.all([
        supabase.from('requisitions').select('*', { count:'exact', head:true }).neq('status','Entregue'),
        supabase.from('quotations').select('*', { count:'exact', head:true }),
        supabase.from('orders').select('*', { count:'exact', head:true }).neq('status','Entregue'),
        supabase.from('stock_alerts').select('*').limit(5),
        supabase.from('requisitions').select('*, employees(full_name, emp_code)').order('created_at', { ascending:false }).limit(5),
      ])
      setStats({ requisitions: rCount||0, quotations: qCount||0, orders: oCount||0, alerts: alerts?.length||0 })
      setStockAlerts(alerts||[])
      setRecentReqs(reqs||[])
      setLoading(false)
    }
    load()
  }, [])

  const statusClass = {
    'Pendente':'badge-pending','Em cotação':'badge-quotation','Aprovado':'badge-approved',
    'Encomendado':'badge-ordered','Em trânsito':'badge-transit','Entregue':'badge-delivered','Cancelado':'badge-cancelled'
  }
  const prioClass = { 'Alta':'prio-high','Média':'prio-med','Baixa':'prio-low' }

  if (loading) return <div className="loading"><i className="ti ti-loader-2" />A carregar...</div>

  return (
    <div>
      <div className="metrics">
        <div className="metric">
          <div className="metric-label"><i className="ti ti-clipboard-list" style={{fontSize:12}} /> Requisições abertas</div>
          <div className="metric-value text-blue">{stats.requisitions}</div>
        </div>
        <div className="metric">
          <div className="metric-label"><i className="ti ti-file-invoice" style={{fontSize:12}} /> Cotações</div>
          <div className="metric-value">{stats.quotations}</div>
        </div>
        <div className="metric">
          <div className="metric-label"><i className="ti ti-shopping-cart" style={{fontSize:12}} /> Encomendas ativas</div>
          <div className="metric-value">{stats.orders}</div>
        </div>
        <div className="metric">
          <div className="metric-label"><i className="ti ti-alert-triangle" style={{fontSize:12}} /> Alertas de stock</div>
          <div className="metric-value text-red">{stats.alerts}</div>
        </div>
      </div>

      <div className="two-col">
        <div className="card">
          <div className="card-header">
            <span className="card-title">Requisições recentes</span>
          </div>
          {recentReqs.length === 0
            ? <div className="empty">Sem requisições ainda.</div>
            : <table>
                <thead><tr><th>Ref.</th><th>Descrição</th><th>Prio.</th><th>Estado</th></tr></thead>
                <tbody>
                  {recentReqs.map(r => (
                    <tr key={r.id}>
                      <td style={{fontWeight:500}}>{r.ref_number}</td>
                      <td style={{maxWidth:180,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.description}</td>
                      <td><span className={prioClass[r.priority]||''}>{r.priority}</span></td>
                      <td><span className={`badge ${statusClass[r.status]||''}`}>{r.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
          }
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">Alertas de stock mínimo</span>
          </div>
          {stockAlerts.length === 0
            ? <div className="empty" style={{padding:20}}>Stock em ordem!</div>
            : stockAlerts.map(a => (
                <div key={a.id} className="alert-row">
                  <div className={`alert-icon ${a.alert_level==='Rotura'?'':''}` } style={{ background: a.alert_level==='Rotura'?'var(--red-light)':'var(--amber-light)', color: a.alert_level==='Rotura'?'#A32D2D':'#633806' }}>
                    <i className={`ti ${a.alert_level==='Rotura'?'ti-bolt':'ti-alert-triangle'}`} />
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:500,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{a.description}</div>
                    <div style={{fontSize:12,color:'var(--text-muted)'}}>Stock: {a.stock_current} / mín: {a.stock_min} {a.unit}</div>
                    <div className="stock-bar">
                      <div className={`stock-fill ${a.alert_level==='Rotura'?'fill-red':'fill-amber'}`} style={{width:`${Math.min(100,a.pct_of_min||0)}%`}} />
                    </div>
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
