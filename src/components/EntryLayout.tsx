import { Link, useLocation, Outlet } from 'react-router'
import {
  Home, Users, ClipboardList, Database, BarChart3,
  Bell, Settings, LogOut
} from 'lucide-react'
import { Button } from '@/components/ui/button'

const navItems = [
  { path: '/entry', label: '首页', icon: Home },
  { path: '/entry/patients', label: '患者登记', icon: Users },
  { path: '/entry/data-entry', label: '数据录入', icon: ClipboardList },
  { path: '/entry/my-data', label: '我的数据', icon: Database },
  { path: '/entry/progress', label: '录入进度', icon: BarChart3 },
]

export default function EntryLayout() {
  const location = useLocation()

  const isActive = (path: string) => {
    if (path === '/entry') return location.pathname === '/entry'
    return location.pathname.startsWith(path)
  }

  const handleLogout = () => {
    const raw = localStorage.getItem('clini_x_rdms_data')
    if (raw) {
      const data = JSON.parse(raw)
      delete data.currentUser
      localStorage.setItem('clini_x_rdms_data', JSON.stringify(data))
    }
    window.location.href = '/login'
  }

  return (
    <div className="min-h-screen flex bg-slate-50">
      <aside className="w-56 bg-gradient-to-b from-amber-500 to-amber-600 flex flex-col fixed h-screen z-40">
        <div className="p-5 flex items-center gap-3 border-b border-amber-400/30">
          <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
            <span className="text-white font-bold text-sm">录</span>
          </div>
          <div>
            <div className="text-white font-bold text-sm leading-tight">科研数据管理平台</div>
            <div className="text-amber-100 text-[10px]">数据录入端</div>
          </div>
        </div>

        <nav className="flex-1 py-4 px-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon
            const active = isActive(item.path)
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  active
                    ? 'bg-white/20 text-white font-medium'
                    : 'text-amber-50 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon className="w-[18px] h-[18px]" />
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="p-4 border-t border-amber-400/30 space-y-2">
          <div className="flex items-center gap-2 text-amber-100 text-xs">
            <Settings className="w-4 h-4" />
            <span>系统设置</span>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-amber-100 text-xs hover:text-white transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>退出登录</span>
          </button>
        </div>
      </aside>

      <div className="flex-1 ml-56">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 sticky top-0 z-30">
          <div className="flex items-center gap-2 text-slate-500 text-sm">
            <span>科研数据管理平台</span>
            <span className="text-slate-300">/</span>
            <span className="text-amber-600 font-medium">数据录入</span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="w-5 h-5 text-slate-500" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
            </Button>
            <div className="flex items-center gap-2 pl-3 border-l border-slate-200">
              <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 text-sm font-bold">
                录
              </div>
              <div className="text-xs">
                <div className="font-medium text-slate-700">录入员</div>
                <div className="text-slate-400">数据录入人员</div>
              </div>
            </div>
          </div>
        </header>

        <main className="p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
