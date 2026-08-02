import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAppStorage } from '@/hooks/useAppStorage'
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, LineChart, Line
} from 'recharts'

const STATUS_COLORS = {
  pending: '#f59e0b',
  active: '#14b8a6',
  completed: '#3b82f6',
  suspended: '#ef4444',
}

const STATUS_LABELS: Record<string, string> = {
  pending: '立项',
  active: '进行中',
  completed: '结束',
  suspended: '暂停',
}

export default function AdminHome() {
  const { projects, patients } = useAppStorage()

  // 课题状态统计
  const statusData = [
    { name: '立项', value: projects.filter((p) => p.status === 'pending').length, color: STATUS_COLORS.pending },
    { name: '进行中', value: projects.filter((p) => p.status === 'active').length, color: STATUS_COLORS.active },
    { name: '结束', value: projects.filter((p) => p.status === 'completed').length, color: STATUS_COLORS.completed },
  ].filter((d) => d.value > 0)

  // 预算汇总（按项目）
  const budgetData = projects.map((p) => ({
    name: p.projectNo,
    budget: p.budget || 0,
  }))

  // 患者注册进度（按月）
  const monthlyData = [
    { month: '2026-01', screening: 5, enrolled: 2, completed: 0, withdrawn: 0, lost: 0 },
    { month: '2026-02', screening: 12, enrolled: 8, completed: 0, withdrawn: 1, lost: 0 },
    { month: '2026-03', screening: 25, enrolled: 18, completed: 2, withdrawn: 2, lost: 1 },
    { month: '2026-04', screening: 40, enrolled: 30, completed: 5, withdrawn: 3, lost: 2 },
    { month: '2026-05', screening: 55, enrolled: 42, completed: 10, withdrawn: 5, lost: 3 },
    { month: '2026-06', screening: 68, enrolled: 55, completed: 18, withdrawn: 8, lost: 5 },
  ]

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
              {projects.filter((p) => p.status === 'active').length}
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
                <div className="w-16">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    p.status === 'active' ? 'bg-teal-50 text-teal-600' :
                    p.status === 'completed' ? 'bg-blue-50 text-blue-600' :
                    p.status === 'pending' ? 'bg-amber-50 text-amber-600' :
                    'bg-red-50 text-red-600'
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
