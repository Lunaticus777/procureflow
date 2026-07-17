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
      supabase.from('payments').select('*, orders(ref_number, total_amount, suppliers(name), requisitions(description,affaires(name,ref_number,id)), quotations(vat_rate,vat_exempt,price_includes_vat))').order('due_date'),
      supabase.from('order_partial_payments').select('*, orders(ref_number, total_amount, suppliers(name), requisitions(description, affaire_id, affaires(name,ref_number,id)), quotations(vat_rate,vat_exempt,price_includes_vat)), employees(full_name,emp_code)').order('payment_date',{ascending:false}),
      supabase.from('clients').select('id,name').eq('active',true).order('name'),
      supabase.from('affaires').select('id,name,ref_number').not('status','eq','Cancelada').order('ref_number'),
      supabase.from('orders').select('id,ref_number,total_amount,status,suppliers(name),requisitions(description,affaires(name,ref_number,id)),quotations(vat_rate,vat_exempt,price_includes_vat)').order('ref_number'),
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

  const handleEditPaidAmount = async (item) => {
    const v = prompt(`Corrigir montante pago (ex.: para remover IVA duplicado). Valor actual: € ${item.amount.toFixed(2)}`, item.amount)
    if (v == null) return
    const newAmount = parseFloat(v)
    if (!newAmount || newAmount <= 0) return
    const table = item.kind === 'partial' ? 'order_partial_payments' : 'payments'
    const { error } = await supabase.from(table).update({ amount:newAmount }).eq('id', item.id)
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

  // Reconciliação: uma fatura pode já estar (parcialmente) paga via order_partial_payments
  // sem que o seu status tenha sido actualizado — sem isto, "por pagar" e "pago" não batem certo.
  const partialsByOrder = supplierPartials.reduce((acc,p) => {
    if (!p.order_id) return acc
    acc[p.order_id] = (acc[p.order_id]||0) + parseFloat(p.amount||0)
    return acc
  }, {})
  // O valor guardado (payments.amount) é exactamente o total da cotação aprovada — pode já incluir
  // IVA ou não, consoante "Preço já inclui IVA" na cotação. Aqui decompomos sempre nos dois valores
  // (S/IVA e C/IVA) na direcção certa, em vez de assumir sempre que o valor guardado é S/IVA.
  const splitVat = (total, vatExempt, vatRate, priceIncludesVat) => {
    if (vatExempt || !vatRate) return { vatAmount: 0, totalExclVat: total, totalInclVat: total }
    if (priceIncludesVat) {
      const totalExclVat = total / (1 + vatRate/100)
      return { vatAmount: total - totalExclVat, totalExclVat, totalInclVat: total }
    }
    const vatAmount = total * vatRate/100
    return { vatAmount, totalExclVat: total, totalInclVat: total + vatAmount }
  }

  // Deteta encomendas com mais do que uma fatura registada (duplicados) — inflacionam os totais
  const orderInvoiceCounts = supplierInvoices.reduce((acc,p) => {
    if (!p.order_id) return acc
    acc[p.order_id] = (acc[p.order_id]||0) + 1
    return acc
  }, {})

  const enrichInvoice = (p) => {
    const amount = parseFloat(p.amount||0)
    const paidViaPartials = partialsByOrder[p.order_id] || 0
    const remaining = p.status==='Pago' ? 0 : Math.max(0, amount - paidViaPartials)
    const vatExempt = p.orders?.quotations?.vat_exempt || false
    const vatRate = parseFloat(p.orders?.quotations?.vat_rate ?? 23)
    const priceIncludesVat = p.orders?.quotations?.price_includes_vat || false
    const { vatAmount, totalExclVat: remainingExclVat, totalInclVat: remainingInclVat } = splitVat(remaining, vatExempt, vatRate, priceIncludesVat)
    const isDuplicate = p.order_id && orderInvoiceCounts[p.order_id] > 1
    return { ...p, amount, paidViaPartials, remaining, vatExempt, vatRate, priceIncludesVat, vatAmount, remainingExclVat, remainingInclVat, isDuplicate, isPaid: p.status==='Pago' || remaining<=0.01 }
  }
  const enrichedInvoicesAll = supplierInvoices.map(enrichInvoice)
  const enrichedInvoicesFiltered = filteredInvoices.map(enrichInvoice)

  // Faturas marcadas como pagas directamente (sem pagamento parcial registado) — precisam de aparecer em "Pago"
  const paidInvoicesOnly = enrichedInvoicesFiltered.filter(p => p.status==='Pago' && !partialsByOrder[p.order_id])
  const vatFor = (order, amount) => {
    const vatExempt = order?.quotations?.vat_exempt || false
    const vatRate = parseFloat(order?.quotations?.vat_rate ?? 23)
    const priceIncludesVat = order?.quotations?.price_includes_vat || false
    const { vatAmount, totalExclVat, totalInclVat } = splitVat(amount, vatExempt, vatRate, priceIncludesVat)
    return { vatExempt, vatRate, priceIncludesVat, vatAmount, totalExclVat, totalInclVat }
  }

  // Encomendas activas sem NENHUMA fatura registada — o seu valor conta em "Valor encomendas" mas
  // ficava invisível aqui, criando uma diferença nos totais. Mostram-se como entradas virtuais.
  const activeOrders = orders.filter(o => ['Confirmado','Em trânsito','Entregue'].includes(o.status))
  const unbilledOrders = activeOrders.filter(o => {
    if (supplierInvoices.some(inv => inv.order_id === o.id)) return false
    const matchS = !s || o.suppliers?.name?.toLowerCase().includes(s) || o.ref_number?.toLowerCase().includes(s) || o.requisitions?.description?.toLowerCase().includes(s) || o.requisitions?.affaires?.name?.toLowerCase().includes(s)
    const matchA = !fa || o.requisitions?.affaires?.id === fa
    return matchS && matchA
  })
  const unbilledItems = unbilledOrders.map(o => {
    const total = parseFloat(o.total_amount||0)
    const { vatExempt, vatRate, priceIncludesVat, vatAmount, totalExclVat, totalInclVat } = vatFor(o, total)
    return {
      id: `unbilled-${o.id}`, orderId: o.id, isUnbilled: true, orders: o, invoice_ref: null, due_date: null, notes: null,
      vatExempt, vatRate, priceIncludesVat, vatAmount, paidViaPartials: 0,
      remainingExclVat: totalExclVat, remainingInclVat: totalInclVat, isDuplicate: false,
    }
  })

  const toPay = [...enrichedInvoicesFiltered.filter(p => !p.isPaid), ...unbilledItems]
  const paidItems = [
    ...paidInvoicesOnly.map(p => ({ kind:'invoice', id:p.id, date:p.paid_date, amount:p.amount, supplier:p.orders?.suppliers?.name, orderRef:p.orders?.ref_number, desc:p.orders?.requisitions?.description, affaire:p.orders?.requisitions?.affaires, invoiceRef:p.invoice_ref, ...vatFor(p.orders, p.amount) })),
    ...filteredPartials.map(p => { const amount = parseFloat(p.amount||0); return { kind:'partial', id:p.id, date:p.payment_date, amount, supplier:p.orders?.suppliers?.name, orderRef:p.orders?.ref_number, desc:p.orders?.requisitions?.description, affaire:p.orders?.requisitions?.affaires, method:p.payment_method, empCode:p.employees?.emp_code, reference:p.reference, ...vatFor(p.orders, amount) } }),
  ].sort((a,b) => new Date(b.date||0) - new Date(a.date||0))

  // Totais (sempre sobre o universo completo, independente da pesquisa/filtro)
  const totalClientPending = clientPayments.filter(p=>p.status!=='Pago').reduce((acc,p)=>acc+parseFloat(p.amount||0),0)
  const totalClientReceived = clientPayments.filter(p=>p.status==='Pago').reduce((acc,p)=>acc+parseFloat(p.amount||0),0)
  const totalSupplierToPay = enrichedInvoicesAll.filter(p=>!p.isPaid).reduce((acc,p)=>acc+p.remainingExclVat,0)
  const totalSupplierToPayVat = enrichedInvoicesAll.filter(p=>!p.isPaid).reduce((acc,p)=>acc+p.vatAmount,0)
  const totalSupplierToPayInclVat = enrichedInvoicesAll.filter(p=>!p.isPaid).reduce((acc,p)=>acc+p.remainingInclVat,0)
  const totalPartialsPaid = supplierPartials.reduce((acc,p)=>acc+parseFloat(p.amount||0),0)
  const totalSupplierPaid = totalPartialsPaid + enrichedInvoicesAll.filter(p=>p.status==='Pago' && !partialsByOrder[p.order_id]).reduce((acc,p)=>acc+p.amount,0)

  // Valor total das encomendas (Confirmado + Em trânsito + Entregue) — igual ao mostrado em Encomendas,
  // independente de já haver ou não fatura registada, para servir de referência/conferência.
  const activeOrdersForTotal = orders.filter(o => ['Confirmado','Em trânsito','Entregue'].includes(o.status))
  const totalOrdersExclVat = activeOrdersForTotal.reduce((acc,o) => acc + vatFor(o, parseFloat(o.total_amount||0)).totalExclVat, 0)
  const totalOrdersInclVat = activeOrdersForTotal.reduce((acc,o) => acc + vatFor(o, parseFloat(o.total_amount||0)).totalInclVat, 0)

  // Totais do separador (respeitam pesquisa/filtro de obra)
  const totalToPay = toPay.reduce((acc,p)=>acc+p.remainingExclVat,0)
  const totalToPayVat = toPay.reduce((acc,p)=>acc+p.vatAmount,0)
  const totalToPayInclVat = toPay.reduce((acc,p)=>acc+p.remainingInclVat,0)
  const totalPaidItems = paidItems.reduce((acc,p)=>acc+p.totalExclVat,0)
  const totalPaidItemsVat = paidItems.reduce((acc,p)=>acc+p.vatAmount,0)
  const totalPaidItemsInclVat = paidItems.reduce((acc,p)=>acc+p.totalInclVat,0)

  // Encomendas ainda sem fatura registada (evita duplicar a fatura criada automaticamente ao aprovar a cotação)
  const ordersWithoutInvoice = orders.filter(o => o.status!=='Cancelado' && !supplierInvoices.some(inv => inv.order_id === o.id))

  if (loading) return <div className="loading"><i className="ti ti-loader-2"/>A carregar...</div>

  return (
    <div>
      <div className="metrics">
        <div className="metric"><div className="metric-label">A receber (clientes)</div><div className="metric-value text-amber">€ {totalClientPending.toLocaleString('pt-PT',{minimumFractionDigits:0})}</div></div>
        <div className="metric"><div className="metric-label">Recebido de clientes</div><div className="metric-value text-green">€ {totalClientReceived.toLocaleString('pt-PT',{minimumFractionDigits:0})}</div></div>
        <div className="metric"><div className="metric-label">Faturas por pagar (S/IVA)</div><div className="metric-value text-red">€ {totalSupplierToPay.toLocaleString('pt-PT',{minimumFractionDigits:0})}</div><div className="metric-sub">c/IVA: € {totalSupplierToPayInclVat.toLocaleString('pt-PT',{minimumFractionDigits:0})}</div></div>
        <div className="metric"><div className="metric-label">Pago a fornecedores</div><div className="metric-value text-green">€ {(totalSupplierPaid + totalPartialsPaid).toLocaleString('pt-PT',{minimumFractionDigits:0})}</div></div>
        <div className="metric"><div className="metric-label">Valor encomendas (S/IVA)</div><div className="metric-value text-blue">€ {totalOrdersExclVat.toLocaleString('pt-PT',{minimumFractionDigits:0})}</div><div className="metric-sub">c/IVA: € {totalOrdersInclVat.toLocaleString('pt-PT',{minimumFractionDigits:0})} · Confirmado+Trânsito+Entregue</div></div>
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
                {ordersWithoutInvoice.map(o=><option key={o.id} value={o.id}>{o.ref_number} — {o.suppliers?.name}</option>)}
              </select>
              {ordersWithoutInvoice.length===0 && <div style={{fontSize:11,color:'var(--text-muted)',marginTop:4}}>Todas as encomendas já têm fatura registada.</div>}
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
              Faturas — Fornecedores ({toPay.length} pend.) <button className="btn btn-sm" style={{marginLeft:8,fontSize:10}} onClick={syncPaidInvoices}>🔄 Sincronizar</button>
            </div>
            <div className={`tab ${tab==='partials'?'active':''}`} onClick={()=>setTab('partials')}>
              Pagamentos efectuados ({paidItems.length})
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
          toPay.length===0 ? <div className="empty">Sem faturas por pagar.</div>
          : <>
              <div style={{padding:'8px 12px',background:'var(--red-light)',borderRadius:'var(--radius)',marginBottom:12,fontSize:13}}>
                <strong style={{color:'var(--red)'}}>Total em aberto: € {totalToPay.toLocaleString('pt-PT',{minimumFractionDigits:2})} (S/IVA)</strong>
                <span style={{color:'var(--text-muted)',marginLeft:8}}>· € {totalToPayInclVat.toLocaleString('pt-PT',{minimumFractionDigits:2})} (C/IVA) · {toPay.length} fatura(s)</span>
              </div>
              {toPay.some(p=>p.isDuplicate) && (
                <div style={{padding:'8px 12px',background:'var(--amber-light)',borderRadius:'var(--radius)',marginBottom:12,fontSize:12,color:'#633806'}}>
                  ⚠️ Há encomendas com mais do que uma fatura registada (marcadas "Duplicado" abaixo) — isso infla o total. Apaga a fatura a mais em cada uma.
                </div>
              )}
              {toPay.some(p=>p.isUnbilled) && (
                <div style={{padding:'8px 12px',background:'var(--amber-light)',borderRadius:'var(--radius)',marginBottom:12,fontSize:12,color:'#633806'}}>
                  ℹ️ {toPay.filter(p=>p.isUnbilled).length} encomenda(s) activa(s) ainda não têm fatura registada (marcadas "Sem fatura" abaixo) — o valor delas já entra neste total. Usa "Registar fatura" para lhes associar o nº de fatura real.
                </div>
              )}
              {toPay.map(p=>(
                <div key={p.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 0',borderBottom:'0.5px solid var(--border)',flexWrap:'wrap',gap:8}}>
                  <div>
                    <div style={{fontWeight:500,fontSize:13}}>
                      {p.orders?.suppliers?.name||'—'} {p.invoice_ref?`· Fatura: ${p.invoice_ref}`:''}
                      {p.isDuplicate && <span style={{marginLeft:6,fontSize:10,background:'var(--red)',color:'white',padding:'1px 6px',borderRadius:10,fontWeight:600}}>⚠️ Duplicado</span>}
                      {p.isUnbilled && <span style={{marginLeft:6,fontSize:10,background:'var(--amber)',color:'white',padding:'1px 6px',borderRadius:10,fontWeight:600}}>Sem fatura registada</span>}
                    </div>
                    <div style={{fontSize:12,color:'var(--text-muted)',marginTop:2}}>
                      {p.orders?.ref_number||'—'}
                      {p.orders?.requisitions?.description ? ` · ${p.orders.requisitions.description.slice(0,40)}` : ''}
                      {p.orders?.requisitions?.affaires ? ` · ${p.orders.requisitions.affaires.ref_number}` : ''}
                      {p.due_date?` · Vence ${new Date(p.due_date).toLocaleDateString('pt-PT')}`:''}
                      {p.paidViaPartials>0?` · Pago parcialmente: € ${p.paidViaPartials.toLocaleString('pt-PT',{minimumFractionDigits:2})}`:''}
                    </div>
                    <div style={{fontSize:11,marginTop:2}}>
                      {p.vatExempt
                        ? <span style={{color:'var(--green)'}}>✈️ IVA 0% (exportação)</span>
                        : p.priceIncludesVat
                          ? <span style={{color:'var(--text-muted)'}}>dos quais € {p.vatAmount.toLocaleString('pt-PT',{minimumFractionDigits:2})} de IVA ({p.vatRate}%) — preço já incluía IVA</span>
                          : <span style={{color:'var(--text-muted)'}}>+ € {p.vatAmount.toLocaleString('pt-PT',{minimumFractionDigits:2})} IVA ({p.vatRate}%)</span>}
                    </div>
                    {p.notes && <div style={{fontSize:11,fontStyle:'italic',color:'var(--text-muted)'}}>{p.notes}</div>}
                  </div>
                  <div style={{display:'flex',alignItems:'center',gap:10}}>
                    <div style={{textAlign:'right'}}>
                      <div style={{fontWeight:600,fontSize:15}}>€ {p.remainingExclVat.toLocaleString('pt-PT',{minimumFractionDigits:2})}</div>
                      <div style={{fontSize:11,color:'var(--text-muted)'}}>c/IVA € {p.remainingInclVat.toLocaleString('pt-PT',{minimumFractionDigits:2})}</div>
                    </div>
                    {p.isUnbilled
                      ? <span className="badge badge-warning">Sem fatura</span>
                      : <span className={`badge ${badgeClass(p)}`}>{badgeLabel(p)}</span>}
                    {p.isUnbilled
                      ? <button className="btn btn-primary btn-sm" onClick={()=>{setPayType('supplier');setForm(f=>({...f,order_id:p.orderId}));setShowForm(true)}}>Registar fatura</button>
                      : <button className="btn btn-primary btn-sm" onClick={()=>markPaid(p.id,'supplier')}>Pago ✓</button>}
                    {!p.isUnbilled && isAdmin && <button className="btn btn-sm" style={{color:'var(--red)'}} onClick={()=>handleDeletePayment(p.id,'invoice')} title="Apagar"><i className="ti ti-trash"/></button>}
                  </div>
                </div>
              ))}
            </>
        )}

        {/* Pagamentos efectuados (parciais + faturas marcadas pagas directamente) */}
        {tab==='partials' && (
          paidItems.length===0 ? <div className="empty">Sem pagamentos registados.</div>
          : <>
              <div style={{padding:'8px 12px',background:'var(--green-light)',borderRadius:'var(--radius)',marginBottom:12,fontSize:13}}>
                <strong style={{color:'var(--green)'}}>Total pago: € {totalPaidItems.toLocaleString('pt-PT',{minimumFractionDigits:2})} (S/IVA)</strong>
                <span style={{color:'var(--text-muted)',marginLeft:8}}>· € {totalPaidItemsInclVat.toLocaleString('pt-PT',{minimumFractionDigits:2})} (C/IVA) · {paidItems.length} pagamento(s)</span>
              </div>
              {paidItems.map(p=>(
                <div key={`${p.kind}-${p.id}`} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 0',borderBottom:'0.5px solid var(--border)',flexWrap:'wrap',gap:8}}>
                  <div>
                    <div style={{fontWeight:500,fontSize:13}}>
                      {p.supplier||'—'} · {p.orderRef||'—'}
                      <span style={{fontWeight:400,fontSize:12,color:'var(--text-muted)',marginLeft:6}}>{p.kind==='partial'?`via ${p.method||'—'}`:'fatura paga directamente'}</span>
                    </div>
                    <div style={{fontSize:12,color:'var(--text-muted)',marginTop:2}}>
                      {p.desc?.slice(0,50)||''}
                      {p.affaire ? ` · ${p.affaire.ref_number}` : ''}
                      {p.date ? ` · ${new Date(p.date).toLocaleDateString('pt-PT')}` : ''}
                      {p.empCode ? ` · por ${p.empCode}` : ''}
                      {p.reference ? ` · Ref: ${p.reference}` : ''}
                      {p.invoiceRef ? ` · Fatura: ${p.invoiceRef}` : ''}
                    </div>
                    <div style={{fontSize:11,marginTop:2}}>
                      {p.vatExempt
                        ? <span style={{color:'var(--green)'}}>✈️ IVA 0% (exportação)</span>
                        : p.priceIncludesVat
                          ? <span style={{color:'var(--text-muted)'}}>dos quais € {p.vatAmount.toLocaleString('pt-PT',{minimumFractionDigits:2})} de IVA ({p.vatRate}%) — preço já incluía IVA</span>
                          : <span style={{color:'var(--text-muted)'}}>+ € {p.vatAmount.toLocaleString('pt-PT',{minimumFractionDigits:2})} IVA ({p.vatRate}%)</span>}
                    </div>
                  </div>
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <div style={{textAlign:'right'}}>
                      <div style={{fontWeight:600,fontSize:15,color:'var(--green)'}}>€ {p.totalExclVat.toLocaleString('pt-PT',{minimumFractionDigits:2})} ✓</div>
                      <div style={{fontSize:11,color:'var(--text-muted)'}}>c/IVA € {p.totalInclVat.toLocaleString('pt-PT',{minimumFractionDigits:2})}</div>
                    </div>
                    {isAdmin && <button className="btn btn-sm" onClick={()=>handleEditPaidAmount(p)} title="Corrigir montante"><i className="ti ti-edit"/></button>}
                    {isAdmin && <button className="btn btn-sm" style={{color:'var(--red)'}} onClick={()=>handleDeletePayment(p.id,p.kind==='partial'?'partial':'invoice')} title="Apagar"><i className="ti ti-trash"/></button>}
                  </div>
                </div>
              ))}
            </>
        )}
      </div>
    </div>
  )
}
