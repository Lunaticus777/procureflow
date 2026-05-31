import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function TransportAgenda() {
  const [agenda, setAgenda] = useState([])
  const [carriers, setCarriers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ carrier_id:'', planned_date:'', load_description:'', departure_time:'', arrival_time:'', notes:'' })
  const [saving, setSaving] = useState(false)

  const today = new Date()
  const in3days = new Date(today); in3days.setDate(today.getDate() + 3)
  const in7days = new Date(today); in7days.setDate(today.getDate() + 7)

  const load = async () => {
    const [{ data: ag }, { data: ca }] = await Promise.all([
      supabase.from('transport_agenda')
        .select('*, carriers(name, vehicle_type, phone, plate), employees(full_name)')
        .gte('planned_date', today.toISOString().split('T')[0])
        .order('planned_date'),
      supabase.from('carriers').select('*').eq('active', true).order('name'),
    ])
    setAgenda(ag || [])
    setCarriers(ca || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleSave = async () => {
    if (!form.carrier_id || !form.planned_date) return
    setSaving(true)
    const contactDate = new Date(form.planned_date)
    contactDate.setDate(contactDate.getDate() - 3)
    await supabase.from('transport_agenda').insert({
      ...form,
      contact_date: contactDate.toISOString().split('T')[0],
      contact_status: 'Por fazer',
    })
    setForm({ carrier_id:'', planned_date:'', load_description:'', departure_time:'', arrival_time:'', notes:'' })
    setShowForm(false)
    setSaving(false)
    load()
  }

  const updateStatus = async (id, status) => {
    await supabase.from('transport_agenda').update({ contact_status: status }).eq('id', id)
    load()
  }

  const statusClass = { 'Por fazer':'badge-pending', 'Contactado':'badge-quotation', 'Confirmado':'badge-approved', 'Recusado':'badge-cancelled' }

  const needsContact = agenda.filter(a => {
    const cd = new Date(a.contact_date)
    return cd <= in3days && a.contact_status === 'Por fazer'
  })

  if (loading) return <div className="loading"><i className="ti ti-loader-2"/>A carregar...</div>

  return (
    <div>
      {needsContact.length > 0 && (
        <div style={{background:'var(--amber-light)',border:'1px solid var(--amber)',borderRadius:'var(--radius-lg)',padding:'12px 16px',marginBottom:16,display:'flex',alignItems:'center',gap:10}}>
          <i className="ti ti-bell" style={{color:'var(--amber)',fontSize:18}}/>
          <div>
            <div style={{fontWeight:600,fontSize:13,color:'#633806'}}>⚠️ {needsContact.length} transporte(s) a confirmar nos próximos 3 dias!</div>
            <div style={{fontSize:12,color:'#854F0B',marginTop:2}}>Telefona aos transportadores antes que seja tarde.</div>
          </div>
        </div>
      )}

      {showForm && (
        <div className="card" style={{maxWidth:560,marginBottom:16}}>
          <div className="card-header"><span className="card-title">Agendar Transporte</span></div>
          <div className="form-grid">
            <div className="form-group full"><label>Transportador *</label>
              <select value={form.carrier_id} onChange={e=>setForm({...form,carrier_id:e.target.value})}>
                <option value="">Selecionar...</option>
                {carriers.map(c=><option key={c.id} value={c.id}>{c.name} — {c.vehicle_type}</option>)}
              </select>
            </div>
            <div className="form-group"><label>Data de saída *</label>
              <input type="date" value={form.planned_date} onChange={e=>setForm({...form,planned_date:e.target.value})} />
            </div>
            <div className="form-group"><label>Hora de saída</label>
              <input type="time" value={form.departure_time} onChange={e=>setForm({...form,departure_time:e.target.value})} />
            </div>
            <div className="form-group full"><label>Descrição da carga</label>
              <input value={form.load_description} onChange={e=>setForm({...form,load_description:e.target.value})} placeholder="Ex: Cabo UTP + Disjuntores para Lisboa" />
            </div>
            <div className="form-group full"><label>Notas</label>
              <textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="Morada de entrega, instruções especiais..." />
            </div>
          </div>
          <div style={{background:'var(--bg)',borderRadius:'var(--radius)',padding:'8px 12px',fontSize:12,color:'var(--text-muted)',marginTop:8}}>
            <i className="ti ti-info-circle" style={{marginRight:6}}/>
            O sistema vai automaticamente criar um alerta de contacto 3 dias antes da data de saída.
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

        {agenda.length === 0
          ? <div className="empty">Sem transportes agendados.</div>
          : <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Data saída</th>
                    <th>Transportador</th>
                    <th>Veículo</th>
                    <th>Carga</th>
                    <th>Contactar em</th>
                    <th>Estado</th>
                    <th>Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {agenda.map(a => {
                    const cd = new Date(a.contact_date)
                    const urgent = cd <= in3days && a.contact_status === 'Por fazer'
                    return (
                      <tr key={a.id} style={{background: urgent ? 'rgba(186,117,23,0.05)' : ''}}>
                        <td style={{fontWeight:500}}>{new Date(a.planned_date).toLocaleDateString('pt-PT')}</td>
                        <td>
                          <div style={{fontWeight:500}}>{a.carriers?.name}</div>
                          <div style={{fontSize:11,color:'var(--text-muted)'}}>{a.carriers?.phone}</div>
                        </td>
                        <td style={{fontSize:12}}>{a.carriers?.vehicle_type} · {a.carriers?.plate}</td>
                        <td style={{fontSize:12,maxWidth:150,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{a.load_description||'—'}</td>
                        <td style={{fontSize:12}}>
                          <span style={{color: urgent ? 'var(--red)' : 'var(--text-muted)', fontWeight: urgent ? 600 : 400}}>
                            {urgent && '⚠️ '}
                            {new Date(a.contact_date).toLocaleDateString('pt-PT')}
                          </span>
                        </td>
                        <td><span className={`badge ${statusClass[a.contact_status]||''}`}>{a.contact_status}</span></td>
                        <td>
                          <div style={{display:'flex',gap:4}}>
                            {a.contact_status === 'Por fazer' && <button className="btn btn-sm" onClick={()=>updateStatus(a.id,'Contactado')}>Contactado</button>}
                            {a.contact_status === 'Contactado' && <button className="btn btn-sm btn-primary" onClick={()=>updateStatus(a.id,'Confirmado')}>Confirmar</button>}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
        }
      </div>

      <div className="card">
        <div className="card-header"><span className="card-title">Transportadores disponíveis</span></div>
        <div className="transport-grid">
          {carriers.map(c => (
            <div key={c.id} className="transport-card">
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}>
                <div style={{fontWeight:600}}>{c.name}</div>
                <span style={{fontSize:11,color:'var(--text-muted)'}}>{c.vehicle_type}</span>
              </div>
              <div className="tc-row"><span style={{color:'var(--text-muted)'}}>Matrícula</span><span>{c.plate||'—'}</span></div>
              <div className="tc-row"><span style={{color:'var(--text-muted)'}}>Rotas</span><span>{c.routes||'—'}</span></div>
              <div className="tc-row"><span style={{color:'var(--text-muted)'}}>Carga máx.</span><span>{c.max_load_kg ? `${c.max_load_kg} kg` : '—'}</span></div>
              <div className="tc-row"><span style={{color:'var(--text-muted)'}}>Telefone</span><span>{c.phone||'—'}</span></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
