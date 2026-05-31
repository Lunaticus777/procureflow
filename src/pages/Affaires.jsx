import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

const STATUS_CLASS = {
  'Aberta':'badge-quotation','Em curso':'badge-ordered','Concluída':'badge-delivered','Cancelada':'badge-cancelled'
}
const ORDER_STATUS = {
  'Recebido':'badge-pending','Em preparação':'badge-quotation','Encomendado':'badge-ordered',
  'Parcial':'badge-warning','Entregue':'badge-delivered','Cancelado':'badge-cancelled'
}

export default function Affaires() {
  const { session } = useAuth()
  const [affaires, setAffaires] = useState([])
  const [clients, setClients] = useState([])
  const [orders, setOrders] = useState([])
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [showOrderForm, setShowOrderForm] = useState(false)
  const [form, setForm] = useState({ ref_number:'', name:'', client_id:'', address:'', city:'', status:'Aberta', start_date:'', budget:'', notes:'' })
  const [orderForm, setOrderForm] = useState({ description:'', received_via:'Email', delivery_address:'', delivery_city:'', delivery_date:'', priority:'Normal', notes:'' })
  const [saving, setSaving] = useState(false)

  const load = async () => {
    const [{ data: af }, { data: cl }] = await Promise.all([
      supabase.from('affaires').select('*, clients(name, phone, company)').order('created_at', { ascending: false }),
      supabase.from('clients').select('id, name, company').eq('active', true).order('name'),
    ])
    setAffaires(af || [])
    setClients(cl || [])
    setLoading(false)
  }

  const loadOrders = async (affaireId) => {
    const { data } = await supabase
      .from('client_orders')
      .select('*, employees(full_name, emp_code)')
      .eq('affaire_id', affaireId)
      .order('created_at', { ascending: false })
    setOrders(data || [])
  }

  useEffect(() => { load() }, [])

  const selectAffaire = (a) => { setSelected(a); loadOrders(a.id) }

  const handleSave = async () => {
    if (!form.name) return
    setSaving(true)
    const { data: emp } = await supabase.from('employees').select('id').eq('email', session?.user?.email).single()
    const count = affaires.length + 1
    await supabase.from('affaires').insert({
      ...form,
      ref_number: form.ref_number || `OBR-${String(count).padStart(3,'0')}`,
      budget: form.budget ? parseFloat(form.budget) : null,
      created_by: emp?.id || null,
    })
    setForm({ ref_number:'', name:'', client_id:'', address:'', city:'', status:'Aberta', start_date:'', budget:'', notes:'' })
    setShowForm(false)
    setSaving(false)
    load()
  }

  const handleOrderSave = async () => {
    if (!orderForm.description) return
    setSaving(true)
    const { data: emp } = await supabase.from('employees').select('id').eq('email', session?.user?.email).single()
    const count = orders.length + 1
    await supabase.from('client_orders').insert({
      ...orderForm,
      ref_number: `EC-${selected.ref_number}-${String(count).padStart(2,'0')}`,
      affaire_id: selected.id,
      client_id: selected.client_id,
      created_by: emp?.id || null,
      received_date: new Date().toISOString().split('T')[0],
    })
    setOrderForm({ description:'', received_via:'Email', delivery_address:'', delivery_city:'', delivery_date:'', priority:'Normal', notes:'' })
    setShowOrderForm(false)
    setSaving(false)
    loadOrders(selected.id)
  }

  if (loading) return <div className="loading"><i className="ti ti-loader-2"/>A carregar...</div>

  return (
    <div>
      {showForm && (
        <div className="card" style={{maxWidth:640,marginBottom:16}}>
          <div className="card-header"><span className="card-title">Nova Obra / Affaire</span></div>
          <div className="form-grid">
            <div className="form-group"><label>Referência</label><input value={form.ref_number} onChange={e=>setForm({...form,ref_number:e.target.value})} placeholder="OBR-001 (auto)" /></div>
            <div className="form-group"><label>Estado</label>
              <select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}>
                {['Aberta','Em curso','Concluída','Cancelada'].map(s=><option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="form-group full"><label>Nome da obra *</label><input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Ex: 10 Apartamentos Lisboa T2" /></div>
            <div className="form-group full"><label>Cliente</label>
              <select value={form.client_id} onChange={e=>setForm({...form,client_id:e.target.value})}>
                <option value="">Selecionar cliente...</option>
                {clients.map(c=><option key={c.id} value={c.id}>{c.name}{c.company?` — ${c.company}`:''}</option>)}
              </select>
            </div>
            <div className="form-group full"><label>Morada da obra</label><input value={form.address} onChange={e=>setForm({...form,address:e.target.value})} /></div>
            <div className="form-group"><label>Cidade</label><input value={form.city} onChange={e=>setForm({...form,city:e.target.value})} /></div>
            <div className="form-group"><label>Data início</label><input type="date" value={form.start_date} onChange={e=>setForm({...form,start_date:e.target.value})} /></div>
            <div className="form-group"><label>Orçamento (€)</label><input type="number" value={form.budget} onChange={e=>setForm({...form,budget:e.target.value})} /></div>
            <div className="form-group full"><label>Notas</label><textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} /></div>
          </div>
          <div className="form-actions">
            <button className="btn" onClick={()=>setShowForm(false)}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving?'A guardar...':'Guardar Obra'}</button>
          </div>
        </div>
      )}

      <div className="two-col">
        <div className="card">
          <div className="card-header">
            <span className="card-title">Obras / Affaires ({affaires.length})</span>
            <button className="btn btn-primary" onClick={()=>setShowForm(true)}><i className="ti ti-plus"/>Nova obra</button>
          </div>
          {affaires.length === 0
            ? <div className="empty">Sem obras. Cria a primeira!</div>
            : <div className="table-wrap">
                <table>
                  <thead><tr><th>Ref.</th><th>Nome</th><th>Cliente</th><th>Cidade</th><th>Estado</th></tr></thead>
                  <tbody>
                    {affaires.map(a => (
                      <tr key={a.id} style={{cursor:'pointer'}} onClick={()=>selectAffaire(a)}>
                        <td style={{fontWeight:500}}>{a.ref_number}</td>
                        <td style={{maxWidth:160,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{a.name}</td>
                        <td style={{fontSize:12,color:'var(--text-muted)'}}>{a.clients?.name||'—'}</td>
                        <td style={{fontSize:12}}>{a.city||'—'}</td>
                        <td><span className={`badge ${STATUS_CLASS[a.status]||''}`}>{a.status}</span></td>
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
                  <div style={{fontSize:12,color:'var(--text-muted)',marginTop:2}}>{selected.ref_number} · {selected.clients?.name}</div>
                </div>
                <button className="btn btn-sm" onClick={()=>setSelected(null)}><i className="ti ti-x"/></button>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'6px 16px',fontSize:13,marginBottom:12}}>
                {selected.city && <div><span style={{color:'var(--text-muted)'}}>Cidade: </span>{selected.city}</div>}
                {selected.address && <div style={{gridColumn:'1/-1'}}><span style={{color:'var(--text-muted)'}}>Morada: </span>{selected.address}</div>}
                {selected.budget && <div><span style={{color:'var(--text-muted)'}}>Orçamento: </span>€ {parseFloat(selected.budget).toLocaleString('pt-PT')}</div>}
                {selected.clients?.phone && <div><span style={{color:'var(--text-muted)'}}>Tel. cliente: </span>{selected.clients.phone}</div>}
              </div>
              <button className="btn btn-primary" style={{width:'100%',justifyContent:'center'}} onClick={()=>setShowOrderForm(true)}>
                <i className="ti ti-plus"/>Adicionar encomenda do cliente
              </button>
            </div>

            {showOrderForm && (
              <div className="card">
                <div className="card-header"><span className="card-title">Nova Encomenda — {selected.name}</span></div>
                <div className="form-grid">
                  <div className="form-group"><label>Recebido via</label>
                    <select value={orderForm.received_via} onChange={e=>setOrderForm({...orderForm,received_via:e.target.value})}>
                      {['Email','Telefone','Presencial','WhatsApp','Outro'].map(v=><option key={v}>{v}</option>)}
                    </select>
                  </div>
                  <div className="form-group"><label>Prioridade</label>
                    <select value={orderForm.priority} onChange={e=>setOrderForm({...orderForm,priority:e.target.value})}>
                      {['Urgente','Normal','Baixa'].map(p=><option key={p}>{p}</option>)}
                    </select>
                  </div>
                  <div className="form-group full"><label>Descrição dos materiais *</label>
                    <textarea value={orderForm.description} onChange={e=>setOrderForm({...orderForm,description:e.target.value})} placeholder="Lista de materiais pedidos pelo cliente..." />
                  </div>
                  <div className="form-group full"><label>Morada de entrega</label>
                    <input value={orderForm.delivery_address} onChange={e=>setOrderForm({...orderForm,delivery_address:e.target.value})} placeholder="Morada completa de entrega" />
                  </div>
                  <div className="form-group"><label>Cidade entrega</label>
                    <input value={orderForm.delivery_city} onChange={e=>setOrderForm({...orderForm,delivery_city:e.target.value})} />
                  </div>
                  <div className="form-group"><label>Data entrega pretendida</label>
                    <input type="date" value={orderForm.delivery_date} onChange={e=>setOrderForm({...orderForm,delivery_date:e.target.value})} />
                  </div>
                  <div className="form-group full"><label>Notas</label>
                    <textarea value={orderForm.notes} onChange={e=>setOrderForm({...orderForm,notes:e.target.value})} />
                  </div>
                </div>
                <div className="form-actions">
                  <button className="btn" onClick={()=>setShowOrderForm(false)}>Cancelar</button>
                  <button className="btn btn-primary" onClick={handleOrderSave} disabled={saving}>{saving?'A guardar...':'Guardar Encomenda'}</button>
                </div>
              </div>
            )}

            <div className="card">
              <div className="card-header"><span className="card-title">Encomendas desta obra</span></div>
              {orders.length === 0
                ? <div className="empty" style={{padding:16}}>Sem encomendas ainda.</div>
                : <table>
                    <thead><tr><th>Ref.</th><th>Descrição</th><th>Via</th><th>Entrega</th><th>Estado</th></tr></thead>
                    <tbody>
                      {orders.map(o => (
                        <tr key={o.id}>
                          <td style={{fontWeight:500}}>{o.ref_number}</td>
                          <td style={{fontSize:12,maxWidth:150,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{o.description}</td>
                          <td style={{fontSize:12}}>{o.received_via}</td>
                          <td style={{fontSize:12}}>{o.delivery_date ? new Date(o.delivery_date).toLocaleDateString('pt-PT') : '—'}</td>
                          <td><span className={`badge ${ORDER_STATUS[o.status]||''}`}>{o.status}</span></td>
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
