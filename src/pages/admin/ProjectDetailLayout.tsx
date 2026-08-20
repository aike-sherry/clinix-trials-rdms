import { useParams, Link, Outlet, useLocation } from 'react-router'
import { useAppStorage } from '@/hooks/useAppStorage'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { FileText, FlaskConical, Package, UserCircle, ArrowLeft } from 'lucide-react'

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  proposal_review: { label: '立项审核', color: 'bg-amber-50 text-amber-600 border-amber-200' },
  pending: { label: '立项审核', color: 'bg-amber-50 text-amber-600 border-amber-200' },
  contract_signed: { label: '合同签署', color: 'bg-purple-50 text-purple-600 border-purple-200' },
  ethics_review: { label: '伦理审核', color: 'bg-green-50 text-green-600 border-green-200' },
  study_started: { label: '研究启动', color: 'bg-cyan-50 text-cyan-600 border-cyan-200' },
  active: { label: '研究启动', color: 'bg-cyan-50 text-cyan-600 border-cyan-200' },
  study_closed: { label: '研究关闭', color: 'bg-gray-50 text-gray-600 border-gray-200' },
  completed: { label: '研究关闭', color: 'bg-gray-50 text-gray-600 border-gray-200' },
  suspended: { label: '已暂停', color: 'bg-red-50 text-red-600 border-red-200' },
}

const tabs = [
  { path: 'overview', label: '项目概况', icon: FileText },
  { path: 'modules', label: '模块管理', icon: Package },
  { path: 'crf', label: 'CRF配置', icon: FlaskConical },
  { path: 'account', label: '账号管理', icon: UserCircle },
]

export default function ProjectDetailLayout() {
  const { projectId } = useParams<{ projectId: string }>()
  const { projects, patients } = useAppStorage()
  const location = useLocation()

  const project = projects.find((p) => p.id === projectId)
  if (!project) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-500">项目不存在或已被删除</p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/admin/projects">返回项目列表</Link>
        </Button>
      </div>
    )
  }

  const projectPatients = patients.filter((p) => p.projectId === project.id)
  const statusInfo = STATUS_MAP[project.status] || STATUS_MAP.proposal_review

  const activeTab = tabs.find((t) => location.pathname.includes(`/admin/projects/${projectId}/${t.path}`))?.path || 'overview'

  return (
    <div className="space-y-4">
      {/* 返回 + 项目头部 */}
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2 text-slate-500">
          <Link to="/admin/projects">
            <ArrowLeft className="w-4 h-4 mr-1" /> 返回项目列表
          </Link>
        </Button>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-base font-bold text-slate-800">{project.name}</h1>
            <Badge variant="outline" className={statusInfo.color}>
              {statusInfo.label}
            </Badge>
          </div>
          <div className="text-sm text-slate-500">
            筛选 {projectPatients.length} 例 · 入组 {projectPatients.filter((p) => p.status !== 'screening').length} 例
          </div>
        </div>
        <p className="text-sm text-slate-400 mt-1">
          {project.projectNo} · {project.researchCenter} · PI: {project.principalInvestigator}
        </p>
      </div>

      {/* 子导航 */}
      <div className="flex items-center gap-1 border-b border-slate-200">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.path
          return (
            <Link
              key={tab.path}
              to={`/admin/projects/${projectId}/${tab.path}`}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm border-b-2 transition-colors ${
                isActive
                  ? 'border-sky-500 text-sky-600 font-medium'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </Link>
          )
        })}
      </div>

      {/* 子页面内容 */}
      <Outlet />
    </div>
  )
}
