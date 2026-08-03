import { useMemo } from 'react'
import { useAppStorage } from '@/hooks/useAppStorage'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Database } from 'lucide-react'

const STATUS_LABELS: Record<string, string> = {
  not_started: '未开始',
  in_progress: '进行中',
  completed: '已完成',
  locked: '已锁定',
}

const STATUS_COLORS: Record<string, string> = {
  not_started: 'bg-slate-100 text-slate-500',
  in_progress: 'bg-blue-50 text-blue-600',
  completed: 'bg-green-50 text-green-600',
  locked: 'bg-amber-50 text-amber-600',
}

export default function EntryMyData() {
  const { projects, patients, visitData } = useAppStorage()

  const publishedProjects = projects.filter((p) => p.crfPublished)

  const myData = useMemo(() => {
    return visitData
      .filter((v) => publishedProjects.some((p) => p.id === v.projectId))
      .map((v) => {
        const project = projects.find((p) => p.id === v.projectId)
        const patient = patients.find((p) => p.id === v.patientId)
        const visit = project?.visits.find((vst) => vst.id === v.visitId)
        const module = project?.crfModules.find((m) => m.id === v.moduleId)
        return {
          ...v,
          projectName: project?.name || '-',
          projectNo: project?.projectNo || '-',
          patientName: patient?.nameInitials || '-',
          screeningId: patient?.screeningId || '-',
          visitName: visit?.name || '-',
          moduleName: module?.name || '-',
        }
      })
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  }, [visitData, publishedProjects, projects, patients])

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <Database className="w-5 h-5 text-amber-600" />
          我的数据
        </h1>
        <p className="text-sm text-slate-400 mt-0.5">查看已录入的数据记录</p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">录入记录</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-slate-500">项目</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500">患者</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500">访视</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500">模块</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500">状态</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500">更新时间</th>
                </tr>
              </thead>
              <tbody>
                {myData.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-12 text-slate-400">暂无录入数据</td></tr>
                )}
                {myData.map((d) => (
                  <tr key={d.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-700">{d.projectName}</div>
                      <div className="text-xs text-slate-400">{d.projectNo}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-700">{d.patientName}</div>
                      <div className="text-xs text-slate-400">{d.screeningId}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{d.visitName}</td>
                    <td className="px-4 py-3 text-slate-500">{d.moduleName}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={STATUS_COLORS[d.status] || ''}>
                        {STATUS_LABELS[d.status] || d.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">{d.updatedAt.slice(0, 16).replace('T', ' ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
