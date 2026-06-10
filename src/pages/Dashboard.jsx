import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

const PRIO_BG    = { 'Urgente':'var(--red-light)',   'Normal':'var(--bg)',        'Baixa':'var(--bg)' }
const PRIO_COLOR = { 'Urgente':'var(--red)',          'Normal':'var(--text-muted)','Baixa':'var(--text-muted)' }
const PRIO_BADGE = { 'Urgente':'badge-critical',      'Normal':'badge-pending',    'Baixa':'badge-pending' }
const STATUS_BADGE = { 'Por fazer':'badge-pending', 'Em curso':'badge-quotation', 'Feito':'badge-delivered' }

export default function Dashboard() {
  const { session } = useAuth()
  const [stats, setStats] = useState({ requisitions:0, quotations:0, orders:0, alerts:0 })
  const [recentReqs, setRecentReqs] = useState([])
  const [stockAlerts, setStockAlerts] = useState([])
  const [upcomingDeliveries, setUpcomingDeliveries] = useState([])
  const [upcomingTransports, setUpcomingTransports] = useState([])
  const [employees, setEmployees] = useState([])
  const [myEmp, setMyEmp] = useState(null)
  const [myTasks, setMyTasks] = useState([])       // tarefas para mim
  const [myRequests, setMyRequests] = useState([]) // pedidos que fiz
  const [allTasks, setAllTasks] = useState([])     // todas as tarefas (para o quadro geral)
  const [loading, setLoading] = useState(true)
  const [showTaskForm, setShowTaskForm] = useState(false)
  const [editTask, setEditTask] = useState(null)
  const [affaires, setAffaires] = useState([])
  const [taskForm, setTaskForm] = useState({ to_emp_id:'', title:'', description:'', priority:'Normal', due_date:'', affaire_id:'' })
  const [saving, setSaving] = useState(false)
  const [taskTab, setTaskTab] = useState('mine') // 'mine' | 'sent' | 'all'

  const today = new Date().toISOString().split('T')[0]
  const in5days = new Date(); in5days.setDate(in5days.getDate()+5)
  const in5daysStr = in5days.toISOString().split('T')[0]

  const loadTasks = async (empId) => {
    const [{ data: mine }, { data: sent }, { data: all }] = await Promise.all([
      supabase.from('internal_tasks').select('*, from_emp:from_emp_id(full_name,emp_code), affaires(name,ref_number)').eq('to_emp_id', empId).neq('status','Feito').order('priority').order('created_at',{ascending:false}),
      supabase.from('internal_tasks').select('*, to_emp:to_emp_id(full_name,emp_code), affaires(name,ref_number)').eq('from_emp_id', empId).neq('status','Feito').order('created_at',{ascending:false}),
      supabase.from('internal_tasks').select('*, from_emp:from_emp_id(full_name,emp_code), to_emp:to_emp_id(full_name,emp_code), affaires(name,ref_number)').neq('status','Feito').order('priority').order('created_at',{ascending:false}),
    ])
    setMyTasks(mine||[])
    setMyRequests(sent||[])
    setAllTasks(all||[])
  }

  useEffect(() => {
    // Realtime subscription - refresh when requisitions or tasks change
    const channel = supabase.channel('dashboard-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'requisitions' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'internal_tasks' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => load())
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [])

  useEffect(() => {
    async function load() {
      const [
        { count: rCount }, { count: qCount }, { count: oCount },
        { data: alerts }, { data: reqs },
        { data: deliveries }, { data: transports },
        { data: emps }, { data: aff }
      ] = await Promise.all([
        supabase.from('requisitions').select('*',{count:'exact',head:true}).neq('status','Entregue').neq('status','Cancelado'),
        supabase.from('quotations').select('*',{count:'exact',head:true}).eq('selected',false),
        supabase.from('orders').select('*',{count:'exact',head:true}).neq('status','Entregue').neq('status','Cancelado'),
        supabase.from('stock_alerts').select('*').limit(5),
        supabase.from('requisitions').select('*, employees(full_name,emp_code), affaires(name,ref_number)').order('created_at',{ascending:false}).limit(5),
        supabase.from('orders').select('*, suppliers(name), requisitions(description,affaires(name))').gte('expected_date',today).lte('expected_date',in5daysStr).neq('status','Entregue').order('expected_date'),
        supabase.from('transport_agenda').select('*, carriers(name,phone)').gte('planned_date',today).lte('planned_date',in5daysStr).order('planned_date'),
        supabase.from('employees').select('id,full_name,emp_code,role').order('full_name'),
        supabase.from('affaires').select('id,name,ref_number').not('status','eq','Cancelada').order('ref_number'),
      ])
      setStats({ requisitions:rCount||0, quotations:qCount||0, orders:oCount||0, alerts:alerts?.length||0 })
      setStockAlerts(alerts||[])
      setRecentReqs(reqs||[])
      setUpcomingDeliveries(deliveries||[])
      setUpcomingTransports(transports||[])
      setEmployees(emps||[])
      setAffaires(aff||[])

      // Get current employee
      if (session?.user?.email) {
        const { data: emp } = await supabase.from('employees').select('*').eq('email', session.user.email).single()
        if (emp) { setMyEmp(emp); loadTasks(emp.id) }
      }
      setLoading(false)
    }
    load()
  }, []) // eslint-disable-line

  const handleTaskSave = async () => {
    if (!taskForm.title || !taskForm.to_emp_id) return
    setSaving(true)
    if (editTask) {
      await supabase.from('internal_tasks').update({
        to_emp_id: taskForm.to_emp_id, title: taskForm.title,
        description: taskForm.description||null, priority: taskForm.priority,
        due_date: taskForm.due_date||null, affaire_id: taskForm.affaire_id||null,
      }).eq('id', editTask.id)
    } else {
      await supabase.from('internal_tasks').insert({
        from_emp_id: myEmp?.id||null, to_emp_id: taskForm.to_emp_id,
        title: taskForm.title, description: taskForm.description||null,
        priority: taskForm.priority, due_date: taskForm.due_date||null,
        affaire_id: taskForm.affaire_id||null,
      })
    }
    setTaskForm({ to_emp_id:'', title:'', description:'', priority:'Normal', due_date:'', affaire_id:'' })
    setShowTaskForm(false); setEditTask(null); setSaving(false)
    if (myEmp) loadTasks(myEmp.id)
  }

  const updateTaskStatus = async (id, status) => {
    await supabase.from('internal_tasks').update({ status, done_at: status==='Feito'?new Date().toISOString():null }).eq('id', id)
    if (myEmp) loadTasks(myEmp.id)
  }

  const deleteTask = async (id) => {
    if (!confirm('Apagar este To Do?')) return
    await supabase.from('internal_tasks').delete().eq('id', id)
    if (myEmp) loadTasks(myEmp.id)
  }

  const openEdit = (t) => {
    setEditTask(t)
    setTaskForm({ to_emp_id:t.to_emp_id, title:t.title, description:t.description||'', priority:t.priority, due_date:t.due_date||'', affaire_id:t.affaire_id||'' })
    setShowTaskForm(true)
  }

  const daysUntil = (dateStr) => Math.ceil((new Date(dateStr)-new Date())/86400000)
  const isOverdue = (t) => t.due_date && t.due_date < today

  const TaskCard = ({ t, showTo, showFrom }) => (
    <div style={{
      background: t.priority==='Urgente' ? 'var(--red-light)' : 'var(--bg-card)',
      border: `1px solid ${t.priority==='Urgente'?'var(--red)':isOverdue(t)?'var(--amber)':'var(--border)'}`,
      borderLeft: `4px solid ${t.priority==='Urgente'?'var(--red)':t.priority==='Normal'?'var(--blue)':'var(--border)'}`,
      borderRadius: 'var(--radius)', padding: '10px 12px', marginBottom: 8,
    }}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:8}}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:4,flexWrap:'wrap'}}>
            {t.priority==='Urgente' && <span style={{fontSize:14}}>🚨</span>}
            <span style={{fontWeight:600,fontSize:13,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{t.title}</span>
            <span className={`badge ${PRIO_BADGE[t.priority]||''}`} style={{fontSize:10}}>{t.priority}</span>
            <span className={`badge ${STATUS_BADGE[t.status]||''}`} style={{fontSize:10}}>{t.status}</span>
          </div>
          {t.description && <div style={{fontSize:12,color:'var(--text-muted)',marginBottom:4,whiteSpace:'pre-wrap'}}>{t.description}</div>}
          <div style={{fontSize:11,color:'var(--text-muted)',display:'flex',gap:8,flexWrap:'wrap'}}>
            {showFrom && t.from_emp && <span>📤 <strong>{t.from_emp.full_name}</strong></span>}
            {showTo && t.to_emp && <span>📥 <strong>{t.to_emp.full_name}</strong></span>}
            {t.affaires && <span style={{color:'var(--blue)'}}>🏗️ {t.affaires.ref_number} — {t.affaires.name}</span>}
            {t.due_date && <span style={{color:isOverdue(t)?'var(--red)':daysUntil(t.due_date)<=1?'var(--amber)':'var(--text-muted)',fontWeight:isOverdue(t)?700:400}}>
              📅 {isOverdue(t)?'ATRASADO! ':daysUntil(t.due_date)===0?'Hoje! ':daysUntil(t.due_date)===1?'Amanhã! ':''}{new Date(t.due_date).toLocaleDateString('pt-PT')}
            </span>}
          </div>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:4,flexShrink:0}}>
          {t.status==='Por fazer' && <button className="btn btn-sm" style={{fontSize:10,padding:'2px 6px'}} onClick={()=>updateTaskStatus(t.id,'Em curso')}>▶ Iniciar</button>}
          {t.status==='Em curso' && <button className="btn btn-primary btn-sm" style={{fontSize:10,padding:'2px 6px'}} onClick={()=>updateTaskStatus(t.id,'Feito')}>✓ Feito</button>}
          <button className="btn btn-sm" style={{fontSize:10,padding:'2px 6px'}} onClick={()=>openEdit(t)}>✏️</button>
          <button className="btn btn-sm" style={{fontSize:10,padding:'2px 6px',color:'var(--red)'}} onClick={()=>deleteTask(t.id)}>🗑️</button>
        </div>
      </div>
    </div>
  )

  const statusClass = { 'Pendente':'badge-pending','Em cotação':'badge-quotation','Aprovado':'badge-approved','Encomendado':'badge-ordered','Em trânsito':'badge-transit','Entregue':'badge-delivered' }
  const prioClass = { 'Alta':'prio-high','Média':'prio-med','Baixa':'prio-low' }

  if (loading) return <div className="loading"><i className="ti ti-loader-2"/> A carregar...</div>

  const urgentCount = myTasks.filter(t=>t.priority==='Urgente').length
  const overdueCount = myTasks.filter(t=>isOverdue(t)).length

  return (
    <div>
      {/* Métricas */}
      <div className="metrics">
        <div className="metric">
          <div className="metric-label"><i className="ti ti-clipboard-list" style={{fontSize:12}}/> Requisições abertas</div>
          <div className="metric-value text-blue">{stats.requisitions}</div>
        </div>
        <div className="metric">
          <div className="metric-label"><i className="ti ti-file-invoice" style={{fontSize:12}}/> Cotações em análise</div>
          <div className="metric-value">{stats.quotations}</div>
        </div>
        <div className="metric">
          <div className="metric-label"><i className="ti ti-shopping-cart" style={{fontSize:12}}/> Encomendas ativas</div>
          <div className="metric-value">{stats.orders}</div>
        </div>
        <div className="metric">
          <div className="metric-label"><i className="ti ti-alert-triangle" style={{fontSize:12}}/> Alertas de stock</div>
          <div className="metric-value text-red">{stats.alerts}</div>
        </div>
      </div>

      {/* Alertas entrega */}
      {upcomingDeliveries.length > 0 && (
        <div style={{background:'var(--blue-light)',border:'0.5px solid var(--blue)',borderRadius:'var(--radius-lg)',padding:'12px 16px',marginBottom:12}}>
          <div style={{fontWeight:600,fontSize:13,color:'var(--blue)',marginBottom:8}}><i className="ti ti-truck" style={{marginRight:6}}/>📦 Entregas nos próximos 5 dias</div>
          {upcomingDeliveries.map(o => {
            const days = daysUntil(o.expected_date)
            return (
              <div key={o.id} style={{display:'flex',justifyContent:'space-between',padding:'5px 0',borderBottom:'0.5px solid rgba(24,95,165,0.2)',fontSize:13}}>
                <div>
                  <span style={{fontWeight:500}}>{o.ref_number}</span>
                  <span style={{color:'var(--text-muted)',marginLeft:8}}>{o.requisitions?.description?.slice(0,50)}</span>
                  <span style={{color:'var(--text-muted)',marginLeft:8}}>— {o.suppliers?.name}</span>
                  {o.requisitions?.affaires && <span style={{color:'var(--blue)',marginLeft:8,fontSize:11}}>{o.requisitions.affaires.name}</span>}
                </div>
                <span style={{fontWeight:600,color:days<=1?'var(--red)':days<=2?'var(--amber)':'var(--blue)',flexShrink:0,marginLeft:12}}>
                  {days===0?'Hoje!':days===1?'Amanhã!':days<=2?`${days} dias ⚠️`:`${days} dias`}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* Alertas transporte */}
      {upcomingTransports.length > 0 && (
        <div style={{background:'var(--amber-light)',border:'0.5px solid var(--amber)',borderRadius:'var(--radius-lg)',padding:'12px 16px',marginBottom:12}}>
          <div style={{fontWeight:600,fontSize:13,color:'#633806',marginBottom:8}}><i className="ti ti-truck-delivery" style={{marginRight:6}}/>🚚 Transportes nos próximos 5 dias</div>
          {upcomingTransports.map(t => {
            const days = daysUntil(t.planned_date)
            return (
              <div key={t.id} style={{display:'flex',justifyContent:'space-between',padding:'5px 0',borderBottom:'0.5px solid rgba(186,117,23,0.2)',fontSize:13}}>
                <div>
                  <span style={{fontWeight:500}}>{t.carriers?.name}</span>
                  {t.load_description && <span style={{color:'var(--text-muted)',marginLeft:8}}>{t.load_description?.slice(0,50)}</span>}
                  {t.contact_status==='Por fazer' && <span style={{color:'var(--red)',marginLeft:8,fontSize:11,fontWeight:600}}>⚠️ Contactar: {t.carriers?.phone}</span>}
                </div>
                <span style={{fontWeight:600,color:days<=1?'var(--red)':days<=2?'var(--amber)':'#633806',flexShrink:0,marginLeft:12}}>
                  {days===0?'Hoje!':days===1?'Amanhã!':days<=2?`${days} dias ⚠️`:`${days} dias`}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* ===================== SISTEMA DE TAREFAS ===================== */}
      <div className="card" style={{marginBottom:16}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12,flexWrap:'wrap',gap:8}}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <span style={{fontWeight:700,fontSize:15}}>📋 To Do & Pedidos internos</span>
            {urgentCount>0 && <span style={{background:'var(--red)',color:'white',borderRadius:10,fontSize:11,padding:'2px 8px',fontWeight:600}}>🚨 {urgentCount} urgente(s)</span>}
            {overdueCount>0 && <span style={{background:'var(--amber)',color:'white',borderRadius:10,fontSize:11,padding:'2px 8px',fontWeight:600}}>⏰ {overdueCount} atrasado(s)</span>}
          </div>
          <button className="btn btn-primary" onClick={()=>{setShowTaskForm(!showTaskForm);setEditTask(null);setTaskForm({to_emp_id:'',title:'',description:'',priority:'Normal',due_date:'',affaire_id:''})}}>
            <i className="ti ti-plus"/>Novo pedido
          </button>
        </div>

        {/* Formulário */}
        {showTaskForm && (
          <div style={{background:'var(--bg)',borderRadius:'var(--radius)',padding:'14px',marginBottom:14,border:'0.5px solid var(--border)'}}>
            <div style={{fontWeight:600,fontSize:13,marginBottom:10}}>{editTask?'Editar To Do':'Novo To Do / Pedido'}</div>
            <div className="form-grid" style={{gap:10}}>
              <div className="form-group full"><label>Para quem * </label>
                <select value={taskForm.to_emp_id} onChange={e=>setTaskForm({...taskForm,to_emp_id:e.target.value})}>
                  <option value="">— Selecionar pessoa —</option>
                  {employees.filter(e=>e.id!==myEmp?.id).map(e=>(
                    <option key={e.id} value={e.id}>{e.full_name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group full"><label>Assunto / Tarefa *</label>
                <input value={taskForm.title} onChange={e=>setTaskForm({...taskForm,title:e.target.value})} placeholder="Ex: Pedir orçamento para janelas, Confirmar entrega ENC-012..." />
              </div>
              <div className="form-group full"><label>Descrição / Detalhes</label>
                <textarea value={taskForm.description} onChange={e=>setTaskForm({...taskForm,description:e.target.value})} placeholder="Mais detalhes, referências, o que é necessário fazer..." style={{minHeight:70}} />
              </div>
              <div className="form-group"><label>Prioridade</label>
                <select value={taskForm.priority} onChange={e=>setTaskForm({...taskForm,priority:e.target.value})}>
                  {['Urgente','Normal','Baixa'].map(p=><option key={p}>{p}</option>)}
                </select>
              </div>
              <div className="form-group"><label>Data limite</label>
                <input type="date" value={taskForm.due_date} onChange={e=>setTaskForm({...taskForm,due_date:e.target.value})} />
              </div>
              <div className="form-group full"><label>Obra associada (opcional)</label>
                <select value={taskForm.affaire_id} onChange={e=>setTaskForm({...taskForm,affaire_id:e.target.value})}>
                  <option value="">— Sem obra —</option>
                  {affaires.map(a=><option key={a.id} value={a.id}>{a.ref_number} — {a.name}</option>)}
                </select>
              </div>
            </div>
            <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:10}}>
              <button className="btn" onClick={()=>{setShowTaskForm(false);setEditTask(null)}}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleTaskSave} disabled={saving}>{saving?'A guardar...':editTask?'Guardar':'Enviar pedido'}</button>
            </div>
          </div>
        )}

        {/* Tabs das tarefas */}
        <div className="tabs" style={{marginBottom:12}}>
          <div className={`tab ${taskTab==='mine'?'active':''}`} onClick={()=>setTaskTab('mine')}>
            Para mim {myTasks.length>0&&<span style={{background:urgentCount>0?'var(--red)':'var(--blue)',color:'white',borderRadius:10,fontSize:10,padding:'1px 6px',marginLeft:4,fontWeight:600}}>{myTasks.length}</span>}
          </div>
          <div className={`tab ${taskTab==='sent'?'active':''}`} onClick={()=>setTaskTab('sent')}>
            Meus pedidos {myRequests.length>0&&<span style={{background:'var(--blue)',color:'white',borderRadius:10,fontSize:10,padding:'1px 6px',marginLeft:4}}>{myRequests.length}</span>}
          </div>
          <div className={`tab ${taskTab==='all'?'active':''}`} onClick={()=>setTaskTab('all')}>
            Todos ({allTasks.length})
          </div>
        </div>

        {/* Conteúdo das tabs */}
        {taskTab==='mine' && (
          myTasks.length===0
            ? <div className="empty">Sem tarefas pendentes para ti! 🎉</div>
            : <div>
                {myTasks.filter(t=>t.priority==='Urgente').length>0 && <>
                  <div style={{fontSize:11,fontWeight:700,color:'var(--red)',marginBottom:6,textTransform:'uppercase',letterSpacing:'0.5px'}}>🚨 Urgente</div>
                  {myTasks.filter(t=>t.priority==='Urgente').map(t=><TaskCard key={t.id} t={t} showFrom={true} />)}
                  <div style={{height:'0.5px',background:'var(--border)',margin:'10px 0'}}/>
                </>}
                {myTasks.filter(t=>t.priority!=='Urgente').length>0 && <>
                  <div style={{fontSize:11,fontWeight:600,color:'var(--text-muted)',marginBottom:6,textTransform:'uppercase',letterSpacing:'0.5px'}}>Normal / Baixa</div>
                  {myTasks.filter(t=>t.priority!=='Urgente').map(t=><TaskCard key={t.id} t={t} showFrom={true} />)}
                </>}
              </div>
        )}

        {taskTab==='sent' && (
          myRequests.length===0
            ? <div className="empty">Sem pedidos enviados.</div>
            : myRequests.map(t=><TaskCard key={t.id} t={t} showTo={true} />)
        )}

        {taskTab==='all' && (
          allTasks.length===0
            ? <div className="empty">Sem tarefas em aberto.</div>
            : <div>
                {/* Agrupado por pessoa */}
                {employees.map(emp => {
                  const empTasks = allTasks.filter(t=>t.to_emp_id===emp.id)
                  if (empTasks.length===0) return null
                  const urgCount = empTasks.filter(t=>t.priority==='Urgente').length
                  return (
                    <div key={emp.id} style={{marginBottom:14}}>
                      <div style={{display:'flex',alignItems:'center',gap:8,padding:'8px 10px',background:'var(--bg)',borderRadius:'var(--radius)',marginBottom:8}}>
                        <div style={{width:32,height:32,borderRadius:'50%',background:'var(--blue-light)',color:'var(--blue)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,flexShrink:0}}>
                          {emp.full_name?.slice(0,2).toUpperCase()}
                        </div>
                        <div style={{flex:1}}>
                          <div style={{fontWeight:600,fontSize:13}}>{emp.full_name}</div>
                          <div style={{fontSize:11,color:'var(--text-muted)'}}>{emp.emp_code} · {empTasks.length} to do(s)</div>
                        </div>
                        {urgCount>0 && <span style={{background:'var(--red)',color:'white',borderRadius:10,fontSize:11,padding:'2px 8px',fontWeight:600}}>🚨 {urgCount}</span>}
                      </div>
                      {empTasks.map(t=><TaskCard key={t.id} t={t} showFrom={true} />)}
                    </div>
                  )
                })}
              </div>
        )}
      </div>

      {/* Requisições recentes + Stock alertas */}
      <div className="two-col">
        <div className="card">
          <div className="card-header"><span className="card-title">Requisições recentes</span></div>
          {recentReqs.length===0
            ? <div className="empty">Sem requisições.</div>
            : <table>
                <thead><tr><th>Ref.</th><th>Descrição</th><th>Obra</th><th>Por</th><th>Prio.</th><th>Estado</th></tr></thead>
                <tbody>
                  {recentReqs.map(r=>(
                    <tr key={r.id}>
                      <td style={{fontWeight:500}}>{r.ref_number}</td>
                      <td style={{maxWidth:140,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',fontSize:12}}>{r.description}</td>
                      <td style={{fontSize:11,color:'var(--blue)'}}>{r.affaires?.ref_number||'—'}</td>
                      <td style={{fontSize:11,color:'var(--text-muted)'}}>{r.employees?.emp_code||'—'}</td>
                      <td><span className={prioClass[r.priority]||''}>{r.priority}</span></td>
                      <td><span className={`badge ${statusClass[r.status]||''}`}>{r.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
          }
        </div>

        <div className="card">
          <div className="card-header"><span className="card-title">Alertas de stock mínimo</span></div>
          {stockAlerts.length===0
            ? <div className="empty">Stock em ordem!</div>
            : stockAlerts.map(a=>(
                <div key={a.id} style={{display:'flex',alignItems:'center',gap:12,padding:'8px 0',borderBottom:'0.5px solid var(--border)'}}>
                  <div style={{width:32,height:32,borderRadius:'var(--radius)',background:a.alert_level==='Rotura'?'var(--red-light)':'var(--amber-light)',color:a.alert_level==='Rotura'?'#A32D2D':'#633806',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,flexShrink:0}}>
                    <i className={`ti ${a.alert_level==='Rotura'?'ti-bolt':'ti-alert-triangle'}`}/>
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:500,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{a.description}</div>
                    <div style={{fontSize:11,color:'var(--text-muted)'}}>Stock: {a.stock_current} / mín: {a.stock_min} {a.unit}</div>
                    <div className="stock-bar"><div className={`stock-fill ${a.alert_level==='Rotura'?'fill-red':'fill-amber'}`} style={{width:`${Math.min(100,a.pct_of_min||0)}%`}}/></div>
                  </div>
                  <span className={`badge ${a.alert_level==='Rotura'?'badge-critical':'badge-warning'}`}>{a.alert_level}</span>
                </div>
              ))
          }
        </div>
      </div>
    </div>
  )
}
