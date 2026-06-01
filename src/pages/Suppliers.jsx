import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useRole } from '../hooks/useRole'

const STARS = (n) => '★'.repeat(Math.round(n||0)) + '☆'.repeat(5-Math.round(n||0))
const AVG = (r) => ((r.quality+r.punctuality+r.price_value+r.communication)/4).toFixed(1)

export default function Suppliers() {
  const { session } = useAuth()
  const { isAdmin } = useRole()
  const [suppliers, setSuppliers] = useState([])
  const [orders, setOrders] = useState([])
  const [affaires, setAffaires] = useState([])
  const [allReviews, setAllReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('supplier')
  const [showReview, setShowReview] = useState(false)
  const [editReview, setEditReview] = useState(null)
  const [selectedId, setSelectedId] = useState(null) // supplier/affaire/order id
  const [review, setReview] = useState({ supplier_id:'', order_id:'', affaire_id:'', quality:5, punctuality:5, price_value:5, communication:5, notes:'' })
  const [saving, setSaving] = useState(false)

  const load = async () => {
    const [{ data: su }, { data: or }, { data: aff }, { data: rev }] = await Promise.all([
      supabase.from('suppliers').select('*').eq('active', true).order('name'),
      supabase.from('orders').select('id,ref_number,suppliers(name),requisitions(affaires(name,ref_number,id))').neq('status','Cancelado').order('ref_number'),
      supabase.from('affaires').select('id,name,ref_number').not('status','eq','Cancelada').order('ref_number'),
      supabase.from('supplier_reviews').select('*, employees(full_name,emp_code), suppliers(name,id), orders(ref_number,requisitions(affaires(name,ref_number,id)))').order('created_at',{ascending:false}),
    ])
    setSuppliers(su||[])
    setOrders(or||[])
    setAffaires(aff||[])
    setAllReviews(rev||[])
    setLoading(false)
  }

  useEffect(()=>{ load() },[])

  const openNew = () => {
    setEditReview(null)
    setReview({ supplier_id:'', order_id:'', affaire_id:'', quality:5, punctuality:5, price_value:5, communication:5, notes:'' })
    setShowReview(true)
  }

  const openEdit = (r) => {
    setEditReview(r)
    setReview({ supplier_id:r.supplier_id, order_id:r.order_id||'', affaire_id:r.orders?.requisitions?.affaires?.id||'', quality:r.quality, punctuality:r.punctuality, price_value:r.price_value, communication:r.communication, notes:r.notes||'' })
    setShowReview(true)
  }

  const handleSave = async () => {
    if (!review.supplier_id) return
    setSaving(true)
    const { data: emp } = await supabase.from('employees').select('id').eq('email', session?.user?.email).single()
    if (editReview) {
      await supabase.from('supplier_reviews').update({
        quality:parseInt(review.quality), punctuality:parseInt(review.punctuality),
        price_value:parseInt(review.price_value), communication:parseInt(review.communication),
        notes:review.notes, order_id:review.order_id||null,
      }).eq('id', editReview.id)
    } else {
      await supabase.from('supplier_reviews').insert({
        supplier_id:review.supplier_id, order_id:review.order_id||null,
        reviewed_by:emp?.id||null, quality:parseInt(review.quality),
        punctuality:parseInt(review.punctuality), price_value:parseInt(review.price_value),
        communication:parseInt(review.communication), notes:review.notes,
      })
    }
    setReview({ supplier_id:'', order_id:'', affaire_id:'', quality:5, punctuality:5, price_value:5, communication:5, notes:'' })
    setShowReview(false); setEditReview(null); setSaving(false); load()
  }

  const handleDelete = async (id) => {
    if (!confirm('Apagar esta avaliação?')) return
    await supabase.from('supplier_reviews').delete().eq('id', id)
    load()
  }

  const barW = (v) => `${Math.round((v||0)/5*100)}%`

  // Group reviews by supplier
  const bySupplier = suppliers.map(s => ({
    ...s,
    reviews: allReviews.filter(r => r.supplier_id === s.id),
    avg: allReviews.filter(r=>r.supplier_id===s.id).length
      ? (allReviews.filter(r=>r.supplier_id===s.id).reduce((a,r)=>a+parseFloat(AVG(r)),0) / allReviews.filter(r=>r.supplier_id===s.id).length).toFixed(1)
      : null
  })).filter(s => s.reviews.length > 0)

  // Group reviews by affaire (via order -> requisition -> affaire)
  const byAffaire = affaires.map(a => ({
    ...a,
    reviews: allReviews.filter(r => r.orders?.requisitions?.affaires?.id === a.id)
  })).filter(a => a.reviews.length > 0)

  // Group by order
  const byOrder = orders.map(o => ({
    ...o,
    reviews: allReviews.filter(r => r.order_id === o.id)
  })).filter(o => o.reviews.length > 0)

  const ReviewCard = ({ r }) => (
    <div style={{padding:'12px 0',borderBottom:'0.5px solid var(--border)'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:8}}>
        <div style={{flex:1}}>
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4,flexWrap:'wrap'}}>
            <span style={{fontWeight:600,fontSize:13}}>{r.suppliers?.name}</span>
            {r.orders?.ref_number && <span style={{fontSize:11,color:'var(--blue)',background:'var(--blue-light)',padding:'1px 6px',borderRadius:10}}>{r.orders.ref_number}</span>}
            {r.orders?.requisitions?.affaires && <span style={{fontSize:11,color:'var(--text-muted)',background:'var(--bg)',padding:'1px 6px',borderRadius:10}}>{r.orders.requisitions.affaires.ref_number} — {r.orders.requisitions.affaires.name}</span>}
          </div>
          <div style={{display:'flex',gap:12,marginBottom:6,flexWrap:'wrap'}}>
            {[['Qualidade',r.quality],['Pontualidade',r.punctuality],['Preço',r.price_value],['Comunicação',r.communication]].map(([l,v])=>(
              <div key={l} style={{fontSize:12}}>
                <span style={{color:'var(--text-muted)'}}>{l}: </span>
                <span style={{color:'var(--amber)'}}>{STARS(v)}</span>
                <span style={{fontWeight:600,marginLeft:2}}>{v}/5</span>
              </div>
            ))}
          </div>
          {r.notes && <div style={{fontSize:12,fontStyle:'italic',color:'var(--text-muted)',padding:'6px 8px',background:'var(--bg)',borderRadius:'var(--radius)',marginBottom:4}}>{r.notes}</div>}
          <div style={{fontSize:11,color:'var(--text-muted)'}}>
            {new Date(r.created_at).toLocaleDateString('pt-PT')} · por {r.employees?.emp_code||'—'} {r.employees?.full_name||''}
          </div>
        </div>
        <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:6,flexShrink:0}}>
          <div style={{fontSize:22,fontWeight:800,color:'var(--amber)'}}>{AVG(r)}</div>
          <div style={{display:'flex',gap:4}}>
            <button className="btn btn-sm" onClick={()=>openEdit(r)}><i className="ti ti-edit"/></button>
            {isAdmin && <button className="btn btn-sm" style={{color:'var(--red)'}} onClick={()=>handleDelete(r.id)}><i className="ti ti-trash"/></button>}
          </div>
        </div>
      </div>
    </div>
  )

  if (loading) return <div className="loading"><i className="ti ti-loader-2"/>A carregar...</div>

  return (
    <div>
      {showReview && (
        <div className="card" style={{maxWidth:560,marginBottom:16}}>
          <div className="card-header">
            <span className="card-title">{editReview?'Editar Avaliação':'Nova Avaliação'}</span>
            <button className="btn btn-sm" onClick={()=>{setShowReview(false);setEditReview(null)}}><i className="ti ti-x"/></button>
          </div>
          <div className="form-grid">
            <div className="form-group full"><label>Fornecedor *</label>
              <select value={review.supplier_id} onChange={e=>setReview({...review,supplier_id:e.target.value})}>
                <option value="">Selecionar...</option>
                {suppliers.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="form-group full"><label>Encomenda (opcional)</label>
              <select value={review.order_id} onChange={e=>setReview({...review,order_id:e.target.value})}>
                <option value="">— Geral —</option>
                {orders.filter(o=>!review.supplier_id||o.suppliers?.name===suppliers.find(s=>s.id===review.supplier_id)?.name).map(o=>(
                  <option key={o.id} value={o.id}>{o.ref_number} · {o.suppliers?.name} {o.requisitions?.affaires?`· ${o.requisitions.affaires.ref_number}`:''}</option>
                ))}
              </select>
            </div>
            {[['quality','⭐ Qualidade do produto'],['punctuality','🕐 Pontualidade na entrega'],['price_value','💶 Relação preço/valor'],['communication','💬 Comunicação']].map(([field,label])=>(
              <div key={field} className="form-group full" style={{flexDirection:'row',alignItems:'center',gap:12,justifyContent:'space-between'}}>
                <label style={{minWidth:180,margin:0}}>{label}</label>
                <div style={{display:'flex',gap:4,alignItems:'center'}}>
                  {[1,2,3,4,5].map(v=>(
                    <button key={v} onClick={()=>setReview({...review,[field]:v})}
                      style={{fontSize:24,background:'none',border:'none',cursor:'pointer',color:v<=review[field]?'var(--amber)':'var(--border-hover)',padding:'2px',lineHeight:1}}>★</button>
                  ))}
                  <span style={{marginLeft:6,fontWeight:600,fontSize:13,minWidth:30}}>{review[field]}/5</span>
                </div>
              </div>
            ))}
            <div className="form-group full"><label>Notas / Observações</label>
              <textarea value={review.notes} onChange={e=>setReview({...review,notes:e.target.value})} placeholder="Qualidade, cumprimento de prazos, atendimento..." />
            </div>
          </div>
          <div className="form-actions">
            <button className="btn" onClick={()=>{setShowReview(false);setEditReview(null)}}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving?'A guardar...':editReview?'Guardar alterações':'Guardar Avaliação'}</button>
          </div>
        </div>
      )}

      <div className="card">
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
          <div className="tabs" style={{margin:0,border:'none',flex:1}}>
            <div className={`tab ${tab==='supplier'?'active':''}`} onClick={()=>setTab('supplier')}>
              Por Fornecedor {bySupplier.length>0&&<span style={{background:'var(--blue)',color:'white',borderRadius:10,fontSize:10,padding:'1px 5px',marginLeft:3}}>{bySupplier.length}</span>}
            </div>
            <div className={`tab ${tab==='affaire'?'active':''}`} onClick={()=>setTab('affaire')}>
              Por Obra {byAffaire.length>0&&<span style={{background:'var(--blue)',color:'white',borderRadius:10,fontSize:10,padding:'1px 5px',marginLeft:3}}>{byAffaire.length}</span>}
            </div>
            <div className={`tab ${tab==='order'?'active':''}`} onClick={()=>setTab('order')}>
              Por Encomenda {byOrder.length>0&&<span style={{background:'var(--blue)',color:'white',borderRadius:10,fontSize:10,padding:'1px 5px',marginLeft:3}}>{byOrder.length}</span>}
            </div>
            <div className={`tab ${tab==='all'?'active':''}`} onClick={()=>setTab('all')}>
              Todas ({allReviews.length})
            </div>
          </div>
          <button className="btn btn-primary" style={{marginLeft:12}} onClick={openNew}><i className="ti ti-star"/>Nova avaliação</button>
        </div>

        {/* POR FORNECEDOR */}
        {tab==='supplier' && (
          bySupplier.length===0 ? <div className="empty">Sem avaliações. Adiciona a primeira!</div>
          : <div style={{display:'flex',gap:16,alignItems:'flex-start'}}>
              {/* Lista de fornecedores */}
              <div style={{width:240,flexShrink:0}}>
                {bySupplier.map(s=>(
                  <div key={s.id} onClick={()=>setSelectedId(selectedId===s.id?null:s.id)}
                    style={{border:`1px solid ${selectedId===s.id?'var(--blue)':'var(--border)'}`,borderLeft:`4px solid ${selectedId===s.id?'var(--blue)':'var(--border)'}`,borderRadius:'var(--radius)',padding:'10px 12px',cursor:'pointer',background:selectedId===s.id?'var(--blue-light)':'var(--bg-card)',marginBottom:6}}>
                    <div style={{fontWeight:600,fontSize:13}}>{s.name}</div>
                    <div style={{fontSize:11,color:'var(--text-muted)',marginTop:2}}>{s.category||'—'}</div>
                    <div style={{display:'flex',alignItems:'center',gap:6,marginTop:4}}>
                      <span style={{color:'var(--amber)',fontSize:14}}>{STARS(parseFloat(s.avg||0))}</span>
                      <span style={{fontWeight:700}}>{s.avg||'—'}/5</span>
                      <span style={{fontSize:11,color:'var(--text-muted)'}}>({s.reviews.length})</span>
                    </div>
                    {/* Barras */}
                    {['quality','punctuality','price_value','communication'].map((k,i)=>{
                      const avg = s.reviews.reduce((a,r)=>a+r[k],0)/s.reviews.length
                      const labels = ['Qualidade','Pontualidade','Preço','Comunicação']
                      return (
                        <div key={k} style={{marginTop:4}}>
                          <div style={{display:'flex',justifyContent:'space-between',fontSize:10,color:'var(--text-muted)',marginBottom:1}}>
                            <span>{labels[i]}</span><span>{avg.toFixed(1)}/5</span>
                          </div>
                          <div style={{height:4,background:'var(--border)',borderRadius:2,overflow:'hidden'}}>
                            <div style={{height:'100%',width:`${avg/5*100}%`,background:'var(--amber)',borderRadius:2}}/>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
              {/* Avaliações do fornecedor seleccionado */}
              <div style={{flex:1,minWidth:0}}>
                {selectedId
                  ? (() => {
                      const sup = bySupplier.find(s=>s.id===selectedId)
                      if (!sup) return null
                      return (
                        <>
                          <div style={{fontWeight:600,fontSize:15,marginBottom:12}}>{sup.name} — {sup.reviews.length} avaliação(ões)</div>
                          {sup.reviews.map(r=><ReviewCard key={r.id} r={r}/>)}
                        </>
                      )
                    })()
                  : <div className="empty">Clica num fornecedor para ver as avaliações detalhadas.</div>
                }
              </div>
            </div>
        )}

        {/* POR OBRA */}
        {tab==='affaire' && (
          byAffaire.length===0 ? <div className="empty">Sem avaliações ligadas a obras.</div>
          : <div style={{display:'flex',gap:16,alignItems:'flex-start'}}>
              <div style={{width:240,flexShrink:0}}>
                {byAffaire.map(a=>(
                  <div key={a.id} onClick={()=>setSelectedId(selectedId===a.id?null:a.id)}
                    style={{border:`1px solid ${selectedId===a.id?'var(--blue)':'var(--border)'}`,borderLeft:`4px solid ${selectedId===a.id?'var(--blue)':'var(--border)'}`,borderRadius:'var(--radius)',padding:'10px 12px',cursor:'pointer',background:selectedId===a.id?'var(--blue-light)':'var(--bg-card)',marginBottom:6}}>
                    <div style={{fontSize:11,color:'var(--text-muted)'}}>{a.ref_number}</div>
                    <div style={{fontWeight:600,fontSize:13,marginTop:2}}>{a.name}</div>
                    <div style={{fontSize:11,color:'var(--text-muted)',marginTop:4}}>{a.reviews.length} avaliação(ões)</div>
                  </div>
                ))}
              </div>
              <div style={{flex:1,minWidth:0}}>
                {selectedId
                  ? (() => {
                      const aff = byAffaire.find(a=>a.id===selectedId)
                      if (!aff) return null
                      return (
                        <>
                          <div style={{fontWeight:600,fontSize:15,marginBottom:12}}>{aff.ref_number} — {aff.name}</div>
                          {aff.reviews.map(r=><ReviewCard key={r.id} r={r}/>)}
                        </>
                      )
                    })()
                  : <div className="empty">Clica numa obra para ver as avaliações.</div>
                }
              </div>
            </div>
        )}

        {/* POR ENCOMENDA */}
        {tab==='order' && (
          byOrder.length===0 ? <div className="empty">Sem avaliações ligadas a encomendas.</div>
          : <div style={{display:'flex',gap:16,alignItems:'flex-start'}}>
              <div style={{width:240,flexShrink:0}}>
                {byOrder.map(o=>(
                  <div key={o.id} onClick={()=>setSelectedId(selectedId===o.id?null:o.id)}
                    style={{border:`1px solid ${selectedId===o.id?'var(--blue)':'var(--border)'}`,borderLeft:`4px solid ${selectedId===o.id?'var(--blue)':'var(--border)'}`,borderRadius:'var(--radius)',padding:'10px 12px',cursor:'pointer',background:selectedId===o.id?'var(--blue-light)':'var(--bg-card)',marginBottom:6}}>
                    <div style={{fontWeight:600,fontSize:13}}>{o.ref_number}</div>
                    <div style={{fontSize:11,color:'var(--text-muted)',marginTop:2}}>{o.suppliers?.name}</div>
                    {o.requisitions?.affaires && <div style={{fontSize:11,color:'var(--blue)',marginTop:2}}>{o.requisitions.affaires.ref_number}</div>}
                    <div style={{fontSize:11,color:'var(--text-muted)',marginTop:4}}>{o.reviews.length} avaliação(ões)</div>
                  </div>
                ))}
              </div>
              <div style={{flex:1,minWidth:0}}>
                {selectedId
                  ? (() => {
                      const ord = byOrder.find(o=>o.id===selectedId)
                      if (!ord) return null
                      return (
                        <>
                          <div style={{fontWeight:600,fontSize:15,marginBottom:12}}>{ord.ref_number} — {ord.suppliers?.name}</div>
                          {ord.reviews.map(r=><ReviewCard key={r.id} r={r}/>)}
                        </>
                      )
                    })()
                  : <div className="empty">Clica numa encomenda para ver as avaliações.</div>
                }
              </div>
            </div>
        )}

        {/* TODAS */}
        {tab==='all' && (
          allReviews.length===0 ? <div className="empty">Sem avaliações.</div>
          : allReviews.map(r=><ReviewCard key={r.id} r={r}/>)
        )}
      </div>
    </div>
  )
}
