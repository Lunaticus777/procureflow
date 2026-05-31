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
  const [affaires, setAffaires] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editReq, setEditReq] = useState(null)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterPrio, setFilterPrio] = useState('')
  const [form, setForm] = useState({ description:'', quantity:'', unit:'un.', priority:'Média', needed_by:'', min_quotes:'2', notes:'', affaire_id:'' })
  const [saving, setSaving] = useState(false)

  const load = async () => {
    const [{ data: reqs }, { data: aff }] = await Promise.all([
      supabase.from('requisitions').select('*, employees(full_name, emp_code), affaires(name, ref_number)').order('created_at', { ascending: false }),
      supabase.from('affaires').select('id, name, ref_number').not('status','eq','Cancelada').order('ref_number'),
    ])
    setRows(reqs || [])
    setAffaires(aff || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const openEdit = (r) => {
    setEditReq(r)
    setForm({ description:r.description, quantity:r.quantity, unit:r.unit, priority:r.priority, needed_by:r.needed_by||'', min_quotes:r.min_quotes, notes:r.notes||'', affaire_id:r.affaire_id||'' })
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.description || !form.quantity) return
    setSaving(true)
    const { data: emp } = await supabase.from('employees').select('id').eq('email', session?.user?.email).single()
    if (editReq) {
      await supabase.from('requisitions').update({
        description: form.description, quantity: parseFloat(form.quantity), unit: form.unit,
        priority: form.priority, needed_by: form.needed_by||null, min_quotes: parseInt(form.min_quotes),
        notes: form.notes, affaire_id: form.affaire_id||null,
      }).eq('id', editReq.id)
    } else {
      const count = rows.length + 1
      await supabase.from('requisitions').insert({
        ref_number: `REQ-${String(count).padStart(3,'0')}`,
        description: form.description, quantity: parseFloat(form.quantity), unit: form.unit,
        priority: form.priority, needed_by: form.needed_by||null, min_quotes: parseInt(form.min_quotes),
        notes: form.notes, affaire_id: form.affaire_id||null,
        created_by: emp?.id||null, status: 'Pendente'
      })
    }
    setForm({ description:'', quantity:'', unit:'un.', priority:'Média', needed_by:'', min_quotes:'2', notes:'', affaire_id:'' })
    setShowForm(false)
    setEditReq(null)
    setSaving(false)
    load()
  }

  const handleDelete = async (id) => {
    if (!confirm('Tem a certeza que quer apagar esta requisição?')) return
    await supabase.from('requisitions').delete().eq('id', id)
    load()
  }

  const filtered = rows.filter(r => {
    const s = search.toLowerCase()
    const matchSearch = !s || r.description?.toLowerCase().includes(s) || r.ref_number?.toLowerCase().includes(s) || r.affaires?.name?.toLowerCase().includes(s)
    const matchStatus = !filterStatus || r.status === filterStatus
    const matchPrio = !filterPrio || r.priority === filterPrio
    return matchSearch && matchStatus && matchPrio
  })

  if (loading) return <div className="loading"><i className="ti ti-loader-2"/>A carregar...</div>

  return (
    <div>
      {showForm && (
        <div className="card" style={{maxWidth:640,marginBottom:20}}>
          <div className="card-header"><span className="card-title">{editReq?'Editar Requisição':'Nova Requisição'}</span></div>
          <div className="form-grid">
            <div className="form-group full">
              <label>Negócio / Obra (opcional)</label>
              <select value={form.affaire_id} onChange={e=>setForm({...form,affaire_id:e.target.value})}>
                <option value="">— Sem obra associada —</option>
                {affaires.map(a=><option key={a.id} value={a.id}>{a.ref_number} — {a.name}</option>)}
              </select>
            </div>
            <div className="form-group full">
              <label>Descrição do material *</label>
              <input value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="Ex: Cabo UTP Cat6 500m, ref. XXXX" />
            </div>
            <div className="form-group">
              <label>Quantidade *</label>
              <input type="number" value={form.quantity} onChange={e=>setForm({...form,quantity:e.target.value})} />
            </div>
            <div className="form-group">
              <label>Unidade</label>
              <select value={form.unit} onChange={e=>setForm({...form,unit:e.target.value})}>
                {['un.','m','kg','cx','rolo','vara','lt','bte'].map(u=><option key={u}>{u}</option>)}
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
              <label>Nº mín. fornecedores a consultar</label>
              <select value={form.min_quotes} onChange={e=>setForm({...form,min_quotes:e.target.value})}>
                {['1','2','3','4'].map(n=><option key={n}>{n}</option>)}
              </select>
            </div>
            <div className="form-group full">
              <label>Observações</label>
              <textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="Especificações técnicas, marca preferida..." />
            </div>
          </div>
          <div className="form-actions">
            <button className="btn" onClick={()=>{setShowForm(false);setEditReq(null)}}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving?'A guardar...':editReq?'Guardar alterações':'Guardar Requisição'}</button>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <span className="card-title">Requisições ({filtered.length}{filtered.length!==rows.length?` / ${rows.length}`:''})</span>
          <button className="btn btn-primary" onClick={()=>{setShowForm(true);setEditReq(null)}}><i className="ti ti-plus"/>Nova</button>
        </div>

        {/* Filtros */}
        <div style={{display:'flex',gap:8,marginBottom:14,flexWrap:'wrap'}}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Pesquisar descrição, ref., obra..." style={{flex:1,minWidth:180,border:'0.5px solid var(--border-hover)',borderRadius:'var(--radius)',padding:'7px 10px',fontSize:13,background:'var(--bg-card)',color:'var(--text)',fontFamily:'inherit'}} />
          <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} style={{border:'0.5px solid var(--border-hover)',borderRadius:'var(--radius)',padding:'7px 10px',fontSize:13,background:'var(--bg-card)',color:'var(--text)',fontFamily:'inherit'}}>
            <option value="">Todos os estados</option>
            {['Pendente','Em cotação','Aprovado','Encomendado','Entregue','Cancelado'].map(s=><option key={s}>{s}</option>)}
          </select>
          <select value={filterPrio} onChange={e=>setFilterPrio(e.target.value)} style={{border:'0.5px solid var(--border-hover)',borderRadius:'var(--radius)',padding:'7px 10px',fontSize:13,background:'var(--bg-card)',color:'var(--text)',fontFamily:'inherit'}}>
            <option value="">Todas as prioridades</option>
            {['Alta','Média','Baixa'].map(p=><option key={p}>{p}</option>)}
          </select>
          {(search||filterStatus||filterPrio) && <button className="btn" onClick={()=>{setSearch('');setFilterStatus('');setFilterPrio('')}}>✕ Limpar</button>}
        </div>

        {filtered.length === 0
          ? <div className="empty">{rows.length===0?'Sem requisições. Cria a primeira!':'Nenhum resultado para esta pesquisa.'}</div>
          : <div className="table-wrap">
              <table>
                <thead><tr><th>Ref.</th><th>Descrição</th><th>Obra</th><th>Qtd.</th><th>Pedido por</th><th>Prioridade</th><th>Data nec.</th><th>Estado</th><th>Ações</th></tr></thead>
                <tbody>
                  {filtered.map(r=>(
                    <tr key={r.id}>
                      <td style={{fontWeight:500}}>{r.ref_number}</td>
                      <td style={{maxWidth:200,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.description}</td>
                      <td style={{fontSize:12,color:'var(--blue)'}}>{r.affaires?`${r.affaires.ref_number}`:'-'}</td>
                      <td>{r.quantity} {r.unit}</td>
                      <td style={{fontSize:12,color:'var(--text-muted)'}}>{r.employees?.emp_code||'—'}</td>
                      <td><span className={PRIO_CLASS[r.priority]||''}>{r.priority}</span></td>
                      <td style={{fontSize:12}}>{r.needed_by?new Date(r.needed_by).toLocaleDateString('pt-PT'):'—'}</td>
                      <td><span className={`badge ${STATUS_CLASS[r.status]||''}`}>{r.status}</span></td>
                      <td>
                        <div style={{display:'flex',gap:4}}>
                          <button className="btn btn-sm" onClick={()=>openEdit(r)} title="Editar"><i className="ti ti-edit"/></button>
                          <button className="btn btn-sm" style={{color:'var(--red)'}} onClick={()=>handleDelete(r.id)} title="Apagar"><i className="ti ti-trash"/></button>
                        </div>
                      </td>
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
