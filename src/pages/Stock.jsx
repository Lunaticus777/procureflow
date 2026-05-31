import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Stock() {
  const [items, setItems] = useState([])
  const [allItems, setAllItems] = useState([])
  const [tab, setTab] = useState('alerts')
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ reference:'', description:'', unit:'un.', stock_current:'', stock_min:'', stock_ideal:'', warehouse:'Armazém A', category:'' })
  const [saving, setSaving] = useState(false)

  const load = async () => {
    const [{ data: alerts }, { data: all }] = await Promise.all([
      supabase.from('stock_alerts').select('*'),
      supabase.from('items').select('*').order('description'),
    ])
    setItems(alerts||[])
    setAllItems(all||[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleSave = async () => {
    if (!form.reference || !form.description) return
    setSaving(true)
    await supabase.from('items').insert({
      ...form,
      stock_current: parseFloat(form.stock_current)||0,
      stock_min: parseFloat(form.stock_min)||0,
      stock_ideal: parseFloat(form.stock_ideal)||0,
    })
    setForm({ reference:'', description:'', unit:'un.', stock_current:'', stock_min:'', stock_ideal:'', warehouse:'Armazém A', category:'' })
    setShowForm(false)
    setSaving(false)
    load()
  }

  if (loading) return <div className="loading"><i className="ti ti-loader-2"/>A carregar...</div>

  return (
    <div>
      {showForm && (
        <div className="card" style={{maxWidth:580,marginBottom:16}}>
          <div className="card-header"><span className="card-title">Novo Artigo</span></div>
          <div className="form-grid">
            <div className="form-group"><label>Referência *</label><input value={form.reference} onChange={e=>setForm({...form,reference:e.target.value})} placeholder="REF-001" /></div>
            <div className="form-group"><label>Unidade</label>
              <select value={form.unit} onChange={e=>setForm({...form,unit:e.target.value})}>
                {['un.','m','kg','cx','rolo','vara','lt'].map(u=><option key={u}>{u}</option>)}
              </select>
            </div>
            <div className="form-group full"><label>Descrição *</label><input value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="Descrição do artigo" /></div>
            <div className="form-group"><label>Stock atual</label><input type="number" value={form.stock_current} onChange={e=>setForm({...form,stock_current:e.target.value})} /></div>
            <div className="form-group"><label>Stock mínimo</label><input type="number" value={form.stock_min} onChange={e=>setForm({...form,stock_min:e.target.value})} /></div>
            <div className="form-group"><label>Stock ideal</label><input type="number" value={form.stock_ideal} onChange={e=>setForm({...form,stock_ideal:e.target.value})} /></div>
            <div className="form-group"><label>Armazém</label>
              <select value={form.warehouse} onChange={e=>setForm({...form,warehouse:e.target.value})}>
                {['Armazém A','Armazém B','Armazém C'].map(w=><option key={w}>{w}</option>)}
              </select>
            </div>
            <div className="form-group"><label>Categoria</label><input value={form.category} onChange={e=>setForm({...form,category:e.target.value})} placeholder="Ex: Cabos" /></div>
          </div>
          <div className="form-actions">
            <button className="btn" onClick={()=>setShowForm(false)}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving?'A guardar...':'Guardar'}</button>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <span className="card-title">Gestão de Stock</span>
          <button className="btn btn-primary" onClick={()=>setShowForm(true)}><i className="ti ti-plus"/>Novo artigo</button>
        </div>
        <div className="tabs">
          <div className={`tab ${tab==='alerts'?'active':''}`} onClick={()=>setTab('alerts')}>
            Alertas de stock mínimo {items.length>0 && <span style={{background:'var(--red)',color:'white',borderRadius:10,fontSize:10,padding:'1px 6px',marginLeft:6,fontWeight:600}}>{items.length}</span>}
          </div>
          <div className={`tab ${tab==='all'?'active':''}`} onClick={()=>setTab('all')}>Todos os artigos ({allItems.length})</div>
        </div>

        {tab==='alerts' && (
          items.length===0
            ? <div className="empty">Stock em ordem! Nenhum artigo abaixo do mínimo.</div>
            : <div className="table-wrap">
                <table>
                  <thead><tr><th>Ref.</th><th>Descrição</th><th>Armazém</th><th>Atual</th><th>Mínimo</th><th>Nível</th><th>Alerta</th></tr></thead>
                  <tbody>
                    {items.map(a=>(
                      <tr key={a.id}>
                        <td style={{fontFamily:'var(--font-mono,monospace)',fontSize:12}}>{a.reference}</td>
                        <td>{a.description}</td>
                        <td style={{fontSize:12,color:'var(--text-muted)'}}>{a.warehouse}</td>
                        <td style={{fontWeight:600,color:a.stock_current===0?'var(--red)':''}}>{a.stock_current} {a.unit}</td>
                        <td>{a.stock_min} {a.unit}</td>
                        <td style={{width:100}}>
                          <div className="stock-bar">
                            <div className={`stock-fill ${a.alert_level==='Rotura'?'fill-red':'fill-amber'}`} style={{width:`${Math.min(100,a.pct_of_min||0)}%`}}/>
                          </div>
                          <div style={{fontSize:10,color:'var(--text-muted)',marginTop:2}}>{a.pct_of_min||0}%</div>
                        </td>
                        <td><span className={`badge ${a.alert_level==='Rotura'?'badge-critical':'badge-warning'}`}>{a.alert_level}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
        )}

        {tab==='all' && (
          allItems.length===0
            ? <div className="empty">Sem artigos. Adiciona o primeiro!</div>
            : <div className="table-wrap">
                <table>
                  <thead><tr><th>Ref.</th><th>Descrição</th><th>Categoria</th><th>Armazém</th><th>Atual</th><th>Mín.</th><th>Ideal</th></tr></thead>
                  <tbody>
                    {allItems.map(i=>(
                      <tr key={i.id}>
                        <td style={{fontFamily:'var(--font-mono,monospace)',fontSize:12}}>{i.reference}</td>
                        <td>{i.description}</td>
                        <td style={{fontSize:12,color:'var(--text-muted)'}}>{i.category||'—'}</td>
                        <td style={{fontSize:12,color:'var(--text-muted)'}}>{i.warehouse}</td>
                        <td style={{fontWeight:500}}>{i.stock_current} {i.unit}</td>
                        <td style={{color:'var(--text-muted)'}}>{i.stock_min} {i.unit}</td>
                        <td style={{color:'var(--text-muted)'}}>{i.stock_ideal} {i.unit}</td>
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
