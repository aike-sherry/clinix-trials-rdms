import { Link, useLocation, Outlet, useSearchParams, useNavigate } from 'react-router'
import {
  Home, FolderOpen, BarChart3, Users, Database,
  PieChart, UserCircle, Search,
  PanelLeft, PanelTop, CalendarCheck, MessageCircleQuestion, ClipboardCheck,
  ArrowLeft, DatabaseZap,
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
import type { ModuleKey } from '@/types'
import RouteCrumb, { type CrumbRule } from '@/components/RouteCrumb'
import NotificationBell from '@/components/NotificationBell'
import UserMenu from '@/components/UserMenu'

const crumbRules: CrumbRule[] = [
  { prefix: '/manager/projects/', module: '项目管理', sub: '项目详情' },
  { prefix: '/manager/patients/', module: '患者管理', sub: '患者详情' },
  { prefix: '/manager/review/', module: '数据审核', sub: '数据审核' },
  { prefix: '/manager/projects', module: '项目管理', sub: '项目总览' },
  { prefix: '/manager/progress', module: '进度管理', sub: '进度总览' },
  { prefix: '/manager/patients', module: '患者管理', sub: '患者清单' },
  { prefix: '/manager/visits', module: '访视管理', sub: '访视提醒' },
  { prefix: '/manager/data', module: '统计分析', sub: '统计报表' },
  { prefix: '/manager/statistics', module: '数据管理', sub: '录入 · 审核 · 签名' },
  { prefix: '/manager/review', module: '数据审核', sub: '患者清单' },
  { prefix: '/manager/queries', module: '疑问管理', sub: '疑问清单' },
  { prefix: '/manager/integration', module: '数据集成', sub: '抓取控制' },
  { prefix: '/manager/account', module: '账户管理', sub: '账户总览' },
  { prefix: '/manager', module: '首页', sub: '工作台' },
]

const navItems = [
  { path: '/manager', label: '首页', icon: Home },
  { path: '/manager/projects', label: '项目管理', icon: FolderOpen },
  { path: '/manager/progress', label: '进度管理', icon: BarChart3 },
  { path: '/manager/patients', label: '患者管理', icon: Users, moduleKey: 'patients' as const },
  { path: '/manager/visits', label: '访视管理', icon: CalendarCheck, moduleKey: 'visits' as const },
  { path: '/manager/integration', label: '数据集成', icon: DatabaseZap, moduleKey: 'integration' as const },
  { path: '/manager/statistics', label: '数据管理', icon: Database, moduleKey: 'dataMgmt' as const },
  { path: '/manager/review', label: '数据审核', icon: ClipboardCheck, moduleKey: 'dataMgmt' as const },
  { path: '/manager/queries', label: '疑问管理', icon: MessageCircleQuestion, moduleKey: 'queries' as const },
  { path: '/manager/data', label: '统计分析', icon: PieChart, moduleKey: 'statistics' as const },
  { path: '/manager/account', label: '账户管理', icon: UserCircle },
]

const NAV_MODE_KEY = 'crf_nav_mode'

export default function ManagerLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { projects, currentUser } = useAppStorage()

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

  // 模块授权过滤：未设置 moduleAccess 时（旧数据）全部可见
  const visibleNavItems = navItems.filter((item) => {
    const mk = (item as { moduleKey?: ModuleKey }).moduleKey
    if (!mk || !currentUser?.moduleAccess) return true
    return currentUser.moduleAccess.includes(mk)
  })

  const isProjectsPage = location.pathname === '/manager/projects'
  const isProgressPage = location.pathname === '/manager/progress'
  const isPatientsPage = location.pathname === '/manager/patients'
  const isDataPage = location.pathname === '/manager/data'
  const isStatisticsPage = location.pathname === '/manager/statistics'
  const isVisitsPage = location.pathname === '/manager/visits'
  const isQueriesPage = location.pathname === '/manager/queries'
  const isReviewPage = location.pathname.startsWith('/manager/review')
  const isAccountPage = location.pathname === '/manager/account'
  // 统计分析页：项目必选（默认取第一个已设计 CRF 的项目）；数据管理页支持「全部研究」
  const projectRequiredPage = isDataPage

  const search = searchParams.get('search') || ''
  const selectedProjectNo = searchParams.get('projectNo') || 'all'
  // 从项目详情跳转来时（URL 带 projectNo），提供「返回项目」入口
  const backProject = projects.find((p) => p.projectNo === selectedProjectNo)

  // 数据管理页：「进度总览 / 数据矩阵」切换器放到标题行右侧，与录入端一致
  const dataMgmtTab = searchParams.get('tab') === 'matrix' ? 'matrix' : 'progress'
  const setDataMgmtTab = (t: 'progress' | 'matrix') => {
    const newParams = new URLSearchParams(searchParams)
    if (t === 'matrix') newParams.set('tab', 'matrix')
    else newParams.delete('tab')
    setSearchParams(newParams)
  }
  const crumbTrailing = isStatisticsPage ? (
    <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 p-1">
      {(
        [
          ['progress', '进度总览'],
          ['matrix', '数据矩阵'],
        ] as const
      ).map(([key, label]) => (
        <button
          key={key}
          onClick={() => setDataMgmtTab(key)}
          className={`px-4 h-7 rounded-md text-sm transition-colors ${
            dataMgmtTab === key
              ? 'bg-white text-slate-800 font-medium shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          {label}
        </button>
      ))}
    </span>
  ) : undefined

  // 统计分析页：项目必选（默认取第一个已设计 CRF 的项目）
  const dataDefaultProjectNo =
    (projects.find((p) => p.crfModules.length > 0) ?? projects[0])?.projectNo ?? 'all'
  const resolvedProjectNo = projectRequiredPage
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

  // 顶部 Header（横版竖版共用）：毛玻璃 + 渐变品牌字 + 底部渐变细线
  const TopHeader = () => (
    <header className="h-16 relative bg-white/80 backdrop-blur-md flex items-center justify-between px-6 sticky top-0 z-30">
      {/* 底部青蓝渐变细线（替代灰色边框） */}
      <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-teal-400/70 via-sky-400/50 to-transparent" />

      {/* 左侧：Logo图片 + 渐变品牌名 */}
      <div className="flex items-center gap-3">
        <img src="/logo-hospital.png" alt="江苏大学附属医院" className="h-9 object-contain" />
        <div className="h-6 w-px bg-gradient-to-b from-transparent via-teal-300/70 to-transparent" />
        <div>
          <p className="text-base font-bold leading-tight tracking-wide bg-gradient-to-r from-teal-600 via-sky-600 to-blue-600 bg-clip-text text-transparent">
            科研数据管理平台
          </p>
          <p className="text-[9px] text-slate-400 tracking-[0.16em] mt-0.5">RESEARCH DATA MANAGEMENT SYSTEM</p>
        </div>
      </div>

      {/* 右侧控件 */}
      <div className="flex items-center gap-3">
        {isProjectsPage && (
          <>
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="搜索项目编号/名称/研究者"
                className="pl-10 w-64 h-9 rounded-full bg-slate-100 border-transparent shadow-none focus-visible:bg-white focus-visible:border-teal-300 focus-visible:ring-teal-500/20 transition-colors"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={selectedProjectNo} onValueChange={setSelectedProjectNo}>
              <SelectTrigger className="w-44 h-9 rounded-full bg-slate-100 border-transparent shadow-none focus:ring-teal-500/20 data-[state=open]:bg-white transition-colors">
                <SelectValue placeholder="全部研究" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  <span>全部研究</span>
                </SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.projectNo}>
                    <span>{p.projectNo}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        )}

        {(isProgressPage || isPatientsPage || isDataPage || isStatisticsPage || isVisitsPage || isQueriesPage || isReviewPage) && (
          <>
            <Select value={resolvedProjectNo} onValueChange={setSelectedProjectNo}>
              <SelectTrigger className="w-44 h-9 rounded-full bg-slate-100 border-transparent shadow-none focus:ring-teal-500/20 data-[state=open]:bg-white transition-colors">
                <SelectValue placeholder="全部研究" />
              </SelectTrigger>
              <SelectContent>
                {!projectRequiredPage && (
                  <SelectItem value="all">
                    <span>全部研究</span>
                  </SelectItem>
                )}
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.projectNo}>
                    <span>{p.projectNo}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* 从项目详情跳转来时，提供返回项目概况的入口 */}
            {backProject && (
              <Button asChild variant="outline" size="sm" className="h-9 rounded-full text-xs text-slate-600 border-slate-200">
                <Link to={`/manager/projects/${backProject.id}/overview`}>
                  <ArrowLeft className="w-3.5 h-3.5 mr-1" /> 返回项目
                </Link>
              </Button>
            )}
          </>
        )}

        {isAccountPage && backProject && (
          <Button asChild variant="outline" size="sm" className="h-9 rounded-full text-xs text-slate-600 border-slate-200">
            <Link to={`/manager/projects/${backProject.id}/overview`}>
              <ArrowLeft className="w-3.5 h-3.5 mr-1" /> 返回项目
            </Link>
          </Button>
        )}

        <Button
          variant="ghost"
          size="icon"
          className="rounded-full text-slate-400 hover:text-teal-600 hover:bg-slate-100"
          onClick={() => setNavMode(navMode === 'horizontal' ? 'vertical' : 'horizontal')}
          title={navMode === 'horizontal' ? '切换到竖版导航' : '切换到横版导航'}
        >
          {navMode === 'horizontal' ? <PanelLeft className="w-5 h-5" /> : <PanelTop className="w-5 h-5" />}
        </Button>

        {/* 公告通知 */}
        <NotificationBell role="manager" />

        {/* 用户菜单：修改账号/密码、退出登录收进下拉 */}
        <UserMenu
          name={currentUser?.name}
          roleLabel="项目负责人"
          email={currentUser?.email}
          onLogout={() => {
            const raw = localStorage.getItem('clini_x_rdms_data')
            const data = raw ? JSON.parse(raw) : {}
            delete data.currentUser
            localStorage.setItem('clini_x_rdms_data', JSON.stringify(data))
            navigate('/login')
          }}
        />
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
            {visibleNavItems.map((item) => {
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
          <RouteCrumb rules={crumbRules} trailing={crumbTrailing} />
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
            {visibleNavItems.map((item) => {
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
          <RouteCrumb rules={crumbRules} trailing={crumbTrailing} />
          <Outlet />
        </main>
      </div>
    </div>
  )
}
