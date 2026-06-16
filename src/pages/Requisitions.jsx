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
    const data = affaireId ? rows.filter(r => r.affaire_id === affaireId) : filtered
    const affaireName = affaires.find(a => a.id === affaireId)?.name || 'Todas'
    const csvRows = [
      ['Ref.','Ref.Cliente','Descrição','Marca','Ref.Técnica','Qtd.','Unid.','Prioridade','Estado','Obra','Data necessária','Local entrega','Contacto técnico','Telefone'],
      ...data.map(r => [r.ref_number, r.client_ref||'', r.description, r.product_brand||'', r.product_ref||'', r.quantity, r.unit, r.priority, r.status, r.affaires?.name||'', r.needed_by||'', r.delivery_type||'', r.technical_contact_name||'', r.technical_contact_phone||''])
    ]
    const csv = csvRows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n')
    const blob = new Blob(['\uFEFF'+csv], { type: 'text/csv;charset=utf-8;' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = `Requisicoes_${affaireName.replace(/ /g,'_')}.csv`; a.click()
  }

  const exportPDF = (affaireId) => {
    const data = affaireId ? rows.filter(r => r.affaire_id === affaireId) : filtered
    const affaireName = affaires.find(a => a.id === affaireId)?.name || 'Todas as obras'
    const win = window.open('', '_blank')
    if (!win) { alert('Active os popups para exportar PDF'); return }
    const rows2 = data.map(r => `<tr><td style="font-family:monospace">${r.ref_number}</td><td>${r.client_ref||'—'}</td><td><strong>${r.description}</strong>${r.notes?`<br><small style="color:#666">${r.notes.slice(0,80)}</small>`:''}</td><td>${r.product_brand||''}${r.product_ref?` #${r.product_ref}`:''}</td><td>${r.quantity} ${r.unit}</td><td>${r.priority}</td><td>${r.status}</td><td>${r.delivery_type||'—'}${r.delivery_city?`<br>${r.delivery_city}`:''}</td><td>${r.technical_contact_name||'—'}${r.technical_contact_phone?`<br>${r.technical_contact_phone}`:''}</td></tr>`).join('')
    win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Requisições — ${affaireName}</title><style>body{font-family:Arial,sans-serif;font-size:11px;margin:20px;color:#222}h1{font-size:16px;margin-bottom:4px}.sub{color:#666;font-size:11px;margin-bottom:16px}table{width:100%;border-collapse:collapse}th{background:#f0f0f0;padding:6px 8px;text-align:left;font-size:10px;text-transform:uppercase;border:0.5px solid #ccc}td{padding:6px 8px;border:0.5px solid #e0e0e0;vertical-align:top}tr:nth-child(even){background:#fafafa}</style></head><body><h1>Requisições — ${affaireName}</h1><div class="sub">Exportado em ${new Date().toLocaleDateString('pt-PT')} · ${data.length} requisição(ões)</div><table><thead><tr><th>Ref.</th><th>Ref.Cli.</th><th>Descrição</th><th>Marca/Ref.</th><th>Qtd.</th><th>Prio.</th><th>Estado</th><th>Entrega</th><th>Contacto</th></tr></thead><tbody>${rows2}</tbody></table></body></html>`)
    win.document.close()
    setTimeout(() => win.print(), 600)
  }

  const PRIO_COLOR = { 'Alta':'var(--red)','Média':'var(--amber)','Baixa':'var(--text-muted)' }
  const PRIO_BG = { 'Alta':'var(--red-light)','Média':'var(--amber-light)','Baixa':'var(--bg)' }
  const STATUS_CL = { 'Pendente':'badge-pending','Em cotação':'badge-quotation','Aprovado':'badge-approved','Encomendado':'badge-ordered','Em trânsito':'badge-transit','Entregue':'badge-delivered','Cancelado':'badge-cancelled' }

  if (loading) return <div className="loading"><i className="ti ti-loader-2"/>A carregar...</div>

  return (
    <div style={{display:'flex',height:'calc(100vh - 56px)',overflow:'hidden'}}>
      <div style={{width:selected||showForm?'46%':'100%',flexShrink:0,display:'flex',flexDirection:'column',borderRight:selected||showForm?'1px solid var(--border)':'none',transition:'width 0.25s'}}>
        <div style={{padding:'12px 16px',borderBottom:'1px solid var(--border)',background:'var(--bg-card)',flexShrink:0}}>
          <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:10}}>
            <div style={{position:'relative',flex:1}}>
              <i className="ti ti-search" style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',color:'var(--text-muted)',fontSize:14,pointerEvents:'none'}}/>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Pesquisa — descrição, ref., marca, obra, contacto..." style={{width:'100%',border:'0.5px solid var(--border-hover)',borderRadius:'var(--radius)',padding:'7px 10px 7px 32px',fontSize:13,background:'var(--bg)',color:'var(--text)',fontFamily:'inherit'}}/>
              {search&&<button onClick={()=>setSearch('')} style={{position:'absolute',right:8,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)',fontSize:14}}>✕</button>}
            </div>
            <div style={{display:'flex',gap:4}}>
              <button className={`btn btn-sm ${viewMode==='list'?'btn-primary':''}`} onClick={()=>setViewMode('list')}><i className="ti ti-list"/></button>
              <button className={`btn btn-sm ${viewMode==='cards'?'btn-primary':''}`} onClick={()=>setViewMode('cards')}><i className="ti ti-layout-grid"/></button>
            </div>
            <div style={{position:'relative'}} onMouseEnter={e=>e.currentTarget.querySelector('.emenu').style.display='block'} onMouseLeave={e=>e.currentTarget.querySelector('.emenu').style.display='none'}>
              <button className="btn" style={{display:'flex',alignItems:'center',gap:4,fontSize:12}}><i className="ti ti-download" style={{fontSize:13}}/>Exportar <i className="ti ti-chevron-down" style={{fontSize:11}}/></button>
              <div className="emenu" style={{display:'none',position:'absolute',top:'100%',right:0,background:'var(--bg-card)',border:'0.5px solid var(--border)',borderRadius:'var(--radius)',boxShadow:'0 4px 12px rgba(0,0,0,0.12)',zIndex:200,minWidth:220,padding:'4px 0'}}>
                <div style={{padding:'4px 10px',fontSize:10,fontWeight:600,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.5px'}}>Excel / CSV</div>
                <div onClick={()=>exportExcel(null)} style={{padding:'7px 14px',cursor:'pointer',fontSize:12,display:'flex',gap:6}} onMouseEnter={e=>e.currentTarget.style.background='var(--bg)'} onMouseLeave={e=>e.currentTarget.style.background=''}><i className="ti ti-file-spreadsheet"/>Todas</div>
                {affaires.map(a=><div key={a.id} onClick={()=>exportExcel(a.id)} style={{padding:'7px 14px',cursor:'pointer',fontSize:12,display:'flex',gap:6}} onMouseEnter={e=>e.currentTarget.style.background='var(--bg)'} onMouseLeave={e=>e.currentTarget.style.background=''}><i className="ti ti-file-spreadsheet"/>{a.ref_number} — {a.name.slice(0,22)}</div>)}
                <div style={{borderTop:'0.5px solid var(--border)',margin:'4px 0',padding:'4px 10px',fontSize:10,fontWeight:600,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.5px'}}>PDF</div>
                <div onClick={()=>exportPDF(null)} style={{padding:'7px 14px',cursor:'pointer',fontSize:12,display:'flex',gap:6}} onMouseEnter={e=>e.currentTarget.style.background='var(--bg)'} onMouseLeave={e=>e.currentTarget.style.background=''}><i className="ti ti-file-type-pdf"/>Todas</div>
                {affaires.map(a=><div key={a.id+'p'} onClick={()=>exportPDF(a.id)} style={{padding:'7px 14px',cursor:'pointer',fontSize:12,display:'flex',gap:6}} onMouseEnter={e=>e.currentTarget.style.background='var(--bg)'} onMouseLeave={e=>e.currentTarget.style.background=''}><i className="ti ti-file-type-pdf"/>{a.ref_number} — {a.name.slice(0,22)}</div>)}
              </div>
            </div>
            <button className="btn btn-primary" onClick={()=>{setShowForm(true);setEditReq(null);setForm(EMPTY_FORM);setSelected(null);setFormErrors({})}}><i className="ti ti-plus"/>Nova</button>
          </div>
          <div style={{display:'flex',gap:6,flexWrap:'wrap',alignItems:'center'}}>
            <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} style={{border:'0.5px solid var(--border-hover)',borderRadius:'var(--radius)',padding:'5px 8px',fontSize:12,background:'var(--bg-card)',color:'var(--text)',fontFamily:'inherit'}}>
              <option value="">Todos os estados</option>
              {['Pendente','Em cotação','Aprovado','Encomendado','Em trânsito','Entregue','Cancelado'].map(s=><option key={s}>{s}</option>)}
            </select>
            <select value={filterPrio} onChange={e=>setFilterPrio(e.target.value)} style={{border:'0.5px solid var(--border-hover)',borderRadius:'var(--radius)',padding:'5px 8px',fontSize:12,background:'var(--bg-card)',color:'var(--text)',fontFamily:'inherit'}}>
              <option value="">Todas prioridades</option>
              {['Alta','Média','Baixa'].map(p=><option key={p}>{p}</option>)}
            </select>
            <select value={filterAffaire} onChange={e=>setFilterAffaire(e.target.value)} style={{border:'0.5px solid var(--border-hover)',borderRadius:'var(--radius)',padding:'5px 8px',fontSize:12,background:'var(--bg-card)',color:'var(--text)',fontFamily:'inherit'}}>
              <option value="">Todas as obras</option>
              {affaires.map(a=><option key={a.id} value={a.id}>{a.ref_number} — {a.name}</option>)}
            </select>
            {(search||filterStatus||filterPrio||filterAffaire)&&<button className="btn btn-sm" onClick={()=>{setSearch('');setFilterStatus('');setFilterPrio('');setFilterAffaire('')}} style={{fontSize:11}}>✕ Limpar</button>}
            <span style={{fontSize:11,color:'var(--text-muted)',marginLeft:'auto'}}>{filtered.length} / {rows.length}</span>
          </div>
        </div>
        <div style={{flex:1,overflowY:'auto'}}>
          {filtered.length===0
            ? <div className="empty">{rows.length===0?'Sem requisições.':'Nenhum resultado.'}</div>
            : viewMode==='list'
              ? <table style={{width:'100%',borderCollapse:'collapse'}}>
                  <thead style={{position:'sticky',top:0,background:'var(--bg-card)',zIndex:1}}>
                    <tr style={{borderBottom:'1px solid var(--border)'}}>
                      {['Ref.','Descrição','Ref.Cli.','Obra','Qtd.','Prio.','Estado','Por',''].map(h=>(
                        <th key={h} style={{padding:'7px 10px',textAlign:'left',fontSize:10,fontWeight:600,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.5px',whiteSpace:'nowrap'}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(r=>(
                      <tr key={r.id} onClick={()=>setSelected(selected?.id===r.id?null:r)}
                        style={{cursor:'pointer',borderBottom:'0.5px solid var(--border)',background:selected?.id===r.id?'var(--blue-light)':'',borderLeft:`3px solid ${selected?.id===r.id?'var(--blue)':PRIO_COLOR[r.priority]||'transparent'}`}}>
                        <td style={{padding:'8px 10px',fontFamily:'monospace',fontSize:11,fontWeight:600,color:'var(--text-muted)',whiteSpace:'nowrap'}}>{r.ref_number}</td>
                        <td style={{padding:'8px 10px',maxWidth:180}}>
                          <div style={{fontWeight:500,fontSize:13,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.description}</div>
                          {r.product_brand&&<div style={{fontSize:11,color:'var(--text-muted)'}}>{r.product_brand}{r.product_ref?` · #${r.product_ref}`:''}</div>}
                        </td>
                        <td style={{padding:'8px 8px'}}>{r.client_ref?<span style={{fontSize:10,fontWeight:500,background:'var(--amber-light)',color:'#633806',padding:'2px 5px',borderRadius:10}}>{r.client_ref}</span>:<span style={{color:'var(--border-hover)'}}>—</span>}</td>
                        <td style={{padding:'8px 8px',fontSize:11,color:'var(--blue)',whiteSpace:'nowrap'}}>{r.affaires?.ref_number||'—'}</td>
                        <td style={{padding:'8px 8px',fontSize:12,whiteSpace:'nowrap'}}>{r.quantity} {r.unit}</td>
                        <td style={{padding:'8px 8px'}}><span style={{fontSize:10,fontWeight:600,color:PRIO_COLOR[r.priority],background:PRIO_BG[r.priority],padding:'2px 5px',borderRadius:10}}>{r.priority}</span></td>
                        <td style={{padding:'8px 8px'}}><span className={`badge ${STATUS_CL[r.status]||''}`}>{r.status}</span></td>
                        <td style={{padding:'8px 8px',fontSize:11,color:'var(--text-muted)',whiteSpace:'nowrap'}}>{r.employees?.emp_code||'—'}</td>
                        <td style={{padding:'8px 4px'}} onClick={e=>e.stopPropagation()}>
                          <div style={{display:'flex',gap:3}}>
                            <button className="btn btn-sm" style={{padding:'3px 6px'}} onClick={()=>openEdit(r)}><i className="ti ti-edit"/></button>
                            {isAdmin&&<button className="btn btn-sm" style={{padding:'3px 6px',color:'var(--red)'}} onClick={()=>handleDelete(r.id)}><i className="ti ti-trash"/></button>}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              : <div style={{padding:12,display:'flex',flexDirection:'column',gap:8}}>
                  {filtered.map(r=>(
                    <div key={r.id} onClick={()=>setSelected(selected?.id===r.id?null:r)}
                      style={{border:`1px solid ${selected?.id===r.id?'var(--blue)':'var(--border)'}`,borderLeft:`4px solid ${PRIO_COLOR[r.priority]||'var(--border)'}`,borderRadius:'var(--radius)',padding:'10px 12px',cursor:'pointer',background:selected?.id===r.id?'var(--blue-light)':'var(--bg-card)'}}>
                      <div style={{display:'flex',justifyContent:'space-between',gap:8}}>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{display:'flex',gap:6,alignItems:'center',marginBottom:3,flexWrap:'wrap'}}>
                            <span style={{fontSize:11,fontFamily:'monospace',color:'var(--text-muted)'}}>{r.ref_number}</span>
                            {r.client_ref&&<span style={{fontSize:10,background:'var(--amber-light)',color:'#633806',padding:'1px 5px',borderRadius:10,fontWeight:500}}>{r.client_ref}</span>}
                            {r.affaires&&<span style={{fontSize:10,color:'var(--blue)',background:'var(--blue-light)',padding:'1px 5px',borderRadius:10}}>{r.affaires.ref_number}</span>}
                          </div>
                          <div style={{fontWeight:600,fontSize:13,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.description}</div>
                          <div style={{fontSize:11,color:'var(--text-muted)',marginTop:2}}>{r.quantity} {r.unit} · {r.employees?.emp_code||'—'}</div>
                        </div>
                        <div style={{display:'flex',flexDirection:'column',gap:4,alignItems:'flex-end',flexShrink:0}}>
                          <span className={`badge ${STATUS_CL[r.status]||''}`} style={{fontSize:10}}>{r.status}</span>
                          <span style={{fontSize:10,fontWeight:600,color:PRIO_COLOR[r.priority],background:PRIO_BG[r.priority],padding:'1px 5px',borderRadius:10}}>{r.priority}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
          }
        </div>
      </div>

      {(selected||showForm)&&(
        <div style={{flex:1,minWidth:0,overflowY:'auto',background:'var(--bg)'}}>
          {showForm&&(
            <div style={{padding:20}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
                <div style={{fontWeight:700,fontSize:16}}>{editReq?'Editar Requisição':'Nova Requisição'}</div>
                <button className="btn btn-sm" onClick={()=>{setShowForm(false);setEditReq(null)}}><i className="ti ti-x"/></button>
              </div>
              <div style={{fontSize:11,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:8}}>Identificação</div>
              <div className="form-grid" style={{marginBottom:16}}>
                <div className="form-group full"><label>Negócio / Obra</label>
                  <select value={form.affaire_id} onChange={e=>setForm({...form,affaire_id:e.target.value})}>
                    <option value="">— Sem obra —</option>
                    {affaires.map(a=><option key={a.id} value={a.id}>{a.ref_number} — {a.name}</option>)}
                  </select>
                </div>
                <div className="form-group"><label>Ref. cliente</label><input value={form.client_ref} onChange={e=>setForm({...form,client_ref:e.target.value})} placeholder="Ex: Janelas T2..."/></div>
                <div className="form-group"><label>Ref. técnica</label><input value={form.product_ref} onChange={e=>setForm({...form,product_ref:e.target.value})} placeholder="SKU, REF..."/></div>
                <div className="form-group"><label>Marca</label><input value={form.product_brand} onChange={e=>setForm({...form,product_brand:e.target.value})} placeholder="Ex: Velux..."/></div>
                <div className="form-group"><label>Link do produto</label><input value={form.product_url} onChange={e=>setForm({...form,product_url:e.target.value})} placeholder="https://..."/></div>
              </div>
              <div style={{fontSize:11,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:8}}>Material</div>
              <div className="form-grid" style={{marginBottom:16}}>
                <div className="form-group full">
                  <label>Descrição *</label>
                  <textarea value={form.description} onChange={e=>{setForm({...form,description:e.target.value});if(e.target.value)setFormErrors(f=>({...f,description:undefined}))}} placeholder="Descrição detalhada..." style={{minHeight:70,borderColor:formErrors.description?'var(--red)':undefined}}/>
                  {formErrors.description&&<div style={{fontSize:11,color:'var(--red)',marginTop:2}}>{formErrors.description}</div>}
                </div>
                <div className="form-group">
                  <label>Quantidade *</label>
                  <input type="number" value={form.quantity} onChange={e=>{setForm({...form,quantity:e.target.value});if(e.target.value)setFormErrors(f=>({...f,quantity:undefined}))}} style={{borderColor:formErrors.quantity?'var(--red)':undefined}}/>
                  {formErrors.quantity&&<div style={{fontSize:11,color:'var(--red)',marginTop:2}}>{formErrors.quantity}</div>}
                </div>
                <div className="form-group"><label>Unidade</label>
                  <select value={form.unit} onChange={e=>setForm({...form,unit:e.target.value})}>
                    {['un.','m','m²','m³','kg','t','lt','cx','rolo','vara','bte','saco','pct'].map(u=><option key={u}>{u}</option>)}
                  </select>
                </div>
                <div className="form-group"><label>Prioridade</label>
                  <select value={form.priority} onChange={e=>setForm({...form,priority:e.target.value})}>
                    {['Alta','Média','Baixa'].map(p=><option key={p}>{p}</option>)}
                  </select>
                </div>
                <div className="form-group"><label>Data necessária</label><input type="date" value={form.needed_by} onChange={e=>setForm({...form,needed_by:e.target.value})}/></div>
                <div className="form-group"><label>Mín. fornecedores</label>
                  <select value={form.min_quotes} onChange={e=>setForm({...form,min_quotes:e.target.value})}>
                    {['1','2','3','4'].map(n=><option key={n}>{n}</option>)}
                  </select>
                </div>
                <div className="form-group full"><label>Especificações / Notas</label><textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="Normas técnicas, medidas..."/></div>
                <div className="form-group full"><label>Imagem de referência</label>
                  <input type="file" accept="image/*" ref={fileRef} onChange={handleImageChange} style={{fontSize:12}}/>
                  {imagePreview&&<img src={imagePreview} alt="preview" style={{marginTop:8,maxWidth:'100%',maxHeight:150,borderRadius:'var(--radius)',objectFit:'contain'}}/>}
                </div>
              </div>
              <div style={{fontSize:11,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:8}}>Local de entrega</div>
              <div className="form-grid" style={{marginBottom:16}}>
                <div className="form-group full">
                  <select value={form.delivery_type} onChange={e=>setForm({...form,delivery_type:e.target.value})}>
                    {['Obra (morada da obra)','Armazém','Outro endereço','Entrega intermédia (2+ transportes)'].map(t=><option key={t}>{t}</option>)}
                  </select>
                </div>
                {form.delivery_type!=='Obra (morada da obra)'&&<>
                  <div className="form-group full"><label>Morada</label><input value={form.delivery_address} onChange={e=>setForm({...form,delivery_address:e.target.value})}/></div>
                  <div className="form-group"><label>Cidade</label><input value={form.delivery_city} onChange={e=>setForm({...form,delivery_city:e.target.value})}/></div>
                </>}
                <div className="form-group full"><label>Instruções de entrega</label><input value={form.delivery_notes} onChange={e=>setForm({...form,delivery_notes:e.target.value})} placeholder="Ex: Ligar antes..."/></div>
              </div>
              <div style={{fontSize:11,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:8}}>Contacto técnico</div>
              <div className="form-grid" style={{marginBottom:20}}>
                <div className="form-group"><label>Nome</label><input value={form.technical_contact_name} onChange={e=>setForm({...form,technical_contact_name:e.target.value})}/></div>
                <div className="form-group"><label>Empresa</label><input value={form.technical_contact_company} onChange={e=>setForm({...form,technical_contact_company:e.target.value})}/></div>
                <div className="form-group"><label>Telefone</label><input value={form.technical_contact_phone} onChange={e=>setForm({...form,technical_contact_phone:e.target.value})}/></div>
                <div className="form-group"><label>Email</label><input type="email" value={form.technical_contact_email} onChange={e=>setForm({...form,technical_contact_email:e.target.value})}/></div>
                <div className="form-group full"><label>Notas</label><input value={form.technical_contact_notes} onChange={e=>setForm({...form,technical_contact_notes:e.target.value})}/></div>
              </div>
              <div style={{display:'flex',gap:8,justifyContent:'flex-end',paddingTop:12,borderTop:'1px solid var(--border)'}}>
                <button className="btn" onClick={()=>{setShowForm(false);setEditReq(null);setFormErrors({})}}>Cancelar</button>
                <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving?'A guardar...':editReq?'Guardar alterações':'Criar Requisição'}</button>
              </div>
            </div>
          )}
          {selected&&!showForm&&(
            <div style={{padding:20}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:16}}>
                <div style={{flex:1}}>
                  <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6,flexWrap:'wrap'}}>
                    <span style={{fontSize:12,fontFamily:'monospace',color:'var(--text-muted)',fontWeight:600}}>{selected.ref_number}</span>
                    {selected.client_ref&&<span style={{fontSize:11,background:'var(--amber-light)',color:'#633806',padding:'2px 6px',borderRadius:10,fontWeight:600}}>📎 {selected.client_ref}</span>}
                    <span className={`badge ${STATUS_CL[selected.status]||''}`}>{selected.status}</span>
                    <span style={{fontSize:11,fontWeight:600,color:PRIO_COLOR[selected.priority],background:PRIO_BG[selected.priority],padding:'2px 6px',borderRadius:10}}>Prioridade {selected.priority}</span>
                    {selected.affaires&&<span style={{fontSize:11,color:'var(--blue)',background:'var(--blue-light)',padding:'2px 6px',borderRadius:10}}><i className="ti ti-building" style={{marginRight:3}}/>{selected.affaires.ref_number} — {selected.affaires.name}</span>}
                  </div>
                  <div style={{fontSize:18,fontWeight:700,lineHeight:1.3,marginBottom:4}}>{selected.description}</div>
                  {(selected.product_brand||selected.product_ref)&&(
                    <div style={{fontSize:12,color:'var(--text-muted)',marginTop:4}}>
                      {selected.product_brand&&<strong style={{color:'var(--text)'}}>{selected.product_brand}</strong>}
                      {selected.product_ref&&<span style={{marginLeft:6,fontFamily:'monospace',background:'var(--bg-card)',padding:'1px 5px',borderRadius:4,fontSize:11}}>#{selected.product_ref}</span>}
                      {selected.product_url&&<a href={selected.product_url} target="_blank" rel="noopener noreferrer" style={{marginLeft:8,color:'var(--blue)',fontSize:11,textDecoration:'none'}}><i className="ti ti-external-link" style={{marginRight:2}}/>Ver produto</a>}
                    </div>
                  )}
                </div>
                <div style={{display:'flex',gap:6,flexShrink:0}}>
                  <button className="btn btn-sm" onClick={()=>openEdit(selected)}><i className="ti ti-edit"/>Editar</button>
                  {isAdmin&&<button className="btn btn-sm" style={{color:'var(--red)'}} onClick={()=>handleDelete(selected.id)}><i className="ti ti-trash"/></button>}
                  <button className="btn btn-sm" onClick={()=>setSelected(null)}><i className="ti ti-x"/></button>
                </div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:14}}>
                {[['Quantidade',`${selected.quantity} ${selected.unit}`],['Mín. fornecedores',selected.min_quotes],['Data necessária',selected.needed_by?new Date(selected.needed_by).toLocaleDateString('pt-PT'):'—']].map(([l,v])=>(
                  <div key={l} style={{background:'var(--bg-card)',borderRadius:'var(--radius)',padding:'10px 12px',border:'0.5px solid var(--border)'}}>
                    <div style={{fontSize:10,fontWeight:600,color:'var(--text-muted)',textTransform:'uppercase',marginBottom:4}}>{l}</div>
                    <div style={{fontSize:15,fontWeight:700}}>{v}</div>
                  </div>
                ))}
              </div>
              <div style={{fontSize:11,color:'var(--text-muted)',marginBottom:12}}>Criado por <strong>{selected.employees?.full_name||selected.employees?.emp_code||'—'}</strong> em {new Date(selected.created_at).toLocaleDateString('pt-PT')}</div>
              {selected.notes&&<div style={{marginBottom:12,padding:'10px 12px',background:'var(--bg-card)',borderRadius:'var(--radius)',borderLeft:'3px solid var(--blue)',border:'0.5px solid var(--border)'}}>
                <div style={{fontSize:10,fontWeight:600,color:'var(--blue)',marginBottom:4}}>📋 ESPECIFICAÇÕES</div>
                <div style={{fontSize:13,whiteSpace:'pre-wrap'}}>{selected.notes}</div>
              </div>}
              {selected.delivery_type&&<div style={{marginBottom:12,padding:'10px 12px',background:'var(--bg-card)',borderRadius:'var(--radius)',borderLeft:'3px solid var(--green)',border:'0.5px solid var(--border)'}}>
                <div style={{fontSize:10,fontWeight:600,color:'var(--green)',marginBottom:4}}>🚚 LOCAL DE ENTREGA</div>
                <div style={{fontSize:13,fontWeight:500}}>{selected.delivery_type}{selected.delivery_type?.includes('intermédia')&&<span style={{marginLeft:8,fontSize:11,background:'var(--amber)',color:'white',padding:'1px 6px',borderRadius:10}}>⚠️ 2+ transportes</span>}</div>
                {selected.delivery_address&&<div style={{fontSize:12,color:'var(--text-muted)',marginTop:2}}>{selected.delivery_address}{selected.delivery_city?`, ${selected.delivery_city}`:''}</div>}
                {selected.delivery_notes&&<div style={{fontSize:12,color:'var(--text-muted)',fontStyle:'italic',marginTop:2}}>{selected.delivery_notes}</div>}
              </div>}
              {selected.image_url&&<div style={{marginBottom:12}}>
                <div style={{fontSize:10,fontWeight:600,color:'var(--text-muted)',marginBottom:6}}>🖼️ IMAGEM DE REFERÊNCIA</div>
                <ImageFromStorage path={selected.image_url}/>
              </div>}
              {selected.technical_contact_name&&<div style={{padding:'12px',background:'var(--blue-light)',borderRadius:'var(--radius)',border:'0.5px solid rgba(24,95,165,0.2)'}}>
                <div style={{fontSize:10,fontWeight:600,color:'var(--blue)',marginBottom:8}}>👤 CONTACTO TÉCNICO</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'6px 16px',fontSize:13}}>
                  <div><span style={{color:'var(--text-muted)'}}>Nome: </span><strong>{selected.technical_contact_name}</strong></div>
                  {selected.technical_contact_company&&<div><span style={{color:'var(--text-muted)'}}>Empresa: </span><strong>{selected.technical_contact_company}</strong></div>}
                  {selected.technical_contact_phone&&<div style={{gridColumn:'1/-1'}}><span style={{color:'var(--text-muted)'}}>Tel: </span><a href={`tel:${selected.technical_contact_phone}`} style={{fontWeight:600,color:'var(--blue)',textDecoration:'none'}}><i className="ti ti-phone" style={{marginRight:4}}/>{selected.technical_contact_phone}</a></div>}
                  {selected.technical_contact_email&&<div style={{gridColumn:'1/-1'}}><span style={{color:'var(--text-muted)'}}>Email: </span><a href={`mailto:${selected.technical_contact_email}`} style={{fontWeight:600,color:'var(--blue)',textDecoration:'none'}}><i className="ti ti-mail" style={{marginRight:4}}/>{selected.technical_contact_email}</a></div>}
                  {selected.technical_contact_notes&&<div style={{gridColumn:'1/-1',fontSize:12,color:'var(--text-muted)',fontStyle:'italic'}}>{selected.technical_contact_notes}</div>}
                </div>
              </div>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
