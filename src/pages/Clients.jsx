import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useRole } from '../hooks/useRole'
import { logActivity } from '../hooks/useActivity'

const COUNTRIES = ['Portugal','Suíça','França','Espanha','Alemanha','Reino Unido','Luxemburgo','Bélgica','Itália','Outro']
const STATUS_CLASS = { 'Recebido':'badge-pending','Em preparação':'badge-quotation','Encomendado':'badge-ordered','Entregue':'badge-delivered','Cancelado':'badge-cancelled' }
const AFFAIRE_CLASS = { 'Aberta':'badge-quotation','Em curso':'badge-ordered','Concluída':'badge-delivered','Cancelada':'badge-cancelled' }

export default function Clients() {
  const [clients, setClients] = useState([])
  const [selected, setSelected] = useState(null)
  const [orders, setOrders] = useState([])
  const [affaires, setAffaires] = useState([])
  const [payments, setPayments] = useState([])
  const { session } = useAuth()
  const { isAdmin } = useRole()
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('info')
  const [search, setSearch] = useState('')
  const [filterCountry, setFilterCountry] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editClient, setEditClient] = useState(null)
  const [form, setForm] = useState({ name:'', company:'', nif:'', email:'', phone:'', mobile:'', address:'', city:'', postal_code:'', country:'Portugal', notes:'' })
  const [saving, setSaving] = useState(false)

  const load = async () => {
    const { data } = await supabase.from('clients').select('*, created_by_emp:created_by(full_name, emp_code)').eq('active', true).order('name')
    setClients(data || [])
    setLoading(false)
  }

  const loadDetail = async (c) => {
    const [{ data: ord }, { data: aff }, { data: pay }] = await Promise.all([
      supabase.from('client_orders').select('*, affaires(name,ref_number), employees(full_name,emp_code)').eq('client_id', c.id).order('created_at',{ascending:false}),
      supabase.from('affaires').select('*').eq('client_id', c.id).order('created_at',{ascending:false}),
      supabase.from('client_payments').select('*, affaires(name,ref_number)').eq('client_id', c.id).order('created_at',{ascending:false}),
    ])
    setOrders(ord||[])
    setAffaires(aff||[])
    setPayments(pay||[])
  }

  useEffect(() => { load() }, [])

  const selectClient = (c) => { setSelected(c); loadDetail(c); setTab('info') }

  const openEdit = (c) => {
    setEditClient(c)
    setForm({ name:c.name, company:c.company||'', nif:c.nif||'', email:c.email||'', phone:c.phone||'', mobile:c.mobile||'', address:c.address||'', city:c.city||'', postal_code:c.postal_code||'', country:c.country||'Portugal', notes:c.notes||'' })
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.name) return
    setSaving(true)
    const { data: empLog } = await supabase.from('employees').select('id').eq('email', session?.user?.email).single()
    if (editClient) {
      await supabase.from('clients').update(form).eq('id', editClient.id)
      await logActivity({ empId:empLog?.id, action:'updated', entityType:'client', entityRef:form.name, description:`actualizou cliente ${form.name}` })
      setSelected({...editClient,...form})
    } else {
      const { data: empIns } = await supabase.from('employees').select('id').eq('email', session?.user?.email).single()
      await supabase.from('clients').insert({ ...form, created_by: empIns?.id||null })
      await logActivity({ empId:empLog?.id, action:'created', entityType:'client', entityRef:form.name, description:`adicionou cliente ${form.name}` })
    }
    setForm({ name:'', company:'', nif:'', email:'', phone:'', mobile:'', address:'', city:'', postal_code:'', country:'Portugal', notes:'' })
    setShowForm(false); setEditClient(null); setSaving(false); load()
  }

  const handleDelete = async (id) => {
    if (!confirm('Arquivar este cliente?')) return
    const cli = clients.find(c=>c.id===id)
    await supabase.from('clients').update({ active: false }).eq('id', id)
    await logActivity({ action:'deleted', entityType:'client', entityRef:cli?.name, description:`arquivou cliente ${cli?.name}` })
    setSelected(null); load()
  }

  const totalReceived = payments.filter(p=>p.status==='Pago').reduce((a,p)=>a+parseFloat(p.amount||0),0)
  const totalPending = payments.filter(p=>p.status!=='Pago').reduce((a,p)=>a+parseFloat(p.amount||0),0)
  const countries = [...new Set(clients.map(c=>c.country).filter(Boolean))]

  const filtered = clients.filter(c => {
    const s = search.toLowerCase()
    const matchS = !s || c.name?.toLowerCase().includes(s) || c.company?.toLowerCase().includes(s) || c.city?.toLowerCase().includes(s) || c.email?.toLowerCase().includes(s)
    const matchC = !filterCountry || c.country === filterCountry
    return matchS && matchC
  })

  if (loading) return <div className="loading"><i className="ti ti-loader-2"/>A carregar...</div>

  return (
    <div>
      {showForm && (
        <div className="card" style={{maxWidth:660,marginBottom:16}}>
          <div className="card-header"><span className="card-title">{editClient?'Editar Cliente':'Novo Cliente'}</span></div>
          <div className="form-grid">
            <div className="form-group"><label>Nome *</label><input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} /></div>
            <div className="form-group"><label>Empresa</label><input value={form.company} onChange={e=>setForm({...form,company:e.target.value})} /></div>
            <div className="form-group"><label>NIF</label><input value={form.nif} onChange={e=>setForm({...form,nif:e.target.value})} /></div>
            <div className="form-group"><label>País</label>
              <select value={form.country} onChange={e=>setForm({...form,country:e.target.value})}>
                {COUNTRIES.map(c=><option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-group"><label>Email</label><input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} /></div>
            <div className="form-group"><label>Telefone</label><input value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} /></div>
            <div className="form-group"><label>Telemóvel</label><input value={form.mobile} onChange={e=>setForm({...form,mobile:e.target.value})} /></div>
            <div className="form-group"><label>Código Postal</label><input value={form.postal_code} onChange={e=>setForm({...form,postal_code:e.target.value})} /></div>
            <div className="form-group full"><label>Morada</label><input value={form.address} onChange={e=>setForm({...form,address:e.target.value})} /></div>
            <div className="form-group"><label>Cidade</label><input value={form.city} onChange={e=>setForm({...form,city:e.target.value})} /></div>
            <div className="form-group full"><label>Notas</label><textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} /></div>
          </div>
          <div className="form-actions">
            <button className="btn" onClick={()=>{setShowForm(false);setEditClient(null)}}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving?'A guardar...':editClient?'Guardar':'Guardar Cliente'}</button>
          </div>
        </div>
      )}

      <div style={{display:'flex',gap:16,alignItems:'flex-start',height:'calc(100vh - 140px)'}}>
        {/* Lista */}
        <div style={{width:280,flexShrink:0,overflowY:'auto',height:'100%'}}>
          <div className="card">
            <div className="card-header">
              <span className="card-title">Clientes ({filtered.length})</span>
              <button className="btn btn-primary" onClick={()=>{setShowForm(true);setEditClient(null)}}><i className="ti ti-plus"/>Novo</button>
            </div>
            <div style={{display:'flex',gap:6,marginBottom:10,flexWrap:'wrap'}}>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Pesquisar..." style={{flex:1,minWidth:100,border:'0.5px solid var(--border-hover)',borderRadius:'var(--radius)',padding:'6px 10px',fontSize:13,background:'var(--bg-card)',color:'var(--text)',fontFamily:'inherit'}} />
              <select value={filterCountry} onChange={e=>setFilterCountry(e.target.value)} style={{border:'0.5px solid var(--border-hover)',borderRadius:'var(--radius)',padding:'6px 8px',fontSize:12,background:'var(--bg-card)',color:'var(--text)',fontFamily:'inherit'}}>
                <option value="">Todos</option>
                {countries.map(c=><option key={c}>{c}</option>)}
              </select>
            </div>
            {filtered.length===0 ? <div className="empty">Sem clientes.</div>
              : <div style={{display:'flex',flexDirection:'column',gap:6}}>
                  {filtered.map(c=>(
                    <div key={c.id} onClick={()=>selectClient(c)}
                      style={{border:`1px solid ${selected?.id===c.id?'var(--blue)':'var(--border)'}`,borderLeft:`4px solid ${selected?.id===c.id?'var(--blue)':'var(--border)'}`,borderRadius:'var(--radius)',padding:'10px 12px',cursor:'pointer',background:selected?.id===c.id?'var(--blue-light)':'var(--bg-card)'}}>
                      <div style={{fontWeight:600,fontSize:13}}>{c.name}</div>
                      {c.company && <div style={{fontSize:11,color:'var(--blue)',marginTop:1}}>{c.company}</div>}
                      <div style={{fontSize:11,color:'var(--text-muted)',marginTop:2}}>{c.city||''} {c.country?`· ${c.country}`:''}</div>
                      {c.phone && <div style={{fontSize:11,color:'var(--text-muted)'}}>{c.phone}</div>}
                    </div>
                  ))}
                </div>
            }
          </div>
        </div>

        {/* Ficha do cliente */}
        {selected && (
          <div style={{flex:1,minWidth:0,overflowY:'auto',height:'100%'}}>
            <div className="card" style={{marginBottom:12}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:12,marginBottom:14}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:20,fontWeight:700,marginBottom:2}}>{selected.name}</div>
                  {selected.company && <div style={{fontSize:14,color:'var(--blue)',fontWeight:500,marginBottom:4}}>{selected.company}</div>}
                  {selected.nif && <div style={{fontSize:12,color:'var(--text-muted)'}}>NIF: {selected.nif}</div>}
                </div>
                <div style={{display:'flex',gap:6,flexShrink:0}}>
                  <button className="btn btn-sm" onClick={()=>openEdit(selected)}><i className="ti ti-edit"/>Editar</button>
                  {isAdmin && <button className="btn btn-sm" style={{color:'var(--red)'}} onClick={()=>handleDelete(selected.id)}><i className="ti ti-trash"/></button>}
                  <button className="btn btn-sm" onClick={()=>setSelected(null)}><i className="ti ti-x"/></button>
                </div>
              </div>

              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:12}}>
                <div style={{background:'var(--bg)',borderRadius:'var(--radius)',padding:'10px 12px'}}>
                  <div style={{fontSize:10,fontWeight:600,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:6}}>📞 Contacto</div>
                  {selected.phone && <div style={{fontSize:12,marginTop:2}}><a href={`tel:${selected.phone}`} style={{color:'var(--blue)',textDecoration:'none'}}><i className="ti ti-phone" style={{marginRight:4}}/>{selected.phone}</a></div>}
                  {selected.mobile && <div style={{fontSize:12}}><a href={`tel:${selected.mobile}`} style={{color:'var(--blue)',textDecoration:'none'}}><i className="ti ti-device-mobile" style={{marginRight:4}}/>{selected.mobile}</a></div>}
                  {selected.email && <div style={{fontSize:12}}><a href={`mailto:${selected.email}`} style={{color:'var(--blue)',textDecoration:'none'}}><i className="ti ti-mail" style={{marginRight:4}}/>{selected.email}</a></div>}
                  {!selected.phone && !selected.mobile && !selected.email && <div style={{fontSize:12,color:'var(--text-muted)'}}>Sem contacto</div>}
                </div>
                <div style={{background:'var(--bg)',borderRadius:'var(--radius)',padding:'10px 12px'}}>
                  <div style={{fontSize:10,fontWeight:600,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:6}}>📍 Morada</div>
                  {selected.address && <div style={{fontSize:12}}>{selected.address}</div>}
                  {(selected.postal_code||selected.city) && <div style={{fontSize:12,fontWeight:500}}>{selected.postal_code} {selected.city}</div>}
                  {selected.country && <div style={{fontSize:12,color:'var(--text-muted)'}}>{selected.country}</div>}
                  {!selected.address && !selected.city && <div style={{fontSize:12,color:'var(--text-muted)'}}>Sem morada</div>}
                </div>
                <div style={{background:'var(--bg)',borderRadius:'var(--radius)',padding:'10px 12px'}}>
                  <div style={{fontSize:10,fontWeight:600,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:6}}>💶 Financeiro</div>
                  <div style={{fontSize:13}}><span style={{color:'var(--text-muted)'}}>Negócios: </span><strong>{affaires.length}</strong></div>
                  <div style={{fontSize:13,marginTop:2}}><span style={{color:'var(--text-muted)'}}>Recebido: </span><strong style={{color:'var(--green)'}}>€ {totalReceived.toLocaleString('pt-PT')}</strong></div>
                  <div style={{fontSize:13}}><span style={{color:'var(--text-muted)'}}>Pendente: </span><strong style={{color:totalPending>0?'var(--amber)':'var(--text-muted)'}}>€ {totalPending.toLocaleString('pt-PT')}</strong></div>
                </div>
              </div>

              {selected.notes && <div style={{padding:'8px 12px',background:'var(--amber-light)',borderRadius:'var(--radius)',fontSize:12,borderLeft:'3px solid var(--amber)'}}>{selected.notes}</div>}
            </div>

            <div className="card">
              <div className="tabs">
                <div className={`tab ${tab==='info'?'active':''}`} onClick={()=>setTab('info')}>Negócios {affaires.length>0&&<span style={{background:'var(--blue)',color:'white',borderRadius:10,fontSize:10,padding:'1px 5px',marginLeft:3}}>{affaires.length}</span>}</div>
                <div className={`tab ${tab==='orders'?'active':''}`} onClick={()=>setTab('orders')}>Encomendas {orders.length>0&&<span style={{background:'var(--blue)',color:'white',borderRadius:10,fontSize:10,padding:'1px 5px',marginLeft:3}}>{orders.length}</span>}</div>
                <div className={`tab ${tab==='payments'?'active':''}`} onClick={()=>setTab('payments')}>Pagamentos {payments.length>0&&<span style={{background:'var(--blue)',color:'white',borderRadius:10,fontSize:10,padding:'1px 5px',marginLeft:3}}>{payments.length}</span>}</div>
              </div>

              {tab==='info' && (
                affaires.length===0 ? <div className="empty">Sem negócios/obras.</div>
                : affaires.map(a=>(
                    <div key={a.id} style={{padding:'12px 0',borderBottom:'0.5px solid var(--border)'}}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:8}}>
                        <div style={{flex:1}}>
                          <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:3}}>
                            <span style={{fontWeight:600,fontSize:13}}>{a.name}</span>
                          </div>
                          <div style={{fontSize:11,color:'var(--text-muted)'}}>{a.ref_number} {a.city?`· ${a.city}`:''}</div>
                          {a.address && <div style={{fontSize:11,color:'var(--text-muted)'}}><i className="ti ti-map-pin" style={{marginRight:3}}/>{a.address}</div>}
                          {(a.start_date||a.end_date) && <div style={{fontSize:11,color:'var(--text-muted)',marginTop:2}}>
                            {a.start_date?`Início: ${new Date(a.start_date).toLocaleDateString('pt-PT')}`:''}
                            {a.end_date?` · Fim: ${new Date(a.end_date).toLocaleDateString('pt-PT')}`:''}
                          </div>}
                          {a.budget && <div style={{fontSize:12,marginTop:2}}>Orçamento: <strong>€ {parseFloat(a.budget).toLocaleString('pt-PT')}</strong></div>}
                          {a.notes && <div style={{fontSize:11,color:'var(--text-muted)',fontStyle:'italic',marginTop:2}}>{a.notes}</div>}
                        </div>
                        <span className={`badge ${AFFAIRE_CLASS[a.status]||''}`}>{a.status}</span>
                      </div>
                    </div>
                  ))
              )}

              {tab==='orders' && (
                orders.length===0 ? <div className="empty">Sem encomendas.</div>
                : orders.map(o=>(
                    <div key={o.id} style={{padding:'12px 0',borderBottom:'0.5px solid var(--border)'}}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:8}}>
                        <div style={{flex:1}}>
                          <div style={{fontWeight:500,fontSize:13,marginBottom:3}}>{o.ref_number} {o.affaires&&<span style={{fontSize:11,color:'var(--blue)',marginLeft:4}}>{o.affaires.ref_number}</span>}</div>
                          <div style={{fontSize:12,color:'var(--text-muted)'}}>{o.description?.slice(0,80)}</div>
                          <div style={{fontSize:11,color:'var(--text-muted)',marginTop:2}}>
                            Via {o.received_via} · {o.received_date?new Date(o.received_date).toLocaleDateString('pt-PT'):''}
                            · por {o.employees?.emp_code||'—'}
                          </div>
                          {o.delivery_address && <div style={{fontSize:11,color:'var(--text-muted)',marginTop:1}}><i className="ti ti-map-pin" style={{marginRight:3}}/>{o.delivery_address}, {o.delivery_city} {o.delivery_date?`· ${new Date(o.delivery_date).toLocaleDateString('pt-PT')}`:''}</div>}
                        </div>
                        <span className={`badge ${STATUS_CLASS[o.status]||''}`}>{o.status}</span>
                      </div>
                    </div>
                  ))
              )}

              {tab==='payments' && (
                payments.length===0 ? <div className="empty">Sem pagamentos.</div>
                : <>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:12}}>
                      <div style={{background:'var(--green-light)',borderRadius:'var(--radius)',padding:'8px 12px',fontSize:12}}>
                        <div style={{color:'var(--green)',fontWeight:600,fontSize:16}}>€ {totalReceived.toLocaleString('pt-PT')}</div>
                        <div style={{color:'var(--text-muted)'}}>Recebido</div>
                      </div>
                      <div style={{background:'var(--amber-light)',borderRadius:'var(--radius)',padding:'8px 12px',fontSize:12}}>
                        <div style={{color:'var(--amber)',fontWeight:600,fontSize:16}}>€ {totalPending.toLocaleString('pt-PT')}</div>
                        <div style={{color:'var(--text-muted)'}}>Pendente</div>
                      </div>
                    </div>
                    {payments.map(p=>(
                      <div key={p.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0',borderBottom:'0.5px solid var(--border)',fontSize:13}}>
                        <div>
                          <div style={{fontWeight:500}}>{p.invoice_ref||'Sem fatura'} {p.affaires&&<span style={{fontSize:11,color:'var(--blue)',marginLeft:4}}>{p.affaires.ref_number}</span>}</div>
                          <div style={{fontSize:11,color:'var(--text-muted)',marginTop:1}}>
                            {p.due_date?`Vence ${new Date(p.due_date).toLocaleDateString('pt-PT')}`:''} 
                            {p.paid_date?` · Pago ${new Date(p.paid_date).toLocaleDateString('pt-PT')}`:''}
                          </div>
                        </div>
                        <div style={{display:'flex',alignItems:'center',gap:8}}>
                          <span style={{fontWeight:600}}>€ {parseFloat(p.amount).toLocaleString('pt-PT')}</span>
                          <span className={`badge ${p.status==='Pago'?'badge-delivered':p.status==='Em atraso'?'badge-critical':'badge-pending'}`}>{p.status}</span>
                        </div>
                      </div>
                    ))}
                  </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
