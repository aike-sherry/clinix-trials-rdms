import { useNavigate, useSearchParams } from 'react-router'
import { useAppStorage } from '@/hooks/useAppStorage'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  FlaskConical, CheckCircle2, Clock, CircleDashed,
  Building2, Users, ClipboardList, UserCheck,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  proposal_review: { label: '立项审核', color: 'bg-amber-100 text-amber-700' },
  contract_signed: { label: '合同签署', color: 'bg-purple-100 text-purple-700' },
  ethics_review: { label: '伦理审核', color: 'bg-green-100 text-green-700' },
  study_started: { label: '研究启动', color: 'bg-cyan-100 text-cyan-700' },
  study_closed: { label: '研究关闭', color: 'bg-gray-100 text-gray-700' },
  suspended: { label: '已暂停', color: 'bg-red-100 text-red-700' },
  pending: { label: '立项', color: 'bg-amber-100 text-amber-700' },
  active: { label: '进行中', color: 'bg-teal-100 text-teal-700' },
  completed: { label: '已结束', color: 'bg-blue-100 text-blue-700' },
}

const FLOW_STEPS = [
  { key: 'proposal', label: '立项日期' },
  { key: 'ethics', label: '伦理审核' },
  { key: 'contract', label: '合同终稿' },
  { key: 'startup', label: '研究启动' },
  { key: 'close', label: '课题结题' },
]

function generateMonthlyData(project: { createdAt: string }) {
  const start = new Date(project.createdAt)
  const months: { month: string; 筛选: number; 入组: number }[] = []
  for (let i = 0; i < 8; i++) {
    const d = new Date(start.getFullYear(), start.getMonth() + i, 1)
    const label = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    months.push({
      month: label,
      筛选: Math.floor(Math.random() * 12) + 2,
      入组: Math.floor(Math.random() * 8) + 1,
    })
  }
  return months
}

function generateAllProjectsMonthlyData() {
  const now = new Date()
  const months: { month: string; 筛选: number; 入组: number }[] = []
  for (let i = 7; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const label = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    months.push({
      month: label,
      筛选: Math.floor(Math.random() * 15) + 5,
      入组: Math.floor(Math.random() * 10) + 3,
    })
  }
  return months
}

// ==================== 单个项目视图 ====================
function SingleProjectView({ project, patients }: { project: any; patients: any[] }) {
  const projectPatients = patients.filter((p) => p.projectId === project.id)
  const screeningCount = projectPatients.filter((p) => p.status === 'screening').length
  const enrolledCount = projectPatients.filter(
    (p) => p.status === 'enrolled' || p.status === 'treatment' || p.status === 'completed'
  ).length

  const statusInfo = STATUS_MAP[project.status] || STATUS_MAP.proposal_review
  const monthlyData = generateMonthlyData(project)

  const statusOrder = ['proposal_review', 'ethics_review', 'contract_signed', 'study_started', 'study_closed']
  const currentStepIndex = statusOrder.indexOf(project.status)

  const getStepState = (idx: number) => {
    if (idx < currentStepIndex) return 'done'
    if (idx === currentStepIndex) return 'active'
    return 'pending'
  }

  const getStepDate = (idx: number) => {
    if (idx === 0) return project.createdAt?.slice(0, 10) || '-'
    if (idx === 3) return project.startDate || '-'
    if (idx === 4) return project.endDate || '-'
    if (idx < currentStepIndex) {
      const base = new Date(project.createdAt)
      base.setMonth(base.getMonth() + idx)
      return base.toISOString().slice(0, 10)
    }
    return '未到'
  }

  return (
    <div className="space-y-4">
      {/* 顶部项目信息卡片 */}
      <Card className="bg-white">
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-teal-50 flex items-center justify-center">
                <FlaskConical className="w-4 h-4 text-teal-600" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 font-mono">{project.projectNo}</span>
                  <Badge className={`text-xs ${statusInfo.color}`}>{statusInfo.label}</Badge>
                </div>
                <h2 className="font-semibold text-slate-800 text-sm">{project.name}</h2>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-3 text-sm">
            <div className="text-center">
              <p className="text-xs text-slate-400">主要研究者</p>
              <p className="font-medium text-slate-700 text-sm">{project.principalInvestigator || '-'}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-slate-400">研究科室</p>
              <p className="font-medium text-slate-700 text-sm">{project.department || '-'}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-slate-400">申办方</p>
              <p className="font-medium text-slate-700 text-sm">{project.sponsor || '-'}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-slate-400">临床监查员</p>
              <p className="font-medium text-slate-700 text-sm">-</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 流程时间线 */}
      <Card className="bg-white">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            {FLOW_STEPS.map((step, idx) => {
              const state = getStepState(idx)
              const date = getStepDate(idx)
              const isLast = idx === FLOW_STEPS.length - 1

              return (
                <div key={step.key} className="flex items-center flex-1">
                  <div className="flex flex-col items-center flex-1">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold mb-1.5 ${
                        state === 'done'
                          ? 'bg-sky-500 text-white'
                          : state === 'active'
                          ? 'bg-sky-100 text-sky-600 border-2 border-sky-500'
                          : 'bg-slate-100 text-slate-400'
                      }`}
                    >
                      {state === 'done' ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : state === 'active' ? (
                        <Clock className="w-4 h-4" />
                      ) : (
                        <CircleDashed className="w-4 h-4" />
                      )}
                    </div>
                    <span
                      className={`text-xs font-medium ${
                        state === 'done' || state === 'active' ? 'text-slate-700' : 'text-slate-400'
                      }`}
                    >
                      {step.label}
                    </span>
                    <span className="text-[10px] text-slate-400 mt-0.5">{date}</span>
                  </div>
                  {!isLast && (
                    <div
                      className={`flex-1 h-0.5 mx-1.5 ${
                        state === 'done' ? 'bg-sky-500' : 'bg-slate-200'
                      }`}
                    />
                  )}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* 筛选/入组柱状图 */}
      <Card className="bg-white">
        <CardContent className="p-4">
          <h3 className="text-sm font-medium text-slate-700 mb-3 text-center">筛选/入组</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthlyData} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="筛选" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="入组" fill="#f97316" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* 底部信息卡片 */}
      <Card className="bg-white">
        <CardContent className="p-0">
          <div className="grid grid-cols-8 bg-sky-500 text-white text-xs font-medium">
            {['研究编号', '研究中心', '主要研究者', '研究状态', '开始日期', '结束日期', '筛选例数', '入组例数'].map(
              (h) => (
                <div key={h} className="py-2 px-2 text-center border-r border-sky-400 last:border-r-0">
                  {h}
                </div>
              )
            )}
          </div>
          <div className="grid grid-cols-8 text-xs text-slate-700">
            <div className="py-2.5 px-2 text-center border-r border-slate-100">{project.projectNo}</div>
            <div className="py-2.5 px-2 text-center border-r border-slate-100">{project.researchCenter || '-'}</div>
            <div className="py-2.5 px-2 text-center border-r border-slate-100">{project.principalInvestigator || '-'}</div>
            <div className="py-2.5 px-2 text-center border-r border-slate-100">
              <span className={`inline-block px-2 py-0.5 rounded text-[10px] ${statusInfo.color}`}>
                {statusInfo.label}
              </span>
            </div>
            <div className="py-2.5 px-2 text-center border-r border-slate-100">{project.startDate || '-'}</div>
            <div className="py-2.5 px-2 text-center border-r border-slate-100">{project.endDate || '-'}</div>
            <div className="py-2.5 px-2 text-center border-r border-slate-100 font-semibold text-blue-600">{screeningCount}</div>
            <div className="py-2.5 px-2 text-center font-semibold text-orange-500">{enrolledCount}</div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ==================== 全部研究视图 ====================
function AllProjectsView({ projects, patients }: { projects: any[]; patients: any[] }) {
  const monthlyData = generateAllProjectsMonthlyData()

  // 统计
  const totalProjects = projects.length
  const uniqueCenters = new Set(projects.map((p) => p.researchCenter).filter(Boolean)).size
  const totalScreening = patients.filter((p) => p.status === 'screening').length
  const totalEnrolled = patients.filter(
    (p) => p.status === 'enrolled' || p.status === 'treatment' || p.status === 'completed'
  ).length

  // 为每个项目计算筛选/入组数
  const projectStats = projects.map((p) => {
    const pp = patients.filter((pt) => pt.projectId === p.id)
    return {
      ...p,
      screening: pp.filter((pt) => pt.status === 'screening').length,
      enrolled: pp.filter((pt) => pt.status === 'enrolled' || pt.status === 'treatment' || pt.status === 'completed').length,
    }
  })

  return (
    <div className="space-y-4">
      {/* 顶部统计卡片 */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-sky-50 flex items-center justify-center">
              <ClipboardList className="w-5 h-5 text-sky-600" />
            </div>
            <div>
              <div className="text-sm text-slate-500">研究数量</div>
              <div className="text-xl font-bold text-slate-800">{totalProjects}个</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-teal-600" />
            </div>
            <div>
              <div className="text-sm text-slate-500">研究中心</div>
              <div className="text-xl font-bold text-slate-800">{uniqueCenters}个</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <div className="text-sm text-slate-500">累计筛选</div>
              <div className="text-xl font-bold text-slate-800">{totalScreening}个</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center">
              <UserCheck className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <div className="text-sm text-slate-500">累计入组</div>
              <div className="text-xl font-bold text-slate-800">{totalEnrolled}个</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 筛选/入组柱状图 */}
      <Card className="bg-white">
        <CardContent className="p-4">
          <h3 className="text-sm font-medium text-slate-700 mb-3 text-center">筛选/入组</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={monthlyData} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="筛选" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="入组" fill="#f97316" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* 全部研究核心信息表格 */}
      <Card className="bg-white">
        <CardContent className="p-0">
          <div className="grid grid-cols-8 bg-sky-500 text-white text-xs font-medium">
            {['研究编号', '研究中心', '主要研究者', '研究状态', '开始日期', '结束日期', '筛选例数', '入组例数'].map(
              (h) => (
                <div key={h} className="py-2.5 px-2 text-center border-r border-sky-400 last:border-r-0">
                  {h}
                </div>
              )
            )}
          </div>
          {projectStats.map((p) => {
            const sInfo = STATUS_MAP[p.status] || STATUS_MAP.proposal_review
            return (
              <div key={p.id} className="grid grid-cols-8 text-xs text-slate-700 border-b border-slate-100 last:border-b-0">
                <div className="py-3 px-2 text-center border-r border-slate-100">{p.projectNo}</div>
                <div className="py-3 px-2 text-center border-r border-slate-100">{p.researchCenter || '-'}</div>
                <div className="py-3 px-2 text-center border-r border-slate-100">{p.principalInvestigator || '-'}</div>
                <div className="py-3 px-2 text-center border-r border-slate-100">
                  <span className={`inline-block px-2 py-0.5 rounded text-[10px] ${sInfo.color}`}>
                    {sInfo.label}
                  </span>
                </div>
                <div className="py-3 px-2 text-center border-r border-slate-100">{p.startDate || '-'}</div>
                <div className="py-3 px-2 text-center border-r border-slate-100">{p.endDate || '-'}</div>
                <div className="py-3 px-2 text-center border-r border-slate-100 font-semibold text-blue-600">{p.screening}</div>
                <div className="py-3 px-2 text-center font-semibold text-orange-500">{p.enrolled}</div>
              </div>
            )
          })}
        </CardContent>
      </Card>
    </div>
  )
}

// ==================== 主页面 ====================
export default function ManagerProgress() {
  const { projects, patients } = useAppStorage()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const selectedProjectNo = searchParams.get('projectNo') || 'all'

  if (projects.length === 0) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-500">暂无项目，请先创建项目</p>
        <Button
          className="mt-4 bg-sky-500 hover:bg-sky-600"
          onClick={() => navigate('/manager/projects?create=1')}
        >
          创建项目
        </Button>
      </div>
    )
  }

  // 全部研究
  if (selectedProjectNo === 'all') {
    return <AllProjectsView projects={projects} patients={patients} />
  }

  // 单个项目
  const project = projects.find((p) => p.projectNo === selectedProjectNo)
  if (!project) {
    return <div className="text-center py-20 text-slate-500">项目不存在</div>
  }

  return <SingleProjectView project={project} patients={patients} />
}
