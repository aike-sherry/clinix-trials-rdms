import { useParams } from 'react-router'
import { useAppStorage } from '@/hooks/useAppStorage'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts'

export default function ProjectStatistics() {
  const { projectId } = useParams<{ projectId: string }>()
  const { projects, patients } = useAppStorage()

  const project = projects.find((p) => p.id === projectId)
  if (!project) return <div>项目不存在</div>

  const projectPatients = patients.filter((p) => p.projectId === projectId)

  const statusData = [
    { name: '筛选', value: projectPatients.filter((p) => p.status === 'screening').length },
    { name: '入组', value: projectPatients.filter((p) => p.status === 'enrolled').length },
    { name: '治疗', value: projectPatients.filter((p) => p.status === 'treatment').length },
    { name: '完成', value: projectPatients.filter((p) => p.status === 'completed').length },
    { name: '退出', value: projectPatients.filter((p) => p.status === 'withdrawn').length },
    { name: '失访', value: projectPatients.filter((p) => p.status === 'lost').length },
  ].filter((d) => d.value > 0)

  const COLORS = ['#8b5cf6', '#3b82f6', '#14b8a6', '#f59e0b', '#ef4444', '#94a3b8']

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-slate-700">统计分析</h3>
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">受试者状态分布</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={statusData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label>
                  {statusData.map((_, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
                </Pie>
                <Tooltip /><Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">入组进度</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={[
                { month: '2026-01', screening: 2, enrolled: 1 },
                { month: '2026-02', screening: 5, enrolled: 3 },
                { month: '2026-03', screening: 8, enrolled: 5 },
                { month: '2026-04', screening: 10, enrolled: 7 },
              ]}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip /><Legend />
                <Bar dataKey="screening" name="筛选" fill="#8b5cf6" />
                <Bar dataKey="enrolled" name="入组" fill="#14b8a6" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
