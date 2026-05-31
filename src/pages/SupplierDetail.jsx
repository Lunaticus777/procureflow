import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

export default function SupplierDetail() {
  const { session } = useAuth()
  const [suppliers, setSuppliers] = useState([])
  const [selected, setSelected] = useState(null)
  const [contacts, setContacts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [showContactForm, setShowContactForm] = useState(false)
  const [form, setForm] = useState({ name:'', contact_name:'', email:'', phone:'', category:'', payment_terms:'30 dias', address:'', nif:'', notes:'' })
  const [contactForm, setContactForm] = useState({ contact_type:'Telefone', contact_person:'', subject:'', notes:'', follow_up_date:'' })
  const [saving, setSaving] = useState(false)

  const load = async () => {
    const { data } = await supabase.from('suppliers').select('*').eq('active', true).order('name')
    setSuppliers(data || [])
    setLoading(false)
  }

  const loadContacts = async (supplierId) => {
    const { data } = await supabase
      .from('supplier_contacts')
      .select('*, employees(full_name, emp_code)')
      .eq('supplier_id', supplierId)
      .order('contact_date', { ascending: false })
    setContacts(data || [])
  }

  useEffect(() => { load() }, [])

  const selectSupplier = (s) => { setSelected(s); loadContacts(s.id) }

  const handleSave = async () => {
    if (!form.name) return
    setSaving(true)
    await supabase.from('suppliers').insert(form)
    setForm({ name:'', contact_name:'', email:'', phone:'', category:'', payment_terms:'30 dias', address:'', nif:'', notes:'' })
    setShowForm(false)
    setSaving(false)
    load()
  }

  const handleContactSave = async () => {
    if (!contactForm.subject) return
    setSaving(true)
    const { data: emp } = await supabase.from('employees').select('id').eq('email', session?.user?.email).single()
    await supabase.from('supplier_contacts').insert({
      ...contactForm,
      supplier_id: selected.id,
      created_by: emp?.id || null,
      contact_date: new Date().toISOString(),
    })
    setContactForm({ contact_type:'Telefone', contact_person:'', subject:'', notes:'', follow_up_date:'' })
    setShowContactForm(false)
    setSaving(false)
    loadContacts(selected.id)
  }

  const markFollowUp = async (id) => {
    await supabase.from('supplier_contacts').update({ follow_up_done: true }).eq('id', id)
    loadContacts(selected.id)
  }

  const lastContact = contacts[0]
  const daysSince = lastContact ? Math.floor((new Date() - new Date(lastContact.contact_date)) / 86400000) : null

  if (loading) return <div className="loading"><i className="ti ti-loader-2"/>A carregar...</div>

  return (
    <div>
      {showForm && (
        <div className="card" style={{maxWidth:640,marginBottom:16}}>
          <div className="card-header"><span className="card-title">Novo Fornecedor</span></div>
          <div className="form-grid">
            <div className="form-group full"><label>Nome *</label><input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} /></div>
            <div className="form-group"><label>NIF</label><input value={form.nif} onChange={e=>setForm({...form,nif:e.target.value})} /></div>
            <div className="form-group"><label>Categoria</label><input value={form.category} onChange={e=>setForm({...form,category:e.target.value})} placeholder="Ex: Cabos, Material eléctrico" /></div>
            <div className="form-group"><label>Pessoa de contacto</label><input value={form.contact_name} onChange={e=>setForm({...form,contact_name:e.target.value})} /></div>
            <div className="form-group"><label>Email</label><input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} /></div>
            <div className="form-group"><label>Telefone</label><input value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} /></div>
            <div className="form-group"><label>Condições pagamento</label>
              <select value={form.payment_terms} onChange={e=>setForm({...form,payment_terms:e.target.value})}>
                {['Pronto pagamento','30 dias','45 dias','60 dias','90 dias'].map(t=><option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-group full"><label>Morada</label><input value={form.address} onChange={e=>setForm({...form,address:e.target.value})} /></div>
            <div className="form-group full"><label>Notas</label><textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} /></div>
          </div>
          <div className="form-actions">
            <button className="btn" onClick={()=>setShowForm(false)}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving?'A guardar...':'Guardar Fornecedor'}</button>
          </div>
        </div>
      )}

      <div className="two-col">
        <div className="card">
          <div className="card-header">
            <span className="card-title">Fornecedores ({suppliers.length})</span>
            <button className="btn btn-primary" onClick={()=>setShowForm(true)}><i className="ti ti-plus"/>Novo</button>
          </div>
          {suppliers.length === 0
            ? <div className="empty">Sem fornecedores. Adiciona o primeiro!</div>
            : <div className="table-wrap">
                <table>
                  <thead><tr><th>Nome</th><th>Categoria</th><th>Contacto</th><th>Último contacto</th></tr></thead>
                  <tbody>
                    {suppliers.map(s => (
                      <tr key={s.id} style={{cursor:'pointer'}} onClick={()=>selectSupplier(s)}>
                        <td style={{fontWeight: selected?.id===s.id?600:400}}>{s.name}</td>
                        <td style={{fontSize:12,color:'var(--text-muted)'}}>{s.category||'—'}</td>
                        <td style={{fontSize:12}}>{s.phone||'—'}</td>
                        <td style={{fontSize:12,color:'var(--text-muted)'}}>—</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
          }
        </div>

        {selected && (
          <div>
            <div className="card">
              <div className="card-header">
                <div>
                  <div style={{fontWeight:600,fontSize:15}}>{selected.name}</div>
                  <div style={{fontSize:12,color:'var(--text-muted)',marginTop:2}}>{selected.category}</div>
                </div>
                <button className="btn btn-sm" onClick={()=>setSelected(null)}><i className="ti ti-x"/></button>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'6px 16px',fontSize:13,marginBottom:12}}>
                {selected.contact_name && <div><span style={{color:'var(--text-muted)'}}>Contacto: </span>{selected.contact_name}</div>}
                {selected.phone && <div><span style={{color:'var(--text-muted)'}}>Tel: </span>{selected.phone}</div>}
                {selected.email && <div><span style={{color:'var(--text-muted)'}}>Email: </span><a href={`mailto:${selected.email}`} style={{color:'var(--blue)'}}>{selected.email}</a></div>}
                {selected.payment_terms && <div><span style={{color:'var(--text-muted)'}}>Pagamento: </span>{selected.payment_terms}</div>}
              </div>
              {daysSince !== null && (
                <div style={{padding:'8px 12px',background: daysSince > 30 ? 'var(--red-light)' : 'var(--green-light)',borderRadius:'var(--radius)',fontSize:12,color: daysSince > 30 ? '#791F1F' : '#085041',marginBottom:12}}>
                  <i className={`ti ${daysSince > 30 ? 'ti-alert-triangle' : 'ti-clock'}`} style={{marginRight:6}}/>
                  Último contacto há <strong>{daysSince} dias</strong> — {lastContact?.subject}
                </div>
              )}
              <button className="btn btn-primary" style={{width:'100%',justifyContent:'center'}} onClick={()=>setShowContactForm(true)}>
                <i className="ti ti-phone"/>Registar contacto
              </button>
            </div>

            {showContactForm && (
              <div className="card">
                <div className="card-header"><span className="card-title">Novo Contacto</span></div>
                <div className="form-grid">
                  <div className="form-group"><label>Tipo</label>
                    <select value={contactForm.contact_type} onChange={e=>setContactForm({...contactForm,contact_type:e.target.value})}>
                      {['Telefone','Email','Presencial','WhatsApp'].map(t=><option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="form-group"><label>Pessoa contactada</label>
                    <input value={contactForm.contact_person} onChange={e=>setContactForm({...contactForm,contact_person:e.target.value})} placeholder={selected.contact_name} />
                  </div>
                  <div className="form-group full"><label>Assunto *</label>
                    <input value={contactForm.subject} onChange={e=>setContactForm({...contactForm,subject:e.target.value})} placeholder="Ex: Pedido de orçamento cabo UTP Cat6" />
                  </div>
                  <div className="form-group full"><label>Resumo da conversa</label>
                    <textarea value={contactForm.notes} onChange={e=>setContactForm({...contactForm,notes:e.target.value})} placeholder="O que foi dito, prazo de resposta, etc." />
                  </div>
                  <div className="form-group"><label>Data de seguimento</label>
                    <input type="date" value={contactForm.follow_up_date} onChange={e=>setContactForm({...contactForm,follow_up_date:e.target.value})} />
                  </div>
                </div>
                <div className="form-actions">
                  <button className="btn" onClick={()=>setShowContactForm(false)}>Cancelar</button>
                  <button className="btn btn-primary" onClick={handleContactSave} disabled={saving}>{saving?'A guardar...':'Guardar'}</button>
                </div>
              </div>
            )}

            <div className="card">
              <div className="card-header"><span className="card-title">Histórico de contactos</span></div>
              {contacts.length === 0
                ? <div className="empty" style={{padding:16}}>Sem contactos registados.</div>
                : contacts.map(c => (
                    <div key={c.id} style={{padding:'10px 0',borderBottom:'0.5px solid var(--border)'}}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                        <div>
                          <div style={{fontSize:13,fontWeight:500}}>{c.subject}</div>
                          <div style={{fontSize:11,color:'var(--text-muted)',marginTop:2}}>
                            {c.contact_type} · {c.contact_person||selected.contact_name} · {new Date(c.contact_date).toLocaleDateString('pt-PT')}
                          </div>
                          {c.notes && <div style={{fontSize:12,color:'var(--text-muted)',marginTop:4,fontStyle:'italic'}}>{c.notes}</div>}
                          {c.follow_up_date && !c.follow_up_done && (
                            <div style={{fontSize:11,color:'var(--amber)',marginTop:4}}>
                              <i className="ti ti-clock" style={{marginRight:4}}/>Seguimento: {new Date(c.follow_up_date).toLocaleDateString('pt-PT')}
                            </div>
                          )}
                        </div>
                        {c.follow_up_date && !c.follow_up_done && (
                          <button className="btn btn-sm" onClick={()=>markFollowUp(c.id)} style={{flexShrink:0}}>✓ Feito</button>
                        )}
                      </div>
                    </div>
                  ))
              }
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
