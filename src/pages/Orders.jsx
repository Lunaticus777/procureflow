import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const STATUS_CLASS = {
  'Confirmado':'badge-ordered','Em trânsito':'badge-transit',
  'Entregue':'badge-delivered','Cancelado':'badge-cancelled'
}

export default function Orders() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)

  const load = async () => {
    const { data } = await supabase
      .from('orders')
      .select('*, suppliers(name), requisitions(description, ref_number)')
      .order('created_at', { ascending:false })
    setOrders(data||[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const updateStatus = async (id, status, extraFields={}) => {
    await supabase.from('orders').update({ status, ...extraFields }).eq('id', id)
    load()
  }

  if (loading) return <div className="loading"><i className="ti ti-loader-2"/>A carregar...</div>

  return (
    <div className="two-col">
      <div className="card">
        <div className="card-header"><span className="card-title">Encomendas</span></div>
        {orders.length===0
          ? <div className="empty">Sem encomendas ainda.</div>
          : <div className="table-wrap">
              <table>
                <thead><tr><th>Enc.</th><th>Material</th><th>Fornecedor</th><th>Valor</th><th>Entrega prev.</th><th>Estado</th></tr></thead>
                <tbody>
                  {orders.map(o=>(
                    <tr key={o.id} style={{cursor:'pointer'}} onClick={()=>setSelected(o)}>
                      <td style={{fontWeight:500}}>{o.ref_number}</td>
                      <td style={{fontSize:12,maxWidth:160,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{o.requisitions?.description}</td>
                      <td style={{fontSize:12}}>{o.suppliers?.name}</td>
                      <td>{o.total_amount ? `€ ${parseFloat(o.total_amount).toLocaleString('pt-PT',{minimumFractionDigits:0})}` : '—'}</td>
                      <td style={{fontSize:12}}>{o.expected_date ? new Date(o.expected_date).toLocaleDateString('pt-PT') : '—'}</td>
                      <td><span className={`badge ${STATUS_CLASS[o.status]||''}`}>{o.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
        }
      </div>

      {selected && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Detalhe — {selected.ref_number}</span>
            <button className="btn btn-sm" onClick={()=>setSelected(null)}><i className="ti ti-x"/></button>
          </div>
          <div style={{fontSize:13,marginBottom:16}}>
            <div style={{marginBottom:8}}><span style={{color:'var(--text-muted)'}}>Material: </span>{selected.requisitions?.description}</div>
            <div style={{marginBottom:8}}><span style={{color:'var(--text-muted)'}}>Fornecedor: </span>{selected.suppliers?.name}</div>
            <div style={{marginBottom:8}}><span style={{color:'var(--text-muted)'}}>Quantidade: </span>{selected.quantity}</div>
            <div style={{marginBottom:8}}><span style={{color:'var(--text-muted)'}}>Valor total: </span>{selected.total_amount ? `€ ${parseFloat(selected.total_amount).toLocaleString('pt-PT')}` : '—'}</div>
            <div style={{marginBottom:8}}><span style={{color:'var(--text-muted)'}}>Ref. transporte: </span>{selected.tracking_ref||'—'}</div>
          </div>

          <div style={{marginBottom:12}}><div className="card-title" style={{marginBottom:12}}>Atualizar estado</div>
            <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
              {['Confirmado','Em trânsito','Entregue'].map(s=>(
                <button key={s} className={`btn btn-sm ${selected.status===s?'btn-primary':''}`}
                  onClick={()=>{ const f=s==='Entregue'?{delivered_date:new Date().toISOString().split('T')[0]}:{}; updateStatus(selected.id,s,f); setSelected({...selected,status:s}) }}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="card-title" style={{marginBottom:12}}>Ref. de seguimento</div>
            <div style={{display:'flex',gap:8}}>
              <input defaultValue={selected.tracking_ref||''} id="track-input" placeholder="Ex: PT820049123" style={{flex:1,border:'0.5px solid var(--border-hover)',borderRadius:'var(--radius)',padding:'7px 10px',fontSize:13,background:'var(--bg-card)',color:'var(--text)',fontFamily:'inherit'}} />
              <button className="btn btn-primary btn-sm" onClick={async()=>{
                const v=document.getElementById('track-input').value
                await supabase.from('orders').update({tracking_ref:v}).eq('id',selected.id)
                setSelected({...selected,tracking_ref:v})
              }}>Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
