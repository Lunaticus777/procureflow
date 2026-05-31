import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

export default function Suppliers() {
  const { session } = useAuth()
  const [scores, setScores] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [showReview, setShowReview] = useState(false)
  const [review, setReview] = useState({ supplier_id:'', order_id:'', quality:5, punctuality:5, price_value:5, communication:5, notes:'' })
  const [saving, setSaving] = useState(false)

  const load = async () => {
    const [{ data: sc }, { data: su }, { data: or }] = await Promise.all([
      supabase.from('supplier_scores').select('*').order('avg_total', { ascending:false }),
      supabase.from('suppliers').select('*').eq('active',true).order('name'),
      supabase.from('orders').select('id, ref_number, suppliers(name)').eq('status','Entregue'),
    ])
    setScores(sc||[])
    setSuppliers(su||[])
    setOrders(or||[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleSave = async () => {
    if (!review.supplier_id) return
    setSaving(true)
    const { data: emp } = await supabase.from('employees').select('id').eq('email', session?.user?.email).single()
    await supabase.from('supplier_reviews').insert({
      supplier_id: review.supplier_id,
      order_id: review.order_id || null,
      reviewed_by: emp?.id || null,
      quality: parseInt(review.quality),
      punctuality: parseInt(review.punctuality),
      price_value: parseInt(review.price_value),
      communication: parseInt(review.communication),
      notes: review.notes,
    })
    setReview({ supplier_id:'', order_id:'', quality:5, punctuality:5, price_value:5, communication:5, notes:'' })
    setShowReview(false)
    setSaving(false)
    load()
  }

  const stars = (n) => '★'.repeat(Math.round(n||0)) + '☆'.repeat(5-Math.round(n||0))
  const barW = (v) => `${Math.round((v||0)/5*100)}%`

  if (loading) return <div className="loading"><i className="ti ti-loader-2"/>A carregar...</div>

  return (
    <div>
      {showReview && (
        <div className="card" style={{maxWidth:520,marginBottom:16}}>
          <div className="card-header"><span className="card-title">Nova Avaliação de Fornecedor</span></div>
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
            {[['quality','Qualidade do produto'],['punctuality','Pontualidade na entrega'],['price_value','Relação preço/valor'],['communication','Comunicação']].map(([field,label])=>(
              <div key={field} className="form-group" style={{flexDirection:'row',alignItems:'center',gap:12}}>
                <label style={{minWidth:160}}>{label}</label>
                <div style={{display:'flex',gap:4}}>
                  {[1,2,3,4,5].map(v=>(
                    <button key={v} onClick={()=>setReview({...review,[field]:v})}
                      style={{fontSize:20,background:'none',border:'none',cursor:'pointer',color:v<=review[field]?'var(--amber)':'var(--border-hover)',padding:'2px 2px'}}>★</button>
                  ))}
                </div>
              </div>
            ))}
            <div className="form-group full"><label>Notas</label><textarea value={review.notes} onChange={e=>setReview({...review,notes:e.target.value})} placeholder="Observações sobre este fornecedor..." /></div>
          </div>
          <div className="form-actions">
            <button className="btn" onClick={()=>setShowReview(false)}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving?'A guardar...':'Guardar Avaliação'}</button>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <span className="card-title">Avaliação de fornecedores</span>
          <button className="btn btn-primary" onClick={()=>setShowReview(true)}><i className="ti ti-star"/>Nova avaliação</button>
        </div>
        {scores.length===0
          ? <div className="empty">Sem avaliações ainda. Avalia o primeiro fornecedor!</div>
          : <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))',gap:12}}>
              {scores.map(s=>(
                <div key={s.id} style={{border:'0.5px solid var(--border)',borderRadius:'var(--radius-lg)',padding:16}}>
                  <div style={{fontWeight:600,fontSize:14,marginBottom:2}}>{s.name}</div>
                  <div style={{fontSize:11,color:'var(--text-muted)',marginBottom:12}}>{s.category} · {s.total_reviews} avaliação(ões)</div>
                  {[['avg_quality','Qualidade'],['avg_punctuality','Pontualidade'],['avg_price','Preço/valor'],['avg_communication','Comunicação']].map(([key,label])=>(
                    <div key={key} className="eval-bar-row">
                      <div className="eval-bar-label"><span>{label}</span><span>{s[key]||'—'}/5</span></div>
                      <div className="eval-bar"><div className="eval-bar-fill" style={{width:barW(s[key])}}/></div>
                    </div>
                  ))}
                  <div style={{display:'flex',alignItems:'center',gap:8,marginTop:12,paddingTop:12,borderTop:'0.5px solid var(--border)'}}>
                    <span className="stars" style={{fontSize:16}}>{stars(s.avg_total)}</span>
                    <span style={{fontWeight:600}}>{s.avg_total||'—'} / 5</span>
                  </div>
                </div>
              ))}
            </div>
        }
      </div>
    </div>
  )
}
