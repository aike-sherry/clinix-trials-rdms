import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useAppStorage } from '@/hooks/useAppStorage'
import type { ModuleKey } from '@/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import CreateProjectDialog from '@/components/CreateProjectDialog'
import StatCard from '@/components/StatCard'
import {
  FileText, Users, Database, PieChart,
  Trash2, LayoutGrid, ClipboardCheck, FileSignature, ShieldCheck,
  Rocket, Archive, FlaskConical, Activity, UserCircle,
  LayoutList, CalendarCheck, MessageCircleQuestion, Plus
} from 'lucide-react'

const STATUS_MAP: Record<string, { label: string; color: string; textColor: string; bgColor: string }> = {
  proposal_review: { label: '立项审核', color: 'border-amber-200', textColor: 'text-amber-600', bgColor: 'bg-amber-50' },
  pending: { label: '立项审核', color: 'border-amber-200', textColor: 'text-amber-600', bgColor: 'bg-amber-50' },
  contract_signed: { label: '合同签署', color: 'border-purple-200', textColor: 'text-purple-600', bgColor: 'bg-purple-50' },
  ethics_review: { label: '伦理审核', color: 'border-green-200', textColor: 'text-green-600', bgColor: 'bg-green-50' },
  study_started: { label: '研究启动', color: 'border-cyan-200', textColor: 'text-cyan-600', bgColor: 'bg-cyan-50' },
  active: { label: '研究启动', color: 'border-cyan-200', textColor: 'text-cyan-600', bgColor: 'bg-cyan-50' },
  study_closed: { label: '研究关闭', color: 'border-gray-200', textColor: 'text-gray-600', bgColor: 'bg-gray-50' },
  completed: { label: '研究关闭', color: 'border-gray-200', textColor: 'text-gray-600', bgColor: 'bg-gray-50' },
  suspended: { label: '已暂停', color: 'border-red-200', textColor: 'text-red-600', bgColor: 'bg-red-50' },
}

// 项目卡片标签：与管理端导航栏同步（absolute = 跳转全局页面并带上项目筛选）
const TAB_ITEMS: { path: string; label: string; icon: typeof FileText; moduleKey?: ModuleKey; absolute?: boolean }[] = [
  { path: 'overview', label: '项目概况', icon: FileText },
  { path: '/manager/progress', label: '进度管理', icon: Activity, absolute: true },
  { path: '/manager/patients', label: '患者管理', icon: Users, moduleKey: 'patients', absolute: true },
  { path: '/manager/visits', label: '访视管理', icon: CalendarCheck, moduleKey: 'visits', absolute: true },
  { path: '/manager/statistics', label: '数据管理', icon: Database, moduleKey: 'dataMgmt', absolute: true },
  { path: '/manager/review', label: '数据审核', icon: ClipboardCheck, moduleKey: 'dataMgmt', absolute: true },
  { path: '/manager/queries', label: '疑问管理', icon: MessageCircleQuestion, moduleKey: 'queries', absolute: true },
  { path: '/manager/data', label: '统计分析', icon: PieChart, moduleKey: 'statistics', absolute: true },
  { path: '/manager/account', label: '账户管理', icon: UserCircle, absolute: true },
]

export default function ProjectList() {
  const { projects, patients, deleteProject, currentUser } = useAppStorage()
  // 模块权限过滤（undefined = 全部开通）
  const allowedTabs = TAB_ITEMS.filter(
    (t) => !t.moduleKey || !currentUser?.moduleAccess || currentUser.moduleAccess.includes(t.moduleKey)
  )
  const [searchParams, setSearchParams] = useSearchParams()

  // 从 URL 读取搜索和筛选状态（由 ManagerLayout 顶部栏控制）
  const search = searchParams.get('search') || ''
  const selectedProjectNo = searchParams.get('projectNo') || 'all'

  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [showCreate, setShowCreate] = useState(false)

  useEffect(() => {
    if (searchParams.get('create') === '1') {
      setShowCreate(true)
    }
  }, [searchParams])

  const clearCreateParam = () => {
    const newParams = new URLSearchParams(searchParams)
    newParams.delete('create')
    setSearchParams(newParams)
  }

  // 筛选逻辑：搜索词 + 项目编号
  const filtered = projects.filter(
    (p) => {
      const matchSearch =
        !search ||
        p.name.includes(search) ||
        p.projectNo.includes(search) ||
        p.principalInvestigator.includes(search)
      const matchProjectNo = selectedProjectNo === 'all' || p.projectNo === selectedProjectNo
      return matchSearch && matchProjectNo
    }
  )

  // 顶部统计数据
  const totalCount = projects.length
  const proposalCount = projects.filter(
    (p) => p.status === 'proposal_review' || p.status === 'pending'
  ).length
  const contractCount = projects.filter((p) => p.status === 'contract_signed').length
  const ethicsCount = projects.filter((p) => p.status === 'ethics_review').length
  const startedCount = projects.filter(
    (p) => p.status === 'study_started' || p.status === 'active'
  ).length
  const closedCount = projects.filter(
    (p) => p.status === 'study_closed' || p.status === 'completed'
  ).length

  return (
    <div className="space-y-5">
      {/* 顶部统计卡片（全站统一 StatCard） */}
      <div className="grid grid-cols-6 gap-4">
        <StatCard label="研究总数" value={totalCount} unit="项" sub={`启动 ${startedCount} 项`} icon={LayoutGrid} gradient="from-blue-500 to-blue-600" />
        <StatCard label="立项审核" value={proposalCount} unit="项" sub="待立项审批" icon={ClipboardCheck} gradient="from-amber-500 to-orange-500" />
        <StatCard label="合同签署" value={contractCount} unit="项" sub="合同已签署" icon={FileSignature} gradient="from-purple-500 to-violet-600" />
        <StatCard label="伦理审核" value={ethicsCount} unit="项" sub="伦理审查中" icon={ShieldCheck} gradient="from-emerald-500 to-green-600" />
        <StatCard label="研究启动" value={startedCount} unit="项" sub="正在入组实施" icon={Rocket} gradient="from-cyan-500 to-sky-600" />
        <StatCard label="研究关闭" value={closedCount} unit="项" sub="已完成关闭" icon={Archive} gradient="from-slate-500 to-slate-600" />
      </div>

      {/* 项目列表工具行：创建项目 + 视图切换（始终可见，空列表时也能创建） */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-400">共 {filtered.length} 个项目</p>
        <div className="flex items-center gap-3">
          {/* 创建项目 */}
          <Button
            className="bg-sky-500 hover:bg-sky-600 text-white h-8 text-sm"
            onClick={() => setShowCreate(true)}
          >
            <Plus className="w-4 h-4 mr-1" /> 创建项目
          </Button>
          {/* 视图切换 */}
          <div className="flex items-center border rounded-md overflow-hidden bg-white">
            <Button
              variant="ghost"
              size="icon"
              className={`h-8 w-8 rounded-none ${viewMode === 'grid' ? 'bg-blue-50 text-blue-600' : 'text-slate-400'}`}
              onClick={() => setViewMode('grid')}
            >
              <LayoutGrid className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={`h-8 w-8 rounded-none ${viewMode === 'list' ? 'bg-blue-50 text-blue-600' : 'text-slate-400'}`}
              onClick={() => setViewMode('list')}
            >
              <LayoutList className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-lg border border-dashed border-slate-300">
          <FlaskConical className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">暂无项目，点击右上角"创建项目"按钮创建</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className={viewMode === 'grid' ? 'grid grid-cols-2 gap-4' : 'space-y-4'}>
            {filtered.map((project) => {
              const projectPatients = patients.filter((p) => p.projectId === project.id)
              const enrolled = projectPatients.filter((p) => p.status !== 'screening').length
              const target = project.targetEnrollment || 100
              const progressPct = target > 0 ? Math.round((enrolled / target) * 100) : 0
              const statusInfo = STATUS_MAP[project.status] || STATUS_MAP.proposal_review

              return (
                <Card key={project.id} className="hover:shadow-md transition-shadow bg-white">
                  <CardContent className="p-5">
                    {/* 项目头部 */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center flex-shrink-0">
                          <FlaskConical className="w-5 h-5 text-teal-600" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-400 font-mono">{project.projectNo}</span>
                          </div>
                          <h3 className="font-semibold text-slate-800 truncate text-sm">{project.name}</h3>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Badge variant="outline" className={`${statusInfo.bgColor} ${statusInfo.textColor} ${statusInfo.color} text-xs`}>
                          {statusInfo.label}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="w-7 h-7 text-slate-300 hover:text-red-500"
                          onClick={() => deleteProject(project.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>

                    {/* 统计信息 */}
                    <div className="grid grid-cols-4 gap-3 mb-4 text-sm">
                      <div className="text-center">
                        <p className="text-xs text-slate-400">主要研究者</p>
                        <p className="font-medium text-slate-700 truncate">{project.principalInvestigator || '-'}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-slate-400">研究科室</p>
                        <p className="font-medium text-slate-700 truncate">{project.department || '-'}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-slate-400">申办方</p>
                        <p className="font-medium text-slate-700 truncate">{project.sponsor || '-'}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-slate-400">临床监查员</p>
                        <p className="font-medium text-slate-700 truncate">{'-'}</p>
                      </div>
                    </div>

                    {/* 入组进度 */}
                    <div className="mb-4">
                      <div className="flex items-center justify-between text-sm mb-1.5">
                        <span className="text-slate-500">入组进度 <span className="font-medium text-slate-700">{enrolled}/{target} 例</span></span>
                        <span className="text-blue-500 font-medium">{progressPct}%</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-400 rounded-full transition-all"
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                    </div>

                    {/* 子导航 - 横向排列 */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-3 border-t border-slate-100">
                      {allowedTabs.map((tab) => {
                        const Icon = tab.icon
                        return (
                          <Button
                            key={tab.path}
                            variant="ghost"
                            size="sm"
                            asChild
                            className="text-slate-500 hover:text-teal-600 h-7 px-1 text-xs"
                          >
                            <Link to={tab.absolute ? `${tab.path}?projectNo=${project.projectNo}` : `/manager/projects/${project.id}/${tab.path}`}>
                              <Icon className="w-3.5 h-3.5 mr-1" /> {tab.label}
                            </Link>
                          </Button>
                        )
                      })}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {/* 创建项目弹窗（共用组件，与录入端一致） */}
      <CreateProjectDialog
        open={showCreate}
        onOpenChange={(open) => {
          setShowCreate(open)
          if (!open) clearCreateParam()
        }}
        onCreated={clearCreateParam}
      />
    </div>
  )
}
