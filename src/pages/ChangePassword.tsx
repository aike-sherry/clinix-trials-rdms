import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useAppStorage } from '@/hooks/useAppStorage'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { UserRound, Lock, Eye, EyeOff, ShieldCheck } from 'lucide-react'
import logoCliniX from '@/assets/clini-x-logo.png'

const ROLE_HOME: Record<string, string> = {
  manager: '/manager',
  admin: '/admin',
  super_admin: '/admin',
  data_entry: '/entry',
}

export default function ChangePasswordPage() {
  const navigate = useNavigate()
  const { currentUser } = useAppStorage()
  const [username, setUsername] = useState(currentUser?.username ?? '')
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [error, setError] = useState('')

  if (!currentUser) {
    navigate('/login', { replace: true })
    return null
  }

  const forced = !!currentUser.mustChangePassword
  const home = ROLE_HOME[currentUser.role] ?? '/login'

  const handleSubmit = () => {
    setError('')
    if (!username.trim()) {
      setError('登录账号不能为空')
      return
    }
    if (newPwd.length < 6) {
      setError('新密码长度至少 6 位')
      return
    }
    if (newPwd !== confirmPwd) {
      setError('两次输入的新密码不一致')
      return
    }
    const updated = {
      ...currentUser,
      username: username.trim(),
      password: newPwd,
      mustChangePassword: false,
      updatedAt: new Date().toISOString(),
    }
    // 一次性写入 users 与 currentUser（避免异步 state 覆盖导致会话回弹）
    const raw = localStorage.getItem('clini_x_rdms_data')
    const data = raw ? JSON.parse(raw) : {}
    data.users = (data.users ?? []).map((u: { id: string }) => (u.id === updated.id ? updated : u))
    data.currentUser = updated
    localStorage.setItem('clini_x_rdms_data', JSON.stringify(data))
    navigate(home, { replace: true })
  }

  const handleLogout = () => {
    const raw = localStorage.getItem('clini_x_rdms_data')
    const data = raw ? JSON.parse(raw) : {}
    delete data.currentUser
    localStorage.setItem('clini_x_rdms_data', JSON.stringify(data))
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
              <CardContent className="p-8 space-y-5">
                <div className="mb-2">
                  <h1 className="text-2xl font-bold text-slate-800">
                    {forced ? '首次登录安全设置' : '修改账号与密码'}
                  </h1>
                  <p className="text-sm text-slate-400 mt-1.5">
                    {forced ? '为保障账号安全，请完成以下设置后进入系统' : '保存后下次登录生效'}
                  </p>
                </div>

                <div className="flex items-start gap-3 rounded-xl bg-teal-50 border border-teal-100 px-4 py-3">
                  <ShieldCheck className="w-5 h-5 text-teal-600 shrink-0 mt-0.5" />
                  <div className="text-sm text-teal-700 leading-relaxed">
                    {forced
                      ? '您好，这是您首次登录。为保障账号安全，请先修改登录账号与密码后再进入系统。'
                      : '修改登录账号与密码，保存后下次登录生效。'}
                  </div>
                </div>

                <div>
                  <Label className="text-sm mb-1.5 flex items-center gap-1.5">
                    <UserRound className="w-3.5 h-3.5 text-slate-400" /> 登录账号
                  </Label>
                  <Input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="设置您的登录账号"
                  />
                </div>
                <div>
                  <Label className="text-sm mb-1.5 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-slate-400" /> 新密码
                  </Label>
                  <div className="relative">
                    <Input
                      type={showPwd ? 'text' : 'password'}
                      value={newPwd}
                      onChange={(e) => setNewPwd(e.target.value)}
                      placeholder="至少 6 位，建议字母+数字+符号"
                      className="pr-9"
                    />
                    <button
                      type="button"
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      onClick={() => setShowPwd(!showPwd)}
                    >
                      {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <Label className="text-sm mb-1.5 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-slate-400" /> 确认新密码
                  </Label>
                  <Input
                    type={showPwd ? 'text' : 'password'}
                    value={confirmPwd}
                    onChange={(e) => setConfirmPwd(e.target.value)}
                    placeholder="再次输入新密码"
                    onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                  />
                </div>

                {error && <p className="text-xs text-red-500">{error}</p>}

                <Button
                  className="w-full bg-gradient-to-r from-teal-500 to-sky-500 hover:from-teal-600 hover:to-sky-600 text-white shadow-md"
                  disabled={!username.trim() || !newPwd || !confirmPwd}
                  onClick={handleSubmit}
                >
                  保存并进入系统
                </Button>
                <div className="flex items-center justify-between text-xs">
                  {!forced && (
                    <button className="text-slate-400 hover:text-slate-600" onClick={() => navigate(home)}>
                      取消返回
                    </button>
                  )}
                  <button className="text-slate-400 hover:text-red-500 ml-auto" onClick={handleLogout}>
                    退出登录
                  </button>
                </div>
              </CardContent>
            </Card>
          </div>

          <p className="text-center text-xs text-slate-400 mt-6">
            当前登录：{currentUser.name}（{currentUser.email || currentUser.username}）
          </p>
        </div>
      </div>

      {/* 底部版权（与登录页一致） */}
      <footer className="absolute bottom-4 left-0 right-0 z-10 text-center text-[11px] text-slate-400">
        © 2026 小乂临研 · CliniX Trials RDMS
      </footer>
    </div>
  )
}
