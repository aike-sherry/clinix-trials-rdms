import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { useAppStorage } from '@/hooks/useAppStorage'
import StatCard from '@/components/StatCard'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  FlaskConical, CheckCircle2, Clock, CircleDashed,
  Building2, Users, ClipboardList, UserCheck,
  BarChart3, Table as TableIcon, TrendingUp,
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

/** 时间粒度：日（近 14 天）/ 月（近 8 个月）/ 年（全部年份） */
type TrendUnit = 'day' | 'month' | 'year'

type TrendPatient = { createdAt: string; enrollmentDate?: string; status: string }

/**
 * 筛选/入组趋势统计（基于真实患者数据，稳定不随机）：
 * 筛选 = 完成登记的受试者数（createdAt）；入组 = 入组的受试者数（enrollmentDate）
 */
function buildTrendData(patients: TrendPatient[], unit: TrendUnit) {
  const rows: { key: string; label: string; 筛选: number; 入组: number }[] = []
  const now = new Date()
  if (unit === 'day') {
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      rows.push({ key, label: `${d.getMonth() + 1}/${d.getDate()}`, 筛选: 0, 入组: 0 })
    }
  } else if (unit === 'month') {
    for (let i = 7; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      rows.push({ key, label: key, 筛选: 0, 入组: 0 })
    }
  } else {
    const years = new Set<number>()
    patients.forEach((p) => {
      const y = p.createdAt?.slice(0, 4)
      if (y) years.add(+y)
      const ey = p.enrollmentDate?.slice(0, 4)
      if (ey) years.add(+ey)
    })
    years.add(now.getFullYear())
    const sorted = [...years].sort((a, b) => a - b)
    for (const y of sorted) rows.push({ key: String(y), label: `${y}年`, 筛选: 0, 入组: 0 })
  }
  const idxOf = (iso?: string) => {
    if (!iso) return -1
    const key = unit === 'day' ? iso.slice(0, 10) : unit === 'month' ? iso.slice(0, 7) : iso.slice(0, 4)
    return rows.findIndex((r) => r.key === key)
  }
  for (const p of patients) {
    const ri = idxOf(p.createdAt)
    if (ri >= 0) rows[ri].筛选 += 1
    const isEnrolled = p.status === 'enrolled' || p.status === 'treatment' || p.status === 'completed'
    if (isEnrolled) {
      const ei = idxOf(p.enrollmentDate || p.createdAt)
      if (ei >= 0) rows[ei].入组 += 1
    }
  }
  return rows
}

/** 筛选/入组卡片：日/月/年切换 + 柱状图/表格切换 */
function ScreenEnrollCard({ patients }: { patients: TrendPatient[] }) {
  const [unit, setUnit] = useState<TrendUnit>('month')
  const [view, setView] = useState<'chart' | 'table'>('chart')
  const data = useMemo(() => buildTrendData(patients, unit), [patients, unit])
  const totalScreen = data.reduce((s, r) => s + r.筛选, 0)
  const totalEnroll = data.reduce((s, r) => s + r.入组, 0)

  return (
    <Card className="bg-white">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-slate-700">筛选/入组</h3>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-0.5 bg-slate-100 border border-slate-200 rounded-lg p-0.5">
              {([
                { k: 'day', l: '日' },
                { k: 'month', l: '月' },
                { k: 'year', l: '年' },
              ] as const).map(({ k, l }) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setUnit(k)}
                  className={`px-2.5 py-1 rounded-md text-xs transition-colors ${
                    unit === k ? 'bg-sky-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-0.5 bg-slate-100 border border-slate-200 rounded-lg p-0.5">
              <button
                type="button"
                title="柱状图"
                onClick={() => setView('chart')}
                className={`p-1.5 rounded-md transition-colors ${
                  view === 'chart' ? 'bg-sky-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                title="表格"
                onClick={() => setView('table')}
                className={`p-1.5 rounded-md transition-colors ${
                  view === 'table' ? 'bg-sky-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <TableIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
        {view === 'chart' ? (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="筛选" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={48} />
              <Bar dataKey="入组" fill="#f97316" radius={[4, 4, 0, 0]} maxBarSize={48} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <div className="grid grid-cols-3 bg-slate-50 text-xs text-slate-500 font-medium border-b border-slate-200">
              {['时间', '筛选', '入组'].map((h) => (
                <div key={h} className="py-2 px-3 text-center">{h}</div>
              ))}
            </div>
            <div className="max-h-[240px] overflow-y-auto">
              {data.map((r) => (
                <div key={r.key} className="grid grid-cols-3 text-xs text-slate-700 border-b border-slate-100">
                  <div className="py-2 px-3 text-center">{r.label}</div>
                  <div className="py-2 px-3 text-center font-semibold text-blue-600">{r.筛选}</div>
                  <div className="py-2 px-3 text-center font-semibold text-orange-500">{r.入组}</div>
                </div>
              ))}
              <div className="grid grid-cols-3 text-xs font-semibold text-slate-800 bg-slate-50/70">
                <div className="py-2 px-3 text-center">合计</div>
                <div className="py-2 px-3 text-center text-blue-600">{totalScreen}</div>
                <div className="py-2 px-3 text-center text-orange-500">{totalEnroll}</div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/** 进度统计表头（与其他页面统一的浅灰风格） */
function ProgressTableTitle() {
  return (
    <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100">
      <div className="w-7 h-7 rounded-lg bg-sky-50 flex items-center justify-center flex-shrink-0">
        <TrendingUp className="w-3.5 h-3.5 text-sky-600" />
      </div>
      <h3 className="text-sm font-medium text-slate-700">进度统计</h3>
    </div>
  )
}

const PROGRESS_TABLE_HEADERS = ['研究编号', '研究中心', '主要研究者', '研究状态', '开始日期', '结束日期', '筛选例数', '筛选失败', '入组例数']

// ==================== 单个项目视图 ====================
function SingleProjectView({ project, patients }: { project: any; patients: any[] }) {
  const projectPatients = patients.filter((p) => p.projectId === project.id)
  const screeningCount = projectPatients.filter((p) => p.status === 'screening').length
  const screenFailedCount = projectPatients.filter(
    (p) => p.status === 'withdrawn' && p.screeningFailReason
  ).length
  const enrolledCount = projectPatients.filter(
    (p) => p.status === 'enrolled' || p.status === 'treatment' || p.status === 'completed'
  ).length

  const statusInfo = STATUS_MAP[project.status] || STATUS_MAP.proposal_review

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

      {/* 筛选/入组：日/月/年 + 图表/表格切换 */}
      <ScreenEnrollCard patients={projectPatients} />

      {/* 进度统计表格 */}
      <Card className="bg-white">
        <CardContent className="p-0">
          <ProgressTableTitle />
          <div className="grid grid-cols-9 bg-slate-50 text-slate-500 text-xs font-medium border-b border-slate-200">
            {PROGRESS_TABLE_HEADERS.map((h) => (
              <div key={h} className="py-2.5 px-2 text-center border-r border-slate-100 last:border-r-0">
                {h}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-9 text-xs text-slate-700">
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
            <div className="py-2.5 px-2 text-center border-r border-slate-100 font-semibold text-red-500">{screenFailedCount}</div>
            <div className="py-2.5 px-2 text-center font-semibold text-orange-500">{enrolledCount}</div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ==================== 全部研究视图 ====================
function AllProjectsView({ projects, patients }: { projects: any[]; patients: any[] }) {
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
      screenFailed: pp.filter((pt) => pt.status === 'withdrawn' && pt.screeningFailReason).length,
      enrolled: pp.filter((pt) => pt.status === 'enrolled' || pt.status === 'treatment' || pt.status === 'completed').length,
    }
  })

  return (
    <div className="space-y-4">
      {/* 顶部统计卡片（全站统一 StatCard） */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="研究数量" value={totalProjects} unit="项" sub="全部在管研究" icon={ClipboardList} gradient="from-sky-500 to-blue-600" />
        <StatCard label="研究中心" value={uniqueCenters} unit="家" sub="参与研究的中心" icon={Building2} gradient="from-teal-500 to-emerald-600" />
        <StatCard label="累计筛选" value={totalScreening} unit="例" sub="全部受试者" icon={Users} gradient="from-blue-500 to-indigo-600" />
        <StatCard
          label="累计入组" value={totalEnrolled} unit="例"
          sub={`入组率 ${(totalScreening + totalEnrolled) > 0 ? Math.round((totalEnrolled / (totalScreening + totalEnrolled)) * 100) : 0}%`}
          icon={UserCheck} gradient="from-orange-500 to-amber-600"
        />
      </div>

      {/* 筛选/入组：日/月/年 + 图表/表格切换 */}
      <ScreenEnrollCard patients={patients} />

      {/* 进度统计：全部研究核心信息表格 */}
      <Card className="bg-white">
        <CardContent className="p-0">
          <ProgressTableTitle />
          <div className="grid grid-cols-9 bg-slate-50 text-slate-500 text-xs font-medium border-b border-slate-200">
            {PROGRESS_TABLE_HEADERS.map((h) => (
              <div key={h} className="py-2.5 px-2 text-center border-r border-slate-100 last:border-r-0">
                {h}
              </div>
            ))}
          </div>
          {projectStats.map((p) => {
            const sInfo = STATUS_MAP[p.status] || STATUS_MAP.proposal_review
            return (
              <div key={p.id} className="grid grid-cols-9 text-xs text-slate-700 border-b border-slate-100 last:border-b-0">
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
                <div className="py-3 px-2 text-center border-r border-slate-100 font-semibold text-red-500">{p.screenFailed}</div>
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
