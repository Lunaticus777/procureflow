import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useRole } from '../hooks/useRole'

const STARS = (n) => '★'.repeat(Math.round(n||0)) + '☆'.repeat(5-Math.round(n||0))

export default function Suppliers() {
  const { session } = useAuth()
  const { isAdmin } = useRole()
  const [scores, setScores] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [orders, setOrders] = useState([])
  const [allReviews, setAllReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [showReview, setShowReview] = useState(false)
  const [editReview, setEditReview] = useState(null)
  const [selectedSupplier, setSelectedSupplier] = useState(null)
  const [review, setReview] = useState({ supplier_id:'', order_id:'', quality:5, punctuality:5, price_value:5, communication:5, notes:'' })
  const [saving, setSaving] = useState(false)

  const load = async () => {
    const [{ data: sc }, { data: su }, { data: or }, { data: rev }] = await Promise.all([
      supabase.from('supplier_scores').select('*').order('avg_total', { ascending: false }),
      supabase.from('suppliers').select('*').eq('active', true).order('name'),
      supabase.from('orders').select('id, ref_number, suppliers(name)').eq('status', 'Entregue').order('ref_number'),
      supabase.from('supplier_reviews').select('*, employees(full_name,emp_code), suppliers(name), orders(ref_number)').order('created_at', { ascending: false }),
    ])
    setScores(sc||[])
    setSuppliers(su||[])
    setOrders(or||[])
    setAllReviews(rev||[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const openEdit = (r) => {
    setEditReview(r)
    setReview({ supplier_id:r.supplier_id, order_id:r.order_id||'', quality:r.quality, punctuality:r.punctuality, price_value:r.price_value, communication:r.communication, notes:r.notes||'' })
    setShowReview(true)
  }

  const handleSave = async () => {
    if (!review.supplier_id) return
    setSaving(true)
    const { data: emp } = await supabase.from('employees').select('id').eq('email', session?.user?.email).single()
    if (editReview) {
      await supabase.from('supplier_reviews').update({
        quality: parseInt(review.quality), punctuality: parseInt(review.punctuality),
        price_value: parseInt(review.price_value), communication: parseInt(review.communication),
        notes: review.notes, order_id: review.order_id||null,
      }).eq('id', editReview.id)
    } else {
      await supabase.from('supplier_reviews').insert({
        supplier_id: review.supplier_id, order_id: review.order_id||null,
        reviewed_by: emp?.id||null, quality: parseInt(review.quality),
        punctuality: parseInt(review.punctuality), price_value: parseInt(review.price_value),
        communication: parseInt(review.communication), notes: review.notes,
      })
    }
    setReview({ supplier_id:'', order_id:'', quality:5, punctuality:5, price_value:5, communication:5, notes:'' })
    setShowReview(false); setEditReview(null); setSaving(false); load()
  }

  const handleDelete = async (id) => {
    if (!confirm('Apagar esta avaliação?')) return
    await supabase.from('supplier_reviews').delete().eq('id', id)
    load()
  }

  const barW = (v) => `${Math.round((v||0)/5*100)}%`

  // Reviews for selected supplier
  const supplierReviews = selectedSupplier ? allReviews.filter(r => r.supplier_id === selectedSupplier) : []

  if (loading) return <div className="loading"><i className="ti ti-loader-2"/>A carregar...</div>

  return (
    <div>
      {showReview && (
        <div className="card" style={{maxWidth:540,marginBottom:16}}>
          <div className="card-header"><span className="card-title">{editReview?'Editar Avaliação':'Nova Avaliação'}</span></div>
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
                {orders.map(o=><option key={o.id} value={o.id}>{o.ref_number} · {o.suppliers?.name}</option>)}
              </select>
            </div>
            {[['quality','⭐ Qualidade do produto'],['punctuality','🕐 Pontualidade na entrega'],['price_value','💶 Relação preço/valor'],['communication','💬 Comunicação']].map(([field,label])=>(
              <div key={field} className="form-group full" style={{flexDirection:'row',alignItems:'center',gap:12,justifyContent:'space-between'}}>
                <label style={{minWidth:200,margin:0}}>{label}</label>
                <div style={{display:'flex',gap:4}}>
                  {[1,2,3,4,5].map(v=>(
                    <button key={v} onClick={()=>setReview({...review,[field]:v})}
                      style={{fontSize:22,background:'none',border:'none',cursor:'pointer',color:v<=review[field]?'var(--amber)':'var(--border-hover)',padding:'2px'}}>★</button>
                  ))}
                  <span style={{marginLeft:6,fontWeight:600,fontSize:13}}>{review[field]}/5</span>
                </div>
              </div>
            ))}
            <div className="form-group full"><label>Notas / Observações</label>
              <textarea value={review.notes} onChange={e=>setReview({...review,notes:e.target.value})} placeholder="Qualidade do produto, cumprimento de prazos, atendimento..." />
            </div>
          </div>
          <div className="form-actions">
            <button className="btn" onClick={()=>{setShowReview(false);setEditReview(null)}}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving?'A guardar...':editReview?'Guardar alterações':'Guardar Avaliação'}</button>
          </div>
        </div>
      )}

      <div style={{display:'flex',gap:16,alignItems:'flex-start'}}>
        {/* Grid de scores */}
        <div style={{flex:1}}>
          <div className="card">
            <div className="card-header">
              <span className="card-title">Avaliação de Fornecedores</span>
              <button className="btn btn-primary" onClick={()=>{setShowReview(true);setEditReview(null)}}><i className="ti ti-star"/>Nova avaliação</button>
            </div>

            {scores.length===0
              ? <div className="empty">Sem avaliações. Adiciona a primeira!</div>
              : <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:12}}>
                  {scores.map(s=>(
                    <div key={s.id}
                      onClick={()=>setSelectedSupplier(selectedSupplier===s.id?null:s.id)}
                      style={{border:`1px solid ${selectedSupplier===s.id?'var(--blue)':'var(--border)'}`,borderRadius:'var(--radius-lg)',padding:14,cursor:'pointer',background:selectedSupplier===s.id?'var(--blue-light)':'var(--bg-card)'}}>
                      <div style={{fontWeight:600,fontSize:14,marginBottom:2}}>{s.name}</div>
                      <div style={{fontSize:11,color:'var(--text-muted)',marginBottom:10}}>{s.category||'—'} · {s.total_reviews} avaliação(ões)</div>
                      {[['avg_quality','Qualidade'],['avg_punctuality','Pontualidade'],['avg_price','Preço/valor'],['avg_communication','Comunicação']].map(([key,label])=>(
                        <div key={key} className="eval-bar-row">
                          <div className="eval-bar-label"><span>{label}</span><span>{s[key]||'—'}/5</span></div>
                          <div className="eval-bar"><div className="eval-bar-fill" style={{width:barW(s[key])}}/></div>
                        </div>
                      ))}
                      <div style={{display:'flex',alignItems:'center',gap:8,marginTop:10,paddingTop:10,borderTop:'0.5px solid var(--border)'}}>
                        <span className="stars" style={{fontSize:18}}>{STARS(parseFloat(s.avg_total||0))}</span>
                        <span style={{fontWeight:700,fontSize:15}}>{s.avg_total||'—'}/5</span>
                        <span style={{fontSize:11,color:'var(--text-muted)',marginLeft:'auto'}}>{s.total_reviews} avaliações</span>
                      </div>
                    </div>
                  ))}
                </div>
            }
          </div>

          {/* Histórico de avaliações do fornecedor seleccionado */}
          {selectedSupplier && (
            <div className="card" style={{marginTop:12}}>
              <div className="card-header">
                <span className="card-title">Avaliações — {scores.find(s=>s.id===selectedSupplier)?.name}</span>
                <button className="btn btn-sm" onClick={()=>setSelectedSupplier(null)}><i className="ti ti-x"/></button>
              </div>
              {supplierReviews.map(r=>(
                <div key={r.id} style={{padding:'12px 0',borderBottom:'0.5px solid var(--border)'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:8}}>
                    <div style={{flex:1}}>
                      <div style={{display:'flex',gap:12,marginBottom:6,flexWrap:'wrap'}}>
                        {[['Qualidade',r.quality],['Pontualidade',r.punctuality],['Preço',r.price_value],['Comunicação',r.communication]].map(([l,v])=>(
                          <div key={l} style={{fontSize:12}}>
                            <span style={{color:'var(--text-muted)'}}>{l}: </span>
                            <span className="stars">{STARS(v)}</span>
                            <span style={{fontWeight:600,marginLeft:2}}>{v}/5</span>
                          </div>
                        ))}
                      </div>
                      {r.order_id && <div style={{fontSize:11,color:'var(--blue)',marginBottom:4}}><i className="ti ti-link" style={{marginRight:4}}/>{r.orders?.ref_number}</div>}
                      {r.notes && <div style={{fontSize:12,fontStyle:'italic',color:'var(--text-muted)',padding:'6px 8px',background:'var(--bg)',borderRadius:'var(--radius)'}}>{r.notes}</div>}
                      <div style={{fontSize:11,color:'var(--text-muted)',marginTop:4}}>
                        {new Date(r.created_at).toLocaleDateString('pt-PT')} · por {r.employees?.emp_code||'—'} {r.employees?.full_name||''}
                      </div>
                    </div>
                    <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:6,flexShrink:0}}>
                      <div style={{fontSize:20,fontWeight:700,color:'var(--amber)'}}>
                        {((r.quality+r.punctuality+r.price_value+r.communication)/4).toFixed(1)}
                      </div>
                      <div style={{display:'flex',gap:4}}>
                        <button className="btn btn-sm" onClick={()=>openEdit(r)}><i className="ti ti-edit"/></button>
                        {isAdmin && <button className="btn btn-sm" style={{color:'var(--red)'}} onClick={()=>handleDelete(r.id)}><i className="ti ti-trash"/></button>}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
