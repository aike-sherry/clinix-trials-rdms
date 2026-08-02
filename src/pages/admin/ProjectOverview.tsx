import { useParams } from 'react-router'
import { useAppStorage } from '@/hooks/useAppStorage'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function ProjectOverview() {
  const { projectId } = useParams<{ projectId: string }>()
  const { projects, patients } = useAppStorage()

  const project = projects.find((p) => p.id === projectId)
  if (!project) return <div>项目不存在</div>

  const projectPatients = patients.filter((p) => p.projectId === project.id)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-slate-500">筛选例数</div>
            <div className="text-2xl font-bold text-slate-800">{projectPatients.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-slate-500">入组例数</div>
            <div className="text-2xl font-bold text-teal-600">
              {projectPatients.filter((p) => p.status !== 'screening').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-slate-500">访视数</div>
            <div className="text-2xl font-bold text-slate-800">{project.visits.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-slate-500">CRF模块</div>
            <div className="text-2xl font-bold text-slate-800">{project.crfModules.length}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">项目基本信息</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
          <div className="flex justify-between border-b border-slate-100 pb-2">
            <span className="text-slate-500">项目编号</span>
            <span className="font-medium">{project.projectNo}</span>
          </div>
          <div className="flex justify-between border-b border-slate-100 pb-2">
            <span className="text-slate-500">项目名称</span>
            <span className="font-medium">{project.name}</span>
          </div>
          <div className="flex justify-between border-b border-slate-100 pb-2">
            <span className="text-slate-500">主要研究者</span>
            <span className="font-medium">{project.principalInvestigator || '-'}</span>
          </div>
          <div className="flex justify-between border-b border-slate-100 pb-2">
            <span className="text-slate-500">研究中心</span>
            <span className="font-medium">{project.researchCenter || '-'}</span>
          </div>
          <div className="flex justify-between border-b border-slate-100 pb-2">
            <span className="text-slate-500">研究科室</span>
            <span className="font-medium">{project.department || '-'}</span>
          </div>
          <div className="flex justify-between border-b border-slate-100 pb-2">
            <span className="text-slate-500">目标入组数</span>
            <span className="font-medium">{project.targetEnrollment || '-'}</span>
          </div>
          <div className="flex justify-between border-b border-slate-100 pb-2">
            <span className="text-slate-500">开始日期</span>
            <span className="font-medium">{project.startDate || '-'}</span>
          </div>
          <div className="flex justify-between border-b border-slate-100 pb-2">
            <span className="text-slate-500">结束日期</span>
            <span className="font-medium">{project.endDate || '-'}</span>
          </div>
          <div className="flex justify-between col-span-2">
            <span className="text-slate-500">项目描述</span>
            <span className="font-medium">{project.description || '-'}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
