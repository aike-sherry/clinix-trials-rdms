import { Link, useLocation, Outlet, useSearchParams, useNavigate } from 'react-router'
import {
  Home, FolderOpen, BarChart3, Users, Database,
  PieChart, UserCircle, Bell, Search, Plus, Check,
  PanelLeft, PanelTop
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAppStorage } from '@/hooks/useAppStorage'
import { useState, useEffect } from 'react'

const navItems = [
  { path: '/manager', label: '首页', icon: Home },
  { path: '/manager/projects', label: '项目管理', icon: FolderOpen },
  { path: '/manager/progress', label: '进度管理', icon: BarChart3 },
  { path: '/manager/patients', label: '患者管理', icon: Users },
  { path: '/manager/data', label: '数据管理', icon: Database },
  { path: '/manager/statistics', label: '统计分析', icon: PieChart },
  { path: '/manager/account', label: '账户管理', icon: UserCircle },
]

const NAV_MODE_KEY = 'crf_nav_mode'

export default function ManagerLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { projects } = useAppStorage()

  const [navMode, setNavMode] = useState<'horizontal' | 'vertical'>(() => {
    const stored = localStorage.getItem(NAV_MODE_KEY)
    return stored === 'vertical' ? 'vertical' : 'horizontal'
  })

  useEffect(() => {
    localStorage.setItem(NAV_MODE_KEY, navMode)
  }, [navMode])

  const isActive = (path: string) => {
    if (path === '/manager') return location.pathname === '/manager'
    return location.pathname.startsWith(path)
  }

  const isProjectsPage = location.pathname === '/manager/projects'
  const isProgressPage = location.pathname === '/manager/progress'
  const isPatientsPage = location.pathname === '/manager/patients'
  const isDataPage = location.pathname === '/manager/data'

  const search = searchParams.get('search') || ''
  const selectedProjectNo = searchParams.get('projectNo') || 'all'

  // 数据管理页：项目必选（默认取第一个已设计 CRF 的项目）
  const dataDefaultProjectNo =
    (projects.find((p) => p.crfModules.length > 0) ?? projects[0])?.projectNo ?? 'all'
  const resolvedProjectNo = isDataPage
    ? (projects.some((p) => p.projectNo === selectedProjectNo) ? selectedProjectNo : dataDefaultProjectNo)
    : selectedProjectNo

  const setSearch = (value: string) => {
    const newParams = new URLSearchParams(searchParams)
    if (value) newParams.set('search', value)
    else newParams.delete('search')
    setSearchParams(newParams)
  }

  const setSelectedProjectNo = (value: string) => {
    const newParams = new URLSearchParams(searchParams)
    if (value !== 'all') newParams.set('projectNo', value)
    else newParams.delete('projectNo')
    setSearchParams(newParams)
  }

  const handleCreateProject = () => {
    const newParams = new URLSearchParams(searchParams)
    newParams.set('create', '1')
    navigate(`/manager/projects?${newParams.toString()}`)
  }

  // 顶部 Header（横版竖版共用）
  const TopHeader = () => (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 sticky top-0 z-30 shadow-sm">
      {/* 左侧：Logo图片 + 平台名称 */}
      <div className="flex items-center gap-3">
        <img src="/logo.png" alt="江苏大学附属医院" className="h-9 object-contain" />
        <div className="h-5 w-px bg-slate-300" />
        <span className="text-sky-500 font-medium text-base">科研数据管理平台</span>
      </div>

      {/* 右侧控件 */}
      <div className="flex items-center gap-3">
        {isProjectsPage && (
          <>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="搜索项目编号/名称/研究者"
                className="pl-9 w-64 bg-slate-50 border-slate-200"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Button className="bg-sky-500 hover:bg-sky-600 text-white" onClick={handleCreateProject}>
              <Plus className="w-4 h-4 mr-1" /> 创建项目
            </Button>
            <Select value={selectedProjectNo} onValueChange={setSelectedProjectNo}>
              <SelectTrigger className="w-44 bg-slate-50 border-slate-200">
                <SelectValue placeholder="全部研究" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  <div className="flex items-center gap-2">
                    <span>全部研究</span>
                    {selectedProjectNo === 'all' && <Check className="w-3.5 h-3.5 text-sky-500" />}
                  </div>
                </SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.projectNo}>
                    <div className="flex items-center gap-2">
                      <span>{p.projectNo}</span>
                      {selectedProjectNo === p.projectNo && <Check className="w-3.5 h-3.5 text-sky-500" />}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        )}

        {(isProgressPage || isPatientsPage || isDataPage) && (
          <Select value={resolvedProjectNo} onValueChange={setSelectedProjectNo}>
            <SelectTrigger className="w-44 bg-slate-50 border-slate-200">
              <SelectValue placeholder="全部研究" />
            </SelectTrigger>
            <SelectContent>
              {!isDataPage && (
                <SelectItem value="all">
                  <div className="flex items-center gap-2">
                    <span>全部研究</span>
                    {selectedProjectNo === 'all' && <Check className="w-3.5 h-3.5 text-sky-500" />}
                  </div>
                </SelectItem>
              )}
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.projectNo}>
                  <div className="flex items-center gap-2">
                    <span>{p.projectNo}</span>
                    {resolvedProjectNo === p.projectNo && <Check className="w-3.5 h-3.5 text-sky-500" />}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

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
            管
          </div>
          <div className="text-xs">
            <div className="font-medium text-slate-700">管理用户</div>
            <div className="text-slate-400">项目负责人</div>
          </div>
        </div>
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
          <Outlet />
        </main>
      </div>
    </div>
  )
}
