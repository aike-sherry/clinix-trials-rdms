import { useMemo } from 'react'
import { useAppStorage } from '@/hooks/useAppStorage'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { BarChart3 } from 'lucide-react'

export default function EntryProgress() {
  const { projects, patients, visitData } = useAppStorage()

  const publishedProjects = projects.filter((p) => p.crfPublished)

  const progressData = useMemo(() => {
    return publishedProjects.map((project) => {
      const projectPatients = patients.filter((p) => p.projectId === project.id)
      const totalModules = project.visits.reduce((sum, v) => sum + v.crfModuleIds.length, 0)
      const totalExpected = projectPatients.length * totalModules
      const completed = visitData.filter(
        (v) => v.projectId === project.id && v.status === 'completed'
      ).length
      const inProgress = visitData.filter(
        (v) => v.projectId === project.id && v.status === 'in_progress'
      ).length
      const progress = totalExpected > 0 ? Math.round((completed / totalExpected) * 100) : 0

      return {
        project,
        patientCount: projectPatients.length,
        totalModules,
        totalExpected,
        completed,
        inProgress,
        progress,
      }
    })
  }, [publishedProjects, patients, visitData])

  const totalStats = useMemo(() => {
    const total = progressData.reduce((sum, p) => sum + p.totalExpected, 0)
    const completed = progressData.reduce((sum, p) => sum + p.completed, 0)
    const inProgress = progressData.reduce((sum, p) => sum + p.inProgress, 0)
    return { total, completed, inProgress, progress: total > 0 ? Math.round((completed / total) * 100) : 0 }
  }, [progressData])

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-amber-600" />
          录入进度
        </h1>
        <p className="text-sm text-slate-400 mt-0.5">查看各项目的数据录入完成情况</p>
      </div>

      {/* 总体进度 */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-sm text-slate-500">总体录入进度</div>
              <div className="text-3xl font-bold text-slate-800">{totalStats.progress}%</div>
            </div>
            <div className="text-right text-sm text-slate-400">
              <div>已完成: {totalStats.completed} / {totalStats.total}</div>
              <div>进行中: {totalStats.inProgress}</div>
            </div>
          </div>
          <Progress value={totalStats.progress} className="h-3" />
        </CardContent>
      </Card>

      {/* 各项目进度 */}
      <div className="grid gap-4">
        {progressData.map((item) => (
          <Card key={item.project.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center justify-between">
                <span>{item.project.name}</span>
                <span className="text-sm font-normal text-slate-400">{item.project.projectNo}</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-slate-500">
                  {item.patientCount} 例患者 × {item.totalModules} 个模块 = {item.totalExpected} 项
                </span>
                <span className="font-medium text-slate-700">{item.progress}%</span>
              </div>
              <Progress value={item.progress} className="h-2" />
              <div className="flex gap-4 mt-3 text-xs text-slate-400">
                <span>已完成: {item.completed}</span>
                <span>进行中: {item.inProgress}</span>
                <span>待录入: {item.totalExpected - item.completed - item.inProgress}</span>
              </div>
            </CardContent>
          </Card>
        ))}
        {progressData.length === 0 && (
          <div className="text-center py-12 text-slate-400 bg-white rounded-lg border border-dashed border-slate-200">
            暂无已发布的项目
          </div>
        )}
      </div>
    </div>
  )
}
