import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function ClientPayments() {
  const [payments, setPayments] = useState([])
  const [supplierPayments, setSupplierPayments] = useState([])
  const [clients, setClients] = useState([])
  const [affaires, setAffaires] = useState([])
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('clients')
  const [showForm, setShowForm] = useState(false)
  const [payType, setPayType] = useState('client')
  const [form, setForm] = useState({ client_id:'', affaire_id:'', order_id:'', invoice_ref:'', amount:'', due_date:'', notes:'', payment_type:'Cliente' })
  const [saving, setSaving] = useState(false)

  const load = async () => {
    const [{ data: cp }, { data: sp }, { data: cl }, { data: af }, { data: or }] = await Promise.all([
      supabase.from('client_payments').select('*, clients(name), affaires(name,ref_number), client_orders(ref_number)').order('due_date'),
      supabase.from('payments').select('*, orders(ref_number, suppliers(name), requisitions(description,affaires(name,ref_number)))').order('due_date'),
      supabase.from('clients').select('id,name').eq('active',true).order('name'),
      supabase.from('affaires').select('id,name,ref_number').not('status','eq','Cancelada').order('ref_number'),
      supabase.from('orders').select('id,ref_number,suppliers(name)').not('status','eq','Entregue').order('ref_number'),
    ])
    setPayments(cp||[])
    setSupplierPayments(sp||[])
    setClients(cl||[])
    setAffaires(af||[])
    setOrders(or||[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const markPaid = async (id, type) => {
    const table = type==='client' ? 'client_payments' : 'payments'
    await supabase.from(table).update({ status:'Pago', paid_date: new Date().toISOString().split('T')[0] }).eq('id', id)
    load()
  }

  const handleSave = async () => {
    if (!form.amount) return
    setSaving(true)
    if (payType==='client') {
      await supabase.from('client_payments').insert({
        client_id: form.client_id||null, affaire_id: form.affaire_id||null,
        invoice_ref: form.invoice_ref, amount: parseFloat(form.amount),
        due_date: form.due_date||null, notes: form.notes, status: 'Pendente',
      })
    } else {
      await supabase.from('payments').insert({
        order_id: form.order_id||null, affaire_id: form.affaire_id||null,
        client_id: form.client_id||null, invoice_ref: form.invoice_ref,
        amount: parseFloat(form.amount), due_date: form.due_date||null,
        notes: form.notes, status: 'Pendente', payment_type: 'Fornecedor',
      })
    }
    setForm({ client_id:'', affaire_id:'', order_id:'', invoice_ref:'', amount:'', due_date:'', notes:'', payment_type:'Cliente' })
    setShowForm(false)
    setSaving(false)
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

  const totalClientPending = payments.filter(p=>p.status!=='Pago').reduce((s,p)=>s+parseFloat(p.amount||0),0)
  const totalClientReceived = payments.filter(p=>p.status==='Pago').reduce((s,p)=>s+parseFloat(p.amount||0),0)
  const totalSupplierPending = supplierPayments.filter(p=>p.status!=='Pago').reduce((s,p)=>s+parseFloat(p.amount||0),0)
  const totalSupplierPaid = supplierPayments.filter(p=>p.status==='Pago').reduce((s,p)=>s+parseFloat(p.amount||0),0)

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
          <div className="metric-label">Pago a fornecedores</div>
          <div className="metric-value text-green">€ {totalSupplierPaid.toLocaleString('pt-PT',{minimumFractionDigits:0})}</div>
        </div>
      </div>

      {showForm && (
        <div className="card" style={{maxWidth:600,marginBottom:16}}>
          <div className="card-header">
            <span className="card-title">Novo Pagamento</span>
            <div style={{display:'flex',gap:6}}>
              <button className={`btn btn-sm ${payType==='client'?'btn-primary':''}`} onClick={()=>setPayType('client')}>Do cliente</button>
              <button className={`btn btn-sm ${payType==='supplier'?'btn-primary':''}`} onClick={()=>setPayType('supplier')}>A fornecedor</button>
            </div>
          </div>
          <div className="form-grid">
            {payType==='client' && (
              <div className="form-group full"><label>Cliente</label>
                <select value={form.client_id} onChange={e=>setForm({...form,client_id:e.target.value})}>
                  <option value="">— Selecionar cliente —</option>
                  {clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}
            {payType==='supplier' && (
              <div className="form-group full"><label>Encomenda</label>
                <select value={form.order_id} onChange={e=>setForm({...form,order_id:e.target.value})}>
                  <option value="">— Selecionar encomenda —</option>
                  {orders.map(o=><option key={o.id} value={o.id}>{o.ref_number} — {o.suppliers?.name}</option>)}
                </select>
              </div>
            )}
            <div className="form-group full"><label>Negócio / Obra</label>
              <select value={form.affaire_id} onChange={e=>setForm({...form,affaire_id:e.target.value})}>
                <option value="">— Sem obra associada —</option>
                {affaires.map(a=><option key={a.id} value={a.id}>{a.ref_number} — {a.name}</option>)}
              </select>
            </div>
            <div className="form-group"><label>Nº Fatura</label><input value={form.invoice_ref} onChange={e=>setForm({...form,invoice_ref:e.target.value})} placeholder="FAT-2025-001" /></div>
            <div className="form-group"><label>Valor (€) *</label><input type="number" step="0.01" value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})} /></div>
            <div className="form-group"><label>Data de vencimento</label><input type="date" value={form.due_date} onChange={e=>setForm({...form,due_date:e.target.value})} /></div>
            <div className="form-group full"><label>Notas</label><textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} /></div>
          </div>
          <div className="form-actions">
            <button className="btn" onClick={()=>setShowForm(false)}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving?'A guardar...':'Guardar'}</button>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <div className="tabs" style={{margin:0,border:'none'}}>
            <div className={`tab ${tab==='clients'?'active':''}`} onClick={()=>setTab('clients')}>
              A receber dos clientes ({payments.filter(p=>p.status!=='Pago').length} pendentes)
            </div>
            <div className={`tab ${tab==='suppliers'?'active':''}`} onClick={()=>setTab('suppliers')}>
              A pagar a fornecedores ({supplierPayments.filter(p=>p.status!=='Pago').length} pendentes)
            </div>
          </div>
          <button className="btn btn-primary" onClick={()=>setShowForm(true)}><i className="ti ti-plus"/>Novo</button>
        </div>

        {tab==='clients' && (
          payments.length===0 ? <div className="empty">Sem pagamentos de clientes.</div>
          : payments.map(p=>(
              <div key={p.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 0',borderBottom:'0.5px solid var(--border)',flexWrap:'wrap',gap:8}}>
                <div>
                  <div style={{fontWeight:500,fontSize:13}}>{p.clients?.name||'—'} {p.invoice_ref?`· ${p.invoice_ref}`:''}</div>
                  <div style={{fontSize:12,color:'var(--text-muted)',marginTop:2}}>
                    {p.affaires?`${p.affaires.ref_number} — ${p.affaires.name}`:p.client_orders?.ref_number||'—'}
                    {p.due_date?` · Vence ${new Date(p.due_date).toLocaleDateString('pt-PT')}`:''}
                    {p.paid_date?` · Pago ${new Date(p.paid_date).toLocaleDateString('pt-PT')}`:''}
                  </div>
                  {p.notes && <div style={{fontSize:11,color:'var(--text-muted)',fontStyle:'italic'}}>{p.notes}</div>}
                </div>
                <div style={{display:'flex',alignItems:'center',gap:10}}>
                  <span style={{fontWeight:600,fontSize:14}}>€ {parseFloat(p.amount).toLocaleString('pt-PT',{minimumFractionDigits:0})}</span>
                  <span className={`badge ${badgeClass(p)}`}>{badgeLabel(p)}</span>
                  {p.status!=='Pago' && <button className="btn btn-primary btn-sm" onClick={()=>markPaid(p.id,'client')}>Recebido ✓</button>}
                </div>
              </div>
            ))
        )}

        {tab==='suppliers' && (
          supplierPayments.length===0 ? <div className="empty">Sem pagamentos a fornecedores.</div>
          : supplierPayments.map(p=>(
              <div key={p.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 0',borderBottom:'0.5px solid var(--border)',flexWrap:'wrap',gap:8}}>
                <div>
                  <div style={{fontWeight:500,fontSize:13}}>{p.orders?.suppliers?.name||'—'} {p.invoice_ref?`· ${p.invoice_ref}`:''}</div>
                  <div style={{fontSize:12,color:'var(--text-muted)',marginTop:2}}>
                    {p.orders?.ref_number||'—'} · {p.orders?.requisitions?.description?.slice(0,40)||''}
                    {p.orders?.requisitions?.affaires?` · ${p.orders.requisitions.affaires.ref_number}`:''}
                    {p.due_date?` · Vence ${new Date(p.due_date).toLocaleDateString('pt-PT')}`:''}
                    {p.paid_date?` · Pago ${new Date(p.paid_date).toLocaleDateString('pt-PT')}`:''}
                  </div>
                  {p.notes && <div style={{fontSize:11,color:'var(--text-muted)',fontStyle:'italic'}}>{p.notes}</div>}
                </div>
                <div style={{display:'flex',alignItems:'center',gap:10}}>
                  <span style={{fontWeight:600,fontSize:14}}>€ {parseFloat(p.amount).toLocaleString('pt-PT',{minimumFractionDigits:0})}</span>
                  <span className={`badge ${badgeClass(p)}`}>{badgeLabel(p)}</span>
                  {p.status!=='Pago' && <button className="btn btn-primary btn-sm" onClick={()=>markPaid(p.id,'supplier')}>Pago ✓</button>}
                </div>
              </div>
            ))
        )}
      </div>
    </div>
  )
}
