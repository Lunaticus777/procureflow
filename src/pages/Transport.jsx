import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Transport() {
  const [carriers, setCarriers] = useState([])
  const [schedules, setSchedules] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name:'', vehicle_type:'Furgão', plate:'', phone:'', max_load_kg:'', routes:'' })
  const [saving, setSaving] = useState(false)
  const today = new Date().toISOString().split('T')[0]

  const load = async () => {
    const [{ data: c }, { data: s }] = await Promise.all([
      supabase.from('carriers').select('*').eq('active',true).order('name'),
      supabase.from('carrier_schedules').select('*, carriers(name)').eq('date', today),
    ])
    setCarriers(c||[])
    setSchedules(s||[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const getSchedule = (carrierId) => schedules.find(s=>s.carrier_id===carrierId)

  const handleSave = async () => {
    if (!form.name) return
    setSaving(true)
    await supabase.from('carriers').insert({ ...form, max_load_kg: parseFloat(form.max_load_kg)||null })
    setForm({ name:'', vehicle_type:'Furgão', plate:'', phone:'', max_load_kg:'', routes:'' })
    setShowForm(false)
    setSaving(false)
    load()
  }

  const loadPct = (s) => {
    if (!s || !s.current_load) return 0
    const carrier = carriers.find(c=>c.id===s.carrier_id)
    if (!carrier?.max_load_kg) return 0
    return Math.round((s.current_load / carrier.max_load_kg) * 100)
  }

  if (loading) return <div className="loading"><i className="ti ti-loader-2"/>A carregar...</div>

  return (
    <div>
      {showForm && (
        <div className="card" style={{maxWidth:560,marginBottom:16}}>
          <div className="card-header"><span className="card-title">Novo Transportador</span></div>
          <div className="form-grid">
            <div className="form-group full"><label>Nome *</label><input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Nome do motorista" /></div>
            <div className="form-group"><label>Tipo de veículo</label>
              <select value={form.vehicle_type} onChange={e=>setForm({...form,vehicle_type:e.target.value})}>
                {['Furgão','Carrinha','Camioneta','Camião'].map(t=><option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-group"><label>Matrícula</label><input value={form.plate} onChange={e=>setForm({...form,plate:e.target.value})} placeholder="12-AB-34" /></div>
            <div className="form-group"><label>Telemóvel</label><input value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} placeholder="+351 9XX XXX XXX" /></div>
            <div className="form-group"><label>Carga máx. (kg)</label><input type="number" value={form.max_load_kg} onChange={e=>setForm({...form,max_load_kg:e.target.value})} /></div>
            <div className="form-group full"><label>Rotas habituais</label><input value={form.routes} onChange={e=>setForm({...form,routes:e.target.value})} placeholder="Lisboa / Setúbal" /></div>
          </div>
          <div className="form-actions">
            <button className="btn" onClick={()=>setShowForm(false)}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving?'A guardar...':'Guardar'}</button>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <div>
            <span className="card-title">Transportadores — {new Date().toLocaleDateString('pt-PT',{weekday:'long',day:'numeric',month:'long'})}</span>
          </div>
          <button className="btn btn-primary" onClick={()=>setShowForm(true)}><i className="ti ti-plus"/>Novo</button>
        </div>

        {carriers.length===0
          ? <div className="empty">Sem transportadores. Adiciona o primeiro!</div>
          : <div className="transport-grid">
              {carriers.map(c=>{
                const sch = getSchedule(c.id)
                const pct = loadPct(sch)
                const avail = !sch || sch.status === 'Disponível'
                return (
                  <div key={c.id} className="transport-card">
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:10}}>
                      <div>
                        <div style={{fontWeight:600,fontSize:14}}><i className="ti ti-truck" style={{fontSize:14,verticalAlign:'-2px',marginRight:4}}/>{c.name}</div>
                        <div style={{fontSize:11,color:'var(--text-muted)',marginTop:2}}>{c.vehicle_type} · {c.plate}</div>
                      </div>
                      <span className={`badge ${avail?'badge-approved':'badge-critical'}`}>{avail?'Disponível':'Ocupado'}</span>
                    </div>
                    <div className="tc-row"><span style={{color:'var(--text-muted)'}}>Rota</span><span>{c.routes||'—'}</span></div>
                    <div className="tc-row"><span style={{color:'var(--text-muted)'}}>Carga máx.</span><span>{c.max_load_kg ? `${c.max_load_kg} kg` : '—'}</span></div>
                    {sch && <>
                      <div className="tc-row"><span style={{color:'var(--text-muted)'}}>Saída</span><span>{sch.depart_time?.slice(0,5)||'—'}</span></div>
                      <div className="tc-row"><span style={{color:'var(--text-muted)'}}>Regresso</span><span>{sch.return_time?.slice(0,5)||'—'}</span></div>
                      {c.max_load_kg && <div style={{marginTop:8}}>
                        <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:'var(--text-muted)',marginBottom:3}}>
                          <span>Carga</span><span>{sch.current_load||0} / {c.max_load_kg} kg ({pct}%)</span>
                        </div>
                        <div className="stock-bar">
                          <div className={`stock-fill ${pct>80?'fill-red':pct>50?'fill-amber':'fill-green'}`} style={{width:`${pct}%`}}/>
                        </div>
                      </div>}
                    </>}
                    <div className="tc-row" style={{marginTop:8}}><span style={{color:'var(--text-muted)'}}>Contacto</span><span>{c.phone||'—'}</span></div>
                  </div>
                )
              })}
            </div>
        }
      </div>
    </div>
  )
}
