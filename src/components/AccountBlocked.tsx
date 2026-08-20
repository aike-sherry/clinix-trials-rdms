import { useNavigate } from 'react-router'
import type { User } from '@/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Ban, Clock, UserX, ArrowLeft } from 'lucide-react'
import logoCliniX from '@/assets/clini-x-logo.png'

const ROLE_LABELS: Record<string, string> = {
  super_admin: '超级管理员',
  admin: '管理员',
  manager: '课题主持人',
  data_entry: '数据录入',
}

export type BlockReason = 'frozen' | 'expired' | 'deleted'

const REASON_CONFIG: Record<BlockReason, {
  title: string
  desc: (u: User | null) => string
  icon: typeof Ban
  iconBg: string
  iconColor: string
}> = {
  frozen: {
    title: '账号已被冻结',
    desc: () => '您的账号已被管理员冻结，暂时无法登录系统。如有疑问，请联系课题主持人或平台管理员解冻。',
    icon: Ban,
    iconBg: 'bg-slate-100',
    iconColor: 'text-slate-500',
  },
  expired: {
    title: '授权已到期',
    desc: (u) => `您的账号授权已于 ${u?.expiresAt ?? ''} 到期，暂时无法登录系统。请联系课题主持人或平台管理员办理延期。`,
    icon: Clock,
    iconBg: 'bg-red-50',
    iconColor: 'text-red-500',
  },
  deleted: {
    title: '账号不存在或已删除',
    desc: () => '当前登录凭证对应的账号不存在或已被删除，请重新登录。如有疑问，请联系平台管理员。',
    icon: UserX,
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-500',
  },
}

export default function AccountBlocked({ user, reason, onBack }: {
  user: User | null
  reason: BlockReason
  onBack?: () => void
}) {
  const navigate = useNavigate()
  const cfg = REASON_CONFIG[reason]
  const Icon = cfg.icon

  const handleBack = () => {
    if (onBack) {
      onBack()
      return
    }
    // 默认：清除登录会话并返回登录页
    try {
      const raw = localStorage.getItem('clini_x_rdms_data')
      const data = raw ? JSON.parse(raw) : {}
      delete data.currentUser
      localStorage.setItem('clini_x_rdms_data', JSON.stringify(data))
    } catch {
      // ignore
    }
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-slate-50 via-teal-50/50 to-sky-100/70">
      {/* 背景装饰：柔光斑 + 点阵（与登录页一致） */}
      <div className="absolute -top-40 -left-40 w-[34rem] h-[34rem] rounded-full bg-teal-200/40 blur-3xl" />
      <div className="absolute -bottom-32 right-0 w-[30rem] h-[30rem] rounded-full bg-sky-200/50 blur-3xl" />
      <div
        className="absolute inset-0 opacity-[0.05]"
        style={{ backgroundImage: 'radial-gradient(circle, #0d9488 1px, transparent 1px)', backgroundSize: '30px 30px' }}
      />

      {/* 顶栏：全部居左（与登录页一致） */}
      <header className="absolute top-7 left-10 right-10 z-20 flex items-center gap-5">
        <img
          src={logoCliniX}
          alt="CLINI X TRIALS"
          className="h-8 w-auto"
          style={{ filter: 'drop-shadow(0 2px 6px rgba(13, 148, 136, 0.15))' }}
        />
        <span className="w-px h-7 bg-gradient-to-b from-transparent via-teal-300/70 to-transparent" />
        <img
          src="/logo-hospital.png"
          alt="江苏大学附属医院"
          className="h-9 w-auto object-contain"
          style={{ filter: 'drop-shadow(0 2px 6px rgba(13, 148, 136, 0.12))' }}
        />
        <span className="w-px h-7 bg-gradient-to-b from-transparent via-teal-300/70 to-transparent" />
        <div>
          <p className="font-bold text-slate-800 leading-tight tracking-wide">科研数据管理平台</p>
          <p className="text-[10px] text-teal-600/70 tracking-[0.18em] mt-0.5">Research Data Management System</p>
        </div>
      </header>

      <div className="relative z-10 min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-[480px]">
          <div className="relative">
            {/* 卡片光晕 */}
            <div className="absolute -inset-3 rounded-[2rem] bg-gradient-to-br from-teal-300/40 via-cyan-200/30 to-sky-300/40 blur-xl" />
            <Card className="relative bg-white/90 backdrop-blur rounded-3xl shadow-xl shadow-teal-900/10 border border-white overflow-hidden">
              {/* 顶部渐变装饰条 */}
              <span className="absolute top-0 left-8 right-8 h-[3px] rounded-full bg-gradient-to-r from-teal-400 via-cyan-400 to-sky-400" />
              <CardContent className="p-8 text-center">
                <div className={`w-16 h-16 rounded-full ${cfg.iconBg} flex items-center justify-center mx-auto mb-4`}>
                  <Icon className={`w-8 h-8 ${cfg.iconColor}`} />
                </div>
                <h2 className="text-lg font-bold text-slate-800 mb-2">{cfg.title}</h2>
                <p className="text-sm text-slate-500 leading-relaxed mb-5">{cfg.desc(user)}</p>

                {user && (
                  <div className="bg-slate-50 rounded-xl px-4 py-3 mb-6 text-left space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">姓名</span>
                      <span className="text-slate-700 font-medium">{user.name}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">用户名</span>
                      <span className="text-slate-700">{user.username}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">角色</span>
                      <span className="text-slate-700">{ROLE_LABELS[user.role] ?? user.role}</span>
                    </div>
                    {(user.organization || user.department) && (
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-400">单位</span>
                        <span className="text-slate-700">{user.organization || user.department}</span>
                      </div>
                    )}
                    {reason === 'expired' && user.expiresAt && (
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-400">到期日期</span>
                        <span className="text-red-500 font-medium">{user.expiresAt}</span>
                      </div>
                    )}
                  </div>
                )}

                <Button variant="outline" className="w-full rounded-xl" onClick={handleBack}>
                  <ArrowLeft className="w-4 h-4 mr-1" /> 返回登录页
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* 底部版权（与登录页一致） */}
      <footer className="absolute bottom-4 left-0 right-0 z-10 text-center text-[11px] text-slate-400">
        © 2026 小乂临研 · CliniX Trials RDMS
      </footer>
    </div>
  )
}
