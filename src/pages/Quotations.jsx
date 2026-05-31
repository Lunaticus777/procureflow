import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

export default function Quotations() {
  const { session } = useAuth()
  const [reqs, setReqs] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [quotes, setQuotes] = useState([])
  const [followups, setFollowups] = useState({})
  const [selReq, setSelReq] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [editQuote, setEditQuote] = useState(null)
  const [showFollowup, setShowFollowup] = useState(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [form, setForm] = useState({ supplier_id:'', supplier_ref:'', unit_price:'', discount_pct:'0', delivery_days:'', valid_until:'', payment_terms:'30 dias', notes:'' })
  const [followupForm, setFollowupForm] = useState({ contact_type:'Telefone', notes:'', next_followup:'' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function load() {
      const [{ data: rData }, { data: sData }] = await Promise.all([
        supabase.from('requisitions').select('*, affaires(name,ref_number)').not('status','eq','Entregue').not('status','eq','Cancelado').order('created_at',{ascending:false}),
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

  const loadFollowups = async (quoteId) => {
    const { data } = await supabase
      .from('quotation_followups')
      .select('*, employees(full_name, emp_code)')
      .eq('quotation_id', quoteId)
      .order('contact_date', { ascending: false })
    setFollowups(f => ({ ...f, [quoteId]: data||[] }))
  }

  const selectReq = (r) => { setSelReq(r); loadQuotes(r.id) }

  const openEdit = (q) => {
    setEditQuote(q)
    setForm({ supplier_id:q.supplier_id, supplier_ref:q.supplier_ref||'', unit_price:q.unit_price, discount_pct:q.discount_pct, delivery_days:q.delivery_days||'', valid_until:q.valid_until||'', payment_terms:q.payment_terms||'30 dias', notes:q.notes||'' })
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.supplier_id || !form.unit_price) return
    setSaving(true)
    const { data: emp } = await supabase.from('employees').select('id').eq('email', session?.user?.email).single()
    if (editQuote) {
      await supabase.from('quotations').update({
        supplier_id: form.supplier_id, supplier_ref: form.supplier_ref, unit_price: parseFloat(form.unit_price),
        discount_pct: parseFloat(form.discount_pct)||0, delivery_days: parseInt(form.delivery_days)||null,
        valid_until: form.valid_until||null, payment_terms: form.payment_terms, notes: form.notes,
      }).eq('id', editQuote.id)
    } else {
      await supabase.from('quotations').insert({
        requisition_id: selReq.id, supplier_id: form.supplier_id, created_by: emp?.id||null,
        supplier_ref: form.supplier_ref, unit_price: parseFloat(form.unit_price),
        discount_pct: parseFloat(form.discount_pct)||0, delivery_days: parseInt(form.delivery_days)||null,
        valid_until: form.valid_until||null, payment_terms: form.payment_terms, notes: form.notes,
      })
      await supabase.from('requisitions').update({ status:'Em cotação' }).eq('id', selReq.id)
    }
    setForm({ supplier_id:'', supplier_ref:'', unit_price:'', discount_pct:'0', delivery_days:'', valid_until:'', payment_terms:'30 dias', notes:'' })
    setShowForm(false)
    setEditQuote(null)
    setSaving(false)
    loadQuotes(selReq.id)
  }

  const handleDelete = async (id) => {
    if (!confirm('Tem a certeza que quer apagar esta cotação?')) return
    const { error } = await supabase.from('quotations').delete().eq('id', id)
    if (error) { alert('Erro ao apagar: ' + error.message); return }
    loadQuotes(selReq.id)
  }

  const handleApprove = async (q) => {
    await supabase.from('quotations').update({ selected: true }).eq('id', q.id)
    await supabase.from('requisitions').update({ status:'Aprovado' }).eq('id', selReq.id)
    const count = Date.now()
    await supabase.from('orders').insert({
      ref_number: `ENC-${String(count).slice(-4)}`,
      requisition_id: selReq.id, quotation_id: q.id, supplier_id: q.supplier_id,
      quantity: selReq.quantity, total_amount: q.final_price * selReq.quantity,
      status: 'Confirmado',
      expected_date: q.delivery_days ? new Date(Date.now()+q.delivery_days*86400000).toISOString().split('T')[0] : null,
    })
    loadQuotes(selReq.id)
  }

  const handleFollowup = async (quoteId) => {
    if (!followupForm.notes) return
    setSaving(true)
    const { data: emp } = await supabase.from('employees').select('id').eq('email', session?.user?.email).single()
    await supabase.from('quotation_followups').insert({
      quotation_id: quoteId, created_by: emp?.id||null,
      contact_type: followupForm.contact_type, notes: followupForm.notes,
      next_followup: followupForm.next_followup||null,
    })
    setFollowupForm({ contact_type:'Telefone', notes:'', next_followup:'' })
    setShowFollowup(null)
    setSaving(false)
    loadFollowups(quoteId)
  }

  const filteredReqs = reqs.filter(r => {
    const s = search.toLowerCase()
    return !s || r.description?.toLowerCase().includes(s) || r.ref_number?.toLowerCase().includes(s) || r.affaires?.name?.toLowerCase().includes(s)
  })

  return (
    <div>
      <div style={{display:'flex',gap:8,marginBottom:12,flexWrap:'wrap',alignItems:'center'}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Pesquisar requisição..." style={{flex:1,minWidth:180,border:'0.5px solid var(--border-hover)',borderRadius:'var(--radius)',padding:'7px 10px',fontSize:13,background:'var(--bg-card)',color:'var(--text)',fontFamily:'inherit'}} />
      </div>
      <div style={{display:'flex',gap:8,marginBottom:16,flexWrap:'wrap'}}>
        {filteredReqs.map(r=>(
          <button key={r.id} className={`btn ${selReq?.id===r.id?'btn-primary':''}`} onClick={()=>selectReq(r)} style={{fontSize:12}}>
            {r.ref_number}{r.affaires?` · ${r.affaires.ref_number}`:''} — {r.description.slice(0,25)}{r.description.length>25?'...':''}
          </button>
        ))}
        {filteredReqs.length===0 && <div className="empty">Nenhuma requisição encontrada.</div>}
      </div>

      {selReq && (
        <>
          {showForm && (
            <div className="card" style={{maxWidth:620,marginBottom:16}}>
              <div className="card-header"><span className="card-title">{editQuote?'Editar Cotação':'Adicionar Cotação'} — {selReq.ref_number}</span></div>
              <div className="form-grid">
                <div className="form-group full"><label>Fornecedor *</label>
                  <select value={form.supplier_id} onChange={e=>setForm({...form,supplier_id:e.target.value})}>
                    <option value="">Selecionar fornecedor...</option>
                    {suppliers.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div className="form-group"><label>Referência do fornecedor</label><input value={form.supplier_ref} onChange={e=>setForm({...form,supplier_ref:e.target.value})} /></div>
                <div className="form-group"><label>Preço unitário (€) *</label><input type="number" step="0.01" value={form.unit_price} onChange={e=>setForm({...form,unit_price:e.target.value})} /></div>
                <div className="form-group"><label>Desconto (%)</label><input type="number" value={form.discount_pct} onChange={e=>setForm({...form,discount_pct:e.target.value})} /></div>
                <div className="form-group"><label>Prazo entrega (dias)</label><input type="number" value={form.delivery_days} onChange={e=>setForm({...form,delivery_days:e.target.value})} /></div>
                <div className="form-group"><label>Validade</label><input type="date" value={form.valid_until} onChange={e=>setForm({...form,valid_until:e.target.value})} /></div>
                <div className="form-group"><label>Condições pagamento</label>
                  <select value={form.payment_terms} onChange={e=>setForm({...form,payment_terms:e.target.value})}>
                    {['Pronto pagamento','30 dias','45 dias','60 dias','90 dias'].map(t=><option key={t}>{t}</option>)}
                  </select>
                </div>
                <div className="form-group full"><label>Notas</label><textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} /></div>
              </div>
              <div className="form-actions">
                <button className="btn" onClick={()=>{setShowForm(false);setEditQuote(null)}}>Cancelar</button>
                <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving?'A guardar...':editQuote?'Guardar alterações':'Guardar Cotação'}</button>
              </div>
            </div>
          )}

          <div className="card">
            <div className="card-header">
              <div>
                <span className="card-title">Cotações — {selReq.ref_number}: {selReq.description}</span>
                {selReq.affaires && <div style={{fontSize:12,color:'var(--blue)',marginTop:2}}><i className="ti ti-building" style={{marginRight:4}}/>{selReq.affaires.ref_number} — {selReq.affaires.name}</div>}
              </div>
              <button className="btn btn-primary" onClick={()=>{setShowForm(true);setEditQuote(null)}}><i className="ti ti-plus"/>Adicionar</button>
            </div>

            {loading ? <div className="loading"><i className="ti ti-loader-2"/>A carregar...</div>
              : quotes.length===0 ? <div className="empty">Sem cotações. Adiciona a primeira!</div>
              : <>
                  <div className="quote-grid" style={{marginBottom:16}}>
                    {quotes.map((q,i)=>{
                      const qFollowups = followups[q.id] || []
                      const lastFollowup = qFollowups[0]
                      const daysSince = lastFollowup ? Math.floor((new Date()-new Date(lastFollowup.contact_date))/86400000) : null
                      return (
                        <div key={q.id} className={`quote-card ${i===0&&!q.selected?'best':''}`}>
                          {i===0&&!q.selected && <div style={{marginBottom:8}}><span style={{background:'var(--blue)',color:'white',fontSize:10,padding:'2px 8px',borderRadius:10}}>Melhor preço</span></div>}
                          {q.selected && <div style={{marginBottom:8}}><span style={{background:'var(--green)',color:'white',fontSize:10,padding:'2px 8px',borderRadius:10}}>✓ Aprovado</span></div>}
                          <div style={{fontWeight:600,marginBottom:10}}>{q.suppliers?.name}</div>
                          <div className="quote-field"><span style={{color:'var(--text-muted)'}}>Preço unit.</span><span>€ {parseFloat(q.unit_price).toFixed(2)}</span></div>
                          <div className="quote-field"><span style={{color:'var(--text-muted)'}}>Desconto</span><span style={{color:'var(--green)'}}>{q.discount_pct}%</span></div>
                          <div className="quote-field"><span style={{color:'var(--text-muted)'}}>Preço final/un.</span><span style={{fontWeight:600}}>€ {parseFloat(q.final_price).toFixed(2)}</span></div>
                          <div className="quote-field"><span style={{color:'var(--text-muted)'}}>Entrega</span><span>{q.delivery_days?`${q.delivery_days} dias`:'—'}</span></div>
                          <div className="quote-field"><span style={{color:'var(--text-muted)'}}>Pagamento</span><span>{q.payment_terms}</span></div>

                          {/* Último relançamento */}
                          {lastFollowup && (
                            <div style={{marginTop:8,padding:'6px 8px',background: daysSince>7?'var(--red-light)':'var(--green-light)',borderRadius:'var(--radius)',fontSize:11}}>
                              <div style={{fontWeight:500}}>Último contacto: há {daysSince} dias</div>
                              <div style={{color:'var(--text-muted)',marginTop:2}}>{lastFollowup.contact_type} · {lastFollowup.employees?.emp_code} · {lastFollowup.notes?.slice(0,60)}</div>
                              {lastFollowup.next_followup && <div style={{marginTop:2,color:'var(--amber)'}}>Próximo: {new Date(lastFollowup.next_followup).toLocaleDateString('pt-PT')}</div>}
                            </div>
                          )}

                          <div style={{marginTop:10,display:'flex',gap:6,flexWrap:'wrap'}}>
                            {!q.selected && <button className="btn btn-primary btn-sm" style={{flex:1,justifyContent:'center'}} onClick={()=>handleApprove(q)}>Aprovar</button>}
                            <button className="btn btn-sm" onClick={()=>{setShowFollowup(showFollowup===q.id?null:q.id);if(!followups[q.id])loadFollowups(q.id)}}><i className="ti ti-phone"/>Relançar</button>
                            <button className="btn btn-sm" onClick={()=>openEdit(q)}><i className="ti ti-edit"/></button>
                            <button className="btn btn-sm" style={{color:'var(--red)'}} onClick={()=>handleDelete(q.id)}><i className="ti ti-trash"/></button>
                          </div>

                          {/* Relançamento form */}
                          {showFollowup===q.id && (
                            <div style={{marginTop:10,padding:'10px',background:'var(--bg)',borderRadius:'var(--radius)'}}>
                              <div style={{fontSize:12,fontWeight:500,marginBottom:8}}>Registar contacto:</div>
                              <div className="form-grid" style={{gap:8}}>
                                <div className="form-group"><label>Tipo</label>
                                  <select value={followupForm.contact_type} onChange={e=>setFollowupForm({...followupForm,contact_type:e.target.value})}>
                                    {['Telefone','Email','WhatsApp'].map(t=><option key={t}>{t}</option>)}
                                  </select>
                                </div>
                                <div className="form-group"><label>Próximo seguimento</label>
                                  <input type="date" value={followupForm.next_followup} onChange={e=>setFollowupForm({...followupForm,next_followup:e.target.value})} />
                                </div>
                                <div className="form-group full"><label>Notas *</label>
                                  <input value={followupForm.notes} onChange={e=>setFollowupForm({...followupForm,notes:e.target.value})} placeholder="Ex: Fornecedor confirma entrega 3ª feira" />
                                </div>
                              </div>
                              <button className="btn btn-primary btn-sm" style={{marginTop:6}} onClick={()=>handleFollowup(q.id)} disabled={saving}>Guardar</button>
                              {/* Histórico */}
                              {(followups[q.id]||[]).length > 0 && (
                                <div style={{marginTop:10,borderTop:'0.5px solid var(--border)',paddingTop:8}}>
                                  <div style={{fontSize:11,fontWeight:500,color:'var(--text-muted)',marginBottom:6}}>Histórico de relançamentos:</div>
                                  {(followups[q.id]||[]).map(f=>(
                                    <div key={f.id} style={{fontSize:11,padding:'4px 0',borderBottom:'0.5px solid var(--border)'}}>
                                      <span style={{fontWeight:500}}>{f.contact_type}</span> · {f.employees?.emp_code} · {new Date(f.contact_date).toLocaleDateString('pt-PT')} — {f.notes}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </>
            }
          </div>
        </>
      )}
    </div>
  )
}
