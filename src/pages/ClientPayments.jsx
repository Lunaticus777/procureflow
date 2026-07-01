import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useRole } from '../hooks/useRole'

export default function ClientPayments() {
  const { session } = useAuth()
  const [clientPayments, setClientPayments] = useState([])
  const [supplierInvoices, setSupplierInvoices] = useState([])
  const [supplierPartials, setSupplierPartials] = useState([])
  const [clients, setClients] = useState([])
  const [affaires, setAffaires] = useState([])
  const [orders, setOrders] = useState([])
  const { isAdmin } = useRole()
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('clients')
  const [showForm, setShowForm] = useState(false)
  const [payType, setPayType] = useState('client')
  const [search, setSearch] = useState('')
  const [filterAffaire, setFilterAffaire] = useState('')
  const [form, setForm] = useState({ client_id:'', affaire_id:'', order_id:'', invoice_ref:'', amount:'', due_date:'', notes:'' })
  const [saving, setSaving] = useState(false)

  const load = async () => {
    const [{ data: cp }, { data: sp }, { data: pp }, { data: cl }, { data: af }, { data: or }] = await Promise.all([
      supabase.from('client_payments').select('*, clients(name), affaires(name,ref_number,id), client_orders(ref_number)').order('due_date'),
      supabase.from('payments').select('*, orders(ref_number, total_amount, suppliers(name), requisitions(description,affaires(name,ref_number,id)))').order('due_date'),
      supabase.from('order_partial_payments').select('*, orders(ref_number, total_amount, suppliers(name), requisitions(description, affaire_id, affaires(name,ref_number,id))), employees(full_name,emp_code)').order('payment_date',{ascending:false}),
      supabase.from('clients').select('id,name').eq('active',true).order('name'),
      supabase.from('affaires').select('id,name,ref_number').not('status','eq','Cancelada').order('ref_number'),
      supabase.from('orders').select('id,ref_number,suppliers(name)').not('status','eq','Entregue').order('ref_number'),
    ])
    setClientPayments(cp||[])
    setSupplierInvoices(sp||[])
    setSupplierPartials(pp||[])
    setClients(cl||[])
    setAffaires(af||[])
    setOrders(or||[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const markPaid = async (id, type) => {
    const today = new Date().toISOString().split('T')[0]
    if (type === 'client') {
      await supabase.from('client_payments').update({status:'Pago', paid_date:today}).eq('id',id)
    } else {
      // Mark supplier invoice as paid
      const inv = supplierInvoices.find(p=>p.id===id)
      await supabase.from('payments').update({status:'Pago', paid_date:today}).eq('id',id)
      // Also create a record in order_partial_payments so it appears in Pagamentos efectuados
      if (inv?.order_id) {
        // Check if partial payment already exists for this order
        const { data: existing } = await supabase.from('order_partial_payments').select('id').eq('order_id', inv.order_id)
        if (!existing?.length) {
          const { data: emp } = await supabase.from('employees').select('id').eq('email', session?.user?.email).single()
          await supabase.from('order_partial_payments').insert({
            order_id: inv.order_id,
            amount: inv.amount,
            payment_date: today,
            payment_method: 'Transferência',
            created_by: emp?.id||null,
            notes: 'Registado via Faturas-Fornecedores'
          })
        }
      }
    }
    load()
  }


  const syncPaidInvoices = async () => {
    if (!confirm('Sincronizar todas as faturas pagas com Pagamentos efectuados?')) return
    const paid = supplierInvoices.filter(p => p.status === 'Pago' && p.order_id)
    const { data: emp } = await supabase.from('employees').select('id').eq('email', session?.user?.email).single()
    let count = 0
    for (const inv of paid) {
      const { data: existing } = await supabase.from('order_partial_payments').select('id').eq('order_id', inv.order_id)
      if (!existing?.length) {
        await supabase.from('order_partial_payments').insert({
          order_id: inv.order_id,
          amount: inv.amount,
          payment_date: inv.paid_date || new Date().toISOString().split('T')[0],
          payment_method: 'Transferência',
          created_by: emp?.id||null,
          notes: 'Sincronizado automaticamente'
        })
        count++
      }
    }
    alert(count > 0 ? count + ' pagamento(s) sincronizado(s)!' : 'Nada a sincronizar — tudo já está em dia.')
    load()
  }
  const handleDeletePayment = async (id, type) => {
    if (!confirm('Apagar este pagamento?')) return
    const table = type === 'client' ? 'client_payments' : type === 'partial' ? 'order_partial_payments' : 'payments'
    const { error } = await supabase.from(table).delete().eq('id', id)
    if (error) { alert('Erro: ' + error.message); return }
    load()
  }

  const handleSave = async () => {
    if (!form.amount) return
    setSaving(true)
    if (payType==='client') {
      await supabase.from('client_payments').insert({ client_id:form.client_id||null, affaire_id:form.affaire_id||null, invoice_ref:form.invoice_ref, amount:parseFloat(form.amount), due_date:form.due_date||null, notes:form.notes, status:'Pendente' })
    } else {
      await supabase.from('payments').insert({ order_id:form.order_id||null, affaire_id:form.affaire_id||null, invoice_ref:form.invoice_ref, amount:parseFloat(form.amount), due_date:form.due_date||null, notes:form.notes, status:'Pendente', payment_type:'Fornecedor' })
    }
    setForm({client_id:'',affaire_id:'',order_id:'',invoice_ref:'',amount:'',due_date:'',notes:''})
    setShowForm(false); setSaving(false); load()
  }

  const today = new Date().toISOString().split('T')[0]
  const badgeClass = (p) => { if(p.status==='Pago')return 'badge-delivered'; if(p.due_date&&p.due_date<today)return 'badge-critical'; if(p.due_date&&p.due_date===today)return 'badge-warning'; return 'badge-pending' }
  const badgeLabel = (p) => { if(p.status==='Pago')return 'Pago'; if(p.due_date&&p.due_date<today)return 'Em atraso'; if(p.due_date&&p.due_date===today)return 'Vence hoje'; return 'Pendente' }

  const s = search.toLowerCase()
  const fa = filterAffaire

  const filteredClient = clientPayments.filter(p => {
    const matchS = !s || p.clients?.name?.toLowerCase().includes(s) || p.invoice_ref?.toLowerCase().includes(s) || p.affaires?.name?.toLowerCase().includes(s)
    const matchA = !fa || p.affaires?.id === fa
    return matchS && matchA
  })

  const filteredInvoices = supplierInvoices.filter(p => {
    const matchS = !s || p.orders?.suppliers?.name?.toLowerCase().includes(s) || p.invoice_ref?.toLowerCase().includes(s) || p.orders?.requisitions?.affaires?.name?.toLowerCase().includes(s)
    const matchA = !fa || p.orders?.requisitions?.affaires?.id === fa
    return matchS && matchA
  })

  const filteredPartials = supplierPartials.filter(p => {
    const matchS = !s || p.orders?.suppliers?.name?.toLowerCase().includes(s) || p.orders?.ref_number?.toLowerCase().includes(s)
    const matchA = !fa || p.orders?.requisitions?.affaires?.id === fa || p.orders?.requisitions?.affaire_id === fa
    return matchS && matchA
  })

  // Totais
  const totalClientPending = clientPayments.filter(p=>p.status!=='Pago').reduce((acc,p)=>acc+parseFloat(p.amount||0),0)
  const totalClientReceived = clientPayments.filter(p=>p.status==='Pago').reduce((acc,p)=>acc+parseFloat(p.amount||0),0)
  const totalSupplierPending = supplierInvoices.filter(p=>p.status!=='Pago').reduce((acc,p)=>acc+parseFloat(p.amount||0),0)
  const totalSupplierPaid = supplierInvoices.filter(p=>p.status==='Pago').reduce((acc,p)=>acc+parseFloat(p.amount||0),0)
  const totalPartialsPaid = supplierPartials.reduce((acc,p)=>acc+parseFloat(p.amount||0),0)

  if (loading) return <div className="loading"><i className="ti ti-loader-2"/>A carregar...</div>

  return (
    <div>
      <div className="metrics">
        <div className="metric"><div className="metric-label">A receber (clientes)</div><div className="metric-value text-amber">€ {totalClientPending.toLocaleString('pt-PT',{minimumFractionDigits:0})}</div></div>
        <div className="metric"><div className="metric-label">Recebido de clientes</div><div className="metric-value text-green">€ {totalClientReceived.toLocaleString('pt-PT',{minimumFractionDigits:0})}</div></div>
        <div className="metric"><div className="metric-label">Faturas por pagar</div><div className="metric-value text-red">€ {totalSupplierPending.toLocaleString('pt-PT',{minimumFractionDigits:0})}</div></div>
        <div className="metric"><div className="metric-label">Pago a fornecedores</div><div className="metric-value text-green">€ {(totalSupplierPaid + totalPartialsPaid).toLocaleString('pt-PT',{minimumFractionDigits:0})}</div></div>
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
            {payType==='client' && <div className="form-group full"><label>Cliente</label>
              <select value={form.client_id} onChange={e=>setForm({...form,client_id:e.target.value})}>
                <option value="">— Selecionar —</option>
                {clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>}
            {payType==='supplier' && <div className="form-group full"><label>Encomenda</label>
              <select value={form.order_id} onChange={e=>setForm({...form,order_id:e.target.value})}>
                <option value="">— Selecionar —</option>
                {orders.map(o=><option key={o.id} value={o.id}>{o.ref_number} — {o.suppliers?.name}</option>)}
              </select>
            </div>}
            <div className="form-group full"><label>Negócio / Obra</label>
              <select value={form.affaire_id} onChange={e=>setForm({...form,affaire_id:e.target.value})}>
                <option value="">— Sem obra —</option>
                {affaires.map(a=><option key={a.id} value={a.id}>{a.ref_number} — {a.name}</option>)}
              </select>
            </div>
            <div className="form-group"><label>Nº Fatura</label><input value={form.invoice_ref} onChange={e=>setForm({...form,invoice_ref:e.target.value})} /></div>
            <div className="form-group"><label>Valor (€) *</label><input type="number" step="0.01" value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})} /></div>
            <div className="form-group"><label>Vencimento</label><input type="date" value={form.due_date} onChange={e=>setForm({...form,due_date:e.target.value})} /></div>
            <div className="form-group full"><label>Notas</label><textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} /></div>
          </div>
          <div className="form-actions">
            <button className="btn" onClick={()=>setShowForm(false)}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving?'A guardar...':'Guardar'}</button>
          </div>
        </div>
      )}

      <div className="card">
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12,flexWrap:'wrap',gap:8}}>
          <div className="tabs" style={{margin:0,border:'none',flex:1}}>
            <div className={`tab ${tab==='clients'?'active':''}`} onClick={()=>setTab('clients')}>
              A receber — Clientes ({filteredClient.filter(p=>p.status!=='Pago').length} pend.)
            </div>
            <div className={`tab ${tab==='invoices'?'active':''}`} onClick={()=>setTab('invoices')}>
              Faturas — Fornecedores ({filteredInvoices.filter(p=>p.status!=='Pago').length} pend.) <button className="btn btn-sm" style={{marginLeft:8,fontSize:10}} onClick={syncPaidInvoices}>🔄 Sincronizar</button>
            </div>
            <div className={`tab ${tab==='partials'?'active':''}`} onClick={()=>setTab('partials')}>
              Pagamentos efectuados ({filteredPartials.length})
            </div>
          </div>
          <button className="btn btn-primary btn-sm" onClick={()=>setShowForm(true)}><i className="ti ti-plus"/>Novo</button>
        </div>

        {/* Filtros */}
        <div style={{display:'flex',gap:8,marginBottom:12,flexWrap:'wrap'}}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Pesquisar..." style={{flex:1,minWidth:160,border:'0.5px solid var(--border-hover)',borderRadius:'var(--radius)',padding:'6px 10px',fontSize:13,background:'var(--bg-card)',color:'var(--text)',fontFamily:'inherit'}} />
          <select value={filterAffaire} onChange={e=>setFilterAffaire(e.target.value)} style={{border:'0.5px solid var(--border-hover)',borderRadius:'var(--radius)',padding:'6px 10px',fontSize:13,background:'var(--bg-card)',color:'var(--text)',fontFamily:'inherit'}}>
            <option value="">Todas as obras</option>
            {affaires.map(a=><option key={a.id} value={a.id}>{a.ref_number} — {a.name}</option>)}
          </select>
          {(search||filterAffaire) && <button className="btn" onClick={()=>{setSearch('');setFilterAffaire('')}}>✕</button>}
        </div>

        {/* A receber dos clientes */}
        {tab==='clients' && (
          filteredClient.length===0 ? <div className="empty">Sem pagamentos de clientes.</div>
          : filteredClient.map(p=>(
              <div key={p.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 0',borderBottom:'0.5px solid var(--border)',flexWrap:'wrap',gap:8}}>
                <div>
                  <div style={{fontWeight:500,fontSize:13}}>{p.clients?.name||'—'} {p.invoice_ref?`· Fatura: ${p.invoice_ref}`:''}</div>
                  <div style={{fontSize:12,color:'var(--text-muted)',marginTop:2}}>
                    {p.affaires?`${p.affaires.ref_number} — ${p.affaires.name}`:p.client_orders?.ref_number||'—'}
                    {p.due_date?` · Vence ${new Date(p.due_date).toLocaleDateString('pt-PT')}`:''}
                    {p.paid_date?` · Pago ${new Date(p.paid_date).toLocaleDateString('pt-PT')}`:''}
                  </div>
                  {p.notes && <div style={{fontSize:11,fontStyle:'italic',color:'var(--text-muted)'}}>{p.notes}</div>}
                </div>
                <div style={{display:'flex',alignItems:'center',gap:10}}>
                  <span style={{fontWeight:600,fontSize:15}}>€ {parseFloat(p.amount).toLocaleString('pt-PT',{minimumFractionDigits:0})}</span>
                  <span className={`badge ${badgeClass(p)}`}>{badgeLabel(p)}</span>
                  {p.status!=='Pago' && <button className="btn btn-primary btn-sm" onClick={()=>markPaid(p.id,'client')}>Recebido ✓</button>}
                  {isAdmin && <button className="btn btn-sm" style={{color:'var(--red)'}} onClick={()=>handleDeletePayment(p.id,'client')} title="Apagar"><i className="ti ti-trash"/></button>}
                </div>
              </div>
            ))
        )}

        {/* Faturas de fornecedores */}
        {tab==='invoices' && (
          filteredInvoices.length===0 ? <div className="empty">Sem faturas de fornecedores.</div>
          : filteredInvoices.map(p=>(
              <div key={p.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 0',borderBottom:'0.5px solid var(--border)',flexWrap:'wrap',gap:8}}>
                <div>
                  <div style={{fontWeight:500,fontSize:13}}>{p.orders?.suppliers?.name||'—'} {p.invoice_ref?`· Fatura: ${p.invoice_ref}`:''}</div>
                  <div style={{fontSize:12,color:'var(--text-muted)',marginTop:2}}>
                    {p.orders?.ref_number||'—'}
                    {p.orders?.requisitions?.description ? ` · ${p.orders.requisitions.description.slice(0,40)}` : ''}
                    {p.orders?.requisitions?.affaires ? ` · ${p.orders.requisitions.affaires.ref_number}` : ''}
                    {p.due_date?` · Vence ${new Date(p.due_date).toLocaleDateString('pt-PT')}`:''}
                    {p.paid_date?` · Pago ${new Date(p.paid_date).toLocaleDateString('pt-PT')}`:''}
                  </div>
                  {p.notes && <div style={{fontSize:11,fontStyle:'italic',color:'var(--text-muted)'}}>{p.notes}</div>}
                </div>
                <div style={{display:'flex',alignItems:'center',gap:10}}>
                  <span style={{fontWeight:600,fontSize:15}}>€ {parseFloat(p.amount).toLocaleString('pt-PT',{minimumFractionDigits:0})}</span>
                  <span className={`badge ${badgeClass(p)}`}>{badgeLabel(p)}</span>
                  {p.status!=='Pago' && <button className="btn btn-primary btn-sm" onClick={()=>markPaid(p.id,'supplier')}>Pago ✓</button>}
                  {isAdmin && <button className="btn btn-sm" style={{color:'var(--red)'}} onClick={()=>handleDeletePayment(p.id,'invoice')} title="Apagar"><i className="ti ti-trash"/></button>}
                </div>
              </div>
            ))
        )}

        {/* Pagamentos parciais efectuados */}
        {tab==='partials' && (
          filteredPartials.length===0 ? <div className="empty">Sem pagamentos registados.</div>
          : <>
              <div style={{padding:'8px 12px',background:'var(--green-light)',borderRadius:'var(--radius)',marginBottom:12,fontSize:13}}>
                <strong style={{color:'var(--green)'}}>Total pago: € {totalPartialsPaid.toLocaleString('pt-PT',{minimumFractionDigits:0})}</strong>
                <span style={{color:'var(--text-muted)',marginLeft:8}}>({filteredPartials.length} pagamento(s))</span>
              </div>
              {filteredPartials.map(p=>(
                <div key={p.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 0',borderBottom:'0.5px solid var(--border)',flexWrap:'wrap',gap:8}}>
                  <div>
                    <div style={{fontWeight:500,fontSize:13}}>
                      {p.orders?.suppliers?.name||'—'} · {p.orders?.ref_number||'—'}
                      <span style={{fontWeight:400,fontSize:12,color:'var(--text-muted)',marginLeft:6}}>via {p.payment_method||'—'}</span>
                    </div>
                    <div style={{fontSize:12,color:'var(--text-muted)',marginTop:2}}>
                      {p.orders?.requisitions?.description?.slice(0,50)||''}
                      {p.orders?.requisitions?.affaires ? ` · ${p.orders.requisitions.affaires.ref_number}` : ''}
                      {` · ${new Date(p.payment_date).toLocaleDateString('pt-PT')}`}
                      {` · por ${p.employees?.emp_code||'—'}`}
                      {p.reference ? ` · Ref: ${p.reference}` : ''}
                    </div>
                  </div>
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <span style={{fontWeight:600,fontSize:15,color:'var(--green)'}}>€ {parseFloat(p.amount).toLocaleString('pt-PT',{minimumFractionDigits:0})} ✓</span>
                    {isAdmin && <button className="btn btn-sm" style={{color:'var(--red)'}} onClick={()=>handleDeletePayment(p.id,'partial')} title="Apagar"><i className="ti ti-trash"/></button>}
                  </div>
                </div>
              ))}
            </>
        )}
      </div>
    </div>
  )
}
