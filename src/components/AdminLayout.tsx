import { Link, useLocation, Outlet } from 'react-router'
import {
  Home, FolderOpen, BarChart3, Users, Database,
  PieChart, UserCircle, Plus, Bell, Settings, FlaskConical, Package
} from 'lucide-react'
import { Button } from '@/components/ui/button'

const navItems = [
  { path: '/', label: '首页', icon: Home },
  { path: '/projects', label: '项目管理', icon: FolderOpen },
  { path: '/module-library', label: '模块库', icon: Package },
  { path: '/crf-designer', label: 'CRF设计', icon: FlaskConical },
  { path: '/progress', label: '进度管理', icon: BarChart3 },
  { path: '/patients', label: '患者管理', icon: Users },
  { path: '/data-mgmt', label: '数据管理', icon: Database },
  { path: '/statistics', label: '统计分析', icon: PieChart },
  { path: '/account', label: '账户管理', icon: UserCircle },
]

export default function AdminLayout() {
  const location = useLocation()

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/'
    return location.pathname.startsWith(path)
  }

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* 左侧导航 */}
      <aside className="w-56 bg-gradient-to-b from-teal-500 to-teal-600 flex flex-col fixed h-screen z-40">
        {/* Logo区域 */}
        <div className="p-5 flex items-center gap-3 border-b border-teal-400/30">
          <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
            <span className="text-white font-bold text-sm">研</span>
          </div>
          <div>
            <div className="text-white font-bold text-sm leading-tight">科研数据管理平台</div>
            <div className="text-teal-100 text-[10px]">CLINI X TRIALS</div>
          </div>
        </div>

        {/* 导航菜单 */}
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
                    : 'text-teal-50 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon className="w-[18px] h-[18px]" />
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* 底部 */}
        <div className="p-4 border-t border-teal-400/30">
          <div className="flex items-center gap-2 text-teal-100 text-xs">
            <Settings className="w-4 h-4" />
            <span>系统设置</span>
          </div>
        </div>
      </aside>

      {/* 主内容区 */}
      <div className="flex-1 ml-56">
        {/* 顶部 Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 sticky top-0 z-30">
          <div className="flex items-center gap-2 text-slate-500 text-sm">
            <span>科研数据管理平台</span>
          </div>
          <div className="flex items-center gap-3">
            <Button size="sm" className="bg-teal-500 hover:bg-teal-600 text-white gap-1" asChild>
              <Link to="/projects?create=1">
                <Plus className="w-3.5 h-3.5" /> 创建项目
              </Link>
            </Button>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="w-5 h-5 text-slate-500" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
            </Button>
            <div className="flex items-center gap-2 pl-3 border-l border-slate-200">
              <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center text-teal-600 text-sm font-bold">
                石
              </div>
              <div className="text-xs">
                <div className="font-medium text-slate-700">石磊</div>
                <div className="text-slate-400">主任医师</div>
              </div>
            </div>
          </div>
        </header>

        {/* 页面内容 */}
        <main className="p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
