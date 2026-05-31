import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Payments() {
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    const { data } = await supabase
      .from('payments')
      .select('*, orders(ref_number, suppliers(name), requisitions(description))')
      .order('due_date')
    setPayments(data||[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const markPaid = async (id) => {
    await supabase.from('payments').update({ status:'Pago', paid_date: new Date().toISOString().split('T')[0] }).eq('id', id)
    load()
  }

  const today = new Date().toISOString().split('T')[0]

  const badgeClass = (p) => {
    if (p.status==='Pago') return 'badge-delivered'
    if (p.due_date && p.due_date < today) return 'badge-critical'
    if (p.due_date && p.due_date === today) return 'badge-warning'
    return 'badge-pending'
  }
  const badgeLabel = (p) => {
    if (p.status==='Pago') return 'Pago'
    if (p.due_date && p.due_date < today) return 'Em atraso'
    if (p.due_date && p.due_date === today) return 'Vence hoje'
    return 'Pendente'
  }

  const total = payments.filter(p=>p.status!=='Pago').reduce((s,p)=>s+parseFloat(p.amount||0),0)

  if (loading) return <div className="loading"><i className="ti ti-loader-2"/>A carregar...</div>

  return (
    <div>
      <div className="metrics" style={{marginBottom:20}}>
        <div className="metric">
          <div className="metric-label">Total pendente</div>
          <div className="metric-value text-amber">€ {total.toLocaleString('pt-PT',{minimumFractionDigits:0})}</div>
        </div>
        <div className="metric">
          <div className="metric-label">Faturas pendentes</div>
          <div className="metric-value">{payments.filter(p=>p.status!=='Pago').length}</div>
        </div>
        <div className="metric">
          <div className="metric-label">Em atraso</div>
          <div className="metric-value text-red">{payments.filter(p=>p.status!=='Pago'&&p.due_date&&p.due_date<today).length}</div>
        </div>
        <div className="metric">
          <div className="metric-label">Pagas este mês</div>
          <div className="metric-value text-green">{payments.filter(p=>p.status==='Pago').length}</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><span className="card-title">Faturas e pagamentos</span></div>
        {payments.length===0
          ? <div className="empty">Sem pagamentos registados.</div>
          : payments.map(p=>(
              <div key={p.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 0',borderBottom:'0.5px solid var(--border)'}}>
                <div>
                  <div style={{fontWeight:500,fontSize:13}}>{p.orders?.suppliers?.name} · {p.invoice_ref||'Sem ref.'}</div>
                  <div style={{fontSize:12,color:'var(--text-muted)',marginTop:2}}>
                    {p.orders?.ref_number} · {p.orders?.requisitions?.description?.slice(0,40)}
                    {p.due_date ? ` · Vence ${new Date(p.due_date).toLocaleDateString('pt-PT')}` : ''}
                  </div>
                </div>
                <div style={{display:'flex',alignItems:'center',gap:12}}>
                  <span style={{fontWeight:600,fontSize:14}}>€ {parseFloat(p.amount).toLocaleString('pt-PT',{minimumFractionDigits:0})}</span>
                  <span className={`badge ${badgeClass(p)}`}>{badgeLabel(p)}</span>
                  {p.status!=='Pago' && (
                    <button className="btn btn-primary btn-sm" onClick={()=>markPaid(p.id)}>Registar pagamento</button>
                  )}
                </div>
              </div>
            ))
        }
      </div>
    </div>
  )
}
