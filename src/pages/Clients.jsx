import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Clients() {
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [selected, setSelected] = useState(null)
  const [history, setHistory] = useState([])
  const [form, setForm] = useState({ name:'', company:'', nif:'', email:'', phone:'', mobile:'', address:'', city:'', postal_code:'', country:'Portugal', notes:'' })
  const [saving, setSaving] = useState(false)

  const load = async () => {
    const { data } = await supabase.from('clients').select('*').eq('active', true).order('name')
    setClients(data || [])
    setLoading(false)
  }

  const loadHistory = async (clientId) => {
    const { data } = await supabase
      .from('client_orders')
      .select('*, affaires(name, ref_number)')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(10)
    setHistory(data || [])
  }

  useEffect(() => { load() }, [])

  const selectClient = (c) => { setSelected(c); loadHistory(c.id) }

  const handleSave = async () => {
    if (!form.name) return
    setSaving(true)
    await supabase.from('clients').insert(form)
    setForm({ name:'', company:'', nif:'', email:'', phone:'', mobile:'', address:'', city:'', postal_code:'', country:'Portugal', notes:'' })
    setShowForm(false)
    setSaving(false)
    load()
  }

  const STATUS_CLASS = {
    'Recebido':'badge-pending','Em preparação':'badge-quotation','Encomendado':'badge-ordered',
    'Entregue':'badge-delivered','Cancelado':'badge-cancelled'
  }

  if (loading) return <div className="loading"><i className="ti ti-loader-2"/>A carregar...</div>

  return (
    <div>
      {showForm && (
        <div className="card" style={{maxWidth:640,marginBottom:16}}>
          <div className="card-header"><span className="card-title">Novo Cliente</span></div>
          <div className="form-grid">
            <div className="form-group"><label>Nome *</label><input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Nome completo" /></div>
            <div className="form-group"><label>Empresa</label><input value={form.company} onChange={e=>setForm({...form,company:e.target.value})} placeholder="Nome da empresa" /></div>
            <div className="form-group"><label>NIF</label><input value={form.nif} onChange={e=>setForm({...form,nif:e.target.value})} /></div>
            <div className="form-group"><label>Email</label><input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} /></div>
            <div className="form-group"><label>Telefone</label><input value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} /></div>
            <div className="form-group"><label>Telemóvel</label><input value={form.mobile} onChange={e=>setForm({...form,mobile:e.target.value})} /></div>
            <div className="form-group full"><label>Morada</label><input value={form.address} onChange={e=>setForm({...form,address:e.target.value})} /></div>
            <div className="form-group"><label>Cidade</label><input value={form.city} onChange={e=>setForm({...form,city:e.target.value})} /></div>
            <div className="form-group"><label>Código Postal</label><input value={form.postal_code} onChange={e=>setForm({...form,postal_code:e.target.value})} /></div>
            <div className="form-group full"><label>Notas</label><textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} /></div>
          </div>
          <div className="form-actions">
            <button className="btn" onClick={()=>setShowForm(false)}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving?'A guardar...':'Guardar Cliente'}</button>
          </div>
        </div>
      )}

      <div className="two-col">
        <div className="card">
          <div className="card-header">
            <span className="card-title">Clientes ({clients.length})</span>
            <button className="btn btn-primary" onClick={()=>setShowForm(true)}><i className="ti ti-plus"/>Novo</button>
          </div>
          {clients.length === 0
            ? <div className="empty">Sem clientes. Adiciona o primeiro!</div>
            : <div className="table-wrap">
                <table>
                  <thead><tr><th>Nome</th><th>Empresa</th><th>Telefone</th><th>Cidade</th></tr></thead>
                  <tbody>
                    {clients.map(c => (
                      <tr key={c.id} style={{cursor:'pointer'}} onClick={()=>selectClient(c)}>
                        <td style={{fontWeight: selected?.id===c.id?600:400}}>{c.name}</td>
                        <td style={{fontSize:12,color:'var(--text-muted)'}}>{c.company||'—'}</td>
                        <td style={{fontSize:12}}>{c.phone||c.mobile||'—'}</td>
                        <td style={{fontSize:12,color:'var(--text-muted)'}}>{c.city||'—'}</td>
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
                <span className="card-title">{selected.name}</span>
                <button className="btn btn-sm" onClick={()=>setSelected(null)}><i className="ti ti-x"/></button>
              </div>
              {selected.company && <div style={{fontSize:13,marginBottom:8,fontWeight:500,color:'var(--blue)'}}>{selected.company}</div>}
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'6px 16px',fontSize:13}}>
                {selected.nif && <div><span style={{color:'var(--text-muted)'}}>NIF: </span>{selected.nif}</div>}
                {selected.email && <div><span style={{color:'var(--text-muted)'}}>Email: </span><a href={`mailto:${selected.email}`} style={{color:'var(--blue)'}}>{selected.email}</a></div>}
                {selected.phone && <div><span style={{color:'var(--text-muted)'}}>Tel: </span>{selected.phone}</div>}
                {selected.mobile && <div><span style={{color:'var(--text-muted)'}}>Telem: </span>{selected.mobile}</div>}
                {selected.address && <div style={{gridColumn:'1/-1'}}><span style={{color:'var(--text-muted)'}}>Morada: </span>{selected.address}, {selected.city} {selected.postal_code}</div>}
              </div>
              {selected.notes && <div style={{marginTop:10,fontSize:12,color:'var(--text-muted)',fontStyle:'italic',padding:'8px',background:'var(--bg)',borderRadius:'var(--radius)'}}>{selected.notes}</div>}
            </div>

            <div className="card">
              <div className="card-header"><span className="card-title">Histórico de encomendas</span></div>
              {history.length === 0
                ? <div className="empty" style={{padding:16}}>Sem encomendas ainda.</div>
                : <table>
                    <thead><tr><th>Ref.</th><th>Obra</th><th>Data</th><th>Estado</th></tr></thead>
                    <tbody>
                      {history.map(o => (
                        <tr key={o.id}>
                          <td style={{fontWeight:500}}>{o.ref_number}</td>
                          <td style={{fontSize:12,color:'var(--text-muted)'}}>{o.affaires?.name||'—'}</td>
                          <td style={{fontSize:12}}>{o.received_date ? new Date(o.received_date).toLocaleDateString('pt-PT') : '—'}</td>
                          <td><span className={`badge ${STATUS_CLASS[o.status]||''}`}>{o.status}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
              }
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
