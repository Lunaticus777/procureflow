import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function ClientPayments() {
  const [payments, setPayments] = useState([])
  const [supplierPayments, setSupplierPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('clients')

  const load = async () => {
    const [{ data: cp }, { data: sp }] = await Promise.all([
      supabase.from('client_payments')
        .select('*, clients(name), affaires(name, ref_number), client_orders(ref_number)')
        .order('due_date'),
      supabase.from('payments')
        .select('*, orders(ref_number, suppliers(name), requisitions(description))')
        .order('due_date'),
    ])
    setPayments(cp || [])
    setSupplierPayments(sp || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const markPaid = async (id, type) => {
    const table = type === 'client' ? 'client_payments' : 'payments'
    await supabase.from(table).update({ status: 'Pago', paid_date: new Date().toISOString().split('T')[0] }).eq('id', id)
    load()
  }

  const today = new Date().toISOString().split('T')[0]

  const badgeClass = (p) => {
    if (p.status === 'Pago') return 'badge-delivered'
    if (p.due_date && p.due_date < today) return 'badge-critical'
    if (p.due_date && p.due_date === today) return 'badge-warning'
    return 'badge-pending'
  }
  const badgeLabel = (p) => {
    if (p.status === 'Pago') return 'Pago'
    if (p.due_date && p.due_date < today) return 'Em atraso'
    if (p.due_date && p.due_date === today) return 'Vence hoje'
    return 'Pendente'
  }

  const totalClientPending = payments.filter(p=>p.status!=='Pago').reduce((s,p)=>s+parseFloat(p.amount||0),0)
  const totalClientReceived = payments.filter(p=>p.status==='Pago').reduce((s,p)=>s+parseFloat(p.amount||0),0)
  const totalSupplierPending = supplierPayments.filter(p=>p.status!=='Pago').reduce((s,p)=>s+parseFloat(p.amount||0),0)

  if (loading) return <div className="loading"><i className="ti ti-loader-2"/>A carregar...</div>

  return (
    <div>
      <div className="metrics">
        <div className="metric">
          <div className="metric-label">A receber (clientes)</div>
          <div className="metric-value text-amber">€ {totalClientPending.toLocaleString('pt-PT',{minimumFractionDigits:0})}</div>
        </div>
        <div className="metric">
          <div className="metric-label">Recebido</div>
          <div className="metric-value text-green">€ {totalClientReceived.toLocaleString('pt-PT',{minimumFractionDigits:0})}</div>
        </div>
        <div className="metric">
          <div className="metric-label">A pagar (fornecedores)</div>
          <div className="metric-value text-red">€ {totalSupplierPending.toLocaleString('pt-PT',{minimumFractionDigits:0})}</div>
        </div>
        <div className="metric">
          <div className="metric-label">Saldo</div>
          <div className={`metric-value ${totalClientPending - totalSupplierPending >= 0 ? 'text-green' : 'text-red'}`}>
            € {(totalClientPending - totalSupplierPending).toLocaleString('pt-PT',{minimumFractionDigits:0})}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="tabs">
          <div className={`tab ${tab==='clients'?'active':''}`} onClick={()=>setTab('clients')}>
            A receber dos clientes ({payments.filter(p=>p.status!=='Pago').length})
          </div>
          <div className={`tab ${tab==='suppliers'?'active':''}`} onClick={()=>setTab('suppliers')}>
            A pagar a fornecedores ({supplierPayments.filter(p=>p.status!=='Pago').length})
          </div>
        </div>

        {tab === 'clients' && (
          payments.length === 0
            ? <div className="empty">Sem pagamentos de clientes.</div>
            : payments.map(p => (
                <div key={p.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 0',borderBottom:'0.5px solid var(--border)'}}>
                  <div>
                    <div style={{fontWeight:500,fontSize:13}}>{p.clients?.name} · {p.invoice_ref||'Sem fatura'}</div>
                    <div style={{fontSize:12,color:'var(--text-muted)',marginTop:2}}>
                      {p.affaires?.name||p.client_orders?.ref_number||'—'}
                      {p.due_date ? ` · Vence ${new Date(p.due_date).toLocaleDateString('pt-PT')}` : ''}
                    </div>
                  </div>
                  <div style={{display:'flex',alignItems:'center',gap:12}}>
                    <span style={{fontWeight:600,fontSize:14}}>€ {parseFloat(p.amount).toLocaleString('pt-PT',{minimumFractionDigits:0})}</span>
                    <span className={`badge ${badgeClass(p)}`}>{badgeLabel(p)}</span>
                    {p.status !== 'Pago' && <button className="btn btn-primary btn-sm" onClick={()=>markPaid(p.id,'client')}>Recebido</button>}
                  </div>
                </div>
              ))
        )}

        {tab === 'suppliers' && (
          supplierPayments.length === 0
            ? <div className="empty">Sem pagamentos a fornecedores.</div>
            : supplierPayments.map(p => (
                <div key={p.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 0',borderBottom:'0.5px solid var(--border)'}}>
                  <div>
                    <div style={{fontWeight:500,fontSize:13}}>{p.orders?.suppliers?.name} · {p.invoice_ref||'Sem fatura'}</div>
                    <div style={{fontSize:12,color:'var(--text-muted)',marginTop:2}}>
                      {p.orders?.ref_number} · {p.orders?.requisitions?.description?.slice(0,40)}
                      {p.due_date ? ` · Vence ${new Date(p.due_date).toLocaleDateString('pt-PT')}` : ''}
                    </div>
                  </div>
                  <div style={{display:'flex',alignItems:'center',gap:12}}>
                    <span style={{fontWeight:600,fontSize:14}}>€ {parseFloat(p.amount).toLocaleString('pt-PT',{minimumFractionDigits:0})}</span>
                    <span className={`badge ${badgeClass(p)}`}>{badgeLabel(p)}</span>
                    {p.status !== 'Pago' && <button className="btn btn-primary btn-sm" onClick={()=>markPaid(p.id,'supplier')}>Pago</button>}
                  </div>
                </div>
              ))
        )}
      </div>
    </div>
  )
}
