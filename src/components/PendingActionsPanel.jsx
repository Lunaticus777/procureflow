import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

function timeAgo(d) {
  const diff = Math.floor((new Date() - new Date(d)) / 1000)
  if (diff < 60) return 'agora mesmo'
  if (diff < 3600) return `há ${Math.floor(diff/60)} min`
  if (diff < 86400) return `há ${Math.floor(diff/3600)}h`
  return `há ${Math.floor(diff/86400)} dias`
}

const ACTION_LABEL = { delete: '🗑️ Apagar', update: '✏️ Modificar' }
const ENTITY_LABEL = {
  requisition: 'Requisição', quotation: 'Cotação', order: 'Encomenda',
  supplier: 'Fornecedor', client: 'Cliente', affaire: 'Negócio/Obra', transport: 'Transportador'
}

export default function PendingActionsPanel({ show, onToggle, onCountChange }) {
  const [pending, setPending] = useState([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(null)

  const load = async () => {
    const { data } = await supabase
      .from('pending_actions')
      .select('*, emp:emp_id(full_name, emp_code)')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
    setPending(data || [])
    onCountChange?.(data?.length || 0)
    setLoading(false)
  }

  useEffect(() => {
    load()
    const channel = supabase.channel('pending-actions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pending_actions' }, () => load())
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [])

  const handleApprove = async (action) => {
    setProcessing(action.id)
    try {
      if (action.action === 'delete') {
        await supabase.from(entityTable(action.entity_type)).delete().eq('id', action.entity_id)
      } else if (action.action === 'update' && action.changes) {
        const updates = {}
        Object.entries(action.changes).forEach(([k, v]) => { updates[k] = v.new })
        await supabase.from(entityTable(action.entity_type)).update(updates).eq('id', action.entity_id)
      }
      await supabase.from('pending_actions').update({ status: 'approved', reviewed_at: new Date().toISOString() }).eq('id', action.id)
      load()
    } catch (e) {
      alert('Erro: ' + e.message)
    }
    setProcessing(null)
  }

  const handleReject = async (id) => {
    await supabase.from('pending_actions').update({ status: 'rejected', reviewed_at: new Date().toISOString() }).eq('id', id)
    load()
  }

  const entityTable = (type) => ({
    requisition: 'requisitions', quotation: 'quotations', order: 'orders',
    supplier: 'suppliers', client: 'clients', affaire: 'affaires', transport: 'carriers'
  })[type] || type + 's'

  return (
    <>
      {/* Bell button */}
      <button onClick={onToggle} style={{position:'relative',background:'none',border:`0.5px solid ${pending.length>0?'var(--amber)':'var(--border)'}`,borderRadius:'var(--radius)',cursor:'pointer',color:pending.length>0?'var(--amber)':'var(--text-muted)',fontSize:16,padding:'6px 10px',display:'flex',alignItems:'center',gap:4}}>
        <i className="ti ti-clipboard-check"/>
        {pending.length > 0 && (
          <span style={{position:'absolute',top:-6,right:-6,background:'var(--amber)',color:'white',borderRadius:'50%',fontSize:9,minWidth:16,height:16,padding:'0 3px',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,border:'1.5px solid var(--bg-card)'}}>
            {pending.length > 99 ? '99+' : pending.length}
          </span>
        )}
      </button>

      {show && (
        <>
          <div onClick={onToggle} style={{position:'fixed',inset:0,zIndex:998,background:'rgba(0,0,0,0.2)'}}/>
          <div style={{position:'fixed',top:0,right:0,width:420,height:'100vh',background:'var(--bg-card)',borderLeft:'0.5px solid var(--border)',zIndex:999,display:'flex',flexDirection:'column',boxShadow:'-4px 0 24px rgba(0,0,0,0.15)'}}>

            <div style={{padding:'14px 16px',borderBottom:'0.5px solid var(--border)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div>
                <div style={{fontWeight:700,fontSize:15}}>✅ Aprovações pendentes</div>
                <div style={{fontSize:11,color:'var(--text-muted)',marginTop:2}}>{pending.length} acção(ões) a aguardar</div>
              </div>
              <button onClick={onToggle} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)',fontSize:20}}><i className="ti ti-x"/></button>
            </div>

            <div style={{flex:1,overflowY:'auto'}}>
              {loading
                ? <div style={{padding:20,textAlign:'center',color:'var(--text-muted)'}}>A carregar...</div>
                : pending.length === 0
                  ? <div style={{padding:32,textAlign:'center',color:'var(--text-muted)'}}>
                      <div style={{fontSize:32,marginBottom:8}}>✓</div>
                      <div style={{fontWeight:500}}>Nenhuma acção pendente</div>
                      <div style={{fontSize:12,marginTop:4}}>Tudo aprovado!</div>
                    </div>
                  : pending.map(a => (
                      <div key={a.id} style={{padding:'14px 16px',borderBottom:'0.5px solid var(--border)',background:processing===a.id?'var(--bg)':''}}>
                        {/* Header */}
                        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:10}}>
                          <div>
                            <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:4}}>
                              <span style={{fontSize:12,fontWeight:700,background:a.action==='delete'?'var(--red-light)':'var(--amber-light)',color:a.action==='delete'?'var(--red)':'#633806',padding:'2px 8px',borderRadius:10}}>
                                {ACTION_LABEL[a.action]}
                              </span>
                              <span style={{fontSize:11,background:'var(--bg)',border:'0.5px solid var(--border)',padding:'2px 6px',borderRadius:8,color:'var(--text-muted)'}}>
                                {ENTITY_LABEL[a.entity_type]||a.entity_type}
                              </span>
                              {a.entity_ref && <span style={{fontSize:11,fontFamily:'monospace',color:'var(--blue)'}}>{a.entity_ref}</span>}
                            </div>
                            <div style={{fontSize:13,fontWeight:500}}>{a.entity_label}</div>
                          </div>
                          <div style={{fontSize:10,color:'var(--text-muted)',textAlign:'right'}}>
                            <div style={{fontWeight:500}}>{a.emp?.full_name}</div>
                            <div>{timeAgo(a.created_at)}</div>
                          </div>
                        </div>

                        {/* Changes detail */}
                        {a.action === 'update' && a.changes && (
                          <div style={{background:'var(--bg)',borderRadius:'var(--radius)',padding:'8px 10px',marginBottom:10,fontSize:12}}>
                            {Object.entries(a.changes).map(([field, {old: oldVal, new: newVal}]) => (
                              <div key={field} style={{display:'flex',gap:8,marginBottom:3,flexWrap:'wrap'}}>
                                <span style={{color:'var(--text-muted)',minWidth:80}}>{field}:</span>
                                <span style={{textDecoration:'line-through',color:'var(--red)',opacity:0.7}}>{String(oldVal||'—').slice(0,40)}</span>
                                <span style={{color:'var(--text-muted)'}}>→</span>
                                <span style={{color:'var(--green)',fontWeight:500}}>{String(newVal||'—').slice(0,40)}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {a.action === 'delete' && (
                          <div style={{background:'var(--red-light)',borderRadius:'var(--radius)',padding:'6px 10px',marginBottom:10,fontSize:12,color:'var(--red)'}}>
                            ⚠️ Esta acção vai apagar permanentemente este registo.
                          </div>
                        )}

                        {/* Actions */}
                        <div style={{display:'flex',gap:8}}>
                          <button className="btn btn-primary btn-sm" style={{flex:1,justifyContent:'center',background:'var(--green)',borderColor:'var(--green)'}} onClick={()=>handleApprove(a)} disabled={processing===a.id}>
                            {processing===a.id?'A processar...':'✓ Aprovar'}
                          </button>
                          <button className="btn btn-sm" style={{flex:1,justifyContent:'center',color:'var(--red)',borderColor:'var(--red)'}} onClick={()=>handleReject(a.id)} disabled={processing===a.id}>
                            ✕ Rejeitar
                          </button>
                        </div>
                      </div>
                    ))
              }
            </div>

            <div style={{padding:'8px 14px',borderTop:'0.5px solid var(--border)',fontSize:11,color:'var(--text-muted)',textAlign:'center'}}>
              Actualiza em tempo real 🟢
            </div>
          </div>
        </>
      )}
    </>
  )
}
