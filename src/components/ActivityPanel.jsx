import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const ACTION_ICON = {
  'created':        { icon: '➕', color: 'var(--green)' },
  'updated':        { icon: '✏️', color: 'var(--blue)' },
  'deleted':        { icon: '🗑️', color: 'var(--red)' },
  'approved':       { icon: '✅', color: 'var(--green)' },
  'status_changed': { icon: '🔄', color: 'var(--amber)' },
  'payment':        { icon: '💶', color: 'var(--green)' },
  'uploaded':       { icon: '📎', color: 'var(--blue)' },
}

const ENTITY_LABEL = {
  'requisition': 'Requisição', 'quotation': 'Cotação', 'order': 'Encomenda',
  'payment': 'Pagamento', 'affaire': 'Negócio', 'supplier': 'Fornecedor',
  'client': 'Cliente', 'transport': 'Transporte', 'stock': 'Stock', 'task': 'To Do',
}

function timeAgo(dateStr) {
  const diff = Math.floor((new Date() - new Date(dateStr)) / 1000)
  if (diff < 60) return 'agora mesmo'
  if (diff < 3600) return `há ${Math.floor(diff/60)} min`
  if (diff < 86400) return `há ${Math.floor(diff/3600)}h`
  if (diff < 604800) return `há ${Math.floor(diff/86400)} dias`
  return new Date(dateStr).toLocaleDateString('pt-PT')
}

const initials = (emp) => {
  if (!emp?.full_name) return '?'
  return emp.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
}

export default function ActivityPanel({ show, onToggle, totalAlerts = 0 }) {
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')

  const unreadCount = activities.filter(a => !a.is_read).length

  const load = async () => {
    const { data } = await supabase
      .from('activity_log')
      .select('*, employees(full_name, emp_code)')
      .order('created_at', { ascending: false })
      .limit(100)
    setActivities(data || [])
    setLoading(false)
  }

  useEffect(() => {
    load()
    const channel = supabase.channel('activity-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_log' }, () => load())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'activity_log' }, () => load())
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'activity_log' }, () => load())
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [])

  // Mark all as read when panel opens
  useEffect(() => {
    if (show && activities.some(a => !a.is_read)) {
      supabase.from('activity_log').update({ is_read: true }).eq('is_read', false).then(() => load())
    }
  }, [show])

  const handleDelete = async (id) => {
    await supabase.from('activity_log').delete().eq('id', id)
    setActivities(prev => prev.filter(a => a.id !== id))
  }

  const handleDeleteAll = async () => {
    if (!confirm('Apagar todo o histórico de actividade?')) return
    await supabase.from('activity_log').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    setActivities([])
  }

  const filtered = activities.filter(a => {
    if (!filter) return true
    return a.description?.toLowerCase().includes(filter.toLowerCase()) ||
           a.entity_ref?.toLowerCase().includes(filter.toLowerCase()) ||
           a.employees?.full_name?.toLowerCase().includes(filter.toLowerCase())
  })

  const displayCount = unreadCount > 0 ? unreadCount : totalAlerts

  return (
    <>
      {/* Bell button */}
      <button
        onClick={onToggle}
        style={{
          position: 'relative', background: 'none',
          border: `0.5px solid ${displayCount > 0 ? 'var(--red)' : 'var(--border)'}`,
          borderRadius: 'var(--radius)', cursor: 'pointer',
          color: displayCount > 0 ? 'var(--red)' : 'var(--text-muted)',
          fontSize: 16, padding: '6px 10px',
          display: 'flex', alignItems: 'center', gap: 4,
        }}
      >
        <i className={`ti ${displayCount > 0 ? 'ti-bell-ringing' : 'ti-bell'}`} />
        {displayCount > 0 && (
          <span style={{
            position: 'absolute', top: -6, right: -6,
            background: 'var(--red)', color: 'white',
            borderRadius: '50%', fontSize: 9,
            minWidth: 16, height: 16, padding: '0 3px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, lineHeight: 1, border: '1.5px solid var(--bg-card)',
          }}>
            {displayCount > 99 ? '99+' : displayCount}
          </span>
        )}
      </button>

      {/* Panel */}
      {show && (
        <>
          <div onClick={onToggle} style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(0,0,0,0.2)' }} />
          <div style={{
            position: 'fixed', top: 0, right: 0, width: 400, height: '100vh',
            background: 'var(--bg-card)', borderLeft: '0.5px solid var(--border)',
            zIndex: 1000, display: 'flex', flexDirection: 'column',
            boxShadow: '-4px 0 24px rgba(0,0,0,0.15)',
          }}>
            {/* Header */}
            <div style={{ padding: '14px 16px', borderBottom: '0.5px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>
                  🔔 Actividade
                  {unreadCount > 0 && <span style={{ marginLeft: 8, background: 'var(--red)', color: 'white', borderRadius: 10, fontSize: 10, padding: '2px 6px', fontWeight: 600 }}>{unreadCount} novas</span>}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Actualiza em tempo real 🟢</div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {activities.length > 0 && (
                  <button className="btn btn-sm" style={{ color: 'var(--red)', fontSize: 11 }} onClick={handleDeleteAll}>
                    🗑️ Apagar tudo
                  </button>
                )}
                <button onClick={onToggle} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 20 }}>
                  <i className="ti ti-x" />
                </button>
              </div>
            </div>

            {/* Search */}
            <div style={{ padding: '10px 14px', borderBottom: '0.5px solid var(--border)' }}>
              <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="🔍 Pesquisar..." style={{ width: '100%', border: '0.5px solid var(--border-hover)', borderRadius: 'var(--radius)', padding: '7px 10px', fontSize: 13, background: 'var(--bg)', color: 'var(--text)', fontFamily: 'inherit' }} />
            </div>

            {/* List */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {loading
                ? <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>A carregar...</div>
                : filtered.length === 0
                  ? <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>Sem actividade.</div>
                  : filtered.map(a => {
                      const meta = ACTION_ICON[a.action] || { icon: '•' }
                      const isNew = !a.is_read
                      return (
                        <div key={a.id} style={{
                          display: 'flex', gap: 10, padding: '10px 14px',
                          borderBottom: '0.5px solid var(--border)',
                          background: isNew ? 'rgba(24,95,165,0.06)' : '',
                          borderLeft: isNew ? '3px solid var(--blue)' : '3px solid transparent',
                          transition: 'background 0.3s',
                        }}>
                          {/* Avatar */}
                          <div style={{ width: 32, height: 32, borderRadius: '50%', background: isNew ? 'var(--blue)' : 'var(--blue-light)', color: isNew ? 'white' : 'var(--blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                            {initials(a.employees)}
                          </div>
                          {/* Content */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, lineHeight: 1.4, fontWeight: isNew ? 500 : 400 }}>
                              <strong>{a.employees?.full_name || 'Sistema'}</strong>{' '}
                              <span style={{ color: 'var(--text-muted)' }}>{a.description}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
                              <span style={{ fontSize: 10, background: 'var(--bg)', border: '0.5px solid var(--border)', borderRadius: 10, padding: '1px 5px', color: 'var(--text-muted)' }}>
                                {meta.icon} {ENTITY_LABEL[a.entity_type] || a.entity_type}
                              </span>
                              {a.entity_ref && <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--blue)' }}>{a.entity_ref}</span>}
                              {isNew && <span style={{ fontSize: 10, color: 'var(--blue)', fontWeight: 600 }}>● NOVA</span>}
                              <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 'auto' }}>{timeAgo(a.created_at)}</span>
                            </div>
                          </div>
                          {/* Delete */}
                          <button onClick={() => handleDelete(a.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--border-hover)', fontSize: 14, flexShrink: 0, alignSelf: 'center' }}
                            onMouseEnter={e => e.target.style.color = 'var(--red)'}
                            onMouseLeave={e => e.target.style.color = 'var(--border-hover)'}>
                            ✕
                          </button>
                        </div>
                      )
                    })
              }
            </div>

            {/* Footer */}
            <div style={{ padding: '8px 14px', borderTop: '0.5px solid var(--border)', fontSize: 11, color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
              <span>{filtered.length} acção(ões)</span>
              {unreadCount === 0 && <span style={{ color: 'var(--green)' }}>✓ Tudo lido</span>}
            </div>
          </div>
        </>
      )}
    </>
  )
}
