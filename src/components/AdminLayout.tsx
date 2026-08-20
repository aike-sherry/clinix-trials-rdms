import { Link, useLocation, Outlet } from 'react-router'
import {
  Home, FolderOpen, Package, Building2,
  UserCircle, Bell, PanelLeft, PanelTop, LogOut, History
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useState, useEffect } from 'react'
import RouteCrumb, { type CrumbRule } from '@/components/RouteCrumb'

const crumbRules: CrumbRule[] = [
  { prefix: '/admin/projects/', module: '项目管理', sub: '项目详情' },
  { prefix: '/admin/projects', module: '项目管理', sub: '项目总览' },
  { prefix: '/admin/module-library', module: '模块管理', sub: '模块库' },
  { prefix: '/admin/customers', module: '客户管理', sub: '客户清单' },
  { prefix: '/admin/audit', module: '数据留痕', sub: '留痕总览' },
  { prefix: '/admin/account', module: '账号管理', sub: '账号总览' },
  { prefix: '/admin', module: '首页', sub: '工作台' },
]

const navItems = [
  { path: '/admin', label: '首页', icon: Home },
  { path: '/admin/projects', label: '项目管理', icon: FolderOpen },
  { path: '/admin/module-library', label: '模块管理', icon: Package },
  { path: '/admin/customers', label: '客户管理', icon: Building2 },
  { path: '/admin/audit', label: '数据留痕', icon: History },
  { path: '/admin/account', label: '账号管理', icon: UserCircle },
]

const NAV_MODE_KEY = 'crf_admin_nav_mode'

export default function AdminLayout() {
  const location = useLocation()

  const [navMode, setNavMode] = useState<'horizontal' | 'vertical'>(() => {
    const stored = localStorage.getItem(NAV_MODE_KEY)
    return stored === 'vertical' ? 'vertical' : 'horizontal'
  })

  useEffect(() => {
    localStorage.setItem(NAV_MODE_KEY, navMode)
  }, [navMode])

  const isActive = (path: string) => {
    if (path === '/admin') return location.pathname === '/admin'
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

  // 顶部 Header（横版竖版共用）
  const TopHeader = () => (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 sticky top-0 z-30 shadow-sm">
      {/* 左侧：小乂临研 Logo + 平台名称 */}
      <div className="flex items-center gap-3">
        <img src="/xiaoyi-logo.png" alt="小乂临研" className="h-9 object-contain" />
        <div className="h-5 w-px bg-slate-300" />
        <span className="text-sky-500 font-medium text-base">科研数据管理平台</span>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">后台管理端</span>
      </div>

      {/* 右侧控件 */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="text-slate-400 hover:text-slate-600"
          onClick={() => setNavMode(navMode === 'horizontal' ? 'vertical' : 'horizontal')}
          title={navMode === 'horizontal' ? '切换到竖版导航' : '切换到横版导航'}
        >
          {navMode === 'horizontal' ? <PanelLeft className="w-5 h-5" /> : <PanelTop className="w-5 h-5" />}
        </Button>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-5 h-5 text-slate-500" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
        </Button>
        <div className="flex items-center gap-2 pl-3 border-l border-slate-200">
          <div className="w-8 h-8 rounded-full bg-sky-100 flex items-center justify-center text-sky-600 text-sm font-bold">
            后
          </div>
          <div className="text-xs">
            <div className="font-medium text-slate-700">后台管理员</div>
            <div className="text-slate-400">系统管理员</div>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="text-slate-400 hover:text-red-500"
          onClick={handleLogout}
          title="退出登录"
        >
          <LogOut className="w-4 h-4" />
        </Button>
      </div>
    </header>
  )

  // ========== 横版布局 ==========
  if (navMode === 'horizontal') {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50">
        <TopHeader />

        {/* 横向导航栏 - 卡片式 */}
        <nav className="bg-white border-b border-slate-200 px-6 py-2">
          <div className="flex items-center gap-2">
            {navItems.map((item) => {
              const Icon = item.icon
              const active = isActive(item.path)
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-2 px-4 py-2 text-sm rounded-xl transition-all ${
                    active
                      ? 'bg-sky-50 text-sky-600 font-medium shadow-sm'
                      : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                  }`}
                >
                  <Icon className="w-[16px] h-[16px]" />
                  {item.label}
                </Link>
              )
            })}
          </div>
        </nav>

        <main className="flex-1 p-6">
          <RouteCrumb rules={crumbRules} />
          <Outlet />
        </main>
      </div>
    )
  }

  // ========== 竖版布局 ==========
  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* 顶部 Header - 与左右留间距 */}
      <div className="px-3 pt-3">
        <TopHeader />
      </div>

      {/* 下方区域：左侧导航 + 右侧内容 */}
      <div className="flex flex-1 pt-3 px-3 pb-3 gap-3 min-h-0">
        {/* 左侧导航 - 上图标下文字 */}
        <aside className="w-36 bg-sky-400 flex flex-col rounded-2xl shrink-0 self-stretch">
          <nav className="flex-1 px-2 py-3 space-y-2 overflow-y-auto">
            {navItems.map((item) => {
              const Icon = item.icon
              const active = isActive(item.path)
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex flex-col items-center justify-center gap-1 px-2 py-2.5 rounded-xl text-xs transition-all ${
                    active
                      ? 'bg-gradient-to-r from-cyan-300 to-teal-300 text-white font-semibold shadow-lg'
                      : 'text-white hover:bg-white/20'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </nav>
        </aside>

        {/* 主内容区域 */}
        <main className="flex-1 p-6 bg-white rounded-2xl overflow-y-auto">
          <RouteCrumb rules={crumbRules} />
          <Outlet />
        </main>
      </div>
    </div>
  )
}
