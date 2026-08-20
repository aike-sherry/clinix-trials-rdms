import { useEffect } from 'react'
import { useNavigate, Outlet } from 'react-router'
import type { User, UserRole } from '@/types'
import { accountStatus } from '@/lib/accountStatus'
import AccountBlocked from '@/components/AccountBlocked'
import type { BlockReason } from '@/components/AccountBlocked'

function getSession(): { currentUser: User | null; users: User[] } {
  try {
    const raw = localStorage.getItem('clini_x_rdms_data')
    if (raw) {
      const data = JSON.parse(raw)
      return { currentUser: data.currentUser || null, users: data.users || [] }
    }
  } catch {
    // ignore
  }
  return { currentUser: null, users: [] }
}

export default function AuthGuard({ allowedRole }: { allowedRole: UserRole }) {
  const navigate = useNavigate()
  const { currentUser: user, users } = getSession()

  // 会话内账号状态实时校验（登录后被冻结/到期/删除也能拦截）
  const liveAccount = user ? users.find((u) => u.id === user.id) : undefined
  let blockReason: BlockReason | null = null
  if (user) {
    if (liveAccount) {
      const st = accountStatus(liveAccount)
      if (st !== 'active') blockReason = st
    } else if (users.length > 0) {
      blockReason = 'deleted'
    }
  }

  useEffect(() => {
    if (!user) {
      navigate('/login', { replace: true })
      return
    }
    // 首次登录：强制先修改登录账号与密码
    if (user.mustChangePassword) {
      navigate('/change-password', { replace: true })
      return
    }
    const allowed = user.role === allowedRole || (allowedRole === 'admin' && user.role === 'super_admin')
    if (!allowed) {
      const targetPath = user.role === 'manager' ? '/manager' : user.role === 'admin' || user.role === 'super_admin' ? '/admin' : '/entry'
      navigate(targetPath, { replace: true })
    }
  }, [user, allowedRole, navigate])

  // 超级管理员与管理员共用后台
  const allowed =
    user?.role === allowedRole ||
    (allowedRole === 'admin' && user?.role === 'super_admin')

  if (!user || !allowed || user.mustChangePassword) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-slate-400">正在跳转...</p>
      </div>
    )
  }

  if (blockReason) {
    return <AccountBlocked user={liveAccount ?? user} reason={blockReason} />
  }

  return <Outlet />
}
