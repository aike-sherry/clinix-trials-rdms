import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Filter, RotateCcw, ShieldCheck,
  MessageCircleQuestion, ClipboardList,
} from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAppStorage } from '@/hooks/useAppStorage'
import type { CRFModule, DataQuery, Patient, Project, VisitData } from '@/types'
import { PATIENT_STATUS_LABELS, cellText } from './dataMgmt/shared'
import ProgressOverview from '@/components/dataMgmt/ProgressOverview'
import ProjectMatrix from '@/components/dataMgmt/ProjectMatrix'

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100]

function genId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

const QUERY_STATUS: Record<DataQuery['status'], { label: string; color: string }> = {
  open: { label: '待回复', color: 'bg-orange-50 text-orange-600 border-orange-200' },
  answered: { label: '已回复', color: 'bg-blue-50 text-blue-600 border-blue-200' },
  closed: { label: '已关闭', color: 'bg-slate-100 text-slate-500 border-slate-200' },
}

// ==================== 患者详情（行展开） ====================

function PatientVisitDetail({
  patient,
  project,
  visitData,
  saveVisitData,
  reviewerName,
  queries,
  saveQuery,
  userId,
}: {
  patient: Patient
  project: Project
  visitData: VisitData[]
  saveVisitData: (vd: VisitData) => void
  reviewerName: string
  queries: DataQuery[]
  saveQuery: (q: DataQuery) => void
  userId: string
}) {
  const sortedVisits = [...project.visits].sort((a, b) => a.order - b.order)

  // 数据确认：管理人员对已完成模块逐条确认（修改数据后确认自动作废，由录入端保存逻辑保证）
  const review = (rec: VisitData) =>
    saveVisitData({ ...rec, reviewedAt: new Date().toISOString(), reviewedBy: reviewerName })
  const unreview = (rec: VisitData) => {
    const { reviewedAt: _ra, reviewedBy: _rb, ...rest } = rec
    saveVisitData(rest)
  }

  // ========== 数据疑问 ==========
  const [queryTarget, setQueryTarget] = useState<{ rec: VisitData; module: CRFModule } | null>(null)
  const [queryFieldName, setQueryFieldName] = useState('') // '' = 针对整条记录
  const [queryContent, setQueryContent] = useState('')

  const queriesOf = (recId: string) =>
    queries
      .filter((q) => q.visitDataId === recId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const openQueryCount = (recId: string) =>
    queries.filter((q) => q.visitDataId === recId && q.status === 'open').length

  const openQueryDialog = (rec: VisitData, module: CRFModule) => {
    setQueryTarget({ rec, module })
    setQueryFieldName('')
    setQueryContent('')
  }

  const submitQuery = () => {
    if (!queryTarget || !queryContent.trim()) return
    const field = queryTarget.module.fields.find((f) => f.name === queryFieldName)
    saveQuery({
      id: genId(),
      visitDataId: queryTarget.rec.id,
      patientId: patient.id,
      projectId: project.id,
      visitId: queryTarget.rec.visitId,
      moduleId: queryTarget.rec.moduleId,
      fieldName: field?.name,
      fieldLabel: field?.label,
      content: queryContent.trim(),
      status: 'open',
      createdBy: userId,
      createdByName: reviewerName,
      createdAt: new Date().toISOString(),
    })
    setQueryTarget(null)
  }

  const closeQuery = (q: DataQuery) =>
    saveQuery({ ...q, status: 'closed', closedBy: reviewerName, closedAt: new Date().toISOString() })

  return (
    <div className="space-y-3">
      {sortedVisits.map((v) => {
        const modules = project.crfModules.filter((m) => v.crfModuleIds.includes(m.id))
        if (modules.length === 0) return null
        const visitRecs = modules
          .map((m) =>
            visitData.find(
              (vd) => vd.patientId === patient.id && vd.visitId === v.id && vd.moduleId === m.id,
            ),
          )
          .filter((r): r is VisitData => !!r)
        const completedRecs = visitRecs.filter((r) => r.status === 'completed')
        const unreviewedRecs = completedRecs.filter((r) => !r.reviewedAt)
        return (
          <div key={v.id} className="border border-slate-200 rounded-lg overflow-hidden">
            <div className="px-3 py-2 bg-white border-b border-slate-100 flex items-center gap-2">
              <span className="text-xs font-semibold text-sky-600 bg-sky-50 px-2 py-0.5 rounded">{v.code}</span>
              <span className="text-sm font-medium text-slate-700">{v.name}</span>
              {completedRecs.length > 0 && (
                unreviewedRecs.length > 0 ? (
                  <button
                    type="button"
                    className="ml-auto text-[10px] px-2 py-0.5 rounded-full border border-teal-200 text-teal-600 hover:bg-teal-50 flex items-center gap-1"
                    onClick={() => unreviewedRecs.forEach(review)}
                  >
                    <ShieldCheck className="w-3 h-3" /> 确认本访视（{unreviewedRecs.length} 项）
                  </button>
                ) : (
                  <span className="ml-auto text-[10px] text-teal-500 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" /> 本访视已全部确认
                  </span>
                )
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-slate-100">
              {modules.map((m) => {
                const rec = visitData.find(
                  (vd) => vd.patientId === patient.id && vd.visitId === v.id && vd.moduleId === m.id,
                )
                return (
                  <div key={m.id} className="bg-white px-3 py-2.5">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-medium text-slate-600">{m.name}</span>
                      <span className="flex items-center gap-1.5">
                        {rec?.status === 'completed' && (
                          <button
                            type="button"
                            className="text-[10px] px-1.5 py-0.5 rounded-full border border-orange-200 text-orange-600 hover:bg-orange-50 flex items-center gap-0.5"
                            title="对该模块数据发起疑问"
                            onClick={() => openQueryDialog(rec, m)}
                          >
                            <MessageCircleQuestion className="w-3 h-3" />
                            疑问{openQueryCount(rec.id) > 0 ? ` ${openQueryCount(rec.id)}` : ''}
                          </button>
                        )}
                        {rec?.status === 'completed' && (
                          rec.reviewedAt ? (
                            <>
                              <span
                                className="text-[10px] px-1.5 py-0.5 rounded-full bg-teal-50 text-teal-600 flex items-center gap-0.5"
                                title={`${rec.reviewedBy ?? ''} · ${rec.reviewedAt.slice(0, 10)}`}
                              >
                                <ShieldCheck className="w-3 h-3" /> 已确认
                              </span>
                              <button
                                type="button"
                                className="text-[10px] text-slate-300 hover:text-slate-500"
                                onClick={() => unreview(rec)}
                              >
                                撤销
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              className="text-[10px] px-1.5 py-0.5 rounded-full border border-teal-200 text-teal-600 hover:bg-teal-50 flex items-center gap-0.5"
                              onClick={() => review(rec)}
                            >
                              <ShieldCheck className="w-3 h-3" /> 确认
                            </button>
                          )
                        )}
                        {rec ? (
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                              rec.status === 'completed'
                                ? 'bg-teal-50 text-teal-600'
                                : 'bg-amber-50 text-amber-600'
                            }`}
                          >
                            {rec.status === 'completed' ? '已完成' : '录入中'}
                          </span>
                        ) : (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-400">未录入</span>
                        )}
                      </span>
                    </div>
                    {rec ? (
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                        {m.fields
                          .filter((f) => f.type !== 'label')
                          .map((f) => {
                            const text = cellText(f, rec.data[f.name])
                            return (
                              <div key={f.id} className="text-xs flex gap-1.5 min-w-0">
                                <span className="text-slate-400 shrink-0">{f.label}:</span>
                                <span className={text === '—' ? 'text-slate-300' : 'text-slate-700 truncate'} title={text}>
                                  {text}
                                </span>
                              </div>
                            )
                          })}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-300">该模块暂无数据</p>
                    )}
                    {/* 该模块的数据疑问列表 */}
                    {rec && queriesOf(rec.id).length > 0 && (
                      <div className="mt-2 pt-2 border-t border-dashed border-slate-100 space-y-1.5">
                        {queriesOf(rec.id).map((q) => (
                          <div key={q.id} className="rounded-md bg-orange-50/50 border border-orange-100 px-2 py-1.5">
                            <div className="flex items-center gap-1.5">
                              <MessageCircleQuestion className="w-3 h-3 text-orange-500 shrink-0" />
                              <span className="text-[11px] text-slate-700 flex-1 min-w-0">
                                {q.fieldLabel && <span className="text-orange-500 mr-1">[{q.fieldLabel}]</span>}
                                {q.content}
                              </span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full border shrink-0 ${QUERY_STATUS[q.status].color}`}>
                                {QUERY_STATUS[q.status].label}
                              </span>
                              {q.status !== 'closed' && (
                                <button
                                  type="button"
                                  className="text-[10px] text-slate-400 hover:text-teal-600 shrink-0"
                                  title="确认回复无误，关闭疑问"
                                  onClick={() => closeQuery(q)}
                                >
                                  关闭
                                </button>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5 pl-4">
                              {q.createdByName} · {q.createdAt.slice(0, 10)}
                            </div>
                            {q.answer && (
                              <div className="text-[11px] text-slate-600 mt-1 pl-4 border-l-2 border-blue-200 ml-0.5">
                                回复：{q.answer}
                                <span className="text-[10px] text-slate-400 ml-1.5">{q.answeredAt?.slice(0, 10)}</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
      {sortedVisits.every((v) => project.crfModules.filter((m) => v.crfModuleIds.includes(m.id)).length === 0) && (
        <p className="text-sm text-slate-400 text-center py-4">该项目尚未配置访视模块</p>
      )}

      {/* 发起疑问弹窗 */}
      <Dialog open={!!queryTarget} onOpenChange={(open) => { if (!open) setQueryTarget(null) }}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>发起数据疑问</DialogTitle>
          </DialogHeader>
          {queryTarget && (
            <div className="space-y-4 py-2">
              <div className="text-xs text-slate-500 bg-slate-50 rounded-md px-3 py-2">
                {patient.nameInitials}（{patient.screeningId || patient.screeningNo}） · {queryTarget.module.name}
              </div>
              <div>
                <Label className="text-sm">针对字段</Label>
                <Select value={queryFieldName || 'all'} onValueChange={(v) => setQueryFieldName(v === 'all' ? '' : v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">整条记录（不针对具体字段）</SelectItem>
                    {queryTarget.module.fields
                      .filter((f) => f.type !== 'label')
                      .map((f) => (
                        <SelectItem key={f.id} value={f.name}>{f.label}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm">疑问内容 <span className="text-red-500">*</span></Label>
                <Input
                  placeholder="请描述数据疑点，如：数值与上次访视差异较大"
                  value={queryContent}
                  onChange={(e) => setQueryContent(e.target.value)}
                />
              </div>
              <p className="text-[11px] text-slate-400">
                发起后，数据录入人员将在录入页看到该疑问并回复；您确认回复无误后可关闭。
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setQueryTarget(null)}>取消</Button>
            <Button
              className="bg-orange-500 hover:bg-orange-600 text-white"
              disabled={!queryContent.trim()}
              onClick={submitQuery}
            >
              发起疑问
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ==================== 数据管理（数据矩阵） ====================

function DataMatrixView() {
  const { projects, patients, visitData, saveVisitData, queries, saveQuery, currentUser } = useAppStorage()
  const reviewerName = currentUser?.name ?? '管理人员'
  const userId = currentUser?.id ?? 'manager'
  const [searchParams, setSearchParams] = useSearchParams()

  // 研究编号与顶栏 URL 参数联动；矩阵始终聚焦单个研究，
  // 顶栏为「全部研究」时自动定位到第一个已配置 CRF 模块的研究
  const projectNoParam = searchParams.get('projectNo') || ''
  const activeProject = projects.find((p) => p.projectNo === projectNoParam)
  const displayProject = useMemo(
    () => activeProject ?? projects.find((p) => p.crfModules.length > 0) ?? projects[0],
    [activeProject, projects],
  )

  // ---------- 定位条件 ----------
  const [centerName, setCenterName] = useState('all')
  const [status, setStatus] = useState('all')
  const [visitId, setVisitId] = useState('all')
  const [moduleId, setModuleId] = useState('all')

  const resetAll = () => {
    setCenterName('all')
    setStatus('all')
    setVisitId('all')
    setModuleId('all')
  }

  const setProjectNo = (value: string) => {
    const newParams = new URLSearchParams(searchParams)
    if (value !== 'all') newParams.set('projectNo', value)
    else newParams.delete('projectNo')
    setSearchParams(newParams)
    resetAll()
  }

  // 中心名称
  const centerNameOf = (p: Patient) =>
    projects.find((x) => x.id === p.projectId)?.centers?.find((c) => c.id === p.centerId)?.name ?? ''
  const centerOptions = useMemo(() => {
    const names = new Set<string>()
    for (const c of displayProject?.centers ?? []) names.add(c.name)
    return [...names]
  }, [displayProject])

  const patientsInScope = useMemo(
    () =>
      displayProject
        ? patients.filter((p) => {
            if (p.projectId !== displayProject.id) return false
            if (centerName !== 'all' && centerNameOf(p) !== centerName) return false
            if (status !== 'all' && p.status !== status) return false
            return true
          })
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [displayProject, patients, centerName, status],
  )
  const totalInScope = displayProject
    ? patients.filter((p) => p.projectId === displayProject.id).length
    : 0

  // 定位栏的访视/模块选项（模块随访视联动）
  const sortedVisits = useMemo(
    () => (displayProject ? [...displayProject.visits].sort((a, b) => a.order - b.order) : []),
    [displayProject],
  )
  const moduleOptions = useMemo(() => {
    if (!displayProject) return []
    if (visitId === 'all') return displayProject.crfModules
    const visit = displayProject.visits.find((v) => v.id === visitId)
    if (!visit) return displayProject.crfModules
    return displayProject.crfModules.filter((m) => visit.crfModuleIds.includes(m.id))
  }, [displayProject, visitId])
  const activeModule = moduleOptions.find((m) => m.id === moduleId) ?? moduleOptions[0]

  // ==================== 渲染 ====================

  if (!displayProject) {
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

            {/* 研究编号：与顶栏联动；「全部研究」时矩阵自动定位到第一个已配置 CRF 的研究 */}
            <Select value={activeProject ? activeProject.projectNo : 'all'} onValueChange={setProjectNo}>
              <SelectTrigger className="w-40 bg-slate-50 border-slate-200">
                <SelectValue placeholder="研究编号" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部研究</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.projectNo}>{p.projectNo}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {centerOptions.length > 0 && (
              <Select value={centerName} onValueChange={setCenterName}>
                <SelectTrigger className="w-44 bg-slate-50 border-slate-200">
                  <SelectValue placeholder="中心" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部中心</SelectItem>
                  {centerOptions.map((n) => (
                    <SelectItem key={n} value={n}>{n}</SelectItem>
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
                <SelectValue placeholder="访视信息（模块）" />
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

      {/* ================= 数据矩阵（始终聚焦单个研究） ================= */}
      <ProjectMatrix
        project={displayProject}
        patientsInProject={patientsInScope}
        totalInProject={totalInScope}
        visitData={visitData}
        pageSizeKey="crf_pagesize_manager_datareview"
        exportTag={displayProject.projectNo}
        patientHomeLink={(p) => `/manager/review/${p.id}`}
        renderExpandedDetail={(p) => (
          <>
            <div className="flex justify-end mb-2">
              <Button size="sm" variant="outline" className="h-7 text-xs" asChild>
                <Link to={`/manager/review/${p.id}`}>
                  <ClipboardList className="w-3.5 h-3.5 mr-1" /> 前往审核详情页
                </Link>
              </Button>
            </div>
            <PatientVisitDetail
              patient={p}
              project={displayProject}
              visitData={visitData}
              saveVisitData={saveVisitData}
              reviewerName={reviewerName}
              queries={queries}
              saveQuery={saveQuery}
              userId={userId}
            />
          </>
        )}
        visitId={visitId}
        moduleId={moduleId}
        onLocatorsChange={(next: { visitId?: string; moduleId?: string }) => {
          if (next.visitId !== undefined) setVisitId(next.visitId)
          if (next.moduleId !== undefined) setModuleId(next.moduleId)
        }}
      />
    </div>
  )
}

// ==================== 数据管理（进度总览 | 数据矩阵） ====================

export default function ManagerDataReview() {
  // Tab 切换器已上移至标题行（与录入端一致），通过 URL 参数驱动
  const [searchParams] = useSearchParams()
  const tab = searchParams.get('tab') === 'matrix' ? 'matrix' : 'progress'

  return (
    <div className="space-y-4">
      {tab === 'progress' ? <ProgressOverview role="manager" /> : <DataMatrixView />}
    </div>
  )
}
