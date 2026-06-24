import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { logActivity } from '../hooks/useActivity'
import { useRole } from '../hooks/useRole'

function ImageFromStorage({ path }) {
  const [url, setUrl] = useState(null)
  useEffect(() => {
    if (!path) return
    if (path.startsWith('http') || path.startsWith('data:')) { setUrl(path); return }
    supabase.storage.from('procureflow-docs').createSignedUrl(path, 3600)
      .then(({ data }) => { if (data?.signedUrl) setUrl(data.signedUrl) })
  }, [path])
  if (!url) return null
  return <img src={url} alt="ref" style={{maxWidth:'100%',maxHeight:120,borderRadius:'var(--border-radius-md)',objectFit:'contain',border:'0.5px solid var(--border)',background:'var(--bg)'}} />
}

export default function Quotations() {
  const { session } = useAuth()
  const { isAdmin } = useRole()
  const [reqs, setReqs] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [quotes, setQuotes] = useState([])
  const [followups, setFollowups] = useState({})
  const [selReq, setSelReq] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [editQuote, setEditQuote] = useState(null)
  const [showFollowup, setShowFollowup] = useState(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [affaires, setAffaires] = useState([])
  const [filterAffaire, setFilterAffaire] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [form, setForm] = useState({ supplier_id:'', supplier_ref:'', unit_price:'', discount_pct:'0', delivery_price:'', delivery_days:'', carrier_id:'', transport_forfait:'', valid_until:'', payment_terms:'30 dias', notes:'', vat_rate:'23', vat_exempt:false, price_includes_vat:false, delivery_type:'', delivery_address:'', delivery_city:'' })
  const [followupForm, setFollowupForm] = useState({ contact_type:'Telefone', notes:'', next_followup:'' })
  const [saving, setSaving] = useState(false)
  const [showProposal, setShowProposal] = useState(false)
  const [proposalConfig, setProposalConfig] = useState({ margin:0, selectedQuotes:[], showVat:true, groupByAffaire:false, affaireId:'', lang:'pt' })
  const [carriers, setCarriers] = useState([])
  const [lang, setLang] = useState('pt')

  useEffect(() => {
    async function load() {
      const [{ data: rData }, { data: affData }, { data: sData }, { data: cData }] = await Promise.all([
        supabase.from('requisitions').select('*, affaires(name,ref_number,id), employees(full_name,emp_code)').not('status','eq','Entregue').not('status','eq','Cancelado').order('created_at',{ascending:false}),
        supabase.from('affaires').select('id,name,ref_number').not('status','eq','Cancelada').order('ref_number'),
        supabase.from('suppliers').select('*').eq('active',true).order('name'),
        supabase.from('carriers').select('id,name,phone,base_price,price_type,currency').eq('active',true).order('name'),
      ])
      setReqs(rData||[])
      setAffaires(affData||[])
      setSuppliers(sData||[])
      setCarriers(cData||[])
      setLoading(false)
    }
    load()
  }, [])

  const loadQuotes = async (reqId) => {
    setLoading(true)
    const { data } = await supabase.from('quotations').select('*, suppliers(name), employees(full_name, emp_code)').eq('requisition_id', reqId).order('final_price')
    setQuotes(data||[])
    setLoading(false)
  }

  const loadFollowups = async (quoteId) => {
    const { data } = await supabase.from('quotation_followups').select('*, employees(full_name, emp_code)').eq('quotation_id', quoteId).order('contact_date', { ascending: false })
    setFollowups(f => ({ ...f, [quoteId]: data||[] }))
  }

  const selectReq = (r) => { setSelReq(r); loadQuotes(r.id) }

  const openEdit = (q) => {
    setEditQuote(q)
    setForm({ supplier_id:q.supplier_id, supplier_ref:q.supplier_ref||'', unit_price:q.unit_price, discount_pct:q.discount_pct, delivery_price:q.delivery_price||'', delivery_days:q.delivery_days||'', carrier_id:q.carrier_id||'', transport_forfait:q.transport_forfait||'', valid_until:q.valid_until||'', payment_terms:q.payment_terms||'30 dias', notes:q.notes||'', vat_rate:q.vat_rate||'23', vat_exempt:q.vat_exempt||false, price_includes_vat:q.price_includes_vat||false, delivery_type:q.delivery_type||'', delivery_address:q.delivery_address||'', delivery_city:q.delivery_city||'' })
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.supplier_id || !form.unit_price) return
    setSaving(true)
    const { data: emp } = await supabase.from('employees').select('id').eq('email', session?.user?.email).single()
    if (editQuote) {
      await supabase.from('quotations').update({
        supplier_id: form.supplier_id, supplier_ref: form.supplier_ref, unit_price: parseFloat(form.unit_price),
        discount_pct: parseFloat(form.discount_pct)||0, delivery_price: form.delivery_price?parseFloat(form.delivery_price):null, delivery_days: parseInt(form.delivery_days)||null, carrier_id: form.carrier_id||null, transport_forfait: form.transport_forfait?parseFloat(form.transport_forfait):null,
        valid_until: form.valid_until||null, payment_terms: form.payment_terms, notes: form.notes,
        vat_rate: parseFloat(form.vat_rate)||23, vat_exempt: form.vat_exempt, price_includes_vat: form.price_includes_vat,
        delivery_type: form.delivery_type||null, delivery_address: form.delivery_address||null, delivery_city: form.delivery_city||null,
      }).eq('id', editQuote.id)
    } else {
      await supabase.from('quotations').insert({
        requisition_id: selReq.id, supplier_id: form.supplier_id, created_by: emp?.id||null,
        supplier_ref: form.supplier_ref, unit_price: parseFloat(form.unit_price),
        discount_pct: parseFloat(form.discount_pct)||0, delivery_price: form.delivery_price?parseFloat(form.delivery_price):null, delivery_days: parseInt(form.delivery_days)||null, carrier_id: form.carrier_id||null, transport_forfait: form.transport_forfait?parseFloat(form.transport_forfait):null,
        valid_until: form.valid_until||null, payment_terms: form.payment_terms, notes: form.notes,
        vat_rate: parseFloat(form.vat_rate)||23, vat_exempt: form.vat_exempt, price_includes_vat: form.price_includes_vat,
        delivery_type: form.delivery_type||null, delivery_address: form.delivery_address||null, delivery_city: form.delivery_city||null,
      })
      await supabase.from('requisitions').update({ status:'Em cotação' }).eq('id', selReq.id)
    }
    setForm({ supplier_id:'', supplier_ref:'', unit_price:'', discount_pct:'0', delivery_days:'', valid_until:'', payment_terms:'30 dias', notes:'' })
    setShowForm(false); setEditQuote(null); setSaving(false)
    loadQuotes(selReq.id)
  }

  const handleDelete = async (id) => {
    if (!confirm('Apagar esta cotação?')) return
    const { error } = await supabase.from('quotations').delete().eq('id', id)
    if (error) { alert('Erro: ' + error.message); return }
    loadQuotes(selReq.id)
  }

  const handleApprove = async (q) => {
    // Mark this one as approved
    await supabase.from('quotations').update({ selected: true }).eq('id', q.id)
    const { data: empLog } = await supabase.from('employees').select('id').eq('email', session?.user?.email).single()
    await logActivity({ empId: empLog?.id, action: 'approved', entityType: 'quotation', entityRef: selReq.ref_number, description: `aprovou cotação de ${q.suppliers?.name} para ${selReq.description.slice(0,40)} — ${q.final_price}€/un`, affaireId: selReq.affaire_id||null })
    // Mark all others for same requisition as rejected
    await supabase.from('quotations').update({ selected: false, rejected: true }).eq('requisition_id', selReq.id).neq('id', q.id)
    await supabase.from('requisitions').update({ status:'Aprovado' }).eq('id', selReq.id)
    const count = Date.now()
    const total = q.final_price * selReq.quantity
    // Criar encomenda
    const { data: order } = await supabase.from('orders').insert({
      ref_number: `ENC-${String(count).slice(-4)}`,
      requisition_id: selReq.id, quotation_id: q.id, supplier_id: q.supplier_id,
      quantity: selReq.quantity, total_amount: total, status: 'Confirmado',
      expected_date: q.delivery_days ? new Date(Date.now()+q.delivery_days*86400000).toISOString().split('T')[0] : null,
    }).select().single()
    // Nota: o trigger da base de dados já cria automaticamente o pagamento pendente
    loadQuotes(selReq.id)
  }

  const handleFollowup = async (quoteId) => {
    if (!followupForm.notes) return
    setSaving(true)
    const { data: emp } = await supabase.from('employees').select('id').eq('email', session?.user?.email).single()
    await supabase.from('quotation_followups').insert({
      quotation_id: quoteId, created_by: emp?.id||null,
      contact_type: followupForm.contact_type, notes: followupForm.notes,
      next_followup: followupForm.next_followup||null,
    })
    setFollowupForm({ contact_type:'Telefone', notes:'', next_followup:'' })
    setShowFollowup(null); setSaving(false)
    loadFollowups(quoteId)
  }

  const filteredReqs = reqs.filter(r => {
    const s = search.toLowerCase()
    const matchSearch = !s || r.description?.toLowerCase().includes(s) || r.ref_number?.toLowerCase().includes(s) || r.affaires?.name?.toLowerCase().includes(s) || r.affaires?.ref_number?.toLowerCase().includes(s) || r.employees?.emp_code?.toLowerCase().includes(s) || r.status?.toLowerCase().includes(s)
    const matchAffaire = !filterAffaire || r.affaire_id === filterAffaire
    const matchStatus = !filterStatus || r.status === filterStatus
    return matchSearch && matchAffaire && matchStatus
  })

  const generatePDFByAffaire = async () => {
    const margin = parseFloat(proposalConfig.margin)||0
    const pdfLang = proposalConfig.lang||'pt'
    const showVat = proposalConfig.showVat
    const today = new Date().toLocaleDateString(pdfLang==='fr'?'fr-FR':'pt-PT')
    const PL = pdfLang==='fr' ? {
      title:'Offre de Fourniture', supplier:'Fournisseur', delay:'Délai', payment:'Paiement',
      unitPrice:'Prix/un.', delivery:'Livraison', total:'Total', vatCol:'Total TVA',
      vatNote:'TVA', bestPrice:'Meilleur prix', noDelivery:'Incluse',
      clientRef:'Réf. client', footer:'AVM Lda · Estrada Nacional 226, 6420-572 Trancoso',
      noReqs:'Aucune réquisition pour ce chantier.'
    } : {
      title:'Proposta de Fornecimento', supplier:'Fornecedor', delay:'Prazo', payment:'Pagamento',
      unitPrice:'Preço/un.', delivery:'Entrega', total:'Total', vatCol:'Total c/IVA',
      vatNote:'IVA', bestPrice:'Melhor preço', noDelivery:'Incluída',
      clientRef:'Ref. cli', footer:'AVM Lda · Estrada Nacional 226, 6420-572 Trancoso',
      noReqs:'Sem requisições para esta obra.'
    }

    const affId = proposalConfig.affaireId
    if (!affId) { alert(pdfLang==='fr'?'Sélectionnez un chantier':'Selecciona uma obra'); return }

    const { data: affReqs } = await supabase
      .from('requisitions').select('*, affaires(name,ref_number)')
      .eq('affaire_id', affId).not('status','eq','Cancelado').order('ref_number')

    if (!affReqs?.length) { alert(PL.noReqs); return }

    const { data: allQuotes } = await supabase
      .from('quotations').select('*, suppliers(name,id)')
      .in('requisition_id', affReqs.map(r=>r.id)).eq('rejected', false).order('final_price')

    const affaire = affReqs[0]?.affaires
    const vatHeader = showVat ? '<th style="text-align:right">'+PL.vatCol+'</th>' : ''

    const reqSections = affReqs.map(req => {
      const reqQuotes = (allQuotes||[]).filter(q => q.requisition_id === req.id)
      if (!reqQuotes.length) return ''
      const rows = reqQuotes.map(q => {
        const base = parseFloat(q.final_price||0)
        const delivery = parseFloat(q.delivery_price||0)
        const forfait = parseFloat(q.transport_forfait||0)
        const priceWithMargin = base * (1 + margin/100)
        const totalUnit = priceWithMargin + delivery + forfait
        const totalQty = totalUnit * parseFloat(req.quantity||1)
        const vat = parseFloat(q.vat_rate||23)
        const totalWithVat = totalQty * (1 + vat/100)
        return { q, priceWithMargin, delivery, forfait, totalUnit, totalQty, vat, totalWithVat }
      })
      const minTotal = Math.min(...rows.map(r=>r.totalQty))
      const trs = rows.map(r =>
        '<tr class="'+(r.totalQty===minTotal?'best':'')+'">' +
        '<td><strong>'+(r.q.suppliers?.name||'—')+'</strong></td>' +
        '<td>'+(r.q.delivery_days?r.q.delivery_days+(pdfLang==='fr'?' j':' dias'):'—')+'</td>' +
        '<td>'+(r.q.payment_terms||'—')+'</td>' +
        '<td style="text-align:right">€ '+r.priceWithMargin.toFixed(2)+'</td>' +
        '<td style="text-align:right">'+(r.delivery>0?'€ '+r.delivery.toFixed(2):r.forfait>0?'€ '+r.forfait.toFixed(2)+' (forfait)':PL.noDelivery)+'</td>' +
        '<td style="text-align:right"><strong style="color:#185FA5">€ '+r.totalQty.toFixed(2)+'</strong>'+(r.totalQty===minTotal?'<br><span style="font-size:9px;background:#e8f4e8;color:#2d7a2d;padding:1px 5px;border-radius:8px">'+PL.bestPrice+'</span>':'')+'</td>' +
        (showVat?'<td style="text-align:right">€ '+r.totalWithVat.toFixed(2)+'<br><span style="color:#888;font-size:9px">'+PL.vatNote+' '+r.vat+'%</span></td>':'') +
        '</tr>'
      ).join('')
      return '<div style="margin-bottom:24px">'+
        '<div style="background:#f5f8fc;border-left:3px solid #185FA5;padding:8px 12px;margin-bottom:8px;border-radius:4px">'+
        '<strong style="font-size:12px">'+req.ref_number+' — '+req.description+'</strong>'+
        '<span style="color:#666;font-size:10px;margin-left:12px">'+req.quantity+' '+req.unit+'</span>'+
        (req.client_ref?'<span style="color:#888;font-size:10px;margin-left:12px">'+PL.clientRef+': '+req.client_ref+'</span>':'')+
        '</div>'+
        '<table><thead><tr><th>'+PL.supplier+'</th><th>'+PL.delay+'</th><th>'+PL.payment+'</th>'+
        '<th style="text-align:right">'+PL.unitPrice+'</th><th style="text-align:right">'+PL.delivery+'</th>'+
        '<th style="text-align:right">'+PL.total+' ('+req.quantity+' '+req.unit+')</th>'+vatHeader+'</tr></thead>'+
        '<tbody>'+trs+'</tbody></table></div>'
    }).join('')

    const css = 'body{font-family:Arial,sans-serif;font-size:11px;color:#222;margin:0;padding:24px}.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;border-bottom:2px solid #185FA5;padding-bottom:14px}.logo{font-size:20px;font-weight:700;color:#185FA5}.logo-sub{font-size:10px;color:#666;margin-top:3px}.doc-title{text-align:right}.doc-title h2{font-size:16px;margin:0 0 4px;color:#185FA5}.doc-title p{margin:2px 0;color:#666;font-size:10px}table{width:100%;border-collapse:collapse;margin-bottom:8px}th{background:#185FA5;color:white;padding:6px 10px;text-align:left;font-size:10px;text-transform:uppercase}td{padding:6px 10px;border-bottom:0.5px solid #e0e0e0;font-size:11px;vertical-align:top}tr:nth-child(even) td{background:#f9f9f9}.best td{background:#edf7ed!important}.footer{margin-top:24px;border-top:1px solid #ddd;padding-top:10px;font-size:10px;color:#888}'

    const html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>'+PL.title+' — '+(affaire?.name||'')+'</title><style>'+css+'</style></head><body>'+
    '<div class="header"><div><div class="logo">AVM Lda</div><div class="logo-sub">Estrada Nacional 226, 6420-572 Trancoso</div></div>'+
    '<div class="doc-title"><h2>'+PL.title+'</h2><p>'+today+'</p><p style="font-size:13px;font-weight:700;color:#185FA5">'+(affaire?.ref_number||'')+' — '+(affaire?.name||'')+'</p></div></div>'+
    reqSections+
    (margin>0?'<p style="font-size:10px;color:#888;font-style:italic">* '+(pdfLang==='fr'?'Majoration de '+margin+'% appliquée.':'Margem de '+margin+'% aplicada.')+'</p>':'')+
    '<div class="footer"><p>'+PL.footer+'</p></div></body></html>'

    const win = window.open('', '_blank')
    if (!win) { alert(pdfLang==='fr'?'Autorisez les popups':'Active os popups'); return }
    win.document.write(html); win.document.close()
    setTimeout(() => win.print(), 600)
    setShowProposal(false)
  }


  const generatePDF = () => {
    const cfg = proposalConfig
    const pdfLang = cfg.lang||'pt'
    const PL = pdfLang==='fr' ? {
      title:'Offre de Fourniture', date:'Date', ref:'Réf.', work:'Chantier', qty:'Quantité',
      clientRef:'Réf. client', specs:'Spécifications', supplier:'Fournisseur', delay:'Délai',
      payment:'Paiement', unitPrice:'Prix/un.', delivery:'Livraison', unitTotal:'Total/un.',
      total:'Total', vatCol:'Total TVA', vatNote:'TVA', bestPrice:'Meilleur prix',
      noDelivery:'Incluse', marginNote:'* Majoration de', marginSuffix:'% appliquée.',
      footer:'Document généré par ProcureFlow · AVM Lda · Estrada Nacional 226, 6420-572 Trancoso',
      carrier:'Transporteur', forfait:'Forfait transport'
    } : {
      title:'Proposta de Fornecimento', date:'Data', ref:'Ref.', work:'Obra', qty:'Quantidade',
      clientRef:'Ref. cliente', specs:'Especificações', supplier:'Fornecedor', delay:'Prazo',
      payment:'Pagamento', unitPrice:'Preço/un.', delivery:'Entrega', unitTotal:'Total/un.',
      total:'Total', vatCol:'Total c/IVA', vatNote:'IVA', bestPrice:'Melhor preço',
      noDelivery:'Incluída', marginNote:'* Margem de', marginSuffix:'% aplicada.',
      footer:'Documento gerado por ProcureFlow · AVM Lda · Estrada Nacional 226, 6420-572 Trancoso',
      carrier:'Transportador', forfait:'Forfait transporte'
    }
    const selectedQts = quotes.filter(q => cfg.selectedQuotes.includes(q.id))
    const margin = parseFloat(cfg.margin)||0
    const today = new Date().toLocaleDateString(pdfLang==='fr'?'fr-FR':'pt-PT')

    const rows = selectedQts.map(q => {
      const base = parseFloat(q.final_price||0)
      const delivery = parseFloat(q.delivery_price||0)
      const forfait = parseFloat(q.transport_forfait||0)
      const priceWithMargin = base * (1 + margin/100)
      const totalUnit = priceWithMargin + delivery + forfait
      const totalQty = totalUnit * parseFloat(selReq.quantity||1)
      const vat = parseFloat(q.vat_rate||23)
      const totalWithVat = totalQty * (1 + vat/100)
      return { q, priceWithMargin, delivery, forfait, totalUnit, totalQty, vat, totalWithVat }
    })

    const minTotal = rows.length > 0 ? Math.min(...rows.map(r=>r.totalQty)) : 0
    const vatHeader = cfg.showVat ? '<th style="text-align:right">'+PL.vatCol+'</th>' : ''

    const tableRows = rows.map(r =>
      '<tr class="'+(r.totalQty===minTotal?'best':'')+'">' +
      '<td><strong>'+(r.q.suppliers?.name||'—')+'</strong>'+(r.q.supplier_ref?'<br><span style="color:#888;font-size:9px">Ref: '+r.q.supplier_ref+'</span>':'')+'</td>' +
      '<td>'+(r.q.delivery_days?r.q.delivery_days+(pdfLang==='fr'?' j':' dias'):'—')+'</td>' +
      '<td>'+(r.q.payment_terms||'—')+'</td>' +
      '<td style="text-align:right"><strong>€ '+r.priceWithMargin.toFixed(2)+'</strong></td>' +
      '<td style="text-align:right">'+(r.delivery>0?'€ '+r.delivery.toFixed(2):r.forfait>0?'€ '+r.forfait.toFixed(2)+' ('+PL.forfait+')':PL.noDelivery)+'</td>' +
      '<td style="text-align:right"><strong>€ '+r.totalUnit.toFixed(2)+'</strong></td>' +
      '<td style="text-align:right"><strong style="color:#185FA5">€ '+r.totalQty.toFixed(2)+'</strong>'+(r.totalQty===minTotal?'<br><span style="font-size:9px;background:#e8f4e8;color:#2d7a2d;padding:1px 5px;border-radius:8px">'+PL.bestPrice+'</span>':'')+'</td>' +
      (cfg.showVat?'<td style="text-align:right">€ '+r.totalWithVat.toFixed(2)+'<br><span style="color:#888;font-size:9px">'+PL.vatNote+' '+r.vat+'%</span></td>':'') +
      '</tr>'
    ).join('')

    const css = 'body{font-family:Arial,sans-serif;font-size:11px;color:#222;margin:0;padding:24px}.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;border-bottom:2px solid #185FA5;padding-bottom:14px}.logo{font-size:20px;font-weight:700;color:#185FA5}.logo-sub{font-size:10px;color:#666;margin-top:3px}.doc-title{text-align:right}.doc-title h2{font-size:16px;margin:0 0 4px;color:#185FA5}.doc-title p{margin:2px 0;color:#666;font-size:10px}.req-box{background:#f5f8fc;border-left:3px solid #185FA5;padding:10px 14px;margin-bottom:20px;border-radius:4px}.req-box h3{margin:0 0 6px;font-size:13px;color:#185FA5}table{width:100%;border-collapse:collapse;margin-bottom:20px}th{background:#185FA5;color:white;padding:8px 10px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:0.5px}td{padding:8px 10px;border-bottom:0.5px solid #e0e0e0;font-size:11px;vertical-align:top}tr:nth-child(even) td{background:#f9f9f9}.best td{background:#edf7ed!important}.footer{margin-top:30px;border-top:1px solid #ddd;padding-top:12px;font-size:10px;color:#888}'

    const html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>'+PL.title+'</title><style>'+css+'</style></head><body>'+
    '<div class="header"><div><div class="logo">AVM Lda</div><div class="logo-sub">Estrada Nacional 226, 6420-572 Trancoso</div></div>'+
    '<div class="doc-title"><h2>'+PL.title+'</h2><p>'+PL.date+': '+today+'</p><p>'+PL.ref+': '+selReq.ref_number+'</p>'+
    (selReq.affaires?'<p>'+PL.work+': '+selReq.affaires.ref_number+' — '+selReq.affaires.name+'</p>':'')+
    '</div></div>'+
    '<div class="req-box"><h3>'+selReq.description+'</h3>'+
    '<p style="margin:4px 0;font-size:11px"><span style="color:#666">'+PL.qty+': </span><strong>'+selReq.quantity+' '+selReq.unit+'</strong>'+
    (selReq.client_ref?'&nbsp;&nbsp;&nbsp;<span style="color:#666">'+PL.clientRef+': </span><strong>'+selReq.client_ref+'</strong>':'')+
    (selReq.notes?'<br><span style="color:#666">'+PL.specs+': </span>'+selReq.notes:'')+
    '</p></div>'+
    '<table><thead><tr><th>'+PL.supplier+'</th><th>'+PL.delay+'</th><th>'+PL.payment+'</th>'+
    '<th style="text-align:right">'+PL.unitPrice+'</th><th style="text-align:right">'+PL.delivery+'</th>'+
    '<th style="text-align:right">'+PL.unitTotal+'</th><th style="text-align:right">'+PL.total+' ('+selReq.quantity+' '+selReq.unit+')</th>'+vatHeader+'</tr></thead>'+
    '<tbody>'+tableRows+'</tbody></table>'+
    (margin>0?'<p style="font-size:10px;color:#888;font-style:italic">'+PL.marginNote+' '+margin+'% '+PL.marginSuffix+'</p>':'')+
    '<div class="footer"><p>'+PL.footer+'</p></div></body></html>'

    const win = window.open('', '_blank')
    if (!win) { alert(pdfLang==='fr'?'Autorisez les popups':'Active os popups'); return }
    win.document.write(html); win.document.close()
    setTimeout(() => win.print(), 600)
    setShowProposal(false)
  }

  const openProposal = () => {
    setProposalConfig({ margin: 0, selectedQuotes: quotes.map(q=>q.id), showVat:true, groupByAffaire:false, affaireId: selReq?.affaire_id||'', lang: lang })
    setShowProposal(true)
  }

  const T = {
    pt: {
      title:'Cotações', search:'Pesquisar — descrição, ref., obra...', allWorks:'Todas as obras',
      allStatus:'Todos os estados', clear:'✕ Limpar', ref:'Ref.', description:'Descrição',
      work:'Obra', qty:'Qtd.', status:'Estado', quotes:'Cotações', addQuote:'Adicionar',
      proposalPDF:'Proposta PDF', noQuotes:'Sem cotações. Adiciona a primeira!',
      noReqs:'Sem requisições.', editQuote:'Editar Cotação', newQuote:'Nova Cotação',
      unitPrice:'Preço unitário (€)', discount:'Desconto (%)', deliveryDays:'Prazo entrega (dias)',
      deliveryCost:'Custo de entrega (€)', carrier:'Transportador', forfait:'Forfait transporte (€)',
      validUntil:'Válido até', paymentTerms:'Condições pagamento', notes:'Notas',
      vatRate:'IVA (%)', vatExempt:'Isento de IVA', priceInclVat:'Preço inclui IVA',
      deliveryType:'Local de entrega', cancel:'Cancelar', save:'Guardar',
      approve:'✓ Aprovar e Encomendar', relaunch:'Relançar',
      best:'💰 Melhor preço', approved:'✓ Aprovado → Encomendado', rejected:'✗ Não aprovado',
      minSuppliers:'fornecedores mínimos', missingQuotes:'faltam',
      proposal:'Proposta de Fornecimento', thisReq:'Esta requisição', wholeWork:'Toda a obra',
      margin:'Majoration (%)', marginNote:'aplicada (não visível no documento)', noMargin:'Sem majoration',
      showVat:'Mostrar coluna IVA', generatePDF:'Gerar PDF', langLabel:'Idioma do documento',
      optional:'opcional', fixedValue:'valor fixo', noCarrier:'— Sem transportador —',
      transport:'🚛 Forfait transporte', transportCarrier:'Transportador',
      unitPriceLabel:'Preço unit.', discountLabel:'Desconto', finalLabel:'Final/un.',
      totalLabel:'Total', deliveryLabel:'Entrega', paymentLabel:'Pagamento',
      vatLabel:'IVA', totalVatLabel:'Total c/IVA', suppliersMin:'Min. fornecedores',
      followupTitle:'Seguimento', addFollowup:'Adicionar seguimento',
      contactType:'Tipo de contacto', followupNotes:'Notas', nextFollowup:'Próximo seguimento',
    },
    fr: {
      title:'Devis', search:'Rechercher — description, réf., chantier...', allWorks:'Tous les chantiers',
      allStatus:'Tous les statuts', clear:'✕ Effacer', ref:'Réf.', description:'Description',
      work:'Chantier', qty:'Qté.', status:'Statut', quotes:'Devis', addQuote:'Ajouter',
      proposalPDF:'Offre PDF', noQuotes:'Aucun devis. Ajoutez le premier!',
      noReqs:'Aucune réquisition.', editQuote:'Modifier le devis', newQuote:'Nouveau devis',
      unitPrice:'Prix unitaire (€)', discount:'Remise (%)', deliveryDays:'Délai livraison (jours)',
      deliveryCost:'Frais de livraison (€)', carrier:'Transporteur', forfait:'Forfait transport (€)',
      validUntil:"Valable jusqu'au", paymentTerms:'Conditions de paiement', notes:'Notes',
      vatRate:'TVA (%)', vatExempt:'Exonéré de TVA', priceInclVat:'Prix TVA incluse',
      deliveryType:'Lieu de livraison', cancel:'Annuler', save:'Enregistrer',
      approve:'✓ Approuver et Commander', relaunch:'Relancer',
      best:'💰 Meilleur prix', approved:'✓ Approuvé → Commandé', rejected:'✗ Non retenu',
      minSuppliers:'fournisseurs minimum', missingQuotes:'manquent',
      proposal:'Offre de Fourniture', thisReq:'Cette réquisition', wholeWork:'Tout le chantier',
      margin:'Majoration (%)', marginNote:'appliquée (non visible dans le document)', noMargin:'Sans majoration',
      showVat:'Afficher colonne TVA', generatePDF:'Générer PDF', langLabel:'Langue du document',
      optional:'optionnel', fixedValue:'valeur fixe', noCarrier:'— Sans transporteur —',
      transport:'🚛 Forfait transport', transportCarrier:'Transporteur',
      unitPriceLabel:'Prix unit.', discountLabel:'Remise', finalLabel:'Final/un.',
      totalLabel:'Total', deliveryLabel:'Livraison', paymentLabel:'Paiement',
      vatLabel:'TVA', totalVatLabel:'Total TVA', suppliersMin:'Min. fournisseurs',
      followupTitle:'Suivi', addFollowup:'Ajouter un suivi',
      contactType:'Type de contact', followupNotes:'Notes', nextFollowup:'Prochain suivi',
    }
  }

  const STATUS_CL = {'Pendente':'badge-pending','Em cotação':'badge-quotation','Aprovado':'badge-approved','Encomendado':'badge-ordered','Entregue':'badge-delivered','Cancelado':'badge-cancelled'}

  return (
    <div style={{display:'flex',height:'calc(100vh - 56px)',overflow:'hidden'}}>

      {/* LISTA ESQUERDA */}
      <div style={{width:selReq?'46%':'100%',flexShrink:0,display:'flex',flexDirection:'column',borderRight:selReq?'1px solid var(--border)':'none',transition:'width 0.2s'}}>

        {/* Toolbar */}
        <div style={{padding:'12px 16px',borderBottom:'1px solid var(--border)',background:'var(--bg-card)',flexShrink:0}}>
          <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:8}}>
            <div style={{position:'relative',flex:1}}>
              <i className="ti ti-search" style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',color:'var(--text-muted)',fontSize:13,pointerEvents:'none'}}/>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder={T[lang].search} style={{width:'100%',border:'0.5px solid var(--border-hover)',borderRadius:'var(--radius)',padding:'7px 10px 7px 30px',fontSize:13,background:'var(--bg)',color:'var(--text)',fontFamily:'inherit'}}/>
              {search&&<button onClick={()=>setSearch('')} style={{position:'absolute',right:8,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)',fontSize:13}}>✕</button>}
            </div>
            <span style={{fontSize:11,color:'var(--text-muted)',whiteSpace:'nowrap'}}>{filteredReqs.length} / {reqs.length}</span>
          </div>
          <div style={{display:'flex',gap:6,flexWrap:'wrap',alignItems:'center'}}>
            <select value={filterAffaire} onChange={e=>setFilterAffaire(e.target.value)} style={{border:'0.5px solid var(--border-hover)',borderRadius:'var(--radius)',padding:'5px 8px',fontSize:12,background:'var(--bg-card)',color:'var(--text)',fontFamily:'inherit'}}>
              <option value="">{T[lang].allWorks}</option>
              {affaires.map(a=><option key={a.id} value={a.id}>{a.ref_number} — {a.name}</option>)}
            </select>
            <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} style={{border:'0.5px solid var(--border-hover)',borderRadius:'var(--radius)',padding:'5px 8px',fontSize:12,background:'var(--bg-card)',color:'var(--text)',fontFamily:'inherit'}}>
              <option value="">{T[lang].allStatus}</option>
              {['Pendente','Em cotação','Aprovado','Encomendado'].map(s=><option key={s}>{s}</option>)}
            </select>
            {(search||filterAffaire||filterStatus)&&<button className="btn btn-sm" onClick={()=>{setSearch('');setFilterAffaire('');setFilterStatus('')}} style={{fontSize:11}}>{T[lang].clear}</button>}
            <div style={{marginLeft:'auto',display:'flex',gap:3}}>
              <button className={`btn btn-sm ${lang==='pt'?'btn-primary':''}`} onClick={()=>setLang('pt')} style={{fontSize:11,padding:'3px 8px'}}>PT</button>
              <button className={`btn btn-sm ${lang==='fr'?'btn-primary':''}`} onClick={()=>setLang('fr')} style={{fontSize:11,padding:'3px 8px'}}>FR</button>
            </div>
          </div>
        </div>

        {/* Lista */}
        <div style={{flex:1,overflowY:'auto'}}>
          {filteredReqs.length===0
            ? <div className="empty">{T[lang].noReqs}</div>
            : <table style={{width:'100%',borderCollapse:'collapse'}}>
                <thead style={{position:'sticky',top:0,background:'var(--bg-card)',zIndex:1}}>
                  <tr style={{borderBottom:'1px solid var(--border)'}}>
                    {[T[lang].ref,T[lang].description,T[lang].work,T[lang].qty,T[lang].status,T[lang].quotes,''].map(h=>(
                      <th key={h} style={{padding:'7px 10px',textAlign:'left',fontSize:10,fontWeight:600,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.5px',whiteSpace:'nowrap'}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredReqs.map(r=>(
                    <tr key={r.id} onClick={()=>selectReq(r)}
                      style={{cursor:'pointer',borderBottom:'0.5px solid var(--border)',background:selReq?.id===r.id?'var(--blue-light)':'',borderLeft:`3px solid ${selReq?.id===r.id?'var(--blue)':r.status==='Aprovado'?'var(--green)':r.status==='Em cotação'?'var(--amber)':'transparent'}`}}>
                      <td style={{padding:'8px 10px',fontFamily:'monospace',fontSize:11,fontWeight:600,color:'var(--text-muted)',whiteSpace:'nowrap'}}>{r.ref_number}</td>
                      <td style={{padding:'8px 10px',maxWidth:200}}>
                        <div style={{fontWeight:500,fontSize:13,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.description}</div>
                        {r.client_ref&&<div style={{fontSize:10,color:'#633806',background:'var(--amber-light)',padding:'1px 5px',borderRadius:8,display:'inline-block',marginTop:2}}>{r.client_ref}</div>}
                      </td>
                      <td style={{padding:'8px 8px',fontSize:11,color:'var(--blue)',whiteSpace:'nowrap'}}>{r.affaires?.ref_number||'—'}</td>
                      <td style={{padding:'8px 8px',fontSize:12,whiteSpace:'nowrap'}}>{r.quantity} {r.unit}</td>
                      <td style={{padding:'8px 8px'}}><span className={`badge ${STATUS_CL[r.status]||''}`} style={{fontSize:10}}>{r.status}</span></td>
                      <td style={{padding:'8px 8px',fontSize:11,color:'var(--text-muted)'}}>{r.min_quotes||2} mín.</td>
                      <td style={{padding:'8px 4px'}}><i className="ti ti-chevron-right" style={{color:'var(--text-muted)',fontSize:13}}/></td>
                    </tr>
                  ))}
                </tbody>
              </table>
          }
        </div>
      </div>

      {/* PAINEL DIREITO */}
      {selReq && (
        <div style={{flex:1,minWidth:0,overflowY:'auto',background:'var(--bg)'}}>
        <div style={{flex:1,minWidth:0,overflowY:'auto',height:'100%'}}>
          {/* Contexto completo da requisição */}
          <div className="card" style={{marginBottom:12,borderLeft:'3px solid var(--blue)'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:12}}>
              <div style={{flex:1}}>
                <div style={{fontSize:11,color:'var(--text-muted)',marginBottom:4}}>{selReq.ref_number} · {selReq.employees?.emp_code} {selReq.employees?.full_name} {selReq.affaires?`· ${selReq.affaires.ref_number} — ${selReq.affaires.name}`:''}</div>
                <div style={{fontSize:16,fontWeight:600,marginBottom:6}}>{selReq.description}</div>
                <div style={{display:'flex',gap:12,fontSize:13,flexWrap:'wrap'}}>
                  <span><span style={{color:'var(--text-muted)'}}>Qtd: </span><strong>{selReq.quantity} {selReq.unit}</strong></span>
                  <span><span style={{color:'var(--text-muted)'}}>Mín. fornecedores: </span><strong>{selReq.min_quotes}</strong></span>
                  {selReq.needed_by && <span><span style={{color:'var(--text-muted)'}}>Data necessária: </span><strong style={{color:'var(--amber)'}}>{new Date(selReq.needed_by).toLocaleDateString('pt-PT')}</strong></span>}
                </div>
                {selReq.notes && (
                  <div style={{marginTop:8,padding:'8px',background:'var(--bg)',borderRadius:'var(--radius)',fontSize:12}}>
                    <span style={{fontWeight:600,color:'var(--text-muted)'}}>Especificações: </span>{selReq.notes}
                  </div>
                )}
                {selReq.technical_contact_name && (
                  <div style={{marginTop:6,fontSize:12,color:'var(--blue)'}}>
                    <i className="ti ti-user-check" style={{marginRight:4}}/>
                    <strong>{selReq.technical_contact_name}</strong>
                    {selReq.technical_contact_company && ` — ${selReq.technical_contact_company}`}
                    {selReq.technical_contact_phone && <a href={`tel:${selReq.technical_contact_phone}`} style={{marginLeft:8,color:'var(--blue)',textDecoration:'none'}}><i className="ti ti-phone" style={{marginRight:2}}/>{selReq.technical_contact_phone}</a>}
                  </div>
                )}
              </div>
              {selReq.image_url && (
                <div style={{width:120,flexShrink:0}}>
                  <ImageFromStorage path={selReq.image_url} />
                </div>
              )}
            </div>
          </div>

          {/* Formulário de nova cotação */}
          {showForm && (
            <div className="card" style={{marginBottom:12}}>
              <div className="card-header"><span className="card-title">{editQuote?T[lang].editQuote:T[lang].newQuote} — {selReq.description.slice(0,40)}</span></div>
              <div className="form-grid">
                <div className="form-group full"><label>Fornecedor *</label>
                  <select value={form.supplier_id} onChange={e=>setForm({...form,supplier_id:e.target.value})}>
                    <option value="">Selecionar...</option>
                    {suppliers.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div className="form-group"><label>Referência do fornecedor</label><input value={form.supplier_ref} onChange={e=>setForm({...form,supplier_ref:e.target.value})} /></div>
                <div className="form-group"><label>Preço unitário (€) *</label><input type="number" step="0.01" value={form.unit_price} onChange={e=>setForm({...form,unit_price:e.target.value})} /></div>
                <div className="form-group"><label>Desconto (%)</label><input type="number" value={form.discount_pct} onChange={e=>setForm({...form,discount_pct:e.target.value})} /></div>
                <div className="form-group"><label>{T[lang].deliveryDays}</label><input type="number" value={form.delivery_days} onChange={e=>setForm({...form,delivery_days:e.target.value})} /></div>
                <div className="form-group"><label>{T[lang].deliveryCost} <span style={{fontWeight:400,fontSize:11,color:'var(--text-muted)'}}>{T[lang].optional}</span></label><input type="number" step="0.01" value={form.delivery_price} onChange={e=>setForm({...form,delivery_price:e.target.value})} placeholder="0.00" /></div>
                <div className="form-group"><label>{T[lang].carrier} <span style={{fontWeight:400,fontSize:11,color:'var(--text-muted)'}}>{T[lang].optional}</span></label>
                  <select value={form.carrier_id} onChange={e=>setForm({...form,carrier_id:e.target.value})}>
                    <option value="">— Sem transportador —</option>
                    {carriers.map(c=><option key={c.id} value={c.id}>{c.name}{c.base_price?' · '+c.currency+' '+c.base_price:''}</option>)}
                  </select>
                </div>
                <div className="form-group"><label>{T[lang].forfait} <span style={{fontWeight:400,fontSize:11,color:'var(--text-muted)'}}>{T[lang].fixedValue}</span></label>
                  <input type="number" step="0.01" value={form.transport_forfait} onChange={e=>setForm({...form,transport_forfait:e.target.value})} placeholder="0.00" />
                </div>
                <div className="form-group"><label>Validade</label><input type="date" value={form.valid_until} onChange={e=>setForm({...form,valid_until:e.target.value})} /></div>
                <div className="form-group"><label>Condições pagamento</label>
                  <select value={form.payment_terms} onChange={e=>setForm({...form,payment_terms:e.target.value})}>
                    {['Pronto pagamento','30 dias','45 dias','60 dias','90 dias'].map(t=><option key={t}>{t}</option>)}
                  </select>
                </div>
                {selReq.quantity && <div className="form-group">
                  <label>Total estimado</label>
                  <div style={{padding:'8px 10px',background:'var(--bg)',borderRadius:'var(--radius)',fontSize:13,fontWeight:600,color:'var(--blue)'}}>
                    {form.unit_price ? `€ ${(parseFloat(form.unit_price) * (1-parseFloat(form.discount_pct||0)/100) * parseFloat(selReq.quantity)).toLocaleString('pt-PT',{minimumFractionDigits:2})}` : '—'}
                  </div>
                </div>}
                <div className="form-group full"><label>Notas</label><textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} /></div>
              </div>

              <div style={{marginTop:12,paddingTop:12,borderTop:'0.5px solid var(--border)'}}>
                <div style={{fontSize:12,fontWeight:600,color:'var(--green)',marginBottom:10}}><i className="ti ti-truck-delivery" style={{marginRight:6}}/>Local de entrega</div>
                <div className="form-grid" style={{gap:8}}>
                  <div className="form-group full"><label>Tipo de entrega</label>
                    <select value={form.delivery_type} onChange={e=>setForm({...form,delivery_type:e.target.value})}>
                      <option value="">— Igual à requisição —</option>
                      {['Obra (morada da obra)','Armazém','Outro endereço','Entrega intermédia (2+ transportes)'].map(t=><option key={t}>{t}</option>)}
                    </select>
                  </div>
                  {form.delivery_type && form.delivery_type!=='Obra (morada da obra)' && <>
                    <div className="form-group full"><label>Morada</label><input value={form.delivery_address} onChange={e=>setForm({...form,delivery_address:e.target.value})} placeholder="Morada completa" /></div>
                    <div className="form-group"><label>Cidade</label><input value={form.delivery_city} onChange={e=>setForm({...form,delivery_city:e.target.value})} /></div>
                  </>}
                </div>
              </div>

              <div style={{marginTop:12,paddingTop:12,borderTop:'0.5px solid var(--border)'}}>
                <div style={{fontSize:12,fontWeight:600,color:'var(--blue)',marginBottom:10}}><i className="ti ti-receipt-tax" style={{marginRight:6}}/>IVA e Fiscalidade</div>
                <div className="form-grid" style={{gap:8}}>
                  <div className="form-group" style={{flexDirection:'row',alignItems:'center',gap:8}}>
                    <input type="checkbox" checked={form.vat_exempt} onChange={e=>setForm({...form,vat_exempt:e.target.checked,vat_rate:e.target.checked?'0':'23'})} id="vat_exempt" />
                    <label htmlFor="vat_exempt" style={{margin:0,cursor:'pointer',color:'var(--green)',fontWeight:500}}>✈️ Exportação / IVA 0% (recuperável)</label>
                  </div>
                  <div className="form-group" style={{flexDirection:'row',alignItems:'center',gap:8}}>
                    <input type="checkbox" checked={form.price_includes_vat} onChange={e=>setForm({...form,price_includes_vat:e.target.checked})} id="incl_vat" />
                    <label htmlFor="incl_vat" style={{margin:0,cursor:'pointer'}}>Preço já inclui IVA</label>
                  </div>
                  {!form.vat_exempt && <div className="form-group"><label>Taxa IVA (%)</label>
                    <select value={form.vat_rate} onChange={e=>setForm({...form,vat_rate:e.target.value})}>
                      {['0','6','13','23'].map(r=><option key={r}>{r}</option>)}
                    </select>
                  </div>}
                  {/* Cálculo resumo */}
                  {form.unit_price && <div className="form-group full">
                    <div style={{padding:'10px 12px',background:'var(--bg)',borderRadius:'var(--radius)',fontSize:12}}>
                      {(() => {
                        const unitPrice = parseFloat(form.unit_price)||0
                        const disc = parseFloat(form.discount_pct)||0
                        const qty = parseFloat(selReq?.quantity)||1
                        const vatRate = parseFloat(form.vat_rate)||0
                        const priceAfterDisc = unitPrice * (1 - disc/100)
                        const totalExclVat = priceAfterDisc * qty
                        const vatAmount = form.vat_exempt ? 0 : totalExclVat * vatRate/100
                        const totalInclVat = totalExclVat + vatAmount
                        return (
                          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'4px 16px'}}>
                            <div><span style={{color:'var(--text-muted)'}}>Preço unit. s/ desconto: </span>€ {unitPrice.toFixed(2)}</div>
                            <div><span style={{color:'var(--text-muted)'}}>Após desconto ({disc}%): </span><strong>€ {priceAfterDisc.toFixed(2)}</strong></div>
                            <div><span style={{color:'var(--text-muted)'}}>Total s/IVA ({qty} {selReq?.unit}): </span><strong style={{color:'var(--blue)'}}>€ {totalExclVat.toFixed(2)}</strong></div>
                            {!form.vat_exempt && <div><span style={{color:'var(--text-muted)'}}>IVA {vatRate}%: </span>€ {vatAmount.toFixed(2)}</div>}
                            {!form.vat_exempt && <div style={{gridColumn:'1/-1'}}><span style={{color:'var(--text-muted)'}}>Total c/IVA: </span><strong style={{color:'var(--amber)'}}>€ {totalInclVat.toFixed(2)}</strong></div>}
                            {form.vat_exempt && <div style={{gridColumn:'1/-1',color:'var(--green)',fontWeight:500}}>✈️ IVA 0% — exportação — IVA recuperável: € 0,00</div>}
                          </div>
                        )
                      })()}
                    </div>
                  </div>}
                </div>
              </div>

              <div className="form-actions">
                <button className="btn" onClick={()=>{setShowForm(false);setEditQuote(null)}}>Cancelar</button>
                <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving?'A guardar...':editQuote?'Guardar':'Guardar Cotação'}</button>
              </div>
            </div>
          )}

          <div className="card">
            <div className="card-header">
              <span className="card-title">Cotações ({quotes.length}) {quotes.length < selReq.min_quotes && <span style={{fontSize:11,color:'var(--amber)'}}>— faltam {selReq.min_quotes - quotes.length} cotação(ões)</span>}</span>
              <div style={{display:'flex',gap:6}}>
                <button className="btn" onClick={openProposal} disabled={quotes.length===0}><i className="ti ti-file-text"/>Proposta PDF</button>
                <button className="btn btn-primary" onClick={()=>{setShowForm(true);setEditQuote(null)}}><i className="ti ti-plus"/>Adicionar</button>
              </div>
            </div>

            {loading ? <div className="loading"><i className="ti ti-loader-2"/>A carregar...</div>
              : quotes.length===0 ? <div className="empty">{T[lang].noQuotes}</div>
              : <div className="quote-grid">
                  {quotes.map((q,i)=>{
                    const qFollowups = followups[q.id] || []
                    const lastFollowup = qFollowups[0]
                    const daysSince = lastFollowup ? Math.floor((new Date()-new Date(lastFollowup.contact_date))/86400000) : null
                    const totalQuote = parseFloat(q.final_price) * parseFloat(selReq.quantity)
                    return (
                      <div key={q.id} className={`quote-card ${i===0&&!q.selected&&!q.rejected?'best':''}`} style={{opacity:q.rejected?0.5:1,filter:q.rejected?'grayscale(80%)':'none'}}>
                        {q.rejected && <div style={{marginBottom:8}}><span style={{background:'var(--text-muted)',color:'white',fontSize:10,padding:'2px 8px',borderRadius:10}}>{T[lang].rejected}</span></div>}
                        {i===0&&!q.selected&&!q.rejected && <div style={{marginBottom:8}}><span style={{background:'var(--blue)',color:'white',fontSize:10,padding:'2px 8px',borderRadius:10}}>{T[lang].best}</span></div>}
                        {q.selected && <div style={{marginBottom:8}}><span style={{background:'var(--green)',color:'white',fontSize:10,padding:'2px 8px',borderRadius:10}}>{T[lang].approved}</span></div>}
                        <div style={{fontWeight:600,marginBottom:10,fontSize:14}}>{q.suppliers?.name}</div>
                        <div className="quote-field"><span style={{color:'var(--text-muted)'}}>Preço unit.</span><span>€ {parseFloat(q.unit_price).toFixed(2)}</span></div>
                        <div className="quote-field"><span style={{color:'var(--text-muted)'}}>Desconto</span><span style={{color:'var(--green)'}}>{q.discount_pct}%</span></div>
                        <div className="quote-field"><span style={{color:'var(--text-muted)'}}>Final/un.</span><span style={{fontWeight:600}}>€ {parseFloat(q.final_price).toFixed(2)}</span></div>
                        <div className="quote-field" style={{background:'rgba(24,95,165,0.05)',padding:'4px 6px',borderRadius:4}}>
                          <span style={{color:'var(--text-muted)'}}>Total ({selReq.quantity} {selReq.unit})</span>
                          <span style={{fontWeight:700,color:'var(--blue)',fontSize:14}}>€ {totalQuote.toLocaleString('pt-PT',{minimumFractionDigits:2})}</span>
                        </div>
                        <div className="quote-field"><span style={{color:'var(--text-muted)'}}>Entrega</span><span>{q.delivery_days?`${q.delivery_days} dias`:'—'}</span></div>
                        <div className="quote-field"><span style={{color:'var(--text-muted)'}}>Pagamento</span><span>{q.payment_terms}</span></div>
                        <div className="quote-field">
                          <span style={{color:'var(--text-muted)'}}>IVA</span>
                          <span style={{color:q.vat_exempt?'var(--green)':''}}>{q.vat_exempt?'✈️ 0% (exportação)':`${q.vat_rate||23}%`}</span>
                        </div>
                        {!q.vat_exempt && q.vat_rate > 0 && (
                          <div className="quote-field">
                            <span style={{color:'var(--text-muted)'}}>Total c/IVA</span>
                            <span style={{fontWeight:600,color:'var(--amber)'}}>
                              € {(parseFloat(q.final_price) * parseFloat(selReq?.quantity||1) * (1+(parseFloat(q.vat_rate||23)/100))).toLocaleString('pt-PT',{minimumFractionDigits:2})}
                            </span>
                          </div>
                        )}
                        {q.notes && <div style={{fontSize:11,color:'var(--text-muted)',marginTop:6,fontStyle:'italic',padding:'4px 6px',background:'var(--bg)',borderRadius:4}}>{q.notes}</div>}
                        {q.delivery_type && (
                          <div style={{fontSize:11,marginTop:6,padding:'4px 6px',background:'var(--green-light)',borderRadius:4,color:'var(--green)',fontWeight:500}}>
                            🚚 {q.delivery_type}{q.delivery_address?` — ${q.delivery_address}`:''}{q.delivery_city?`, ${q.delivery_city}`:''}
                          </div>
                        )}

                        {/* Último relançamento */}
                        {daysSince !== null && (
                          <div style={{marginTop:8,padding:'6px 8px',background:daysSince>7?'var(--red-light)':'var(--green-light)',borderRadius:'var(--radius)',fontSize:11}}>
                            <div style={{fontWeight:500}}>Último contacto: há {daysSince} dia(s)</div>
                            <div style={{color:'var(--text-muted)',marginTop:1}}>{lastFollowup.contact_type} · {lastFollowup.employees?.emp_code} · {lastFollowup.notes?.slice(0,50)}</div>
                            {lastFollowup.next_followup && <div style={{marginTop:2,color:'var(--amber)'}}>Próximo: {new Date(lastFollowup.next_followup).toLocaleDateString('pt-PT')}</div>}
                          </div>
                        )}

                        <div style={{marginTop:10,display:'flex',gap:6,flexWrap:'wrap'}}>
                          {!q.selected && !q.rejected && <button className="btn btn-primary btn-sm" style={{flex:1,justifyContent:'center'}} onClick={()=>handleApprove(q)}>{T[lang].approve}</button>}
                          <button className="btn btn-sm" onClick={()=>{setShowFollowup(showFollowup===q.id?null:q.id);if(!followups[q.id])loadFollowups(q.id)}}><i className="ti ti-phone"/>Relançar</button>
                          <button className="btn btn-sm" onClick={()=>openEdit(q)}><i className="ti ti-edit"/></button>
                          {isAdmin && <button className="btn btn-sm" style={{color:'var(--red)'}} onClick={()=>handleDelete(q.id)}><i className="ti ti-trash"/></button>}
                        </div>

                        {showFollowup===q.id && (
                          <div style={{marginTop:10,padding:'10px',background:'var(--bg)',borderRadius:'var(--radius)'}}>
                            <div style={{fontSize:12,fontWeight:500,marginBottom:8}}>Registar contacto:</div>
                            <div className="form-grid" style={{gap:8}}>
                              <div className="form-group"><label>Tipo</label>
                                <select value={followupForm.contact_type} onChange={e=>setFollowupForm({...followupForm,contact_type:e.target.value})}>
                                  {['Telefone','Email','WhatsApp'].map(t=><option key={t}>{t}</option>)}
                                </select>
                              </div>
                              <div className="form-group"><label>Próximo seguimento</label>
                                <input type="date" value={followupForm.next_followup} onChange={e=>setFollowupForm({...followupForm,next_followup:e.target.value})} />
                              </div>
                              <div className="form-group full"><label>Notas *</label>
                                <input value={followupForm.notes} onChange={e=>setFollowupForm({...followupForm,notes:e.target.value})} placeholder="Ex: Confirma entrega 3ª feira" />
                              </div>
                            </div>
                            <button className="btn btn-primary btn-sm" style={{marginTop:6}} onClick={()=>handleFollowup(q.id)} disabled={saving}>Guardar</button>
                            {(followups[q.id]||[]).length > 0 && (
                              <div style={{marginTop:8,borderTop:'0.5px solid var(--border)',paddingTop:6}}>
                                <div style={{fontSize:11,fontWeight:500,color:'var(--text-muted)',marginBottom:4}}>Histórico:</div>
                                {(followups[q.id]||[]).map(f=>(
                                  <div key={f.id} style={{fontSize:11,padding:'3px 0',borderBottom:'0.5px solid var(--border)'}}>
                                    <strong>{f.contact_type}</strong> · {f.employees?.emp_code} · {new Date(f.contact_date).toLocaleDateString('pt-PT')} — {f.notes}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
            }
          </div>
        </div>
        {/* MODAL PROPOSTA */}
        {showProposal && (
          <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:500,display:'flex',alignItems:'center',justifyContent:'center'}}>
            <div style={{background:'var(--bg-card)',borderRadius:'var(--radius-lg)',padding:24,width:480,maxWidth:'90vw',boxShadow:'0 8px 32px rgba(0,0,0,0.2)'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
                <div style={{fontWeight:700,fontSize:16}}>📄 Proposta de Fornecimento</div>
                <button className="btn btn-sm" onClick={()=>setShowProposal(false)}><i className="ti ti-x"/></button>
              </div>
              {/* Tabs */}
              <div style={{display:'flex',gap:0,marginBottom:16,borderBottom:'1px solid var(--border)'}}>
                <div onClick={()=>setProposalConfig({...proposalConfig,groupByAffaire:false})} style={{padding:'8px 16px',cursor:'pointer',fontWeight:500,fontSize:13,borderBottom:!proposalConfig.groupByAffaire?'2px solid var(--blue)':'2px solid transparent',color:!proposalConfig.groupByAffaire?'var(--blue)':'var(--text-muted)'}}>
                  Esta requisição
                </div>
                {selReq.affaire_id && <div onClick={()=>setProposalConfig({...proposalConfig,groupByAffaire:true})} style={{padding:'8px 16px',cursor:'pointer',fontWeight:500,fontSize:13,borderBottom:proposalConfig.groupByAffaire?'2px solid var(--blue)':'2px solid transparent',color:proposalConfig.groupByAffaire?'var(--blue)':'var(--text-muted)'}}>
                  Toda a obra ({selReq.affaires?.ref_number})
                </div>}
              </div>

              {!proposalConfig.groupByAffaire && <div style={{fontSize:13,color:'var(--text-muted)',marginBottom:16}}>
                <strong>{selReq.ref_number}</strong> — {selReq.description.slice(0,60)}
              </div>}
              {proposalConfig.groupByAffaire && <div style={{fontSize:13,color:'var(--blue)',marginBottom:16,padding:'8px 12px',background:'var(--blue-light)',borderRadius:'var(--radius)'}}>
                <i className="ti ti-building" style={{marginRight:6}}/>Proposta completa da obra: <strong>{selReq.affaires?.ref_number} — {selReq.affaires?.name}</strong>
              </div>}

              {/* Margem */}
              <div className="form-group" style={{marginBottom:16}}>
                <label>{T[lang].margin}</label>
                <div style={{display:'flex',gap:8,alignItems:'center'}}>
                  <input type="number" min="0" max="100" step="0.5" value={proposalConfig.margin}
                    onChange={e=>setProposalConfig({...proposalConfig,margin:e.target.value})}
                    style={{width:100}} />
                  <span style={{fontSize:12,color:'var(--text-muted)'}}>
                    {proposalConfig.margin>0?`+${proposalConfig.margin}% ${T[lang].marginNote}`:T[lang].noMargin}
                  </span>
                </div>
              </div>

              {/* Selecção de cotações - only for single req */}
              {!proposalConfig.groupByAffaire && <div className="form-group" style={{marginBottom:20}}>
                <label>{T[lang].quotes} {lang==='fr'?'à inclure dans l\'offre':'a incluir na proposta'}</label>
                <div style={{display:'flex',flexDirection:'column',gap:6,marginTop:6}}>
                  {quotes.map(q=>(
                    <label key={q.id} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 10px',background:'var(--bg)',borderRadius:'var(--radius)',cursor:'pointer',border:`1px solid ${proposalConfig.selectedQuotes.includes(q.id)?'var(--blue)':'var(--border)'}`}}>
                      <input type="checkbox" checked={proposalConfig.selectedQuotes.includes(q.id)}
                        onChange={e=>{
                          const ids = e.target.checked
                            ? [...proposalConfig.selectedQuotes, q.id]
                            : proposalConfig.selectedQuotes.filter(id=>id!==q.id)
                          setProposalConfig({...proposalConfig,selectedQuotes:ids})
                        }} />
                      <div style={{flex:1}}>
                        <div style={{fontWeight:500,fontSize:13}}>{q.suppliers?.name}</div>
                        <div style={{fontSize:11,color:'var(--text-muted)'}}>€ {q.final_price}/un · {q.delivery_days||'—'} dias · {q.payment_terms||'—'}</div>
                      </div>
                      {q.selected && <span style={{fontSize:10,background:'var(--green)',color:'white',padding:'2px 6px',borderRadius:10}}>✓ Aprovado</span>}
                      {q.rejected && <span style={{fontSize:10,background:'var(--text-muted)',color:'white',padding:'2px 6px',borderRadius:10}}>✗ Não aprovado</span>}
                    </label>
                  ))}
                </div>
              </div>}

              {/* Opções */}
              <div style={{display:'flex',gap:16,marginBottom:16,padding:'10px 12px',background:'var(--bg)',borderRadius:'var(--radius)',flexWrap:'wrap'}}>
                <label style={{display:'flex',alignItems:'center',gap:6,cursor:'pointer',fontSize:13}}>
                  <input type="checkbox" checked={proposalConfig.showVat} onChange={e=>setProposalConfig({...proposalConfig,showVat:e.target.checked})} />
                  {T[lang].showVat}
                </label>
                <div style={{display:'flex',alignItems:'center',gap:6,fontSize:13}}>
                  <span style={{color:'var(--text-muted)'}}>{T[lang].langLabel}:</span>
                  <button className={`btn btn-sm ${proposalConfig.lang==='pt'?'btn-primary':''}`} onClick={()=>setProposalConfig({...proposalConfig,lang:'pt'})} style={{fontSize:11,padding:'2px 8px'}}>PT</button>
                  <button className={`btn btn-sm ${proposalConfig.lang==='fr'?'btn-primary':''}`} onClick={()=>setProposalConfig({...proposalConfig,lang:'fr'})} style={{fontSize:11,padding:'2px 8px'}}>FR</button>
                </div>
              </div>

              <div style={{display:'flex',gap:8,justifyContent:'flex-end',paddingTop:12,borderTop:'1px solid var(--border)'}}>
                <button className="btn" onClick={()=>setShowProposal(false)}>{T[lang].cancel}</button>
                <button className="btn btn-primary" onClick={proposalConfig.groupByAffaire?generatePDFByAffaire:generatePDF} disabled={!proposalConfig.groupByAffaire&&proposalConfig.selectedQuotes.length===0}>
                  <i className="ti ti-file-download"/>{T[lang].generatePDF}
                </button>
              </div>
            </div>
          </div>
        )}
        </div>
      )}
    </div>
  )
}
