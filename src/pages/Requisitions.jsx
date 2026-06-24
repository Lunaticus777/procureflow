import React, { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useRole } from '../hooks/useRole'
import { logActivity } from '../hooks/useActivity'

const STATUS_CLASS = {
  'Pendente':'badge-pending','Em cotação':'badge-quotation','Aprovado':'badge-approved',
  'Encomendado':'badge-ordered','Em trânsito':'badge-transit','Entregue':'badge-delivered','Cancelado':'badge-cancelled'
}
const PRIO_CLASS = { 'Alta':'prio-high','Média':'prio-med','Baixa':'prio-low' }
const PRIO_BG = { 'Alta':'var(--red-light)','Média':'var(--amber-light)','Baixa':'var(--bg)' }
const PRIO_COLOR = { 'Alta':'#A32D2D','Média':'#633806','Baixa':'var(--text-muted)' }

const EMPTY_FORM = {
  description:'', quantity:'', unit:'un.', priority:'Média', needed_by:'', min_quotes:'2',
  notes:'', affaire_id:'', image_url:'', client_ref:'',
  technical_contact_name:'', technical_contact_phone:'', technical_contact_company:'', technical_contact_notes:''
}

function ImageFromStorage({ path }) {
  const [url, setUrl] = React.useState(null)
  React.useEffect(() => {
    if (!path) return
    if (path.startsWith('http') || path.startsWith('data:')) { setUrl(path); return }
    supabase.storage.from('procureflow-docs').createSignedUrl(path, 3600)
      .then(({ data }) => { if (data?.signedUrl) setUrl(data.signedUrl) })
  }, [path])
  if (!url) return <div style={{fontSize:11,color:'var(--text-muted)',marginTop:4,fontStyle:'italic'}}>A carregar imagem...</div>
  return (
    <img src={url} alt="Referência" style={{marginTop:8,maxWidth:'100%',maxHeight:300,borderRadius:'var(--radius)',objectFit:'contain',border:'0.5px solid var(--border)',background:'var(--bg)'}} />
  )
}

export default function Requisitions() {
  const { session } = useAuth()
  const { isAdmin } = useRole()
  const [rows, setRows] = useState([])
  const [affaires, setAffaires] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editReq, setEditReq] = useState(null)
  const [selected, setSelected] = useState(null)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterPrio, setFilterPrio] = useState('')
  const [filterAffaire, setFilterAffaire] = useState('')
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [viewMode, setViewMode] = useState('cards') // 'cards' | 'list'
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


  const exportExcel = (affaireId) => {
    const data = affaireId ? filtered.filter(r => r.affaire_id === affaireId) : filtered
    const name = affaires.find(a => a.id === affaireId)?.name || 'Todas'
    const header = ['Ref.','Ref.Cliente','Descrição','Marca','Ref.Técnica','Qtd.','Unid.','Prioridade','Estado','Obra','Data necessária','Local entrega','Contacto técnico','Telefone']
    const csvData = [header, ...data.map(r => [r.ref_number,r.client_ref||'',r.description,r.product_brand||'',r.product_ref||'',r.quantity,r.unit,r.priority,r.status,r.affaires?.name||'',r.needed_by||'',r.delivery_type||'',r.technical_contact_name||'',r.technical_contact_phone||''])]
    const csv = csvData.map(r => r.map(c => '"'+String(c).replace(/"/g,'""')+'"').join(',')).join('\n')
    const blob = new Blob(['\uFEFF'+csv], { type: 'text/csv;charset=utf-8;' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = 'Requisicoes_'+name.replace(/ /g,'_')+'.csv'; a.click()
  }

  const exportPDF = (affaireId) => {
    const data = affaireId ? filtered.filter(r => r.affaire_id === affaireId) : filtered
    const name = affaires.find(a => a.id === affaireId)?.name || 'Todas as obras'
    const win = window.open('', '_blank')
    if (!win) { alert('Active os popups para exportar PDF'); return }
    const tbody = data.map(r => {
      const n = r.notes ? '<br><small>'+r.notes.slice(0,80)+'</small>' : ''
      const b = (r.product_brand||'') + (r.product_ref ? ' #'+r.product_ref : '')
      const c = r.delivery_city ? '<br>'+r.delivery_city : ''
      const p = r.technical_contact_phone ? '<br>'+r.technical_contact_phone : ''
      return '<tr><td>'+r.ref_number+'</td><td>'+(r.client_ref||'—')+'</td><td>'+r.description+n+'</td><td>'+b+'</td><td>'+r.quantity+' '+r.unit+'</td><td>'+r.priority+'</td><td>'+r.status+'</td><td>'+(r.delivery_type||'—')+c+'</td><td>'+(r.technical_contact_name||'—')+p+'</td></tr>'
    }).join('')
    const css = '<style>body{font-family:Arial,sans-serif;font-size:11px;margin:20px}h1{font-size:16px;margin-bottom:4px}p{color:#666;font-size:11px;margin-bottom:16px}table{width:100%;border-collapse:collapse}th{background:#f0f0f0;padding:6px 8px;text-align:left;font-size:10px;text-transform:uppercase;border:1px solid #ccc}td{padding:6px 8px;border:1px solid #e0e0e0;vertical-align:top}</style>'
    win.document.write('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Requisicoes</title>'+css+'</head><body><h1>Requisições — '+name+'</h1><p>Exportado em '+new Date().toLocaleDateString('pt-PT')+' · '+data.length+' requisição(ões)</p><table><thead><tr><th>Ref.</th><th>Ref.Cli.</th><th>Descrição</th><th>Marca/Ref.</th><th>Qtd.</th><th>Prio.</th><th>Estado</th><th>Entrega</th><th>Contacto</th></tr></thead><tbody>'+tbody+'</tbody></table></body></html>')
    win.document.close()
    setTimeout(function(){ win.print() }, 600)
  }

  const filtered = rows.filter(r => {
    const s = search.toLowerCase()
    const matchSearch = !s || [r.description, r.ref_number, r.client_ref, r.product_ref, r.product_brand, r.notes, r.affaires?.name, r.affaires?.ref_number, r.employees?.full_name, r.employees?.emp_code].some(f => f?.toLowerCase().includes(s))
    const matchStatus = !filterStatus || r.status === filterStatus
    const matchPrio = !filterPrio || r.priority === filterPrio
    const matchAffaire = !filterAffaire || r.affaire_id === filterAffaire
    return matchSearch && matchStatus && matchPrio && matchAffaire
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
            <div className="form-group">
              <label>Ref. do cliente <span style={{fontWeight:400,color:'var(--text-muted)',fontSize:11}}>— opcional</span></label>
              <input value={form.client_ref} onChange={e=>setForm({...form,client_ref:e.target.value})} placeholder="Ex: REF-CLI-001, Janelas T2, Porta principal..." />
            </div>
            <div className="form-group">
              <label>Ref. técnica do produto <span style={{fontWeight:400,color:'var(--text-muted)',fontSize:11}}>— opcional</span></label>
              <input value={form.product_ref} onChange={e=>setForm({...form,product_ref:e.target.value})} placeholder="Ex: REF-4521, SKU-A001..." />
            </div>
            <div className="form-group">
              <label>Marca / Fabricante <span style={{fontWeight:400,color:'var(--text-muted)',fontSize:11}}>— opcional</span></label>
              <input value={form.product_brand} onChange={e=>setForm({...form,product_brand:e.target.value})} placeholder="Ex: Velux, Roca, Schneider..." />
            </div>
            <div className="form-group full">
              <label>Link do produto <span style={{fontWeight:400,color:'var(--text-muted)',fontSize:11}}>— para ver o produto exacto</span></label>
              <input value={form.product_url} onChange={e=>setForm({...form,product_url:e.target.value})} placeholder="https://www.exemplo.com/produto..." />
            </div>
            <div className="form-group full">
              <label>Descrição do material *</label>
              <textarea value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="Descrição detalhada do material a encomendar..." style={{minHeight:80}} />
            </div>
            <div className="form-group">
              <label>Quantidade *</label>
              <input type="number" value={form.quantity} onChange={e=>setForm({...form,quantity:e.target.value})} />
            </div>
            <div className="form-group">
              <label>Unidade</label>
              <select value={form.unit} onChange={e=>setForm({...form,unit:e.target.value})}>
                {['un.','m','m²','m³','kg','t','lt','cx','rolo','vara','bte','saco','pct'].map(u=><option key={u}>{u}</option>)}
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
              <textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="Marca preferida, normas técnicas, medidas, referências..." />
            </div>
            <div className="form-group full">
              <label>Foto / Imagem de referência</label>
              <input type="file" accept="image/*" ref={fileRef} onChange={handleImageChange} style={{fontSize:12}} />
              {imagePreview && <img src={imagePreview} alt="preview" style={{marginTop:8,maxWidth:'100%',maxHeight:200,borderRadius:'var(--radius)',objectFit:'contain'}} />}
            </div>
          </div>

          <div style={{marginTop:16,paddingTop:16,borderTop:'0.5px solid var(--border)'}}>
            <div style={{fontSize:13,fontWeight:600,marginBottom:12,color:'var(--green)'}}>
              <i className="ti ti-truck-delivery" style={{marginRight:6}}/>Local de entrega
            </div>
            <div className="form-grid">
              <div className="form-group full"><label>Tipo de entrega</label>
                <select value={form.delivery_type} onChange={e=>setForm({...form,delivery_type:e.target.value})}>
                  {['Obra (morada da obra)','Armazém','Outro endereço','Entrega intermédia (2+ transportes)'].map(t=><option key={t}>{t}</option>)}
                </select>
              </div>
              {form.delivery_type!=='Obra (morada da obra)' && <>
                <div className="form-group full"><label>Morada de entrega</label>
                  <input value={form.delivery_address} onChange={e=>setForm({...form,delivery_address:e.target.value})} placeholder="Morada completa" />
                </div>
                <div className="form-group"><label>Cidade</label>
                  <input value={form.delivery_city} onChange={e=>setForm({...form,delivery_city:e.target.value})} />
                </div>
              </>}
              <div className="form-group full"><label>Instruções de entrega</label>
                <input value={form.delivery_notes} onChange={e=>setForm({...form,delivery_notes:e.target.value})} placeholder="Ex: Ligar antes de entregar, entrar pela traseira..." />
              </div>
            </div>
          </div>

          <div style={{marginTop:16,paddingTop:16,borderTop:'0.5px solid var(--border)'}}>
            <div style={{fontSize:13,fontWeight:600,marginBottom:12,color:'var(--blue)'}}>
              <i className="ti ti-user-check" style={{marginRight:6}}/>Contacto técnico
            </div>
            <div style={{fontSize:12,color:'var(--text-muted)',marginBottom:10}}>Pessoa que pode dar informações sobre o material (ex: empresa de colocação, técnico especializado)</div>
            <div className="form-grid">
              <div className="form-group"><label>Nome</label><input value={form.technical_contact_name} onChange={e=>setForm({...form,technical_contact_name:e.target.value})} placeholder="Ex: João Silva" /></div>
              <div className="form-group"><label>Empresa</label><input value={form.technical_contact_company} onChange={e=>setForm({...form,technical_contact_company:e.target.value})} placeholder="Ex: Caixilharia Lda" /></div>
              <div className="form-group"><label>Telefone</label><input value={form.technical_contact_phone} onChange={e=>setForm({...form,technical_contact_phone:e.target.value})} /></div>
              <div className="form-group"><label>Email</label><input type="email" value={form.technical_contact_email} onChange={e=>setForm({...form,technical_contact_email:e.target.value})} placeholder="email@exemplo.com" /></div>
              <div className="form-group"><label>Notas</label><input value={form.technical_contact_notes} onChange={e=>setForm({...form,technical_contact_notes:e.target.value})} placeholder="Ex: Tem as medidas exactas das janelas" /></div>
            </div>
          </div>

          <div className="form-actions">
            <button className="btn" onClick={()=>{setShowForm(false);setEditReq(null)}}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving?'A guardar...':editReq?'Guardar alterações':'Guardar Requisição'}</button>
          </div>
        </div>
      )}

      <div style={{display:'flex',gap:0,height:'calc(100vh - 130px)',overflow:'hidden'}}>
        {/* Lista */}
        <div style={{width:selected?'55%':'100%',flexShrink:0,display:'flex',flexDirection:'column',transition:'width 0.2s',borderRight:selected?'1px solid var(--border)':'none',overflowY:'auto'}}>
          <div className="card">
            <div className="card-header">
              <span className="card-title">Requisições ({filtered.length}{filtered.length!==rows.length?` / ${rows.length}`:''})</span>

              <div style={{display:'flex',gap:6,alignItems:'center'}}>
              <div style={{display:'flex',gap:3}}>
                <button className={`btn btn-sm ${viewMode==='cards'?'btn-primary':''}`} onClick={()=>setViewMode('cards')} title="Cartões"><i className="ti ti-layout-grid"/></button>
                <button className={`btn btn-sm ${viewMode==='list'?'btn-primary':''}`} onClick={()=>setViewMode('list')} title="Lista"><i className="ti ti-list"/></button>
              </div>
              <div style={{position:'relative'}} onMouseEnter={e=>e.currentTarget.querySelector('.expmenu').style.display='block'} onMouseLeave={e=>e.currentTarget.querySelector('.expmenu').style.display='none'}>
                <button className="btn btn-sm" style={{display:'flex',alignItems:'center',gap:4}}><i className="ti ti-download"/>Exportar</button>
                <div className="expmenu" style={{display:'none',position:'absolute',top:'100%',right:0,background:'var(--bg-card)',border:'1px solid var(--border)',borderRadius:'var(--radius)',boxShadow:'0 4px 12px rgba(0,0,0,0.1)',zIndex:200,minWidth:210,padding:'4px 0'}}>
                  <div style={{padding:'3px 10px',fontSize:10,fontWeight:600,color:'var(--text-muted)',textTransform:'uppercase'}}>Excel / CSV</div>
                  <div onClick={()=>exportExcel(null)} style={{padding:'7px 14px',cursor:'pointer',fontSize:12,display:'flex',gap:6}} onMouseEnter={e=>e.currentTarget.style.background='var(--bg)'} onMouseLeave={e=>e.currentTarget.style.background=''}><i className="ti ti-file-spreadsheet"/>Todas</div>
                  {affaires.map(a=><div key={a.id} onClick={()=>exportExcel(a.id)} style={{padding:'7px 14px',cursor:'pointer',fontSize:12,display:'flex',gap:6}} onMouseEnter={e=>e.currentTarget.style.background='var(--bg)'} onMouseLeave={e=>e.currentTarget.style.background=''}><i className="ti ti-file-spreadsheet"/>{a.ref_number} — {a.name.slice(0,20)}</div>)}
                  <div style={{borderTop:'1px solid var(--border)',margin:'3px 0',padding:'3px 10px',fontSize:10,fontWeight:600,color:'var(--text-muted)',textTransform:'uppercase'}}>PDF</div>
                  <div onClick={()=>exportPDF(null)} style={{padding:'7px 14px',cursor:'pointer',fontSize:12,display:'flex',gap:6}} onMouseEnter={e=>e.currentTarget.style.background='var(--bg)'} onMouseLeave={e=>e.currentTarget.style.background=''}><i className="ti ti-file-type-pdf"/>Todas</div>
                  {affaires.map(a=><div key={a.id+'p'} onClick={()=>exportPDF(a.id)} style={{padding:'7px 14px',cursor:'pointer',fontSize:12,display:'flex',gap:6}} onMouseEnter={e=>e.currentTarget.style.background='var(--bg)'} onMouseLeave={e=>e.currentTarget.style.background=''}><i className="ti ti-file-type-pdf"/>{a.ref_number} — {a.name.slice(0,20)}</div>)}
                </div>
              </div>
              <button className="btn btn-primary" onClick={()=>{setShowForm(true);setEditReq(null);setForm(EMPTY_FORM);setSelected(null)}}><i className="ti ti-plus"/>Nova</button>
            </div>
            </div>

            <div style={{display:'flex',gap:8,marginBottom:12,flexWrap:'wrap'}}>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Pesquisar..." style={{flex:1,minWidth:120,border:'0.5px solid var(--border-hover)',borderRadius:'var(--radius)',padding:'6px 10px',fontSize:13,background:'var(--bg-card)',color:'var(--text)',fontFamily:'inherit'}} />
              <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} style={{border:'0.5px solid var(--border-hover)',borderRadius:'var(--radius)',padding:'6px 8px',fontSize:12,background:'var(--bg-card)',color:'var(--text)',fontFamily:'inherit'}}>
                <option value="">Todos estados</option>
                {['Pendente','Em cotação','Aprovado','Encomendado','Entregue','Cancelado'].map(s=><option key={s}>{s}</option>)}
              </select>
              <select value={filterPrio} onChange={e=>setFilterPrio(e.target.value)} style={{border:'0.5px solid var(--border-hover)',borderRadius:'var(--radius)',padding:'6px 8px',fontSize:12,background:'var(--bg-card)',color:'var(--text)',fontFamily:'inherit'}}>
                <option value="">Todas prio.</option>
                {['Alta','Média','Baixa'].map(p=><option key={p}>{p}</option>)}
              </select>
              <select value={filterAffaire} onChange={e=>setFilterAffaire(e.target.value)} style={{border:'0.5px solid var(--border-hover)',borderRadius:'var(--radius)',padding:'6px 8px',fontSize:12,background:'var(--bg-card)',color:'var(--text)',fontFamily:'inherit'}}>
                <option value="">Todas as obras</option>
                {affaires.map(a=><option key={a.id} value={a.id}>{a.ref_number} — {a.name}</option>)}
              </select>
              {(search||filterStatus||filterPrio||filterAffaire) && <button className="btn" onClick={()=>{setSearch('');setFilterStatus('');setFilterPrio('');setFilterAffaire('')}}>✕ Limpar</button>}
            </div>

            {filtered.length === 0
              ? <div className="empty">{rows.length===0?'Sem requisições.':'Nenhum resultado.'}</div>
              : viewMode==='list'
                ? <table>
                    <thead><tr><th>Ref.</th><th>Ref. Cliente</th><th>Descrição</th><th>Marca/Ref.</th><th>Obra</th><th>Qtd.</th><th>Prio.</th><th>Estado</th><th>Por</th><th></th></tr></thead>
                    <tbody>
                      {filtered.map(r=>(
                        <tr key={r.id} style={{cursor:'pointer',background:selected?.id===r.id?'var(--blue-light)':''}} onClick={()=>setSelected(selected?.id===r.id?null:r)}>
                          <td style={{fontWeight:600,fontSize:12}}>{r.ref_number}</td>
                          <td style={{fontSize:11,color:'var(--amber)'}}>{r.client_ref||'—'}</td>
                          <td style={{maxWidth:180,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.description}</td>
                          <td style={{fontSize:11,color:'var(--text-muted)'}}>{r.product_brand||''} {r.product_ref?`#${r.product_ref}`:''}</td>
                          <td style={{fontSize:11,color:'var(--blue)'}}>{r.affaires?.ref_number||'—'}</td>
                          <td style={{fontSize:12}}>{r.quantity} {r.unit}</td>
                          <td><span className={({'Alta':'prio-high','Média':'prio-med','Baixa':'prio-low'})[r.priority]||''}>{r.priority}</span></td>
                          <td><span className={`badge ${({'Pendente':'badge-pending','Em cotação':'badge-quotation','Aprovado':'badge-approved','Encomendado':'badge-ordered','Entregue':'badge-delivered','Cancelado':'badge-cancelled'})[r.status]||''}`}>{r.status}</span></td>
                          <td style={{fontSize:11,color:'var(--text-muted)'}}>{r.employees?.emp_code||'—'}</td>
                          <td onClick={e=>e.stopPropagation()}>
                            <div style={{display:'flex',gap:4}}>
                              <button className="btn btn-sm" onClick={()=>openEdit(r)}><i className="ti ti-edit"/></button>
                              {isAdmin && <button className="btn btn-sm" style={{color:'var(--red)'}} onClick={()=>handleDelete(r.id)}><i className="ti ti-trash"/></button>}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                : <div style={{display:'flex',flexDirection:'column',gap:8}}>
                  {filtered.map(r=>(
                    <div key={r.id}
                      onClick={()=>setSelected(selected?.id===r.id?null:r)}
                      style={{border:`1px solid ${selected?.id===r.id?'var(--blue)':'var(--border)'}`,borderLeft:`4px solid ${PRIO_COLOR[r.priority]||'var(--border)'}`,borderRadius:'var(--radius)',padding:'10px 12px',cursor:'pointer',background:selected?.id===r.id?'var(--blue-light)':'var(--bg-card)',transition:'all 0.1s'}}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:8}}>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:4}}>
                            <span style={{fontWeight:600,fontSize:12,color:'var(--text-muted)'}}>{r.ref_number}</span>
                            {r.affaires && <span style={{fontSize:11,color:'var(--blue)',background:'var(--blue-light)',padding:'1px 6px',borderRadius:10}}>{r.affaires.ref_number}</span>}
                          </div>
                          <div style={{fontWeight:500,fontSize:13,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.description}</div>
                          {r.client_ref && <div style={{fontSize:11,color:'#633806',background:'var(--amber-light)',padding:'1px 6px',borderRadius:10,marginBottom:3,display:'inline-block',fontWeight:500}}>📎 {r.client_ref}</div>}
                          <div style={{fontSize:11,color:'var(--text-muted)',marginTop:3}}>
                            {r.quantity} {r.unit}
                            {r.needed_by && ` · Preciso: ${new Date(r.needed_by).toLocaleDateString('pt-PT')}`}
                            {r.employees?.emp_code && ` · ${r.employees.emp_code}`}
                          </div>
                        </div>
                        <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:4,flexShrink:0}}>
                          <span className={`badge ${STATUS_CLASS[r.status]||''}`}>{r.status}</span>
                          <span style={{fontSize:10,fontWeight:600,color:PRIO_COLOR[r.priority],background:PRIO_BG[r.priority],padding:'1px 6px',borderRadius:10}}>{r.priority}</span>
                        </div>
                      </div>
                      <div style={{display:'flex',gap:4,marginTop:8}} onClick={e=>e.stopPropagation()}>
                        <button className="btn btn-sm" onClick={()=>openEdit(r)}><i className="ti ti-edit"/>Editar</button>
                        {isAdmin && <button className="btn btn-sm" style={{color:'var(--red)'}} onClick={()=>handleDelete(r.id)}><i className="ti ti-trash"/>Apagar</button>}
                      </div>
                    </div>
                  ))}
                </div>
              }
          </div>
        </div>

        {/* Detalhe */}
        {selected && (
          <div style={{flex:1,minWidth:0,overflowY:'auto',padding:'0 4px'}}>
            <div className="card">
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:16}}>
                <div>
                  <div style={{fontSize:12,color:'var(--text-muted)',fontWeight:500,marginBottom:4}}>{selected.ref_number}{selected.client_ref && <span style={{marginLeft:8,background:'var(--amber-light)',color:'#633806',padding:'1px 6px',borderRadius:10,fontWeight:600}}>Ref. cliente: {selected.client_ref}</span>} · criado por <strong>{selected.employees?.emp_code||'—'}</strong> {selected.employees?.full_name||''}</div>
                  <div style={{fontSize:17,fontWeight:600,marginBottom:6}}>{selected.description}</div>
                  {(selected.product_brand || selected.product_ref) && (
                    <div style={{fontSize:12,color:'var(--text-muted)',marginBottom:4}}>
                      {selected.product_brand && <span style={{fontWeight:500,color:'var(--text)'}}>{selected.product_brand}</span>}
                      {selected.product_ref && <span style={{marginLeft:6,fontFamily:'monospace',background:'var(--bg)',padding:'1px 6px',borderRadius:4,fontSize:11}}>#{selected.product_ref}</span>}
                      {selected.product_url && <a href={selected.product_url} target="_blank" rel="noopener noreferrer" style={{marginLeft:8,color:'var(--blue)',fontSize:11,textDecoration:'none'}}><i className="ti ti-external-link" style={{marginRight:3}}/>Ver produto</a>}
                    </div>
                  )}
                  <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                    <span className={`badge ${STATUS_CLASS[selected.status]||''}`}>{selected.status}</span>
                    <span style={{fontSize:11,fontWeight:600,color:PRIO_COLOR[selected.priority],background:PRIO_BG[selected.priority],padding:'2px 8px',borderRadius:10}}>Prioridade {selected.priority}</span>
                    {selected.affaires && <span style={{fontSize:11,color:'var(--blue)',background:'var(--blue-light)',padding:'2px 8px',borderRadius:10}}><i className="ti ti-building" style={{marginRight:3}}/>{selected.affaires.ref_number} — {selected.affaires.name}</span>}
                  </div>
                </div>
                <button className="btn btn-sm" onClick={()=>setSelected(null)}><i className="ti ti-x"/></button>
              </div>

              {/* Informações principais */}
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px 24px',fontSize:13,marginBottom:16,padding:'12px',background:'var(--bg)',borderRadius:'var(--radius)'}}>
                <div><span style={{color:'var(--text-muted)'}}>Quantidade: </span><strong>{selected.quantity} {selected.unit}</strong></div>
                <div><span style={{color:'var(--text-muted)'}}>Mín. fornecedores: </span><strong>{selected.min_quotes}</strong></div>
                {selected.needed_by && <div><span style={{color:'var(--text-muted)'}}>Data necessária: </span><strong style={{color:'var(--amber)'}}>{new Date(selected.needed_by).toLocaleDateString('pt-PT')}</strong></div>}
                <div><span style={{color:'var(--text-muted)'}}>Criado em: </span>{new Date(selected.created_at).toLocaleDateString('pt-PT')}</div>
              </div>

              {/* Notas */}
              {selected.notes && (
                <div style={{marginBottom:14,padding:'10px 12px',background:'var(--bg)',borderRadius:'var(--radius)',borderLeft:'3px solid var(--blue)'}}>
                  <div style={{fontSize:11,fontWeight:600,color:'var(--blue)',marginBottom:4}}>📋 ESPECIFICAÇÕES / NOTAS</div>
                  <div style={{fontSize:13,whiteSpace:'pre-wrap'}}>{selected.notes}</div>
                </div>
              )}

              {/* Imagem */}
              {selected.image_url && (
                <div style={{marginBottom:14}}>
                  <div style={{fontSize:11,fontWeight:600,color:'var(--text-muted)',marginBottom:6}}>🖼️ IMAGEM DE REFERÊNCIA</div>
                  <ImageFromStorage path={selected.image_url} />
                </div>
              )}

              {/* Contacto técnico */}
              {selected.technical_contact_name && (
                <div style={{marginBottom:14,padding:'12px',background:'var(--blue-light)',borderRadius:'var(--radius)',border:'0.5px solid rgba(24,95,165,0.2)'}}>
                  <div style={{fontSize:11,fontWeight:600,color:'var(--blue)',marginBottom:8}}>👤 CONTACTO TÉCNICO</div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'6px 16px',fontSize:13}}>
                    <div><span style={{color:'var(--text-muted)'}}>Nome: </span><strong>{selected.technical_contact_name}</strong></div>
                    {selected.technical_contact_company && <div><span style={{color:'var(--text-muted)'}}>Empresa: </span><strong>{selected.technical_contact_company}</strong></div>}
                    {selected.technical_contact_phone && (
                      <div style={{gridColumn:'1/-1'}}>
                        <span style={{color:'var(--text-muted)'}}>Telefone: </span>
                        <a href={`tel:${selected.technical_contact_phone}`} style={{fontWeight:600,color:'var(--blue)',textDecoration:'none'}}>
                          <i className="ti ti-phone" style={{marginRight:4}}/>{selected.technical_contact_phone}
                        </a>
                      </div>
                    )}
                    {selected.technical_contact_email && (
                      <div style={{gridColumn:'1/-1'}}>
                        <span style={{color:'var(--text-muted)'}}>Email: </span>
                        <a href={`mailto:${selected.technical_contact_email}`} style={{fontWeight:600,color:'var(--blue)',textDecoration:'none'}}>
                          <i className="ti ti-mail" style={{marginRight:4}}/>{selected.technical_contact_email}
                        </a>
                      </div>
                    )}
                    {selected.technical_contact_notes && <div style={{gridColumn:'1/-1',fontSize:12,color:'var(--text-muted)',fontStyle:'italic'}}>{selected.technical_contact_notes}</div>}
                  </div>
                </div>
              )}

              <div style={{display:'flex',gap:8,marginTop:8}}>
                <button className="btn btn-primary" style={{flex:1,justifyContent:'center'}} onClick={()=>openEdit(selected)}>
                  <i className="ti ti-edit"/>Editar requisição
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
