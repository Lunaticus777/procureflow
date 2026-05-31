import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

const STATUS_CLASS = {
  'Pendente':'badge-pending','Em cotação':'badge-quotation','Aprovado':'badge-approved',
  'Encomendado':'badge-ordered','Em trânsito':'badge-transit','Entregue':'badge-delivered','Cancelado':'badge-cancelled'
}
const PRIO_CLASS = { 'Alta':'prio-high','Média':'prio-med','Baixa':'prio-low' }

const EMPTY_FORM = {
  description:'', quantity:'', unit:'un.', priority:'Média', needed_by:'', min_quotes:'2',
  notes:'', affaire_id:'',
  technical_contact_name:'', technical_contact_phone:'', technical_contact_company:'', technical_contact_notes:''
}

export default function Requisitions() {
  const { session } = useAuth()
  const [rows, setRows] = useState([])
  const [affaires, setAffaires] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editReq, setEditReq] = useState(null)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterPrio, setFilterPrio] = useState('')
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [expanded, setExpanded] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const fileRef = useRef()

  const load = async () => {
    const [{ data: reqs }, { data: aff }] = await Promise.all([
      supabase.from('requisitions').select('*, employees(full_name, emp_code), affaires(name, ref_number)').order('created_at', { ascending: false }),
      supabase.from('affaires').select('id, name, ref_number').not('status','eq','Cancelada').order('ref_number'),
    ])
    setRows(reqs || [])
    setAffaires(aff || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const openEdit = (r) => {
    setEditReq(r)
    setForm({
      description:r.description, quantity:r.quantity, unit:r.unit, priority:r.priority,
      needed_by:r.needed_by||'', min_quotes:r.min_quotes, notes:r.notes||'', affaire_id:r.affaire_id||'',
      technical_contact_name:r.technical_contact_name||'', technical_contact_phone:r.technical_contact_phone||'',
      technical_contact_company:r.technical_contact_company||'', technical_contact_notes:r.technical_contact_notes||''
    })
    setImagePreview(r.image_url||null)
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.description || !form.quantity) return
    setSaving(true)
    const { data: emp } = await supabase.from('employees').select('id').eq('email', session?.user?.email).single()
    const payload = {
      description: form.description, quantity: parseFloat(form.quantity), unit: form.unit,
      priority: form.priority, needed_by: form.needed_by||null, min_quotes: parseInt(form.min_quotes),
      notes: form.notes, affaire_id: form.affaire_id||null,
      technical_contact_name: form.technical_contact_name||null,
      technical_contact_phone: form.technical_contact_phone||null,
      technical_contact_company: form.technical_contact_company||null,
      technical_contact_notes: form.technical_contact_notes||null,
    }
    if (editReq) {
      await supabase.from('requisitions').update(payload).eq('id', editReq.id)
    } else {
      const count = rows.length + 1
      await supabase.from('requisitions').insert({
        ...payload,
        ref_number: `REQ-${String(count).padStart(3,'0')}`,
        created_by: emp?.id||null, status: 'Pendente'
      })
    }
    setForm(EMPTY_FORM)
    setShowForm(false)
    setEditReq(null)
    setSaving(false)
    load()
  }

  const handleImageChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => { setImagePreview(ev.target.result); setForm(f => ({ ...f, image_url: ev.target.result })) }
    reader.readAsDataURL(file)
  }

  const handleDelete = async (id) => {
    if (!confirm('Tem a certeza que quer apagar esta requisição?')) return
    await supabase.from('requisitions').delete().eq('id', id)
    load()
  }

  const filtered = rows.filter(r => {
    const s = search.toLowerCase()
    const matchSearch = !s || r.description?.toLowerCase().includes(s) || r.ref_number?.toLowerCase().includes(s) || r.affaires?.name?.toLowerCase().includes(s)
    const matchStatus = !filterStatus || r.status === filterStatus
    const matchPrio = !filterPrio || r.priority === filterPrio
    return matchSearch && matchStatus && matchPrio
  })

  if (loading) return <div className="loading"><i className="ti ti-loader-2"/>A carregar...</div>

  return (
    <div>
      {showForm && (
        <div className="card" style={{maxWidth:660,marginBottom:20}}>
          <div className="card-header"><span className="card-title">{editReq?'Editar Requisição':'Nova Requisição de Material'}</span></div>
          <div className="form-grid">
            <div className="form-group full">
              <label>Negócio / Obra (opcional)</label>
              <select value={form.affaire_id} onChange={e=>setForm({...form,affaire_id:e.target.value})}>
                <option value="">— Sem obra associada —</option>
                {affaires.map(a=><option key={a.id} value={a.id}>{a.ref_number} — {a.name}</option>)}
              </select>
            </div>
            <div className="form-group full">
              <label>Descrição do material *</label>
              <textarea value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="Descrição detalhada do material a encomendar..." />
            </div>
            <div className="form-group">
              <label>Quantidade *</label>
              <input type="number" value={form.quantity} onChange={e=>setForm({...form,quantity:e.target.value})} />
            </div>
            <div className="form-group">
              <label>Unidade</label>
              <select value={form.unit} onChange={e=>setForm({...form,unit:e.target.value})}>
                {['un.','m','kg','cx','rolo','vara','lt','bte','m²','m³'].map(u=><option key={u}>{u}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Prioridade</label>
              <select value={form.priority} onChange={e=>setForm({...form,priority:e.target.value})}>
                {['Alta','Média','Baixa'].map(p=><option key={p}>{p}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Data necessária</label>
              <input type="date" value={form.needed_by} onChange={e=>setForm({...form,needed_by:e.target.value})} />
            </div>
            <div className="form-group">
              <label>Nº mín. fornecedores</label>
              <select value={form.min_quotes} onChange={e=>setForm({...form,min_quotes:e.target.value})}>
                {['1','2','3','4'].map(n=><option key={n}>{n}</option>)}
              </select>
            </div>
            <div className="form-group full">
              <label>Notas / Especificações técnicas</label>
              <textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="Marca preferida, normas técnicas, etc." />
            </div>
            <div className="form-group full">
              <label>Foto / Imagem de referência (opcional)</label>
              <input type="file" accept="image/*" ref={fileRef} onChange={handleImageChange} style={{fontSize:12}} />
              {imagePreview && <img src={imagePreview} alt="preview" style={{marginTop:8,maxWidth:'100%',maxHeight:150,borderRadius:'var(--radius)',objectFit:'cover'}} />}
            </div>
          </div>

          {/* Contacto técnico */}
          <div style={{marginTop:16,paddingTop:16,borderTop:'0.5px solid var(--border)'}}>
            <div style={{fontSize:13,fontWeight:600,marginBottom:12,display:'flex',alignItems:'center',gap:6}}>
              <i className="ti ti-user-check" style={{color:'var(--blue)'}}/>
              Contacto técnico (pessoa que pode dar informações sobre o material)
            </div>
            <div className="form-grid">
              <div className="form-group"><label>Nome</label><input value={form.technical_contact_name} onChange={e=>setForm({...form,technical_contact_name:e.target.value})} placeholder="Ex: João Silva" /></div>
              <div className="form-group"><label>Empresa</label><input value={form.technical_contact_company} onChange={e=>setForm({...form,technical_contact_company:e.target.value})} placeholder="Ex: Empresa de Caixilharia" /></div>
              <div className="form-group"><label>Telefone</label><input value={form.technical_contact_phone} onChange={e=>setForm({...form,technical_contact_phone:e.target.value})} placeholder="+351 9XX XXX XXX" /></div>
              <div className="form-group"><label>Notas</label><input value={form.technical_contact_notes} onChange={e=>setForm({...form,technical_contact_notes:e.target.value})} placeholder="Ex: Sabe as medidas exactas das janelas" /></div>
            </div>
          </div>

          <div className="form-actions">
            <button className="btn" onClick={()=>{setShowForm(false);setEditReq(null)}}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving?'A guardar...':editReq?'Guardar alterações':'Guardar Requisição'}</button>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <span className="card-title">Requisições ({filtered.length}{filtered.length!==rows.length?` / ${rows.length}`:''})</span>
          <button className="btn btn-primary" onClick={()=>{setShowForm(true);setEditReq(null);setForm(EMPTY_FORM)}}><i className="ti ti-plus"/>Nova</button>
        </div>

        <div style={{display:'flex',gap:8,marginBottom:14,flexWrap:'wrap'}}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Pesquisar..." style={{flex:1,minWidth:180,border:'0.5px solid var(--border-hover)',borderRadius:'var(--radius)',padding:'7px 10px',fontSize:13,background:'var(--bg-card)',color:'var(--text)',fontFamily:'inherit'}} />
          <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} style={{border:'0.5px solid var(--border-hover)',borderRadius:'var(--radius)',padding:'7px 10px',fontSize:13,background:'var(--bg-card)',color:'var(--text)',fontFamily:'inherit'}}>
            <option value="">Todos os estados</option>
            {['Pendente','Em cotação','Aprovado','Encomendado','Entregue','Cancelado'].map(s=><option key={s}>{s}</option>)}
          </select>
          <select value={filterPrio} onChange={e=>setFilterPrio(e.target.value)} style={{border:'0.5px solid var(--border-hover)',borderRadius:'var(--radius)',padding:'7px 10px',fontSize:13,background:'var(--bg-card)',color:'var(--text)',fontFamily:'inherit'}}>
            <option value="">Todas prioridades</option>
            {['Alta','Média','Baixa'].map(p=><option key={p}>{p}</option>)}
          </select>
          {(search||filterStatus||filterPrio) && <button className="btn" onClick={()=>{setSearch('');setFilterStatus('');setFilterPrio('')}}>✕</button>}
        </div>

        {filtered.length === 0
          ? <div className="empty">{rows.length===0?'Sem requisições.':'Nenhum resultado.'}</div>
          : <div className="table-wrap">
              <table>
                <thead><tr><th>Ref.</th><th>Descrição</th><th>Obra</th><th>Pedido por</th><th>Prio.</th><th>Data nec.</th><th>Estado</th><th>Ações</th></tr></thead>
                <tbody>
                  {filtered.map(r=>(
                    <>
                      <tr key={r.id} style={{cursor:'pointer'}} onClick={()=>setExpanded(expanded===r.id?null:r.id)}>
                        <td style={{fontWeight:500}}>{r.ref_number}</td>
                        <td style={{maxWidth:200,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.description}</td>
                        <td style={{fontSize:12,color:'var(--blue)'}}>{r.affaires?.ref_number||'—'}</td>
                        <td style={{fontSize:12}}>
                          <div style={{fontWeight:500}}>{r.employees?.emp_code||'—'}</div>
                          <div style={{color:'var(--text-muted)',fontSize:11}}>{r.employees?.full_name||''}</div>
                        </td>
                        <td><span className={PRIO_CLASS[r.priority]||''}>{r.priority}</span></td>
                        <td style={{fontSize:12}}>{r.needed_by?new Date(r.needed_by).toLocaleDateString('pt-PT'):'—'}</td>
                        <td><span className={`badge ${STATUS_CLASS[r.status]||''}`}>{r.status}</span></td>
                        <td>
                          <div style={{display:'flex',gap:4}}>
                            <button className="btn btn-sm" onClick={e=>{e.stopPropagation();openEdit(r)}}><i className="ti ti-edit"/></button>
                            <button className="btn btn-sm" style={{color:'var(--red)'}} onClick={e=>{e.stopPropagation();handleDelete(r.id)}}><i className="ti ti-trash"/></button>
                          </div>
                        </td>
                      </tr>
                      {expanded===r.id && (
                        <tr key={r.id+'_exp'}>
                          <td colSpan={8} style={{background:'var(--bg)',padding:'12px 16px'}}>
                            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px 24px',fontSize:13}}>
                              <div><span style={{color:'var(--text-muted)'}}>Quantidade: </span>{r.quantity} {r.unit}</div>
                              <div><span style={{color:'var(--text-muted)'}}>Mín. fornecedores: </span>{r.min_quotes}</div>
                              {r.notes && <div style={{gridColumn:'1/-1'}}><span style={{color:'var(--text-muted)'}}>Notas: </span>{r.notes}</div>}
                              {r.technical_contact_name && (
                                <div style={{gridColumn:'1/-1',marginTop:8,padding:'8px 12px',background:'var(--blue-light)',borderRadius:'var(--radius)'}}>
                                  <div style={{fontSize:12,fontWeight:600,color:'var(--blue)',marginBottom:4}}><i className="ti ti-user-check" style={{marginRight:4}}/>Contacto técnico</div>
                                  <div style={{fontSize:12}}>{r.technical_contact_name} {r.technical_contact_company?`— ${r.technical_contact_company}`:''}</div>
                                  {r.technical_contact_phone && <div style={{fontSize:12,marginTop:2}}><i className="ti ti-phone" style={{marginRight:4}}/>{r.technical_contact_phone}</div>}
                                  {r.technical_contact_notes && <div style={{fontSize:12,color:'var(--text-muted)',marginTop:2,fontStyle:'italic'}}>{r.technical_contact_notes}</div>}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
        }
      </div>
    </div>
  )
}
