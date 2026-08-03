import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAppStorage } from '@/hooks/useAppStorage'
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, LineChart, Line
} from 'recharts'

const STATUS_COLORS: Record<string, string> = {
  proposal_review: '#f59e0b',
  contract_signed: '#fb923c',
  ethics_review: '#eab308',
  study_started: '#14b8a6',
  study_closed: '#3b82f6',
  suspended: '#ef4444',
}

const STATUS_LABELS: Record<string, string> = {
  proposal_review: '立项审核',
  contract_signed: '合同签署',
  ethics_review: '伦理审核',
  study_started: '进行中',
  study_closed: '已关闭',
  suspended: '已暂停',
  // 兼容旧数据
  pending: '立项',
  active: '进行中',
  completed: '结束',
}

const STATUS_BADGE: Record<string, string> = {
  study_started: 'bg-teal-50 text-teal-600',
  study_closed: 'bg-blue-50 text-blue-600',
  proposal_review: 'bg-amber-50 text-amber-600',
  contract_signed: 'bg-orange-50 text-orange-600',
  ethics_review: 'bg-yellow-50 text-yellow-600',
  suspended: 'bg-red-50 text-red-600',
}

export default function AdminHome() {
  const { projects, patients } = useAppStorage()

  // 课题状态统计
  const statusData = [
    ...(['proposal_review', 'contract_signed', 'ethics_review', 'study_started', 'study_closed', 'suspended'] as const)
      .map((s) => ({
        name: STATUS_LABELS[s],
        value: projects.filter((p) => p.status === s).length,
        color: STATUS_COLORS[s],
      })),
  ].filter((d) => d.value > 0)

  // 预算汇总（按项目）
  const budgetData = projects.map((p) => ({
    name: p.projectNo,
    budget: p.budget || 0,
  }))

  // 患者注册进度（按月累计，来自真实患者数据）
  const monthSet = new Set<string>()
  patients.forEach((pt) => {
    if (pt.consentDate) monthSet.add(pt.consentDate.slice(0, 7))
    if (pt.enrollmentDate) monthSet.add(pt.enrollmentDate.slice(0, 7))
  })
  const months = [...monthSet].sort()
  let cumScreening = 0
  let cumEnrolled = 0
  const monthlyData = months.map((m) => {
    cumScreening += patients.filter((pt) => pt.consentDate?.slice(0, 7) === m).length
    cumEnrolled += patients.filter((pt) => pt.enrollmentDate?.slice(0, 7) === m).length
    const completed = patients.filter((pt) => pt.status === 'completed' && pt.enrollmentDate && pt.enrollmentDate.slice(0, 7) <= m).length
    return { month: m, screening: cumScreening, enrolled: cumEnrolled, completed }
  })

  // 进度详情
  const progressData = projects.slice(0, 4).map((p) => {
    const projectPatients = patients.filter((pt) => pt.projectId === p.id)
    const screened = projectPatients.length
    const enrolled = projectPatients.filter((pt) => pt.status !== 'screening').length
    const total = p.targetEnrollment || 100
    const progress = total > 0 ? Math.round((enrolled / total) * 100) : 0
    return {
      ...p,
      screened,
      enrolled,
      progress,
    }
  })

  return (
    <div className="space-y-5">
      {/* 顶部统计卡片 */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-slate-500">总课题数</div>
            <div className="text-2xl font-bold text-slate-800">{projects.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-slate-500">进行中</div>
            <div className="text-2xl font-bold text-teal-600">
              {projects.filter((p) => p.status === 'study_started' || p.status === 'active').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-slate-500">总受试者</div>
            <div className="text-2xl font-bold text-slate-800">{patients.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-slate-500">已入组</div>
            <div className="text-2xl font-bold text-blue-600">
              {patients.filter((p) => p.status !== 'screening').length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 图表区域 1 */}
      <div className="grid grid-cols-2 gap-5">
        {/* 课题状态一览 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">课题状态一览</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* 预算汇总 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">预算汇总</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={budgetData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="budget" fill="#14b8a6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* 进度统计 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">进度统计</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {progressData.map((p) => (
              <div key={p.id} className="flex items-center gap-4">
                <div className="w-24 text-sm text-slate-600 truncate">{p.projectNo}</div>
                <div className="w-20 text-sm text-slate-500">{p.startDate?.slice(0, 10) || '-'}</div>
                <div className="w-20 text-sm text-slate-500">{p.endDate?.slice(0, 10) || '-'}</div>
                <div className="w-20">
                  <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${
                    STATUS_BADGE[p.status] || 'bg-slate-100 text-slate-500'
                  }`}>
                    {STATUS_LABELS[p.status] || p.status}
                  </span>
                </div>
                <div className="flex-1">
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-teal-500 rounded-full transition-all"
                      style={{ width: `${p.progress}%` }}
                    />
                  </div>
                </div>
                <div className="w-12 text-right text-xs text-slate-500">{p.progress}%</div>
              </div>
            ))}
            {progressData.length === 0 && (
              <div className="text-center text-sm text-slate-400 py-6">暂无课题数据</div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 筛选/入组进度 + 患者注册进度 */}
      <div className="grid grid-cols-2 gap-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">筛选/入组进度</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={projects.slice(0, 6).map((p) => {
                const pts = patients.filter((pt) => pt.projectId === p.id)
                return {
                  name: p.projectNo,
                  screened: pts.length,
                  enrolled: pts.filter((pt) => pt.status !== 'screening').length,
                }
              })}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="screened" name="筛选例数" fill="#14b8a6" radius={[2, 2, 0, 0]} />
                <Bar dataKey="enrolled" name="入组例数" fill="#f97316" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">患者注册进度</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="screening" name="筛选例数" stroke="#8b5cf6" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="enrolled" name="入组例数" stroke="#3b82f6" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="completed" name="完成研究" stroke="#14b8a6" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* 受试者状态 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">受试者状态</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center">
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={[
                  { name: '筛选', value: patients.filter((p) => p.status === 'screening').length, color: '#8b5cf6' },
                  { name: '入组', value: patients.filter((p) => p.status === 'enrolled').length, color: '#3b82f6' },
                  { name: '治疗', value: patients.filter((p) => p.status === 'treatment').length, color: '#14b8a6' },
                  { name: '完成', value: patients.filter((p) => p.status === 'completed').length, color: '#f59e0b' },
                  { name: '退出', value: patients.filter((p) => p.status === 'withdrawn').length, color: '#ef4444' },
                ].filter((d) => d.value > 0)}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={3}
                dataKey="value"
              >
                {[
                  { color: '#8b5cf6' },
                  { color: '#3b82f6' },
                  { color: '#14b8a6' },
                  { color: '#f59e0b' },
                  { color: '#ef4444' },
                ].map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  )
}
