import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

const euro = (v,d=0) => `€ ${parseFloat(v||0).toLocaleString('pt-PT',{minimumFractionDigits:d})}`

const MOVE_CLASS = {
  'Entrada':'badge-approved','Saída':'badge-warning','Venda':'badge-quotation',
  'Ajuste':'badge-pending','Devolução':'badge-ordered'
}
const MOVE_SIGN = { 'Entrada':'+','Saída':'-','Venda':'-','Ajuste':'±','Devolução':'+' }
const MOVE_COLOR = { 'Entrada':'var(--green)','Saída':'var(--amber)','Venda':'var(--blue)','Ajuste':'var(--text-muted)','Devolução':'var(--green)' }

export default function Stock() {
  const { session } = useAuth()
  const [items, setItems] = useState([])
  const [valuation, setValuation] = useState([])
  const [alerts, setAlerts] = useState([])
  const [categories, setCategories] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [clients, setClients] = useState([])
  const [affaires, setAffaires] = useState([])
  const [movements, setMovements] = useState([])
  const [sales, setSales] = useState([])
  const [purchases, setPurchases] = useState([])
  const [selected, setSelected] = useState(null)
  const [itemMovements, setItemMovements] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('stock')
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('')
  const [filterWh, setFilterWh] = useState('')

  // Forms
  const [showItemForm, setShowItemForm] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [showMoveForm, setShowMoveForm] = useState(false)
  const [showSaleForm, setShowSaleForm] = useState(false)
  const [showPurchaseForm, setShowPurchaseForm] = useState(false)
  const [saving, setSaving] = useState(false)

  const [itemForm, setItemForm] = useState({ reference:'', description:'', unit:'un.', stock_current:'0', stock_min:'0', stock_ideal:'0', warehouse:'Armazém A', category_id:'' })
  const [moveForm, setMoveForm] = useState({ item_id:'', movement_type:'Entrada', quantity:'', unit_cost:'', unit_price:'', supplier_id:'', client_id:'', affaire_id:'', invoice_ref:'', notes:'', movement_date:new Date().toISOString().split('T')[0] })
  const [saleForm, setSaleForm] = useState({ client_id:'', affaire_id:'', sale_date:new Date().toISOString().split('T')[0], status:'Orçamento', invoice_ref:'', notes:'', vat_rate:'23', vat_exempt:false, lines:[{item_id:'',description:'',quantity:'1',unit:'un.',unit_cost:'0',unit_price:'',discount_pct:'0'}] })
  const [purchaseForm, setPurchaseForm] = useState({ supplier_id:'', purchase_date:new Date().toISOString().split('T')[0], invoice_ref:'', status:'Pendente', notes:'', vat_rate:'23', vat_exempt:false, lines:[{item_id:'',description:'',quantity:'1',unit:'un.',unit_cost:''}] })

  const load = async () => {
    const [{ data: it }, { data: val }, { data: al }, { data: cats }, { data: sup }, { data: cli }, { data: aff }, { data: mv }, { data: sl }, { data: pu }] = await Promise.all([
      supabase.from('items').select('*, item_categories(name)').order('description'),
      supabase.from('stock_valuation').select('*').order('description'),
      supabase.from('stock_alerts').select('*'),
      supabase.from('item_categories').select('*').order('name'),
      supabase.from('suppliers').select('id,name').eq('active',true).order('name'),
      supabase.from('clients').select('id,name').eq('active',true).order('name'),
      supabase.from('affaires').select('id,name,ref_number').not('status','eq','Cancelada').order('ref_number'),
      supabase.from('stock_movements').select('*, items(description,unit), suppliers(name), clients(name), employees(emp_code)').order('movement_date',{ascending:false}).limit(50),
      supabase.from('sales').select('*, clients(name), affaires(name,ref_number), sale_items(*, items(description)), employees(emp_code)').order('sale_date',{ascending:false}),
      supabase.from('stock_purchases').select('*, suppliers(name), stock_purchase_items(*, items(description)), employees(emp_code)').order('purchase_date',{ascending:false}),
    ])
    setItems(it||[])
    setValuation(val||[])
    setAlerts(al||[])
    setCategories(cats||[])
    setSuppliers(sup||[])
    setClients(cli||[])
    setAffaires(aff||[])
    setMovements(mv||[])
    setSales(sl||[])
    setPurchases(pu||[])
    setLoading(false)
  }

  const loadItemMovements = async (itemId) => {
    const { data } = await supabase.from('stock_movements').select('*, suppliers(name), clients(name), employees(emp_code)').eq('item_id', itemId).order('movement_date',{ascending:false})
    setItemMovements(data||[])
  }

  useEffect(()=>{ load() },[])

  const getEmp = async () => {
    const { data } = await supabase.from('employees').select('id').eq('email', session?.user?.email).single()
    return data?.id || null
  }

  // Save article
  const handleItemSave = async () => {
    if (!itemForm.reference || !itemForm.description) return
    setSaving(true)
    const payload = { ...itemForm, stock_current:parseFloat(itemForm.stock_current)||0, stock_min:parseFloat(itemForm.stock_min)||0, stock_ideal:parseFloat(itemForm.stock_ideal)||0, category_id:itemForm.category_id||null }
    if (editItem) await supabase.from('items').update(payload).eq('id', editItem.id)
    else await supabase.from('items').insert(payload)
    setItemForm({ reference:'', description:'', unit:'un.', stock_current:'0', stock_min:'0', stock_ideal:'0', warehouse:'Armazém A', category_id:'' })
    setShowItemForm(false); setEditItem(null); setSaving(false); load()
  }

  const handleItemDelete = async (id) => {
    if (!confirm('Apagar este artigo?')) return
    const { error } = await supabase.from('items').delete().eq('id', id)
    if (error) { alert('Erro: '+error.message); return }
    if (selected?.id===id) setSelected(null)
    load()
  }

  // Save movement
  const handleMoveSave = async () => {
    if (!moveForm.item_id || !moveForm.quantity) return
    setSaving(true)
    const empId = await getEmp()
    const qty = parseFloat(moveForm.quantity)
    await supabase.from('stock_movements').insert({
      item_id: moveForm.item_id, movement_type: moveForm.movement_type,
      quantity: qty, unit_cost: moveForm.unit_cost ? parseFloat(moveForm.unit_cost) : null,
      unit_price: moveForm.unit_price ? parseFloat(moveForm.unit_price) : null,
      supplier_id: moveForm.supplier_id||null, client_id: moveForm.client_id||null,
      affaire_id: moveForm.affaire_id||null, invoice_ref: moveForm.invoice_ref||null,
      notes: moveForm.notes, movement_date: moveForm.movement_date,
      created_by: empId,
    })
    // Update stock_current
    const item = items.find(i=>i.id===moveForm.item_id)
    if (item) {
      const isIn = ['Entrada','Devolução'].includes(moveForm.movement_type)
      const newStock = parseFloat(item.stock_current||0) + (isIn ? qty : -qty)
      await supabase.from('items').update({ stock_current: Math.max(0,newStock) }).eq('id', moveForm.item_id)
    }
    setMoveForm({ item_id:'', movement_type:'Entrada', quantity:'', unit_cost:'', unit_price:'', supplier_id:'', client_id:'', affaire_id:'', invoice_ref:'', notes:'', movement_date:new Date().toISOString().split('T')[0] })
    setShowMoveForm(false); setSaving(false); load()
    if (selected) loadItemMovements(selected.id)
  }

  // Save sale
  const handleSaleSave = async () => {
    if (!saleForm.lines.some(l=>l.description&&l.quantity&&l.unit_price)) return
    setSaving(true)
    const empId = await getEmp()
    const { count } = await supabase.from('sales').select('*',{count:'exact',head:true})
    const { data: sale } = await supabase.from('sales').insert({
      ref_number: `VND-${String((count||0)+1).padStart(3,'0')}`,
      client_id: saleForm.client_id||null, affaire_id: saleForm.affaire_id||null,
      sale_date: saleForm.sale_date, status: saleForm.status,
      invoice_ref: saleForm.invoice_ref, notes: saleForm.notes,
      vat_rate: parseFloat(saleForm.vat_rate)||23, vat_exempt: saleForm.vat_exempt,
      created_by: empId,
    }).select().single()
    if (sale) {
      for (const l of saleForm.lines.filter(l=>l.description&&l.quantity&&l.unit_price)) {
        await supabase.from('sale_items').insert({
          sale_id: sale.id, item_id: l.item_id||null, description: l.description,
          quantity: parseFloat(l.quantity), unit: l.unit, unit_cost: parseFloat(l.unit_cost)||0,
          unit_price: parseFloat(l.unit_price), discount_pct: parseFloat(l.discount_pct)||0,
        })
        // Create stock exit movement if item linked
        if (l.item_id) {
          await supabase.from('stock_movements').insert({
            item_id: l.item_id, movement_type: 'Venda', quantity: parseFloat(l.quantity),
            unit_price: parseFloat(l.unit_price), unit_cost: parseFloat(l.unit_cost)||0,
            client_id: saleForm.client_id||null, affaire_id: saleForm.affaire_id||null,
            movement_date: saleForm.sale_date, created_by: empId, notes: `Venda ${sale.ref_number}`,
          })
          const item = items.find(i=>i.id===l.item_id)
          if (item) await supabase.from('items').update({ stock_current: Math.max(0, parseFloat(item.stock_current||0)-parseFloat(l.quantity)) }).eq('id', l.item_id)
        }
      }
    }
    setSaleForm({ client_id:'', affaire_id:'', sale_date:new Date().toISOString().split('T')[0], status:'Orçamento', invoice_ref:'', notes:'', vat_rate:'23', vat_exempt:false, lines:[{item_id:'',description:'',quantity:'1',unit:'un.',unit_cost:'0',unit_price:'',discount_pct:'0'}] })
    setShowSaleForm(false); setSaving(false); load()
  }

  // Save stock purchase
  const handlePurchaseSave = async () => {
    if (!saleForm.lines.some(l=>l.description&&l.quantity&&l.unit_cost)) return
    if (!purchaseForm.lines.some(l=>l.description&&l.quantity&&l.unit_cost)) return
    setSaving(true)
    const empId = await getEmp()
    const { count } = await supabase.from('stock_purchases').select('*',{count:'exact',head:true})
    const total = purchaseForm.lines.reduce((a,l)=>a+parseFloat(l.quantity||0)*parseFloat(l.unit_cost||0),0)
    const { data: purch } = await supabase.from('stock_purchases').insert({
      ref_number: `CPD-${String((count||0)+1).padStart(3,'0')}`,
      supplier_id: purchaseForm.supplier_id||null, purchase_date: purchaseForm.purchase_date,
      invoice_ref: purchaseForm.invoice_ref, status: purchaseForm.status,
      total_amount: total, vat_rate: parseFloat(purchaseForm.vat_rate)||23,
      vat_exempt: purchaseForm.vat_exempt, notes: purchaseForm.notes, created_by: empId,
    }).select().single()
    if (purch) {
      for (const l of purchaseForm.lines.filter(l=>l.description&&l.quantity&&l.unit_cost)) {
        await supabase.from('stock_purchase_items').insert({
          purchase_id: purch.id, item_id: l.item_id||null, description: l.description,
          quantity: parseFloat(l.quantity), unit: l.unit, unit_cost: parseFloat(l.unit_cost),
        })
        if (l.item_id) {
          await supabase.from('stock_movements').insert({
            item_id: l.item_id, movement_type: 'Entrada', quantity: parseFloat(l.quantity),
            unit_cost: parseFloat(l.unit_cost), supplier_id: purchaseForm.supplier_id||null,
            invoice_ref: purchaseForm.invoice_ref, movement_date: purchaseForm.purchase_date,
            created_by: empId, notes: `Compra ${purch.ref_number}`,
          })
          const item = items.find(i=>i.id===l.item_id)
          if (item) await supabase.from('items').update({ stock_current: parseFloat(item.stock_current||0)+parseFloat(l.quantity) }).eq('id', l.item_id)
        }
      }
    }
    setPurchaseForm({ supplier_id:'', purchase_date:new Date().toISOString().split('T')[0], invoice_ref:'', status:'Pendente', notes:'', vat_rate:'23', vat_exempt:false, lines:[{item_id:'',description:'',quantity:'1',unit:'un.',unit_cost:''}] })
    setShowPurchaseForm(false); setSaving(false); load()
  }

  const addSaleLine = () => setSaleForm(f=>({...f,lines:[...f.lines,{item_id:'',description:'',quantity:'1',unit:'un.',unit_cost:'0',unit_price:'',discount_pct:'0'}]}))
  const addPurchaseLine = () => setPurchaseForm(f=>({...f,lines:[...f.lines,{item_id:'',description:'',quantity:'1',unit:'un.',unit_cost:''}]}))
  const updateSaleLine = (i,k,v) => setSaleForm(f=>({...f,lines:f.lines.map((l,idx)=>idx===i?{...l,[k]:v}:l)}))
  const updatePurchaseLine = (i,k,v) => setPurchaseForm(f=>({...f,lines:f.lines.map((l,idx)=>idx===i?{...l,[k]:v}:l)}))
  const removeSaleLine = (i) => setSaleForm(f=>({...f,lines:f.lines.filter((_,idx)=>idx!==i)}))
  const removePurchaseLine = (i) => setPurchaseForm(f=>({...f,lines:f.lines.filter((_,idx)=>idx!==i)}))

  const autoFillFromItem = (itemId, type, lineIdx) => {
    const item = items.find(i=>i.id===itemId)
    const val = valuation.find(v=>v.id===itemId)
    if (!item) return
    if (type==='sale') {
      updateSaleLine(lineIdx,'item_id',itemId)
      updateSaleLine(lineIdx,'description',item.description)
      updateSaleLine(lineIdx,'unit',item.unit)
      if (val?.avg_cost) updateSaleLine(lineIdx,'unit_cost',parseFloat(val.avg_cost).toFixed(2))
    } else {
      updatePurchaseLine(lineIdx,'item_id',itemId)
      updatePurchaseLine(lineIdx,'description',item.description)
      updatePurchaseLine(lineIdx,'unit',item.unit)
    }
  }

  const warehouses = [...new Set(items.map(i=>i.warehouse).filter(Boolean))]
  const filtered = items.filter(i => {
    const s = search.toLowerCase()
    return (!s || i.description?.toLowerCase().includes(s) || i.reference?.toLowerCase().includes(s) || i.item_categories?.name?.toLowerCase().includes(s))
      && (!filterCat || i.category_id === filterCat)
      && (!filterWh || i.warehouse === filterWh)
  })

  // Stats
  const totalStockValue = valuation.reduce((a,v)=>a+parseFloat(v.stock_value||0),0)
  const totalRevenue = valuation.reduce((a,v)=>a+parseFloat(v.total_revenue||0),0)
  const totalMargin = valuation.reduce((a,v)=>a+parseFloat(v.gross_margin||0),0)
  const pendingSales = sales.filter(s=>['Orçamento','Confirmada'].includes(s.status)).length

  // Sale totals
  const calcSaleTotal = (lines, vatRate, vatExempt) => {
    const subtotal = lines.reduce((a,l)=>{
      const qty = parseFloat(l.quantity||0)
      const price = parseFloat(l.unit_price||0)
      const disc = parseFloat(l.discount_pct||0)
      return a + qty * price * (1-disc/100)
    },0)
    const vat = vatExempt ? 0 : subtotal * parseFloat(vatRate||23)/100
    return { subtotal, vat, total: subtotal+vat }
  }
  const calcPurchaseTotal = (lines, vatRate, vatExempt) => {
    const subtotal = lines.reduce((a,l)=>a+parseFloat(l.quantity||0)*parseFloat(l.unit_cost||0),0)
    const vat = vatExempt ? 0 : subtotal * parseFloat(vatRate||23)/100
    return { subtotal, vat, total: subtotal+vat }
  }

  if (loading) return <div className="loading"><i className="ti ti-loader-2"/>A carregar...</div>

  const saleCalc = calcSaleTotal(saleForm.lines, saleForm.vat_rate, saleForm.vat_exempt)
  const purchCalc = calcPurchaseTotal(purchaseForm.lines, purchaseForm.vat_rate, purchaseForm.vat_exempt)

  return (
    <div>
      {/* Métricas */}
      <div className="metrics" style={{marginBottom:16}}>
        <div className="metric">
          <div className="metric-label">Artigos em stock</div>
          <div className="metric-value text-blue">{items.length}</div>
          <div className="metric-sub text-red">{alerts.length} alertas</div>
        </div>
        <div className="metric">
          <div className="metric-label">Valor do stock</div>
          <div className="metric-value" style={{fontSize:15}}>{euro(totalStockValue)}</div>
        </div>
        <div className="metric">
          <div className="metric-label">Total vendido</div>
          <div className="metric-value text-green" style={{fontSize:15}}>{euro(totalRevenue)}</div>
        </div>
        <div className="metric">
          <div className="metric-label">Margem bruta</div>
          <div className={`metric-value ${totalMargin>=0?'text-green':'text-red'}`} style={{fontSize:15}}>{euro(totalMargin)}</div>
        </div>
        <div className="metric">
          <div className="metric-label">Vendas em aberto</div>
          <div className="metric-value text-amber">{pendingSales}</div>
        </div>
      </div>

      {/* Acções rápidas */}
      <div style={{display:'flex',gap:8,marginBottom:16,flexWrap:'wrap'}}>
        <button className="btn btn-primary" onClick={()=>{setShowMoveForm(true);setShowSaleForm(false);setShowPurchaseForm(false);setShowItemForm(false)}}><i className="ti ti-arrows-transfer-up"/>Movimento de stock</button>
        <button className="btn btn-primary" style={{background:'var(--green)',borderColor:'var(--green)'}} onClick={()=>{setShowSaleForm(true);setShowMoveForm(false);setShowPurchaseForm(false);setShowItemForm(false)}}><i className="ti ti-shopping-bag"/>Nova venda</button>
        <button className="btn" onClick={()=>{setShowPurchaseForm(true);setShowSaleForm(false);setShowMoveForm(false);setShowItemForm(false)}}><i className="ti ti-package-import"/>Compra directa para stock</button>
        <button className="btn" onClick={()=>{setShowItemForm(true);setShowSaleForm(false);setShowMoveForm(false);setShowPurchaseForm(false);setEditItem(null)}}><i className="ti ti-plus"/>Novo artigo</button>
      </div>

      {/* FORM: Movimento */}
      {showMoveForm && (
        <div className="card" style={{maxWidth:620,marginBottom:16}}>
          <div className="card-header"><span className="card-title">Registo de Movimento de Stock</span><button className="btn btn-sm" onClick={()=>setShowMoveForm(false)}><i className="ti ti-x"/></button></div>
          <div className="form-grid">
            <div className="form-group full"><label>Artigo *</label>
              <select value={moveForm.item_id} onChange={e=>setMoveForm({...moveForm,item_id:e.target.value})}>
                <option value="">Selecionar artigo...</option>
                {items.map(i=><option key={i.id} value={i.id}>{i.reference} — {i.description} (stock: {i.stock_current} {i.unit})</option>)}
              </select>
            </div>
            <div className="form-group"><label>Tipo de movimento *</label>
              <select value={moveForm.movement_type} onChange={e=>setMoveForm({...moveForm,movement_type:e.target.value})}>
                {['Entrada','Saída','Venda','Ajuste','Devolução'].map(t=><option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-group"><label>Quantidade *</label>
              <input type="number" step="0.01" value={moveForm.quantity} onChange={e=>setMoveForm({...moveForm,quantity:e.target.value})} />
            </div>
            {['Entrada','Devolução'].includes(moveForm.movement_type) && <>
              <div className="form-group"><label>Custo unitário (€)</label>
                <input type="number" step="0.01" value={moveForm.unit_cost} onChange={e=>setMoveForm({...moveForm,unit_cost:e.target.value})} />
              </div>
              <div className="form-group"><label>Fornecedor</label>
                <select value={moveForm.supplier_id} onChange={e=>setMoveForm({...moveForm,supplier_id:e.target.value})}>
                  <option value="">—</option>
                  {suppliers.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </>}
            {moveForm.movement_type==='Venda' && <>
              <div className="form-group"><label>Preço de venda (€)</label>
                <input type="number" step="0.01" value={moveForm.unit_price} onChange={e=>setMoveForm({...moveForm,unit_price:e.target.value})} />
              </div>
              <div className="form-group"><label>Cliente</label>
                <select value={moveForm.client_id} onChange={e=>setMoveForm({...moveForm,client_id:e.target.value})}>
                  <option value="">—</option>
                  {clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </>}
            <div className="form-group"><label>Data</label>
              <input type="date" value={moveForm.movement_date} onChange={e=>setMoveForm({...moveForm,movement_date:e.target.value})} />
            </div>
            <div className="form-group"><label>Ref. fatura</label>
              <input value={moveForm.invoice_ref} onChange={e=>setMoveForm({...moveForm,invoice_ref:e.target.value})} />
            </div>
            <div className="form-group full"><label>Notas</label>
              <input value={moveForm.notes} onChange={e=>setMoveForm({...moveForm,notes:e.target.value})} />
            </div>
          </div>
          <div className="form-actions">
            <button className="btn" onClick={()=>setShowMoveForm(false)}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleMoveSave} disabled={saving}>{saving?'A guardar...':'Registar movimento'}</button>
          </div>
        </div>
      )}

      {/* FORM: Venda */}
      {showSaleForm && (
        <div className="card" style={{marginBottom:16}}>
          <div className="card-header"><span className="card-title" style={{color:'var(--green)'}}>🛍️ Nova Venda</span><button className="btn btn-sm" onClick={()=>setShowSaleForm(false)}><i className="ti ti-x"/></button></div>
          <div className="form-grid" style={{marginBottom:14}}>
            <div className="form-group"><label>Cliente</label>
              <select value={saleForm.client_id} onChange={e=>setSaleForm({...saleForm,client_id:e.target.value})}>
                <option value="">— Selecionar —</option>
                {clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="form-group"><label>Negócio/Obra</label>
              <select value={saleForm.affaire_id} onChange={e=>setSaleForm({...saleForm,affaire_id:e.target.value})}>
                <option value="">— Sem obra —</option>
                {affaires.map(a=><option key={a.id} value={a.id}>{a.ref_number} — {a.name}</option>)}
              </select>
            </div>
            <div className="form-group"><label>Data</label>
              <input type="date" value={saleForm.sale_date} onChange={e=>setSaleForm({...saleForm,sale_date:e.target.value})} />
            </div>
            <div className="form-group"><label>Estado</label>
              <select value={saleForm.status} onChange={e=>setSaleForm({...saleForm,status:e.target.value})}>
                {['Orçamento','Confirmada','Faturada','Paga','Cancelada'].map(s=><option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="form-group"><label>Nº Fatura</label>
              <input value={saleForm.invoice_ref} onChange={e=>setSaleForm({...saleForm,invoice_ref:e.target.value})} />
            </div>
            <div className="form-group"><label>Taxa IVA (%)</label>
              <select value={saleForm.vat_rate} onChange={e=>setSaleForm({...saleForm,vat_rate:e.target.value})}>
                {['0','6','13','23'].map(r=><option key={r}>{r}</option>)}
              </select>
            </div>
            <div className="form-group" style={{flexDirection:'row',alignItems:'center',gap:8}}>
              <input type="checkbox" checked={saleForm.vat_exempt} onChange={e=>setSaleForm({...saleForm,vat_exempt:e.target.checked,vat_rate:e.target.checked?'0':'23'})} id="sale_vat_exempt" />
              <label htmlFor="sale_vat_exempt" style={{margin:0,cursor:'pointer'}}>✈️ Exportação / IVA 0%</label>
            </div>
          </div>

          {/* Linhas */}
          <div style={{marginBottom:12}}>
            <div style={{fontSize:12,fontWeight:600,marginBottom:8}}>Artigos / Serviços</div>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
              <thead><tr style={{borderBottom:'0.5px solid var(--border)'}}>
                <th style={{textAlign:'left',padding:'4px 6px'}}>Artigo</th>
                <th style={{textAlign:'left',padding:'4px 6px',width:60}}>Qtd.</th>
                <th style={{textAlign:'left',padding:'4px 6px',width:50}}>Un.</th>
                <th style={{textAlign:'left',padding:'4px 6px',width:90}}>Custo (€)</th>
                <th style={{textAlign:'left',padding:'4px 6px',width:90}}>Preço venda (€)</th>
                <th style={{textAlign:'left',padding:'4px 6px',width:60}}>Desc.%</th>
                <th style={{textAlign:'left',padding:'4px 6px',width:90}}>Total</th>
                <th style={{width:30}}></th>
              </tr></thead>
              <tbody>
                {saleForm.lines.map((l,i)=>(
                  <tr key={i} style={{borderBottom:'0.5px solid var(--border)'}}>
                    <td style={{padding:'4px 6px'}}>
                      <select value={l.item_id} onChange={e=>autoFillFromItem(e.target.value,'sale',i)} style={{width:'100%',fontSize:11,border:'0.5px solid var(--border-hover)',borderRadius:'var(--radius)',padding:'3px 4px',background:'var(--bg-card)',color:'var(--text)',fontFamily:'inherit'}}>
                        <option value="">Descrição livre</option>
                        {items.map(it=><option key={it.id} value={it.id}>{it.reference} — {it.description}</option>)}
                      </select>
                      {!l.item_id && <input value={l.description} onChange={e=>updateSaleLine(i,'description',e.target.value)} placeholder="Descrição" style={{width:'100%',marginTop:3,fontSize:11,border:'0.5px solid var(--border-hover)',borderRadius:'var(--radius)',padding:'3px 4px',background:'var(--bg-card)',color:'var(--text)',fontFamily:'inherit'}} />}
                    </td>
                    <td style={{padding:'4px 6px'}}><input type="number" step="0.01" value={l.quantity} onChange={e=>updateSaleLine(i,'quantity',e.target.value)} style={{width:'100%',fontSize:11,border:'0.5px solid var(--border-hover)',borderRadius:'var(--radius)',padding:'3px 4px',background:'var(--bg-card)',color:'var(--text)',fontFamily:'inherit'}} /></td>
                    <td style={{padding:'4px 6px'}}><input value={l.unit} onChange={e=>updateSaleLine(i,'unit',e.target.value)} style={{width:'100%',fontSize:11,border:'0.5px solid var(--border-hover)',borderRadius:'var(--radius)',padding:'3px 4px',background:'var(--bg-card)',color:'var(--text)',fontFamily:'inherit'}} /></td>
                    <td style={{padding:'4px 6px'}}><input type="number" step="0.01" value={l.unit_cost} onChange={e=>updateSaleLine(i,'unit_cost',e.target.value)} style={{width:'100%',fontSize:11,border:'0.5px solid var(--border-hover)',borderRadius:'var(--radius)',padding:'3px 4px',background:'var(--bg-card)',color:'var(--text)',fontFamily:'inherit'}} /></td>
                    <td style={{padding:'4px 6px'}}><input type="number" step="0.01" value={l.unit_price} onChange={e=>updateSaleLine(i,'unit_price',e.target.value)} style={{width:'100%',fontSize:11,border:'0.5px solid var(--border-hover)',borderRadius:'var(--radius)',padding:'3px 4px',background:'var(--bg-card)',color:'var(--text)',fontFamily:'inherit'}} /></td>
                    <td style={{padding:'4px 6px'}}><input type="number" value={l.discount_pct} onChange={e=>updateSaleLine(i,'discount_pct',e.target.value)} style={{width:'100%',fontSize:11,border:'0.5px solid var(--border-hover)',borderRadius:'var(--radius)',padding:'3px 4px',background:'var(--bg-card)',color:'var(--text)',fontFamily:'inherit'}} /></td>
                    <td style={{padding:'4px 6px',fontWeight:600,color:'var(--green)'}}>
                      {euro(parseFloat(l.quantity||0)*parseFloat(l.unit_price||0)*(1-parseFloat(l.discount_pct||0)/100),2)}
                    </td>
                    <td><button onClick={()=>removeSaleLine(i)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--red)',fontSize:14}}>✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button className="btn btn-sm" style={{marginTop:8}} onClick={addSaleLine}><i className="ti ti-plus"/>Linha</button>
          </div>

          {/* Totais venda */}
          <div style={{display:'flex',justifyContent:'flex-end',marginBottom:14}}>
            <div style={{width:280,fontSize:13}}>
              <div style={{display:'flex',justifyContent:'space-between',padding:'4px 0'}}><span style={{color:'var(--text-muted)'}}>Subtotal s/IVA:</span><strong>{euro(saleCalc.subtotal,2)}</strong></div>
              <div style={{display:'flex',justifyContent:'space-between',padding:'4px 0'}}><span style={{color:'var(--text-muted)'}}>{saleForm.vat_exempt?'IVA (exportação 0%)':`IVA ${saleForm.vat_rate}%`}:</span><span style={{color:saleForm.vat_exempt?'var(--green)':'var(--amber)'}}>{euro(saleCalc.vat,2)}</span></div>
              <div style={{display:'flex',justifyContent:'space-between',padding:'6px 0',borderTop:'1px solid var(--border)',fontWeight:700,fontSize:15}}><span>TOTAL:</span><span style={{color:'var(--green)'}}>{euro(saleCalc.total,2)}</span></div>
              <div style={{display:'flex',justifyContent:'space-between',padding:'2px 0',fontSize:11,color:'var(--text-muted)'}}><span>Margem bruta:</span><span style={{color:'var(--green)'}}>{euro(saleForm.lines.reduce((a,l)=>{const q=parseFloat(l.quantity||0),p=parseFloat(l.unit_price||0),c=parseFloat(l.unit_cost||0),d=parseFloat(l.discount_pct||0)/100;return a+q*(p*(1-d)-c)},0),2)}</span></div>
            </div>
          </div>

          <div className="form-actions">
            <button className="btn" onClick={()=>setShowSaleForm(false)}>Cancelar</button>
            <button className="btn btn-primary" style={{background:'var(--green)',borderColor:'var(--green)'}} onClick={handleSaleSave} disabled={saving}>{saving?'A guardar...':'Guardar Venda'}</button>
          </div>
        </div>
      )}

      {/* FORM: Compra directa */}
      {showPurchaseForm && (
        <div className="card" style={{marginBottom:16}}>
          <div className="card-header"><span className="card-title">📦 Compra Directa para Stock</span><button className="btn btn-sm" onClick={()=>setShowPurchaseForm(false)}><i className="ti ti-x"/></button></div>
          <div className="form-grid" style={{marginBottom:14}}>
            <div className="form-group"><label>Fornecedor</label>
              <select value={purchaseForm.supplier_id} onChange={e=>setPurchaseForm({...purchaseForm,supplier_id:e.target.value})}>
                <option value="">— Selecionar —</option>
                {suppliers.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="form-group"><label>Data</label>
              <input type="date" value={purchaseForm.purchase_date} onChange={e=>setPurchaseForm({...purchaseForm,purchase_date:e.target.value})} />
            </div>
            <div className="form-group"><label>Estado</label>
              <select value={purchaseForm.status} onChange={e=>setPurchaseForm({...purchaseForm,status:e.target.value})}>
                {['Pendente','Recebido','Pago'].map(s=><option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="form-group"><label>Nº Fatura</label>
              <input value={purchaseForm.invoice_ref} onChange={e=>setPurchaseForm({...purchaseForm,invoice_ref:e.target.value})} />
            </div>
            <div className="form-group"><label>Taxa IVA (%)</label>
              <select value={purchaseForm.vat_rate} onChange={e=>setPurchaseForm({...purchaseForm,vat_rate:e.target.value})}>
                {['0','6','13','23'].map(r=><option key={r}>{r}</option>)}
              </select>
            </div>
            <div className="form-group" style={{flexDirection:'row',alignItems:'center',gap:8}}>
              <input type="checkbox" checked={purchaseForm.vat_exempt} onChange={e=>setPurchaseForm({...purchaseForm,vat_exempt:e.target.checked,vat_rate:e.target.checked?'0':'23'})} id="purch_vat_exempt" />
              <label htmlFor="purch_vat_exempt" style={{margin:0,cursor:'pointer'}}>✈️ IVA 0% / Importação</label>
            </div>
          </div>

          <div style={{marginBottom:12}}>
            <div style={{fontSize:12,fontWeight:600,marginBottom:8}}>Artigos</div>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
              <thead><tr style={{borderBottom:'0.5px solid var(--border)'}}>
                <th style={{textAlign:'left',padding:'4px 6px'}}>Artigo</th>
                <th style={{textAlign:'left',padding:'4px 6px',width:60}}>Qtd.</th>
                <th style={{textAlign:'left',padding:'4px 6px',width:50}}>Un.</th>
                <th style={{textAlign:'left',padding:'4px 6px',width:100}}>Custo unit. (€)</th>
                <th style={{textAlign:'left',padding:'4px 6px',width:90}}>Total</th>
                <th style={{width:30}}></th>
              </tr></thead>
              <tbody>
                {purchaseForm.lines.map((l,i)=>(
                  <tr key={i} style={{borderBottom:'0.5px solid var(--border)'}}>
                    <td style={{padding:'4px 6px'}}>
                      <select value={l.item_id} onChange={e=>autoFillFromItem(e.target.value,'purchase',i)} style={{width:'100%',fontSize:11,border:'0.5px solid var(--border-hover)',borderRadius:'var(--radius)',padding:'3px 4px',background:'var(--bg-card)',color:'var(--text)',fontFamily:'inherit'}}>
                        <option value="">Selecionar artigo...</option>
                        {items.map(it=><option key={it.id} value={it.id}>{it.reference} — {it.description}</option>)}
                      </select>
                      {!l.item_id && <input value={l.description} onChange={e=>updatePurchaseLine(i,'description',e.target.value)} placeholder="Descrição" style={{width:'100%',marginTop:3,fontSize:11,border:'0.5px solid var(--border-hover)',borderRadius:'var(--radius)',padding:'3px 4px',background:'var(--bg-card)',color:'var(--text)',fontFamily:'inherit'}} />}
                    </td>
                    <td style={{padding:'4px 6px'}}><input type="number" step="0.01" value={l.quantity} onChange={e=>updatePurchaseLine(i,'quantity',e.target.value)} style={{width:'100%',fontSize:11,border:'0.5px solid var(--border-hover)',borderRadius:'var(--radius)',padding:'3px 4px',background:'var(--bg-card)',color:'var(--text)',fontFamily:'inherit'}} /></td>
                    <td style={{padding:'4px 6px'}}><input value={l.unit} onChange={e=>updatePurchaseLine(i,'unit',e.target.value)} style={{width:'100%',fontSize:11,border:'0.5px solid var(--border-hover)',borderRadius:'var(--radius)',padding:'3px 4px',background:'var(--bg-card)',color:'var(--text)',fontFamily:'inherit'}} /></td>
                    <td style={{padding:'4px 6px'}}><input type="number" step="0.01" value={l.unit_cost} onChange={e=>updatePurchaseLine(i,'unit_cost',e.target.value)} style={{width:'100%',fontSize:11,border:'0.5px solid var(--border-hover)',borderRadius:'var(--radius)',padding:'3px 4px',background:'var(--bg-card)',color:'var(--text)',fontFamily:'inherit'}} /></td>
                    <td style={{padding:'4px 6px',fontWeight:600}}>{euro(parseFloat(l.quantity||0)*parseFloat(l.unit_cost||0),2)}</td>
                    <td><button onClick={()=>removePurchaseLine(i)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--red)',fontSize:14}}>✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button className="btn btn-sm" style={{marginTop:8}} onClick={addPurchaseLine}><i className="ti ti-plus"/>Linha</button>
          </div>

          <div style={{display:'flex',justifyContent:'flex-end',marginBottom:14}}>
            <div style={{width:260,fontSize:13}}>
              <div style={{display:'flex',justifyContent:'space-between',padding:'4px 0'}}><span style={{color:'var(--text-muted)'}}>Subtotal s/IVA:</span><strong>{euro(purchCalc.subtotal,2)}</strong></div>
              <div style={{display:'flex',justifyContent:'space-between',padding:'4px 0'}}><span style={{color:'var(--text-muted)'}}>{purchaseForm.vat_exempt?'IVA 0%':`IVA ${purchaseForm.vat_rate}%`}:</span><span style={{color:'var(--amber)'}}>{euro(purchCalc.vat,2)}</span></div>
              <div style={{display:'flex',justifyContent:'space-between',padding:'6px 0',borderTop:'1px solid var(--border)',fontWeight:700,fontSize:15}}><span>TOTAL:</span><span>{euro(purchCalc.total,2)}</span></div>
            </div>
          </div>

          <div className="form-actions">
            <button className="btn" onClick={()=>setShowPurchaseForm(false)}>Cancelar</button>
            <button className="btn btn-primary" onClick={handlePurchaseSave} disabled={saving}>{saving?'A guardar...':'Guardar Compra'}</button>
          </div>
        </div>
      )}

      {/* FORM: Artigo */}
      {showItemForm && (
        <div className="card" style={{maxWidth:600,marginBottom:16}}>
          <div className="card-header"><span className="card-title">{editItem?'Editar Artigo':'Novo Artigo'}</span><button className="btn btn-sm" onClick={()=>{setShowItemForm(false);setEditItem(null)}}><i className="ti ti-x"/></button></div>
          <div className="form-grid">
            <div className="form-group"><label>Referência *</label><input value={itemForm.reference} onChange={e=>setItemForm({...itemForm,reference:e.target.value})} /></div>
            <div className="form-group"><label>Unidade</label>
              <select value={itemForm.unit} onChange={e=>setItemForm({...itemForm,unit:e.target.value})}>
                {['un.','m','m²','m³','kg','t','lt','cx','rolo','vara','bte','saco','pct'].map(u=><option key={u}>{u}</option>)}
              </select>
            </div>
            <div className="form-group full"><label>Descrição *</label><input value={itemForm.description} onChange={e=>setItemForm({...itemForm,description:e.target.value})} /></div>
            <div className="form-group full"><label>Categoria</label>
              <select value={itemForm.category_id} onChange={e=>setItemForm({...itemForm,category_id:e.target.value})}>
                <option value="">— Sem categoria —</option>
                {categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="form-group"><label>Stock actual</label><input type="number" value={itemForm.stock_current} onChange={e=>setItemForm({...itemForm,stock_current:e.target.value})} /></div>
            <div className="form-group"><label>Stock mínimo</label><input type="number" value={itemForm.stock_min} onChange={e=>setItemForm({...itemForm,stock_min:e.target.value})} /></div>
            <div className="form-group"><label>Stock ideal</label><input type="number" value={itemForm.stock_ideal} onChange={e=>setItemForm({...itemForm,stock_ideal:e.target.value})} /></div>
            <div className="form-group"><label>Armazém</label>
              <select value={itemForm.warehouse} onChange={e=>setItemForm({...itemForm,warehouse:e.target.value})}>
                {['Armazém A','Armazém B','Armazém C','Armazém D','Externo'].map(w=><option key={w}>{w}</option>)}
              </select>
            </div>
          </div>
          <div className="form-actions">
            <button className="btn" onClick={()=>{setShowItemForm(false);setEditItem(null)}}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleItemSave} disabled={saving}>{saving?'A guardar...':editItem?'Guardar':'Criar artigo'}</button>
          </div>
        </div>
      )}

      {/* TABS PRINCIPAIS */}
      <div className="card">
        <div className="tabs">
          <div className={`tab ${tab==='stock'?'active':''}`} onClick={()=>setTab('stock')}>
            Stock {alerts.length>0&&<span style={{background:'var(--red)',color:'white',borderRadius:10,fontSize:10,padding:'1px 5px',marginLeft:3}}>{alerts.length}</span>}
          </div>
          <div className={`tab ${tab==='valuation'?'active':''}`} onClick={()=>setTab('valuation')}>Valorização</div>
          <div className={`tab ${tab==='movements'?'active':''}`} onClick={()=>setTab('movements')}>Movimentos ({movements.length})</div>
          <div className={`tab ${tab==='sales'?'active':''}`} onClick={()=>setTab('sales')}>Vendas ({sales.length})</div>
          <div className={`tab ${tab==='purchases'?'active':''}`} onClick={()=>setTab('purchases')}>Compras diretas ({purchases.length})</div>
        </div>

        {/* STOCK */}
        {tab==='stock' && (
          <>
            <div style={{display:'flex',gap:8,marginBottom:12,flexWrap:'wrap'}}>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Pesquisar artigo..." style={{flex:1,minWidth:160,border:'0.5px solid var(--border-hover)',borderRadius:'var(--radius)',padding:'6px 10px',fontSize:13,background:'var(--bg-card)',color:'var(--text)',fontFamily:'inherit'}} />
              <select value={filterCat} onChange={e=>setFilterCat(e.target.value)} style={{border:'0.5px solid var(--border-hover)',borderRadius:'var(--radius)',padding:'6px 8px',fontSize:12,background:'var(--bg-card)',color:'var(--text)',fontFamily:'inherit'}}>
                <option value="">Todas categorias</option>
                {categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select value={filterWh} onChange={e=>setFilterWh(e.target.value)} style={{border:'0.5px solid var(--border-hover)',borderRadius:'var(--radius)',padding:'6px 8px',fontSize:12,background:'var(--bg-card)',color:'var(--text)',fontFamily:'inherit'}}>
                <option value="">Todos armazéns</option>
                {warehouses.map(w=><option key={w}>{w}</option>)}
              </select>
              {(search||filterCat||filterWh)&&<button className="btn" onClick={()=>{setSearch('');setFilterCat('');setFilterWh('')}}>✕</button>}
            </div>
            {filtered.length===0 ? <div className="empty">Sem artigos.</div>
              : <table>
                  <thead><tr><th>Ref.</th><th>Descrição</th><th>Categoria</th><th>Arm.</th><th>Stock</th><th>Mín.</th><th>Custo méd.</th><th>Valor stock</th><th>Ações</th></tr></thead>
                  <tbody>
                    {filtered.map(i=>{
                      const v = valuation.find(v=>v.id===i.id)
                      const isAlert = parseFloat(i.stock_current) < parseFloat(i.stock_min)
                      return (
                        <tr key={i.id} style={{background:isAlert?'rgba(226,75,74,0.04)':''}}>
                          <td style={{fontFamily:'monospace',fontSize:11}}>{i.reference}</td>
                          <td style={{cursor:'pointer'}} onClick={()=>{setSelected(selected?.id===i.id?null:i);if(selected?.id!==i.id)loadItemMovements(i.id)}}>{i.description}</td>
                          <td style={{fontSize:11,color:'var(--text-muted)'}}>{i.item_categories?.name||'—'}</td>
                          <td style={{fontSize:11,color:'var(--text-muted)'}}>{i.warehouse}</td>
                          <td style={{fontWeight:600,color:isAlert?'var(--red)':''}}>{i.stock_current} {i.unit}</td>
                          <td style={{color:'var(--text-muted)'}}>{i.stock_min} {i.unit}</td>
                          <td style={{fontSize:12}}>{v?.avg_cost?euro(v.avg_cost,2):'—'}</td>
                          <td style={{fontWeight:500}}>{v?.stock_value?euro(v.stock_value):'—'}</td>
                          <td>
                            <div style={{display:'flex',gap:4}}>
                              <button className="btn btn-sm" title="Editar" onClick={()=>{setEditItem(i);setItemForm({reference:i.reference,description:i.description,unit:i.unit,stock_current:i.stock_current,stock_min:i.stock_min,stock_ideal:i.stock_ideal,warehouse:i.warehouse,category_id:i.category_id||''});setShowItemForm(true)}}><i className="ti ti-edit"/></button>
                              <button className="btn btn-sm" title="Movimento" onClick={()=>{setMoveForm({...moveForm,item_id:i.id});setShowMoveForm(true)}}><i className="ti ti-arrows-transfer-up"/></button>
                              <button className="btn btn-sm" style={{color:'var(--red)'}} onClick={()=>handleItemDelete(i.id)}><i className="ti ti-trash"/></button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
            }
            {selected && (
              <div style={{marginTop:16,padding:'14px',background:'var(--bg)',borderRadius:'var(--radius)',borderLeft:'3px solid var(--blue)'}}>
                <div style={{fontWeight:600,fontSize:14,marginBottom:10}}>{selected.description} — Histórico de movimentos</div>
                {itemMovements.length===0 ? <div style={{fontSize:12,color:'var(--text-muted)'}}>Sem movimentos registados.</div>
                  : <table>
                      <thead><tr><th>Data</th><th>Tipo</th><th>Qtd.</th><th>Custo/Preço</th><th>Total</th><th>Origem/Destino</th><th>Por</th><th>Notas</th></tr></thead>
                      <tbody>
                        {itemMovements.map(m=>(
                          <tr key={m.id}>
                            <td style={{fontSize:12}}>{new Date(m.movement_date).toLocaleDateString('pt-PT')}</td>
                            <td><span className={`badge ${MOVE_CLASS[m.movement_type]||''}`}>{m.movement_type}</span></td>
                            <td style={{fontWeight:600,color:MOVE_COLOR[m.movement_type]}}>{MOVE_SIGN[m.movement_type]}{m.quantity} {m.items?.unit}</td>
                            <td style={{fontSize:12}}>{m.unit_cost?`c: ${euro(m.unit_cost,2)}`:'—'} {m.unit_price?`v: ${euro(m.unit_price,2)}`:''}</td>
                            <td style={{fontSize:12,fontWeight:500}}>{m.total_amount?euro(m.total_amount,2):'—'}</td>
                            <td style={{fontSize:11,color:'var(--text-muted)'}}>{m.suppliers?.name||m.clients?.name||'—'}</td>
                            <td style={{fontSize:11}}>{m.employees?.emp_code||'—'}</td>
                            <td style={{fontSize:11,color:'var(--text-muted)'}}>{m.notes||'—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                }
              </div>
            )}
          </>
        )}

        {/* VALORIZAÇÃO */}
        {tab==='valuation' && (
          <table>
            <thead><tr><th>Artigo</th><th>Stock</th><th>Custo médio</th><th>Último custo</th><th>Valor stock</th><th>Total entradas</th><th>Total saídas</th><th>Vendido (€)</th><th>Margem bruta</th></tr></thead>
            <tbody>
              {valuation.map(v=>(
                <tr key={v.id}>
                  <td>
                    <div style={{fontWeight:500}}>{v.description}</div>
                    <div style={{fontSize:11,color:'var(--text-muted)'}}>{v.reference} · {v.warehouse}</div>
                  </td>
                  <td style={{fontWeight:500,color:parseFloat(v.stock_current)<parseFloat(v.stock_min)?'var(--red)':''}}>{v.stock_current} {v.unit}</td>
                  <td>{v.avg_cost?euro(v.avg_cost,2):'—'}</td>
                  <td style={{fontSize:12,color:'var(--text-muted)'}}>{v.last_purchase_cost?euro(v.last_purchase_cost,2):'—'}</td>
                  <td style={{fontWeight:600}}>{v.stock_value?euro(v.stock_value):'—'}</td>
                  <td style={{color:'var(--green)',fontSize:12}}>{v.total_in} {v.unit}</td>
                  <td style={{color:'var(--amber)',fontSize:12}}>{v.total_out} {v.unit}</td>
                  <td style={{fontWeight:500,color:'var(--blue)'}}>{v.total_revenue?euro(v.total_revenue):'—'}</td>
                  <td style={{fontWeight:600,color:parseFloat(v.gross_margin||0)>=0?'var(--green)':'var(--red)'}}>{v.gross_margin?euro(v.gross_margin):'—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* MOVIMENTOS */}
        {tab==='movements' && (
          movements.length===0 ? <div className="empty">Sem movimentos.</div>
          : <table>
              <thead><tr><th>Data</th><th>Artigo</th><th>Tipo</th><th>Qtd.</th><th>Custo/Preço</th><th>Total</th><th>Fornecedor/Cliente</th><th>Por</th><th>Notas</th></tr></thead>
              <tbody>
                {movements.map(m=>(
                  <tr key={m.id}>
                    <td style={{fontSize:12}}>{new Date(m.movement_date).toLocaleDateString('pt-PT')}</td>
                    <td style={{fontSize:12,maxWidth:140,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{m.items?.description||'—'}</td>
                    <td><span className={`badge ${MOVE_CLASS[m.movement_type]||''}`}>{m.movement_type}</span></td>
                    <td style={{fontWeight:600,color:MOVE_COLOR[m.movement_type]}}>{MOVE_SIGN[m.movement_type]}{m.quantity} {m.items?.unit}</td>
                    <td style={{fontSize:12}}>{m.unit_cost?`c: ${euro(m.unit_cost,2)}`:''}{m.unit_price?`v: ${euro(m.unit_price,2)}`:''}{!m.unit_cost&&!m.unit_price?'—':''}</td>
                    <td style={{fontSize:12,fontWeight:500}}>{m.total_amount?euro(m.total_amount,2):'—'}</td>
                    <td style={{fontSize:11,color:'var(--text-muted)'}}>{m.suppliers?.name||m.clients?.name||'—'}</td>
                    <td style={{fontSize:11}}>{m.employees?.emp_code||'—'}</td>
                    <td style={{fontSize:11,color:'var(--text-muted)',maxWidth:120,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{m.invoice_ref||m.notes||'—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
        )}

        {/* VENDAS */}
        {tab==='sales' && (
          sales.length===0 ? <div className="empty">Sem vendas. Cria a primeira!</div>
          : sales.map(s=>{
              const subtotal = s.sale_items?.reduce((a,l)=>a+parseFloat(l.quantity||0)*parseFloat(l.unit_price||0)*(1-parseFloat(l.discount_pct||0)/100),0)||0
              const vat = s.vat_exempt ? 0 : subtotal * parseFloat(s.vat_rate||23)/100
              const margin = s.sale_items?.reduce((a,l)=>{const q=parseFloat(l.quantity||0),p=parseFloat(l.unit_price||0),c=parseFloat(l.unit_cost||0),d=parseFloat(l.discount_pct||0)/100;return a+q*(p*(1-d)-c)},0)||0
              return (
                <div key={s.id} style={{padding:'12px 0',borderBottom:'0.5px solid var(--border)'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:8,flexWrap:'wrap'}}>
                    <div style={{flex:1}}>
                      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                        <span style={{fontWeight:700}}>{s.ref_number}</span>
                        <span className={`badge ${{Orçamento:'badge-pending',Confirmada:'badge-quotation',Faturada:'badge-ordered',Paga:'badge-delivered',Cancelada:'badge-cancelled'}[s.status]||''}`}>{s.status}</span>
                        {s.vat_exempt && <span style={{fontSize:10,color:'var(--green)',background:'var(--green-light)',padding:'1px 6px',borderRadius:10}}>✈️ IVA 0%</span>}
                      </div>
                      <div style={{fontSize:12,color:'var(--text-muted)'}}>
                        {s.clients?.name||'—'} {s.affaires?`· ${s.affaires.ref_number}`:''} · {new Date(s.sale_date).toLocaleDateString('pt-PT')} · por {s.employees?.emp_code||'—'}
                      </div>
                      {s.sale_items?.map((l,i)=>(
                        <div key={i} style={{fontSize:12,marginTop:3,color:'var(--text-muted)'}}>
                          • {l.quantity} {l.unit} × {l.description} @ {euro(l.unit_price,2)} {l.discount_pct>0?`(-${l.discount_pct}%)`:''}
                          <span style={{color:'var(--green)',marginLeft:6}}>{euro(parseFloat(l.quantity)*parseFloat(l.unit_price)*(1-parseFloat(l.discount_pct||0)/100),2)}</span>
                        </div>
                      ))}
                    </div>
                    <div style={{textAlign:'right',flexShrink:0}}>
                      <div style={{fontSize:16,fontWeight:700,color:'var(--green)'}}>{euro(subtotal+vat,2)}</div>
                      <div style={{fontSize:11,color:'var(--text-muted)'}}>s/IVA: {euro(subtotal,2)} + IVA: {euro(vat,2)}</div>
                      <div style={{fontSize:11,color:'var(--green)',fontWeight:500}}>Margem: {euro(margin,2)}</div>
                    </div>
                  </div>
                </div>
              )
            })
        )}

        {/* COMPRAS DIRETAS */}
        {tab==='purchases' && (
          purchases.length===0 ? <div className="empty">Sem compras diretas.</div>
          : purchases.map(p=>{
              const subtotal = p.stock_purchase_items?.reduce((a,l)=>a+parseFloat(l.quantity||0)*parseFloat(l.unit_cost||0),0)||0
              const vat = p.vat_exempt ? 0 : subtotal * parseFloat(p.vat_rate||23)/100
              return (
                <div key={p.id} style={{padding:'12px 0',borderBottom:'0.5px solid var(--border)'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:8,flexWrap:'wrap'}}>
                    <div style={{flex:1}}>
                      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                        <span style={{fontWeight:700}}>{p.ref_number}</span>
                        <span className={`badge ${{Pendente:'badge-pending',Recebido:'badge-quotation',Pago:'badge-delivered'}[p.status]||''}`}>{p.status}</span>
                        {p.vat_exempt && <span style={{fontSize:10,color:'var(--green)',background:'var(--green-light)',padding:'1px 6px',borderRadius:10}}>✈️ IVA 0%</span>}
                      </div>
                      <div style={{fontSize:12,color:'var(--text-muted)'}}>
                        {p.suppliers?.name||'—'} · {new Date(p.purchase_date).toLocaleDateString('pt-PT')} · por {p.employees?.emp_code||'—'}
                        {p.invoice_ref && ` · Fatura: ${p.invoice_ref}`}
                      </div>
                      {p.stock_purchase_items?.map((l,i)=>(
                        <div key={i} style={{fontSize:12,marginTop:3,color:'var(--text-muted)'}}>
                          • {l.quantity} {l.unit} × {l.description} @ {euro(l.unit_cost,2)}
                          <span style={{marginLeft:6,fontWeight:500}}>{euro(parseFloat(l.quantity)*parseFloat(l.unit_cost),2)}</span>
                        </div>
                      ))}
                    </div>
                    <div style={{textAlign:'right',flexShrink:0}}>
                      <div style={{fontSize:16,fontWeight:700}}>{euro(subtotal+vat,2)}</div>
                      <div style={{fontSize:11,color:'var(--text-muted)'}}>s/IVA: {euro(subtotal,2)} + IVA: {euro(vat,2)}</div>
                    </div>
                  </div>
                </div>
              )
            })
        )}
      </div>
    </div>
  )
}
