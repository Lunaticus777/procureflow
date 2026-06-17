import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useRole } from '../hooks/useRole'

const STARS = (n) => '★'.repeat(Math.round(n||0)) + '☆'.repeat(5-Math.round(n||0))

export default function SupplierDetail() {
  const { session } = useAuth()
  const { isAdmin } = useRole()
  const [suppliers, setSuppliers] = useState([])
  const [selected, setSelected] = useState(null)
  const [contacts, setContacts] = useState([])
  const [orders, setOrders] = useState([])
  const [reviews, setReviews] = useState([])
  const [quotations, setQuotations] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('info')
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editSupplier, setEditSupplier] = useState(null)
  const [showContactForm, setShowContactForm] = useState(false)
  const [form, setForm] = useState({ name:'', contact_name:'', email:'', phone:'', mobile:'', category:'', payment_terms:'30 dias', address:'', city:'', country:'Portugal', nif:'', notes:'' })
  const [contactForm, setContactForm] = useState({ contact_type:'Telefone', contact_person:'', subject:'', notes:'', follow_up_date:'' })
  const [saving, setSaving] = useState(false)

  const categories = [...new Set(suppliers.map(s=>s.category).filter(Boolean))]

  const load = async () => {
    const { data } = await supabase.from('suppliers').select('*, created_by_emp:created_by(full_name, emp_code)').eq('active', true).order('name')
    setSuppliers(data || [])
    setLoading(false)
  }

  const loadDetail = async (s) => {
    const [{ data: co }, { data: ord }, { data: rev }, { data: quot }] = await Promise.all([
      supabase.from('supplier_contacts').select('*, employees(full_name,emp_code)').eq('supplier_id', s.id).order('contact_date',{ascending:false}),
      supabase.from('orders').select('*, requisitions(description,ref_number,affaires(name,ref_number))').eq('supplier_id', s.id).order('created_at',{ascending:false}).limit(10),
      supabase.from('supplier_reviews').select('*, employees(full_name,emp_code)').eq('supplier_id', s.id).order('created_at',{ascending:false}),
      supabase.from('quotations').select('*, requisitions(description,ref_number)').eq('supplier_id', s.id).order('created_at',{ascending:false}).limit(10),
    ])
    setContacts(co||[])
    setOrders(ord||[])
    setReviews(rev||[])
    setQuotations(quot||[])
  }

  useEffect(() => { load() }, [])

  const selectSupplier = (s) => { setSelected(s); loadDetail(s); setTab('info') }

  const openEdit = (s) => {
    setEditSupplier(s)
    setForm({ name:s.name, contact_name:s.contact_name||'', email:s.email||'', phone:s.phone||'', mobile:s.mobile||'', category:s.category||'', payment_terms:s.payment_terms||'30 dias', address:s.address||'', city:s.city||'', country:s.country||'Portugal', nif:s.nif||'', notes:s.notes||'' })
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.name) return
    setSaving(true)
    if (editSupplier) {
      await supabase.from('suppliers').update(form).eq('id', editSupplier.id)
      setSelected({...editSupplier,...form})
    } else {
      const { data: empIns } = await supabase.from('employees').select('id').eq('email', session?.user?.email).single()
      await supabase.from('suppliers').insert({ ...form, created_by: empIns?.id||null })
    }
    setForm({ name:'', contact_name:'', email:'', phone:'', mobile:'', category:'', payment_terms:'30 dias', address:'', city:'', country:'Portugal', nif:'', notes:'' })
    setShowForm(false); setEditSupplier(null); setSaving(false); load()
  }

  const handleDelete = async (id) => {
    if (!confirm('Arquivar este fornecedor?')) return
    await supabase.from('suppliers').update({ active: false }).eq('id', id)
    setSelected(null); load()
  }

  const handleContactSave = async () => {
    if (!contactForm.subject) return
    setSaving(true)
    const { data: emp } = await supabase.from('employees').select('id').eq('email', session?.user?.email).single()
    await supabase.from('supplier_contacts').insert({
      ...contactForm, supplier_id: selected.id, created_by: emp?.id||null,
      contact_date: new Date().toISOString(), follow_up_date: contactForm.follow_up_date||null,
    })
    setContactForm({ contact_type:'Telefone', contact_person:'', subject:'', notes:'', follow_up_date:'' })
    setShowContactForm(false); setSaving(false)
    loadDetail(selected)
  }

  const markFollowUp = async (id) => {
    await supabase.from('supplier_contacts').update({ follow_up_done: true }).eq('id', id)
    loadDetail(selected)
  }

  const lastContact = contacts[0]
  const daysSince = lastContact ? Math.floor((new Date()-new Date(lastContact.contact_date))/86400000) : null
  const avgReview = reviews.length ? (reviews.reduce((a,r)=>a+(r.quality+r.punctuality+r.price_value+r.communication)/4,0)/reviews.length).toFixed(1) : null
  const totalOrders = orders.length
  const totalValue = orders.reduce((a,o)=>a+parseFloat(o.total_amount||0),0)

  const filtered = suppliers.filter(s => {
    const sr = search.toLowerCase()
    const matchS = !sr || s.name?.toLowerCase().includes(sr) || s.category?.toLowerCase().includes(sr) || s.contact_name?.toLowerCase().includes(sr)
    const matchC = !filterCat || s.category === filterCat
    return matchS && matchC
  })

  if (loading) return <div className="loading"><i className="ti ti-loader-2"/>A carregar...</div>

  return (
    <div>
      {showForm && (
        <div className="card" style={{maxWidth:660,marginBottom:16}}>
          <div className="card-header"><span className="card-title">{editSupplier?'Editar Fornecedor':'Novo Fornecedor'}</span></div>
          <div className="form-grid">
            <div className="form-group full"><label>Nome *</label><input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} /></div>
            <div className="form-group"><label>NIF</label><input value={form.nif} onChange={e=>setForm({...form,nif:e.target.value})} /></div>
            <div className="form-group"><label>Categoria</label><input value={form.category} onChange={e=>setForm({...form,category:e.target.value})} placeholder="Ex: Cabos, Materiais eléctricos" /></div>
            <div className="form-group"><label>Pessoa de contacto</label><input value={form.contact_name} onChange={e=>setForm({...form,contact_name:e.target.value})} /></div>
            <div className="form-group"><label>Telefone</label><input value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} /></div>
            <div className="form-group"><label>Telemóvel</label><input value={form.mobile} onChange={e=>setForm({...form,mobile:e.target.value})} /></div>
            <div className="form-group"><label>Email</label><input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} /></div>
            <div className="form-group"><label>Condições pagamento</label>
              <select value={form.payment_terms} onChange={e=>setForm({...form,payment_terms:e.target.value})}>
                {['Pronto pagamento','15 dias','30 dias','45 dias','60 dias','90 dias'].map(t=><option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-group full"><label>Morada</label><input value={form.address} onChange={e=>setForm({...form,address:e.target.value})} /></div>
            <div className="form-group"><label>Cidade</label><input value={form.city} onChange={e=>setForm({...form,city:e.target.value})} /></div>
            <div className="form-group"><label>País</label><input value={form.country} onChange={e=>setForm({...form,country:e.target.value})} /></div>
            <div className="form-group full"><label>Notas</label><textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} /></div>
          </div>
          <div className="form-actions">
            <button className="btn" onClick={()=>{setShowForm(false);setEditSupplier(null)}}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving?'A guardar...':editSupplier?'Guardar alterações':'Guardar Fornecedor'}</button>
          </div>
        </div>
      )}

      <div style={{display:'flex',gap:16,alignItems:'flex-start',height:'calc(100vh - 140px)'}}>
        {/* Lista */}
        <div style={{width:280,flexShrink:0,overflowY:'auto',height:'100%'}}>
          <div className="card">
            <div className="card-header">
              <span className="card-title">Fornecedores ({filtered.length})</span>
              <button className="btn btn-primary" onClick={()=>{setShowForm(true);setEditSupplier(null)}}><i className="ti ti-plus"/>Novo</button>
            </div>
            <div style={{display:'flex',gap:6,marginBottom:10,flexWrap:'wrap'}}>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Pesquisar..." style={{flex:1,minWidth:100,border:'0.5px solid var(--border-hover)',borderRadius:'var(--radius)',padding:'6px 10px',fontSize:13,background:'var(--bg-card)',color:'var(--text)',fontFamily:'inherit'}} />
              <select value={filterCat} onChange={e=>setFilterCat(e.target.value)} style={{border:'0.5px solid var(--border-hover)',borderRadius:'var(--radius)',padding:'6px 8px',fontSize:12,background:'var(--bg-card)',color:'var(--text)',fontFamily:'inherit'}}>
                <option value="">Todas</option>
                {categories.map(c=><option key={c}>{c}</option>)}
              </select>
            </div>
            {filtered.length===0 ? <div className="empty">Sem fornecedores.</div>
              : <div style={{display:'flex',flexDirection:'column',gap:6}}>
                  {filtered.map(s=>(
                    <div key={s.id} onClick={()=>selectSupplier(s)}
                      style={{border:`1px solid ${selected?.id===s.id?'var(--blue)':'var(--border)'}`,borderLeft:`4px solid ${selected?.id===s.id?'var(--blue)':'var(--border)'}`,borderRadius:'var(--radius)',padding:'10px 12px',cursor:'pointer',background:selected?.id===s.id?'var(--blue-light)':'var(--bg-card)'}}>
                      <div style={{fontWeight:600,fontSize:13}}>{s.name}</div>
                      <div style={{fontSize:11,color:'var(--text-muted)',marginTop:2}}>{s.category||'—'} · {s.contact_name||''}</div>
                      <div style={{fontSize:11,color:'var(--text-muted)'}}>{s.phone||s.email||'—'}</div>
                    </div>
                  ))}
                </div>
            }
          </div>
        </div>

        {/* Ficha do fornecedor */}
        {selected && (
          <div style={{flex:1,minWidth:0,overflowY:'auto',height:'100%'}}>
            {/* Cabeçalho */}
            <div className="card" style={{marginBottom:12}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:12,marginBottom:14}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:12,color:'var(--text-muted)',marginBottom:2}}>{selected.category||'Fornecedor'} {selected.nif?`· NIF: ${selected.nif}`:''}</div>
                  <div style={{fontSize:20,fontWeight:700,marginBottom:6}}>{selected.name}</div>
                  {avgReview && <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <span className="stars" style={{fontSize:16}}>{STARS(parseFloat(avgReview))}</span>
                    <span style={{fontWeight:600}}>{avgReview}/5</span>
                    <span style={{fontSize:12,color:'var(--text-muted)'}}>({reviews.length} avaliação(ões))</span>
                  </div>}
                </div>
                <div style={{display:'flex',gap:6,flexShrink:0}}>
                  <button className="btn btn-sm" onClick={()=>openEdit(selected)}><i className="ti ti-edit"/>Editar</button>
                  {isAdmin && <button className="btn btn-sm" style={{color:'var(--red)'}} onClick={()=>handleDelete(selected.id)}><i className="ti ti-trash"/></button>}
                  <button className="btn btn-sm" onClick={()=>setSelected(null)}><i className="ti ti-x"/></button>
                </div>
              </div>

              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:12}}>
                {/* Contacto */}
                <div style={{background:'var(--bg)',borderRadius:'var(--radius)',padding:'10px 12px'}}>
                  <div style={{fontSize:10,fontWeight:600,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:6}}>👤 Contacto</div>
                  <div style={{fontWeight:600,fontSize:13}}>{selected.contact_name||'—'}</div>
                  {selected.phone && <div style={{fontSize:12,marginTop:4}}><a href={`tel:${selected.phone}`} style={{color:'var(--blue)',textDecoration:'none'}}><i className="ti ti-phone" style={{marginRight:4}}/>{selected.phone}</a></div>}
                  {selected.mobile && <div style={{fontSize:12}}><a href={`tel:${selected.mobile}`} style={{color:'var(--blue)',textDecoration:'none'}}><i className="ti ti-device-mobile" style={{marginRight:4}}/>{selected.mobile}</a></div>}
                  {selected.email && <div style={{fontSize:12}}><a href={`mailto:${selected.email}`} style={{color:'var(--blue)',textDecoration:'none'}}><i className="ti ti-mail" style={{marginRight:4}}/>{selected.email}</a></div>}
                </div>
                {/* Morada */}
                <div style={{background:'var(--bg)',borderRadius:'var(--radius)',padding:'10px 12px'}}>
                  <div style={{fontSize:10,fontWeight:600,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:6}}>📍 Morada</div>
                  {selected.address ? <div style={{fontSize:12}}>{selected.address}</div> : <div style={{fontSize:12,color:'var(--text-muted)'}}>Sem morada</div>}
                  {selected.city && <div style={{fontSize:12,fontWeight:500}}>{selected.city}</div>}
                  {selected.country && <div style={{fontSize:12,color:'var(--text-muted)'}}>{selected.country}</div>}
                </div>
                {/* Condições */}
                <div style={{background:'var(--bg)',borderRadius:'var(--radius)',padding:'10px 12px'}}>
                  <div style={{fontSize:10,fontWeight:600,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:6}}>💶 Condições</div>
                  <div style={{fontSize:13}}><span style={{color:'var(--text-muted)'}}>Pagamento: </span><strong>{selected.payment_terms||'—'}</strong></div>
                  <div style={{fontSize:13,marginTop:4}}><span style={{color:'var(--text-muted)'}}>Encomendas: </span><strong>{totalOrders}</strong></div>
                  <div style={{fontSize:13}}><span style={{color:'var(--text-muted)'}}>Total comprado: </span><strong>€ {totalValue.toLocaleString('pt-PT',{minimumFractionDigits:0})}</strong></div>
                </div>
              </div>

              {/* Último contacto */}
              {daysSince !== null && (
                <div style={{padding:'8px 12px',background:daysSince>30?'var(--red-light)':daysSince>14?'var(--amber-light)':'var(--green-light)',borderRadius:'var(--radius)',fontSize:12,marginBottom:10}}>
                  <i className={`ti ${daysSince>14?'ti-alert-triangle':'ti-clock'}`} style={{marginRight:6}}/>
                  Último contacto há <strong>{daysSince} dia(s)</strong> — {lastContact?.subject}
                  {lastContact?.employees?.emp_code && ` · por ${lastContact.employees.emp_code}`}
                </div>
              )}

              {selected.notes && <div style={{padding:'8px 12px',background:'var(--amber-light)',borderRadius:'var(--radius)',fontSize:12,borderLeft:'3px solid var(--amber)'}}>{selected.notes}</div>}

              <div style={{display:'flex',gap:8,marginTop:12}}>
                <button className="btn btn-primary" onClick={()=>setShowContactForm(!showContactForm)}><i className="ti ti-phone"/>Registar contacto</button>
              </div>

              {showContactForm && (
                <div style={{marginTop:12,padding:'12px',background:'var(--bg)',borderRadius:'var(--radius)'}}>
                  <div className="form-grid" style={{gap:8}}>
                    <div className="form-group"><label>Tipo</label>
                      <select value={contactForm.contact_type} onChange={e=>setContactForm({...contactForm,contact_type:e.target.value})}>
                        {['Telefone','Email','Presencial','WhatsApp'].map(t=><option key={t}>{t}</option>)}
                      </select>
                    </div>
                    <div className="form-group"><label>Pessoa contactada</label>
                      <input value={contactForm.contact_person} onChange={e=>setContactForm({...contactForm,contact_person:e.target.value})} placeholder={selected.contact_name||''} />
                    </div>
                    <div className="form-group full"><label>Assunto *</label>
                      <input value={contactForm.subject} onChange={e=>setContactForm({...contactForm,subject:e.target.value})} placeholder="Ex: Pedido de orçamento, seguimento entrega..." />
                    </div>
                    <div className="form-group full"><label>Resumo</label>
                      <textarea value={contactForm.notes} onChange={e=>setContactForm({...contactForm,notes:e.target.value})} placeholder="O que foi dito, prazo de resposta..." />
                    </div>
                    <div className="form-group"><label>Data seguimento</label>
                      <input type="date" value={contactForm.follow_up_date} onChange={e=>setContactForm({...contactForm,follow_up_date:e.target.value})} />
                    </div>
                  </div>
                  <div style={{display:'flex',gap:8,marginTop:8,justifyContent:'flex-end'}}>
                    <button className="btn btn-sm" onClick={()=>setShowContactForm(false)}>Cancelar</button>
                    <button className="btn btn-primary btn-sm" onClick={handleContactSave} disabled={saving}>Guardar contacto</button>
                  </div>
                </div>
              )}
            </div>

            {/* Separadores */}
            <div className="card">
              <div className="tabs">
                <div className={`tab ${tab==='info'?'active':''}`} onClick={()=>setTab('info')}>Histórico contactos {contacts.length>0&&<span style={{background:'var(--blue)',color:'white',borderRadius:10,fontSize:10,padding:'1px 5px',marginLeft:3}}>{contacts.length}</span>}</div>
                <div className={`tab ${tab==='orders'?'active':''}`} onClick={()=>setTab('orders')}>Encomendas {orders.length>0&&<span style={{background:'var(--blue)',color:'white',borderRadius:10,fontSize:10,padding:'1px 5px',marginLeft:3}}>{orders.length}</span>}</div>
                <div className={`tab ${tab==='quotes'?'active':''}`} onClick={()=>setTab('quotes')}>Cotações {quotations.length>0&&<span style={{background:'var(--blue)',color:'white',borderRadius:10,fontSize:10,padding:'1px 5px',marginLeft:3}}>{quotations.length}</span>}</div>
                <div className={`tab ${tab==='reviews'?'active':''}`} onClick={()=>setTab('reviews')}>Avaliações {reviews.length>0&&<span style={{background:'var(--blue)',color:'white',borderRadius:10,fontSize:10,padding:'1px 5px',marginLeft:3}}>{reviews.length}</span>}</div>
              </div>

              {tab==='info' && (
                contacts.length===0 ? <div className="empty">Sem contactos registados.</div>
                : contacts.map(c=>(
                    <div key={c.id} style={{padding:'12px 0',borderBottom:'0.5px solid var(--border)'}}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:8}}>
                        <div style={{flex:1}}>
                          <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:4}}>
                            <span style={{fontWeight:600,fontSize:13}}>{c.subject}</span>
                            <span style={{fontSize:11,background:'var(--blue-light)',color:'var(--blue)',padding:'1px 6px',borderRadius:10}}>{c.contact_type}</span>
                          </div>
                          <div style={{fontSize:12,color:'var(--text-muted)'}}>
                            {c.contact_person||selected.contact_name} · {new Date(c.contact_date).toLocaleDateString('pt-PT')} {new Date(c.contact_date).toLocaleTimeString('pt-PT',{hour:'2-digit',minute:'2-digit'})}
                            · por <strong>{c.employees?.emp_code||'—'}</strong>
                          </div>
                          {c.notes && <div style={{fontSize:12,marginTop:4,fontStyle:'italic',color:'var(--text-muted)'}}>{c.notes}</div>}
                          {c.follow_up_date && !c.follow_up_done && (
                            <div style={{fontSize:11,color:'var(--amber)',marginTop:4,display:'flex',alignItems:'center',gap:6}}>
                              <i className="ti ti-clock"/>Seguimento: {new Date(c.follow_up_date).toLocaleDateString('pt-PT')}
                              <button className="btn btn-sm" style={{padding:'2px 8px',fontSize:11}} onClick={()=>markFollowUp(c.id)}>✓ Feito</button>
                            </div>
                          )}
                          {c.follow_up_done && <div style={{fontSize:11,color:'var(--green)',marginTop:2}}>✓ Seguimento feito</div>}
                        </div>
                      </div>
                    </div>
                  ))
              )}

              {tab==='orders' && (
                orders.length===0 ? <div className="empty">Sem encomendas a este fornecedor.</div>
                : <table>
                    <thead><tr><th>Enc.</th><th>Material</th><th>Obra</th><th>Valor</th><th>Estado</th><th>Data</th></tr></thead>
                    <tbody>
                      {orders.map(o=>(
                        <tr key={o.id}>
                          <td style={{fontWeight:600}}>{o.ref_number}</td>
                          <td style={{fontSize:12,maxWidth:160,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{o.requisitions?.description||'—'}</td>
                          <td style={{fontSize:11,color:'var(--blue)'}}>{o.requisitions?.affaires?.ref_number||'—'}</td>
                          <td style={{fontWeight:500}}>{o.total_amount?`€ ${parseFloat(o.total_amount).toLocaleString('pt-PT',{minimumFractionDigits:0})}`:'-'}</td>
                          <td><span className={`badge ${{Confirmado:'badge-ordered','Em trânsito':'badge-transit',Entregue:'badge-delivered',Cancelado:'badge-cancelled'}[o.status]||''}`}>{o.status}</span></td>
                          <td style={{fontSize:11,color:'var(--text-muted)'}}>{new Date(o.created_at).toLocaleDateString('pt-PT')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
              )}

              {tab==='quotes' && (
                quotations.length===0 ? <div className="empty">Sem cotações deste fornecedor.</div>
                : <table>
                    <thead><tr><th>Requisição</th><th>Preço unit.</th><th>Desc.</th><th>Final</th><th>Entrega</th><th>Estado</th><th>Data</th></tr></thead>
                    <tbody>
                      {quotations.map(q=>(
                        <tr key={q.id}>
                          <td style={{fontSize:12,maxWidth:140,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{q.requisitions?.description||'—'}</td>
                          <td>€ {parseFloat(q.unit_price).toFixed(2)}</td>
                          <td style={{color:'var(--green)'}}>{q.discount_pct}%</td>
                          <td style={{fontWeight:600}}>€ {parseFloat(q.final_price).toFixed(2)}</td>
                          <td style={{fontSize:12}}>{q.delivery_days?`${q.delivery_days} dias`:'—'}</td>
                          <td>{q.selected?<span className="badge badge-approved">Aprovado</span>:<span className="badge badge-pending">Em análise</span>}</td>
                          <td style={{fontSize:11,color:'var(--text-muted)'}}>{new Date(q.created_at).toLocaleDateString('pt-PT')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
              )}

              {tab==='reviews' && (
                reviews.length===0 ? <div className="empty">Sem avaliações.</div>
                : reviews.map(r=>(
                    <div key={r.id} style={{padding:'12px 0',borderBottom:'0.5px solid var(--border)'}}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:8}}>
                        <div style={{flex:1}}>
                          <div style={{display:'flex',gap:12,marginBottom:6,flexWrap:'wrap'}}>
                            {[['Qualidade',r.quality],['Pontualidade',r.punctuality],['Preço',r.price_value],['Comunicação',r.communication]].map(([l,v])=>(
                              <div key={l} style={{fontSize:12}}>
                                <span style={{color:'var(--text-muted)'}}>{l}: </span>
                                <span className="stars" style={{fontSize:13}}>{STARS(v)}</span>
                                <span style={{fontWeight:600,marginLeft:2}}>{v}/5</span>
                              </div>
                            ))}
                          </div>
                          {r.notes && <div style={{fontSize:12,fontStyle:'italic',color:'var(--text-muted)'}}>{r.notes}</div>}
                          <div style={{fontSize:11,color:'var(--text-muted)',marginTop:4}}>
                            {new Date(r.created_at).toLocaleDateString('pt-PT')} · por {r.employees?.emp_code||'—'}
                          </div>
                        </div>
                        <div style={{fontSize:18,fontWeight:700,color:'var(--amber)',flexShrink:0}}>
                          {((r.quality+r.punctuality+r.price_value+r.communication)/4).toFixed(1)}
                        </div>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
