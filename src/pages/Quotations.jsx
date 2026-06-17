import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { logActivity } from '../hooks/useActivity'
import { useRole } from '../hooks/useRole'

function ImageFromStorage({ path }) {
  const [url, setUrl] = useState(null)
  useEffect(() => {
    if (!path) return
    if (path.startsWith('http') || path.startsWith('data:')) { setUrl(path); return }
    supabase.storage.from('procureflow-docs').createSignedUrl(path, 3600)
      .then(({ data }) => { if (data?.signedUrl) setUrl(data.signedUrl) })
  }, [path])
  if (!url) return null
  return <img src={url} alt="ref" style={{maxWidth:'100%',maxHeight:120,borderRadius:'var(--border-radius-md)',objectFit:'contain',border:'0.5px solid var(--border)',background:'var(--bg)'}} />
}

export default function Quotations() {
  const { session } = useAuth()
  const { isAdmin } = useRole()
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
  const [filterAffaire, setFilterAffaire] = useState('')
  const [form, setForm] = useState({ supplier_id:'', supplier_ref:'', unit_price:'', discount_pct:'0', delivery_price:'', delivery_days:'', valid_until:'', payment_terms:'30 dias', notes:'', vat_rate:'23', vat_exempt:false, price_includes_vat:false, delivery_type:'', delivery_address:'', delivery_city:'' })
  const [followupForm, setFollowupForm] = useState({ contact_type:'Telefone', notes:'', next_followup:'' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function load() {
      const [{ data: rData }, { data: sData }] = await Promise.all([
        supabase.from('requisitions').select('*, affaires(name,ref_number,id), employees(full_name,emp_code)').not('status','eq','Entregue').not('status','eq','Cancelado').order('created_at',{ascending:false}),
        supabase.from('affaires').select('id,name,ref_number').not('status','eq','Cancelada').order('ref_number'),
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
    const { data } = await supabase.from('quotations').select('*, suppliers(name), employees(full_name, emp_code)').eq('requisition_id', reqId).order('final_price')
    setQuotes(data||[])
    setLoading(false)
  }

  const loadFollowups = async (quoteId) => {
    const { data } = await supabase.from('quotation_followups').select('*, employees(full_name, emp_code)').eq('quotation_id', quoteId).order('contact_date', { ascending: false })
    setFollowups(f => ({ ...f, [quoteId]: data||[] }))
  }

  const selectReq = (r) => { setSelReq(r); loadQuotes(r.id) }

  const openEdit = (q) => {
    setEditQuote(q)
    setForm({ supplier_id:q.supplier_id, supplier_ref:q.supplier_ref||'', unit_price:q.unit_price, discount_pct:q.discount_pct, delivery_price:q.delivery_price||'', delivery_days:q.delivery_days||'', valid_until:q.valid_until||'', payment_terms:q.payment_terms||'30 dias', notes:q.notes||'', vat_rate:q.vat_rate||'23', vat_exempt:q.vat_exempt||false, price_includes_vat:q.price_includes_vat||false, delivery_type:q.delivery_type||'', delivery_address:q.delivery_address||'', delivery_city:q.delivery_city||'' })
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.supplier_id || !form.unit_price) return
    setSaving(true)
    const { data: emp } = await supabase.from('employees').select('id').eq('email', session?.user?.email).single()
    if (editQuote) {
      await supabase.from('quotations').update({
        supplier_id: form.supplier_id, supplier_ref: form.supplier_ref, unit_price: parseFloat(form.unit_price),
        discount_pct: parseFloat(form.discount_pct)||0, delivery_price: form.delivery_price?parseFloat(form.delivery_price):null, delivery_days: parseInt(form.delivery_days)||null,
        valid_until: form.valid_until||null, payment_terms: form.payment_terms, notes: form.notes,
        vat_rate: parseFloat(form.vat_rate)||23, vat_exempt: form.vat_exempt, price_includes_vat: form.price_includes_vat,
        delivery_type: form.delivery_type||null, delivery_address: form.delivery_address||null, delivery_city: form.delivery_city||null,
      }).eq('id', editQuote.id)
    } else {
      await supabase.from('quotations').insert({
        requisition_id: selReq.id, supplier_id: form.supplier_id, created_by: emp?.id||null,
        supplier_ref: form.supplier_ref, unit_price: parseFloat(form.unit_price),
        discount_pct: parseFloat(form.discount_pct)||0, delivery_price: form.delivery_price?parseFloat(form.delivery_price):null, delivery_days: parseInt(form.delivery_days)||null,
        valid_until: form.valid_until||null, payment_terms: form.payment_terms, notes: form.notes,
        vat_rate: parseFloat(form.vat_rate)||23, vat_exempt: form.vat_exempt, price_includes_vat: form.price_includes_vat,
        delivery_type: form.delivery_type||null, delivery_address: form.delivery_address||null, delivery_city: form.delivery_city||null,
      })
      await supabase.from('requisitions').update({ status:'Em cotação' }).eq('id', selReq.id)
    }
    setForm({ supplier_id:'', supplier_ref:'', unit_price:'', discount_pct:'0', delivery_days:'', valid_until:'', payment_terms:'30 dias', notes:'' })
    setShowForm(false); setEditQuote(null); setSaving(false)
    loadQuotes(selReq.id)
  }

  const handleDelete = async (id) => {
    if (!confirm('Apagar esta cotação?')) return
    const { error } = await supabase.from('quotations').delete().eq('id', id)
    if (error) { alert('Erro: ' + error.message); return }
    loadQuotes(selReq.id)
  }

  const handleApprove = async (q) => {
    // Mark this one as approved
    await supabase.from('quotations').update({ selected: true }).eq('id', q.id)
    const { data: empLog } = await supabase.from('employees').select('id').eq('email', session?.user?.email).single()
    await logActivity({ empId: empLog?.id, action: 'approved', entityType: 'quotation', entityRef: selReq.ref_number, description: `aprovou cotação de ${q.suppliers?.name} para ${selReq.description.slice(0,40)} — ${q.final_price}€/un`, affaireId: selReq.affaire_id||null })
    // Mark all others for same requisition as rejected
    await supabase.from('quotations').update({ selected: false, rejected: true }).eq('requisition_id', selReq.id).neq('id', q.id)
    await supabase.from('requisitions').update({ status:'Aprovado' }).eq('id', selReq.id)
    const count = Date.now()
    const total = q.final_price * selReq.quantity
    // Criar encomenda
    const { data: order } = await supabase.from('orders').insert({
      ref_number: `ENC-${String(count).slice(-4)}`,
      requisition_id: selReq.id, quotation_id: q.id, supplier_id: q.supplier_id,
      quantity: selReq.quantity, total_amount: total, status: 'Confirmado',
      expected_date: q.delivery_days ? new Date(Date.now()+q.delivery_days*86400000).toISOString().split('T')[0] : null,
    }).select().single()
    // Nota: o trigger da base de dados já cria automaticamente o pagamento pendente
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
    setShowFollowup(null); setSaving(false)
    loadFollowups(quoteId)
  }

  const filteredReqs = reqs.filter(r => {
    const s = search.toLowerCase()
    const matchSearch = !s || r.description?.toLowerCase().includes(s) || r.ref_number?.toLowerCase().includes(s) || r.affaires?.name?.toLowerCase().includes(s) || r.affaires?.ref_number?.toLowerCase().includes(s) || r.employees?.emp_code?.toLowerCase().includes(s) || r.status?.toLowerCase().includes(s)
    const matchAffaire = !filterAffaire || r.affaire_id === filterAffaire
    return matchSearch && matchAffaire
  })

  return (
    <div style={{display:'flex',gap:16,alignItems:'flex-start',height:'calc(100vh - 140px)'}}>
      {/* Lista de requisições */}
      <div style={{width:280,flexShrink:0,overflowY:'auto',height:'100%'}}>
        <div className="card">
          <div className="card-header"><span className="card-title">Requisições</span></div>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Pesquisar..." style={{width:'100%',marginBottom:10,border:'0.5px solid var(--border-hover)',borderRadius:'var(--radius)',padding:'6px 10px',fontSize:13,background:'var(--bg-card)',color:'var(--text)',fontFamily:'inherit'}} />
          {filteredReqs.length===0
            ? <div className="empty">Sem requisições.</div>
            : filteredReqs.map(r=>(
                <div key={r.id} onClick={()=>selectReq(r)}
                  style={{padding:'10px',marginBottom:6,borderRadius:'var(--radius)',border:`1px solid ${selReq?.id===r.id?'var(--blue)':'var(--border)'}`,background:selReq?.id===r.id?'var(--blue-light)':'var(--bg-card)',cursor:'pointer'}}>
                  <div style={{fontWeight:500,fontSize:12,color:'var(--text-muted)',marginBottom:2}}>{r.ref_number} {r.affaires&&<span style={{color:'var(--blue)'}}>· {r.affaires.ref_number}</span>}</div>
                  <div style={{fontSize:13,fontWeight:500,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.description}</div>
                  <div style={{fontSize:11,color:'var(--text-muted)',marginTop:2}}>{r.quantity} {r.unit} · {r.employees?.emp_code||'—'}</div>
                  <div style={{marginTop:4}}><span className={`badge ${{'Pendente':'badge-pending','Em cotação':'badge-quotation','Aprovado':'badge-approved'}[r.status]||''}`} style={{fontSize:10}}>{r.status}</span></div>
                </div>
              ))
          }
        </div>
      </div>

      {/* Painel de cotações */}
      {selReq && (
        <div style={{flex:1,minWidth:0,overflowY:'auto',height:'100%'}}>
          {/* Contexto completo da requisição */}
          <div className="card" style={{marginBottom:12,borderLeft:'3px solid var(--blue)'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:12}}>
              <div style={{flex:1}}>
                <div style={{fontSize:11,color:'var(--text-muted)',marginBottom:4}}>{selReq.ref_number} · {selReq.employees?.emp_code} {selReq.employees?.full_name} {selReq.affaires?`· ${selReq.affaires.ref_number} — ${selReq.affaires.name}`:''}</div>
                <div style={{fontSize:16,fontWeight:600,marginBottom:6}}>{selReq.description}</div>
                <div style={{display:'flex',gap:12,fontSize:13,flexWrap:'wrap'}}>
                  <span><span style={{color:'var(--text-muted)'}}>Qtd: </span><strong>{selReq.quantity} {selReq.unit}</strong></span>
                  <span><span style={{color:'var(--text-muted)'}}>Mín. fornecedores: </span><strong>{selReq.min_quotes}</strong></span>
                  {selReq.needed_by && <span><span style={{color:'var(--text-muted)'}}>Data necessária: </span><strong style={{color:'var(--amber)'}}>{new Date(selReq.needed_by).toLocaleDateString('pt-PT')}</strong></span>}
                </div>
                {selReq.notes && (
                  <div style={{marginTop:8,padding:'8px',background:'var(--bg)',borderRadius:'var(--radius)',fontSize:12}}>
                    <span style={{fontWeight:600,color:'var(--text-muted)'}}>Especificações: </span>{selReq.notes}
                  </div>
                )}
                {selReq.technical_contact_name && (
                  <div style={{marginTop:6,fontSize:12,color:'var(--blue)'}}>
                    <i className="ti ti-user-check" style={{marginRight:4}}/>
                    <strong>{selReq.technical_contact_name}</strong>
                    {selReq.technical_contact_company && ` — ${selReq.technical_contact_company}`}
                    {selReq.technical_contact_phone && <a href={`tel:${selReq.technical_contact_phone}`} style={{marginLeft:8,color:'var(--blue)',textDecoration:'none'}}><i className="ti ti-phone" style={{marginRight:2}}/>{selReq.technical_contact_phone}</a>}
                  </div>
                )}
              </div>
              {selReq.image_url && (
                <div style={{width:120,flexShrink:0}}>
                  <ImageFromStorage path={selReq.image_url} />
                </div>
              )}
            </div>
          </div>

          {/* Formulário de nova cotação */}
          {showForm && (
            <div className="card" style={{marginBottom:12}}>
              <div className="card-header"><span className="card-title">{editQuote?'Editar Cotação':'Nova Cotação'} — {selReq.description.slice(0,40)}</span></div>
              <div className="form-grid">
                <div className="form-group full"><label>Fornecedor *</label>
                  <select value={form.supplier_id} onChange={e=>setForm({...form,supplier_id:e.target.value})}>
                    <option value="">Selecionar...</option>
                    {suppliers.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div className="form-group"><label>Referência do fornecedor</label><input value={form.supplier_ref} onChange={e=>setForm({...form,supplier_ref:e.target.value})} /></div>
                <div className="form-group"><label>Preço unitário (€) *</label><input type="number" step="0.01" value={form.unit_price} onChange={e=>setForm({...form,unit_price:e.target.value})} /></div>
                <div className="form-group"><label>Desconto (%)</label><input type="number" value={form.discount_pct} onChange={e=>setForm({...form,discount_pct:e.target.value})} /></div>
                <div className="form-group"><label>Prazo entrega (dias)</label><input type="number" value={form.delivery_days} onChange={e=>setForm({...form,delivery_days:e.target.value})} /></div>
                <div className="form-group"><label>Custo de entrega (€) <span style={{fontWeight:400,fontSize:11,color:'var(--text-muted)'}}>opcional</span></label><input type="number" step="0.01" value={form.delivery_price} onChange={e=>setForm({...form,delivery_price:e.target.value})} placeholder="0.00" /></div>
                <div className="form-group"><label>Validade</label><input type="date" value={form.valid_until} onChange={e=>setForm({...form,valid_until:e.target.value})} /></div>
                <div className="form-group"><label>Condições pagamento</label>
                  <select value={form.payment_terms} onChange={e=>setForm({...form,payment_terms:e.target.value})}>
                    {['Pronto pagamento','30 dias','45 dias','60 dias','90 dias'].map(t=><option key={t}>{t}</option>)}
                  </select>
                </div>
                {selReq.quantity && <div className="form-group">
                  <label>Total estimado</label>
                  <div style={{padding:'8px 10px',background:'var(--bg)',borderRadius:'var(--radius)',fontSize:13,fontWeight:600,color:'var(--blue)'}}>
                    {form.unit_price ? `€ ${(parseFloat(form.unit_price) * (1-parseFloat(form.discount_pct||0)/100) * parseFloat(selReq.quantity)).toLocaleString('pt-PT',{minimumFractionDigits:2})}` : '—'}
                  </div>
                </div>}
                <div className="form-group full"><label>Notas</label><textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} /></div>
              </div>

              <div style={{marginTop:12,paddingTop:12,borderTop:'0.5px solid var(--border)'}}>
                <div style={{fontSize:12,fontWeight:600,color:'var(--green)',marginBottom:10}}><i className="ti ti-truck-delivery" style={{marginRight:6}}/>Local de entrega</div>
                <div className="form-grid" style={{gap:8}}>
                  <div className="form-group full"><label>Tipo de entrega</label>
                    <select value={form.delivery_type} onChange={e=>setForm({...form,delivery_type:e.target.value})}>
                      <option value="">— Igual à requisição —</option>
                      {['Obra (morada da obra)','Armazém','Outro endereço','Entrega intermédia (2+ transportes)'].map(t=><option key={t}>{t}</option>)}
                    </select>
                  </div>
                  {form.delivery_type && form.delivery_type!=='Obra (morada da obra)' && <>
                    <div className="form-group full"><label>Morada</label><input value={form.delivery_address} onChange={e=>setForm({...form,delivery_address:e.target.value})} placeholder="Morada completa" /></div>
                    <div className="form-group"><label>Cidade</label><input value={form.delivery_city} onChange={e=>setForm({...form,delivery_city:e.target.value})} /></div>
                  </>}
                </div>
              </div>

              <div style={{marginTop:12,paddingTop:12,borderTop:'0.5px solid var(--border)'}}>
                <div style={{fontSize:12,fontWeight:600,color:'var(--blue)',marginBottom:10}}><i className="ti ti-receipt-tax" style={{marginRight:6}}/>IVA e Fiscalidade</div>
                <div className="form-grid" style={{gap:8}}>
                  <div className="form-group" style={{flexDirection:'row',alignItems:'center',gap:8}}>
                    <input type="checkbox" checked={form.vat_exempt} onChange={e=>setForm({...form,vat_exempt:e.target.checked,vat_rate:e.target.checked?'0':'23'})} id="vat_exempt" />
                    <label htmlFor="vat_exempt" style={{margin:0,cursor:'pointer',color:'var(--green)',fontWeight:500}}>✈️ Exportação / IVA 0% (recuperável)</label>
                  </div>
                  <div className="form-group" style={{flexDirection:'row',alignItems:'center',gap:8}}>
                    <input type="checkbox" checked={form.price_includes_vat} onChange={e=>setForm({...form,price_includes_vat:e.target.checked})} id="incl_vat" />
                    <label htmlFor="incl_vat" style={{margin:0,cursor:'pointer'}}>Preço já inclui IVA</label>
                  </div>
                  {!form.vat_exempt && <div className="form-group"><label>Taxa IVA (%)</label>
                    <select value={form.vat_rate} onChange={e=>setForm({...form,vat_rate:e.target.value})}>
                      {['0','6','13','23'].map(r=><option key={r}>{r}</option>)}
                    </select>
                  </div>}
                  {/* Cálculo resumo */}
                  {form.unit_price && <div className="form-group full">
                    <div style={{padding:'10px 12px',background:'var(--bg)',borderRadius:'var(--radius)',fontSize:12}}>
                      {(() => {
                        const unitPrice = parseFloat(form.unit_price)||0
                        const disc = parseFloat(form.discount_pct)||0
                        const qty = parseFloat(selReq?.quantity)||1
                        const vatRate = parseFloat(form.vat_rate)||0
                        const priceAfterDisc = unitPrice * (1 - disc/100)
                        const totalExclVat = priceAfterDisc * qty
                        const vatAmount = form.vat_exempt ? 0 : totalExclVat * vatRate/100
                        const totalInclVat = totalExclVat + vatAmount
                        return (
                          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'4px 16px'}}>
                            <div><span style={{color:'var(--text-muted)'}}>Preço unit. s/ desconto: </span>€ {unitPrice.toFixed(2)}</div>
                            <div><span style={{color:'var(--text-muted)'}}>Após desconto ({disc}%): </span><strong>€ {priceAfterDisc.toFixed(2)}</strong></div>
                            <div><span style={{color:'var(--text-muted)'}}>Total s/IVA ({qty} {selReq?.unit}): </span><strong style={{color:'var(--blue)'}}>€ {totalExclVat.toFixed(2)}</strong></div>
                            {!form.vat_exempt && <div><span style={{color:'var(--text-muted)'}}>IVA {vatRate}%: </span>€ {vatAmount.toFixed(2)}</div>}
                            {!form.vat_exempt && <div style={{gridColumn:'1/-1'}}><span style={{color:'var(--text-muted)'}}>Total c/IVA: </span><strong style={{color:'var(--amber)'}}>€ {totalInclVat.toFixed(2)}</strong></div>}
                            {form.vat_exempt && <div style={{gridColumn:'1/-1',color:'var(--green)',fontWeight:500}}>✈️ IVA 0% — exportação — IVA recuperável: € 0,00</div>}
                          </div>
                        )
                      })()}
                    </div>
                  </div>}
                </div>
              </div>

              <div className="form-actions">
                <button className="btn" onClick={()=>{setShowForm(false);setEditQuote(null)}}>Cancelar</button>
                <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving?'A guardar...':editQuote?'Guardar':'Guardar Cotação'}</button>
              </div>
            </div>
          )}

          <div className="card">
            <div className="card-header">
              <span className="card-title">Cotações ({quotes.length}) {quotes.length < selReq.min_quotes && <span style={{fontSize:11,color:'var(--amber)'}}>— faltam {selReq.min_quotes - quotes.length} cotação(ões)</span>}</span>
              <button className="btn btn-primary" onClick={()=>{setShowForm(true);setEditQuote(null)}}><i className="ti ti-plus"/>Adicionar</button>
            </div>

            {loading ? <div className="loading"><i className="ti ti-loader-2"/>A carregar...</div>
              : quotes.length===0 ? <div className="empty">Sem cotações. Adiciona a primeira!</div>
              : <div className="quote-grid">
                  {quotes.map((q,i)=>{
                    const qFollowups = followups[q.id] || []
                    const lastFollowup = qFollowups[0]
                    const daysSince = lastFollowup ? Math.floor((new Date()-new Date(lastFollowup.contact_date))/86400000) : null
                    const totalQuote = parseFloat(q.final_price) * parseFloat(selReq.quantity)
                    return (
                      <div key={q.id} className={`quote-card ${i===0&&!q.selected&&!q.rejected?'best':''}`} style={{opacity:q.rejected?0.5:1,filter:q.rejected?'grayscale(80%)':'none'}}>
                        {q.rejected && <div style={{marginBottom:8}}><span style={{background:'var(--text-muted)',color:'white',fontSize:10,padding:'2px 8px',borderRadius:10}}>✗ Não aprovado</span></div>}
                        {i===0&&!q.selected&&!q.rejected && <div style={{marginBottom:8}}><span style={{background:'var(--blue)',color:'white',fontSize:10,padding:'2px 8px',borderRadius:10}}>💰 Melhor preço</span></div>}
                        {q.selected && <div style={{marginBottom:8}}><span style={{background:'var(--green)',color:'white',fontSize:10,padding:'2px 8px',borderRadius:10}}>✓ Aprovado → Encomendado</span></div>}
                        <div style={{fontWeight:600,marginBottom:10,fontSize:14}}>{q.suppliers?.name}</div>
                        <div className="quote-field"><span style={{color:'var(--text-muted)'}}>Preço unit.</span><span>€ {parseFloat(q.unit_price).toFixed(2)}</span></div>
                        <div className="quote-field"><span style={{color:'var(--text-muted)'}}>Desconto</span><span style={{color:'var(--green)'}}>{q.discount_pct}%</span></div>
                        <div className="quote-field"><span style={{color:'var(--text-muted)'}}>Final/un.</span><span style={{fontWeight:600}}>€ {parseFloat(q.final_price).toFixed(2)}</span></div>
                        <div className="quote-field" style={{background:'rgba(24,95,165,0.05)',padding:'4px 6px',borderRadius:4}}>
                          <span style={{color:'var(--text-muted)'}}>Total ({selReq.quantity} {selReq.unit})</span>
                          <span style={{fontWeight:700,color:'var(--blue)',fontSize:14}}>€ {totalQuote.toLocaleString('pt-PT',{minimumFractionDigits:2})}</span>
                        </div>
                        <div className="quote-field"><span style={{color:'var(--text-muted)'}}>Entrega</span><span>{q.delivery_days?`${q.delivery_days} dias`:'—'}</span></div>
                        <div className="quote-field"><span style={{color:'var(--text-muted)'}}>Pagamento</span><span>{q.payment_terms}</span></div>
                        <div className="quote-field">
                          <span style={{color:'var(--text-muted)'}}>IVA</span>
                          <span style={{color:q.vat_exempt?'var(--green)':''}}>{q.vat_exempt?'✈️ 0% (exportação)':`${q.vat_rate||23}%`}</span>
                        </div>
                        {!q.vat_exempt && q.vat_rate > 0 && (
                          <div className="quote-field">
                            <span style={{color:'var(--text-muted)'}}>Total c/IVA</span>
                            <span style={{fontWeight:600,color:'var(--amber)'}}>
                              € {(parseFloat(q.final_price) * parseFloat(selReq?.quantity||1) * (1+(parseFloat(q.vat_rate||23)/100))).toLocaleString('pt-PT',{minimumFractionDigits:2})}
                            </span>
                          </div>
                        )}
                        {q.notes && <div style={{fontSize:11,color:'var(--text-muted)',marginTop:6,fontStyle:'italic',padding:'4px 6px',background:'var(--bg)',borderRadius:4}}>{q.notes}</div>}
                        {q.delivery_type && (
                          <div style={{fontSize:11,marginTop:6,padding:'4px 6px',background:'var(--green-light)',borderRadius:4,color:'var(--green)',fontWeight:500}}>
                            🚚 {q.delivery_type}{q.delivery_address?` — ${q.delivery_address}`:''}{q.delivery_city?`, ${q.delivery_city}`:''}
                          </div>
                        )}

                        {/* Último relançamento */}
                        {daysSince !== null && (
                          <div style={{marginTop:8,padding:'6px 8px',background:daysSince>7?'var(--red-light)':'var(--green-light)',borderRadius:'var(--radius)',fontSize:11}}>
                            <div style={{fontWeight:500}}>Último contacto: há {daysSince} dia(s)</div>
                            <div style={{color:'var(--text-muted)',marginTop:1}}>{lastFollowup.contact_type} · {lastFollowup.employees?.emp_code} · {lastFollowup.notes?.slice(0,50)}</div>
                            {lastFollowup.next_followup && <div style={{marginTop:2,color:'var(--amber)'}}>Próximo: {new Date(lastFollowup.next_followup).toLocaleDateString('pt-PT')}</div>}
                          </div>
                        )}

                        <div style={{marginTop:10,display:'flex',gap:6,flexWrap:'wrap'}}>
                          {!q.selected && !q.rejected && <button className="btn btn-primary btn-sm" style={{flex:1,justifyContent:'center'}} onClick={()=>handleApprove(q)}>✓ Aprovar e Encomendar</button>}
                          <button className="btn btn-sm" onClick={()=>{setShowFollowup(showFollowup===q.id?null:q.id);if(!followups[q.id])loadFollowups(q.id)}}><i className="ti ti-phone"/>Relançar</button>
                          <button className="btn btn-sm" onClick={()=>openEdit(q)}><i className="ti ti-edit"/></button>
                          {isAdmin && <button className="btn btn-sm" style={{color:'var(--red)'}} onClick={()=>handleDelete(q.id)}><i className="ti ti-trash"/></button>}
                        </div>

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
                                <input value={followupForm.notes} onChange={e=>setFollowupForm({...followupForm,notes:e.target.value})} placeholder="Ex: Confirma entrega 3ª feira" />
                              </div>
                            </div>
                            <button className="btn btn-primary btn-sm" style={{marginTop:6}} onClick={()=>handleFollowup(q.id)} disabled={saving}>Guardar</button>
                            {(followups[q.id]||[]).length > 0 && (
                              <div style={{marginTop:8,borderTop:'0.5px solid var(--border)',paddingTop:6}}>
                                <div style={{fontSize:11,fontWeight:500,color:'var(--text-muted)',marginBottom:4}}>Histórico:</div>
                                {(followups[q.id]||[]).map(f=>(
                                  <div key={f.id} style={{fontSize:11,padding:'3px 0',borderBottom:'0.5px solid var(--border)'}}>
                                    <strong>{f.contact_type}</strong> · {f.employees?.emp_code} · {new Date(f.contact_date).toLocaleDateString('pt-PT')} — {f.notes}
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
            }
          </div>
        </div>
      )}
    </div>
  )
}
