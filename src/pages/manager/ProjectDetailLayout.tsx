import { useParams, Link, Outlet, useLocation, useNavigate } from 'react-router'
import { useAppStorage } from '@/hooks/useAppStorage'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  FileText, BarChart3, Users, Database, PieChart, UserCircle,
  List
} from 'lucide-react'

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
  { path: 'progress', label: '进度管理', icon: BarChart3 },
  { path: 'patients', label: '患者管理', icon: Users },
  { path: 'data', label: '数据管理', icon: Database },
  { path: 'stats', label: '统计分析', icon: PieChart },
  { path: 'account', label: '账户管理', icon: UserCircle },
]

export default function ProjectDetailLayout() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const { projects, patients } = useAppStorage()
  const location = useLocation()

  const project = projects.find((p) => p.id === projectId)
  if (!project) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-500">项目不存在或已被删除</p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/manager/projects">返回项目列表</Link>
        </Button>
      </div>
    )
  }

  const projectPatients = patients.filter((p) => p.projectId === project.id)
  const statusInfo = STATUS_MAP[project.status] || STATUS_MAP.proposal_review

  const activeTab = tabs.find((t) => location.pathname.includes(`/manager/projects/${projectId}/${t.path}`))?.path || 'overview'

  // 项目切换
  const handleProjectChange = (value: string) => {
    if (value === 'all') {
      navigate('/manager/projects')
    } else {
      // 保持当前 tab，切换到新项目
      const currentTab = activeTab
      navigate(`/manager/projects/${value}/${currentTab}`)
    }
  }

  return (
    <div className="space-y-4">
      {/* 顶部：项目信息 + 项目切换器 */}
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-xl font-bold text-slate-800">{project.name}</h1>
            <Badge variant="outline" className={statusInfo.color}>
              {statusInfo.label}
            </Badge>
          </div>
          <p className="text-sm text-slate-400">
            {project.projectNo} · {project.researchCenter} · PI: {project.principalInvestigator}
          </p>
        </div>

        {/* 项目切换下拉框 */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-400">当前项目:</span>
          <Select value={projectId} onValueChange={handleProjectChange}>
            <SelectTrigger className="w-72">
              <SelectValue placeholder="选择项目" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                <div className="flex items-center gap-2">
                  <List className="w-3.5 h-3.5 text-slate-400" />
                  <span>全部项目</span>
                </div>
              </SelectItem>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 font-mono">{p.projectNo}</span>
                    <span className="truncate max-w-[200px]">{p.name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* 快捷统计 */}
      <div className="flex items-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-slate-400">主要研究者</span>
          <span className="font-medium text-slate-700">{project.principalInvestigator || '-'}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-slate-400">研究科室</span>
          <span className="font-medium text-slate-700">{project.department || '-'}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-slate-400">申办方</span>
          <span className="font-medium text-slate-700">{project.sponsor || '-'}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-slate-400">筛选例数</span>
          <span className="font-medium text-slate-700">{projectPatients.length}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-slate-400">入组例数</span>
          <span className="font-medium text-slate-700">
            {projectPatients.filter((p) => p.status !== 'screening').length}
          </span>
        </div>
      </div>

      {/* 子导航标签 */}
      <div className="flex items-center gap-1 border-b border-slate-200">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.path
          return (
            <Link
              key={tab.path}
              to={`/manager/projects/${projectId}/${tab.path}`}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm border-b-2 transition-colors ${
                isActive
                  ? 'border-blue-500 text-blue-600 font-medium'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </Link>
          )
        })}
      </div>

      <Outlet />
    </div>
  )
}
