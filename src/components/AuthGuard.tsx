import { useEffect } from 'react'
import { useNavigate, Outlet } from 'react-router'
import type { UserRole } from '@/types'

function getCurrentUser() {
  try {
    const raw = localStorage.getItem('clini_x_rdms_data')
    if (raw) {
      const data = JSON.parse(raw)
      return data.currentUser || null
    }
  } catch {
    // ignore
  }
  return null
}

export default function AuthGuard({ allowedRole }: { allowedRole: UserRole }) {
  const navigate = useNavigate()
  const user = getCurrentUser()

  useEffect(() => {
    if (!user) {
      navigate('/login', { replace: true })
      return
    }
    if (user.role !== allowedRole) {
      const targetPath = user.role === 'manager' ? '/manager' : user.role === 'admin' ? '/admin' : '/entry'
      navigate(targetPath, { replace: true })
    }
  }, [user, allowedRole, navigate])

  if (!user || user.role !== allowedRole) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-slate-400">正在跳转...</p>
      </div>
    )
  }

  return <Outlet />
}
