import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function ResetPassword() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    // Handle the token from the URL (Supabase sends #access_token=... in the hash)
    const hash = window.location.hash
    if (hash && hash.includes('access_token')) {
      const params = new URLSearchParams(hash.replace('#', ''))
      const accessToken = params.get('access_token')
      const refreshToken = params.get('refresh_token')
      if (accessToken) {
        supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken || '' })
      }
    }
  }, [])

  const handleReset = async () => {
    if (!password) { setError('Introduz uma nova palavra-passe.'); return }
    if (password !== confirm) { setError('As palavras-passe não coincidem.'); return }
    if (password.length < 6) { setError('Mínimo 6 caracteres.'); return }
    setLoading(true); setError('')
    const { error } = await supabase.auth.updateUser({ password })
    if (error) { setError('Erro: ' + error.message); setLoading(false); return }
    setDone(true); setLoading(false)
  }

  return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'var(--bg)'}}>
      <div style={{width:380,background:'var(--bg-card)',borderRadius:'var(--radius-lg)',padding:32,border:'0.5px solid var(--border)',boxShadow:'0 4px 24px rgba(0,0,0,0.08)'}}>
        <div style={{fontWeight:700,fontSize:20,marginBottom:6}}>🔐 Nova palavra-passe</div>
        <div style={{fontSize:13,color:'var(--text-muted)',marginBottom:24}}>ProcureFlow — define a tua nova palavra-passe</div>

        {done ? (
          <div>
            <div style={{padding:'12px',background:'var(--green-light)',borderRadius:'var(--radius)',color:'var(--green)',fontWeight:500,marginBottom:16}}>
              ✅ Palavra-passe alterada com sucesso!
            </div>
            <button className="btn btn-primary" style={{width:'100%',justifyContent:'center'}} onClick={()=>window.location.href='/'}>
              Entrar na aplicação
            </button>
          </div>
        ) : (
          <div>
            <div className="form-group" style={{marginBottom:12}}>
              <label>Nova palavra-passe</label>
              <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" style={{width:'100%'}} />
            </div>
            <div className="form-group" style={{marginBottom:16}}>
              <label>Confirmar palavra-passe</label>
              <input type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} placeholder="Repete a palavra-passe" style={{width:'100%'}} onKeyDown={e=>e.key==='Enter'&&handleReset()} />
            </div>
            {error && <div style={{fontSize:12,color:'var(--red)',marginBottom:12,padding:'8px 10px',background:'var(--red-light)',borderRadius:'var(--radius)'}}>{error}</div>}
            <button className="btn btn-primary" style={{width:'100%',justifyContent:'center'}} onClick={handleReset} disabled={loading}>
              {loading ? 'A guardar...' : 'Guardar nova palavra-passe'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
