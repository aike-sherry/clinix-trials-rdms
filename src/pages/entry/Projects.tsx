import { useState, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useAppStorage } from '@/hooks/useAppStorage'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import CreateProjectDialog from '@/components/CreateProjectDialog'
import StatCard from '@/components/StatCard'
import {
  LayoutGrid, LayoutList, FlaskConical, ClipboardCheck,
  FileSignature, ShieldCheck, Rocket, Archive, ClipboardList, UserPlus,
  BarChart3, Users, CalendarCheck, Database, MessageCircleQuestion, Plus,
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

export default function EntryProjects() {
  const { projects, patients } = useAppStorage()
  const [searchParams] = useSearchParams()

  // 筛选条件来自顶部 Header（与管理端一致）
  const search = searchParams.get('search') || ''
  const selectedProjectNo = searchParams.get('projectNo') || 'all'
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [showCreate, setShowCreate] = useState(false)

  // 录入人员可见全部研究
  const filtered = useMemo(
    () =>
      projects.filter((p) => {
        const matchSearch =
          !search ||
          p.name.includes(search) ||
          p.projectNo.includes(search) ||
          p.principalInvestigator.includes(search)
        const matchProjectNo = selectedProjectNo === 'all' || p.projectNo === selectedProjectNo
        return matchSearch && matchProjectNo
      }),
    [projects, search, selectedProjectNo],
  )

  // 顶部统计
  const totalCount = projects.length
  const proposalCount = projects.filter((p) => p.status === 'proposal_review' || p.status === 'pending').length
  const contractCount = projects.filter((p) => p.status === 'contract_signed').length
  const ethicsCount = projects.filter((p) => p.status === 'ethics_review').length
  const startedCount = projects.filter((p) => p.status === 'study_started' || p.status === 'active').length
  const closedCount = projects.filter((p) => p.status === 'study_closed' || p.status === 'completed').length

  const statCards = [
    { label: '研究总数', value: totalCount, unit: '项', sub: `启动 ${startedCount} 项`, icon: LayoutGrid, gradient: 'from-blue-500 to-blue-600' },
    { label: '立项审核', value: proposalCount, unit: '项', sub: '待立项审批', icon: ClipboardCheck, gradient: 'from-amber-500 to-orange-500' },
    { label: '合同签署', value: contractCount, unit: '项', sub: '合同已签署', icon: FileSignature, gradient: 'from-purple-500 to-violet-600' },
    { label: '伦理审核', value: ethicsCount, unit: '项', sub: '伦理审查中', icon: ShieldCheck, gradient: 'from-emerald-500 to-green-600' },
    { label: '研究启动', value: startedCount, unit: '项', sub: '正在入组实施', icon: Rocket, gradient: 'from-cyan-500 to-sky-600' },
    { label: '研究关闭', value: closedCount, unit: '项', sub: '已完成关闭', icon: Archive, gradient: 'from-slate-500 to-slate-600' },
  ]

  return (
    <div className="space-y-5">
      {/* 顶部统计卡片（全站统一 StatCard） */}
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-4">
        {statCards.map((s) => (
          <StatCard
            key={s.label}
            label={s.label}
            value={s.value}
            unit={s.unit}
            sub={s.sub}
            icon={s.icon}
            gradient={s.gradient}
          />
        ))}
      </div>

      {/* 项目列表 */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-lg border border-dashed border-slate-300">
          <FlaskConical className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">没有符合条件的研究</p>
          <Button
            className="mt-4 bg-teal-500 hover:bg-teal-600"
            onClick={() => setShowCreate(true)}
          >
            <Plus className="w-4 h-4 mr-1" /> 创建项目
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-400">共 {filtered.length} 个研究</p>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                className="h-8 bg-teal-500 hover:bg-teal-600 text-xs"
                onClick={() => setShowCreate(true)}
              >
                <Plus className="w-3.5 h-3.5 mr-1" /> 创建项目
              </Button>
              <div className="flex items-center border rounded-md overflow-hidden bg-white">
                <Button
                  variant="ghost"
                  size="icon"
                  className={`h-8 w-8 rounded-none ${viewMode === 'grid' ? 'bg-amber-50 text-amber-600' : 'text-slate-400'}`}
                  onClick={() => setViewMode('grid')}
                >
                  <LayoutGrid className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className={`h-8 w-8 rounded-none ${viewMode === 'list' ? 'bg-amber-50 text-amber-600' : 'text-slate-400'}`}
                  onClick={() => setViewMode('list')}
                >
                  <LayoutList className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

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
                          <span className="text-xs text-slate-400 font-mono">{project.projectNo}</span>
                          <h3 className="font-semibold text-slate-800 truncate text-sm">{project.name}</h3>
                        </div>
                      </div>
                      <Badge variant="outline" className={`${statusInfo.bgColor} ${statusInfo.textColor} ${statusInfo.color} text-xs flex-shrink-0`}>
                        {statusInfo.label}
                      </Badge>
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
                        <p className="text-xs text-slate-400">研究中心</p>
                        <p className="font-medium text-slate-700 truncate">{project.researchCenter || '-'}</p>
                      </div>
                    </div>

                    {/* 入组进度 */}
                    <div className="mb-4">
                      <div className="flex items-center justify-between text-sm mb-1.5">
                        <span className="text-slate-500">入组进度 <span className="font-medium text-slate-700">{enrolled}/{target} 例</span></span>
                        <span className="text-blue-500 font-medium">{progressPct}%</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-400 rounded-full transition-all" style={{ width: `${progressPct}%` }} />
                      </div>
                    </div>

                    {/* 操作标签：与导航栏同步（项目概况 / 受试者登记 / 患者管理 / 访视管理 / 数据录入 / 数据管理 / 疑问管理 / 我的工作台） */}
                    <div className="flex items-center gap-1 pt-3 border-t border-slate-100 flex-wrap">
                      <Button size="sm" variant="ghost" className="text-slate-500 hover:text-sky-600 h-8 px-2 text-xs" asChild>
                        <Link to={`/entry/projects/${project.id}/overview`}>
                          <BarChart3 className="w-3.5 h-3.5 mr-1" /> 项目概况
                        </Link>
                      </Button>
                      <Button size="sm" variant="ghost" className="text-slate-500 hover:text-sky-600 h-8 px-2 text-xs" asChild>
                        <Link to={`/entry/subjects?projectNo=${project.projectNo}`}>
                          <UserPlus className="w-3.5 h-3.5 mr-1" /> 受试者登记
                        </Link>
                      </Button>
                      <Button size="sm" variant="ghost" className="text-slate-500 hover:text-sky-600 h-8 px-2 text-xs" asChild>
                        <Link to={`/entry/patients?projectNo=${project.projectNo}`}>
                          <Users className="w-3.5 h-3.5 mr-1" /> 患者管理
                        </Link>
                      </Button>
                      <Button size="sm" variant="ghost" className="text-slate-500 hover:text-sky-600 h-8 px-2 text-xs" asChild>
                        <Link to={`/entry/visits?projectNo=${project.projectNo}`}>
                          <CalendarCheck className="w-3.5 h-3.5 mr-1" /> 访视管理
                        </Link>
                      </Button>
                      {project.crfPublished ? (
                        <Button size="sm" variant="ghost" className="text-slate-500 hover:text-sky-600 h-8 px-2 text-xs" asChild>
                          <Link to={`/entry/data-entry?project=${project.id}`}>
                            <ClipboardList className="w-3.5 h-3.5 mr-1" /> 数据录入
                          </Link>
                        </Button>
                      ) : (
                        <Button size="sm" className="h-8 text-xs" disabled title="CRF 发布后开放录入">
                          <ClipboardList className="w-3.5 h-3.5 mr-1" /> CRF 未发布
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" className="text-slate-500 hover:text-sky-600 h-8 px-2 text-xs" asChild>
                        <Link to={`/entry/data-mgmt?projectNo=${project.projectNo}`}>
                          <FileSignature className="w-3.5 h-3.5 mr-1" /> 数据管理
                        </Link>
                      </Button>
                      <Button size="sm" variant="ghost" className="text-slate-500 hover:text-sky-600 h-8 px-2 text-xs" asChild>
                        <Link to={`/entry/queries?projectNo=${project.projectNo}`}>
                          <MessageCircleQuestion className="w-3.5 h-3.5 mr-1" /> 疑问管理
                        </Link>
                      </Button>
                      <Button size="sm" variant="ghost" className="text-slate-500 hover:text-sky-600 h-8 px-2 text-xs" asChild>
                        <Link to={`/entry/my-data?projectNo=${project.projectNo}`}>
                          <Database className="w-3.5 h-3.5 mr-1" /> 我的工作台
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {/* 创建项目弹窗（共用组件，与管理端一致；创建后管理端同步可见） */}
      <CreateProjectDialog open={showCreate} onOpenChange={setShowCreate} />
    </div>
  )
}
