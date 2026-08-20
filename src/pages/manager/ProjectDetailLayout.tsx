import { useEffect } from 'react'
import { useParams, Link, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router'
import { useAppStorage } from '@/hooks/useAppStorage'
import type { ModuleKey } from '@/types'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  FileText, BarChart3, Users, Database, PieChart, UserCircle,
  List, CalendarCheck, ClipboardCheck, MessageCircleQuestion,
} from 'lucide-react'

// 项目标签：与管理端导航栏同步；标签内容直接嵌入对应模块页面（按当前项目过滤，不跳转）
const tabs: { path: string; label: string; icon: typeof FileText; moduleKey?: ModuleKey }[] = [
  { path: 'overview', label: '项目概况', icon: FileText },
  { path: 'progress', label: '进度管理', icon: BarChart3 },
  { path: 'patients', label: '患者管理', icon: Users, moduleKey: 'patients' },
  { path: 'visits', label: '访视管理', icon: CalendarCheck, moduleKey: 'visits' },
  { path: 'statistics', label: '数据管理', icon: Database, moduleKey: 'dataMgmt' },
  { path: 'review', label: '数据审核', icon: ClipboardCheck, moduleKey: 'dataMgmt' },
  { path: 'queries', label: '疑问管理', icon: MessageCircleQuestion, moduleKey: 'queries' },
  { path: 'data', label: '统计分析', icon: PieChart, moduleKey: 'statistics' },
  { path: 'account', label: '账户管理', icon: UserCircle },
]

export default function ProjectDetailLayout() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const { projects, currentUser } = useAppStorage()
  const project = projects.find((p) => p.id === projectId)

  // 保证 URL 始终携带当前项目的 projectNo：嵌入的模块页面据此按项目过滤
  useEffect(() => {
    if (project && searchParams.get('projectNo') !== project.projectNo) {
      const next = new URLSearchParams(searchParams)
      next.set('projectNo', project.projectNo)
      setSearchParams(next, { replace: true })
    }
  }, [project, searchParams, setSearchParams])

  // 模块权限过滤（undefined = 全部开通）
  const visibleTabs = tabs.filter(
    (t) => !t.moduleKey || !currentUser?.moduleAccess || currentUser.moduleAccess.includes(t.moduleKey)
  )

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

  const activeTab =
    tabs.find((t) => location.pathname.includes(`/manager/projects/${projectId}/${t.path}`))?.path || 'overview'

  // 项目切换：保持当前标签，URL 同步新项目的 projectNo
  const handleProjectChange = (value: string) => {
    if (value === 'all') {
      navigate('/manager/projects')
    } else {
      const target = projects.find((p) => p.id === value)
      navigate(`/manager/projects/${value}/${activeTab}?projectNo=${target?.projectNo ?? ''}`)
    }
  }

  return (
    <div className="space-y-4">
      {/* 子导航标签 + 项目切换器（右置） */}
      <div className="flex items-end justify-between border-b border-slate-200">
        <div className="flex items-center gap-1">
          {visibleTabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.path
            return (
              <Link
                key={tab.path}
                to={`/manager/projects/${projectId}/${tab.path}?projectNo=${project.projectNo}`}
                className={`flex items-center gap-1.5 px-3 py-2.5 text-[13px] whitespace-nowrap border-b-2 transition-colors ${
                  isActive
                    ? 'border-blue-500 text-blue-600 font-medium'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </Link>
            )
          })}
        </div>

        {/* 项目切换下拉框 */}
        <div className="flex items-center gap-2 pb-1.5">
          <span className="text-xs text-slate-400 whitespace-nowrap">当前项目</span>
          <Select value={projectId} onValueChange={handleProjectChange}>
            <SelectTrigger className="w-72 h-8 text-xs">
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

      <Outlet />
    </div>
  )
}
