import { useMemo } from 'react'
import { Link } from 'react-router'
import { useAppStorage } from '@/hooks/useAppStorage'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ClipboardList, Users, CheckCircle, Clock } from 'lucide-react'

export default function EntryHome() {
  const { projects, patients, visitData } = useAppStorage()

  const currentUser = useMemo(() => {
    try {
      const raw = localStorage.getItem('clini_x_rdms_data')
      if (raw) return JSON.parse(raw).currentUser
    } catch { /* ignore */ }
    return null
  }, [])

  const myProjects = projects.filter((p) => p.crfPublished)
  const myPatients = patients.filter((p) => myProjects.some((proj) => proj.id === p.projectId))
  const myVisitData = visitData.filter((v) => myPatients.some((p) => p.id === v.patientId))

  const stats = {
    totalProjects: myProjects.length,
    totalPatients: myPatients.length,
    completedVisits: myVisitData.filter((v) => v.status === 'completed').length,
    pendingVisits: myVisitData.filter((v) => v.status === 'not_started' || v.status === 'in_progress').length,
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-800">数据录入工作台</h1>
        <p className="text-sm text-slate-400 mt-0.5">欢迎回来，{currentUser?.name || '录入员'}</p>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
              <ClipboardList className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <div className="text-sm text-slate-500">参与项目</div>
              <div className="text-2xl font-bold text-slate-800">{stats.totalProjects}</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
              <Users className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <div className="text-sm text-slate-500">登记患者</div>
              <div className="text-2xl font-bold text-slate-800">{stats.totalPatients}</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-teal-600" />
            </div>
            <div>
              <div className="text-sm text-slate-500">已完成访视</div>
              <div className="text-2xl font-bold text-slate-800">{stats.completedVisits}</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center">
              <Clock className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <div className="text-sm text-slate-500">待录入访视</div>
              <div className="text-2xl font-bold text-slate-800">{stats.pendingVisits}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 快捷操作 */}
      <div className="flex gap-3">
        <Button className="bg-amber-500 hover:bg-amber-600" asChild>
          <Link to="/entry/patients"><Users className="w-4 h-4 mr-1" /> 患者登记</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link to="/entry/data-entry"><ClipboardList className="w-4 h-4 mr-1" /> 数据录入</Link>
        </Button>
      </div>

      {/* 项目列表 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">我的项目</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {myProjects.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-6">暂无分配的项目</p>
            )}
            {myProjects.map((project) => {
              const projectPatients = patients.filter((p) => p.projectId === project.id)
              return (
                <div key={project.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-100 hover:bg-slate-50 transition-colors">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-slate-800">{project.name}</span>
                      <Badge variant="outline" className="text-[10px] h-4">
                        {project.projectNo}
                      </Badge>
                      {project.crfPublished && (
                        <Badge variant="outline" className="text-[10px] h-4 bg-green-50 text-green-600 border-green-200">
                          已发布
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {project.researchCenter} · PI: {project.principalInvestigator}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-slate-500">{projectPatients.length} 例患者</div>
                    <div className="text-xs text-slate-400">{project.visits.length} 个访视</div>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
