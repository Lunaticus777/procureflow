import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

export default function Quotations() {
  const { session } = useAuth()
  const [reqs, setReqs] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [quotes, setQuotes] = useState([])
  const [selReq, setSelReq] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ supplier_id:'', supplier_ref:'', unit_price:'', discount_pct:'0', delivery_days:'', valid_until:'', payment_terms:'30 dias', notes:'' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function load() {
      const [{ data: rData }, { data: sData }] = await Promise.all([
        supabase.from('requisitions').select('*').not('status','eq','Entregue').order('created_at',{ascending:false}),
        supabase.from('suppliers').select('*').eq('active',true).order('name'),
      ])
      setReqs(rData||[])
      setSuppliers(sData||[])
      if (rData?.[0]) { setSelReq(rData[0]); loadQuotes(rData[0].id) }
      else setLoading(false)
    }
    load()
  }, [])

  const loadQuotes = async (reqId) => {
    setLoading(true)
    const { data } = await supabase
      .from('quotations')
      .select('*, suppliers(name), employees(full_name, emp_code)')
      .eq('requisition_id', reqId)
      .order('final_price')
    setQuotes(data||[])
    setLoading(false)
  }

  const selectReq = (r) => { setSelReq(r); loadQuotes(r.id) }

  const handleSave = async () => {
    if (!form.supplier_id || !form.unit_price) return
    setSaving(true)
    const { data: emp } = await supabase.from('employees').select('id').eq('email', session?.user?.email).single()
    await supabase.from('quotations').insert({
      requisition_id: selReq.id,
      supplier_id: form.supplier_id,
      created_by: emp?.id || null,
      supplier_ref: form.supplier_ref,
      unit_price: parseFloat(form.unit_price),
      discount_pct: parseFloat(form.discount_pct)||0,
      delivery_days: parseInt(form.delivery_days)||null,
      valid_until: form.valid_until||null,
      payment_terms: form.payment_terms,
      notes: form.notes,
    })
    // update requisition status
    await supabase.from('requisitions').update({ status:'Em cotação' }).eq('id', selReq.id)
    setForm({ supplier_id:'', supplier_ref:'', unit_price:'', discount_pct:'0', delivery_days:'', valid_until:'', payment_terms:'30 dias', notes:'' })
    setShowForm(false)
    setSaving(false)
    loadQuotes(selReq.id)
  }

  const handleApprove = async (q) => {
    // mark this quote selected, update requisition
    await supabase.from('quotations').update({ selected: true }).eq('id', q.id)
    await supabase.from('requisitions').update({ status:'Aprovado' }).eq('id', selReq.id)
    // create order
    const count = Date.now()
    await supabase.from('orders').insert({
      ref_number: `ENC-${String(count).slice(-4)}`,
      requisition_id: selReq.id,
      quotation_id: q.id,
      supplier_id: q.supplier_id,
      quantity: selReq.quantity,
      total_amount: q.final_price * selReq.quantity,
      status: 'Confirmado',
      expected_date: q.delivery_days ? new Date(Date.now() + q.delivery_days*86400000).toISOString().split('T')[0] : null,
    })
    loadQuotes(selReq.id)
  }

  return (
    <div>
      <div style={{display:'flex',gap:12,marginBottom:16,flexWrap:'wrap'}}>
        {reqs.map(r=>(
          <button key={r.id} className={`btn ${selReq?.id===r.id?'btn-primary':''}`} onClick={()=>selectReq(r)} style={{fontSize:12}}>
            {r.ref_number} — {r.description.slice(0,30)}{r.description.length>30?'...':''}
          </button>
        ))}
        {reqs.length===0 && <div className="empty">Sem requisições abertas.</div>}
      </div>

      {selReq && (
        <>
          {showForm && (
            <div className="card" style={{maxWidth:620,marginBottom:16}}>
              <div className="card-header"><span className="card-title">Adicionar Cotação — {selReq.ref_number}</span></div>
              <div className="form-grid">
                <div className="form-group full">
                  <label>Fornecedor *</label>
                  <select value={form.supplier_id} onChange={e=>setForm({...form,supplier_id:e.target.value})}>
                    <option value="">Selecionar fornecedor...</option>
                    {suppliers.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div className="form-group"><label>Referência do fornecedor</label><input value={form.supplier_ref} onChange={e=>setForm({...form,supplier_ref:e.target.value})} placeholder="Ref. produto" /></div>
                <div className="form-group"><label>Preço unitário (€) *</label><input type="number" step="0.01" value={form.unit_price} onChange={e=>setForm({...form,unit_price:e.target.value})} /></div>
                <div className="form-group"><label>Desconto (%)</label><input type="number" value={form.discount_pct} onChange={e=>setForm({...form,discount_pct:e.target.value})} /></div>
                <div className="form-group"><label>Prazo entrega (dias úteis)</label><input type="number" value={form.delivery_days} onChange={e=>setForm({...form,delivery_days:e.target.value})} /></div>
                <div className="form-group"><label>Validade proposta</label><input type="date" value={form.valid_until} onChange={e=>setForm({...form,valid_until:e.target.value})} /></div>
                <div className="form-group"><label>Condições pagamento</label>
                  <select value={form.payment_terms} onChange={e=>setForm({...form,payment_terms:e.target.value})}>
                    {['Pronto pagamento','30 dias','45 dias','60 dias','90 dias'].map(t=><option key={t}>{t}</option>)}
                  </select>
                </div>
                <div className="form-group full"><label>Notas</label><textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="Condições especiais, garantias..." /></div>
              </div>
              <div className="form-actions">
                <button className="btn" onClick={()=>setShowForm(false)}>Cancelar</button>
                <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving?'A guardar...':'Guardar Cotação'}</button>
              </div>
            </div>
          )}

          <div className="card">
            <div className="card-header">
              <span className="card-title">Cotações — {selReq.ref_number}: {selReq.description}</span>
              <button className="btn btn-primary" onClick={()=>setShowForm(true)}><i className="ti ti-plus"/>Adicionar cotação</button>
            </div>

            {loading ? <div className="loading"><i className="ti ti-loader-2"/>A carregar...</div>
              : quotes.length===0 ? <div className="empty">Sem cotações ainda. Adiciona a primeira!</div>
              : <>
                  <div className="quote-grid" style={{marginBottom:16}}>
                    {quotes.map((q,i)=>(
                      <div key={q.id} className={`quote-card ${i===0?'best':''}`}>
                        {i===0 && <div style={{marginBottom:8}}><span style={{background:'var(--blue)',color:'white',fontSize:10,padding:'2px 8px',borderRadius:10}}>Melhor preço</span></div>}
                        <div style={{fontWeight:600,marginBottom:10}}>{q.suppliers?.name}</div>
                        <div className="quote-field"><span style={{color:'var(--text-muted)'}}>Preço unit.</span><span>€ {parseFloat(q.unit_price).toFixed(2)}</span></div>
                        <div className="quote-field"><span style={{color:'var(--text-muted)'}}>Desconto</span><span style={{color:'var(--green)'}}>{q.discount_pct}%</span></div>
                        <div className="quote-field"><span style={{color:'var(--text-muted)'}}>Preço final/un.</span><span style={{fontWeight:600}}>€ {parseFloat(q.final_price).toFixed(2)}</span></div>
                        <div className="quote-field"><span style={{color:'var(--text-muted)'}}>Entrega</span><span>{q.delivery_days ? `${q.delivery_days} dias` : '—'}</span></div>
                        <div className="quote-field"><span style={{color:'var(--text-muted)'}}>Pagamento</span><span>{q.payment_terms}</span></div>
                        {q.notes && <div style={{fontSize:11,color:'var(--text-muted)',marginTop:8,fontStyle:'italic'}}>{q.notes}</div>}
                        <div style={{marginTop:12}}>
                          {q.selected
                            ? <button className="btn" style={{width:'100%',justifyContent:'center',fontSize:12,color:'var(--green)',borderColor:'var(--green)'}}>✓ Aprovado</button>
                            : <button className="btn btn-primary" style={{width:'100%',justifyContent:'center',fontSize:12}} onClick={()=>handleApprove(q)}>Aprovar e Encomendar</button>
                          }
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="table-wrap">
                    <table>
                      <thead><tr><th>Fornecedor</th><th>Ref.</th><th>Preço unit.</th><th>Desconto</th><th>Final/un.</th><th>Entrega</th><th>Validade</th><th>Estado</th></tr></thead>
                      <tbody>
                        {quotes.map(q=>(
                          <tr key={q.id}>
                            <td style={{fontWeight:500}}>{q.suppliers?.name}</td>
                            <td style={{fontSize:12,color:'var(--text-muted)'}}>{q.supplier_ref||'—'}</td>
                            <td>€ {parseFloat(q.unit_price).toFixed(2)}</td>
                            <td style={{color:'var(--green)'}}>{q.discount_pct}%</td>
                            <td style={{fontWeight:600}}>€ {parseFloat(q.final_price).toFixed(2)}</td>
                            <td>{q.delivery_days ? `${q.delivery_days} dias` : '—'}</td>
                            <td style={{fontSize:12}}>{q.valid_until ? new Date(q.valid_until).toLocaleDateString('pt-PT') : '—'}</td>
                            <td>{q.selected ? <span className="badge badge-approved">Selecionado</span> : <span className="badge badge-pending">Em análise</span>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
            }
          </div>
        </>
      )}
    </div>
  )
}
