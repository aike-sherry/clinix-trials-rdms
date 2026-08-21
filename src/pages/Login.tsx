import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { useAppStorage } from '@/hooks/useAppStorage'
import { accountStatus } from '@/lib/accountStatus'
import AccountBlocked from '@/components/AccountBlocked'
import type { User } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Mail, Lock, Eye, EyeOff, ArrowRight, AudioLines, Layers, TrendingUp, Smartphone,
} from 'lucide-react'
import logoCliniX from '@/assets/clini-x-logo.png'

// 手机验证码：6 位随机数字（模拟环境直接回显，正式环境通过短信网关下发）
const genSmsCode = () => String(Math.floor(100000 + Math.random() * 900000))

// 登录成功后按角色跳转的首页
const ROLE_HOME: Record<string, string> = {
  manager: '/manager',
  super_admin: '/admin',
  admin: '/admin',
  data_entry: '/entry',
}

// 左侧特性清单
const FEATURE_LIST: { icon: React.ReactNode; title: string; desc: string; gradient: string }[] = [
  { icon: <AudioLines className="w-5 h-5" />, title: '多元化数据录入', desc: '语音录入 · 文档识别 · 智能抓取，出错更少、快人一步', gradient: 'from-teal-500 to-emerald-500' },
  { icon: <Layers className="w-5 h-5" />, title: '一体化数据管理', desc: '数据采集 · 数据管理 · 统计分析无缝衔接', gradient: 'from-cyan-500 to-sky-500' },
  { icon: <TrendingUp className="w-5 h-5" />, title: '全程数字化掌控', desc: '研究进度实时可视 · 全程一目了然', gradient: 'from-sky-500 to-blue-500' },
]

export default function LoginPage() {
  const navigate = useNavigate()
  const { users } = useAppStorage()
  const [account, setAccount] = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [showForgot, setShowForgot] = useState(false)
  const [error, setError] = useState('')
  const [smsCode, setSmsCode] = useState('')
  const [codeInput, setCodeInput] = useState('')
  const [countdown, setCountdown] = useState(0)
  const [codeHint, setCodeHint] = useState('')
  const [blocked, setBlocked] = useState<{ user: User; reason: 'frozen' | 'expired' } | null>(null)

  // 重发倒计时
  useEffect(() => {
    if (countdown <= 0) return
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [countdown])

  // 发送手机验证码（模拟）
  const sendCode = () => {
    if (countdown > 0) return
    const code = genSmsCode()
    setSmsCode(code)
    setCodeInput('')
    setCountdown(60)
    setCodeHint(`模拟环境：本次验证码 ${code}（正式环境将通过短信网关下发至账号绑定手机）`)
    setError('')
  }

  // 统一登录：不区分角色，系统根据账号自动识别角色并跳转对应端
  const handleLogin = () => {
    setError('')
    // 先校验手机验证码
    if (!smsCode) {
      setError('请先获取手机验证码')
      return
    }
    if (codeInput.trim() !== smsCode) {
      setError('手机验证码不正确，请重新输入')
      return
    }
    const account_ = users.find(
      (u) =>
        u.email?.toLowerCase() === account.trim().toLowerCase() ||
        u.username?.toLowerCase() === account.trim().toLowerCase()
    )
    if (!account_) {
      setError('未找到该邮箱/账号对应的用户，请确认后重试或联系授权人')
      return
    }
    if (account_.password && account_.password !== password) {
      setError('密码不正确，请重新输入')
      return
    }
    const st = accountStatus(account_)
    if (st !== 'active') {
      setBlocked({ user: account_, reason: st })
      return
    }
    // 登录成功：写入真实账号会话
    const storageKey = 'clini_x_rdms_data'
    const raw = localStorage.getItem(storageKey)
    const data = raw ? JSON.parse(raw) : {}
    data.currentUser = account_
    localStorage.setItem(storageKey, JSON.stringify(data))
    // 首次登录：强制修改登录账号与密码
    if (account_.mustChangePassword) {
      navigate('/change-password')
      return
    }
    navigate(ROLE_HOME[account_.role] || '/login')
  }

  if (blocked) {
    return (
      <AccountBlocked
        user={blocked.user}
        reason={blocked.reason}
        onBack={() => { setBlocked(null); setPassword('') }}
      />
    )
  }

  return (
    <div
      className="min-h-screen relative overflow-hidden bg-gradient-to-br from-slate-50 via-teal-50/40 to-sky-100/60"
      style={{ zoom: 0.9 }}
    >
      {/* 背景装饰：径向光晕 + 点阵 + 数据流线 */}
      <div className="absolute -top-48 -left-48 w-[42rem] h-[42rem] rounded-full bg-teal-300/45 blur-3xl" />
      <div className="absolute -bottom-40 -right-24 w-[38rem] h-[38rem] rounded-full bg-sky-300/55 blur-3xl" />
      <div className="absolute top-1/4 left-[38%] w-[28rem] h-[28rem] rounded-full bg-cyan-200/60 blur-3xl" />
      <div className="absolute bottom-[12%] left-[8%] w-[22rem] h-[22rem] rounded-full bg-teal-200/40 blur-3xl" />
      <div
        className="absolute inset-0 opacity-[0.08]"
        style={{ backgroundImage: 'radial-gradient(circle, #0d9488 1px, transparent 1px)', backgroundSize: '30px 30px' }}
      />
      {/* 顶栏：品牌区（主 Logo 独立 + 医院与平台名成组） */}
      <header className="absolute top-7 left-10 right-10 z-20 flex items-center gap-6">
        <img
          src={logoCliniX}
          alt="CLINI X TRIALS"
          className="h-12 w-auto"
          style={{ filter: 'drop-shadow(0 3px 10px rgba(13, 148, 136, 0.35)) drop-shadow(0 0 18px rgba(34, 211, 238, 0.25))' }}
        />
        <span className="w-px h-9 bg-gradient-to-b from-transparent via-teal-300/70 to-transparent" />
        <div className="flex items-center gap-3.5">
          <span className="bg-white rounded-xl px-2.5 py-1.5 shadow-sm border border-slate-100 flex items-center">
            <img src="/logo-hospital.png" alt="江苏大学附属医院" className="h-7 w-auto object-contain" />
          </span>
          <div>
            <p className="font-bold text-slate-800 leading-tight tracking-wide">科研数据管理平台</p>
            <p className="text-[10px] text-teal-600/70 tracking-[0.18em] mt-0.5">Research Data Management System</p>
          </div>
        </div>
      </header>

      <div className="relative z-10 min-h-screen flex items-center">
        {/* ==================== 左侧标语区 ==================== */}
        <div className="hidden lg:flex flex-1 flex-col justify-center h-screen pl-24 pr-8 pt-16 relative">
          {/* 装饰：大号描边文字水印 */}
          <span
            aria-hidden
            className="absolute -top-2 -left-6 text-[180px] font-black leading-none text-transparent select-none pointer-events-none"
            style={{ WebkitTextStroke: '1.5px rgba(13, 148, 136, 0.10)' }}
          >
            CliniX
          </span>

          {/* 徽章 eyebrow */}
          <div className="inline-flex items-center gap-2.5 self-start px-4 py-2 rounded-full bg-white/70 backdrop-blur border border-teal-100 shadow-sm">
            <span className="relative flex w-2 h-2">
              <span className="absolute inline-flex w-full h-full rounded-full bg-teal-400 opacity-60 animate-ping" />
              <span className="relative inline-flex w-2 h-2 rounded-full bg-teal-500" />
            </span>
            <span className="text-xs font-semibold text-teal-700 tracking-[0.2em]">智能一体化数据管理平台</span>
          </div>

          {/* 主标语 */}
          <h1 className="mt-5 text-[40px] leading-[1.25] font-bold tracking-wide text-slate-800">
            以智能科技 · 赋能科研创新
          </h1>
          <div className="mt-2 relative self-start">
            <span className="text-[40px] leading-[1.25] font-bold tracking-wide bg-gradient-to-r from-teal-400 via-cyan-400 to-sky-400 bg-clip-text text-transparent">
              让研究轻松前行
            </span>
            {/* 修饰线：超细双线编辑风 */}
            <div className="mt-5 w-[100%] space-y-[6px]">
              <div className="h-px w-full bg-gradient-to-r from-teal-500/80 via-teal-400/40 to-transparent" />
              <div className="h-px w-[62%] bg-gradient-to-r from-cyan-400/70 via-cyan-300/30 to-transparent" />
            </div>
          </div>

          {/* 特性清单：浅色底衬卡片行 */}
          <div className="mt-9 space-y-4 max-w-[540px]">
            {FEATURE_LIST.map((f) => (
              <div
                key={f.title}
                className="flex items-center gap-4 rounded-2xl bg-white/85 backdrop-blur-sm border border-teal-200/60 px-5 py-4 shadow-md shadow-teal-900/8 hover:shadow-lg hover:border-teal-300/80 hover:-translate-y-0.5 transition-all duration-300 group"
              >
                <span
                  className={`w-12 h-12 rounded-xl bg-gradient-to-br ${f.gradient} flex items-center justify-center text-white shadow-lg shadow-teal-500/30 shrink-0 transition-transform duration-300 group-hover:scale-110`}
                >
                  {f.icon}
                </span>
                <div>
                  <p className="text-[15px] font-bold text-slate-800 tracking-wide">{f.title}</p>
                  <p className="text-xs text-slate-500 mt-1 tracking-wide">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ==================== 右侧登录区 ==================== */}
        <div className="w-full lg:w-auto flex justify-center px-6 lg:pr-44 py-24">
          <div className="w-full max-w-[560px] lg:mt-36">
            {/* 移动端品牌头 */}
            <div className="lg:hidden text-center mb-7">
              <div className="inline-block bg-white rounded-xl px-4 py-2.5 shadow-md border border-slate-100 mb-3">
                <img src={logoCliniX} alt="CLINI X TRIALS" className="h-9 w-auto" />
              </div>
              <p className="text-xs text-slate-400">以智能科技 · 赋能科研创新</p>
            </div>

            <div className="relative">
              {/* 卡片光晕 */}
              <div className="absolute -inset-3 rounded-[2rem] bg-gradient-to-br from-teal-300/40 via-cyan-200/30 to-sky-300/40 blur-xl" />
              <div className="relative bg-white/95 backdrop-blur rounded-3xl shadow-2xl shadow-teal-900/10 border border-white px-10 py-8 overflow-hidden">
                {/* 顶部三段式渐变装饰条 */}
                <div className="absolute top-0 left-10 right-10 flex gap-1.5">
                  <span className="h-[3px] flex-[2] rounded-full bg-gradient-to-r from-teal-400 to-teal-300" />
                  <span className="h-[3px] flex-[3] rounded-full bg-gradient-to-r from-cyan-400 to-cyan-300" />
                  <span className="h-[3px] flex-[2] rounded-full bg-gradient-to-r from-sky-400 to-sky-300" />
                </div>

                {/* ==================== 统一登录表单 ==================== */}
                <div className="mb-6 text-center">
                  <img src={logoCliniX} alt="CLINI X TRIALS" className="h-10 w-auto mx-auto mb-4 drop-shadow-sm" />
                  <h2 className="text-2xl font-bold text-slate-800 tracking-wide">欢迎回来</h2>
                  <p className="text-xs text-slate-400 mt-1.5 tracking-[0.12em]">Research Data Management System</p>
                </div>
                <div className="space-y-4">
                  <div className="relative group">
                    <Mail className="w-4 h-4 text-slate-300 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none transition-colors group-focus-within:text-teal-500" />
                    <Input
                      type="text"
                      placeholder="登录账号 / 邮箱"
                      value={account}
                      onChange={(e) => setAccount(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                      className="pl-10 h-12 text-sm bg-slate-50/70 rounded-xl border-slate-200 focus-visible:border-teal-400 focus-visible:ring-teal-400/30"
                      autoFocus
                    />
                  </div>
                  <div className="relative group">
                    <Lock className="w-4 h-4 text-slate-300 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none transition-colors group-focus-within:text-teal-500" />
                    <Input
                      type={showPwd ? 'text' : 'password'}
                      placeholder="登录密码"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                      className="pl-10 pr-10 h-12 text-sm bg-slate-50/70 rounded-xl border-slate-200 focus-visible:border-teal-400 focus-visible:ring-teal-400/30"
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-teal-600 transition-colors"
                      onClick={() => setShowPwd(!showPwd)}
                    >
                      {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <div className="flex justify-end -mt-1.5">
                    <button
                      type="button"
                      onClick={() => setShowForgot((v) => !v)}
                      className="text-xs text-slate-400 hover:text-teal-600 transition-colors"
                    >
                      忘记密码？
                    </button>
                  </div>
                  {showForgot && (
                    <p className="text-[11px] leading-relaxed text-teal-700 bg-teal-50 border border-teal-100 rounded-lg px-3 py-2.5">
                      账号与初始密码由授权人通过邮件发放。如需重置密码，请联系您的课题管理人员或平台管理员，重置后您将收到新的授权邮件。
                    </p>
                  )}
                  <div className="flex gap-3">
                    <div className="relative group flex-1">
                      <Smartphone className="w-4 h-4 text-slate-300 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none transition-colors group-focus-within:text-teal-500" />
                      <Input
                        type="text"
                        inputMode="numeric"
                        placeholder="手机验证码"
                        value={codeInput}
                        onChange={(e) => setCodeInput(e.target.value.replace(/\D/g, ''))}
                        onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                        className="pl-10 h-12 text-sm bg-slate-50/70 rounded-xl border-slate-200 focus-visible:border-teal-400 focus-visible:ring-teal-400/30"
                        maxLength={6}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={sendCode}
                      disabled={countdown > 0}
                      className="h-12 w-32 shrink-0 rounded-xl border border-teal-200 bg-gradient-to-br from-teal-50 to-cyan-50 text-xs font-semibold text-teal-600 hover:border-teal-400 hover:text-teal-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {countdown > 0 ? `${countdown}s 后重发` : '获取验证码'}
                    </button>
                  </div>
                  {codeHint && (
                    <p className="text-[11px] leading-relaxed text-teal-700 bg-teal-50 border border-teal-100 rounded-lg px-3 py-2">
                      {codeHint}
                    </p>
                  )}
                  {error && <p className="text-xs text-red-500">{error}</p>}
                  <Button
                    className="w-full h-12 rounded-xl bg-gradient-to-r from-teal-500 via-cyan-500 to-sky-500 hover:from-teal-600 hover:via-cyan-600 hover:to-sky-600 text-white shadow-lg shadow-teal-500/25 transition-all duration-300 group"
                    disabled={!account.trim() || !password || !codeInput.trim()}
                    onClick={handleLogin}
                  >
                    登录 <ArrowRight className="w-4 h-4 ml-1.5 transition-transform duration-300 group-hover:translate-x-1" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 底部版权 */}
      <footer className="absolute bottom-4 left-0 right-0 z-10 text-center text-[11px] text-slate-400/90 tracking-wide">
        © 2026 小乂临研 · CliniX Trials RDMS
      </footer>
    </div>
  )
}
