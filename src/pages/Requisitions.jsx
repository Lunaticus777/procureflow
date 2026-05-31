import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

const STATUS_CLASS = {
  'Pendente':'badge-pending','Em cotação':'badge-quotation','Aprovado':'badge-approved',
  'Encomendado':'badge-ordered','Em trânsito':'badge-transit','Entregue':'badge-delivered','Cancelado':'badge-cancelled'
}
const PRIO_CLASS = { 'Alta':'prio-high','Média':'prio-med','Baixa':'prio-low' }

export default function Requisitions() {
  const { session } = useAuth()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ description:'', quantity:'', unit:'un.', priority:'Média', needed_by:'', min_quotes:'2', notes:'' })
  const [saving, setSaving] = useState(false)

  const load = async () => {
    const { data } = await supabase
      .from('requisitions')
      .select('*, employees(full_name, emp_code)')
      .order('created_at', { ascending:false })
    setRows(data||[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleSave = async () => {
    if (!form.description || !form.quantity) return
    setSaving(true)
    const { data: emp } = await supabase.from('employees').select('id').eq('email', session?.user?.email).single()
    const count = rows.length + 1
    const ref_number = `REQ-${String(count).padStart(3,'0')}`
    await supabase.from('requisitions').insert({
      ref_number,
      description: form.description,
      quantity: parseFloat(form.quantity),
      unit: form.unit,
      priority: form.priority,
      needed_by: form.needed_by || null,
      min_quotes: parseInt(form.min_quotes),
      notes: form.notes,
      created_by: emp?.id || null,
      status: 'Pendente'
    })
    setForm({ description:'', quantity:'', unit:'un.', priority:'Média', needed_by:'', min_quotes:'2', notes:'' })
    setShowForm(false)
    setSaving(false)
    load()
  }

  if (loading) return <div className="loading"><i className="ti ti-loader-2" />A carregar...</div>

  return (
    <div>
      {showForm && (
        <div className="card" style={{maxWidth:620,marginBottom:20}}>
          <div className="card-header"><span className="card-title">Nova Requisição</span></div>
          <div className="form-grid">
            <div className="form-group full">
              <label>Descrição do material *</label>
              <input value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="Ex: Cabo UTP Cat6 500m, ref. XXXX" />
            </div>
            <div className="form-group">
              <label>Quantidade *</label>
              <input type="number" value={form.quantity} onChange={e=>setForm({...form,quantity:e.target.value})} placeholder="0" />
            </div>
            <div className="form-group">
              <label>Unidade</label>
              <select value={form.unit} onChange={e=>setForm({...form,unit:e.target.value})}>
                {['un.','m','kg','cx','rolo','vara','lt'].map(u=><option key={u}>{u}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Prioridade</label>
              <select value={form.priority} onChange={e=>setForm({...form,priority:e.target.value})}>
                {['Alta','Média','Baixa'].map(p=><option key={p}>{p}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Data necessária</label>
              <input type="date" value={form.needed_by} onChange={e=>setForm({...form,needed_by:e.target.value})} />
            </div>
            <div className="form-group">
              <label>Nº mínimo de cotações</label>
              <select value={form.min_quotes} onChange={e=>setForm({...form,min_quotes:e.target.value})}>
                {['2','3','4'].map(n=><option key={n}>{n}</option>)}
              </select>
            </div>
            <div className="form-group full">
              <label>Observações</label>
              <textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="Especificações técnicas, marca preferida..." />
            </div>
          </div>
          <div className="form-actions">
            <button className="btn" onClick={()=>setShowForm(false)}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving?'A guardar...':'Guardar Requisição'}</button>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <span className="card-title">Todas as requisições</span>
          <button className="btn btn-primary" onClick={()=>setShowForm(true)}><i className="ti ti-plus" />Nova</button>
        </div>
        {rows.length === 0
          ? <div className="empty">Sem requisições. Cria a primeira!</div>
          : <div className="table-wrap">
              <table>
                <thead><tr><th>Ref.</th><th>Descrição</th><th>Qtd.</th><th>Solicitante</th><th>Prioridade</th><th>Data nec.</th><th>Estado</th></tr></thead>
                <tbody>
                  {rows.map(r=>(
                    <tr key={r.id}>
                      <td style={{fontWeight:500}}>{r.ref_number}</td>
                      <td style={{maxWidth:220,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.description}</td>
                      <td>{r.quantity} {r.unit}</td>
                      <td style={{fontSize:12,color:'var(--text-muted)'}}>{r.employees?.emp_code}</td>
                      <td><span className={PRIO_CLASS[r.priority]||''}>{r.priority}</span></td>
                      <td style={{fontSize:12}}>{r.needed_by ? new Date(r.needed_by).toLocaleDateString('pt-PT') : '—'}</td>
                      <td><span className={`badge ${STATUS_CLASS[r.status]||''}`}>{r.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
        }
      </div>
    </div>
  )
}
