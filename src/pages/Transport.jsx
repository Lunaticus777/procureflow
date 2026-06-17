import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useRole } from '../hooks/useRole'
import { logActivity } from '../hooks/useActivity'

const PT_DISTRICTS = ['Aveiro','Beja','Braga','Bragança','Castelo Branco','Coimbra','Évora','Faro','Guarda','Leiria','Lisboa','Portalegre','Porto','Santarém','Setúbal','Viana do Castelo','Vila Real','Viseu','Açores','Madeira']
const EU_COUNTRIES = ['Portugal','Espanha','França','Alemanha','Itália','Bélgica','Países Baixos','Luxemburgo','Suíça','Reino Unido','Irlanda','Áustria','Polónia','Outro']

export default function Transport() {
  const { isAdmin } = useRole()
  const [carriers, setCarriers] = useState([])
  const [selected, setSelected] = useState(null)
  const [schedules, setSchedules] = useState([])
  const [history, setHistory] = useState([])
  const [zones, setZones] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editCarrier, setEditCarrier] = useState(null)
  const [showScheduleForm, setShowScheduleForm] = useState(false)
  const [showZoneForm, setShowZoneForm] = useState(false)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('')

  const EMPTY_FORM = { name:'', vehicle_type:'Furgão', plate:'', phone:'', mobile:'', email:'', max_load_kg:'', notes:'', price_type:'Fixo', base_price:'', price_per_km:'', price_per_kg:'', currency:'EUR', international:false, countries_served:'', address:'', city:'', postal_code:'', country:'Portugal' }
  const [form, setForm] = useState(EMPTY_FORM)
  const [zoneForm, setZoneForm] = useState({ zone_type:'Nacional', country:'', region:'', city:'', notes:'' })
  const [schedForm, setSchedForm] = useState({ date:'', depart_time:'', return_time:'', current_load:'0', status:'Disponível', notes:'' })
  const [saving, setSaving] = useState(false)

  const today = new Date().toISOString().split('T')[0]

  const load = async () => {
    const { data } = await supabase.from('carriers').select('*').eq('active', true).order('name')
    setCarriers(data || [])
    setLoading(false)
  }

  const loadDetail = async (c) => {
    const [{ data: sch }, { data: agenda }, { data: z }] = await Promise.all([
      supabase.from('carrier_schedules').select('*').eq('carrier_id', c.id).gte('date', today).order('date').limit(10),
      supabase.from('transport_agenda').select('*, client_orders(ref_number,delivery_city)').eq('carrier_id', c.id).order('planned_date',{ascending:false}).limit(10),
      supabase.from('carrier_zones').select('*').eq('carrier_id', c.id).order('zone_type').order('country').order('region'),
    ])
    setSchedules(sch || [])
    setHistory(agenda || [])
    setZones(z || [])
  }

  useEffect(() => { load() }, [])

  const selectCarrier = (c) => { setSelected(c); loadDetail(c) }

  const openEdit = (c) => {
    setEditCarrier(c)
    setForm({ name:c.name, vehicle_type:c.vehicle_type||'Furgão', plate:c.plate||'', phone:c.phone||'', mobile:c.mobile||'', email:c.email||'', max_load_kg:c.max_load_kg||'', notes:c.notes||'', price_type:c.price_type||'Fixo', base_price:c.base_price||'', price_per_km:c.price_per_km||'', price_per_kg:c.price_per_kg||'', currency:c.currency||'EUR', international:c.international||false, countries_served:c.countries_served||'', address:c.address||'', city:c.city||'', postal_code:c.postal_code||'', country:c.country||'Portugal' })
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.name) return
    setSaving(true)
    const payload = { ...form, max_load_kg: form.max_load_kg ? parseFloat(form.max_load_kg) : null, base_price: form.base_price ? parseFloat(form.base_price) : null, price_per_km: form.price_per_km ? parseFloat(form.price_per_km) : null, price_per_kg: form.price_per_kg ? parseFloat(form.price_per_kg) : null }
    if (editCarrier) {
      await supabase.from('carriers').update(payload).eq('id', editCarrier.id)
      await logActivity({ action:'updated', entityType:'transport', entityRef:editCarrier.name, description:`actualizou transportador ${editCarrier.name}` })
      setSelected({...editCarrier,...payload})
    } else {
      const { error } = await supabase.from('carriers').insert(payload)
      if (error) { alert('Erro: ' + error.message); setSaving(false); return }
      await logActivity({ action:'created', entityType:'transport', entityRef:form.name, description:`adicionou transportador ${form.name}` })
    }
    setForm(EMPTY_FORM)
    setShowForm(false); setEditCarrier(null); setSaving(false); load()
  }

  const handleDelete = async (id) => {
    if (!confirm('Arquivar este transportador?')) return
    const carrier = carriers.find(c=>c.id===id)
    await supabase.from('carriers').update({ active: false }).eq('id', id)
    await logActivity({ action:'deleted', entityType:'transport', entityRef:carrier?.name, description:`arquivou transportador ${carrier?.name}` })
    setSelected(null); load()
  }

  const handleZoneSave = async () => {
    if (!zoneForm.zone_type) return
    await supabase.from('carrier_zones').insert({ ...zoneForm, carrier_id: selected.id, country: zoneForm.zone_type==='Nacional'?'Portugal':zoneForm.country })
    setZoneForm({ zone_type:'Nacional', country:'', region:'', city:'', notes:'' })
    setShowZoneForm(false)
    loadDetail(selected)
  }

  const handleZoneDelete = async (id) => {
    await supabase.from('carrier_zones').delete().eq('id', id)
    loadDetail(selected)
  }

  const handleScheduleSave = async () => {
    if (!schedForm.date) return
    setSaving(true)
    await supabase.from('carrier_schedules').insert({ ...schedForm, carrier_id: selected.id, current_load: parseFloat(schedForm.current_load)||0 })
    setSchedForm({ date:'', depart_time:'', return_time:'', current_load:'0', status:'Disponível', notes:'' })
    setShowScheduleForm(false); setSaving(false)
    loadDetail(selected)
  }

  const todaySchedule = schedules.find(s => s.date === today)
  const loadPct = todaySchedule && selected?.max_load_kg ? Math.min(100, Math.round((parseFloat(todaySchedule.current_load||0)/parseFloat(selected.max_load_kg))*100)) : 0

  // Group zones
  const nationalZones = zones.filter(z => z.zone_type === 'Nacional')
  const intlZones = zones.filter(z => z.zone_type === 'Internacional')

  const filtered = carriers.filter(c => {
    const s = search.toLowerCase()
    const matchS = !s || c.name?.toLowerCase().includes(s) || c.routes?.toLowerCase().includes(s) || c.plate?.toLowerCase().includes(s) || c.phone?.toLowerCase().includes(s) || c.mobile?.toLowerCase().includes(s) || c.vehicle_type?.toLowerCase().includes(s) || c.city?.toLowerCase().includes(s)
    const matchT = !filterType || c.vehicle_type === filterType
    return matchS && matchT
  })

  if (loading) return <div className="loading"><i className="ti ti-loader-2"/>A carregar...</div>

  return (
    <div>
      {showForm && (
        <div className="card" style={{maxWidth:680,marginBottom:16}}>
          <div className="card-header">
            <span className="card-title">{editCarrier?'Editar Transportador':'Novo Transportador'}</span>
            <button className="btn btn-sm" onClick={()=>{setShowForm(false);setEditCarrier(null)}}><i className="ti ti-x"/></button>
          </div>

          {/* Informação básica */}
          <div style={{fontSize:12,fontWeight:600,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:8}}>Identificação</div>
          <div className="form-grid" style={{marginBottom:14}}>
            <div className="form-group full"><label>Nome *</label><input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Nome do motorista ou empresa" /></div>
            <div className="form-group"><label>Tipo de veículo</label>
              <select value={form.vehicle_type} onChange={e=>setForm({...form,vehicle_type:e.target.value})}>
                {['Furgão','Carrinha','Camioneta','Camião','Moto'].map(t=><option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-group"><label>Matrícula</label><input value={form.plate} onChange={e=>setForm({...form,plate:e.target.value})} placeholder="AB-123-CD" /></div>
            <div className="form-group"><label>Carga máx. (kg)</label><input type="number" value={form.max_load_kg} onChange={e=>setForm({...form,max_load_kg:e.target.value})} /></div>
          </div>

          {/* Contactos */}
          <div style={{fontSize:12,fontWeight:600,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:8}}>Contactos</div>
          <div className="form-grid" style={{marginBottom:14}}>
            <div className="form-group"><label>Telefone</label><input value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} /></div>
            <div className="form-group"><label>Telemóvel</label><input value={form.mobile} onChange={e=>setForm({...form,mobile:e.target.value})} /></div>
            <div className="form-group full"><label>Email</label><input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} /></div>
          </div>

          {/* Morada */}
          <div style={{fontSize:12,fontWeight:600,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:8}}>Morada</div>
          <div className="form-grid" style={{marginBottom:14}}>
            <div className="form-group full"><label>Morada</label><input value={form.address} onChange={e=>setForm({...form,address:e.target.value})} placeholder="Rua, nº, andar..." /></div>
            <div className="form-group"><label>Código Postal</label><input value={form.postal_code} onChange={e=>setForm({...form,postal_code:e.target.value})} placeholder="0000-000" /></div>
            <div className="form-group"><label>Cidade</label><input value={form.city} onChange={e=>setForm({...form,city:e.target.value})} /></div>
            <div className="form-group"><label>País</label>
              <select value={form.country} onChange={e=>setForm({...form,country:e.target.value})}>
                {EU_COUNTRIES.map(c=><option key={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* Preços */}
          <div style={{fontSize:12,fontWeight:600,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:8}}>Preços</div>
          <div className="form-grid" style={{marginBottom:14}}>
            <div className="form-group"><label>Tipo de preço</label>
              <select value={form.price_type} onChange={e=>setForm({...form,price_type:e.target.value})}>
                {['Fixo','Por km','Por kg','Negociável','Incluído na encomenda'].map(t=><option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-group"><label>Moeda</label>
              <select value={form.currency} onChange={e=>setForm({...form,currency:e.target.value})}>
                {['EUR','CHF','GBP','USD'].map(c=><option key={c}>{c}</option>)}
              </select>
            </div>
            {(form.price_type==='Fixo'||form.price_type==='Negociável') && <div className="form-group"><label>Preço base ({form.currency})</label><input type="number" step="0.01" value={form.base_price} onChange={e=>setForm({...form,base_price:e.target.value})} /></div>}
            {form.price_type==='Por km' && <div className="form-group"><label>€ por km</label><input type="number" step="0.01" value={form.price_per_km} onChange={e=>setForm({...form,price_per_km:e.target.value})} /></div>}
            {form.price_type==='Por kg' && <div className="form-group"><label>€ por kg</label><input type="number" step="0.01" value={form.price_per_kg} onChange={e=>setForm({...form,price_per_kg:e.target.value})} /></div>}
            <div className="form-group full" style={{flexDirection:'row',alignItems:'center',gap:8}}>
              <input type="checkbox" checked={form.international} onChange={e=>setForm({...form,international:e.target.checked})} id="intl_check" />
              <label htmlFor="intl_check" style={{margin:0,cursor:'pointer',fontWeight:500}}>✈️ Faz transportes internacionais</label>
            </div>
          </div>

          <div className="form-group full" style={{marginBottom:14}}><label>Notas</label><textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} /></div>

          <div className="form-actions">
            <button className="btn" onClick={()=>{setShowForm(false);setEditCarrier(null)}}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving?'A guardar...':editCarrier?'Guardar':'Criar transportador'}</button>
          </div>
        </div>
      )}

      <div style={{display:'flex',gap:16,alignItems:'flex-start',height:'calc(100vh - 140px)'}}>
        {/* Lista */}
        <div style={{width:260,flexShrink:0,overflowY:'auto',height:'100%'}}>
          <div className="card">
            <div className="card-header">
              <span className="card-title">Transportadores ({carriers.length})</span>
              <button className="btn btn-primary" onClick={()=>{setShowForm(true);setEditCarrier(null);setForm(EMPTY_FORM)}}><i className="ti ti-plus"/>Novo</button>
            </div>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Nome, matrícula, cidade..." style={{width:'100%',marginBottom:6,border:'0.5px solid var(--border-hover)',borderRadius:'var(--radius)',padding:'6px 10px',fontSize:13,background:'var(--bg-card)',color:'var(--text)',fontFamily:'inherit'}} />
            <select value={filterType} onChange={e=>setFilterType(e.target.value)} style={{width:'100%',marginBottom:10,border:'0.5px solid var(--border-hover)',borderRadius:'var(--radius)',padding:'6px 10px',fontSize:13,background:'var(--bg-card)',color:'var(--text)',fontFamily:'inherit'}}>
              <option value="">Todos os tipos</option>
              {['Furgão','Carrinha','Camioneta','Camião','Moto'].map(t=><option key={t}>{t}</option>)}
            </select>
            {filtered.length===0 ? <div className="empty">Sem transportadores.</div>
              : <div style={{display:'flex',flexDirection:'column',gap:6}}>
                  {filtered.map(c=>(
                    <div key={c.id} onClick={()=>selectCarrier(c)}
                      style={{border:`1px solid ${selected?.id===c.id?'var(--blue)':'var(--border)'}`,borderLeft:`4px solid ${selected?.id===c.id?'var(--blue)':c.international?'var(--green)':'var(--border)'}`,borderRadius:'var(--radius)',padding:'10px 12px',cursor:'pointer',background:selected?.id===c.id?'var(--blue-light)':'var(--bg-card)'}}>
                      <div style={{fontWeight:600,fontSize:13}}>{c.name}</div>
                      <div style={{fontSize:11,color:'var(--text-muted)',marginTop:2}}>{c.vehicle_type} · {c.plate||'—'}</div>
                      {c.city && <div style={{fontSize:11,color:'var(--text-muted)'}}><i className="ti ti-map-pin" style={{marginRight:3}}/>{c.city}</div>}
                      {c.phone && <div style={{fontSize:11,color:'var(--blue)',marginTop:2}}>{c.phone}</div>}
                      {c.international && <div style={{fontSize:10,color:'var(--green)',marginTop:2,fontWeight:500}}>✈️ Internacional</div>}
                    </div>
                  ))}
                </div>
            }
          </div>
        </div>

        {/* Ficha */}
        {selected && (
          <div style={{flex:1,minWidth:0,overflowY:'auto',height:'100%'}}>
            {/* Header */}
            <div className="card" style={{marginBottom:12}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:12,marginBottom:14}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:12,color:'var(--text-muted)',marginBottom:2}}>{selected.vehicle_type} · {selected.plate||'Sem matrícula'}</div>
                  <div style={{fontSize:20,fontWeight:700,marginBottom:6}}>{selected.name}</div>
                  <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                    {todaySchedule
                      ? <span className={`badge ${todaySchedule.status==='Disponível'?'badge-approved':'badge-critical'}`}>{todaySchedule.status} hoje</span>
                      : <span className="badge badge-pending">Sem agenda hoje</span>
                    }
                    {selected.international && <span style={{fontSize:11,background:'var(--green-light)',color:'var(--green)',padding:'2px 8px',borderRadius:10,fontWeight:500}}>✈️ Internacional</span>}
                  </div>
                </div>
                <div style={{display:'flex',gap:6,flexShrink:0}}>
                  <button className="btn btn-sm" onClick={()=>openEdit(selected)}><i className="ti ti-edit"/>Editar</button>
                  {isAdmin && <button className="btn btn-sm" style={{color:'var(--red)'}} onClick={()=>handleDelete(selected.id)}><i className="ti ti-trash"/></button>}
                  <button className="btn btn-sm" onClick={()=>setSelected(null)}><i className="ti ti-x"/></button>
                </div>
              </div>

              {/* Info grid */}
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:12}}>
                <div style={{background:'var(--bg)',borderRadius:'var(--radius)',padding:'10px 12px'}}>
                  <div style={{fontSize:10,fontWeight:600,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:6}}>📞 Contacto</div>
                  {selected.phone && <div style={{fontSize:12}}><a href={`tel:${selected.phone}`} style={{color:'var(--blue)',textDecoration:'none'}}><i className="ti ti-phone" style={{marginRight:4}}/>{selected.phone}</a></div>}
                  {selected.mobile && <div style={{fontSize:12}}><a href={`tel:${selected.mobile}`} style={{color:'var(--blue)',textDecoration:'none'}}><i className="ti ti-device-mobile" style={{marginRight:4}}/>{selected.mobile}</a></div>}
                  {selected.email && <div style={{fontSize:12}}><a href={`mailto:${selected.email}`} style={{color:'var(--blue)',textDecoration:'none'}}><i className="ti ti-mail" style={{marginRight:4}}/>{selected.email}</a></div>}
                  {!selected.phone && !selected.mobile && !selected.email && <div style={{fontSize:12,color:'var(--text-muted)'}}>Sem contacto</div>}
                </div>
                <div style={{background:'var(--bg)',borderRadius:'var(--radius)',padding:'10px 12px'}}>
                  <div style={{fontSize:10,fontWeight:600,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:6}}>📍 Morada</div>
                  {selected.address && <div style={{fontSize:12}}>{selected.address}</div>}
                  {(selected.postal_code||selected.city) && <div style={{fontSize:12,fontWeight:500}}>{selected.postal_code} {selected.city}</div>}
                  {selected.country && <div style={{fontSize:12,color:'var(--text-muted)'}}>{selected.country}</div>}
                  {!selected.address && !selected.city && <div style={{fontSize:12,color:'var(--text-muted)'}}>Sem morada</div>}
                </div>
                <div style={{background:'var(--bg)',borderRadius:'var(--radius)',padding:'10px 12px'}}>
                  <div style={{fontSize:10,fontWeight:600,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:6}}>🚛 Veículo</div>
                  <div style={{fontSize:13,fontWeight:500}}>{selected.vehicle_type}</div>
                  <div style={{fontSize:12,color:'var(--text-muted)'}}>{selected.plate||'—'}</div>
                  {selected.max_load_kg && <div style={{fontSize:12,marginTop:4}}>Carga máx: <strong>{selected.max_load_kg} kg</strong></div>}
                  {selected.base_price && <div style={{fontSize:12,marginTop:2,color:'var(--green)',fontWeight:500}}>{selected.currency} {parseFloat(selected.base_price).toLocaleString('pt-PT',{minimumFractionDigits:2})} ({selected.price_type})</div>}
                </div>
              </div>

              {/* Barra carga */}
              {todaySchedule && selected.max_load_kg && (
                <div style={{marginBottom:10}}>
                  <div style={{display:'flex',justifyContent:'space-between',fontSize:12,marginBottom:4}}>
                    <span style={{color:'var(--text-muted)'}}>Carga actual hoje</span>
                    <span style={{fontWeight:600}}>{todaySchedule.current_load||0} / {selected.max_load_kg} kg ({loadPct}%)</span>
                  </div>
                  <div style={{height:8,background:'var(--border)',borderRadius:4,overflow:'hidden'}}>
                    <div style={{height:'100%',width:`${loadPct}%`,background:loadPct>80?'var(--red)':loadPct>50?'var(--amber)':'var(--green)',borderRadius:4}}/>
                  </div>
                </div>
              )}

              {selected.notes && <div style={{padding:'8px 12px',background:'var(--amber-light)',borderRadius:'var(--radius)',fontSize:12,borderLeft:'3px solid var(--amber)',marginBottom:10}}>{selected.notes}</div>}
            </div>

            {/* Zonas de cobertura */}
            <div className="card" style={{marginBottom:12}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
                <div>
                  <div style={{fontWeight:600,fontSize:14}}>🗺️ Zonas de cobertura</div>
                  <div style={{fontSize:11,color:'var(--text-muted)',marginTop:2}}>Onde este transportador pode entregar</div>
                </div>
                <button className="btn btn-sm btn-primary" onClick={()=>setShowZoneForm(!showZoneForm)}><i className="ti ti-plus"/>Adicionar zona</button>
              </div>

              {showZoneForm && (
                <div style={{background:'var(--bg)',borderRadius:'var(--radius)',padding:'12px',marginBottom:12,border:'0.5px solid var(--border)'}}>
                  <div className="form-grid" style={{gap:8}}>
                    <div className="form-group"><label>Tipo</label>
                      <select value={zoneForm.zone_type} onChange={e=>setZoneForm({...zoneForm,zone_type:e.target.value,region:'',country:''})}>
                        <option value="Nacional">🇵🇹 Nacional</option>
                        <option value="Internacional">✈️ Internacional</option>
                      </select>
                    </div>
                    {zoneForm.zone_type==='Nacional' && (
                      <div className="form-group"><label>Distrito / Região</label>
                        <select value={zoneForm.region} onChange={e=>setZoneForm({...zoneForm,region:e.target.value})}>
                          <option value="">— Todo o país —</option>
                          {PT_DISTRICTS.map(d=><option key={d}>{d}</option>)}
                        </select>
                      </div>
                    )}
                    {zoneForm.zone_type==='Internacional' && (
                      <div className="form-group"><label>País</label>
                        <select value={zoneForm.country} onChange={e=>setZoneForm({...zoneForm,country:e.target.value})}>
                          <option value="">Selecionar...</option>
                          {EU_COUNTRIES.filter(c=>c!=='Portugal').map(c=><option key={c}>{c}</option>)}
                        </select>
                      </div>
                    )}
                    <div className="form-group"><label>Cidade específica (opcional)</label>
                      <input value={zoneForm.city} onChange={e=>setZoneForm({...zoneForm,city:e.target.value})} placeholder="Ex: Lisboa, Porto..." />
                    </div>
                    <div className="form-group full"><label>Notas</label>
                      <input value={zoneForm.notes} onChange={e=>setZoneForm({...zoneForm,notes:e.target.value})} placeholder="Ex: Apenas às 2ªs feiras, entrega até 18h..." />
                    </div>
                  </div>
                  <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:8}}>
                    <button className="btn btn-sm" onClick={()=>setShowZoneForm(false)}>Cancelar</button>
                    <button className="btn btn-primary btn-sm" onClick={handleZoneSave}>Guardar zona</button>
                  </div>
                </div>
              )}

              {zones.length===0
                ? <div className="empty">Sem zonas definidas. Adiciona onde este transportador pode entregar!</div>
                : <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                    {/* Nacional */}
                    {nationalZones.length>0 && (
                      <div style={{flex:1,minWidth:200}}>
                        <div style={{fontSize:11,fontWeight:700,color:'var(--text-muted)',marginBottom:6}}>🇵🇹 NACIONAL</div>
                        {nationalZones.map(z=>(
                          <div key={z.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'6px 8px',background:'var(--bg)',borderRadius:'var(--radius)',marginBottom:4,fontSize:12}}>
                            <div>
                              <span style={{fontWeight:500}}>{z.region||'Todo o país'}</span>
                              {z.city && <span style={{color:'var(--text-muted)',marginLeft:6}}>· {z.city}</span>}
                              {z.notes && <div style={{fontSize:11,color:'var(--text-muted)',fontStyle:'italic'}}>{z.notes}</div>}
                            </div>
                            <button onClick={()=>handleZoneDelete(z.id)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--red)',fontSize:14,marginLeft:6}}>✕</button>
                          </div>
                        ))}
                      </div>
                    )}
                    {/* Internacional */}
                    {intlZones.length>0 && (
                      <div style={{flex:1,minWidth:200}}>
                        <div style={{fontSize:11,fontWeight:700,color:'var(--text-muted)',marginBottom:6}}>✈️ INTERNACIONAL</div>
                        {intlZones.map(z=>(
                          <div key={z.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'6px 8px',background:'var(--green-light)',borderRadius:'var(--radius)',marginBottom:4,fontSize:12}}>
                            <div>
                              <span style={{fontWeight:500,color:'var(--green)'}}>{z.country}</span>
                              {z.city && <span style={{color:'var(--text-muted)',marginLeft:6}}>· {z.city}</span>}
                              {z.notes && <div style={{fontSize:11,color:'var(--text-muted)',fontStyle:'italic'}}>{z.notes}</div>}
                            </div>
                            <button onClick={()=>handleZoneDelete(z.id)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--red)',fontSize:14,marginLeft:6}}>✕</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
              }
            </div>

            {/* Agenda */}
            <div className="card" style={{marginBottom:12}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
                <div style={{fontWeight:600,fontSize:14}}>📅 Disponibilidade</div>
                <button className="btn btn-sm" onClick={()=>setShowScheduleForm(!showScheduleForm)}><i className="ti ti-calendar-plus"/>Adicionar</button>
              </div>
              {showScheduleForm && (
                <div style={{background:'var(--bg)',borderRadius:'var(--radius)',padding:'10px',marginBottom:10}}>
                  <div className="form-grid" style={{gap:8}}>
                    <div className="form-group"><label>Data *</label><input type="date" value={schedForm.date} onChange={e=>setSchedForm({...schedForm,date:e.target.value})} /></div>
                    <div className="form-group"><label>Estado</label>
                      <select value={schedForm.status} onChange={e=>setSchedForm({...schedForm,status:e.target.value})}>
                        {['Disponível','Ocupado','Folga','Férias'].map(s=><option key={s}>{s}</option>)}
                      </select>
                    </div>
                    <div className="form-group"><label>Hora saída</label><input type="time" value={schedForm.depart_time} onChange={e=>setSchedForm({...schedForm,depart_time:e.target.value})} /></div>
                    <div className="form-group"><label>Hora regresso</label><input type="time" value={schedForm.return_time} onChange={e=>setSchedForm({...schedForm,return_time:e.target.value})} /></div>
                    <div className="form-group"><label>Carga actual (kg)</label><input type="number" value={schedForm.current_load} onChange={e=>setSchedForm({...schedForm,current_load:e.target.value})} /></div>
                    <div className="form-group"><label>Notas</label><input value={schedForm.notes} onChange={e=>setSchedForm({...schedForm,notes:e.target.value})} /></div>
                  </div>
                  <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:8}}>
                    <button className="btn btn-sm" onClick={()=>setShowScheduleForm(false)}>Cancelar</button>
                    <button className="btn btn-primary btn-sm" onClick={handleScheduleSave} disabled={saving}>Guardar</button>
                  </div>
                </div>
              )}
              {schedules.length===0 ? <div className="empty" style={{padding:'10px 0'}}>Sem agenda.</div>
                : <table>
                    <thead><tr><th>Data</th><th>Saída</th><th>Regresso</th><th>Carga</th><th>Estado</th><th>Notas</th></tr></thead>
                    <tbody>
                      {schedules.map(s=>(
                        <tr key={s.id} style={{background:s.date===today?'var(--blue-light)':''}}>
                          <td style={{fontWeight:s.date===today?700:400}}>{new Date(s.date).toLocaleDateString('pt-PT')}{s.date===today&&<span style={{color:'var(--blue)',fontSize:10,marginLeft:4}}>HOJE</span>}</td>
                          <td>{s.depart_time?.slice(0,5)||'—'}</td>
                          <td>{s.return_time?.slice(0,5)||'—'}</td>
                          <td>{s.current_load||0} kg</td>
                          <td><span className={`badge ${s.status==='Disponível'?'badge-approved':s.status==='Ocupado'?'badge-critical':'badge-pending'}`}>{s.status}</span></td>
                          <td style={{fontSize:11,color:'var(--text-muted)'}}>{s.notes||'—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
              }
            </div>

            {/* Histórico */}
            <div className="card">
              <div style={{fontWeight:600,fontSize:14,marginBottom:12}}>🚚 Histórico de transportes</div>
              {history.length===0 ? <div className="empty">Sem transportes.</div>
                : history.map(t=>(
                    <div key={t.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0',borderBottom:'0.5px solid var(--border)',fontSize:13}}>
                      <div>
                        <div style={{fontWeight:500}}>{new Date(t.planned_date).toLocaleDateString('pt-PT')} {t.departure_time?`às ${t.departure_time.slice(0,5)}`:''}</div>
                        <div style={{fontSize:12,color:'var(--text-muted)',marginTop:2}}>
                          {t.load_description||'—'}
                          {t.client_orders && ` · ${t.client_orders.ref_number} → ${t.client_orders.delivery_city||''}`}
                        </div>
                      </div>
                      <span className={`badge ${{
                        'Por fazer':'badge-pending','Contactado':'badge-quotation',
                        'Confirmado':'badge-approved','Recusado':'badge-cancelled'
                      }[t.contact_status]||''}`}>{t.contact_status}</span>
                    </div>
                  ))
              }
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
