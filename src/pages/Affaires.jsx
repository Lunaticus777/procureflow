import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

const STATUS_CLASS = { 'Aberta':'badge-quotation','Em curso':'badge-ordered','Concluída':'badge-delivered','Cancelada':'badge-cancelled' }
const ORDER_STATUS = { 'Recebido':'badge-pending','Em preparação':'badge-quotation','Encomendado':'badge-ordered','Parcial':'badge-warning','Entregue':'badge-delivered','Cancelado':'badge-cancelled' }
const PRIO_CLASS = { 'Urgente':'prio-high','Normal':'prio-med','Baixa':'prio-low' }

const EMPTY_ORDER = {
  description:'', received_via:'Email', delivery_address:'', delivery_city:'', delivery_date:'',
  priority:'Normal', notes:'', image_url:'',
  technical_contact_name:'', technical_contact_phone:'', technical_contact_company:'', technical_contact_notes:''
}

export default function Affaires() {
  const { session } = useAuth()
  const [affaires, setAffaires] = useState([])
  const [clients, setClients] = useState([])
  const [orders, setOrders] = useState([])
  const [selected, setSelected] = useState(null)
  const [editOrder, setEditOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [showOrderForm, setShowOrderForm] = useState(false)
  const [expanded, setExpanded] = useState(null)
  const [form, setForm] = useState({ ref_number:'', name:'', client_id:'', address:'', city:'', status:'Aberta', start_date:'', budget:'', notes:'' })
  const [orderForm, setOrderForm] = useState(EMPTY_ORDER)
  const [saving, setSaving] = useState(false)
  const [imagePreview, setImagePreview] = useState(null)
  const fileRef = useRef()

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

  const handleImageChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => { setImagePreview(ev.target.result); setOrderForm(f => ({ ...f, image_url: ev.target.result })) }
    reader.readAsDataURL(file)
  }

  const handleSave = async () => {
    if (!form.name) return
    setSaving(true)
    const { data: emp } = await supabase.from('employees').select('id').eq('email', session?.user?.email).single()
    const count = affaires.length + 1
    await supabase.from('affaires').insert({
      ...form, ref_number: form.ref_number || `NEG-${String(count).padStart(3,'0')}`,
      budget: form.budget ? parseFloat(form.budget) : null, created_by: emp?.id || null,
    })
    setForm({ ref_number:'', name:'', client_id:'', address:'', city:'', status:'Aberta', start_date:'', budget:'', notes:'' })
    setShowForm(false); setSaving(false); load()
  }

  const handleOrderSave = async () => {
    if (!orderForm.description) return
    setSaving(true)
    const { data: emp } = await supabase.from('employees').select('id').eq('email', session?.user?.email).single()
    const payload = {
      ...orderForm,
      delivery_date: orderForm.delivery_date || null,
      technical_contact_name: orderForm.technical_contact_name || null,
      technical_contact_phone: orderForm.technical_contact_phone || null,
      technical_contact_company: orderForm.technical_contact_company || null,
      technical_contact_notes: orderForm.technical_contact_notes || null,
    }
    if (editOrder) {
      await supabase.from('client_orders').update(payload).eq('id', editOrder.id)
    } else {
      const count = orders.length + 1
      await supabase.from('client_orders').insert({
        ...payload,
        ref_number: `EC-${selected.ref_number}-${String(count).padStart(2,'0')}`,
        affaire_id: selected.id, client_id: selected.client_id,
        created_by: emp?.id || null, received_date: new Date().toISOString().split('T')[0],
      })
    }
    setOrderForm(EMPTY_ORDER); setImagePreview(null)
    setShowOrderForm(false); setEditOrder(null); setSaving(false)
    loadOrders(selected.id)
  }

  const handleDeleteOrder = async (id) => {
    if (!confirm('Apagar esta encomenda?')) return
    await supabase.from('client_orders').delete().eq('id', id)
    loadOrders(selected.id)
  }

  const handleEditOrder = (o) => {
    setEditOrder(o)
    setOrderForm({
      description:o.description, received_via:o.received_via, delivery_address:o.delivery_address||'',
      delivery_city:o.delivery_city||'', delivery_date:o.delivery_date||'', priority:o.priority,
      notes:o.notes||'', image_url:o.image_url||'',
      technical_contact_name:o.technical_contact_name||'', technical_contact_phone:o.technical_contact_phone||'',
      technical_contact_company:o.technical_contact_company||'', technical_contact_notes:o.technical_contact_notes||''
    })
    setImagePreview(o.image_url||null); setShowOrderForm(true)
  }

  const updateOrderStatus = async (id, status) => {
    await supabase.from('client_orders').update({ status }).eq('id', id)
    loadOrders(selected.id)
  }

  if (loading) return <div className="loading"><i className="ti ti-loader-2"/>A carregar...</div>

  // Shared order form component
  const OrderForm = () => (
    <div className="card" style={{background:'var(--bg)',marginBottom:12}}>
      <div className="card-header"><span className="card-title">{editOrder?'Editar':'Nova'} Encomenda do Cliente</span></div>
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
        <div className="form-group full"><label>Foto / Imagem de referência</label>
          <input type="file" accept="image/*" ref={fileRef} onChange={handleImageChange} style={{fontSize:12}} />
          {imagePreview && <img src={imagePreview} alt="preview" style={{marginTop:8,maxWidth:'100%',maxHeight:150,borderRadius:'var(--radius)',objectFit:'cover'}} />}
        </div>
        <div className="form-group full"><label>Morada de entrega</label>
          <input value={orderForm.delivery_address} onChange={e=>setOrderForm({...orderForm,delivery_address:e.target.value})} />
        </div>
        <div className="form-group"><label>Cidade</label>
          <input value={orderForm.delivery_city} onChange={e=>setOrderForm({...orderForm,delivery_city:e.target.value})} />
        </div>
        <div className="form-group"><label>Data entrega pretendida</label>
          <input type="date" value={orderForm.delivery_date} onChange={e=>setOrderForm({...orderForm,delivery_date:e.target.value})} />
        </div>
        <div className="form-group full"><label>Notas</label>
          <textarea value={orderForm.notes} onChange={e=>setOrderForm({...orderForm,notes:e.target.value})} />
        </div>
      </div>

      {/* Contacto técnico */}
      <div style={{marginTop:14,paddingTop:14,borderTop:'0.5px solid var(--border)'}}>
        <div style={{fontSize:13,fontWeight:600,marginBottom:10,color:'var(--blue)'}}><i className="ti ti-user-check" style={{marginRight:6}}/>Contacto técnico</div>
        <div style={{fontSize:12,color:'var(--text-muted)',marginBottom:10}}>Pessoa que pode dar informações sobre o material (ex: empresa de colocação)</div>
        <div className="form-grid">
          <div className="form-group"><label>Nome</label><input value={orderForm.technical_contact_name} onChange={e=>setOrderForm({...orderForm,technical_contact_name:e.target.value})} placeholder="Ex: João Silva" /></div>
          <div className="form-group"><label>Empresa</label><input value={orderForm.technical_contact_company} onChange={e=>setOrderForm({...orderForm,technical_contact_company:e.target.value})} placeholder="Ex: Empresa de Caixilharia" /></div>
          <div className="form-group"><label>Telefone</label><input value={orderForm.technical_contact_phone} onChange={e=>setOrderForm({...orderForm,technical_contact_phone:e.target.value})} /></div>
          <div className="form-group"><label>Notas</label><input value={orderForm.technical_contact_notes} onChange={e=>setOrderForm({...orderForm,technical_contact_notes:e.target.value})} placeholder="Ex: Tem as medidas exactas" /></div>
        </div>
      </div>

      <div className="form-actions">
        <button className="btn" onClick={()=>{setShowOrderForm(false);setEditOrder(null)}}>Cancelar</button>
        <button className="btn btn-primary" onClick={handleOrderSave} disabled={saving}>{saving?'A guardar...':editOrder?'Guardar alterações':'Guardar Encomenda'}</button>
      </div>
    </div>
  )

  return (
    <div>
      {showForm && (
        <div className="card" style={{maxWidth:640,marginBottom:16}}>
          <div className="card-header"><span className="card-title">Novo Negócio / Obra</span></div>
          <div className="form-grid">
            <div className="form-group"><label>Referência</label><input value={form.ref_number} onChange={e=>setForm({...form,ref_number:e.target.value})} placeholder="NEG-001 (auto)" /></div>
            <div className="form-group"><label>Estado</label>
              <select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}>
                {['Aberta','Em curso','Concluída','Cancelada'].map(s=><option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="form-group full"><label>Nome do negócio *</label><input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} /></div>
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
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving?'A guardar...':'Guardar Negócio'}</button>
          </div>
        </div>
      )}

      <div className="two-col">
        <div className="card">
          <div className="card-header">
            <span className="card-title">Negócios / Obras ({affaires.length})</span>
            <button className="btn btn-primary" onClick={()=>setShowForm(true)}><i className="ti ti-plus"/>Novo</button>
          </div>
          {affaires.length === 0
            ? <div className="empty">Sem negócios.</div>
            : <div className="table-wrap">
                <table>
                  <thead><tr><th>Ref.</th><th>Nome</th><th>Cliente</th><th>Estado</th></tr></thead>
                  <tbody>
                    {affaires.map(a => (
                      <tr key={a.id} style={{cursor:'pointer',background:selected?.id===a.id?'var(--bg)':''}} onClick={()=>selectAffaire(a)}>
                        <td style={{fontWeight:500}}>{a.ref_number}</td>
                        <td style={{maxWidth:140,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{a.name}</td>
                        <td style={{fontSize:12,color:'var(--text-muted)'}}>{a.clients?.name||'—'}</td>
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
                  <div style={{fontSize:12,color:'var(--text-muted)',marginTop:2}}>{selected.ref_number} · {selected.clients?.name} {selected.clients?.phone?`· ${selected.clients.phone}`:''}</div>
                </div>
                <button className="btn btn-sm" onClick={()=>setSelected(null)}><i className="ti ti-x"/></button>
              </div>
              {selected.address && <div style={{fontSize:13,color:'var(--text-muted)',marginBottom:8}}><i className="ti ti-map-pin" style={{marginRight:4}}/>{selected.address}, {selected.city}</div>}
              <button className="btn btn-primary" style={{width:'100%',justifyContent:'center'}} onClick={()=>{setShowOrderForm(true);setEditOrder(null);setOrderForm({...EMPTY_ORDER,delivery_address:selected.address||'',delivery_city:selected.city||''});setImagePreview(null)}}>
                <i className="ti ti-plus"/>Nova encomenda do cliente
              </button>
            </div>

            {showOrderForm && <OrderForm />}

            <div className="card">
              <div className="card-header"><span className="card-title">Encomendas ({orders.length})</span></div>
              {orders.length === 0
                ? <div className="empty">Sem encomendas.</div>
                : orders.map(o => (
                    <div key={o.id} style={{border:'0.5px solid var(--border)',borderRadius:'var(--radius)',padding:'12px',marginBottom:8}}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:6}}>
                        <div>
                          <div style={{fontWeight:500,fontSize:13}}>{o.ref_number} <span className={PRIO_CLASS[o.priority]||''} style={{fontSize:11}}>{o.priority}</span></div>
                          <div style={{fontSize:11,color:'var(--text-muted)',marginTop:2}}>
                            {o.received_via} · {o.received_date?new Date(o.received_date).toLocaleDateString('pt-PT'):''} · <strong>{o.employees?.emp_code||'—'}</strong> {o.employees?.full_name||''}
                          </div>
                        </div>
                        <span className={`badge ${ORDER_STATUS[o.status]||''}`}>{o.status}</span>
                      </div>
                      <div style={{fontSize:13,color:'var(--text-muted)',marginBottom:6,cursor:'pointer'}} onClick={()=>setExpanded(expanded===o.id?null:o.id)}>
                        {o.description?.slice(0,100)}{o.description?.length>100?'...':''} <span style={{color:'var(--blue)',fontSize:11}}>{expanded===o.id?'▲ menos':'▼ mais'}</span>
                      </div>
                      {expanded===o.id && (
                        <div style={{fontSize:12,marginBottom:8}}>
                          {o.image_url && <img src={o.image_url} alt="ref" style={{maxWidth:'100%',maxHeight:120,borderRadius:'var(--radius)',objectFit:'cover',marginBottom:8}} />}
                          {o.delivery_address && <div style={{color:'var(--text-muted)'}}><i className="ti ti-map-pin" style={{marginRight:4}}/>{o.delivery_address}, {o.delivery_city} {o.delivery_date?`· ${new Date(o.delivery_date).toLocaleDateString('pt-PT')}`:''}</div>}
                          {o.notes && <div style={{marginTop:4,color:'var(--text-muted)',fontStyle:'italic'}}>{o.notes}</div>}
                          {o.technical_contact_name && (
                            <div style={{marginTop:8,padding:'6px 10px',background:'var(--blue-light)',borderRadius:'var(--radius)'}}>
                              <div style={{fontWeight:600,color:'var(--blue)',fontSize:11,marginBottom:3}}><i className="ti ti-user-check" style={{marginRight:4}}/>Contacto técnico</div>
                              <div>{o.technical_contact_name} {o.technical_contact_company?`— ${o.technical_contact_company}`:''} {o.technical_contact_phone?`· ${o.technical_contact_phone}`:''}</div>
                              {o.technical_contact_notes && <div style={{fontStyle:'italic',color:'var(--text-muted)',marginTop:2}}>{o.technical_contact_notes}</div>}
                            </div>
                          )}
                        </div>
                      )}
                      <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                        <select value={o.status} onChange={e=>updateOrderStatus(o.id,e.target.value)} style={{fontSize:11,padding:'3px 6px',border:'0.5px solid var(--border-hover)',borderRadius:'var(--radius)',background:'var(--bg-card)',color:'var(--text)',fontFamily:'inherit'}}>
                          {['Recebido','Em preparação','Encomendado','Parcial','Entregue','Cancelado'].map(s=><option key={s}>{s}</option>)}
                        </select>
                        <button className="btn btn-sm" onClick={()=>handleEditOrder(o)}><i className="ti ti-edit"/>Editar</button>
                        <button className="btn btn-sm" style={{color:'var(--red)'}} onClick={()=>handleDeleteOrder(o.id)}><i className="ti ti-trash"/></button>
                      </div>
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
