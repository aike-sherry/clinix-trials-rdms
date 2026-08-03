import { useParams } from 'react-router'
import { useAppStorage } from '@/hooks/useAppStorage'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  FlaskConical, CheckCircle2, Clock, CircleDashed,
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
}

// 流程节点配置
const FLOW_STEPS = [
  { key: 'proposal', label: '立项日期', dateField: 'createdAt' as const },
  { key: 'ethics', label: '伦理审核', dateField: null as string | null },
  { key: 'contract', label: '合同终稿', dateField: null as string | null },
  { key: 'startup', label: '研究启动', dateField: 'startDate' as const },
  { key: 'close', label: '课题结题', dateField: 'endDate' as const },
]

// 模拟每月筛选/入组数据
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

export default function ProjectProgress() {
  const { projectId } = useParams<{ projectId: string }>()
  const { projects, patients } = useAppStorage()

  const project = projects.find((p) => p.id === projectId)
  if (!project) return <div>项目不存在</div>

  const projectPatients = patients.filter((p) => p.projectId === project.id)
  const screeningCount = projectPatients.filter((p) => p.status === 'screening').length
  const enrolledCount = projectPatients.filter((p) => p.status === 'enrolled' || p.status === 'treatment' || p.status === 'completed').length

  const statusInfo = STATUS_MAP[project.status] || STATUS_MAP.proposal_review
  const monthlyData = generateMonthlyData(project)

  // 流程节点状态计算
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
    // 模拟中间步骤日期
    if (idx < currentStepIndex) {
      const base = new Date(project.createdAt)
      base.setMonth(base.getMonth() + idx)
      return base.toISOString().slice(0, 10)
    }
    return '未到'
  }

  return (
    <div className="space-y-5">
      {/* 顶部项目信息卡片 */}
      <Card className="bg-white">
        <CardContent className="p-5">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center">
                <FlaskConical className="w-5 h-5 text-teal-600" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 font-mono">{project.projectNo}</span>
                  <Badge className={`text-xs ${statusInfo.color}`}>{statusInfo.label}</Badge>
                </div>
                <h2 className="font-semibold text-slate-800">{project.name}</h2>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-4 text-sm">
            <div className="text-center">
              <p className="text-xs text-slate-400">主要研究者</p>
              <p className="font-medium text-slate-700">{project.principalInvestigator || '-'}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-slate-400">研究科室</p>
              <p className="font-medium text-slate-700">{project.department || '-'}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-slate-400">申办方</p>
              <p className="font-medium text-slate-700">{project.sponsor || '-'}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-slate-400">临床监查员</p>
              <p className="font-medium text-slate-700">-</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 流程时间线 */}
      <Card className="bg-white">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            {FLOW_STEPS.map((step, idx) => {
              const state = getStepState(idx)
              const date = getStepDate(idx)
              const isLast = idx === FLOW_STEPS.length - 1

              return (
                <div key={step.key} className="flex items-center flex-1">
                  <div className="flex flex-col items-center flex-1">
                    {/* 图标 */}
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold mb-2 ${
                        state === 'done'
                          ? 'bg-sky-500 text-white'
                          : state === 'active'
                          ? 'bg-sky-100 text-sky-600 border-2 border-sky-500'
                          : 'bg-slate-100 text-slate-400'
                      }`}
                    >
                      {state === 'done' ? (
                        <CheckCircle2 className="w-5 h-5" />
                      ) : state === 'active' ? (
                        <Clock className="w-5 h-5" />
                      ) : (
                        <CircleDashed className="w-5 h-5" />
                      )}
                    </div>
                    {/* 标题 */}
                    <span
                      className={`text-xs font-medium ${
                        state === 'done' || state === 'active' ? 'text-slate-700' : 'text-slate-400'
                      }`}
                    >
                      {step.label}
                    </span>
                    {/* 日期 */}
                    <span className="text-[10px] text-slate-400 mt-0.5">{date}</span>
                  </div>
                  {/* 连接线 */}
                  {!isLast && (
                    <div
                      className={`flex-1 h-0.5 mx-2 ${
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
        <CardContent className="p-6">
          <h3 className="text-sm font-medium text-slate-700 mb-4 text-center">筛选/入组</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={monthlyData} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
              />
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
          {/* 表头 */}
          <div className="grid grid-cols-8 bg-sky-500 text-white text-xs font-medium">
            {['研究编号', '研究中心', '主要研究者', '研究状态', '开始日期', '结束日期', '筛选例数', '入组例数'].map(
              (h) => (
                <div key={h} className="py-2.5 px-2 text-center border-r border-sky-400 last:border-r-0">
                  {h}
                </div>
              )
            )}
          </div>
          {/* 数据行 */}
          <div className="grid grid-cols-8 text-xs text-slate-700">
            <div className="py-3 px-2 text-center border-r border-slate-100">{project.projectNo}</div>
            <div className="py-3 px-2 text-center border-r border-slate-100">{project.researchCenter || '-'}</div>
            <div className="py-3 px-2 text-center border-r border-slate-100">{project.principalInvestigator || '-'}</div>
            <div className="py-3 px-2 text-center border-r border-slate-100">
              <span className={`inline-block px-2 py-0.5 rounded text-[10px] ${statusInfo.color}`}>
                {statusInfo.label}
              </span>
            </div>
            <div className="py-3 px-2 text-center border-r border-slate-100">{project.startDate || '-'}</div>
            <div className="py-3 px-2 text-center border-r border-slate-100">{project.endDate || '-'}</div>
            <div className="py-3 px-2 text-center border-r border-slate-100 font-semibold text-blue-600">{screeningCount}</div>
            <div className="py-3 px-2 text-center font-semibold text-orange-500">{enrolledCount}</div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
