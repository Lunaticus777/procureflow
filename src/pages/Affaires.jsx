import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

const STATUS_CLASS = { 'Aberta':'badge-quotation','Em curso':'badge-ordered','Concluída':'badge-delivered','Cancelada':'badge-cancelled' }
const ORDER_STATUS = { 'Recebido':'badge-pending','Em preparação':'badge-quotation','Encomendado':'badge-ordered','Parcial':'badge-warning','Entregue':'badge-delivered','Cancelado':'badge-cancelled' }
const PRIO_CLASS = { 'Urgente':'prio-high','Normal':'prio-med','Baixa':'prio-low' }

const FILE_ICONS = {
  'application/pdf': '📄',
  'image/jpeg': '🖼️', 'image/png': '🖼️', 'image/webp': '🖼️',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '📝',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '📊',
}

export default function Affaires() {
  const { session } = useAuth()
  const [affaires, setAffaires] = useState([])
  const [clients, setClients] = useState([])
  const [orders, setOrders] = useState([])
  const [requisitions, setRequisitions] = useState([])
  const [docs, setDocs] = useState([])
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editAffaire, setEditAffaire] = useState(null)
  const [expanded, setExpanded] = useState(null)
  const [tab, setTab] = useState('orders')
  const [form, setForm] = useState({ ref_number:'', name:'', client_id:'', address:'', city:'', status:'Aberta', start_date:'', budget:'', notes:'' })
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState('')
  const fileRef = useRef()

  const load = async () => {
    const [{ data: af }, { data: cl }] = await Promise.all([
      supabase.from('affaires').select('*, clients(name, phone, company)').order('created_at', { ascending: false }),
      supabase.from('clients').select('id, name, company').eq('active', true).order('name'),
    ])
    setAffaires(af || [])
    setClients(cl || [])
    setLoading(false)
  }

  const loadDetail = async (affaireId) => {
    const [{ data: ord }, { data: req }] = await Promise.all([
      supabase.from('client_orders').select('*, employees(full_name, emp_code)').eq('affaire_id', affaireId).order('created_at', { ascending: false }),
      supabase.from('requisitions').select('*, employees(full_name, emp_code)').eq('affaire_id', affaireId).order('created_at', { ascending: false }),
    ])
    setOrders(ord || [])
    setRequisitions(req || [])
  }

  const loadDocs = async (affaireId) => {
    const { data, error } = await supabase.storage
      .from('procureflow-docs')
      .list(`affaires/${affaireId}`, { sortBy: { column: 'created_at', order: 'desc' } })
    if (!error) setDocs(data || [])
  }

  useEffect(() => { load() }, [])

  const selectAffaire = (a) => {
    setSelected(a)
    loadDetail(a.id)
    loadDocs(a.id)
    setTab('orders')
  }

  const openEdit = (a) => {
    setEditAffaire(a)
    setForm({ ref_number:a.ref_number, name:a.name, client_id:a.client_id||'', address:a.address||'', city:a.city||'', status:a.status, start_date:a.start_date||'', budget:a.budget||'', notes:a.notes||'' })
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.name) return
    setSaving(true)
    const { data: emp } = await supabase.from('employees').select('id').eq('email', session?.user?.email).single()
    if (editAffaire) {
      await supabase.from('affaires').update({ ...form, budget: form.budget ? parseFloat(form.budget) : null }).eq('id', editAffaire.id)
    } else {
      const count = affaires.length + 1
      await supabase.from('affaires').insert({ ...form, ref_number: form.ref_number || `NEG-${String(count).padStart(3,'0')}`, budget: form.budget ? parseFloat(form.budget) : null, created_by: emp?.id || null })
    }
    setForm({ ref_number:'', name:'', client_id:'', address:'', city:'', status:'Aberta', start_date:'', budget:'', notes:'' })
    setShowForm(false); setEditAffaire(null); setSaving(false); load()
  }

  const handleDelete = async (id) => {
    if (!confirm('Apagar este negócio?')) return
    const { error } = await supabase.from('affaires').delete().eq('id', id)
    if (error) { alert('Erro: ' + error.message); return }
    setSelected(null); load()
  }

  const handleUpload = async (e) => {
    const files = Array.from(e.target.files)
    if (!files.length || !selected) return
    setUploading(true)
    for (const file of files) {
      setUploadProgress(`A carregar ${file.name}...`)
      const ext = file.name.split('.').pop()
      const fileName = `${Date.now()}_${file.name}`
      const path = `affaires/${selected.id}/${fileName}`
      const { error } = await supabase.storage.from('procureflow-docs').upload(path, file)
      if (error) alert(`Erro ao carregar ${file.name}: ${error.message}`)
    }
    setUploadProgress('')
    setUploading(false)
    fileRef.current.value = ''
    loadDocs(selected.id)
  }

  const handleDownload = async (fileName) => {
    const path = `affaires/${selected.id}/${fileName}`
    const { data, error } = await supabase.storage.from('procureflow-docs').createSignedUrl(path, 3600)
    if (error) { alert('Erro: ' + error.message); return }
    window.open(data.signedUrl, '_blank')
  }

  const handleDeleteDoc = async (fileName) => {
    if (!confirm(`Apagar "${fileName}"?`)) return
    const path = `affaires/${selected.id}/${fileName}`
    const { error } = await supabase.storage.from('procureflow-docs').remove([path])
    if (error) { alert('Erro: ' + error.message); return }
    loadDocs(selected.id)
  }

  const formatSize = (bytes) => {
    if (!bytes) return '—'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024*1024) return `${(bytes/1024).toFixed(1)} KB`
    return `${(bytes/1024/1024).toFixed(1)} MB`
  }

  const getIcon = (name) => {
    const ext = name.split('.').pop().toLowerCase()
    if (ext === 'pdf') return '📄'
    if (['jpg','jpeg','png','webp','gif'].includes(ext)) return '🖼️'
    if (['doc','docx'].includes(ext)) return '📝'
    if (['xls','xlsx'].includes(ext)) return '📊'
    return '📎'
  }

  if (loading) return <div className="loading"><i className="ti ti-loader-2"/>A carregar...</div>

  return (
    <div>
      {showForm && (
        <div className="card" style={{maxWidth:640,marginBottom:16}}>
          <div className="card-header"><span className="card-title">{editAffaire?'Editar Negócio':'Novo Negócio / Obra'}</span></div>
          <div className="form-grid">
            <div className="form-group"><label>Referência</label><input value={form.ref_number} onChange={e=>setForm({...form,ref_number:e.target.value})} placeholder="NEG-001 (auto)" /></div>
            <div className="form-group"><label>Estado</label>
              <select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}>
                {['Aberta','Em curso','Concluída','Cancelada'].map(s=><option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="form-group full"><label>Nome do negócio *</label><input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} /></div>
            <div className="form-group full"><label>Cliente</label>
              <select value={form.client_id} onChange={e=>setForm({...form,client_id:e.target.value})}>
                <option value="">Selecionar cliente...</option>
                {clients.map(c=><option key={c.id} value={c.id}>{c.name}{c.company?` — ${c.company}`:''}</option>)}
              </select>
            </div>
            <div className="form-group full"><label>Morada da obra</label><input value={form.address} onChange={e=>setForm({...form,address:e.target.value})} /></div>
            <div className="form-group"><label>Cidade</label><input value={form.city} onChange={e=>setForm({...form,city:e.target.value})} /></div>
            <div className="form-group"><label>Data início</label><input type="date" value={form.start_date} onChange={e=>setForm({...form,start_date:e.target.value})} /></div>
            <div className="form-group"><label>Orçamento (€)</label><input type="number" value={form.budget} onChange={e=>setForm({...form,budget:e.target.value})} /></div>
            <div className="form-group full"><label>Notas</label><textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} /></div>
          </div>
          <div className="form-actions">
            <button className="btn" onClick={()=>{setShowForm(false);setEditAffaire(null)}}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving?'A guardar...':editAffaire?'Guardar alterações':'Guardar Negócio'}</button>
          </div>
        </div>
      )}

      <div className="two-col">
        <div className="card">
          <div className="card-header">
            <span className="card-title">Negócios / Obras ({affaires.length})</span>
            <button className="btn btn-primary" onClick={()=>{setShowForm(true);setEditAffaire(null)}}><i className="ti ti-plus"/>Novo</button>
          </div>
          {affaires.length === 0
            ? <div className="empty">Sem negócios.</div>
            : <div className="table-wrap">
                <table>
                  <thead><tr><th>Ref.</th><th>Nome</th><th>Cliente</th><th>Estado</th><th></th></tr></thead>
                  <tbody>
                    {affaires.map(a => (
                      <tr key={a.id} style={{cursor:'pointer',background:selected?.id===a.id?'var(--bg)':''}} onClick={()=>selectAffaire(a)}>
                        <td style={{fontWeight:500}}>{a.ref_number}</td>
                        <td style={{maxWidth:130,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{a.name}</td>
                        <td style={{fontSize:12,color:'var(--text-muted)'}}>{a.clients?.name||'—'}</td>
                        <td><span className={`badge ${STATUS_CLASS[a.status]||''}`}>{a.status}</span></td>
                        <td onClick={e=>e.stopPropagation()}>
                          <div style={{display:'flex',gap:4}}>
                            <button className="btn btn-sm" onClick={()=>openEdit(a)}><i className="ti ti-edit"/></button>
                            <button className="btn btn-sm" style={{color:'var(--red)'}} onClick={()=>handleDelete(a.id)}><i className="ti ti-trash"/></button>
                          </div>
                        </td>
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
                  <div style={{fontSize:12,color:'var(--text-muted)',marginTop:2}}>{selected.ref_number} · {selected.clients?.name} {selected.clients?.phone?`· ${selected.clients.phone}`:''}</div>
                </div>
                <button className="btn btn-sm" onClick={()=>setSelected(null)}><i className="ti ti-x"/></button>
              </div>
              {selected.address && <div style={{fontSize:13,color:'var(--text-muted)',marginBottom:6}}><i className="ti ti-map-pin" style={{marginRight:4}}/>{selected.address}, {selected.city}</div>}
              {selected.budget && <div style={{fontSize:13,marginBottom:6}}><span style={{color:'var(--text-muted)'}}>Orçamento: </span><strong>€ {parseFloat(selected.budget).toLocaleString('pt-PT')}</strong></div>}
              {selected.notes && <div style={{fontSize:12,color:'var(--text-muted)',fontStyle:'italic',marginBottom:8}}>{selected.notes}</div>}
              <div style={{fontSize:12,color:'var(--blue)',padding:'8px 12px',background:'var(--blue-light)',borderRadius:'var(--radius)'}}>
                <i className="ti ti-info-circle" style={{marginRight:6}}/>Para adicionar encomendas, vai a <strong>Requisições</strong> e seleciona este negócio.
              </div>
            </div>

            <div className="card">
              <div className="tabs">
                <div className={`tab ${tab==='orders'?'active':''}`} onClick={()=>setTab('orders')}>Encomendas ({orders.length})</div>
                <div className={`tab ${tab==='req'?'active':''}`} onClick={()=>setTab('req')}>Requisições ({requisitions.length})</div>
                <div className={`tab ${tab==='docs'?'active':''}`} onClick={()=>setTab('docs')}>
                  Documentos {docs.length>0&&<span style={{background:'var(--blue)',color:'white',borderRadius:10,fontSize:10,padding:'1px 5px',marginLeft:4}}>{docs.length}</span>}
                </div>
              </div>

              {tab==='orders' && (
                orders.length===0 ? <div className="empty">Sem encomendas.</div>
                : orders.map(o => (
                    <div key={o.id} style={{padding:'10px 0',borderBottom:'0.5px solid var(--border)'}}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                        <div>
                          <div style={{fontWeight:500,fontSize:13}}>{o.ref_number} <span className={PRIO_CLASS[o.priority]||''} style={{fontSize:11}}>{o.priority}</span></div>
                          <div style={{fontSize:11,color:'var(--text-muted)',marginTop:2}}>{o.received_via} · {o.employees?.emp_code||'—'} {o.employees?.full_name||''}</div>
                          <div style={{fontSize:12,color:'var(--text-muted)',marginTop:2,cursor:'pointer'}} onClick={()=>setExpanded(expanded===o.id?null:o.id)}>
                            {o.description?.slice(0,80)}{o.description?.length>80?'...':''}
                          </div>
                          {expanded===o.id && o.image_url && <img src={o.image_url} alt="ref" style={{maxWidth:'100%',maxHeight:100,borderRadius:'var(--radius)',objectFit:'cover',marginTop:6}} />}
                        </div>
                        <span className={`badge ${ORDER_STATUS[o.status]||''}`}>{o.status}</span>
                      </div>
                    </div>
                  ))
              )}

              {tab==='req' && (
                requisitions.length===0
                  ? <div className="empty">Sem requisições. Cria em <strong>Requisições</strong> e associa a este negócio.</div>
                  : <table>
                      <thead><tr><th>Ref.</th><th>Material</th><th>Por</th><th>Estado</th></tr></thead>
                      <tbody>
                        {requisitions.map(r=>(
                          <tr key={r.id}>
                            <td style={{fontWeight:500}}>{r.ref_number}</td>
                            <td style={{fontSize:12,maxWidth:150,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.description}</td>
                            <td style={{fontSize:11,color:'var(--text-muted)'}}>{r.employees?.emp_code||'—'}</td>
                            <td><span className="badge badge-pending">{r.status}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
              )}

              {tab==='docs' && (
                <div>
                  {/* Upload zone */}
                  <div style={{border:'2px dashed var(--border-hover)',borderRadius:'var(--radius)',padding:'20px',textAlign:'center',marginBottom:14,background:'var(--bg)',cursor:'pointer'}} onClick={()=>fileRef.current?.click()}>
                    <input ref={fileRef} type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx" onChange={handleUpload} style={{display:'none'}} />
                    {uploading
                      ? <div style={{fontSize:13,color:'var(--blue)'}}><i className="ti ti-loader-2" style={{marginRight:6}}/>{uploadProgress}</div>
                      : <div>
                          <div style={{fontSize:24,marginBottom:6}}>📂</div>
                          <div style={{fontSize:13,fontWeight:500}}>Clica para adicionar documentos</div>
                          <div style={{fontSize:11,color:'var(--text-muted)',marginTop:4}}>PDF, imagens, Word, Excel · máx. 50 MB por ficheiro</div>
                        </div>
                    }
                  </div>

                  {/* Document list */}
                  {docs.length === 0
                    ? <div className="empty">Sem documentos. Carrega o primeiro!</div>
                    : docs.filter(d => d.name !== '.emptyFolderPlaceholder').map(doc => (
                        <div key={doc.name} style={{display:'flex',alignItems:'center',gap:10,padding:'9px 0',borderBottom:'0.5px solid var(--border)'}}>
                          <span style={{fontSize:20,flexShrink:0}}>{getIcon(doc.name)}</span>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontSize:13,fontWeight:500,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                              {doc.name.replace(/^\d+_/, '')}
                            </div>
                            <div style={{fontSize:11,color:'var(--text-muted)',marginTop:2}}>
                              {formatSize(doc.metadata?.size)} · {doc.created_at ? new Date(doc.created_at).toLocaleDateString('pt-PT') : ''}
                            </div>
                          </div>
                          <div style={{display:'flex',gap:6,flexShrink:0}}>
                            <button className="btn btn-sm btn-primary" onClick={()=>handleDownload(doc.name)}>
                              <i className="ti ti-download"/>Ver
                            </button>
                            <button className="btn btn-sm" style={{color:'var(--red)'}} onClick={()=>handleDeleteDoc(doc.name)}>
                              <i className="ti ti-trash"/>
                            </button>
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
