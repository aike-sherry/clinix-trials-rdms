import { useParams } from 'react-router'
import { useAppStorage } from '@/hooks/useAppStorage'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import StatCard from '@/components/StatCard'
import { Info, ClipboardList, UserCheck, CalendarCheck, FileText } from 'lucide-react'

export default function ProjectOverview() {
  const { projectId } = useParams<{ projectId: string }>()
  const { projects, patients } = useAppStorage()

  const project = projects.find((p) => p.id === projectId)
  if (!project) return <div>项目不存在</div>

  const projectPatients = patients.filter((p) => p.projectId === project.id)

  return (
    <div className="space-y-4">
      {/* 统计卡片（全站统一 StatCard） */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="筛选例数" value={projectPatients.length} unit="例" sub="本项目全部受试者" icon={ClipboardList} gradient="from-blue-500 to-blue-600" />
        <StatCard
          label="入组例数" value={projectPatients.filter((p) => p.status === 'enrolled' || p.status === 'treatment' || p.status === 'completed').length} unit="例"
          sub={`入组率 ${projectPatients.length > 0 ? Math.round((projectPatients.filter((p) => p.status === 'enrolled' || p.status === 'treatment' || p.status === 'completed').length / projectPatients.length) * 100) : 0}%`}
          icon={UserCheck} gradient="from-teal-500 to-emerald-600"
        />
        <StatCard label="访视数" value={project.visits.length} unit="次" sub="访视计划配置" icon={CalendarCheck} gradient="from-violet-500 to-purple-600" />
        <StatCard label="CRF模块" value={project.crfModules.length} unit="个" sub="已配置数据模块" icon={FileText} gradient="from-amber-500 to-orange-500" />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2"><Info className="w-4 h-4 text-sky-500" />项目基本信息</CardTitle>
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
