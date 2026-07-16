import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useRole } from '../hooks/useRole'

const STATUS_CLASS = { 'Confirmado':'badge-ordered','Em trânsito':'badge-transit','Entregue':'badge-delivered','Cancelado':'badge-cancelled' }

export default function Orders() {
  const { session } = useAuth()
  const { isAdmin } = useRole()
  const [orders, setOrders] = useState([])
  const [affaires, setAffaires] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [partialPayments, setPartialPayments] = useState([])
  const [showPayForm, setShowPayForm] = useState(false)
  const [search, setSearch] = useState('')
  const [filterAffaire, setFilterAffaire] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [payForm, setPayForm] = useState({ amount:'', payment_date:'', payment_method:'Transferência', reference:'', notes:'' })
  const [saving, setSaving] = useState(false)

  const load = async () => {
    const [{ data: ord }, { data: aff }] = await Promise.all([
      supabase.from('orders').select('*, suppliers(name), requisitions(ref_number, description, affaires(name,ref_number,id)), delivery_type, delivery_address, delivery_city, delivery_notes').order('created_at',{ascending:false}),
      supabase.from('affaires').select('id,name,ref_number').not('status','eq','Cancelada').order('ref_number'),
    ])
    setOrders(ord||[])
    setAffaires(aff||[])
    setLoading(false)
  }

  const loadPayments = async (orderId) => {
    const { data } = await supabase.from('order_partial_payments').select('*, employees(full_name,emp_code)').eq('order_id',orderId).order('payment_date',{ascending:false})
    setPartialPayments(data||[])
  }

  useEffect(() => { load() }, [])

  const selectOrder = (o) => { setSelected(o); loadPayments(o.id) }

  const handleDelete = async (id) => {
    if (!confirm('Apagar esta encomenda? Os pagamentos associados também serão apagados.')) return
    const { error } = await supabase.from('orders').delete().eq('id', id)
    if (error) { alert('Erro ao apagar: ' + error.message); return }
    if (selected?.id === id) setSelected(null)
    load()
  }

  const updateStatus = async (id, status, extra={}) => {
    await supabase.from('orders').update({status,...extra}).eq('id',id)
    if (status === 'Entregue') {
      const o = orders.find(x=>x.id===id) || selected
      if (o?.requisition_id) await supabase.from('requisitions').update({ status:'Entregue' }).eq('id', o.requisition_id)
    }
    load()
  }

  const handlePaySave = async () => {
    if (!payForm.amount) return
    setSaving(true)
    const { data: emp } = await supabase.from('employees').select('id').eq('email',session?.user?.email).single()
    await supabase.from('order_partial_payments').insert({ order_id:selected.id, created_by:emp?.id||null, amount:parseFloat(payForm.amount), payment_date:payForm.payment_date||new Date().toISOString().split('T')[0], payment_method:payForm.payment_method, reference:payForm.reference, notes:payForm.notes })
    // Check if fully paid
    const newTotal = totalPaid + parseFloat(payForm.amount||0)
    if (selected.total_amount && newTotal >= parseFloat(selected.total_amount)) {
      await supabase.from('orders').update({ status:'Entregue' }).eq('id', selected.id)
      setSelected({...selected, status:'Entregue'})
      if (selected.requisition_id) await supabase.from('requisitions').update({ status:'Entregue' }).eq('id', selected.requisition_id)
      // Mark supplier payment as paid
      await supabase.from('payments').update({ status:'Pago', paid_date: new Date().toISOString().split('T')[0] }).eq('order_id', selected.id).eq('status','Pendente')
    }
    setPayForm({amount:'',payment_date:'',payment_method:'Transferência',reference:'',notes:''})
    setShowPayForm(false); setSaving(false); loadPayments(selected.id); load()
  }

  const filtered = orders.filter(o => {
    const s = search.toLowerCase()
    const matchSearch = !s || o.ref_number?.toLowerCase().includes(s) || o.requisitions?.ref_number?.toLowerCase().includes(s) || o.requisitions?.description?.toLowerCase().includes(s) || o.suppliers?.name?.toLowerCase().includes(s)
    const matchAffaire = !filterAffaire || o.requisitions?.affaires?.id === filterAffaire || o.requisitions?.affaires?.ref_number === filterAffaire
    const matchStatus = !filterStatus || o.status === filterStatus
    return matchSearch && matchAffaire && matchStatus
  })

  const totalPaid = partialPayments.reduce((s,p)=>s+parseFloat(p.amount||0),0)
  const totalPending = selected ? parseFloat(selected.total_amount||0)-totalPaid : 0
  const paidPct = selected?.total_amount ? Math.min(100,Math.round((totalPaid/parseFloat(selected.total_amount))*100)) : 0

  if (loading) return <div className="loading"><i className="ti ti-loader-2"/>A carregar...</div>

  return (
    <div style={{display:'flex',height:'calc(100vh - 56px)',overflow:'hidden'}}>
      <div style={{width:selected?'50%':'100%',flexShrink:0,display:'flex',flexDirection:'column',borderRight:selected?'1px solid var(--border)':'none',transition:'width 0.2s',overflowY:'auto'}}>
      <div className="card" style={{margin:0,borderRadius:0,border:'none',flex:1}}>
        <div className="card-header"><span className="card-title">Encomendas ({filtered.length}{filtered.length!==orders.length?` / ${orders.length}`:''})</span></div>
        <div style={{display:'flex',gap:8,marginBottom:12,flexWrap:'wrap'}}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Pesquisar..." style={{flex:1,minWidth:140,border:'0.5px solid var(--border-hover)',borderRadius:'var(--radius)',padding:'6px 10px',fontSize:13,background:'var(--bg-card)',color:'var(--text)',fontFamily:'inherit'}} />
          <select value={filterAffaire} onChange={e=>setFilterAffaire(e.target.value)} style={{border:'0.5px solid var(--border-hover)',borderRadius:'var(--radius)',padding:'6px 10px',fontSize:13,background:'var(--bg-card)',color:'var(--text)',fontFamily:'inherit'}}>
            <option value="">Todas as obras</option>
            {affaires.map(a=><option key={a.id} value={a.id}>{a.ref_number} — {a.name}</option>)}
          </select>
          <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} style={{border:'0.5px solid var(--border-hover)',borderRadius:'var(--radius)',padding:'6px 10px',fontSize:13,background:'var(--bg-card)',color:'var(--text)',fontFamily:'inherit'}}>
            <option value="">Todos os estados</option>
            {['Confirmado','Em trânsito','Entregue','Cancelado'].map(s=><option key={s}>{s}</option>)}
          </select>
          {(search||filterAffaire||filterStatus) && <button className="btn" onClick={()=>{setSearch('');setFilterAffaire('');setFilterStatus('')}}>✕</button>}
        </div>
        {filtered.length===0
          ? <div className="empty">{orders.length===0?'Sem encomendas.':'Nenhum resultado.'}</div>
          : <div className="table-wrap">
              <table>
                <thead><tr><th>Enc.</th><th>Material</th><th>Obra</th><th>Fornecedor</th><th>Valor</th><th>Estado</th><th></th></tr></thead>
                <tbody>
                  {filtered.map(o=>(
                    <tr key={o.id} style={{cursor:'pointer',background:selected?.id===o.id?'var(--bg)':''}} onClick={()=>selected?.id===o.id?setSelected(null):selectOrder(o)}>
                      <td style={{fontWeight:500}}>{o.ref_number}</td>
                      <td style={{maxWidth:140}}>
                        <div style={{fontSize:12,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{o.requisitions?.description}</div>
                        {o.requisitions?.ref_number && <div style={{fontSize:10,color:'var(--text-muted)',fontFamily:'monospace'}}>{o.requisitions.ref_number}</div>}
                      </td>
                      <td style={{fontSize:11}}><div style={{color:'var(--blue)'}}>{o.requisitions?.affaires?.ref_number||'—'}</div>{o.delivery_type&&o.delivery_type!=='Obra (morada da obra)'&&<div style={{fontSize:10,color:'var(--green)'}}>🚚 {o.delivery_type}</div>}</td>
                      <td style={{fontSize:12}}>{o.suppliers?.name}</td>
                      <td style={{fontSize:12}}>{o.total_amount?`€ ${parseFloat(o.total_amount).toLocaleString('pt-PT',{minimumFractionDigits:0})}`:'—'}</td>
                      <td><span className={`badge ${STATUS_CLASS[o.status]||''}`}>{o.status}</span></td>
                      <td onClick={e=>e.stopPropagation()}>
                        {isAdmin && <button className="btn btn-sm" style={{color:'var(--red)'}} onClick={()=>handleDelete(o.id)} title="Apagar encomenda"><i className="ti ti-trash"/></button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
        }
      </div></div>
      {selected && (
        <div style={{flex:1,minWidth:0,overflowY:'auto',background:'var(--bg)',padding:'0'}}>
        <div style={{padding:'4px'}}>
          <div className="card">
            <div className="card-header">
              <div>
                <div style={{fontWeight:600}}>{selected.ref_number} — {selected.suppliers?.name}</div>
                <div style={{fontSize:12,color:'var(--text-muted)',marginTop:2}}>{selected.requisitions?.ref_number && <span style={{fontFamily:'monospace',fontWeight:600}}>{selected.requisitions.ref_number} · </span>}{selected.requisitions?.description}</div>
                {selected.requisitions?.affaires && <div style={{fontSize:11,color:'var(--blue)',marginTop:2}}><i className="ti ti-building" style={{marginRight:4}}/>{selected.requisitions.affaires.ref_number} — {selected.requisitions.affaires.name}</div>}
              </div>
              <button className="btn btn-sm" onClick={()=>setSelected(null)}><i className="ti ti-x"/></button>
            </div>
            <div style={{fontSize:13,marginBottom:12}}>
              <div style={{marginBottom:4}}><span style={{color:'var(--text-muted)'}}>Qtd: </span>{selected.quantity} · <span style={{color:'var(--text-muted)'}}>Valor: </span><strong>{selected.total_amount?`€ ${parseFloat(selected.total_amount).toLocaleString('pt-PT')}`:'-'}</strong></div>
              {(selected.delivery_type||selected.delivery_address) && (
                <div style={{padding:'8px 10px',background:'var(--green-light)',borderRadius:'var(--radius)',marginBottom:6,fontSize:12}}>
                  <span style={{fontWeight:600,color:'var(--green)'}}>🚚 Entrega: </span>
                  {selected.delivery_type||'Obra'}{selected.delivery_address?` — ${selected.delivery_address}`:''}{selected.delivery_city?`, ${selected.delivery_city}`:''}
                  {selected.delivery_notes && <div style={{color:'var(--text-muted)',marginTop:2,fontStyle:'italic'}}>{selected.delivery_notes}</div>}
                </div>
              )}
              {selected.tracking_ref && <div><span style={{color:'var(--text-muted)'}}>Ref. transporte: </span>{selected.tracking_ref}</div>}
              {selected.expected_date && <div><span style={{color:'var(--text-muted)'}}>Entrega prevista: </span>{new Date(selected.expected_date).toLocaleDateString('pt-PT')}</div>}
            </div>
            {selected.total_amount && (
              <div style={{marginBottom:12,padding:'10px',background:'var(--bg)',borderRadius:'var(--radius)'}}>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:12,marginBottom:6}}>
                  <span style={{color:'var(--green)',fontWeight:600}}>Pago: € {totalPaid.toLocaleString('pt-PT',{minimumFractionDigits:0})}</span>
                  <span style={{color:totalPending>0?'var(--amber)':'var(--green)',fontWeight:600}}>Pendente: € {totalPending.toLocaleString('pt-PT',{minimumFractionDigits:0})}</span>
                </div>
                <div style={{height:8,background:'var(--border)',borderRadius:4,overflow:'hidden'}}>
                  <div style={{height:'100%',width:`${paidPct}%`,background:paidPct===100?'var(--green)':'var(--blue)',borderRadius:4}}/>
                </div>
                <div style={{fontSize:11,color:'var(--text-muted)',marginTop:4,textAlign:'center'}}>{paidPct}% pago ({partialPayments.length} pagamento(s))</div>
              </div>
            )}
            <div style={{marginBottom:10}}>
              <div style={{fontSize:13,fontWeight:500,marginBottom:6}}>Estado:</div>
              <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                {['Confirmado','Em trânsito','Entregue'].map(s=>(
                  <button key={s} className={`btn btn-sm ${selected.status===s?'btn-primary':''}`} onClick={()=>{updateStatus(selected.id,s,s==='Entregue'?{delivered_date:new Date().toISOString().split('T')[0]}:{});setSelected({...selected,status:s})}}>
                    {s}
                  </button>
                ))}
                {selected.status!=='Cancelado' && <button className="btn btn-sm" style={{color:'var(--amber)'}} onClick={()=>{if(!confirm(`Cancelar a encomenda ${selected.ref_number}? Fica registada no histórico, marcada como cancelada.`))return;updateStatus(selected.id,'Cancelado');setSelected({...selected,status:'Cancelado'})}}>
                    <i className="ti ti-ban"/> Cancelar
                  </button>}
              </div>
            </div>
            <div style={{display:'flex',gap:8}}>
              <input defaultValue={selected.tracking_ref||''} id="track-input" placeholder="Ref. transporte" style={{flex:1,border:'0.5px solid var(--border-hover)',borderRadius:'var(--radius)',padding:'7px 10px',fontSize:13,background:'var(--bg-card)',color:'var(--text)',fontFamily:'inherit'}} />
              <button className="btn btn-primary btn-sm" onClick={async()=>{const v=document.getElementById('track-input').value;await supabase.from('orders').update({tracking_ref:v}).eq('id',selected.id);setSelected({...selected,tracking_ref:v})}}>Guardar</button>
            </div>
          </div>
          <div className="card">
            <div className="card-header">
              <span className="card-title">Pagamentos ({partialPayments.length})</span>
              <button className="btn btn-primary btn-sm" onClick={()=>setShowPayForm(!showPayForm)}><i className="ti ti-plus"/>Registar</button>
            </div>
            {showPayForm && (
              <div style={{padding:'10px',background:'var(--bg)',borderRadius:'var(--radius)',marginBottom:10}}>
                <div className="form-grid" style={{gap:8}}>
                  <div className="form-group"><label>Valor (€) *</label><input type="number" step="0.01" value={payForm.amount} onChange={e=>setPayForm({...payForm,amount:e.target.value})} /></div>
                  <div className="form-group"><label>Data</label><input type="date" value={payForm.payment_date} onChange={e=>setPayForm({...payForm,payment_date:e.target.value})} /></div>
                  <div className="form-group"><label>Método</label>
                    <select value={payForm.payment_method} onChange={e=>setPayForm({...payForm,payment_method:e.target.value})}>
                      {['Transferência','Cheque','MB','Numerário'].map(m=><option key={m}>{m}</option>)}
                    </select>
                  </div>
                  <div className="form-group"><label>Referência</label><input value={payForm.reference} onChange={e=>setPayForm({...payForm,reference:e.target.value})} /></div>
                </div>
                <div style={{display:'flex',gap:8,marginTop:6,justifyContent:'flex-end'}}>
                  <button className="btn btn-sm" onClick={()=>setShowPayForm(false)}>Cancelar</button>
                  <button className="btn btn-primary btn-sm" onClick={handlePaySave} disabled={saving}>{saving?'...':'Guardar'}</button>
                </div>
              </div>
            )}
            {partialPayments.length===0 ? <div className="empty" style={{padding:10}}>Sem pagamentos.</div>
              : partialPayments.map(p=>(
                <div key={p.id} style={{display:'flex',justifyContent:'space-between',padding:'7px 0',borderBottom:'0.5px solid var(--border)',fontSize:12}}>
                  <div>
                    <div style={{fontWeight:500}}>€ {parseFloat(p.amount).toLocaleString('pt-PT',{minimumFractionDigits:0})} — {p.payment_method}</div>
                    <div style={{color:'var(--text-muted)',marginTop:1}}>{new Date(p.payment_date).toLocaleDateString('pt-PT')} · {p.employees?.emp_code||'—'} {p.reference?`· ${p.reference}`:''}</div>
                  </div>
                  <span style={{color:'var(--green)',fontWeight:600}}>✓</span>
                </div>
              ))
            }
          </div>
        </div>
        </div>
      )}
    </div>
  )
}
