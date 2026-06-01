import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

export function useRole() {
  const { session } = useAuth()
  const [role, setRole] = useState(null)
  const [empCode, setEmpCode] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!session?.user?.email) { setLoading(false); return }
    supabase.from('employees').select('role, emp_code, full_name')
      .eq('email', session.user.email).single()
      .then(({ data }) => {
        if (data) { setRole(data.role); setEmpCode(data.emp_code||'') }
        setLoading(false)
      })
  }, [session])

  return { role, empCode, isAdmin: role === 'admin', loading }
}
