import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { useAppStorage } from '@/hooks/useAppStorage'
import { usePageSize } from '@/hooks/usePageSize'
import StatCard from '@/components/StatCard'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Users, Stethoscope, ClipboardCheck, LogOut, UserCheck,
  ChevronLeft, ChevronRight, Eye,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts'

const PATIENT_STATUS_COLORS: Record<string, string> = {
  screening: '#3b82f6',
  enrolled: '#f97316',
  treatment: '#14b8a6',
  completed: '#8b5cf6',
  withdrawn: '#ef4444',
  lost: '#94a3b8',
}

/**
 * 患者状态月度统计（基于真实患者数据，稳定不随机）：
 * 按患者最近更新月份（updatedAt）归桶，统计当月处于各状态的患者数
 */
function generateMonthlyPatientData(projectPatients: any[]) {
  const STATUS_KEYS: Record<string, string> = {
    screening: '筛选', enrolled: '入组', treatment: '治疗期',
    withdrawn: '退出研究', completed: '完成研究', lost: '失访',
  }
  const now = new Date()
  const buckets: Record<string, Record<string, number>> = {}
  for (const p of projectPatients) {
    const label = STATUS_KEYS[p.status]
    const key = (p.updatedAt || p.createdAt || '').slice(0, 7)
    if (!label || !key) continue
    buckets[key] = buckets[key] ?? {}
    buckets[key][label] = (buckets[key][label] ?? 0) + 1
  }
  const months: { month: string; 筛选: number; 入组: number; 治疗期: number; 退出研究: number; 完成研究: number; 失访: number }[] = []
  for (let i = 7; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const b = buckets[m] ?? {}
    months.push({
      month: m,
      筛选: b['筛选'] ?? 0,
      入组: b['入组'] ?? 0,
      治疗期: b['治疗期'] ?? 0,
      退出研究: b['退出研究'] ?? 0,
      完成研究: b['完成研究'] ?? 0,
      失访: b['失访'] ?? 0,
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

// ==================== 通用：患者列表表格（与录入端一致：分页 + 可选行数 + 访视完成率 + 查看操作） ====================
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100]

function PatientTable({ patients, projects }: { patients: any[]; projects: any[] }) {
  const { visitData } = useAppStorage()
  const [pageSize, setPageSize] = usePageSize('crf_pagesize_manager_patients')
  const [page, setPage] = useState(1)

  const totalPages = Math.max(1, Math.ceil(patients.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const paged = useMemo(
    () => patients.slice((safePage - 1) * pageSize, safePage * pageSize),
    [patients, safePage, pageSize]
  )

  // 患者集合变化时回到第一页
  useEffect(() => {
    setPage(1)
  }, [patients])

  const centerNameOf = (p: any): string => {
    const proj = projects.find((x) => x.id === p.projectId)
    return proj?.centers?.find((c: any) => c.id === p.centerId)?.name || proj?.researchCenter || '-'
  }

  // 访视完成率：已完成访视 ÷ 应做访视（退出/失访患者按最后有数据的访视计应做数），与录入端口径一致
  const rateMap = useMemo(() => {
    const map = new Map<string, number>()
    patients.forEach((p) => {
      const project = projects.find((proj) => proj.id === p.projectId)
      if (!project) { map.set(p.id, 0); return }
      const isActive = p.status !== 'withdrawn' && p.status !== 'lost'
      let expected = project.visits.length
      if (!isActive) {
        const ordersWithData = project.visits
          .filter((v: any) => visitData.some((r: any) => r.patientId === p.id && r.visitId === v.id))
          .map((v: any) => v.order)
        expected = ordersWithData.length > 0 ? Math.max(...ordersWithData) : 0
      }
      if (expected === 0) { map.set(p.id, 0); return }
      let completed = 0
      project.visits.forEach((visit: any) => {
        if (visit.order > expected) return
        const records = visitData.filter((r: any) => r.patientId === p.id && r.visitId === visit.id)
        const done = records.filter((r: any) => r.status === 'completed').length
        if (visit.crfModuleIds.length > 0 && done >= visit.crfModuleIds.length) completed++
      })
      map.set(p.id, Math.round((completed / expected) * 100))
    })
    return map
  }, [patients, projects, visitData])

  // 列宽按比例分配，间距均匀（与录入端一致）
  const GRID_COLS = 'grid-cols-[0.4fr_1.1fr_1.3fr_0.7fr_0.8fr_0.7fr_0.8fr_0.95fr_0.95fr_1.2fr_0.9fr]'
  const HEADERS = ['序号', '研究编号', '研究中心', '姓名缩写', '状态', '筛选编号', '入组编号', '知情日期', '入组日期', '访视完成率', '操作']

  // 状态口径：完成研究 / 进行中（退出、失访单独标识），与录入端一致
  const statusViewOf = (status: string): { label: string; cls: string } => {
    if (status === 'completed') return { label: '完成研究', cls: 'bg-purple-50 text-purple-600' }
    if (status === 'withdrawn' || status === 'lost') return { label: '退出研究', cls: 'bg-red-50 text-red-500' }
    return { label: '进行中', cls: 'bg-teal-50 text-teal-600' }
  }

  return (
    <Card className="bg-white overflow-hidden py-0 gap-0">
      <CardContent className="p-0">
        {/* 表头 */}
        <div className={`grid ${GRID_COLS} bg-slate-50 border-b border-slate-200`}>
          {HEADERS.map((h) => (
            <div key={h} className="py-2.5 px-3 text-center text-xs font-medium text-slate-500 whitespace-nowrap">
              {h}
            </div>
          ))}
        </div>

        {/* 表体 */}
        {patients.length === 0 && (
          <div className="text-center py-8 text-sm text-slate-400">暂无患者数据</div>
        )}
        {paged.map((p, idx) => {
          const project = projects.find((proj) => proj.id === p.projectId)
          const statusView = statusViewOf(p.status)
          const rate = rateMap.get(p.id) ?? 0
          const seq = String((safePage - 1) * pageSize + idx + 1).padStart(2, '0')
          return (
            <div
              key={p.id}
              className={`grid ${GRID_COLS} text-xs text-slate-700 hover:bg-sky-50/40 transition-colors ${
                idx !== paged.length - 1 ? 'border-b border-slate-100' : ''
              }`}
            >
              <div className="py-3 px-3 text-center font-mono text-slate-600">{seq}</div>
              <div className="py-3 px-3 text-center font-mono text-slate-500">{project?.projectNo || '-'}</div>
              <div className="py-3 px-3 text-center truncate">{centerNameOf(p)}</div>
              <div className="py-3 px-3 text-center font-medium text-slate-800">{p.nameInitials || '-'}</div>
              <div className="py-3 px-3 text-center">
                <span className={`inline-block px-2 py-0.5 rounded text-[10px] ${statusView.cls}`}>
                  {statusView.label}
                </span>
              </div>
              <div className="py-3 px-3 text-center font-medium text-slate-800 font-mono">{p.screeningId || p.screeningNo || '-'}</div>
              <div className="py-3 px-3 text-center font-mono text-slate-500">{p.randomizationId || '-'}</div>
              <div className="py-3 px-3 text-center text-slate-500">{p.consentDate || '-'}</div>
              <div className="py-3 px-3 text-center text-slate-500">{p.enrollmentDate || '-'}</div>
              <div className="py-3 px-3">
                <div className="flex items-center gap-2 justify-center">
                  <div className="w-full max-w-[72px] h-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${rate >= 100 ? 'bg-emerald-500' : 'bg-gradient-to-r from-sky-400 to-sky-500'}`}
                      style={{ width: `${rate}%` }}
                    />
                  </div>
                  <span className={`font-semibold ${rate >= 100 ? 'text-emerald-600' : 'text-sky-600'}`}>{rate}%</span>
                </div>
              </div>
              <div className="py-3 px-3 text-center">
                <Button size="sm" variant="outline" className="h-6 px-2 text-[11px]" asChild>
                  <Link to={`/manager/patient-print/${p.id}`}>
                    <Eye className="w-3 h-3 mr-1" /> 查看数据
                  </Link>
                </Button>
              </div>
            </div>
          )
        })}

        {/* 分页栏 */}
        {patients.length > 0 && (
          <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-200 bg-slate-50/50">
            <span className="text-xs text-slate-500">
              共 {patients.length} 例 · 第 {(safePage - 1) * pageSize + 1}-{Math.min(safePage * pageSize, patients.length)} 例
            </span>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-400">每页</span>
                <Select
                  value={String(pageSize)}
                  onValueChange={(v) => { setPageSize(Number(v)); setPage(1) }}
                >
                  <SelectTrigger className="h-7 w-[64px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAGE_SIZE_OPTIONS.map((n) => (
                      <SelectItem key={n} value={String(n)} className="text-xs">{n}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-xs text-slate-400">行</span>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline" size="sm" className="h-7 w-7 p-0"
                  disabled={safePage <= 1}
                  onClick={() => setPage(safePage - 1)}
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </Button>
                <span className="text-xs text-slate-600 min-w-[52px] text-center">
                  {safePage} / {totalPages}
                </span>
                <Button
                  variant="outline" size="sm" className="h-7 w-7 p-0"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage(safePage + 1)}
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </div>
        )}
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

  const total = data.reduce((s, d) => s + d.value, 0)

  return (
    <div className="flex items-center justify-center gap-20">
      <div className="w-[280px] shrink-0">
        <h3 className="text-sm font-medium text-slate-700 mb-1 text-center">患者总览</h3>
        <div className="relative">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={48}
                outerRadius={86}
                paddingAngle={3}
                dataKey="value"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-xl font-bold text-slate-800">{total}</span>
            <span className="text-[11px] text-slate-400">总例数</span>
          </div>
        </div>
      </div>
      <div className="w-28 shrink-0 space-y-2">
        {data.map((d) => (
          <div key={d.name} className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: d.color }} />
            <span className="text-xs text-slate-600 flex-1">{d.name}</span>
            <span className="text-xs font-semibold text-slate-800 tabular-nums">{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ==================== 单个项目视图 ====================
function SingleProjectView({ project, allPatients, allProjects }: { project: any; allPatients: any[]; allProjects: any[] }) {
  const projectPatients = allPatients.filter((p) => p.projectId === project.id)
  const monthlyData = generateMonthlyPatientData(projectPatients)

  return (
    <div className="space-y-4">
      {/* 图表区域：饼图 + 柱状图 */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="bg-white">
          <CardContent className="p-4">
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
  // 副信息：入组目标合计 / 退出率
  const targetSum = projects.reduce((sum: number, p: any) => sum + (p.targetEnrollment || 0), 0)
  const withdrawRate = patients.length > 0 ? Math.round((totalWithdrawn / patients.length) * 100) : 0

  return (
    <div className="space-y-4">
      {/* 顶部5个统计卡片（全站统一 StatCard） */}
      <div className="grid grid-cols-5 gap-4">
        <StatCard label="筛选中" value={totalScreening} unit="例" sub="当前处于筛选期" icon={Users} gradient="from-blue-500 to-blue-600" />
        <StatCard label="已入组" value={totalEnrolled} unit="例" sub={`目标 ${targetSum} 例`} icon={UserCheck} gradient="from-orange-500 to-amber-600" />
        <StatCard label="治疗期" value={totalTreatment} unit="例" sub="正在接受研究治疗" icon={Stethoscope} gradient="from-teal-500 to-emerald-600" />
        <StatCard label="完成研究" value={totalCompleted} unit="例" sub="已完成全部访视" icon={ClipboardCheck} gradient="from-purple-500 to-violet-600" />
        <StatCard label="退出研究" value={totalWithdrawn} unit="例" sub={`退出率 ${withdrawRate}%`} icon={LogOut} gradient="from-red-500 to-rose-600" />
      </div>

      {/* 图表区域：饼图 + 柱状图 */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="bg-white">
          <CardContent className="p-4">
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
