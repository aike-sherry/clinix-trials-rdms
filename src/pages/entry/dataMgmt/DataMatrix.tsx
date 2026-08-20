import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Filter, RotateCcw, ClipboardEdit } from 'lucide-react'
import { useAppStorage } from '@/hooks/useAppStorage'
import type { Project } from '@/types'
import { PATIENT_STATUS_LABELS } from '@/pages/manager/dataMgmt/shared'
import ProjectMatrix from '@/components/dataMgmt/ProjectMatrix'

/** 数据管理 · 数据矩阵（录入端：只读矩阵 + 去录入直达；矩阵本体与管理端共用 ProjectMatrix） */
export default function EntryDataMatrix() {
  const { projects, patients, visitData } = useAppStorage()
  const [searchParams] = useSearchParams()

  // 项目由顶栏筛选框通过 URL 参数驱动；全部研究时回落到第一个已设计 CRF 的项目
  const projectNoParam = searchParams.get('projectNo') || ''
  const project: Project | undefined =
    projects.find((p) => p.projectNo === projectNoParam)
    ?? projects.find((p) => p.crfModules.length > 0)
    ?? projects[0]

  // ---------- 定位条件（受控传入矩阵） ----------
  const [centerId, setCenterId] = useState('all')
  const [status, setStatus] = useState('all')
  const [visitId, setVisitId] = useState('all')
  const [moduleId, setModuleId] = useState('all')

  const centers = project?.centers ?? []
  const sortedVisits = useMemo(
    () => (project ? [...project.visits].sort((a, b) => a.order - b.order) : []),
    [project],
  )

  // 模块选项随访视联动：选择某次访视时只能选该访视中的模块
  const moduleOptions = useMemo(() => {
    if (!project) return []
    if (visitId === 'all') return project.crfModules
    const visit = project.visits.find((v) => v.id === visitId)
    if (!visit) return project.crfModules
    return project.crfModules.filter((m) => visit.crfModuleIds.includes(m.id))
  }, [project, visitId])

  // 当前生效模块：所选不在可选范围时回落到第一个
  const activeModule = useMemo(
    () => moduleOptions.find((m) => m.id === moduleId) ?? moduleOptions[0],
    [moduleOptions, moduleId],
  )

  // ---------- 患者过滤（中心/状态；「仅显示已录入」由矩阵内部按同一口径处理） ----------
  const filtered = useMemo(() => {
    if (!project) return []
    return patients.filter((p) => {
      if (p.projectId !== project.id) return false
      if (centerId !== 'all' && p.centerId !== centerId) return false
      if (status !== 'all' && p.status !== status) return false
      return true
    })
  }, [project, patients, centerId, status])

  const totalInScope = useMemo(
    () => (project ? patients.filter((p) => p.projectId === project.id).length : 0),
    [patients, project],
  )

  const resetAll = () => {
    setCenterId('all')
    setStatus('all')
    setVisitId('all')
    setModuleId('all')
  }

  // ==================== 渲染 ====================

  if (!project) {
    return <div className="text-center py-20 text-slate-400">暂无项目数据</div>
  }

  return (
    <div className="space-y-4">
      {/* ================= 数据定位（标题与全部定位条件同一行） ================= */}
      <Card>
        <CardContent className="py-3">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 shrink-0">
              <Filter className="w-4 h-4 text-sky-500" />
              <span className="text-sm font-semibold text-slate-700">数据定位</span>
            </div>
            <div className="w-px h-6 bg-slate-200 shrink-0" />
            {centers.length > 0 && (
              <Select value={centerId} onValueChange={setCenterId}>
                <SelectTrigger className="w-44 bg-slate-50 border-slate-200">
                  <SelectValue placeholder="中心" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部中心</SelectItem>
                  {centers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-36 bg-slate-50 border-slate-200">
                <SelectValue placeholder="患者状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                {Object.entries(PATIENT_STATUS_LABELS).map(([v, l]) => (
                  <SelectItem key={v} value={v}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={visitId} onValueChange={setVisitId}>
              <SelectTrigger className="w-44 bg-slate-50 border-slate-200">
                <SelectValue placeholder="访视" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部访视</SelectItem>
                {sortedVisits.map((v) => (
                  <SelectItem key={v.id} value={v.id}>{v.code} · {v.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={activeModule?.id ?? 'all'} onValueChange={setModuleId}>
              <SelectTrigger className="w-44 bg-slate-50 border-slate-200">
                <SelectValue placeholder="模块" />
              </SelectTrigger>
              <SelectContent>
                {moduleOptions.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button variant="ghost" size="sm" className="text-slate-400 hover:text-slate-600" onClick={resetAll}>
              <RotateCcw className="w-3.5 h-3.5 mr-1" />
              重置
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ================= 数据矩阵（与管理端共用组件） ================= */}
      <ProjectMatrix
        project={project}
        patientsInProject={filtered}
        totalInProject={totalInScope}
        visitData={visitData}
        pageSizeKey="crf_pagesize_entry_datamatrix"
        exportTag={project.projectNo}
        visitId={visitId}
        moduleId={moduleId}
        onLocatorsChange={(next) => {
          if (next.visitId !== undefined) setVisitId(next.visitId)
          if (next.moduleId !== undefined) setModuleId(next.moduleId)
        }}
        rowAction={(p, ctx) => {
          // 「去录入」直达：定位到当前筛选的访视（全部访视时取第一个涉及访视）与模块
          const params = new URLSearchParams()
          if (ctx.visitId) params.set('visitId', ctx.visitId)
          if (ctx.moduleId) params.set('moduleId', ctx.moduleId)
          const s = params.toString()
          return (
            <Button size="sm" variant="outline" className="h-6 px-2 text-[11px]" asChild>
              <Link to={`/entry/patients/${p.id}${s ? `?${s}` : ''}`}>
                <ClipboardEdit className="w-3 h-3 mr-1" /> 去录入
              </Link>
            </Button>
          )
        }}
      />
    </div>
  )
}
