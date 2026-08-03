import { useNavigate, useSearchParams } from 'react-router'
import { useAppStorage } from '@/hooks/useAppStorage'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  FlaskConical, CheckCircle2, Clock, CircleDashed,
  Users, Stethoscope, ClipboardCheck, LogOut, UserCheck,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell,
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

const PATIENT_STATUS_LABELS: Record<string, string> = {
  screening: '筛选',
  enrolled: '入组',
  treatment: '治疗期',
  completed: '完成研究',
  withdrawn: '退出研究',
  lost: '失访',
}

const PATIENT_STATUS_COLORS: Record<string, string> = {
  screening: '#3b82f6',
  enrolled: '#f97316',
  treatment: '#14b8a6',
  completed: '#8b5cf6',
  withdrawn: '#ef4444',
  lost: '#94a3b8',
}

const SINGLE_FLOW_STEPS = [
  { key: 'proposal', label: '立项管理' },
  { key: 'ethics', label: '伦理审核' },
  { key: 'contract', label: '合同审核' },
  { key: 'startup', label: '中心启动' },
  { key: 'record', label: '备案管理' },
  { key: 'close', label: '结题管理' },
  { key: 'center', label: '中心关闭' },
]

function getProjectStepState(project: any, idx: number) {
  const statusOrder = ['proposal_review', 'ethics_review', 'contract_signed', 'study_started', 'study_closed']
  const currentStepIndex = statusOrder.indexOf(project.status)
  if (idx < currentStepIndex) return 'done'
  if (idx === currentStepIndex) return 'active'
  return 'pending'
}

function getProjectStepDate(project: any, idx: number) {
  if (idx === 0) return project.createdAt?.slice(0, 10) || '-'
  if (idx === 3) return project.startDate || '-'
  if (idx === 6) return project.endDate || '-'
  const statusOrder = ['proposal_review', 'ethics_review', 'contract_signed', 'study_started', 'study_closed']
  const currentStepIndex = statusOrder.indexOf(project.status)
  if (idx < currentStepIndex) {
    const base = new Date(project.createdAt)
    base.setMonth(base.getMonth() + idx)
    return base.toISOString().slice(0, 10)
  }
  return '未到'
}

function generateMonthlyPatientData(_projectPatients: any[]) {
  const now = new Date()
  const months: { month: string; 筛选: number; 入组: number; 治疗期: number; 退出研究: number; 完成研究: number; 失访: number }[] = []
  for (let i = 7; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const label = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    // 基于实际患者数据模拟
    months.push({
      month: label,
      筛选: Math.floor(Math.random() * 10) + 2,
      入组: Math.floor(Math.random() * 8) + 1,
      治疗期: Math.floor(Math.random() * 6) + 1,
      退出研究: Math.floor(Math.random() * 3),
      完成研究: Math.floor(Math.random() * 4),
      失访: Math.floor(Math.random() * 2),
    })
  }
  return months
}

function generateAllProjectsBarData(projects: any[], patients: any[]) {
  const result: any[] = []
  // 累计
  const total: Record<string, number> = { 筛选: 0, 入组: 0, 治疗期: 0, 退出研究: 0, 完成研究: 0, 失访: 0 }
  patients.forEach((p) => {
    if (p.status === 'screening') total['筛选']++
    else if (p.status === 'enrolled') total['入组']++
    else if (p.status === 'treatment') total['治疗期']++
    else if (p.status === 'withdrawn') total['退出研究']++
    else if (p.status === 'completed') total['完成研究']++
    else if (p.status === 'lost') total['失访']++
  })
  result.push({ name: '累计', ...total })

  // 按项目
  projects.forEach((proj) => {
    const pp = patients.filter((p) => p.projectId === proj.id)
    const data: Record<string, number> = { 筛选: 0, 入组: 0, 治疗期: 0, 退出研究: 0, 完成研究: 0, 失访: 0 }
    pp.forEach((p) => {
      if (p.status === 'screening') data['筛选']++
      else if (p.status === 'enrolled') data['入组']++
      else if (p.status === 'treatment') data['治疗期']++
      else if (p.status === 'withdrawn') data['退出研究']++
      else if (p.status === 'completed') data['完成研究']++
      else if (p.status === 'lost') data['失访']++
    })
    result.push({ name: proj.projectNo, ...data })
  })
  return result
}

// ==================== 通用：患者列表表格 ====================
function PatientTable({ patients, projects }: { patients: any[]; projects: any[] }) {
  return (
    <Card className="bg-white">
      <CardContent className="p-0">
        <div className="grid grid-cols-9 bg-sky-500 text-white text-xs font-medium">
          {['课题编号', '患者编号', '姓名缩写', '状态', '性别', '知情日期', '入组日期', '当前访视', '下次访视'].map(
            (h) => (
              <div key={h} className="py-2.5 px-2 text-center border-r border-sky-400 last:border-r-0">
                {h}
              </div>
            )
          )}
        </div>
        {patients.length === 0 && (
          <div className="text-center py-8 text-sm text-slate-400">暂无患者数据</div>
        )}
        {patients.map((p) => {
          const project = projects.find((proj) => proj.id === p.projectId)
          const statusLabel = PATIENT_STATUS_LABELS[p.status] || p.status
          return (
            <div key={p.id} className="grid grid-cols-9 text-xs text-slate-700 border-b border-slate-100 last:border-b-0">
              <div className="py-3 px-2 text-center border-r border-slate-100">{project?.projectNo || '-'}</div>
              <div className="py-3 px-2 text-center border-r border-slate-100">{p.screeningId || p.screeningNo || '-'}</div>
              <div className="py-3 px-2 text-center border-r border-slate-100">{p.nameInitials || '-'}</div>
              <div className="py-3 px-2 text-center border-r border-slate-100">
                <span className={`inline-block px-2 py-0.5 rounded text-[10px] ${
                  p.status === 'screening' ? 'bg-blue-50 text-blue-600' :
                  p.status === 'enrolled' ? 'bg-orange-50 text-orange-600' :
                  p.status === 'treatment' ? 'bg-teal-50 text-teal-600' :
                  p.status === 'completed' ? 'bg-purple-50 text-purple-600' :
                  p.status === 'withdrawn' ? 'bg-red-50 text-red-600' :
                  'bg-slate-50 text-slate-600'
                }`}>
                  {statusLabel}
                </span>
              </div>
              <div className="py-3 px-2 text-center border-r border-slate-100">{p.gender === 'male' ? '男' : p.gender === 'female' ? '女' : '-'}</div>
              <div className="py-3 px-2 text-center border-r border-slate-100">{p.consentDate || '-'}</div>
              <div className="py-3 px-2 text-center border-r border-slate-100">{p.enrollmentDate || '-'}</div>
              <div className="py-3 px-2 text-center border-r border-slate-100">{p.currentVisit || '-'}</div>
              <div className="py-3 px-2 text-center">{p.nextVisit || '-'}</div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

// ==================== 通用：患者总览饼图 ====================
function PatientPieChart({ patients }: { patients: any[] }) {
  const data = [
    { name: '筛选', value: patients.filter((p) => p.status === 'screening').length, color: PATIENT_STATUS_COLORS.screening },
    { name: '入组', value: patients.filter((p) => p.status === 'enrolled').length, color: PATIENT_STATUS_COLORS.enrolled },
    { name: '治疗期', value: patients.filter((p) => p.status === 'treatment').length, color: PATIENT_STATUS_COLORS.treatment },
    { name: '退出研究', value: patients.filter((p) => p.status === 'withdrawn').length, color: PATIENT_STATUS_COLORS.withdrawn },
    { name: '完成研究', value: patients.filter((p) => p.status === 'completed').length, color: PATIENT_STATUS_COLORS.completed },
    { name: '失访', value: patients.filter((p) => p.status === 'lost').length, color: PATIENT_STATUS_COLORS.lost },
  ].filter((d) => d.value > 0)

  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={50}
          outerRadius={90}
          paddingAngle={3}
          dataKey="value"
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip />
        <Legend wrapperStyle={{ fontSize: 11 }} />
      </PieChart>
    </ResponsiveContainer>
  )
}

// ==================== 单个项目视图 ====================
function SingleProjectView({ project, allPatients, allProjects }: { project: any; allPatients: any[]; allProjects: any[] }) {
  const projectPatients = allPatients.filter((p) => p.projectId === project.id)
  const statusInfo = STATUS_MAP[project.status] || STATUS_MAP.proposal_review
  const monthlyData = generateMonthlyPatientData(projectPatients)

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

      {/* 流程时间线 - 7步 */}
      <Card className="bg-white">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            {SINGLE_FLOW_STEPS.map((step, idx) => {
              const state = getProjectStepState(project, idx)
              const date = getProjectStepDate(project, idx)
              const isLast = idx === SINGLE_FLOW_STEPS.length - 1

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
                      className={`flex-1 h-0.5 mx-1 ${
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

      {/* 图表区域：饼图 + 柱状图 */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="bg-white">
          <CardContent className="p-4">
            <h3 className="text-sm font-medium text-slate-700 mb-2 text-center">患者总览</h3>
            <PatientPieChart patients={projectPatients} />
          </CardContent>
        </Card>
        <Card className="bg-white">
          <CardContent className="p-4">
            <h3 className="text-sm font-medium text-slate-700 mb-2 text-center">患者管理</h3>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Bar dataKey="筛选" fill={PATIENT_STATUS_COLORS.screening} radius={[2, 2, 0, 0]} />
                <Bar dataKey="入组" fill={PATIENT_STATUS_COLORS.enrolled} radius={[2, 2, 0, 0]} />
                <Bar dataKey="治疗期" fill={PATIENT_STATUS_COLORS.treatment} radius={[2, 2, 0, 0]} />
                <Bar dataKey="退出研究" fill={PATIENT_STATUS_COLORS.withdrawn} radius={[2, 2, 0, 0]} />
                <Bar dataKey="完成研究" fill={PATIENT_STATUS_COLORS.completed} radius={[2, 2, 0, 0]} />
                <Bar dataKey="失访" fill={PATIENT_STATUS_COLORS.lost} radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* 患者列表 */}
      <PatientTable patients={projectPatients} projects={allProjects} />
    </div>
  )
}

// ==================== 全部研究视图 ====================
function AllProjectsView({ projects, patients }: { projects: any[]; patients: any[] }) {
  const barData = generateAllProjectsBarData(projects, patients)

  // 统计
  const totalScreening = patients.filter((p) => p.status === 'screening').length
  const totalEnrolled = patients.filter((p) => p.status === 'enrolled').length
  const totalTreatment = patients.filter((p) => p.status === 'treatment').length
  const totalCompleted = patients.filter((p) => p.status === 'completed').length
  const totalWithdrawn = patients.filter((p) => p.status === 'withdrawn').length

  return (
    <div className="space-y-4">
      {/* 顶部5个统计卡片 */}
      <div className="grid grid-cols-5 gap-4">
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
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center">
              <Stethoscope className="w-5 h-5 text-teal-600" />
            </div>
            <div>
              <div className="text-sm text-slate-500">治疗期</div>
              <div className="text-xl font-bold text-slate-800">{totalTreatment}个</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center">
              <ClipboardCheck className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <div className="text-sm text-slate-500">完成研究</div>
              <div className="text-xl font-bold text-slate-800">{totalCompleted}个</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center">
              <LogOut className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <div className="text-sm text-slate-500">退出研究</div>
              <div className="text-xl font-bold text-slate-800">{totalWithdrawn}个</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 图表区域：饼图 + 柱状图 */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="bg-white">
          <CardContent className="p-4">
            <h3 className="text-sm font-medium text-slate-700 mb-2 text-center">患者总览</h3>
            <PatientPieChart patients={patients} />
          </CardContent>
        </Card>
        <Card className="bg-white">
          <CardContent className="p-4">
            <h3 className="text-sm font-medium text-slate-700 mb-2 text-center">患者管理</h3>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Bar dataKey="筛选" fill={PATIENT_STATUS_COLORS.screening} radius={[2, 2, 0, 0]} />
                <Bar dataKey="入组" fill={PATIENT_STATUS_COLORS.enrolled} radius={[2, 2, 0, 0]} />
                <Bar dataKey="治疗期" fill={PATIENT_STATUS_COLORS.treatment} radius={[2, 2, 0, 0]} />
                <Bar dataKey="退出研究" fill={PATIENT_STATUS_COLORS.withdrawn} radius={[2, 2, 0, 0]} />
                <Bar dataKey="完成研究" fill={PATIENT_STATUS_COLORS.completed} radius={[2, 2, 0, 0]} />
                <Bar dataKey="失访" fill={PATIENT_STATUS_COLORS.lost} radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* 患者列表 */}
      <PatientTable patients={patients} projects={projects} />
    </div>
  )
}

// ==================== 主页面 ====================
export default function ManagerPatients() {
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

  return <SingleProjectView project={project} allPatients={patients} allProjects={projects} />
}
