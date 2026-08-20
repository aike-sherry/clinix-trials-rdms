import { useState } from 'react'
import { useNavigate } from 'react-router'
import { ChevronDown, KeyRound, LogOut } from 'lucide-react'

/**
 * 顶栏用户菜单：渐变头像 + 姓名/角色，点击展开下拉
 * （账号信息 + 修改登录账号/密码 + 退出登录）。
 */
export default function UserMenu({
  name,
  roleLabel,
  email,
  onLogout,
}: {
  name?: string
  roleLabel: string
  email?: string
  onLogout: () => void
}) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  return (
    <div className="relative pl-3 border-l border-slate-200">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-2.5 rounded-full py-1 pl-1 pr-2.5 transition-colors ${
          open ? 'bg-slate-100' : 'hover:bg-slate-100'
        }`}
      >
        <span className="w-8 h-8 rounded-full bg-gradient-to-br from-teal-500 to-sky-600 flex items-center justify-center text-white text-sm font-bold shadow-md">
          {name?.slice(0, 1) ?? '用'}
        </span>
        <span className="text-left">
          <span className="block text-xs font-semibold text-slate-700 leading-tight">{name ?? '用户'}</span>
          <span className="block text-[10px] text-slate-400 leading-tight mt-0.5">{roleLabel}</span>
        </span>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          {/* 点击外部关闭 */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-12 z-50 w-64 rounded-2xl bg-white shadow-xl shadow-slate-900/10 border border-slate-100 overflow-hidden">
            {/* 账号信息 */}
            <div className="flex items-center gap-3 px-4 py-4 bg-gradient-to-r from-teal-50/60 to-sky-50/60 border-b border-slate-100">
              <span className="w-11 h-11 rounded-full bg-gradient-to-br from-teal-500 to-sky-600 flex items-center justify-center text-white text-base font-bold shadow-md shrink-0">
                {name?.slice(0, 1) ?? '用'}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-800 truncate">{name ?? '用户'}</p>
                <p className="text-[11px] text-teal-600 mt-0.5">{roleLabel}</p>
                {email && <p className="text-[11px] text-slate-400 truncate mt-0.5">{email}</p>}
              </div>
            </div>

            {/* 菜单项 */}
            <div className="p-1.5">
              <button
                type="button"
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-slate-600 hover:bg-slate-50 hover:text-teal-600 transition-colors"
                onClick={() => {
                  setOpen(false)
                  navigate('/change-password')
                }}
              >
                <KeyRound className="w-4 h-4 text-slate-400" />
                修改登录账号 / 密码
              </button>
              <button
                type="button"
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-slate-600 hover:bg-red-50 hover:text-red-500 transition-colors"
                onClick={() => {
                  setOpen(false)
                  onLogout()
                }}
              >
                <LogOut className="w-4 h-4 text-slate-400" />
                退出登录
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
