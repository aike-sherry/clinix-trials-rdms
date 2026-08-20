import { Link, useLocation, Outlet, useSearchParams, useNavigate } from 'react-router'
import {
  Home, FolderOpen, Users, UserPlus,
  Bell, Search, CalendarCheck, Database, FileSignature,
  ClipboardEdit, PanelLeft, PanelTop, MessageCircleQuestion,
  KeyRound, LogOut,
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

const crumbRules: CrumbRule[] = [
  { prefix: '/entry/patients/', module: '患者管理', sub: '患者详情' },
  { prefix: '/entry/projects', module: '项目管理', sub: '项目总览' },
  { prefix: '/entry/subjects', module: '受试者登记', sub: '登记总览' },
  { prefix: '/entry/patients', module: '患者管理', sub: '患者清单' },
  { prefix: '/entry/visits', module: '访视管理', sub: '访视提醒' },
  { prefix: '/entry/data-entry', module: '数据录入', sub: '访视录入矩阵' },
  { prefix: '/entry/data-mgmt', module: '数据管理', sub: '录入 · 审核 · 签名' },
  { prefix: '/entry/queries', module: '疑问管理', sub: '疑问清单' },
  { prefix: '/entry/my-data', module: '我的工作台', sub: '待办 · 质量 · 留痕' },
  { prefix: '/entry', module: '首页', sub: '工作台' },
]

const navItems = [
  { path: '/entry', label: '首页', icon: Home },
  { path: '/entry/projects', label: '项目管理', icon: FolderOpen },
  { path: '/entry/subjects', label: '受试者登记', icon: UserPlus },
  { path: '/entry/patients', label: '患者管理', icon: Users, moduleKey: 'patients' as const },
  { path: '/entry/visits', label: '访视管理', icon: CalendarCheck, moduleKey: 'visits' as const },
  { path: '/entry/data-entry', label: '数据录入', icon: ClipboardEdit },
  { path: '/entry/data-mgmt', label: '数据管理', icon: FileSignature, moduleKey: 'dataMgmt' as const },
  { path: '/entry/queries', label: '疑问管理', icon: MessageCircleQuestion, moduleKey: 'queries' as const },
  { path: '/entry/my-data', label: '我的工作台', icon: Database },
]

const NAV_MODE_KEY = 'crf_nav_mode'

export default function EntryLayout() {
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
    if (path === '/entry') return location.pathname === '/entry'
    return location.pathname.startsWith(path)
  }

  // 模块授权过滤：未设置 moduleAccess 时（管理员/旧数据）全部可见
  const visibleNavItems = navItems.filter((item) => {
    const mk = (item as { moduleKey?: ModuleKey }).moduleKey
    if (!mk || !currentUser?.moduleAccess) return true
    return currentUser.moduleAccess.includes(mk)
  })

  const isProjectsPage = location.pathname === '/entry/projects'
  const isPatientsPage = location.pathname === '/entry/patients'
  const isSubjectsPage = location.pathname === '/entry/subjects'
  const isVisitsPage = location.pathname === '/entry/visits'
  const isMyDataPage = location.pathname === '/entry/my-data'
  const isDataMgmtPage = location.pathname === '/entry/data-mgmt'
  const isQueriesPage = location.pathname === '/entry/queries'
  const isDataEntryPage = location.pathname === '/entry/data-entry'
  const isPatientDetailPage = location.pathname.startsWith('/entry/patients/')
  // 需要项目筛选的页面
  const projectFilterPage = isProjectsPage || isPatientsPage || isSubjectsPage || isVisitsPage || isMyDataPage || isDataMgmtPage || isQueriesPage || isDataEntryPage || isPatientDetailPage

  const search = searchParams.get('search') || ''
  const selectedProjectNo = searchParams.get('projectNo') || 'all'

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

  const handleRegisterSubject = () => {
    navigate('/entry/subjects')
  }

  // 数据管理页：「进度总览 / 数据矩阵」切换器放到模块定位条右侧，与标题同行
  const dataMgmtTab = searchParams.get('tab') === 'matrix' ? 'matrix' : 'progress'
  const setDataMgmtTab = (t: 'progress' | 'matrix') => {
    const newParams = new URLSearchParams(searchParams)
    if (t === 'matrix') newParams.set('tab', 'matrix')
    else newParams.delete('tab')
    setSearchParams(newParams)
  }
  const crumbTrailing = isDataMgmtPage ? (
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

  // 顶部 Header（横版竖版共用）- 与管理端一致
  const TopHeader = () => (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 sticky top-0 z-30 shadow-sm">
      {/* 左侧：Logo图片 + 平台名称 */}
      <div className="flex items-center gap-3">
        <img src="/logo-hospital.png" alt="江苏大学附属医院" className="h-9 object-contain" />
        <div className="h-5 w-px bg-slate-300" />
        <span className="text-sky-500 font-medium text-base">科研数据管理平台</span>
      </div>

      {/* 右侧控件 */}
      <div className="flex items-center gap-3">
        {projectFilterPage && (
          <>
            {(isProjectsPage || isPatientsPage || isSubjectsPage) && (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder={
                    isProjectsPage
                      ? '搜索项目编号/名称/研究者'
                      : isSubjectsPage
                      ? '搜索筛选编号/姓名缩写'
                      : '搜索患者编号/姓名缩写'
                  }
                  className="pl-9 w-64 bg-slate-50 border-slate-200"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            )}
            {isPatientsPage && (
              <Button className="bg-sky-500 hover:bg-sky-600 text-white" onClick={handleRegisterSubject}>
                <UserPlus className="w-4 h-4 mr-1" /> 登记患者
              </Button>
            )}
            <Select value={selectedProjectNo} onValueChange={setSelectedProjectNo}>
              <SelectTrigger className="w-44 bg-slate-50 border-slate-200">
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
            {currentUser?.name?.slice(0, 1) ?? '录'}
          </div>
          <div className="text-xs">
            <div className="font-medium text-slate-700">{currentUser?.name ?? '录入员'}</div>
            <div className="text-slate-400">数据录入人员</div>
          </div>
          <Button
            variant="ghost" size="icon"
            className="text-slate-400 hover:text-teal-600"
            title="修改登录账号/密码"
            onClick={() => navigate('/change-password')}
          >
            <KeyRound className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost" size="icon"
            className="text-slate-400 hover:text-red-500"
            title="退出登录"
            onClick={() => {
              const raw = localStorage.getItem('clini_x_rdms_data')
              const data = raw ? JSON.parse(raw) : {}
              delete data.currentUser
              localStorage.setItem('clini_x_rdms_data', JSON.stringify(data))
              navigate('/login')
            }}
          >
            <LogOut className="w-4 h-4" />
          </Button>
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
