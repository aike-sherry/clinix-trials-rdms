import { useParams, Link, Outlet, useLocation } from 'react-router'
import { useAppStorage } from '@/hooks/useAppStorage'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { FileText, FlaskConical, Users, Database, BarChart3, ArrowLeft } from 'lucide-react'

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending: { label: '立项', color: 'bg-amber-50 text-amber-600 border-amber-200' },
  active: { label: '进行中', color: 'bg-teal-50 text-teal-600 border-teal-200' },
  completed: { label: '已完成', color: 'bg-blue-50 text-blue-600 border-blue-200' },
  suspended: { label: '已暂停', color: 'bg-red-50 text-red-600 border-red-200' },
}

const tabs = [
  { path: 'overview', label: '项目概况', icon: FileText },
  { path: 'crf', label: 'CRF配制', icon: FlaskConical },
  { path: 'patients', label: '患者管理', icon: Users },
  { path: 'data', label: '数据管理', icon: Database },
  { path: 'stats', label: '统计分析', icon: BarChart3 },
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
          <Link to="/projects">返回项目列表</Link>
        </Button>
      </div>
    )
  }

  const projectPatients = patients.filter((p) => p.projectId === project.id)
  const statusInfo = STATUS_MAP[project.status] || STATUS_MAP.pending

  const activeTab = tabs.find((t) => location.pathname.includes(`/projects/${projectId}/${t.path}`))?.path || 'overview'

  return (
    <div className="space-y-4">
      {/* 返回 + 项目头部 */}
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2 text-slate-500">
          <Link to="/projects">
            <ArrowLeft className="w-4 h-4 mr-1" /> 返回项目列表
          </Link>
        </Button>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-slate-800">{project.name}</h1>
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
              to={`/projects/${projectId}/${tab.path}`}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm border-b-2 transition-colors ${
                isActive
                  ? 'border-teal-500 text-teal-600 font-medium'
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
