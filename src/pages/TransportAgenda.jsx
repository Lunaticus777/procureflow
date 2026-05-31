import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const STOP_COLORS = { 'Recolha':'var(--blue)', 'Passagem':'var(--amber)', 'Entrega final':'var(--green)' }
const CONTACT_STATUS_CLASS = { 'Por fazer':'badge-pending', 'Contactado':'badge-quotation', 'Confirmado':'badge-approved', 'Recusado':'badge-cancelled' }

export default function TransportAgenda() {
  const [agenda, setAgenda] = useState([])
  const [carriers, setCarriers] = useState([])
  const [clientOrders, setClientOrders] = useState([])
  const [supplierOrders, setSupplierOrders] = useState([])
  const [stops, setStops] = useState({})
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [showStops, setShowStops] = useState(null)
  const [search, setSearch] = useState('')
  const [form, setForm] = useState({ carrier_id:'', planned_date:'', load_description:'', departure_time:'', client_order_id:'', notes:'' })
  const [stopForm, setStopForm] = useState({ carrier_id:'', address:'', city:'', stop_type:'Entrega final', arrival_time:'', notes:'' })
  const [saving, setSaving] = useState(false)

  const today = new Date()
  const in3days = new Date(); in3days.setDate(today.getDate() + 3)
  const todayStr = today.toISOString().split('T')[0]

  const load = async () => {
    try {
      const [{ data: ag, error: e1 }, { data: ca }, { data: so }, { data: co }] = await Promise.all([
        supabase.from('transport_agenda')
          .select('*, carriers(name,vehicle_type,phone,plate), client_orders(ref_number,description,delivery_address,delivery_city)')
          .gte('planned_date', todayStr)
          .order('planned_date'),
        supabase.from('carriers').select('*').eq('active', true).order('name'),
        supabase.from('orders').select('id,ref_number,total_amount,suppliers(name),requisitions(description,affaires(name))').not('status','eq','Entregue').not('status','eq','Cancelado').order('ref_number'),
        supabase.from('client_orders')
          .select('id,ref_number,description,delivery_address,delivery_city,status')
          .not('status','eq','Cancelado')
          .order('ref_number'),
      ])
      if (e1) console.error('Transport load error:', e1)
      setAgenda(ag || [])
      setCarriers(ca || [])
      setSupplierOrders(so || [])
      setClientOrders(co || [])
    } catch (err) {
      console.error('Load error:', err)
    }
    setLoading(false)
  }

  const loadStops = async (agendaId) => {
    const { data } = await supabase
      .from('transport_stops')
      .select('*, carriers(name,phone)')
      .eq('transport_agenda_id', agendaId)
      .order('stop_order')
    setStops(s => ({ ...s, [agendaId]: data || [] }))
  }

  useEffect(() => { load() }, [])

  const handleSave = async () => {
    if (!form.carrier_id || !form.planned_date) return
    setSaving(true)
    try {
      const contactDate = new Date(form.planned_date)
      contactDate.setDate(contactDate.getDate() - 3)
      let loadDesc = form.load_description
      if (form.client_order_id && !loadDesc) {
        const order = clientOrders.find(o => o.id === form.client_order_id)
        if (order) loadDesc = `${order.ref_number} — ${order.description?.slice(0,80)}`
      }
      const { data: inserted } = await supabase.from('transport_agenda').insert({
        carrier_id: form.carrier_id,
        planned_date: form.planned_date,
        departure_time: form.departure_time || null,
        load_description: loadDesc,
        client_order_id: form.client_order_id || null,
        contact_date: contactDate.toISOString().split('T')[0],
        contact_status: 'Por fazer',
        notes: form.notes,
      }).select().single()

      if (inserted && form.client_order_id) {
        const order = clientOrders.find(o => o.id === form.client_order_id)
        if (order?.delivery_address) {
          await supabase.from('transport_stops').insert({
            transport_agenda_id: inserted.id, stop_order: 1,
            carrier_id: form.carrier_id, address: order.delivery_address,
            city: order.delivery_city, stop_type: 'Entrega final',
          })
        }
      }
      setForm({ carrier_id:'', planned_date:'', load_description:'', departure_time:'', client_order_id:'', notes:'' })
      setShowForm(false)
      load()
    } catch (err) {
      console.error('Save error:', err)
    }
    setSaving(false)
  }

  const handleDelete = async (id) => {
    if (!confirm('Apagar este transporte agendado?')) return
    const { error } = await supabase.from('transport_agenda').delete().eq('id', id)
    if (error) { alert('Erro ao apagar: ' + error.message); return }
    load()
  }

  const addStop = async (agendaId) => {
    if (!stopForm.address) return
    const existingStops = stops[agendaId] || []
    await supabase.from('transport_stops').insert({
      transport_agenda_id: agendaId, stop_order: existingStops.length + 1,
      carrier_id: stopForm.carrier_id || null, address: stopForm.address,
      city: stopForm.city, stop_type: stopForm.stop_type,
      arrival_time: stopForm.arrival_time || null, notes: stopForm.notes,
    })
    setStopForm({ carrier_id:'', address:'', city:'', stop_type:'Entrega final', arrival_time:'', notes:'' })
    loadStops(agendaId)
  }

  const updateStatus = async (id, status) => {
    await supabase.from('transport_agenda').update({ contact_status: status }).eq('id', id)
    load()
  }

  const needsContact = agenda.filter(a => new Date(a.contact_date) <= in3days && a.contact_status === 'Por fazer')

  const filteredAgenda = agenda.filter(a => {
    const s = search.toLowerCase()
    return !s || a.carriers?.name?.toLowerCase().includes(s) || a.load_description?.toLowerCase().includes(s) || a.client_orders?.ref_number?.toLowerCase().includes(s)
  })

  if (loading) return <div className="loading"><i className="ti ti-loader-2"/>A carregar...</div>

  return (
    <div>
      {needsContact.length > 0 && (
        <div style={{background:'var(--amber-light)',border:'1px solid var(--amber)',borderRadius:'var(--radius-lg)',padding:'12px 16px',marginBottom:16,display:'flex',alignItems:'center',gap:10}}>
          <i className="ti ti-bell" style={{color:'var(--amber)',fontSize:20}}/>
          <div>
            <div style={{fontWeight:600,fontSize:13,color:'#633806'}}>⚠️ {needsContact.length} transporte(s) a confirmar nos próximos 3 dias!</div>
            <div style={{fontSize:12,color:'#854F0B',marginTop:2}}>
              {needsContact.map(a => `${a.carriers?.name} — ${new Date(a.planned_date).toLocaleDateString('pt-PT')} · ${a.carriers?.phone||''}`).join(' | ')}
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <div className="card" style={{maxWidth:580,marginBottom:16}}>
          <div className="card-header"><span className="card-title">Agendar Transporte</span></div>
          <div className="form-grid">
            <div className="form-group full"><label>Transportador *</label>
              <select value={form.carrier_id} onChange={e=>setForm({...form,carrier_id:e.target.value})}>
                <option value="">Selecionar...</option>
                {carriers.map(c=><option key={c.id} value={c.id}>{c.name} — {c.vehicle_type} ({c.plate})</option>)}
              </select>
            </div>
            <div className="form-group full"><label>Encomenda a transportar (opcional)</label>
              <select value={form.client_order_id} onChange={e=>setForm({...form,client_order_id:e.target.value})}>
                <option value="">— Selecionar encomenda —</option>
                {clientOrders.length > 0 && <optgroup label="Encomendas de clientes">
                  {clientOrders.map(o=><option key={o.id} value={`c_${o.id}`}>{o.ref_number} — {o.description?.slice(0,40)} {o.delivery_city?`→ ${o.delivery_city}`:''} [{o.status}]</option>)}
                </optgroup>}
                {supplierOrders.length > 0 && <optgroup label="Encomendas a fornecedores (material a chegar)">
                  {supplierOrders.map(o=><option key={o.id} value={`s_${o.id}`}>{o.ref_number} — {o.requisitions?.description?.slice(0,40)||o.suppliers?.name} [{o.status}]</option>)}
                </optgroup>}
              </select>
            </div>
            <div className="form-group"><label>Data de saída *</label>
              <input type="date" value={form.planned_date} onChange={e=>setForm({...form,planned_date:e.target.value})} />
            </div>
            <div className="form-group"><label>Hora de saída</label>
              <input type="time" value={form.departure_time} onChange={e=>setForm({...form,departure_time:e.target.value})} />
            </div>
            <div className="form-group full"><label>Descrição da carga</label>
              <input value={form.load_description} onChange={e=>setForm({...form,load_description:e.target.value})} placeholder="Deixa vazio para preencher automaticamente" />
            </div>
            <div className="form-group full"><label>Notas</label>
              <textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} />
            </div>
          </div>
          <div style={{background:'var(--bg)',borderRadius:'var(--radius)',padding:'8px 12px',fontSize:12,color:'var(--text-muted)',marginTop:4}}>
            <i className="ti ti-info-circle" style={{marginRight:6}}/>Alerta automático 3 dias antes para contactar o transportador.
          </div>
          <div className="form-actions">
            <button className="btn" onClick={()=>setShowForm(false)}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving?'A guardar...':'Agendar'}</button>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <span className="card-title">Agenda de Transportes</span>
          <button className="btn btn-primary" onClick={()=>setShowForm(true)}><i className="ti ti-plus"/>Agendar</button>
        </div>
        <div style={{display:'flex',gap:8,marginBottom:12}}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Pesquisar transportador, carga..." style={{flex:1,border:'0.5px solid var(--border-hover)',borderRadius:'var(--radius)',padding:'7px 10px',fontSize:13,background:'var(--bg-card)',color:'var(--text)',fontFamily:'inherit'}} />
          {search && <button className="btn" onClick={()=>setSearch('')}>✕</button>}
        </div>
        {filteredAgenda.length === 0
          ? <div className="empty">Sem transportes agendados.</div>
          : filteredAgenda.map(a => {
              const urgent = new Date(a.contact_date) <= in3days && a.contact_status === 'Por fazer'
              const agendaStops = stops[a.id] || []
              return (
                <div key={a.id} style={{border:`0.5px solid ${urgent?'var(--amber)':'var(--border)'}`,borderRadius:'var(--radius)',padding:'12px',marginBottom:10,background:urgent?'rgba(186,117,23,0.03)':''}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',flexWrap:'wrap',gap:8}}>
                    <div>
                      <div style={{fontWeight:600,fontSize:13}}>
                        {a.carriers?.name}
                        <span style={{fontWeight:400,color:'var(--text-muted)',fontSize:12,marginLeft:6}}>— {a.carriers?.vehicle_type} {a.carriers?.plate}</span>
                      </div>
                      <div style={{fontSize:12,color:'var(--text-muted)',marginTop:2}}>
                        📅 {new Date(a.planned_date).toLocaleDateString('pt-PT')}
                        {a.departure_time ? ` às ${a.departure_time.slice(0,5)}` : ''}
                        {urgent && <span style={{color:'var(--amber)',fontWeight:600,marginLeft:8}}>⚠️ Contactar até {new Date(a.contact_date).toLocaleDateString('pt-PT')}</span>}
                      </div>
                      {a.load_description && <div style={{fontSize:12,marginTop:4,color:'var(--text-muted)'}}><i className="ti ti-package" style={{marginRight:4}}/>{a.load_description}</div>}
                      {a.client_orders && <div style={{fontSize:11,marginTop:2,color:'var(--blue)'}}><i className="ti ti-link" style={{marginRight:4}}/>{a.client_orders.ref_number} — {a.client_orders.delivery_city}</div>}
                    </div>
                    <div style={{display:'flex',gap:6,alignItems:'center',flexWrap:'wrap'}}>
                      <span className={`badge ${CONTACT_STATUS_CLASS[a.contact_status]||''}`}>{a.contact_status}</span>
                      {a.contact_status==='Por fazer' && <button className="btn btn-sm" onClick={()=>updateStatus(a.id,'Contactado')}>Contactado</button>}
                      {a.contact_status==='Contactado' && <button className="btn btn-sm btn-primary" onClick={()=>updateStatus(a.id,'Confirmado')}>Confirmar</button>}
                      <button className="btn btn-sm" onClick={()=>{setShowStops(showStops===a.id?null:a.id);if(!stops[a.id])loadStops(a.id)}}>
                        <i className="ti ti-map"/>Trajeto
                      </button>
                      <button className="btn btn-sm" style={{color:'var(--red)'}} onClick={()=>handleDelete(a.id)}>
                        <i className="ti ti-trash"/>
                      </button>
                    </div>
                  </div>

                  {showStops === a.id && (
                    <div style={{marginTop:12,paddingTop:12,borderTop:'0.5px solid var(--border)'}}>
                      <div style={{fontWeight:500,fontSize:12,marginBottom:8}}>Trajeto / Paragens:</div>
                      {agendaStops.length > 0 && (
                        <div style={{marginBottom:10}}>
                          {agendaStops.map((s,i) => (
                            <div key={s.id} style={{display:'flex',alignItems:'center',gap:8,padding:'6px 0',borderBottom:'0.5px solid var(--border)'}}>
                              <div style={{width:22,height:22,borderRadius:'50%',background:STOP_COLORS[s.stop_type]||'var(--blue)',color:'white',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:600,flexShrink:0}}>{i+1}</div>
                              <div style={{flex:1}}>
                                <div style={{fontSize:13,fontWeight:500}}>{s.address}{s.city?`, ${s.city}`:''}</div>
                                <div style={{fontSize:11,color:'var(--text-muted)'}}>{s.stop_type} {s.arrival_time?`· ${s.arrival_time.slice(0,5)}`:''} {s.carriers?.name?`· ${s.carriers.name}`:''}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      <div style={{background:'var(--bg)',borderRadius:'var(--radius)',padding:'10px'}}>
                        <div style={{fontSize:12,fontWeight:500,marginBottom:8}}>Adicionar paragem:</div>
                        <div className="form-grid" style={{gap:8}}>
                          <div className="form-group"><label>Tipo</label>
                            <select value={stopForm.stop_type} onChange={e=>setStopForm({...stopForm,stop_type:e.target.value})}>
                              {['Recolha','Passagem','Entrega final'].map(t=><option key={t}>{t}</option>)}
                            </select>
                          </div>
                          <div className="form-group"><label>Transportador (opcional)</label>
                            <select value={stopForm.carrier_id} onChange={e=>setStopForm({...stopForm,carrier_id:e.target.value})}>
                              <option value="">— mesmo —</option>
                              {carriers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                          </div>
                          <div className="form-group full"><label>Morada *</label>
                            <input value={stopForm.address} onChange={e=>setStopForm({...stopForm,address:e.target.value})} placeholder="Morada completa" />
                          </div>
                          <div className="form-group"><label>Cidade</label>
                            <input value={stopForm.city} onChange={e=>setStopForm({...stopForm,city:e.target.value})} />
                          </div>
                          <div className="form-group"><label>Hora chegada</label>
                            <input type="time" value={stopForm.arrival_time} onChange={e=>setStopForm({...stopForm,arrival_time:e.target.value})} />
                          </div>
                        </div>
                        <button className="btn btn-primary btn-sm" style={{marginTop:8}} onClick={()=>addStop(a.id)} disabled={!stopForm.address}>
                          Adicionar paragem
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })
        }
      </div>

      <div className="card">
        <div className="card-header"><span className="card-title">Transportadores</span></div>
        <div className="transport-grid">
          {carriers.map(c => (
            <div key={c.id} className="transport-card">
              <div style={{fontWeight:600,marginBottom:6}}>{c.name}</div>
              <div className="tc-row"><span style={{color:'var(--text-muted)'}}>Veículo</span><span>{c.vehicle_type} · {c.plate}</span></div>
              <div className="tc-row"><span style={{color:'var(--text-muted)'}}>Rotas</span><span>{c.routes||'—'}</span></div>
              <div className="tc-row"><span style={{color:'var(--text-muted)'}}>Carga máx.</span><span>{c.max_load_kg?`${c.max_load_kg} kg`:'—'}</span></div>
              <div className="tc-row"><span style={{color:'var(--text-muted)'}}>Telefone</span><span style={{color:'var(--blue)'}}>{c.phone||'—'}</span></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
