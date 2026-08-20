import { useEffect, useMemo, useState } from 'react'
import { useParams, Link, useLocation, useSearchParams } from 'react-router'
import { useAppStorage } from '@/hooks/useAppStorage'
import type { AuditLog, CRFModule, DataQuery, Visit, VisitData, VisitDataStatus } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import CRFFormRenderer from '@/components/CRFFormRenderer'
import { FillSourceBadge } from '@/components/SmartFill'
import {
  ArrowLeft, MapPin, User, Calendar,
  CircleDashed, Loader, CheckCircle2, Lock,
  ChevronDown, ChevronRight, FileText,
  PenLine, BadgeCheck, MessageCircleQuestion, ClipboardCheck, ListTree, ShieldCheck,
  History,
} from 'lucide-react'

function now() {
  return new Date().toISOString()
}

function genId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

/** 时间格式：2026-08-06 09:30 */
function fmtTime(iso: string) {
  return iso.slice(0, 16).replace('T', ' ')
}

const AUDIT_ACTION_LABELS: Record<AuditLog['action'], string> = {
  create: '录入',
  update: '更新',
  delete: '删除',
}

const VD_STATUS: Record<VisitDataStatus, { label: string; color: string; icon: typeof CircleDashed }> = {
  not_started: { label: '未开始', color: 'bg-slate-100 text-slate-400', icon: CircleDashed },
  in_progress: { label: '进行中', color: 'bg-blue-50 text-blue-600', icon: Loader },
  completed: { label: '已完成', color: 'bg-teal-50 text-teal-600', icon: CheckCircle2 },
  locked: { label: '已锁定', color: 'bg-amber-50 text-amber-600', icon: Lock },
}

const PATIENT_STATUS_LABELS: Record<string, string> = {
  screening: '筛选中', enrolled: '已入组', treatment: '治疗期',
  completed: '已完成', withdrawn: '已退出', lost: '失访',
}

// 患者切换栏状态点颜色
const PATIENT_DOT: Record<string, string> = {
  screening: 'bg-sky-400', enrolled: 'bg-blue-400', treatment: 'bg-amber-400',
  completed: 'bg-teal-500', withdrawn: 'bg-red-400', lost: 'bg-slate-300',
}

export default function ReviewDetail() {
  const { patientId } = useParams()
  const location = useLocation()
  // 双端共用：/entry/review 与 /manager/review
  const base = location.pathname.startsWith('/manager') ? '/manager/review' : '/entry/review'
  const { projects, patients, visitData, saveVisitData, queries, saveQuery, currentUser, users, auditLogs } = useAppStorage()
  const reviewerName = currentUser?.name ?? '管理人员'

  // 用户 id → 姓名（历史记录中录入人等 id 的展示）
  const userNameOf = useMemo(() => {
    const map = new Map(users.map((u) => [u.id, u.name]))
    return (idOrName?: string) => (idOrName ? map.get(idOrName) ?? idOrName : '-')
  }, [users])

  const patient = patients.find((p) => p.id === patientId)
  const project = patient ? projects.find((p) => p.id === patient.projectId) : undefined
  const sortedVisits = useMemo(
    () => (project ? [...project.visits].sort((a, b) => a.order - b.order) : []),
    [project],
  )

  const [searchParams] = useSearchParams()
  // 支持 URL visitId / moduleId 定位（从访视矩阵格子或质疑列表跳入时直接落到对应访视与模块）
  const visitParam = searchParams.get('visitId')
  const moduleParam = searchParams.get('moduleId')
  const defaultVisit =
    sortedVisits.find((v) => v.id === visitParam)
    ?? sortedVisits.find((v) => v.code === patient?.currentVisit)
    ?? sortedVisits[0]
  const [visitId, setVisitId] = useState<string>(defaultVisit?.id ?? '')
  const [activeModuleId, setActiveModuleId] = useState<string>('')
  const [savedTip, setSavedTip] = useState('')
  const [expandedVisitIds, setExpandedVisitIds] = useState<string[]>(
    defaultVisit ? [defaultVisit.id] : [],
  )

  // 本研究全部患者（切换栏用）
  const switchProjectNo = searchParams.get('projectNo') || 'all'
  const projectPatients = useMemo(() => {
    const publishedIds = new Set(projects.filter((x) => x.crfPublished).map((x) => x.id))
    return patients
      .filter((p) => {
        if (!publishedIds.has(p.projectId)) return false
        if (switchProjectNo === 'all') return true
        return projects.find((x) => x.id === p.projectId)?.projectNo === switchProjectNo
      })
      .sort((a, b) => {
        const pa = projects.find((x) => x.id === a.projectId)?.projectNo ?? ''
        const pb = projects.find((x) => x.id === b.projectId)?.projectNo ?? ''
        return pa.localeCompare(pb) || a.screeningNo.localeCompare(b.screeningNo)
      })
  }, [patients, projects, switchProjectNo])

  const [patientFilter, setPatientFilter] = useState('')
  const filteredPatients = useMemo(() => {
    const kw = patientFilter.trim().toLowerCase()
    if (!kw) return projectPatients
    return projectPatients.filter(
      (p) => p.screeningId.toLowerCase().includes(kw) || p.nameInitials.toLowerCase().includes(kw),
    )
  }, [projectPatients, patientFilter])

  // 切换患者（或 URL 指定访视）时重置选中访视
  useEffect(() => {
    document.getElementById(`rswitch-${patientId}`)?.scrollIntoView({ block: 'center' })
    const dv =
      sortedVisits.find((v) => v.id === visitParam)
      ?? sortedVisits.find((v) => v.code === patient?.currentVisit)
      ?? sortedVisits[0]
    if (dv) {
      setVisitId(dv.id)
      setExpandedVisitIds([dv.id])
    }
    // 深链模块：仅当该模块属于目标访视时自动打开
    const dvModules =
      project && dv ? project.crfModules.filter((m) => dv.crfModuleIds.includes(m.id)) : []
    setActiveModuleId(
      moduleParam && dvModules.some((m) => m.id === moduleParam) ? moduleParam : '',
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId, visitParam, moduleParam])

  const visit: Visit | undefined = sortedVisits.find((v) => v.id === visitId) ?? defaultVisit
  const modules: CRFModule[] = useMemo(() => {
    if (!project || !visit) return []
    return project.crfModules.filter((m) => visit.crfModuleIds.includes(m.id))
  }, [project, visit])

  const recordOf = (moduleId: string, vid?: string): VisitData | undefined =>
    visitData.find((vd) => vd.patientId === patientId && vd.visitId === (vid ?? visit?.id) && vd.moduleId === moduleId)

  const activeModule = modules.find((m) => m.id === activeModuleId)
  const activeRecord = activeModule ? recordOf(activeModule.id) : undefined

  // ========== 数据质疑（Query） ==========
  const [queryDialogOpen, setQueryDialogOpen] = useState(false)
  const [queryFieldName, setQueryFieldName] = useState('') // '' = 针对整条记录
  const [queryContent, setQueryContent] = useState('')

  const openQueryDialog = () => {
    setQueryFieldName('')
    setQueryContent('')
    setQueryDialogOpen(true)
  }

  const submitQuery = () => {
    if (!activeRecord || !activeModule || !visit || !patient || !project || !queryContent.trim()) return
    const field = activeModule.fields.find((f) => f.name === queryFieldName)
    saveQuery({
      id: genId(),
      visitDataId: activeRecord.id,
      patientId: patient.id,
      projectId: project.id,
      visitId: visit.id,
      moduleId: activeModule.id,
      fieldName: field?.name,
      fieldLabel: field?.label,
      content: queryContent.trim(),
      status: 'open',
      createdBy: currentUser?.id ?? 'manager',
      createdByName: reviewerName,
      createdAt: now(),
    })
    setQueryDialogOpen(false)
    tip('质疑已发出，等待录入人员回复')
  }

  // ========== 操作历史（审计轨迹） ==========
  const [historyOpen, setHistoryOpen] = useState(false)
  type HistoryItem = { time: string; user: string; action: string; summary: string; changes?: AuditLog['changes'] }
  const historyItems = useMemo<HistoryItem[]>(() => {
    if (!activeRecord) return []
    const items: HistoryItem[] = []
    // 审计日志中的更新记录（entityId 兼容记录 id 与 患者|访视|模块 复合键两种写法）
    const compositeId = `${activeRecord.patientId}|${activeRecord.visitId}|${activeRecord.moduleId}`
    auditLogs
      .filter((l) => l.entityType === 'visitData' && (l.entityId === activeRecord.id || l.entityId === compositeId))
      .forEach((l) =>
        items.push({
          time: l.timestamp,
          user: l.userName,
          action: AUDIT_ACTION_LABELS[l.action] ?? l.action,
          summary: l.summary,
          changes: l.changes,
        }),
      )
    // 记录自身的关键节点（种子数据无审计日志时也能看到轨迹）
    if (activeRecord.reviewedAt)
      items.push({ time: activeRecord.reviewedAt, user: userNameOf(activeRecord.reviewedBy), action: '审核', summary: '审核确认该模块数据' })
    if (activeRecord.signedAt)
      items.push({ time: activeRecord.signedAt, user: userNameOf(activeRecord.signedBy), action: '签署', summary: '签署确认该模块数据' })
    items.push({ time: activeRecord.createdAt, user: userNameOf(activeRecord.createdBy), action: '录入', summary: '首次录入该模块数据' })
    // 去重（审计日志已含录入时以日志为准）+ 按时间倒序
    const seen = new Set<string>()
    return items
      .sort((a, b) => b.time.localeCompare(a.time))
      .filter((i) => {
        const key = `${i.time}|${i.action}|${i.user}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
  }, [activeRecord, auditLogs, userNameOf])

  const queriesOf = (recId?: string) =>
    recId ? queries.filter((q) => q.visitDataId === recId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) : []

  // 访视完成度 / 审核度
  const visitProgress = (v: Visit) => {
    const mods = project?.crfModules.filter((m) => v.crfModuleIds.includes(m.id)) ?? []
    const done = mods.filter((m) =>
      visitData.some(
        (vd) => vd.patientId === patientId && vd.visitId === v.id && vd.moduleId === m.id && vd.status === 'completed',
      ),
    ).length
    return { done, total: mods.length }
  }

  const openModule = (moduleId: string, vid?: string) => {
    if (vid && vid !== visitId) setVisitId(vid)
    setActiveModuleId(moduleId)
    setSavedTip('')
  }

  const toggleVisitExpand = (v: Visit) => {
    setExpandedVisitIds((prev) =>
      prev.includes(v.id) ? prev.filter((id) => id !== v.id) : [...prev, v.id],
    )
  }

  const tip = (text: string) => {
    setSavedTip(text)
    setTimeout(() => setSavedTip(''), 2500)
  }

  // ========== 审核操作 ==========
  const reviewRecord = (rec: VisitData) => {
    saveVisitData({ ...rec, reviewedAt: now(), reviewedBy: reviewerName })
    tip(`已由 ${reviewerName} 审核确认`)
  }

  const unreviewRecord = (rec: VisitData) => {
    if (!confirm('确定取消该模块数据的审核确认？')) return
    const { reviewedAt: _ra, reviewedBy: _rb, ...rest } = rec
    saveVisitData(rest)
    tip('已取消审核，可重新确认')
  }

  // ========== 签署操作（管理人员）：需先审核确认；签署后数据再变动会自动作废 ==========
  const signRecord = (rec: VisitData) => {
    saveVisitData({ ...rec, signedAt: now(), signedBy: reviewerName })
    tip(`已由 ${reviewerName} 签署确认`)
  }

  const unsignRecord = (rec: VisitData) => {
    if (!confirm('确定撤销该模块数据的签署？')) return
    const { signedAt: _sa, signedBy: _sb, ...rest } = rec
    saveVisitData(rest)
    tip('已撤销签署，可重新签署')
  }

  // 一键签署当前访视全部「已完成、已审核且未签署」的模块
  const signAllInVisit = () => {
    if (!visit) return
    let count = 0
    modules.forEach((m) => {
      const rec = recordOf(m.id)
      if (rec?.status === 'completed' && rec.reviewedAt && !rec.signedAt) {
        saveVisitData({ ...rec, signedAt: now(), signedBy: reviewerName })
        count++
      }
    })
    tip(count > 0 ? `本访视 ${count} 项已审核模块已全部签署` : '本访视暂无待签署模块')
  }

  // 一键审核当前访视全部「已完成且未审核」的模块
  const reviewAllInVisit = () => {
    if (!visit) return
    let count = 0
    modules.forEach((m) => {
      const rec = recordOf(m.id)
      if (rec?.status === 'completed' && !rec.reviewedAt) {
        saveVisitData({ ...rec, reviewedAt: now(), reviewedBy: reviewerName })
        count++
      }
    })
    tip(count > 0 ? `本访视 ${count} 项已完成模块已全部审核` : '本访视暂无待审核模块')
  }

  // ========== 整例一键操作：该患者全部访视的已完成记录 ==========
  const patientCompletedRecs = useMemo(
    () => visitData.filter((r) => r.patientId === patientId && r.status === 'completed'),
    [visitData, patientId],
  )
  const patientReviewable = patientCompletedRecs.filter((r) => !r.reviewedAt).length
  const patientSignable = patientCompletedRecs.filter((r) => r.reviewedAt && !r.signedAt).length

  const reviewAllPatient = () => {
    if (patientReviewable === 0) return
    if (!confirm(`将该患者全部访视中 ${patientReviewable} 条已完成记录一键审核？`)) return
    patientCompletedRecs
      .filter((r) => !r.reviewedAt)
      .forEach((r) => saveVisitData({ ...r, reviewedAt: now(), reviewedBy: reviewerName }))
    tip(`已一键审核该患者 ${patientReviewable} 条记录`)
  }

  const signAllPatient = () => {
    if (patientSignable === 0) return
    if (!confirm(`将该患者全部访视中 ${patientSignable} 条已审核记录一键签署？`)) return
    patientCompletedRecs
      .filter((r) => r.reviewedAt && !r.signedAt)
      .forEach((r) => saveVisitData({ ...r, signedAt: now(), signedBy: reviewerName }))
    tip(`已一键签署该患者 ${patientSignable} 条记录`)
  }

  // 关闭已回复的数据疑问
  const closeQuery = (q: DataQuery) => {
    saveQuery({ ...q, status: 'closed', closedBy: reviewerName, closedAt: now() })
    tip('疑问已关闭')
  }

  // 审核进度条：当前访视的审核/签署状况 + 一键审核/一键签署
  const renderReviewBar = () => {
    if (!visit) return null
    const completedRecs = modules
      .map((m) => recordOf(m.id))
      .filter((r): r is VisitData => r?.status === 'completed')
    if (completedRecs.length === 0) return null
    const reviewedCount = completedRecs.filter((r) => r.reviewedAt).length
    const pendingCount = completedRecs.length - reviewedCount
    const signedCount = completedRecs.filter((r) => r.signedAt).length
    const signableCount = completedRecs.filter((r) => r.reviewedAt && !r.signedAt).length
    return (
      <Card className="bg-white border-green-100">
        <CardContent className="p-3 flex items-center gap-3 flex-wrap">
          <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-4 h-4 text-green-500" />
          </div>
          <div className="text-xs text-slate-500">
            <span className="font-medium text-slate-700">{visit.code} {visit.name}</span>
            ：已完成 {completedRecs.length} 项，已审核 {reviewedCount} 项
            {pendingCount > 0
              ? `，待审核 ${pendingCount} 项`
              : '，全部已审核 ✓'}
            ，已签署 {signedCount} 项
            {signableCount === 0 && signedCount === completedRecs.length ? '，全部已签署 ✓' : ''}
          </div>
          <div className="ml-auto flex items-center gap-2">
            {pendingCount > 0 && (
              <Button
                size="sm" variant="outline"
                className="h-7 text-xs border-green-200 text-green-600 hover:bg-green-50"
                onClick={reviewAllInVisit}
              >
                <ShieldCheck className="w-3 h-3 mr-1" /> 一键审核本访视（{pendingCount} 项）
              </Button>
            )}
            {signableCount > 0 && (
              <Button
                size="sm" variant="outline"
                className="h-7 text-xs border-purple-200 text-purple-600 hover:bg-purple-50"
                onClick={signAllInVisit}
              >
                <PenLine className="w-3 h-3 mr-1" /> 一键签署本访视（{signableCount} 项）
              </Button>
            )}
            {pendingCount === 0 && signableCount === 0 && (
              <span className="text-xs text-green-500 flex items-center gap-1">
                <BadgeCheck className="w-3.5 h-3.5" /> 审核签署完成
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!patient || !project) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-400 mb-4">未找到该患者</p>
        <Button variant="outline" asChild>
          <Link to={base}>返回数据审核</Link>
        </Button>
      </div>
    )
  }

  const centerName =
    project.centers?.find((c) => c.id === patient.centerId)?.name || project.researchCenter

  // 只读数据面板 + 审核操作
  const renderDataPanel = () => {
    if (!activeModule || !visit) return null
    return (
      <Card className="border-green-200">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-slate-800">
                {visit.code} {visit.name} · {activeModule.name}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {patient.screeningId} · {patient.nameInitials}
                {savedTip && <span className="ml-2 text-green-600 font-medium">✓ {savedTip}</span>}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {/* 数据来源标记：语音/文件识别填充 */}
              <FillSourceBadge source={activeRecord?.data?.__fillSource as string | undefined} />
              {/* 操作历史：谁、何时、对什么数据做了什么 */}
              {activeRecord && (
                <Button
                  variant="ghost" size="sm"
                  className="h-7 w-7 p-0 text-slate-400 hover:text-sky-500"
                  title="查看该模块数据的操作历史"
                  onClick={() => setHistoryOpen(true)}
                >
                  <History className="w-4 h-4" />
                </Button>
              )}
              {/* 签署操作（管理人员）：已审核的完成数据可签署，签署后可撤销 */}
              {activeRecord?.status === 'completed' && (
                activeRecord.signedAt ? (
                  <>
                    <span
                      className="text-[11px] px-2 py-1 rounded-full bg-purple-50 text-purple-600 flex items-center gap-1"
                      title={`已签署 · ${userNameOf(activeRecord.signedBy)} · ${fmtTime(activeRecord.signedAt)}`}
                    >
                      <PenLine className="w-3.5 h-3.5" />
                      已签署
                    </span>
                    <Button
                      variant="ghost" size="sm"
                      className="text-slate-400 hover:text-slate-600 text-xs h-7 px-2"
                      onClick={() => unsignRecord(activeRecord)}
                    >
                      撤销签署
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm" variant="outline"
                    className="border-purple-200 text-purple-600 hover:bg-purple-50 disabled:opacity-40 disabled:cursor-not-allowed"
                    disabled={!activeRecord.reviewedAt}
                    title={activeRecord.reviewedAt ? '签署确认该模块数据' : '请先完成审核确认，再签署'}
                    onClick={() => signRecord(activeRecord)}
                  >
                    <PenLine className="w-3.5 h-3.5 mr-1" /> 签署确认
                  </Button>
                )
              )}
              {/* 提出质疑：对有数据记录的模块发起 */}
              {activeRecord && (
                <Button
                  size="sm" variant="outline"
                  className="h-7 text-xs border-orange-200 text-orange-600 hover:bg-orange-50"
                  onClick={openQueryDialog}
                >
                  <MessageCircleQuestion className="w-3.5 h-3.5 mr-1" /> 提出质疑
                </Button>
              )}
              {/* 审核操作：仅「已完成」的数据可审核 */}
              {activeRecord?.status === 'completed' && (
                activeRecord.reviewedAt ? (
                  <>
                    <span
                      className="text-[11px] px-2 py-1 rounded-full bg-green-50 text-green-600 flex items-center gap-1"
                      title={`已审核 · ${userNameOf(activeRecord.reviewedBy)} · ${fmtTime(activeRecord.reviewedAt)}`}
                    >
                      <BadgeCheck className="w-3.5 h-3.5" />
                      已审核
                    </span>
                    <Button
                      variant="ghost" size="sm"
                      className="text-slate-400 hover:text-slate-600 text-xs h-7 px-2"
                      onClick={() => unreviewRecord(activeRecord)}
                    >
                      取消审核
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    className="bg-green-500 hover:bg-green-600 text-white"
                    onClick={() => reviewRecord(activeRecord)}
                  >
                    <ShieldCheck className="w-3.5 h-3.5 mr-1" /> 确认审核
                  </Button>
                )
              )}
            </div>
          </div>

          {/* 数据疑问（只读展示；已回复的疑问可关闭） */}
          {activeRecord && queriesOf(activeRecord.id).length > 0 && (
            <div className="space-y-2">
              {queriesOf(activeRecord.id).map((q) => (
                <div
                  key={q.id}
                  className={`rounded-lg border px-3 py-2.5 ${
                    q.status === 'open' ? 'border-orange-200 bg-orange-50/60' : 'border-slate-200 bg-slate-50/60'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <MessageCircleQuestion className={`w-3.5 h-3.5 shrink-0 ${q.status === 'open' ? 'text-orange-500' : 'text-slate-400'}`} />
                    <span className="text-xs text-slate-700 flex-1 min-w-0">
                      {q.fieldLabel && <span className="text-orange-500 mr-1">[{q.fieldLabel}]</span>}
                      {q.content}
                    </span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-full border shrink-0 ${
                        q.status === 'open'
                          ? 'bg-orange-50 text-orange-600 border-orange-200'
                          : q.status === 'answered'
                          ? 'bg-blue-50 text-blue-600 border-blue-200'
                          : 'bg-slate-100 text-slate-500 border-slate-200'
                      }`}
                    >
                      {q.status === 'open' ? '待回复' : q.status === 'answered' ? '已回复' : '已关闭'}
                    </span>
                    {q.status === 'answered' && (
                      <Button
                        size="sm" variant="outline"
                        className="h-6 px-2 text-[11px] border-slate-200 text-slate-500 hover:text-green-600 shrink-0"
                        onClick={() => closeQuery(q)}
                      >
                        关闭疑问
                      </Button>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5 pl-5">
                    {q.createdByName} · {q.createdAt.slice(0, 10)}
                  </div>
                  {q.answer && (
                    <div className="text-xs text-slate-600 mt-1.5 ml-5 pl-2 border-l-2 border-blue-200">
                      录入回复:{q.answer}
                      <span className="text-[10px] text-slate-400 ml-1.5">{q.answeredAt?.slice(0, 10)}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* 只读数据 */}
          {activeRecord ? (
            <CRFFormRenderer
              key={`${visit.id}-${activeModule.id}`}
              sections={[]}
              fields={activeModule.fields}
              initialData={activeRecord.data}
              readOnly
              fieldLayout={activeModule.fieldLayout}
            />
          ) : (
            <div className="text-center py-12 text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-200">
              <FileText className="w-8 h-8 mx-auto mb-2 text-slate-200" />
              <p className="text-sm">该模块尚未录入数据</p>
            </div>
          )}

          {/* 提出质疑弹窗 */}
          <Dialog open={queryDialogOpen} onOpenChange={setQueryDialogOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="text-base flex items-center gap-2">
                  <MessageCircleQuestion className="w-4 h-4 text-orange-500" />
                  提出数据质疑
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3 py-1">
                <p className="text-xs text-slate-400">
                  {visit.code} {visit.name} · {activeModule.name} · {patient.screeningId} {patient.nameInitials}
                </p>
                <div className="space-y-1.5">
                  <Label className="text-xs">质疑对象</Label>
                  <Select value={queryFieldName || '__all__'} onValueChange={(v) => setQueryFieldName(v === '__all__' ? '' : v)}>
                    <SelectTrigger className="bg-slate-50 border-slate-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">整条记录</SelectItem>
                      {activeModule.fields
                        .filter((f) => f.type !== 'label')
                        .map((f) => (
                          <SelectItem key={f.id} value={f.name}>{f.label}</SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">质疑内容 <span className="text-red-400">*</span></Label>
                  <Textarea
                    value={queryContent}
                    onChange={(e) => setQueryContent(e.target.value)}
                    placeholder="请描述数据疑点，例如：收缩压 138 与上次访视差异较大，请核实"
                    className="min-h-[96px] bg-slate-50 border-slate-200 text-sm"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" size="sm" onClick={() => setQueryDialogOpen(false)}>取消</Button>
                <Button
                  size="sm"
                  className="bg-orange-500 hover:bg-orange-600 text-white"
                  disabled={!queryContent.trim()}
                  onClick={submitQuery}
                >
                  发出质疑
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* 操作历史弹窗 */}
          <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="text-base flex items-center gap-2">
                  <History className="w-4 h-4 text-sky-500" />
                  操作历史
                </DialogTitle>
              </DialogHeader>
              <p className="text-xs text-slate-400 -mt-1">
                {visit.code} {visit.name} · {activeModule.name} · {patient.screeningId} {patient.nameInitials}
              </p>
              <div className="max-h-[400px] overflow-y-auto space-y-2 py-1">
                {historyItems.length === 0 && (
                  <div className="text-center py-10 text-sm text-slate-400">暂无操作记录</div>
                )}
                {historyItems.map((h, i) => (
                  <div key={i} className="flex gap-3 rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2.5">
                    <div className="text-[11px] text-slate-400 whitespace-nowrap pt-0.5 w-[92px] shrink-0">
                      {fmtTime(h.time)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs text-slate-700">
                        <span className="font-medium text-slate-800">{h.user}</span>
                        <span className={`mx-1.5 text-[10px] px-1.5 py-0.5 rounded-full ${
                          h.action === '审核' ? 'bg-green-50 text-green-600'
                          : h.action === '签署' ? 'bg-purple-50 text-purple-600'
                          : h.action === '录入' ? 'bg-blue-50 text-blue-600'
                          : h.action === '删除' ? 'bg-red-50 text-red-600'
                          : 'bg-slate-100 text-slate-500'
                        }`}>{h.action}</span>
                        {h.summary}
                      </div>
                      {h.changes && h.changes.length > 0 && (
                        <div className="mt-1.5 space-y-0.5">
                          {h.changes.slice(0, 8).map((c, j) => (
                            <div key={j} className="text-[11px] text-slate-500">
                              <span className="text-slate-600">{c.field}</span>
                              ：<span className="line-through text-slate-400">{c.before || '空'}</span>
                              {' → '}
                              <span className="text-sky-600">{c.after || '空'}</span>
                            </div>
                          ))}
                          {h.changes.length > 8 && (
                            <div className="text-[10px] text-slate-400">…共 {h.changes.length} 项变更</div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="flex gap-4 items-start">
      {/* 患者切换栏 */}
      <div className="w-28 shrink-0 sticky top-4 self-start">
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-2 pt-3 pb-2.5 border-b border-slate-100 space-y-2.5">
            <div className="text-center text-[11px] font-medium text-slate-400">
              患者 {filteredPatients.length}{patientFilter.trim() ? ` / ${projectPatients.length}` : ''}
            </div>
            <Input
              value={patientFilter}
              onChange={(e) => setPatientFilter(e.target.value)}
              placeholder="搜索"
              className="h-7 text-xs px-2 bg-slate-50 border-slate-200"
            />
          </div>
          <div className="max-h-[calc(100vh-290px)] overflow-y-auto p-2 space-y-1.5">
            {filteredPatients.map((p) => {
              const current = p.id === patientId
              const pno = switchProjectNo === 'all'
                ? projects.find((x) => x.id === p.projectId)?.projectNo.slice(0, 5)
                : undefined
              return (
                <Link
                  key={p.id}
                  id={`rswitch-${p.id}`}
                  to={`${base}/${p.id}${switchProjectNo !== 'all' ? `?projectNo=${switchProjectNo}` : ''}`}
                  title={`${p.screeningId} · ${p.nameInitials} · ${PATIENT_STATUS_LABELS[p.status] ?? p.status}`}
                  className={`flex items-center justify-center gap-1.5 px-1 py-2.5 rounded-lg text-xs transition-colors ${
                    current
                      ? 'bg-green-50 text-green-600 font-semibold'
                      : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${PATIENT_DOT[p.status] ?? 'bg-slate-300'}`} />
                  <span className="flex flex-col items-center leading-tight">
                    <span>{p.screeningId}</span>
                    {pno && <span className="text-[9px] text-slate-300 font-normal">{pno}</span>}
                  </span>
                </Link>
              )
            })}
            {filteredPatients.length === 0 && (
              <div className="py-6 text-center text-[11px] text-slate-300">无匹配患者</div>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 min-w-0 space-y-4">
        {/* 返回 + 患者信息 */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild className="text-slate-400 hover:text-slate-600">
            <Link to={base}><ArrowLeft className="w-5 h-5" /></Link>
          </Button>
          <div className="flex-1 flex flex-wrap items-center gap-x-5 gap-y-1">
            <h1 className="text-base font-bold text-slate-800">
              {patient.screeningId} · {patient.nameInitials}
            </h1>
            <span className="text-sm text-slate-500 flex items-center gap-1">
              <User className="w-3.5 h-3.5 text-slate-300" />
              {patient.gender === 'male' ? '男' : '女'}
              {patient.randomizationId ? ` · 随机号 ${patient.randomizationId}` : ''}
            </span>
            <span className="text-sm text-slate-500 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-slate-300" />
              {centerName}
            </span>
            {patient.consentDate && (
              <span className="text-sm text-slate-500 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-300" />
                知情同意 {patient.consentDate}
              </span>
            )}
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-600">
              {PATIENT_STATUS_LABELS[patient.status] ?? patient.status}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-600 flex items-center gap-1">
              <ClipboardCheck className="w-3 h-3" /> 数据审核模式 · 只读
            </span>
          </div>
          {/* 整例一键审核 / 一键签署（覆盖全部访视的已完成记录） */}
          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              size="sm" variant="outline"
              className="h-7 text-xs border-green-200 text-green-600 hover:bg-green-50"
              disabled={patientReviewable === 0}
              title={patientReviewable > 0 ? `一键审核该患者全部 ${patientReviewable} 条已完成记录` : '该患者暂无待审核记录'}
              onClick={reviewAllPatient}
            >
              <ShieldCheck className="w-3 h-3 mr-1" /> 一键审核{patientReviewable > 0 ? `（${patientReviewable}）` : ''}
            </Button>
            <Button
              size="sm" variant="outline"
              className="h-7 text-xs border-purple-200 text-purple-600 hover:bg-purple-50"
              disabled={patientSignable === 0}
              title={patientSignable > 0 ? `一键签署该患者全部 ${patientSignable} 条已审核记录` : '暂无可签署记录（需先审核）'}
              onClick={signAllPatient}
            >
              <PenLine className="w-3 h-3 mr-1" /> 一键签署{patientSignable > 0 ? `（${patientSignable}）` : ''}
            </Button>
          </div>
        </div>

        {/* 左侧访视树 + 右侧审核区 */}
        <div className="flex gap-4 items-start">
          {/* 左侧：访视 → 模块 树 */}
          <aside className="w-64 shrink-0 bg-white rounded-xl border border-slate-200 overflow-hidden sticky top-20">
            <div className="px-4 py-3 border-b border-slate-100 text-xs font-medium text-slate-500">
              访视 / 模块
            </div>
            <div className="max-h-[calc(100vh-220px)] overflow-y-auto py-1">
              {sortedVisits.map((v) => {
                const { done, total } = visitProgress(v)
                const expanded = expandedVisitIds.includes(v.id)
                const complete = total > 0 && done === total
                const visitModules = project.crfModules.filter((m) => v.crfModuleIds.includes(m.id))
                return (
                  <div key={v.id}>
                    <button
                      onClick={() => toggleVisitExpand(v)}
                      className={`w-full flex items-center gap-2 px-3 py-2.5 text-left transition-colors ${
                        expanded ? 'bg-green-50/60' : 'hover:bg-slate-50'
                      }`}
                    >
                      {expanded ? (
                        <ChevronDown className="w-3.5 h-3.5 text-green-500 shrink-0" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-xs font-bold ${expanded ? 'text-green-600' : 'text-slate-600'}`}>
                            {v.code} {v.name}
                          </span>
                          {complete && <CheckCircle2 className="w-3.5 h-3.5 text-teal-500 shrink-0" />}
                          {v.code === patient.currentVisit && (
                            <span className="text-[10px] px-1 py-0.5 rounded bg-sky-50 text-sky-600 shrink-0">当前</span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{done}/{total} 模块完成</div>
                      </div>
                    </button>
                    {expanded && (
                      <div className="pb-1">
                        {visitModules.map((m) => {
                          const rec = recordOf(m.id, v.id)
                          const st = VD_STATUS[rec?.status ?? 'not_started']
                          const StIcon = st.icon
                          const active = v.id === visit?.id && activeModuleId === m.id
                          return (
                            <button
                              key={m.id}
                              onClick={() => openModule(m.id, v.id)}
                              className={`w-full flex items-center gap-2 pl-9 pr-3 py-2 text-left text-xs transition-colors ${
                                active
                                  ? 'bg-green-50 text-green-700 font-medium border-r-2 border-green-500'
                                  : 'text-slate-600 hover:bg-slate-50'
                              }`}
                            >
                              <FileText className={`w-3.5 h-3.5 shrink-0 ${active ? 'text-green-500' : 'text-slate-300'}`} />
                              <span className="flex-1 truncate">{m.name}</span>
                              {rec?.reviewedAt && (
                                <ShieldCheck className="w-3 h-3 text-green-500 shrink-0" />
                              )}
                              {rec?.signedAt && (
                                <PenLine className="w-3 h-3 text-purple-400 shrink-0" />
                              )}
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-1 shrink-0 ${st.color}`}>
                                <StIcon className="w-2.5 h-2.5" />
                                {st.label}
                              </span>
                            </button>
                          )
                        })}
                        {visitModules.length === 0 && (
                          <div className="pl-9 pr-3 py-2 text-[11px] text-slate-300">未配置模块</div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </aside>

          {/* 右侧：审核区 */}
          <div className="flex-1 min-w-0 space-y-4">
            {renderReviewBar()}
            {activeModule ? (
              renderDataPanel()
            ) : (
              <div className="text-center py-24 text-slate-400 bg-white rounded-xl border border-dashed border-slate-200">
                <ListTree className="w-10 h-10 mx-auto mb-3 text-slate-200" />
                <p className="text-sm">从左侧展开访视，点击模块查看录入数据</p>
                <p className="text-xs text-slate-300 mt-1">数据为只读模式，可对已完成模块进行审核确认</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
