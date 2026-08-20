import { useParams, Link } from 'react-router'
import { useAppStorage } from '@/hooks/useAppStorage'
import StatCard from '@/components/StatCard'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Package, CalendarRange, ListOrdered, FileText, FlaskConical,
} from 'lucide-react'

export default function ProjectModules() {
  const { projectId } = useParams<{ projectId: string }>()
  const { projects } = useAppStorage()

  const project = projects.find((p) => p.id === projectId)
  if (!project) return <div className="text-center py-20 text-slate-500">项目不存在</div>

  const visits = [...project.visits].sort((a, b) => a.order - b.order)
  const modules = project.crfModules
  const fieldTotal = modules.reduce((sum, m) => sum + m.fields.length, 0)
  const assignedIds = new Set(visits.flatMap((v) => v.crfModuleIds))
  const unassigned = modules.filter((m) => !assignedIds.has(m.id))

  const moduleOf = (id: string) => modules.find((m) => m.id === id)

  return (
    <div className="space-y-5">
      {/* 统计卡片（全站统一 StatCard） */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="访视次数" value={visits.length} unit="次" sub="访视计划配置" icon={CalendarRange} gradient="from-blue-500 to-blue-600" />
        <StatCard label="CRF 模块" value={modules.length} unit="个" sub={`待分配 ${unassigned.length} 个`} icon={Package} gradient="from-teal-500 to-emerald-600" />
        <StatCard label="字段总数" value={fieldTotal} unit="个" sub="全部模块字段合计" icon={ListOrdered} gradient="from-purple-500 to-violet-600" />
        <StatCard
          label="CRF 状态" value={project.crfPublished ? '已发布' : '草稿'}
          sub={project.crfPublished ? '已发布供录入使用' : '尚未发布'}
          icon={FileText}
          gradient={project.crfPublished ? 'from-emerald-500 to-green-600' : 'from-amber-500 to-orange-500'}
        />
      </div>

      {/* 操作行 */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-400">
          按访视查看该项目的 CRF 模块配置；如需调整模块内容或组合，请前往 CRF 配置
        </p>
        <Button asChild className="bg-sky-500 hover:bg-sky-600 text-white">
          <Link to={`/admin/projects/${projectId}/crf`}>
            <FlaskConical className="w-4 h-4 mr-1" /> 前往 CRF 配置
          </Link>
        </Button>
      </div>

      {/* 按访视分组的模块清单 */}
      {modules.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-lg border border-dashed border-slate-300">
          <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">该项目尚未配置 CRF 模块</p>
        </div>
      ) : (
        <div className="space-y-4">
          {visits.map((visit) => {
            const visitModules = visit.crfModuleIds
              .map((id) => moduleOf(id))
              .filter(Boolean) as typeof modules
            return (
              <Card key={visit.id} className="bg-white overflow-hidden">
                <CardContent className="p-0">
                  <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-slate-700">{visit.name}</span>
                      <span className="text-xs text-slate-400 font-mono">{visit.code}</span>
                    </div>
                    <Badge variant="outline" className="text-[10px]">
                      {visitModules.length} 个模块
                    </Badge>
                  </div>
                  {visitModules.length === 0 && (
                    <div className="px-4 py-6 text-center text-xs text-slate-400">该访视暂无模块</div>
                  )}
                  {visitModules.map((m, idx) => (
                    <div
                      key={m.id}
                      className={`flex items-center justify-between px-4 py-3 hover:bg-sky-50/40 transition-colors ${
                        idx !== visitModules.length - 1 ? 'border-b border-slate-100' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-xs text-slate-400 font-mono w-6">#{idx + 1}</span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-700 truncate">{m.name}</p>
                          {m.description && (
                            <p className="text-xs text-slate-400 truncate">{m.description}</p>
                          )}
                        </div>
                      </div>
                      <Badge variant="secondary" className="text-[10px] flex-shrink-0">
                        {m.fields.length} 个字段
                      </Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )
          })}

          {/* 未分配访视的模块 */}
          {unassigned.length > 0 && (
            <Card className="bg-white overflow-hidden py-0 gap-0">
              <CardContent className="p-0">
                <div className="px-4 py-3 bg-amber-50/60 border-b border-amber-100 flex items-center justify-between">
                  <span className="font-medium text-sm text-amber-700">未分配访视的模块</span>
                  <Badge variant="outline" className="text-[10px] border-amber-200 text-amber-600">
                    {unassigned.length} 个模块
                  </Badge>
                </div>
                {unassigned.map((m, idx) => (
                  <div
                    key={m.id}
                    className={`flex items-center justify-between px-4 py-3 hover:bg-sky-50/40 transition-colors ${
                      idx !== unassigned.length - 1 ? 'border-b border-slate-100' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-700 truncate">{m.name}</p>
                        {m.description && (
                          <p className="text-xs text-slate-400 truncate">{m.description}</p>
                        )}
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-[10px] flex-shrink-0">
                      {m.fields.length} 个字段
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
