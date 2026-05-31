import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const COUNTRIES = ['Portugal','Suíça','França','Espanha','Alemanha','Reino Unido','Luxemburgo','Bélgica','Outro']

export default function Clients() {
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [selected, setSelected] = useState(null)
  const [history, setHistory] = useState([])
  const [payments, setPayments] = useState([])
  const [affaires, setAffaires] = useState([])
  const [tab, setTab] = useState('orders')
  const [editClient, setEditClient] = useState(null)
  const [form, setForm] = useState({ name:'', company:'', nif:'', email:'', phone:'', mobile:'', address:'', city:'', postal_code:'', country:'Portugal', notes:'' })
  const [saving, setSaving] = useState(false)

  const load = async () => {
    const { data } = await supabase.from('clients').select('*').eq('active', true).order('name')
    setClients(data || [])
    setLoading(false)
  }

  const loadHistory = async (clientId) => {
    const [{ data: orders }, { data: pays }, { data: aff }] = await Promise.all([
      supabase.from('client_orders').select('*, affaires(name,ref_number)').eq('client_id', clientId).order('created_at',{ascending:false}),
      supabase.from('client_payments').select('*').eq('client_id', clientId).order('created_at',{ascending:false}),
      supabase.from('affaires').select('*').eq('client_id', clientId).order('created_at',{ascending:false}),
    ])
    setHistory(orders || [])
    setPayments(pays || [])
    setAffaires(aff || [])
  }

  useEffect(() => { load() }, [])

  const selectClient = (c) => { setSelected(c); loadHistory(c.id); setTab('orders') }

  const openEdit = (c) => {
    setEditClient(c)
    setForm({ name:c.name, company:c.company||'', nif:c.nif||'', email:c.email||'', phone:c.phone||'', mobile:c.mobile||'', address:c.address||'', city:c.city||'', postal_code:c.postal_code||'', country:c.country||'Portugal', notes:c.notes||'' })
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.name) return
    setSaving(true)
    if (editClient) {
      await supabase.from('clients').update(form).eq('id', editClient.id)
    } else {
      await supabase.from('clients').insert(form)
    }
    setForm({ name:'', company:'', nif:'', email:'', phone:'', mobile:'', address:'', city:'', postal_code:'', country:'Portugal', notes:'' })
    setShowForm(false)
    setEditClient(null)
    setSaving(false)
    load()
  }

  const handleDelete = async (id) => {
    if (!confirm('Tem a certeza que quer arquivar este cliente?')) return
    await supabase.from('clients').update({ active: false }).eq('id', id)
    setSelected(null)
    load()
  }

  const STATUS_CLASS = { 'Recebido':'badge-pending','Em preparação':'badge-quotation','Encomendado':'badge-ordered','Entregue':'badge-delivered','Cancelado':'badge-cancelled' }
  const AFFAIRE_CLASS = { 'Aberta':'badge-quotation','Em curso':'badge-ordered','Concluída':'badge-delivered','Cancelada':'badge-cancelled' }

  const totalPaid = payments.filter(p=>p.status==='Pago').reduce((s,p)=>s+parseFloat(p.amount||0),0)
  const totalPending = payments.filter(p=>p.status!=='Pago').reduce((s,p)=>s+parseFloat(p.amount||0),0)

  if (loading) return <div className="loading"><i className="ti ti-loader-2"/>A carregar...</div>

  return (
    <div>
      {showForm && (
        <div className="card" style={{maxWidth:640,marginBottom:16}}>
          <div className="card-header"><span className="card-title">{editClient?'Editar Cliente':'Novo Cliente'}</span></div>
          <div className="form-grid">
            <div className="form-group"><label>Nome *</label><input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} /></div>
            <div className="form-group"><label>Empresa</label><input value={form.company} onChange={e=>setForm({...form,company:e.target.value})} /></div>
            <div className="form-group"><label>NIF</label><input value={form.nif} onChange={e=>setForm({...form,nif:e.target.value})} /></div>
            <div className="form-group"><label>País</label>
              <select value={form.country} onChange={e=>setForm({...form,country:e.target.value})}>
                {COUNTRIES.map(c=><option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-group"><label>Email</label><input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} /></div>
            <div className="form-group"><label>Telefone</label><input value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} /></div>
            <div className="form-group"><label>Telemóvel</label><input value={form.mobile} onChange={e=>setForm({...form,mobile:e.target.value})} /></div>
            <div className="form-group"><label>Código Postal</label><input value={form.postal_code} onChange={e=>setForm({...form,postal_code:e.target.value})} /></div>
            <div className="form-group full"><label>Morada</label><input value={form.address} onChange={e=>setForm({...form,address:e.target.value})} /></div>
            <div className="form-group"><label>Cidade</label><input value={form.city} onChange={e=>setForm({...form,city:e.target.value})} /></div>
            <div className="form-group full"><label>Notas</label><textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} /></div>
          </div>
          <div className="form-actions">
            <button className="btn" onClick={()=>{setShowForm(false);setEditClient(null)}}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving?'A guardar...':editClient?'Guardar alterações':'Guardar Cliente'}</button>
          </div>
        </div>
      )}

      <div className="two-col">
        <div className="card">
          <div className="card-header">
            <span className="card-title">Clientes ({clients.length})</span>
            <button className="btn btn-primary" onClick={()=>{setShowForm(true);setEditClient(null)}}><i className="ti ti-plus"/>Novo</button>
          </div>
          {clients.length === 0
            ? <div className="empty">Sem clientes. Adiciona o primeiro!</div>
            : <div className="table-wrap">
                <table>
                  <thead><tr><th>Nome</th><th>Empresa</th><th>País</th><th>Telefone</th></tr></thead>
                  <tbody>
                    {clients.map(c => (
                      <tr key={c.id} style={{cursor:'pointer',background:selected?.id===c.id?'var(--bg)':''}} onClick={()=>selectClient(c)}>
                        <td style={{fontWeight:500}}>{c.name}</td>
                        <td style={{fontSize:12,color:'var(--text-muted)'}}>{c.company||'—'}</td>
                        <td style={{fontSize:12}}>{c.country||'—'}</td>
                        <td style={{fontSize:12}}>{c.phone||c.mobile||'—'}</td>
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
                  <div style={{fontWeight:600,fontSize:15}}>{selected.name}</div>
                  {selected.company && <div style={{fontSize:12,color:'var(--blue)',marginTop:2}}>{selected.company}</div>}
                </div>
                <div style={{display:'flex',gap:6}}>
                  <button className="btn btn-sm" onClick={()=>openEdit(selected)}><i className="ti ti-edit"/></button>
                  <button className="btn btn-sm" style={{color:'var(--red)'}} onClick={()=>handleDelete(selected.id)}><i className="ti ti-trash"/></button>
                  <button className="btn btn-sm" onClick={()=>setSelected(null)}><i className="ti ti-x"/></button>
                </div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'6px 16px',fontSize:13,marginBottom:12}}>
                {selected.nif && <div><span style={{color:'var(--text-muted)'}}>NIF: </span>{selected.nif}</div>}
                {selected.country && <div><span style={{color:'var(--text-muted)'}}>País: </span>{selected.country}</div>}
                {selected.email && <div><span style={{color:'var(--text-muted)'}}>Email: </span><a href={`mailto:${selected.email}`} style={{color:'var(--blue)'}}>{selected.email}</a></div>}
                {selected.phone && <div><span style={{color:'var(--text-muted)'}}>Tel: </span>{selected.phone}</div>}
                {selected.mobile && <div><span style={{color:'var(--text-muted)'}}>Telem: </span>{selected.mobile}</div>}
                {selected.address && <div style={{gridColumn:'1/-1'}}><span style={{color:'var(--text-muted)'}}>Morada: </span>{selected.address}, {selected.city} {selected.postal_code}</div>}
              </div>

              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:12}}>
                <div style={{background:'var(--green-light)',borderRadius:'var(--radius)',padding:'8px 12px',fontSize:12}}>
                  <div style={{color:'var(--green)',fontWeight:600}}>€ {totalPaid.toLocaleString('pt-PT',{minimumFractionDigits:0})}</div>
                  <div style={{color:'var(--text-muted)'}}>Recebido</div>
                </div>
                <div style={{background:'var(--amber-light)',borderRadius:'var(--radius)',padding:'8px 12px',fontSize:12}}>
                  <div style={{color:'var(--amber)',fontWeight:600}}>€ {totalPending.toLocaleString('pt-PT',{minimumFractionDigits:0})}</div>
                  <div style={{color:'var(--text-muted)'}}>Pendente</div>
                </div>
              </div>

              {selected.notes && <div style={{fontSize:12,color:'var(--text-muted)',fontStyle:'italic',padding:'8px',background:'var(--bg)',borderRadius:'var(--radius)',marginBottom:12}}>{selected.notes}</div>}
            </div>

            <div className="card">
              <div className="tabs">
                <div className={`tab ${tab==='orders'?'active':''}`} onClick={()=>setTab('orders')}>Encomendas ({history.length})</div>
                <div className={`tab ${tab==='affaires'?'active':''}`} onClick={()=>setTab('affaires')}>Negócios ({affaires.length})</div>
                <div className={`tab ${tab==='payments'?'active':''}`} onClick={()=>setTab('payments')}>Pagamentos ({payments.length})</div>
              </div>

              {tab === 'orders' && (
                history.length === 0 ? <div className="empty">Sem encomendas.</div>
                : <table>
                    <thead><tr><th>Ref.</th><th>Negócio</th><th>Data</th><th>Estado</th></tr></thead>
                    <tbody>
                      {history.map(o => (
                        <tr key={o.id}>
                          <td style={{fontWeight:500}}>{o.ref_number}</td>
                          <td style={{fontSize:12,color:'var(--text-muted)'}}>{o.affaires?.name||'—'}</td>
                          <td style={{fontSize:12}}>{o.received_date?new Date(o.received_date).toLocaleDateString('pt-PT'):'—'}</td>
                          <td><span className={`badge ${STATUS_CLASS[o.status]||''}`}>{o.status}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
              )}

              {tab === 'affaires' && (
                affaires.length === 0 ? <div className="empty">Sem negócios.</div>
                : <table>
                    <thead><tr><th>Ref.</th><th>Nome</th><th>Cidade</th><th>Estado</th></tr></thead>
                    <tbody>
                      {affaires.map(a => (
                        <tr key={a.id}>
                          <td style={{fontWeight:500}}>{a.ref_number}</td>
                          <td style={{fontSize:12}}>{a.name}</td>
                          <td style={{fontSize:12,color:'var(--text-muted)'}}>{a.city||'—'}</td>
                          <td><span className={`badge ${AFFAIRE_CLASS[a.status]||''}`}>{a.status}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
              )}

              {tab === 'payments' && (
                payments.length === 0 ? <div className="empty">Sem pagamentos.</div>
                : <table>
                    <thead><tr><th>Fatura</th><th>Valor</th><th>Vencimento</th><th>Estado</th></tr></thead>
                    <tbody>
                      {payments.map(p => (
                        <tr key={p.id}>
                          <td style={{fontSize:12}}>{p.invoice_ref||'—'}</td>
                          <td style={{fontWeight:500}}>€ {parseFloat(p.amount).toLocaleString('pt-PT',{minimumFractionDigits:0})}</td>
                          <td style={{fontSize:12}}>{p.due_date?new Date(p.due_date).toLocaleDateString('pt-PT'):'—'}</td>
                          <td><span className={`badge ${p.status==='Pago'?'badge-delivered':p.status==='Em atraso'?'badge-critical':'badge-pending'}`}>{p.status}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
