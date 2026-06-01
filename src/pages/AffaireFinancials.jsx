import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const STATUS_CLASS = { 'Aberta':'badge-quotation','Em curso':'badge-ordered','Concluída':'badge-delivered','Cancelada':'badge-cancelled' }
const STATUS_COLOR = { 'Aberta':'var(--blue)','Em curso':'var(--amber)','Concluída':'var(--green)','Cancelada':'var(--red)' }

function ProgressBar({ value, max, color = 'var(--blue)', height = 8 }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  const barColor = pct > 100 ? 'var(--red)' : pct > 80 ? 'var(--amber)' : color
  return (
    <div>
      <div style={{ height, background: 'var(--border)', borderRadius: 4, overflow: 'hidden', marginBottom: 4 }}>
        <div style={{ height: '100%', width: `${Math.min(100, pct)}%`, background: barColor, borderRadius: 4, transition: 'width 0.3s' }} />
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
        <span>{pct}%</span>
        <span>€ {value.toLocaleString('pt-PT', { minimumFractionDigits: 0 })} / € {max.toLocaleString('pt-PT', { minimumFractionDigits: 0 })}</span>
      </div>
    </div>
  )
}

function MetricBox({ label, value, sub, color, bg, icon }) {
  return (
    <div style={{ background: bg || 'var(--bg)', borderRadius: 'var(--radius)', padding: '12px 14px' }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>{icon} {label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: color || 'var(--text)' }}>€ {parseFloat(value || 0).toLocaleString('pt-PT', { minimumFractionDigits: 0 })}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>{sub}</div>}
    </div>
  )
}

export default function AffaireFinancials() {
  const [data, setData] = useState([])
  const [selected, setSelected] = useState(null)
  const [orders, setOrders] = useState([])
  const [payments, setPayments] = useState([])
  const [clientPayments, setClientPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  const load = async () => {
    const { data: af } = await supabase
      .from('affaire_financials')
      .select('*')
      .order('ref_number')
    setData(af || [])
    setLoading(false)
  }

  const loadDetail = async (affaire) => {
    const [{ data: ord }, { data: cp }, { data: pp }] = await Promise.all([
      supabase.from('orders')
        .select('*, suppliers(name), requisitions(description,ref_number), order_partial_payments(amount,payment_date,payment_method)')
        .eq('status', 'Confirmado')
        .or(`requisition_id.in.(${
          (await supabase.from('requisitions').select('id').eq('affaire_id', affaire.id)).data?.map(r => r.id).join(',') || 'null'
        })`)
        .order('created_at', { ascending: false }),
      supabase.from('client_payments')
        .select('*')
        .eq('affaire_id', affaire.id)
        .order('created_at', { ascending: false }),
      supabase.from('payments')
        .select('*, orders(ref_number,suppliers(name),requisitions(description))')
        .eq('affaire_id', affaire.id)
        .order('created_at', { ascending: false }),
    ])
    setOrders(ord || [])
    setClientPayments(cp || [])
    setPayments(pp || [])
  }

  useEffect(() => { load() }, [])

  const selectAffaire = async (a) => {
    setSelected(a)
    // Load orders via requisitions
    const { data: reqs } = await supabase.from('requisitions').select('id').eq('affaire_id', a.id)
    const reqIds = reqs?.map(r => r.id) || []

    const [{ data: ord }, { data: cp }, { data: sp }] = await Promise.all([
      reqIds.length > 0
        ? supabase.from('orders').select('*, suppliers(name), requisitions(description,ref_number), order_partial_payments(amount,payment_date,payment_method,employees(emp_code))').in('requisition_id', reqIds).neq('status','Cancelado').order('created_at',{ascending:false})
        : { data: [] },
      supabase.from('client_payments').select('*, client_orders(ref_number)').eq('affaire_id', a.id).order('due_date'),
      supabase.from('payments').select('*, orders(ref_number,suppliers(name),requisitions(description))').eq('affaire_id', a.id).order('due_date'),
    ])
    setOrders(ord || [])
    setClientPayments(cp || [])
    setPayments(sp || [])
  }

  const filtered = data.filter(a => {
    const s = search.toLowerCase()
    const matchS = !s || a.name?.toLowerCase().includes(s) || a.ref_number?.toLowerCase().includes(s) || a.client_name?.toLowerCase().includes(s)
    const matchSt = !filterStatus || a.status === filterStatus
    return matchS && matchSt
  })

  // Calculations for selected affaire
  const margin = selected ? parseFloat(selected.received_from_client || 0) - parseFloat(selected.total_paid_suppliers || 0) : 0
  const marginPct = selected?.received_from_client > 0 ? Math.round((margin / parseFloat(selected.received_from_client)) * 100) : 0
  const budgetUsedPct = selected?.client_budget > 0 ? Math.round((parseFloat(selected.total_orders_cost || 0) / parseFloat(selected.client_budget)) * 100) : 0
  const totalPartialPaid = orders.reduce((acc, o) => acc + (o.order_partial_payments?.reduce((a, p) => a + parseFloat(p.amount || 0), 0) || 0), 0)

  if (loading) return <div className="loading"><i className="ti ti-loader-2" />A carregar...</div>

  return (
    <div>
      {/* Totais globais */}
      <div className="metrics" style={{ marginBottom: 20 }}>
        <div className="metric">
          <div className="metric-label">Obras abertas</div>
          <div className="metric-value text-blue">{data.filter(a => a.status === 'Aberta' || a.status === 'Em curso').length}</div>
        </div>
        <div className="metric">
          <div className="metric-label">Total faturado clientes</div>
          <div className="metric-value" style={{ fontSize: 16 }}>€ {data.reduce((acc, a) => acc + parseFloat(a.total_invoiced_client || 0), 0).toLocaleString('pt-PT', { minimumFractionDigits: 0 })}</div>
        </div>
        <div className="metric">
          <div className="metric-label">Total recebido</div>
          <div className="metric-value text-green" style={{ fontSize: 16 }}>€ {data.reduce((acc, a) => acc + parseFloat(a.received_from_client || 0), 0).toLocaleString('pt-PT', { minimumFractionDigits: 0 })}</div>
        </div>
        <div className="metric">
          <div className="metric-label">Total pago fornecedores</div>
          <div className="metric-value text-red" style={{ fontSize: 16 }}>€ {data.reduce((acc, a) => acc + parseFloat(a.total_paid_suppliers || 0), 0).toLocaleString('pt-PT', { minimumFractionDigits: 0 })}</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        {/* Lista de obras */}
        <div style={{ width: 320, flexShrink: 0 }}>
          <div className="card">
            <div className="card-header"><span className="card-title">Obras / Negócios ({filtered.length})</span></div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Pesquisar..." style={{ flex: 1, border: '0.5px solid var(--border-hover)', borderRadius: 'var(--radius)', padding: '6px 10px', fontSize: 13, background: 'var(--bg-card)', color: 'var(--text)', fontFamily: 'inherit' }} />
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ border: '0.5px solid var(--border-hover)', borderRadius: 'var(--radius)', padding: '6px 8px', fontSize: 12, background: 'var(--bg-card)', color: 'var(--text)', fontFamily: 'inherit' }}>
                <option value="">Todos</option>
                {['Aberta', 'Em curso', 'Concluída', 'Cancelada'].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            {filtered.length === 0
              ? <div className="empty">Sem obras.</div>
              : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {filtered.map(a => {
                  const budget = parseFloat(a.client_budget || 0)
                  const cost = parseFloat(a.total_orders_cost || 0)
                  const received = parseFloat(a.received_from_client || 0)
                  const viability = budget > 0 ? Math.round(((budget - cost) / budget) * 100) : null
                  return (
                    <div key={a.id} onClick={() => selectAffaire(a)}
                      style={{ border: `1px solid ${selected?.id === a.id ? 'var(--blue)' : 'var(--border)'}`, borderLeft: `4px solid ${STATUS_COLOR[a.status] || 'var(--border)'}`, borderRadius: 'var(--radius)', padding: '10px 12px', cursor: 'pointer', background: selected?.id === a.id ? 'var(--blue-light)' : 'var(--bg-card)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6, marginBottom: 6 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{a.ref_number} · {a.client_name || '—'}</div>
                          <div style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</div>
                        </div>
                        <span className={`badge ${STATUS_CLASS[a.status] || ''}`} style={{ fontSize: 10, flexShrink: 0 }}>{a.status}</span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 12px', fontSize: 11 }}>
                        <div><span style={{ color: 'var(--text-muted)' }}>Recebido: </span><strong style={{ color: 'var(--green)' }}>€ {received.toLocaleString('pt-PT', { minimumFractionDigits: 0 })}</strong></div>
                        <div><span style={{ color: 'var(--text-muted)' }}>Custo: </span><strong style={{ color: 'var(--red)' }}>€ {cost.toLocaleString('pt-PT', { minimumFractionDigits: 0 })}</strong></div>
                        {budget > 0 && <div style={{ gridColumn: '1/-1', marginTop: 4 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 2 }}>
                            <span style={{ color: 'var(--text-muted)' }}>Orçamento usado</span>
                            <span style={{ color: cost > budget ? 'var(--red)' : 'var(--text-muted)', fontWeight: cost > budget ? 700 : 400 }}>{Math.round((cost / budget) * 100)}%</span>
                          </div>
                          <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${Math.min(100, (cost / budget) * 100)}%`, background: cost > budget ? 'var(--red)' : cost / budget > 0.8 ? 'var(--amber)' : 'var(--green)', borderRadius: 2 }} />
                          </div>
                        </div>}
                      </div>
                    </div>
                  )
                })}
              </div>
            }
          </div>
        </div>

        {/* Painel financeiro da obra */}
        {selected && (
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Cabeçalho */}
            <div className="card" style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{selected.ref_number} · {selected.client_name}</div>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>{selected.name}</div>
                  <span className={`badge ${STATUS_CLASS[selected.status] || ''}`} style={{ marginTop: 4 }}>{selected.status}</span>
                </div>
                <button className="btn btn-sm" onClick={() => setSelected(null)}><i className="ti ti-x" /></button>
              </div>

              {/* Métricas principais */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 16 }}>
                <MetricBox label="Orçamento cliente" value={selected.client_budget || 0} icon="📋" color="var(--blue)" />
                <MetricBox label="Faturado ao cliente" value={selected.total_invoiced_client || 0} icon="🧾" color="var(--blue)" sub={`${selected.total_client_orders} encomenda(s)`} />
                <MetricBox label="Recebido do cliente" value={selected.received_from_client || 0} icon="✅" color="var(--green)" bg="var(--green-light)" sub={`Pendente: € ${parseFloat(selected.pending_from_client || 0).toLocaleString('pt-PT', { minimumFractionDigits: 0 })}`} />
                <MetricBox label="Custo total compras" value={selected.total_orders_cost || 0} icon="🛒" color="var(--red)" sub={`${selected.total_supplier_orders} encomenda(s)`} />
              </div>

              {/* Margem */}
              <div style={{ padding: '14px', background: margin >= 0 ? 'var(--green-light)' : 'var(--red-light)', borderRadius: 'var(--radius)', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>💰 MARGEM (recebido − pago a fornecedores)</div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: margin >= 0 ? 'var(--green)' : 'var(--red)' }}>
                    {margin >= 0 ? '+' : ''}€ {margin.toLocaleString('pt-PT', { minimumFractionDigits: 0 })}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    Margem sobre recebido: <strong style={{ color: margin >= 0 ? 'var(--green)' : 'var(--red)' }}>{marginPct}%</strong>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Pago a fornecedores</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--red)' }}>€ {parseFloat(selected.total_paid_suppliers || 0).toLocaleString('pt-PT', { minimumFractionDigits: 0 })}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>de € {parseFloat(selected.total_orders_cost || 0).toLocaleString('pt-PT', { minimumFractionDigits: 0 })} em encomendas</div>
                </div>
              </div>

              {/* Barras de progresso */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {selected.client_budget > 0 && (
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 6 }}>Orçamento cliente utilizado</div>
                    <ProgressBar value={parseFloat(selected.total_orders_cost || 0)} max={parseFloat(selected.client_budget)} color="var(--blue)" />
                    {parseFloat(selected.total_orders_cost || 0) > parseFloat(selected.client_budget) && (
                      <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 4, fontWeight: 600 }}>⚠️ Orçamento ultrapassado em € {(parseFloat(selected.total_orders_cost) - parseFloat(selected.client_budget)).toLocaleString('pt-PT', { minimumFractionDigits: 0 })}</div>
                    )}
                  </div>
                )}
                {selected.total_invoiced_client > 0 && (
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 6 }}>Cobrança do cliente</div>
                    <ProgressBar value={parseFloat(selected.received_from_client || 0)} max={parseFloat(selected.total_invoiced_client)} color="var(--green)" />
                  </div>
                )}
                {selected.total_orders_cost > 0 && (
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 6 }}>Pagamento a fornecedores</div>
                    <ProgressBar value={parseFloat(selected.total_paid_suppliers || 0)} max={parseFloat(selected.total_orders_cost)} color="var(--amber)" />
                  </div>
                )}
              </div>
            </div>

            {/* Encomendas a fornecedores */}
            {orders.length > 0 && (
              <div className="card" style={{ marginBottom: 12 }}>
                <div className="card-header"><span className="card-title">🛒 Encomendas a fornecedores ({orders.length})</span></div>
                <table>
                  <thead>
                    <tr>
                      <th>Enc.</th>
                      <th>Material</th>
                      <th>Fornecedor</th>
                      <th>Valor total</th>
                      <th>Pago</th>
                      <th>Pendente</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map(o => {
                      const paid = o.order_partial_payments?.reduce((a, p) => a + parseFloat(p.amount || 0), 0) || 0
                      const total = parseFloat(o.total_amount || 0)
                      const pending = total - paid
                      const pct = total > 0 ? Math.round((paid / total) * 100) : 0
                      return (
                        <tr key={o.id}>
                          <td style={{ fontWeight: 600 }}>{o.ref_number}</td>
                          <td style={{ fontSize: 12, maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.requisitions?.description || '—'}</td>
                          <td style={{ fontSize: 12 }}>{o.suppliers?.name || '—'}</td>
                          <td style={{ fontWeight: 500 }}>€ {total.toLocaleString('pt-PT', { minimumFractionDigits: 0 })}</td>
                          <td style={{ color: 'var(--green)', fontWeight: 500 }}>€ {paid.toLocaleString('pt-PT', { minimumFractionDigits: 0 })}</td>
                          <td style={{ color: pending > 0 ? 'var(--amber)' : 'var(--green)', fontWeight: 500 }}>
                            {pending > 0 ? `€ ${pending.toLocaleString('pt-PT', { minimumFractionDigits: 0 })}` : '✓ Saldado'}
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span className={`badge ${{ 'Confirmado': 'badge-ordered', 'Em trânsito': 'badge-transit', 'Entregue': 'badge-delivered' }[o.status] || ''}`}>{o.status}</span>
                              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{pct}%</span>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagamentos do cliente */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="card">
                <div className="card-header"><span className="card-title">✅ Recebido do cliente</span></div>
                {clientPayments.length === 0
                  ? <div className="empty">Sem pagamentos registados.</div>
                  : clientPayments.map(p => (
                    <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '0.5px solid var(--border)', fontSize: 13 }}>
                      <div>
                        <div style={{ fontWeight: 500 }}>{p.invoice_ref || 'Sem ref.'}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {p.due_date ? new Date(p.due_date).toLocaleDateString('pt-PT') : '—'}
                          {p.paid_date ? ` · Pago ${new Date(p.paid_date).toLocaleDateString('pt-PT')}` : ''}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 600, color: p.status === 'Pago' ? 'var(--green)' : 'var(--amber)' }}>€ {parseFloat(p.amount).toLocaleString('pt-PT', { minimumFractionDigits: 0 })}</span>
                        <span className={`badge ${p.status === 'Pago' ? 'badge-delivered' : 'badge-pending'}`}>{p.status}</span>
                      </div>
                    </div>
                  ))
                }
              </div>

              <div className="card">
                <div className="card-header"><span className="card-title">🏭 Faturas fornecedores</span></div>
                {payments.length === 0
                  ? <div className="empty">Sem faturas registadas.</div>
                  : payments.map(p => (
                    <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '0.5px solid var(--border)', fontSize: 13 }}>
                      <div>
                        <div style={{ fontWeight: 500 }}>{p.orders?.suppliers?.name || '—'}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {p.orders?.ref_number} {p.invoice_ref ? `· ${p.invoice_ref}` : ''}
                          {p.due_date ? ` · ${new Date(p.due_date).toLocaleDateString('pt-PT')}` : ''}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 600, color: p.status === 'Pago' ? 'var(--green)' : 'var(--red)' }}>€ {parseFloat(p.amount).toLocaleString('pt-PT', { minimumFractionDigits: 0 })}</span>
                        <span className={`badge ${p.status === 'Pago' ? 'badge-delivered' : p.status === 'Em atraso' ? 'badge-critical' : 'badge-pending'}`}>{p.status}</span>
                      </div>
                    </div>
                  ))
                }
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
