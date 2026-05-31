import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'

export default function Login() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await signIn(email, password)
    if (error) setError('Email ou password incorrectos.')
    setLoading(false)
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:24 }}>
          <i className="ti ti-building-warehouse" style={{ fontSize:28, color:'var(--blue)' }} />
          <div>
            <div className="login-title">ProcureFlow</div>
            <div className="login-sub" style={{ marginBottom:0 }}>Gestão de Procurement</div>
          </div>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ marginBottom:12 }}>
            <label>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="utilizador@empresa.pt" required />
          </div>
          <div className="form-group" style={{ marginBottom:20 }}>
            <label>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required />
          </div>
          {error && <div style={{ color:'var(--red)', fontSize:12, marginBottom:12 }}>{error}</div>}
          <button className="btn btn-primary" type="submit" style={{ width:'100%', justifyContent:'center' }} disabled={loading}>
            {loading ? 'A entrar...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}
