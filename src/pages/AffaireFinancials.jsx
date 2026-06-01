import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const STATUS_CLASS = { 'Aberta':'badge-quotation','Em curso':'badge-ordered','Concluída':'badge-delivered','Cancelada':'badge-cancelled' }
const STATUS_COLOR = { 'Aberta':'var(--blue)','Em curso':'var(--amber)','Concluída':'var(--green)','Cancelada':'var(--red)' }

const euro = (v, dec=0) => `€ ${parseFloat(v||0).toLocaleString('pt-PT',{minimumFractionDigits:dec})}`

function Bar({ value, max, color='var(--blue)', height=8, showLabel=true }) {
  const pct = max > 0 ? Math.min(100, Math.round((value/max)*100)) : 0
  const c = pct > 100 ? 'var(--red)' : pct > 85 ? 'var(--amber)' : color
  return (
    <div>
      <div style={{height,background:'var(--border)',borderRadius:4,overflow:'hidden',marginBottom:3}}>
        <div style={{height:'100%',width:`${pct}%`,background:c,borderRadius:4,transition:'width 0.4s'}}/>
      </div>
      {showLabel && <div style={{fontSize:11,color:'var(--text-muted)',display:'flex',justifyContent:'space-between'}}>
        <span style={{fontWeight:pct>100?700:400,color:pct>100?'var(--red)':'var(--text-muted)'}}>{pct}%</span>
        <span>{euro(value)} / {euro(max)}</span>
      </div>}
    </div>
  )
}

function Box({ label, value, sub, color, bg, icon, highlight }) {
  return (
    <div style={{background:bg||'var(--bg)',borderRadius:'var(--radius)',padding:'12px 14px',border:highlight?`1.5px solid ${color||'var(--border)'}`:undefined}}>
      <div style={{fontSize:10,fontWeight:600,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:5}}>{icon} {label}</div>
      <div style={{fontSize:19,fontWeight:700,color:color||'var(--text)'}}>{euro(value)}</div>
      {sub && <div style={{fontSize:11,color:'var(--text-muted)',marginTop:3}}>{sub}</div>}
    </div>
  )
}

export default function AffaireFinancials() {
  const [data, setData] = useState([])
  const [selected, setSelected] = useState(null)
  const [orders, setOrders] = useState([])
  const [clientPayments, setClientPayments] = useState([])
  const [supplierPayments, setSupplierPayments] = useState([])
  const [transports, setTransports] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  const load = async () => {
    const { data: af } = await supabase.from('affaire_financials').select('*').order('ref_number')
    setData(af||[])
    setLoading(false)
  }

  const loadDetail = async (a) => {
    const { data: reqs } = await supabase.from('requisitions').select('id').eq('affaire_id', a.id)
    const reqIds = reqs?.map(r=>r.id) || []

    const [{ data: ord }, { data: cp }, { data: sp }, { data: tr }] = await Promise.all([
      reqIds.length > 0
        ? supabase.from('orders').select('*, suppliers(name), requisitions(description,ref_number), quotations(vat_rate,vat_exempt), order_partial_payments(amount,payment_date,payment_method,employees(emp_code))').in('requisition_id', reqIds).neq('status','Cancelado').order('created_at',{ascending:false})
        : { data:[] },
      supabase.from('client_payments').select('*').eq('affaire_id', a.id).order('due_date'),
      supabase.from('payments').select('*, orders(ref_number,suppliers(name),requisitions(description))').eq('affaire_id', a.id).order('due_date'),
      supabase.from('transport_agenda').select('*, carriers(name,vehicle_type)').eq('affaire_id', a.id).order('planned_date'),
    ])
    setOrders(ord||[])
    setClientPayments(cp||[])
    setSupplierPayments(sp||[])
    setTransports(tr||[])
  }

  useEffect(()=>{ load() },[])

  const selectAffaire = (a) => { setSelected(a); loadDetail(a) }

  const filtered = data.filter(a => {
    const s = search.toLowerCase()
    return (!s || a.name?.toLowerCase().includes(s) || a.ref_number?.toLowerCase().includes(s) || a.client_name?.toLowerCase().includes(s))
      && (!filterStatus || a.status === filterStatus)
  })

  // Computed values for selected affaire
  const f = selected || {}
  const costExclVat     = parseFloat(f.total_orders_cost||0)
  const vatPurchases    = parseFloat(f.total_vat_purchases||0)
  const vatRecoverable  = parseFloat(f.total_vat_recoverable||0)
  const vatNet          = vatPurchases - vatRecoverable          // IVA realmente a pagar
  const transportCost   = parseFloat(f.total_transport_cost||0)
  const transportVatRec = parseFloat(f.total_transport_vat_recoverable||0)
  const totalRealCost   = costExclVat + vatNet + transportCost   // custo real total
  const received        = parseFloat(f.received_from_client||0)
  const pending         = parseFloat(f.pending_from_client||0)
  const budget          = parseFloat(f.client_budget||0)
  const margin          = received - totalRealCost
  const marginPct       = received > 0 ? Math.round((margin/received)*100) : 0
  const projectedMargin = (received+pending) - totalRealCost     // se cobrar tudo

  if (loading) return <div className="loading"><i className="ti ti-loader-2"/>A carregar...</div>

  return (
    <div>
      {/* Totais globais */}
      <div className="metrics" style={{marginBottom:20}}>
        <div className="metric">
          <div className="metric-label">Obras em curso</div>
          <div className="metric-value text-blue">{data.filter(a=>['Aberta','Em curso'].includes(a.status)).length}</div>
        </div>
        <div className="metric">
          <div className="metric-label">Total recebido</div>
          <div className="metric-value text-green" style={{fontSize:15}}>{euro(data.reduce((a,x)=>a+parseFloat(x.received_from_client||0),0))}</div>
        </div>
        <div className="metric">
          <div className="metric-label">Total a receber</div>
          <div className="metric-value text-amber" style={{fontSize:15}}>{euro(data.reduce((a,x)=>a+parseFloat(x.pending_from_client||0),0))}</div>
        </div>
        <div className="metric">
          <div className="metric-label">Total pago fornecedores</div>
          <div className="metric-value text-red" style={{fontSize:15}}>{euro(data.reduce((a,x)=>a+parseFloat(x.total_paid_suppliers||0),0))}</div>
        </div>
      </div>

      <div style={{display:'flex',gap:16,alignItems:'flex-start'}}>
        {/* Lista */}
        <div style={{width:310,flexShrink:0}}>
          <div className="card">
            <div className="card-header"><span className="card-title">Obras ({filtered.length})</span></div>
            <div style={{display:'flex',gap:6,marginBottom:10}}>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Pesquisar..." style={{flex:1,border:'0.5px solid var(--border-hover)',borderRadius:'var(--radius)',padding:'6px 10px',fontSize:13,background:'var(--bg-card)',color:'var(--text)',fontFamily:'inherit'}} />
              <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} style={{border:'0.5px solid var(--border-hover)',borderRadius:'var(--radius)',padding:'6px 8px',fontSize:12,background:'var(--bg-card)',color:'var(--text)',fontFamily:'inherit'}}>
                <option value="">Todos</option>
                {['Aberta','Em curso','Concluída','Cancelada'].map(s=><option key={s}>{s}</option>)}
              </select>
            </div>
            {filtered.length===0 ? <div className="empty">Sem obras.</div>
              : <div style={{display:'flex',flexDirection:'column',gap:8}}>
                  {filtered.map(a => {
                    const cost = parseFloat(a.total_orders_cost||0)
                    const vat = parseFloat(a.total_vat_purchases||0) - parseFloat(a.total_vat_recoverable||0)
                    const tr = parseFloat(a.total_transport_cost||0)
                    const totalCost = cost + vat + tr
                    const rec = parseFloat(a.received_from_client||0)
                    const mgn = rec - totalCost
                    return (
                      <div key={a.id} onClick={()=>selectAffaire(a)}
                        style={{border:`1px solid ${selected?.id===a.id?'var(--blue)':'var(--border)'}`,borderLeft:`4px solid ${STATUS_COLOR[a.status]||'var(--border)'}`,borderRadius:'var(--radius)',padding:'10px 12px',cursor:'pointer',background:selected?.id===a.id?'var(--blue-light)':'var(--bg-card)'}}>
                        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:6,marginBottom:6}}>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontSize:11,color:'var(--text-muted)'}}>{a.ref_number} · {a.client_name||'—'}</div>
                            <div style={{fontWeight:600,fontSize:13,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{a.name}</div>
                          </div>
                          <span className={`badge ${STATUS_CLASS[a.status]||''}`} style={{fontSize:10,flexShrink:0}}>{a.status}</span>
                        </div>
                        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'2px 12px',fontSize:11,marginBottom:6}}>
                          <div><span style={{color:'var(--text-muted)'}}>Recebido: </span><strong style={{color:'var(--green)'}}>{euro(rec)}</strong></div>
                          <div><span style={{color:'var(--text-muted)'}}>Custo real: </span><strong style={{color:'var(--red)'}}>{euro(totalCost)}</strong></div>
                          <div style={{gridColumn:'1/-1'}}><span style={{color:'var(--text-muted)'}}>Margem: </span><strong style={{color:mgn>=0?'var(--green)':'var(--red)'}}>{mgn>=0?'+':''}{euro(mgn)}</strong></div>
                        </div>
                        {parseFloat(a.client_budget||0)>0 && (
                          <Bar value={totalCost} max={parseFloat(a.client_budget)} height={4} showLabel={false}/>
                        )}
                      </div>
                    )
                  })}
                </div>
            }
          </div>
        </div>

        {/* Painel financeiro */}
        {selected && (
          <div style={{flex:1,minWidth:0}}>
            {/* Header */}
            <div className="card" style={{marginBottom:12}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:16}}>
                <div>
                  <div style={{fontSize:12,color:'var(--text-muted)'}}>{selected.ref_number} · {selected.client_name}</div>
                  <div style={{fontSize:20,fontWeight:700}}>{selected.name}</div>
                  <div style={{display:'flex',gap:8,marginTop:4,flexWrap:'wrap'}}>
                    <span className={`badge ${STATUS_CLASS[selected.status]||''}`}>{selected.status}</span>
                    {parseInt(selected.international_transports||0)>0 && <span style={{fontSize:11,background:'var(--blue-light)',color:'var(--blue)',padding:'2px 8px',borderRadius:10}}>✈️ {selected.international_transports} transporte(s) internacional(is)</span>}
                  </div>
                </div>
                <button className="btn btn-sm" onClick={()=>setSelected(null)}><i className="ti ti-x"/></button>
              </div>

              {/* RECEITAS */}
              <div style={{marginBottom:14}}>
                <div style={{fontSize:11,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:8}}>📥 RECEITAS DO CLIENTE</div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:10}}>
                  <Box label="Orçamento acordado" value={budget} icon="📋" color="var(--blue)" />
                  <Box label="Recebido" value={received} icon="✅" color="var(--green)" bg="var(--green-light)" sub={`${selected.total_client_orders} encomenda(s)`} highlight />
                  <Box label="Ainda a receber" value={pending} icon="⏳" color={pending>0?'var(--amber)':'var(--text-muted)'} />
                </div>
                {budget>0 && <div style={{marginBottom:4}}>
                  <div style={{fontSize:12,fontWeight:500,marginBottom:4}}>Faturado vs Orçamento</div>
                  <Bar value={received+pending} max={budget} color="var(--blue)"/>
                </div>}
              </div>

              <div style={{height:'0.5px',background:'var(--border)',margin:'14px 0'}}/>

              {/* CUSTOS DETALHADOS */}
              <div style={{marginBottom:14}}>
                <div style={{fontSize:11,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:8}}>📤 CUSTOS DETALHADOS</div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,marginBottom:10}}>
                  <Box label="Compras s/IVA" value={costExclVat} icon="🛒" color="var(--text)" sub={`${selected.total_supplier_orders} enc.`} />
                  <Box label="IVA das compras" value={vatPurchases} icon="🧾" color="var(--amber)" sub={vatRecoverable>0?`Recuperável: ${euro(vatRecoverable)}`:'Sem IVA recuperável'} />
                  <Box label="IVA líquido (a pagar)" value={vatNet} icon="💸" color={vatNet>0?'var(--red)':'var(--green)'} bg={vatNet>0?'var(--red-light)':undefined} sub={vatRecoverable>0?`Recuperado: ${euro(vatRecoverable)}`:'0% de IVA recuperável'} highlight={vatNet>0} />
                  <Box label="Transportes" value={transportCost} icon="🚛" color="var(--text)" sub={transportVatRec>0?`IVA recup.: ${euro(transportVatRec)}`:'Sem IVA recuperável'} />
                </div>

                {/* Linha do custo real total */}
                <div style={{padding:'12px 14px',background:'var(--red-light)',borderRadius:'var(--radius)',border:'1.5px solid var(--red)',marginBottom:10}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:8}}>
                    <div>
                      <div style={{fontSize:11,fontWeight:600,color:'var(--red)',marginBottom:4}}>💰 CUSTO REAL TOTAL (compras + IVA líquido + transportes)</div>
                      <div style={{fontSize:24,fontWeight:800,color:'var(--red)'}}>{euro(totalRealCost)}</div>
                    </div>
                    <div style={{textAlign:'right'}}>
                      {vatRecoverable+transportVatRec>0 && (
                        <div style={{fontSize:12,color:'var(--green)',fontWeight:600,marginBottom:4}}>
                          ✈️ Total IVA recuperável: {euro(vatRecoverable+transportVatRec)}
                        </div>
                      )}
                      <div style={{fontSize:12,color:'var(--text-muted)'}}>
                        Compras: {euro(costExclVat)} + IVA líquido: {euro(vatNet)} + Transport.: {euro(transportCost)}
                      </div>
                    </div>
                  </div>
                </div>

                {budget>0 && <div>
                  <div style={{fontSize:12,fontWeight:500,marginBottom:4}}>Custo real vs Orçamento cliente</div>
                  <Bar value={totalRealCost} max={budget} color="var(--red)"/>
                  {totalRealCost>budget && <div style={{fontSize:11,color:'var(--red)',fontWeight:700,marginTop:4}}>⚠️ ORÇAMENTO ULTRAPASSADO em {euro(totalRealCost-budget)}</div>}
                </div>}
              </div>

              <div style={{height:'0.5px',background:'var(--border)',margin:'14px 0'}}/>

              {/* MARGEM */}
              <div>
                <div style={{fontSize:11,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:8}}>📊 ANÁLISE DE MARGEM</div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8}}>
                  <div style={{padding:'12px 14px',background:margin>=0?'var(--green-light)':'var(--red-light)',borderRadius:'var(--radius)',border:`1.5px solid ${margin>=0?'var(--green)':'var(--red)'}`}}>
                    <div style={{fontSize:10,fontWeight:600,color:'var(--text-muted)',marginBottom:4}}>💵 MARGEM ACTUAL (recebido − custo real)</div>
                    <div style={{fontSize:22,fontWeight:800,color:margin>=0?'var(--green)':'var(--red)'}}>{margin>=0?'+':''}{euro(margin)}</div>
                    <div style={{fontSize:12,color:'var(--text-muted)',marginTop:2}}>{marginPct}% de margem</div>
                  </div>
                  <div style={{padding:'12px 14px',background:'var(--bg)',borderRadius:'var(--radius)'}}>
                    <div style={{fontSize:10,fontWeight:600,color:'var(--text-muted)',marginBottom:4}}>🔮 MARGEM PROJECTADA (+ a receber)</div>
                    <div style={{fontSize:22,fontWeight:800,color:projectedMargin>=0?'var(--green)':'var(--red)'}}>{projectedMargin>=0?'+':''}{euro(projectedMargin)}</div>
                    <div style={{fontSize:12,color:'var(--text-muted)',marginTop:2}}>{received+pending>0?Math.round((projectedMargin/(received+pending))*100):0}% se cobrar tudo</div>
                  </div>
                  <div style={{padding:'12px 14px',background:'var(--bg)',borderRadius:'var(--radius)'}}>
                    <div style={{fontSize:10,fontWeight:600,color:'var(--text-muted)',marginBottom:4}}>🏭 PAGAMENTO FORNECEDORES</div>
                    <div style={{fontSize:16,fontWeight:700,color:'var(--green)'}}>{euro(parseFloat(f.total_paid_suppliers||0))}</div>
                    <div style={{fontSize:12,color:'var(--text-muted)',marginTop:2}}>pago de {euro(costExclVat)} em compras</div>
                    <Bar value={parseFloat(f.total_paid_suppliers||0)} max={costExclVat} height={5} showLabel={false}/>
                  </div>
                </div>
              </div>
            </div>

            {/* Encomendas */}
            {orders.length>0 && (
              <div className="card" style={{marginBottom:12}}>
                <div className="card-header"><span className="card-title">🛒 Encomendas a fornecedores ({orders.length})</span></div>
                <table>
                  <thead>
                    <tr><th>Enc.</th><th>Material</th><th>Fornecedor</th><th>S/IVA</th><th>IVA</th><th>C/IVA</th><th>Pago</th><th>Estado</th></tr>
                  </thead>
                  <tbody>
                    {orders.map(o => {
                      const total = parseFloat(o.total_amount||0)
                      const vatRate = parseFloat(o.quotations?.vat_rate||23)
                      const vatExempt = o.quotations?.vat_exempt||false
                      const vatAmt = vatExempt ? 0 : total * vatRate/100
                      const totalInclVat = total + vatAmt
                      const paid = o.order_partial_payments?.reduce((a,p)=>a+parseFloat(p.amount||0),0)||0
                      return (
                        <tr key={o.id}>
                          <td style={{fontWeight:600}}>{o.ref_number}</td>
                          <td style={{fontSize:12,maxWidth:130,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{o.requisitions?.description||'—'}</td>
                          <td style={{fontSize:12}}>{o.suppliers?.name||'—'}</td>
                          <td>{euro(total)}</td>
                          <td style={{color:vatExempt?'var(--green)':'var(--amber)',fontSize:12}}>
                            {vatExempt?<span title="IVA recuperável — exportação">✈️ 0%</span>:`+${euro(vatAmt)} (${vatRate}%)`}
                          </td>
                          <td style={{fontWeight:600}}>{euro(totalInclVat)}</td>
                          <td style={{color:paid>=total?'var(--green)':'var(--amber)',fontSize:12}}>{euro(paid)}</td>
                          <td><span className={`badge ${{Confirmado:'badge-ordered','Em trânsito':'badge-transit',Entregue:'badge-delivered'}[o.status]||''}`}>{o.status}</span></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Transportes agendados */}
            {transports.length>0 && (
              <div className="card" style={{marginBottom:12}}>
                <div className="card-header"><span className="card-title">🚛 Transportes agendados ({transports.length})</span></div>
                <table>
                  <thead><tr><th>Data</th><th>Transportador</th><th>Carga</th><th>Destino</th><th>Custo</th><th>IVA recup.</th><th>Estado</th></tr></thead>
                  <tbody>
                    {transports.map(t=>(
                      <tr key={t.id}>
                        <td style={{fontWeight:500}}>{new Date(t.planned_date).toLocaleDateString('pt-PT')}</td>
                        <td style={{fontSize:12}}>{t.carriers?.name||'—'}</td>
                        <td style={{fontSize:12,maxWidth:120,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{t.load_description||'—'}</td>
                        <td style={{fontSize:12}}>{t.is_international?`✈️ ${t.destination_country||'Estrangeiro'}`:'Nacional'}</td>
                        <td style={{fontWeight:500,color:'var(--red)'}}>{t.transport_cost?euro(t.transport_cost):'—'}</td>
                        <td style={{color:'var(--green)',fontSize:12}}>{t.vat_recoverable>0?euro(t.vat_recoverable):'—'}</td>
                        <td><span className={`badge ${{
                          'Por fazer':'badge-pending','Contactado':'badge-quotation',
                          'Confirmado':'badge-approved','Recusado':'badge-cancelled'
                        }[t.contact_status]||''}`}>{t.contact_status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{marginTop:10,padding:'8px 12px',background:'var(--bg)',borderRadius:'var(--radius)',fontSize:12,display:'flex',gap:16}}>
                  <span><span style={{color:'var(--text-muted)'}}>Total transporte: </span><strong style={{color:'var(--red)'}}>{euro(transportCost)}</strong></span>
                  {transportVatRec>0 && <span><span style={{color:'var(--text-muted)'}}>IVA recuperável: </span><strong style={{color:'var(--green)'}}>{euro(transportVatRec)}</strong></span>}
                  <span><span style={{color:'var(--text-muted)'}}>Custo líquido transporte: </span><strong>{euro(transportCost-transportVatRec)}</strong></span>
                </div>
              </div>
            )}

            {/* Pagamentos lado a lado */}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              <div className="card">
                <div className="card-header"><span className="card-title">✅ Recebimentos do cliente</span></div>
                {clientPayments.length===0 ? <div className="empty">Sem pagamentos.</div>
                  : clientPayments.map(p=>(
                      <div key={p.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0',borderBottom:'0.5px solid var(--border)',fontSize:13}}>
                        <div>
                          <div style={{fontWeight:500}}>{p.invoice_ref||'—'}</div>
                          <div style={{fontSize:11,color:'var(--text-muted)'}}>{p.due_date?new Date(p.due_date).toLocaleDateString('pt-PT'):''}{p.paid_date?` · Pago ${new Date(p.paid_date).toLocaleDateString('pt-PT)}`:''}</div>
                        </div>
                        <div style={{display:'flex',gap:6,alignItems:'center'}}>
                          <strong style={{color:p.status==='Pago'?'var(--green)':'var(--amber)'}}>{euro(p.amount)}</strong>
                          <span className={`badge ${p.status==='Pago'?'badge-delivered':'badge-pending'}`}>{p.status}</span>
                        </div>
                      </div>
                    ))
                }
              </div>
              <div className="card">
                <div className="card-header"><span className="card-title">🏭 Faturas fornecedores</span></div>
                {supplierPayments.length===0 ? <div className="empty">Sem faturas.</div>
                  : supplierPayments.map(p=>(
                      <div key={p.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0',borderBottom:'0.5px solid var(--border)',fontSize:13}}>
                        <div>
                          <div style={{fontWeight:500}}>{p.orders?.suppliers?.name||'—'} {p.invoice_ref?`· ${p.invoice_ref}`:''}</div>
                          <div style={{fontSize:11,color:'var(--text-muted)'}}>{p.orders?.ref_number} {p.due_date?`· ${new Date(p.due_date).toLocaleDateString('pt-PT')}`:''}</div>
                        </div>
                        <div style={{display:'flex',gap:6,alignItems:'center'}}>
                          <strong style={{color:p.status==='Pago'?'var(--green)':'var(--red)'}}>{euro(p.amount)}</strong>
                          <span className={`badge ${p.status==='Pago'?'badge-delivered':p.status==='Em atraso'?'badge-critical':'badge-pending'}`}>{p.status}</span>
                        </div>
                      </div>
                    ))
                }
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
