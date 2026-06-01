import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useRole } from '../hooks/useRole'

const STATUS_CLASS = { 'Aberta':'badge-quotation','Em curso':'badge-ordered','Concluída':'badge-delivered','Cancelada':'badge-cancelled' }
const STATUS_COLOR = { 'Aberta':'var(--blue)','Em curso':'var(--amber)','Concluída':'var(--green)','Cancelada':'var(--red)' }
const ORDER_STATUS = { 'Recebido':'badge-pending','Em preparação':'badge-quotation','Encomendado':'badge-ordered','Parcial':'badge-warning','Entregue':'badge-delivered','Cancelado':'badge-cancelled' }
const PRIO_CLASS = { 'Urgente':'prio-high','Normal':'prio-med','Baixa':'prio-low' }
const REQ_STATUS = { 'Pendente':'badge-pending','Em cotação':'badge-quotation','Aprovado':'badge-approved','Encomendado':'badge-ordered','Entregue':'badge-delivered','Cancelado':'badge-cancelled' }

export default function Affaires() {
  const { session } = useAuth()
  const { isAdmin } = useRole()
  const [affaires, setAffaires] = useState([])
  const [clients, setClients] = useState([])
  const [orders, setOrders] = useState([])
  const [requisitions, setRequisitions] = useState([])
  const [docs, setDocs] = useState([])
  const [payments, setPayments] = useState([])
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editAffaire, setEditAffaire] = useState(null)
  const [tab, setTab] = useState('resume')
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [form, setForm] = useState({ ref_number:'', name:'', client_id:'', address:'', city:'', status:'Aberta', start_date:'', end_date:'', budget:'', notes:'' })
  const [saving, setSaving] = useState(false)

  const load = async () => {
    const [{ data: af }, { data: cl }] = await Promise.all([
      supabase.from('affaires').select('*, clients(name, phone, mobile, email, company)').order('created_at', { ascending: false }),
      supabase.from('clients').select('id, name, company').eq('active', true).order('name'),
    ])
    setAffaires(af || [])
    setClients(cl || [])
    setLoading(false)
  }

  const loadDetail = async (a) => {
    const [{ data: ord }, { data: req }, { data: pay }, { data: docsData }] = await Promise.all([
      supabase.from('client_orders').select('*, employees(full_name, emp_code)').eq('affaire_id', a.id).order('created_at', { ascending: false }),
      supabase.from('requisitions').select('*, employees(full_name, emp_code)').eq('affaire_id', a.id).order('created_at', { ascending: false }),
      supabase.from('client_payments').select('*').eq('affaire_id', a.id).order('created_at', { ascending: false }),
      supabase.storage.from('procureflow-docs').list(`affaires/${a.id}`, { sortBy: { column: 'created_at', order: 'desc' } }),
    ])
    setOrders(ord || [])
    setRequisitions(req || [])
    setPayments(pay || [])
    setDocs((docsData || []).filter(d => d.name !== '.emptyFolderPlaceholder'))
  }

  useEffect(() => { load() }, [])

  const selectAffaire = (a) => {
    setSelected(a)
    loadDetail(a)
    setTab('resume')
  }

  const openEdit = (a) => {
    setEditAffaire(a)
    setForm({ ref_number:a.ref_number, name:a.name, client_id:a.client_id||'', address:a.address||'', city:a.city||'', status:a.status, start_date:a.start_date||'', end_date:a.end_date||'', budget:a.budget||'', notes:a.notes||'' })
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.name) return
    setSaving(true)
    const { data: emp } = await supabase.from('employees').select('id').eq('email', session?.user?.email).single()
    if (editAffaire) {
      await supabase.from('affaires').update({ ...form, budget: form.budget ? parseFloat(form.budget) : null }).eq('id', editAffaire.id)
      setSelected({ ...editAffaire, ...form, budget: form.budget ? parseFloat(form.budget) : null, clients: editAffaire.clients })
    } else {
      const count = affaires.length + 1
      await supabase.from('affaires').insert({ ...form, ref_number: form.ref_number || `NEG-${String(count).padStart(3,'0')}`, budget: form.budget ? parseFloat(form.budget) : null, created_by: emp?.id || null })
    }
    setForm({ ref_number:'', name:'', client_id:'', address:'', city:'', status:'Aberta', start_date:'', end_date:'', budget:'', notes:'' })
    setShowForm(false); setEditAffaire(null); setSaving(false); load()
  }

  const handleDelete = async (id) => {
    if (!confirm('Apagar este negócio?')) return
    const { error } = await supabase.from('affaires').delete().eq('id', id)
    if (error) { alert('Erro: ' + error.message); return }
    setSelected(null); load()
  }

  const handleDownload = async (fileName) => {
    const path = `affaires/${selected.id}/${fileName}`
    const { data, error } = await supabase.storage.from('procureflow-docs').createSignedUrl(path, 3600)
    if (error) { alert('Erro: ' + error.message); return }
    window.open(data.signedUrl, '_blank')
  }

  const handleDeleteDoc = async (fileName) => {
    if (!confirm(`Apagar "${fileName}"?`)) return
    await supabase.storage.from('procureflow-docs').remove([`affaires/${selected.id}/${fileName}`])
    loadDetail(selected)
  }

  const handleUpload = async (e) => {
    const files = Array.from(e.target.files)
    if (!files.length) return
    for (const file of files) {
      await supabase.storage.from('procureflow-docs').upload(`affaires/${selected.id}/${Date.now()}_${file.name}`, file)
    }
    e.target.value = ''
    loadDetail(selected)
  }

  const getIcon = (name) => {
    const ext = name.split('.').pop().toLowerCase()
    if (ext === 'pdf') return '📄'
    if (['jpg','jpeg','png','webp','gif'].includes(ext)) return '🖼️'
    if (['doc','docx'].includes(ext)) return '📝'
    if (['xls','xlsx'].includes(ext)) return '📊'
    return '📎'
  }

  const formatSize = (bytes) => {
    if (!bytes) return ''
    if (bytes < 1024*1024) return `${(bytes/1024).toFixed(0)} KB`
    return `${(bytes/1024/1024).toFixed(1)} MB`
  }

  const totalReceived = payments.filter(p=>p.status==='Pago').reduce((a,p)=>a+parseFloat(p.amount||0),0)
  const totalPending = payments.filter(p=>p.status!=='Pago').reduce((a,p)=>a+parseFloat(p.amount||0),0)

  const filtered = affaires.filter(a => {
    const s = search.toLowerCase()
    const matchS = !s || a.name?.toLowerCase().includes(s) || a.ref_number?.toLowerCase().includes(s) || a.clients?.name?.toLowerCase().includes(s) || a.city?.toLowerCase().includes(s)
    const matchSt = !filterStatus || a.status === filterStatus
    return matchS && matchSt
  })

  if (loading) return <div className="loading"><i className="ti ti-loader-2"/>A carregar...</div>

  return (
    <div>
      {showForm && (
        <div className="card" style={{maxWidth:660,marginBottom:16}}>
          <div className="card-header"><span className="card-title">{editAffaire?'Editar Negócio':'Novo Negócio / Obra'}</span></div>
          <div className="form-grid">
            <div className="form-group"><label>Referência</label><input value={form.ref_number} onChange={e=>setForm({...form,ref_number:e.target.value})} placeholder="NEG-001 (auto)" /></div>
            <div className="form-group"><label>Estado</label>
              <select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}>
                {['Aberta','Em curso','Concluída','Cancelada'].map(s=><option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="form-group full"><label>Nome do negócio *</label><input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Ex: 10 Apartamentos Lisboa T2" /></div>
            <div className="form-group full"><label>Cliente</label>
              <select value={form.client_id} onChange={e=>setForm({...form,client_id:e.target.value})}>
                <option value="">— Selecionar cliente —</option>
                {clients.map(c=><option key={c.id} value={c.id}>{c.name}{c.company?` — ${c.company}`:''}</option>)}
              </select>
            </div>
            <div className="form-group full"><label>Morada da obra</label><input value={form.address} onChange={e=>setForm({...form,address:e.target.value})} /></div>
            <div className="form-group"><label>Cidade</label><input value={form.city} onChange={e=>setForm({...form,city:e.target.value})} /></div>
            <div className="form-group"><label>Orçamento (€)</label><input type="number" value={form.budget} onChange={e=>setForm({...form,budget:e.target.value})} /></div>
            <div className="form-group"><label>Data início</label><input type="date" value={form.start_date} onChange={e=>setForm({...form,start_date:e.target.value})} /></div>
            <div className="form-group"><label>Data fim prevista</label><input type="date" value={form.end_date} onChange={e=>setForm({...form,end_date:e.target.value})} /></div>
            <div className="form-group full"><label>Notas</label><textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} /></div>
          </div>
          <div className="form-actions">
            <button className="btn" onClick={()=>{setShowForm(false);setEditAffaire(null)}}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving?'A guardar...':editAffaire?'Guardar alterações':'Guardar Negócio'}</button>
          </div>
        </div>
      )}

      <div style={{display:'flex',gap:16,alignItems:'flex-start',height:'calc(100vh - 140px)'}}>
        {/* Lista */}
        <div style={{width:300,flexShrink:0,overflowY:'auto',height:'100%'}}>
          <div className="card">
            <div className="card-header">
              <span className="card-title">Negócios ({filtered.length})</span>
              <button data-new-affaire="true" className="btn btn-primary" onClick={()=>{setShowForm(true);setEditAffaire(null)}}><i className="ti ti-plus"/>Novo</button>
            </div>
            <div style={{display:'flex',gap:6,marginBottom:10,flexWrap:'wrap'}}>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Pesquisar..." style={{flex:1,minWidth:100,border:'0.5px solid var(--border-hover)',borderRadius:'var(--radius)',padding:'6px 10px',fontSize:13,background:'var(--bg-card)',color:'var(--text)',fontFamily:'inherit'}} />
              <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} style={{border:'0.5px solid var(--border-hover)',borderRadius:'var(--radius)',padding:'6px 8px',fontSize:12,background:'var(--bg-card)',color:'var(--text)',fontFamily:'inherit'}}>
                <option value="">Todos</option>
                {['Aberta','Em curso','Concluída','Cancelada'].map(s=><option key={s}>{s}</option>)}
              </select>
            </div>
            {filtered.length === 0
              ? <div className="empty">Sem negócios.</div>
              : <div style={{display:'flex',flexDirection:'column',gap:6}}>
                  {filtered.map(a=>(
                    <div key={a.id}
                      onClick={()=>selectAffaire(a)}
                      style={{border:`1px solid ${selected?.id===a.id?'var(--blue)':'var(--border)'}`,borderLeft:`4px solid ${STATUS_COLOR[a.status]||'var(--border)'}`,borderRadius:'var(--radius)',padding:'10px 12px',cursor:'pointer',background:selected?.id===a.id?'var(--blue-light)':'var(--bg-card)'}}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:6}}>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:11,color:'var(--text-muted)',fontWeight:500}}>{a.ref_number}</div>
                          <div style={{fontWeight:600,fontSize:13,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',marginTop:2}}>{a.name}</div>
                          <div style={{fontSize:12,color:'var(--text-muted)',marginTop:2}}>{a.clients?.name||'—'} {a.city?`· ${a.city}`:''}</div>
                        </div>
                        <span className={`badge ${STATUS_CLASS[a.status]||''}`} style={{fontSize:10,flexShrink:0}}>{a.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
            }
          </div>
        </div>

        {/* Ficha detalhada */}
        {selected && (
          <div style={{flex:1,minWidth:0,overflowY:'auto',height:'100%'}}>
            {/* Cabeçalho da ficha */}
            <div className="card" style={{marginBottom:12}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:12,marginBottom:14}}>
                <div style={{flex:1}}>
                  <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                    <span style={{fontSize:12,fontWeight:600,color:'var(--text-muted)'}}>{selected.ref_number}</span>
                    <span className={`badge ${STATUS_CLASS[selected.status]||''}`}>{selected.status}</span>
                  </div>
                  <div style={{fontSize:20,fontWeight:700,marginBottom:8}}>{selected.name}</div>
                </div>
                <div style={{display:'flex',gap:6,flexShrink:0}}>
                  <button className="btn btn-sm" onClick={()=>openEdit(selected)}><i className="ti ti-edit"/>Editar</button>
                  {isAdmin && <button className="btn btn-sm" style={{color:'var(--red)'}} onClick={()=>handleDelete(selected.id)}><i className="ti ti-trash"/></button>}
                  <button className="btn btn-sm" onClick={()=>setSelected(null)}><i className="ti ti-x"/></button>
                </div>
              </div>

              {/* Grid de informações */}
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:14}}>
                {/* Cliente */}
                <div style={{background:'var(--bg)',borderRadius:'var(--radius)',padding:'10px 12px'}}>
                  <div style={{fontSize:10,fontWeight:600,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:6}}>👤 Cliente</div>
                  <div style={{fontWeight:600,fontSize:13}}>{selected.clients?.name||'—'}</div>
                  {selected.clients?.company && <div style={{fontSize:12,color:'var(--text-muted)'}}>{selected.clients.company}</div>}
                  {selected.clients?.phone && <div style={{fontSize:12,marginTop:4}}><a href={`tel:${selected.clients.phone}`} style={{color:'var(--blue)',textDecoration:'none'}}><i className="ti ti-phone" style={{marginRight:4}}/>{selected.clients.phone}</a></div>}
                  {selected.clients?.mobile && <div style={{fontSize:12}}><a href={`tel:${selected.clients.mobile}`} style={{color:'var(--blue)',textDecoration:'none'}}><i className="ti ti-device-mobile" style={{marginRight:4}}/>{selected.clients.mobile}</a></div>}
                  {selected.clients?.email && <div style={{fontSize:12}}><a href={`mailto:${selected.clients.email}`} style={{color:'var(--blue)',textDecoration:'none'}}><i className="ti ti-mail" style={{marginRight:4}}/>{selected.clients.email}</a></div>}
                </div>

                {/* Localização */}
                <div style={{background:'var(--bg)',borderRadius:'var(--radius)',padding:'10px 12px'}}>
                  <div style={{fontSize:10,fontWeight:600,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:6}}>📍 Obra</div>
                  {selected.address ? <div style={{fontSize:13}}>{selected.address}</div> : <div style={{fontSize:12,color:'var(--text-muted)'}}>Sem morada</div>}
                  {selected.city && <div style={{fontSize:13,fontWeight:500,marginTop:2}}>{selected.city}</div>}
                  {selected.start_date && <div style={{fontSize:12,color:'var(--text-muted)',marginTop:6}}>Início: {new Date(selected.start_date).toLocaleDateString('pt-PT')}</div>}
                  {selected.end_date && <div style={{fontSize:12,color:'var(--text-muted)'}}>Fim prev.: {new Date(selected.end_date).toLocaleDateString('pt-PT')}</div>}
                </div>

                {/* Financeiro */}
                <div style={{background:'var(--bg)',borderRadius:'var(--radius)',padding:'10px 12px'}}>
                  <div style={{fontSize:10,fontWeight:600,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:6}}>💶 Financeiro</div>
                  {selected.budget && <div style={{fontSize:13}}><span style={{color:'var(--text-muted)'}}>Orçamento: </span><strong>€ {parseFloat(selected.budget).toLocaleString('pt-PT')}</strong></div>}
                  <div style={{fontSize:13,marginTop:4}}><span style={{color:'var(--text-muted)'}}>Recebido: </span><strong style={{color:'var(--green)'}}>€ {totalReceived.toLocaleString('pt-PT')}</strong></div>
                  <div style={{fontSize:13}}><span style={{color:'var(--text-muted)'}}>Pendente: </span><strong style={{color:totalPending>0?'var(--amber)':'var(--text-muted)'}}>€ {totalPending.toLocaleString('pt-PT')}</strong></div>
                </div>
              </div>

              {/* Notas */}
              {selected.notes && (
                <div style={{padding:'10px 12px',background:'var(--amber-light)',borderRadius:'var(--radius)',borderLeft:'3px solid var(--amber)',fontSize:13}}>
                  <div style={{fontSize:10,fontWeight:600,color:'#633806',marginBottom:4}}>📋 NOTAS</div>
                  <div style={{whiteSpace:'pre-wrap'}}>{selected.notes}</div>
                </div>
              )}

              {/* Aviso */}
              <div style={{marginTop:10,fontSize:12,color:'var(--blue)',padding:'8px 12px',background:'var(--blue-light)',borderRadius:'var(--radius)'}}>
                <i className="ti ti-info-circle" style={{marginRight:6}}/>Para adicionar encomendas a esta obra, vai a <strong>Requisições</strong> e seleciona este negócio.
              </div>
            </div>

            {/* Separadores */}
            <div className="card">
              <div className="tabs">
                <div className={`tab ${tab==='resume'?'active':''}`} onClick={()=>setTab('resume')}>
                  Resumo
                </div>
                <div className={`tab ${tab==='orders'?'active':''}`} onClick={()=>setTab('orders')}>
                  Encomendas cliente {orders.length>0&&<span style={{background:'var(--blue)',color:'white',borderRadius:10,fontSize:10,padding:'1px 5px',marginLeft:4}}>{orders.length}</span>}
                </div>
                <div className={`tab ${tab==='req'?'active':''}`} onClick={()=>setTab('req')}>
                  Requisições {requisitions.length>0&&<span style={{background:'var(--blue)',color:'white',borderRadius:10,fontSize:10,padding:'1px 5px',marginLeft:4}}>{requisitions.length}</span>}
                </div>
                <div className={`tab ${tab==='docs'?'active':''}`} onClick={()=>setTab('docs')}>
                  Documentos {docs.length>0&&<span style={{background:'var(--blue)',color:'white',borderRadius:10,fontSize:10,padding:'1px 5px',marginLeft:4}}>{docs.length}</span>}
                </div>
              </div>

              {/* RESUMO */}
              {tab==='resume' && (
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                  <div style={{padding:'12px',background:'var(--bg)',borderRadius:'var(--radius)'}}>
                    <div style={{fontSize:11,fontWeight:600,color:'var(--text-muted)',marginBottom:8}}>📦 ENCOMENDAS DO CLIENTE</div>
                    <div style={{fontSize:22,fontWeight:700}}>{orders.length}</div>
                    <div style={{fontSize:12,color:'var(--text-muted)',marginTop:4}}>
                      {orders.filter(o=>o.status==='Entregue').length} entregues · {orders.filter(o=>o.status!=='Entregue'&&o.status!=='Cancelado').length} em curso
                    </div>
                  </div>
                  <div style={{padding:'12px',background:'var(--bg)',borderRadius:'var(--radius)'}}>
                    <div style={{fontSize:11,fontWeight:600,color:'var(--text-muted)',marginBottom:8}}>📋 REQUISIÇÕES</div>
                    <div style={{fontSize:22,fontWeight:700}}>{requisitions.length}</div>
                    <div style={{fontSize:12,color:'var(--text-muted)',marginTop:4}}>
                      {requisitions.filter(r=>r.status==='Pendente').length} pendentes · {requisitions.filter(r=>r.status==='Encomendado'||r.status==='Entregue').length} tratadas
                    </div>
                  </div>
                  <div style={{padding:'12px',background:'var(--bg)',borderRadius:'var(--radius)'}}>
                    <div style={{fontSize:11,fontWeight:600,color:'var(--text-muted)',marginBottom:8}}>📁 DOCUMENTOS</div>
                    <div style={{fontSize:22,fontWeight:700}}>{docs.length}</div>
                    <div style={{fontSize:12,color:'var(--text-muted)',marginTop:4}}>PDF, imagens, plantas</div>
                  </div>
                  <div style={{padding:'12px',background:'var(--bg)',borderRadius:'var(--radius)'}}>
                    <div style={{fontSize:11,fontWeight:600,color:'var(--text-muted)',marginBottom:8}}>💶 PAGAMENTOS</div>
                    <div style={{fontSize:22,fontWeight:700,color:'var(--green)'}}>€ {totalReceived.toLocaleString('pt-PT')}</div>
                    <div style={{fontSize:12,color:'var(--text-muted)',marginTop:4}}>recebido · pendente: € {totalPending.toLocaleString('pt-PT')}</div>
                  </div>
                </div>
              )}

              {/* ENCOMENDAS DO CLIENTE */}
              {tab==='orders' && (
                orders.length===0
                  ? <div className="empty">Sem encomendas do cliente.</div>
                  : orders.map(o=>(
                      <div key={o.id} style={{padding:'12px 0',borderBottom:'0.5px solid var(--border)'}}>
                        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:8}}>
                          <div style={{flex:1}}>
                            <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:4}}>
                              <span style={{fontWeight:600,fontSize:13}}>{o.ref_number}</span>
                              <span className={`${PRIO_CLASS[o.priority]||''}`} style={{fontSize:11}}>{o.priority}</span>
                            </div>
                            <div style={{fontSize:13,marginBottom:4}}>{o.description}</div>
                            <div style={{fontSize:11,color:'var(--text-muted)'}}>
                              Recebido via {o.received_via} · {o.received_date?new Date(o.received_date).toLocaleDateString('pt-PT'):''}
                              · por <strong>{o.employees?.emp_code||'—'}</strong> {o.employees?.full_name||''}
                            </div>
                            {o.delivery_address && <div style={{fontSize:11,color:'var(--text-muted)',marginTop:2}}><i className="ti ti-map-pin" style={{marginRight:4}}/>{o.delivery_address}, {o.delivery_city} {o.delivery_date?`· ${new Date(o.delivery_date).toLocaleDateString('pt-PT')}`:''}</div>}
                            {o.technical_contact_name && (
                              <div style={{fontSize:11,marginTop:4,color:'var(--blue)'}}>
                                <i className="ti ti-user-check" style={{marginRight:4}}/>{o.technical_contact_name}
                                {o.technical_contact_company?` — ${o.technical_contact_company}`:''}
                                {o.technical_contact_phone?<a href={`tel:${o.technical_contact_phone}`} style={{marginLeft:6,color:'var(--blue)',textDecoration:'none'}}>{o.technical_contact_phone}</a>:''}
                              </div>
                            )}
                            {o.notes && <div style={{fontSize:11,color:'var(--text-muted)',fontStyle:'italic',marginTop:2}}>{o.notes}</div>}
                          </div>
                          <span className={`badge ${ORDER_STATUS[o.status]||''}`}>{o.status}</span>
                        </div>
                      </div>
                    ))
              )}

              {/* REQUISIÇÕES */}
              {tab==='req' && (
                requisitions.length===0
                  ? <div className="empty">Sem requisições. Cria em <strong>Requisições</strong> e associa a este negócio.</div>
                  : requisitions.map(r=>(
                      <div key={r.id} style={{padding:'12px 0',borderBottom:'0.5px solid var(--border)'}}>
                        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:8}}>
                          <div style={{flex:1}}>
                            <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:4}}>
                              <span style={{fontWeight:600,fontSize:13}}>{r.ref_number}</span>
                              <span className={PRIO_CLASS[r.priority]||''} style={{fontSize:11}}>{r.priority}</span>
                            </div>
                            <div style={{fontSize:13,marginBottom:4}}>{r.description}</div>
                            <div style={{fontSize:11,color:'var(--text-muted)'}}>
                              {r.quantity} {r.unit}
                              {r.needed_by?` · Preciso: ${new Date(r.needed_by).toLocaleDateString('pt-PT')}`:''}
                              {` · por `}<strong>{r.employees?.emp_code||'—'}</strong>
                            </div>
                            {r.notes && <div style={{fontSize:11,color:'var(--text-muted)',fontStyle:'italic',marginTop:2}}>{r.notes}</div>}
                            {r.technical_contact_name && (
                              <div style={{fontSize:11,marginTop:4,color:'var(--blue)'}}>
                                <i className="ti ti-user-check" style={{marginRight:4}}/>{r.technical_contact_name}
                                {r.technical_contact_company?` — ${r.technical_contact_company}`:''}
                                {r.technical_contact_phone?<a href={`tel:${r.technical_contact_phone}`} style={{marginLeft:6,color:'var(--blue)',textDecoration:'none'}}>{r.technical_contact_phone}</a>:''}
                              </div>
                            )}
                          </div>
                          <span className={`badge ${REQ_STATUS[r.status]||''}`}>{r.status}</span>
                        </div>
                      </div>
                    ))
              )}

              {/* DOCUMENTOS */}
              {tab==='docs' && (
                <div>
                  <div style={{border:'2px dashed var(--border-hover)',borderRadius:'var(--radius)',padding:'16px',textAlign:'center',marginBottom:12,background:'var(--bg)',cursor:'pointer'}} onClick={()=>document.getElementById('doc-upload').click()}>
                    <input id="doc-upload" type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx" onChange={handleUpload} style={{display:'none'}} />
                    <div style={{fontSize:22,marginBottom:4}}>📂</div>
                    <div style={{fontSize:13,fontWeight:500}}>Clica para adicionar documentos</div>
                    <div style={{fontSize:11,color:'var(--text-muted)',marginTop:2}}>PDF, imagens, plantas, Word, Excel · máx. 50 MB</div>
                  </div>
                  {docs.length===0
                    ? <div className="empty">Sem documentos.</div>
                    : docs.map(doc=>(
                        <div key={doc.name} style={{display:'flex',alignItems:'center',gap:10,padding:'9px 0',borderBottom:'0.5px solid var(--border)'}}>
                          <span style={{fontSize:20,flexShrink:0}}>{getIcon(doc.name)}</span>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontSize:13,fontWeight:500,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{doc.name.replace(/^\d+_/,'')}</div>
                            <div style={{fontSize:11,color:'var(--text-muted)'}}>{formatSize(doc.metadata?.size)}</div>
                          </div>
                          <div style={{display:'flex',gap:6}}>
                            <button className="btn btn-sm btn-primary" onClick={()=>handleDownload(doc.name)}><i className="ti ti-download"/>Ver</button>
                            {isAdmin && <button className="btn btn-sm" style={{color:'var(--red)'}} onClick={()=>handleDeleteDoc(doc.name)}><i className="ti ti-trash"/></button>}
                          </div>
                        </div>
                      ))
                  }
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
