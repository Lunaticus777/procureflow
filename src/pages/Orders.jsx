import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

const STATUS_CLASS = {
  'Confirmado':'badge-ordered','Em trânsito':'badge-transit',
  'Entregue':'badge-delivered','Cancelado':'badge-cancelled'
}

export default function Orders() {
  const { session } = useAuth()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [partialPayments, setPartialPayments] = useState([])
  const [showPayForm, setShowPayForm] = useState(false)
  const [payForm, setPayForm] = useState({ amount:'', payment_date:'', payment_method:'Transferência', reference:'', notes:'' })
  const [saving, setSaving] = useState(false)

  const load = async () => {
    const { data } = await supabase
      .from('orders')
      .select('*, suppliers(name), requisitions(description, ref_number, affaires(name,ref_number)), employees(full_name,emp_code)')
      .order('created_at', { ascending:false })
    setOrders(data||[])
    setLoading(false)
  }

  const loadPayments = async (orderId) => {
    const { data } = await supabase
      .from('order_partial_payments')
      .select('*, employees(full_name, emp_code)')
      .eq('order_id', orderId)
      .order('payment_date', { ascending: false })
    setPartialPayments(data||[])
  }

  useEffect(() => { load() }, [])

  const selectOrder = (o) => { setSelected(o); loadPayments(o.id) }

  const updateStatus = async (id, status, extra={}) => {
    await supabase.from('orders').update({ status, ...extra }).eq('id', id)
    load()
  }

  const handlePaySave = async () => {
    if (!payForm.amount) return
    setSaving(true)
    const { data: emp } = await supabase.from('employees').select('id').eq('email', session?.user?.email).single()
    await supabase.from('order_partial_payments').insert({
      order_id: selected.id,
      created_by: emp?.id||null,
      amount: parseFloat(payForm.amount),
      payment_date: payForm.payment_date || new Date().toISOString().split('T')[0],
      payment_method: payForm.payment_method,
      reference: payForm.reference,
      notes: payForm.notes,
    })
    setPayForm({ amount:'', payment_date:'', payment_method:'Transferência', reference:'', notes:'' })
    setShowPayForm(false)
    setSaving(false)
    loadPayments(selected.id)
  }

  const totalPaid = partialPayments.reduce((s,p)=>s+parseFloat(p.amount||0),0)
  const totalPending = selected ? (parseFloat(selected.total_amount||0) - totalPaid) : 0
  const paidPct = selected?.total_amount ? Math.min(100, Math.round((totalPaid/parseFloat(selected.total_amount))*100)) : 0

  if (loading) return <div className="loading"><i className="ti ti-loader-2"/>A carregar...</div>

  return (
    <div className="two-col">
      <div className="card">
        <div className="card-header"><span className="card-title">Encomendas a Fornecedores</span></div>
        {orders.length===0
          ? <div className="empty">Sem encomendas ainda.</div>
          : <div className="table-wrap">
              <table>
                <thead><tr><th>Enc.</th><th>Material</th><th>Obra</th><th>Fornecedor</th><th>Valor</th><th>Estado</th></tr></thead>
                <tbody>
                  {orders.map(o=>(
                    <tr key={o.id} style={{cursor:'pointer',background:selected?.id===o.id?'var(--bg)':''}} onClick={()=>selectOrder(o)}>
                      <td style={{fontWeight:500}}>{o.ref_number}</td>
                      <td style={{fontSize:12,maxWidth:140,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{o.requisitions?.description}</td>
                      <td style={{fontSize:11,color:'var(--blue)'}}>{o.requisitions?.affaires?.ref_number||'—'}</td>
                      <td style={{fontSize:12}}>{o.suppliers?.name}</td>
                      <td style={{fontSize:12}}>{o.total_amount?`€ ${parseFloat(o.total_amount).toLocaleString('pt-PT',{minimumFractionDigits:0})}`:'—'}</td>
                      <td><span className={`badge ${STATUS_CLASS[o.status]||''}`}>{o.status}</span></td>
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
                <div style={{fontWeight:600}}>{selected.ref_number} — {selected.suppliers?.name}</div>
                <div style={{fontSize:12,color:'var(--text-muted)',marginTop:2}}>{selected.requisitions?.description}</div>
                {selected.requisitions?.affaires && <div style={{fontSize:11,color:'var(--blue)',marginTop:2}}><i className="ti ti-building" style={{marginRight:4}}/>{selected.requisitions.affaires.ref_number} — {selected.requisitions.affaires.name}</div>}
              </div>
              <button className="btn btn-sm" onClick={()=>setSelected(null)}><i className="ti ti-x"/></button>
            </div>

            <div style={{fontSize:13,marginBottom:12}}>
              <div style={{marginBottom:6}}><span style={{color:'var(--text-muted)'}}>Quantidade: </span>{selected.quantity}</div>
              <div style={{marginBottom:6}}><span style={{color:'var(--text-muted)'}}>Valor total: </span><strong>{selected.total_amount?`€ ${parseFloat(selected.total_amount).toLocaleString('pt-PT')}`:'-'}</strong></div>
              {selected.tracking_ref && <div style={{marginBottom:6}}><span style={{color:'var(--text-muted)'}}>Ref. transporte: </span>{selected.tracking_ref}</div>}
              {selected.expected_date && <div><span style={{color:'var(--text-muted)'}}>Entrega prevista: </span>{new Date(selected.expected_date).toLocaleDateString('pt-PT')}</div>}
            </div>

            {/* Barra de pagamento */}
            {selected.total_amount && (
              <div style={{marginBottom:14,padding:'12px',background:'var(--bg)',borderRadius:'var(--radius)'}}>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:12,marginBottom:6}}>
                  <span style={{color:'var(--green)',fontWeight:600}}>Pago: € {totalPaid.toLocaleString('pt-PT',{minimumFractionDigits:0})}</span>
                  <span style={{color: totalPending>0?'var(--amber)':'var(--green)',fontWeight:600}}>Pendente: € {totalPending.toLocaleString('pt-PT',{minimumFractionDigits:0})}</span>
                </div>
                <div style={{height:8,background:'var(--border)',borderRadius:4,overflow:'hidden'}}>
                  <div style={{height:'100%',width:`${paidPct}%`,background:paidPct===100?'var(--green)':'var(--blue)',borderRadius:4,transition:'width 0.3s'}}/>
                </div>
                <div style={{fontSize:11,color:'var(--text-muted)',marginTop:4,textAlign:'center'}}>{paidPct}% pago</div>
              </div>
            )}

            <div style={{marginBottom:12}}>
              <div style={{fontSize:13,fontWeight:500,marginBottom:8}}>Atualizar estado:</div>
              <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                {['Confirmado','Em trânsito','Entregue'].map(s=>(
                  <button key={s} className={`btn btn-sm ${selected.status===s?'btn-primary':''}`}
                    onClick={()=>{ updateStatus(selected.id, s, s==='Entregue'?{delivered_date:new Date().toISOString().split('T')[0]}:{}); setSelected({...selected,status:s}) }}>
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div style={{marginBottom:12}}>
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
                <div style={{fontSize:13,fontWeight:500}}>Referência de seguimento</div>
              </div>
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

          {/* Pagamentos parciais */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Pagamentos ({partialPayments.length})</span>
              <button className="btn btn-primary btn-sm" onClick={()=>setShowPayForm(!showPayForm)}><i className="ti ti-plus"/>Registar</button>
            </div>

            {showPayForm && (
              <div style={{padding:'12px',background:'var(--bg)',borderRadius:'var(--radius)',marginBottom:12}}>
                <div className="form-grid" style={{gap:8}}>
                  <div className="form-group"><label>Valor (€) *</label><input type="number" step="0.01" value={payForm.amount} onChange={e=>setPayForm({...payForm,amount:e.target.value})} /></div>
                  <div className="form-group"><label>Data</label><input type="date" value={payForm.payment_date} onChange={e=>setPayForm({...payForm,payment_date:e.target.value})} /></div>
                  <div className="form-group"><label>Método</label>
                    <select value={payForm.payment_method} onChange={e=>setPayForm({...payForm,payment_method:e.target.value})}>
                      {['Transferência','Cheque','MB','Numerário'].map(m=><option key={m}>{m}</option>)}
                    </select>
                  </div>
                  <div className="form-group"><label>Referência</label><input value={payForm.reference} onChange={e=>setPayForm({...payForm,reference:e.target.value})} placeholder="Ref. transferência..." /></div>
                  <div className="form-group full"><label>Notas</label><input value={payForm.notes} onChange={e=>setPayForm({...payForm,notes:e.target.value})} /></div>
                </div>
                <div style={{display:'flex',gap:8,marginTop:8,justifyContent:'flex-end'}}>
                  <button className="btn btn-sm" onClick={()=>setShowPayForm(false)}>Cancelar</button>
                  <button className="btn btn-primary btn-sm" onClick={handlePaySave} disabled={saving}>{saving?'A guardar...':'Guardar'}</button>
                </div>
              </div>
            )}

            {partialPayments.length===0
              ? <div className="empty" style={{padding:12}}>Sem pagamentos registados.</div>
              : partialPayments.map(p=>(
                  <div key={p.id} style={{display:'flex',justifyContent:'space-between',padding:'8px 0',borderBottom:'0.5px solid var(--border)',fontSize:13}}>
                    <div>
                      <div style={{fontWeight:500}}>€ {parseFloat(p.amount).toLocaleString('pt-PT',{minimumFractionDigits:0})} — {p.payment_method}</div>
                      <div style={{fontSize:11,color:'var(--text-muted)',marginTop:2}}>
                        {new Date(p.payment_date).toLocaleDateString('pt-PT')} · {p.employees?.emp_code||'—'}
                        {p.reference?` · ${p.reference}`:''}
                      </div>
                      {p.notes && <div style={{fontSize:11,fontStyle:'italic',color:'var(--text-muted)'}}>{p.notes}</div>}
                    </div>
                    <span style={{color:'var(--green)',fontWeight:600,fontSize:14}}>✓</span>
                  </div>
                ))
            }
          </div>
        </div>
      )}
    </div>
  )
}
