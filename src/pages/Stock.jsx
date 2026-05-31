import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'

export default function Stock() {
  const [items, setItems] = useState([])
  const [alerts, setAlerts] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('alerts')
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('')
  const [filterWarehouse, setFilterWarehouse] = useState('')
  const [form, setForm] = useState({ reference:'', description:'', unit:'un.', stock_current:'', stock_min:'', stock_ideal:'', warehouse:'Armazém A', category:'', category_id:'' })
  const [saving, setSaving] = useState(false)

  const load = async () => {
    const [{ data: al }, { data: all }, { data: cats }] = await Promise.all([
      supabase.from('stock_alerts').select('*'),
      supabase.from('items').select('*, item_categories(name)').order('description'),
      supabase.from('item_categories').select('*').order('name'),
    ])
    setAlerts(al||[])
    setItems(all||[])
    setCategories(cats||[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const openEdit = (item) => {
    setEditItem(item)
    setForm({ reference:item.reference, description:item.description, unit:item.unit, stock_current:item.stock_current, stock_min:item.stock_min, stock_ideal:item.stock_ideal, warehouse:item.warehouse, category:item.category||'', category_id:item.category_id||'' })
    setShowForm(true)
    setTab('all')
  }

  const handleSave = async () => {
    if (!form.reference || !form.description) return
    setSaving(true)
    const payload = { ...form, stock_current:parseFloat(form.stock_current)||0, stock_min:parseFloat(form.stock_min)||0, stock_ideal:parseFloat(form.stock_ideal)||0, category_id:form.category_id||null }
    if (editItem) {
      await supabase.from('items').update(payload).eq('id', editItem.id)
    } else {
      await supabase.from('items').insert(payload)
    }
    setForm({ reference:'', description:'', unit:'un.', stock_current:'', stock_min:'', stock_ideal:'', warehouse:'Armazém A', category:'', category_id:'' })
    setShowForm(false); setEditItem(null); setSaving(false); load()
  }

  const handleDelete = async (id) => {
    if (!confirm('Apagar este artigo?')) return
    await supabase.from('items').delete().eq('id', id)
    load()
  }

  const warehouses = [...new Set(items.map(i=>i.warehouse).filter(Boolean))]

  const filteredItems = items.filter(i => {
    const s = search.toLowerCase()
    const matchSearch = !s || i.description?.toLowerCase().includes(s) || i.reference?.toLowerCase().includes(s) || i.item_categories?.name?.toLowerCase().includes(s)
    const matchCat = !filterCat || i.category_id === filterCat || i.item_categories?.name === filterCat
    const matchWh = !filterWarehouse || i.warehouse === filterWarehouse
    return matchSearch && matchCat && matchWh
  })

  if (loading) return <div className="loading"><i className="ti ti-loader-2"/>A carregar...</div>

  return (
    <div>
      {showForm && (
        <div className="card" style={{maxWidth:620,marginBottom:16}}>
          <div className="card-header"><span className="card-title">{editItem?'Editar Artigo':'Novo Artigo'}</span></div>
          <div className="form-grid">
            <div className="form-group"><label>Referência *</label><input value={form.reference} onChange={e=>setForm({...form,reference:e.target.value})} placeholder="REF-001" /></div>
            <div className="form-group"><label>Unidade</label>
              <select value={form.unit} onChange={e=>setForm({...form,unit:e.target.value})}>
                {['un.','m','m²','m³','kg','t','lt','cx','rolo','vara','bte','saco','pct'].map(u=><option key={u}>{u}</option>)}
              </select>
            </div>
            <div className="form-group full"><label>Descrição *</label><input value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="Descrição detalhada do artigo" /></div>
            <div className="form-group full"><label>Categoria</label>
              <select value={form.category_id} onChange={e=>setForm({...form,category_id:e.target.value})}>
                <option value="">— Selecionar categoria —</option>
                {categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="form-group"><label>Stock atual</label><input type="number" value={form.stock_current} onChange={e=>setForm({...form,stock_current:e.target.value})} /></div>
            <div className="form-group"><label>Stock mínimo</label><input type="number" value={form.stock_min} onChange={e=>setForm({...form,stock_min:e.target.value})} /></div>
            <div className="form-group"><label>Stock ideal</label><input type="number" value={form.stock_ideal} onChange={e=>setForm({...form,stock_ideal:e.target.value})} /></div>
            <div className="form-group"><label>Armazém</label>
              <select value={form.warehouse} onChange={e=>setForm({...form,warehouse:e.target.value})}>
                {['Armazém A','Armazém B','Armazém C','Armazém D','Externo'].map(w=><option key={w}>{w}</option>)}
              </select>
            </div>
          </div>
          <div className="form-actions">
            <button className="btn" onClick={()=>{setShowForm(false);setEditItem(null)}}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving?'A guardar...':editItem?'Guardar alterações':'Guardar'}</button>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <span className="card-title">Gestão de Stock</span>
          <button className="btn btn-primary" onClick={()=>{setShowForm(true);setEditItem(null);setTab('all')}}><i className="ti ti-plus"/>Novo artigo</button>
        </div>

        <div className="tabs">
          <div className={`tab ${tab==='alerts'?'active':''}`} onClick={()=>setTab('alerts')}>
            Alertas {alerts.length>0&&<span style={{background:'var(--red)',color:'white',borderRadius:10,fontSize:10,padding:'1px 6px',marginLeft:4,fontWeight:600}}>{alerts.length}</span>}
          </div>
          <div className={`tab ${tab==='all'?'active':''}`} onClick={()=>setTab('all')}>Todos os artigos ({items.length})</div>
        </div>

        {tab==='all' && (
          <div style={{display:'flex',gap:8,marginBottom:14,flexWrap:'wrap'}}>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Pesquisar artigo, ref., categoria..." style={{flex:1,minWidth:180,border:'0.5px solid var(--border-hover)',borderRadius:'var(--radius)',padding:'7px 10px',fontSize:13,background:'var(--bg-card)',color:'var(--text)',fontFamily:'inherit'}} />
            <select value={filterCat} onChange={e=>setFilterCat(e.target.value)} style={{border:'0.5px solid var(--border-hover)',borderRadius:'var(--radius)',padding:'7px 10px',fontSize:13,background:'var(--bg-card)',color:'var(--text)',fontFamily:'inherit'}}>
              <option value="">Todas as categorias</option>
              {categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select value={filterWarehouse} onChange={e=>setFilterWarehouse(e.target.value)} style={{border:'0.5px solid var(--border-hover)',borderRadius:'var(--radius)',padding:'7px 10px',fontSize:13,background:'var(--bg-card)',color:'var(--text)',fontFamily:'inherit'}}>
              <option value="">Todos os armazéns</option>
              {warehouses.map(w=><option key={w}>{w}</option>)}
            </select>
            {(search||filterCat||filterWarehouse) && <button className="btn" onClick={()=>{setSearch('');setFilterCat('');setFilterWarehouse('')}}>✕</button>}
          </div>
        )}

        {tab==='alerts' && (
          alerts.length===0
            ? <div className="empty">Stock em ordem! Nenhum artigo abaixo do mínimo.</div>
            : <div className="table-wrap">
                <table>
                  <thead><tr><th>Ref.</th><th>Descrição</th><th>Categoria</th><th>Armazém</th><th>Atual</th><th>Mín.</th><th>Nível</th><th>Alerta</th><th>Ações</th></tr></thead>
                  <tbody>
                    {alerts.map(a=>(
                      <tr key={a.id}>
                        <td style={{fontFamily:'monospace',fontSize:11}}>{a.reference}</td>
                        <td>{a.description}</td>
                        <td style={{fontSize:11,color:'var(--text-muted)'}}>{a.category||'—'}</td>
                        <td style={{fontSize:11,color:'var(--text-muted)'}}>{a.warehouse}</td>
                        <td style={{fontWeight:600,color:a.stock_current===0?'var(--red)':''}}>{a.stock_current} {a.unit}</td>
                        <td>{a.stock_min} {a.unit}</td>
                        <td style={{width:80}}>
                          <div className="stock-bar"><div className={`stock-fill ${a.alert_level==='Rotura'?'fill-red':'fill-amber'}`} style={{width:`${Math.min(100,a.pct_of_min||0)}%`}}/></div>
                          <div style={{fontSize:10,color:'var(--text-muted)',marginTop:1}}>{a.pct_of_min||0}%</div>
                        </td>
                        <td><span className={`badge ${a.alert_level==='Rotura'?'badge-critical':'badge-warning'}`}>{a.alert_level}</span></td>
                        <td>
                          <button className="btn btn-sm" onClick={()=>openEdit(items.find(i=>i.id===a.id)||a)}><i className="ti ti-edit"/></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
        )}

        {tab==='all' && (
          filteredItems.length===0
            ? <div className="empty">{items.length===0?'Sem artigos. Adiciona o primeiro!':'Nenhum resultado.'}</div>
            : <div className="table-wrap">
                <table>
                  <thead><tr><th>Ref.</th><th>Descrição</th><th>Categoria</th><th>Armazém</th><th>Atual</th><th>Mín.</th><th>Ideal</th><th>Ações</th></tr></thead>
                  <tbody>
                    {filteredItems.map(i=>(
                      <tr key={i.id}>
                        <td style={{fontFamily:'monospace',fontSize:11}}>{i.reference}</td>
                        <td>{i.description}</td>
                        <td style={{fontSize:11,color:'var(--text-muted)'}}>{i.item_categories?.name||i.category||'—'}</td>
                        <td style={{fontSize:11,color:'var(--text-muted)'}}>{i.warehouse}</td>
                        <td style={{fontWeight:500,color:i.stock_current<i.stock_min?'var(--red)':''}}>{i.stock_current} {i.unit}</td>
                        <td style={{color:'var(--text-muted)'}}>{i.stock_min} {i.unit}</td>
                        <td style={{color:'var(--text-muted)'}}>{i.stock_ideal} {i.unit}</td>
                        <td>
                          <div style={{display:'flex',gap:4}}>
                            <button className="btn btn-sm" onClick={()=>openEdit(i)}><i className="ti ti-edit"/></button>
                            <button className="btn btn-sm" style={{color:'var(--red)'}} onClick={()=>handleDelete(i.id)}><i className="ti ti-trash"/></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
        )}
      </div>
    </div>
  )
}
