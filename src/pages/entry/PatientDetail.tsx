import { useEffect, useMemo, useState } from 'react'
import { useParams, Link, useSearchParams } from 'react-router'
import { useAppStorage } from '@/hooks/useAppStorage'
import type { AuditLog, CRFField, CRFModule, DataQuery, LabRangeSet, Visit, VisitData, VisitDataStatus } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import CRFFormRenderer from '@/components/CRFFormRenderer'
import { SmartFillPanel, FillSourceBadge } from '@/components/SmartFill'
import { LabRangeUploadDialog } from '@/components/LabRangeUpload'
import { LabMatrixPanel } from '@/components/LabMatrixDialog'
import {
  ArrowLeft, Save, CheckCircle, X, MapPin, User, Calendar,
  CircleDashed, Loader, CheckCircle2, Lock,
  Rows3, ListTree, ChevronDown, ChevronRight, FileText,
  MessageCircleQuestion, Send, History,
  Mic, FileUp, Table2,
} from 'lucide-react'

function genId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

function now() {
  return new Date().toISOString()
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

const LAYOUT_KEY = 'crf_entry_input_layout'

export default function EntryPatientDetail() {
  const { patientId } = useParams()
  const { projects, patients, visitData, saveVisitData, queries, saveQuery, currentUser, users, auditLogs, saveProject } = useAppStorage()
  const signerName = currentUser?.name ?? '研究人员'

  const userNameOf = useMemo(() => {
    const map = new Map(users.map((u) => [u.id, u.name]))
    return (idOrName?: string) => (idOrName ? map.get(idOrName) ?? idOrName : '-')
  }, [users])

  // 数据疑问：某条录入记录的疑问（按状态分组）
  const queriesOf = (recId?: string) =>
    recId ? queries.filter((q) => q.visitDataId === recId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) : []
  const openQueryCount = (recId?: string) =>
    recId ? queries.filter((q) => q.visitDataId === recId && q.status === 'open').length : 0

  const patient = patients.find((p) => p.id === patientId)
  const project = patient ? projects.find((p) => p.id === patient.projectId) : undefined
  const sortedVisits = useMemo(
    () => (project ? [...project.visits].sort((a, b) => a.order - b.order) : []),
    [project],
  )

  // 默认选中患者当前访视，否则第一个访视
  const defaultVisit = sortedVisits.find((v) => v.code === patient?.currentVisit) ?? sortedVisits[0]
  const [visitId, setVisitId] = useState<string>(defaultVisit?.id ?? '')
  const [activeModuleId, setActiveModuleId] = useState<string>('')
  const [formData, setFormData] = useState<Record<string, unknown>>({})
  const [savedTip, setSavedTip] = useState('')
  // 智能填充：语音录入 / 上传文件识别
  const [smartFill, setSmartFill] = useState<'voice' | 'file' | null>(null)
  // 智能填充应用后的表单种子（按 访视|模块 标记，切换模块后失效）
  const [formSeed, setFormSeed] = useState<{ k: number; vm: string; data: Record<string, unknown> } | null>(null)
  // 参考范围上传（执行人员）：目标表格字段
  const [labUploadField, setLabUploadField] = useState<CRFField | null>(null)

  // 上传参考范围保存：写入项目模块配置（全端同步；判定按各版本生效日期与检测日期自动匹配）
  const handleSaveLabRanges = (set: LabRangeSet) => {
    if (!project || !activeModule || !labUploadField) return
    const nextModules = project.crfModules.map((m) => {
      if (m.id !== activeModule.id) return m
      return {
        ...m,
        fields: m.fields.map((f) => {
          if (f.id !== labUploadField.id) return f
          // 实验室模式写入 labConfig.sets；普通表格（单位/正常值范围列）写入 rangeSets
          return f.labConfig
            ? { ...f, labConfig: { ...f.labConfig, sets: [...f.labConfig.sets, set] } }
            : { ...f, rangeSets: [...(f.rangeSets ?? []), set] }
        }),
      }
    })
    saveProject({ ...project, crfModules: nextModules })
    setSavedTip(`参考范围「${set.name}」已上传并同步`)
    setTimeout(() => setSavedTip(''), 2500)
  }
  // 疑问回复输入（按疑问 id 暂存）
  const [queryAnswers, setQueryAnswers] = useState<Record<string, string>>({})

  // 录入布局：时间轴横版 / 竖版树状
  const [layoutMode, setLayoutMode] = useState<'timeline' | 'vertical'>(() => {
    return localStorage.getItem(LAYOUT_KEY) === 'vertical' ? 'vertical' : 'timeline'
  })
  const switchLayout = (mode: 'timeline' | 'vertical') => {
    setLayoutMode(mode)
    localStorage.setItem(LAYOUT_KEY, mode)
  }
  // 竖版：展开的访视（默认展开当前访视）
  const [expandedVisitIds, setExpandedVisitIds] = useState<string[]>(
    defaultVisit ? [defaultVisit.id] : [],
  )

  // 本研究全部患者（切换栏用，按筛选序号排序）；顶部研究筛选为「全部研究」时跨研究列出
  const [searchParams] = useSearchParams()
  const switchProjectNo = searchParams.get('projectNo') || 'all'
  // 深链参数：从数据矩阵「去录入」跳入时自动定位访视与模块
  const targetVisitId = searchParams.get('visitId') || ''
  const targetModuleId = searchParams.get('moduleId') || ''
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

  // 切换栏搜索过滤（编号 / 姓名缩写）
  const [patientFilter, setPatientFilter] = useState('')
  const filteredPatients = useMemo(() => {
    const kw = patientFilter.trim().toLowerCase()
    if (!kw) return projectPatients
    return projectPatients.filter(
      (p) => p.screeningId.toLowerCase().includes(kw) || p.nameInitials.toLowerCase().includes(kw),
    )
  }, [projectPatients, patientFilter])

  // 切换患者时：滚动切换栏到当前患者，并重置选中访视为该患者当前访视（深链参数优先）
  useEffect(() => {
    document.getElementById(`pswitch-${patientId}`)?.scrollIntoView({ block: 'center' })
    const dv =
      sortedVisits.find((v) => v.id === targetVisitId)
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
      targetModuleId && dvModules.some((m) => m.id === targetModuleId) ? targetModuleId : '',
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId])

  const visit: Visit | undefined = sortedVisits.find((v) => v.id === visitId) ?? defaultVisit
  const modules: CRFModule[] = useMemo(() => {
    if (!project || !visit) return []
    return project.crfModules.filter((m) => visit.crfModuleIds.includes(m.id))
  }, [project, visit])

  const recordOf = (moduleId: string, vid?: string): VisitData | undefined =>
    visitData.find((vd) => vd.patientId === patientId && vd.visitId === (vid ?? visit?.id) && vd.moduleId === moduleId)

  const activeModule = modules.find((m) => m.id === activeModuleId)
  const activeRecord = activeModule ? recordOf(activeModule.id) : undefined

  // ========== 操作历史（审计轨迹，与审核端一致） ==========
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

  // 访视完成度
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
    if (activeModuleId === moduleId && (!vid || vid === visitId)) {
      setActiveModuleId('')
      return
    }
    setActiveModuleId(moduleId)
    setFormData(recordOf(moduleId, vid)?.data ?? {})
    setSavedTip('')
  }

  const toggleVisitExpand = (v: Visit) => {
    setExpandedVisitIds((prev) =>
      prev.includes(v.id) ? prev.filter((id) => id !== v.id) : [...prev, v.id],
    )
  }

  const handleSave = (status: VisitDataStatus) => {
    if (!patient || !project || !visit || !activeModule) return
    // 已签署/已审核的数据一旦发生修改，签署与审核自动作废，需重新签署/确认（留痕会同步记录）
    const wasSigned = !!activeRecord?.signedAt
    const wasReviewed = !!activeRecord?.reviewedAt
    const vd: VisitData = {
      id: activeRecord?.id || genId(),
      patientId: patient.id,
      projectId: project.id,
      visitId: visit.id,
      moduleId: activeModule.id,
      data: formData,
      status,
      createdAt: activeRecord?.createdAt || now(),
      updatedAt: now(),
      createdBy: activeRecord?.createdBy,
    }
    saveVisitData(vd)
    const base = status === 'completed' ? '已保存并标记完成' : '已暂存'
    const voided = [
      wasReviewed ? '审核' : '',
      wasSigned ? '签署' : '',
    ].filter(Boolean).join('与')
    setSavedTip(voided ? `${base}；原${voided}已作废，需重新确认` : base)
    setTimeout(() => setSavedTip(''), 2500)
  }

  // 检验矩阵模式：矩阵内编辑即时保存，此处仅翻转记录状态（不改数据），签署/审核同步作废
  const markMatrixStatus = (status: VisitDataStatus) => {
    if (!activeRecord) {
      setSavedTip('请先在矩阵中录入数据')
      setTimeout(() => setSavedTip(''), 2500)
      return
    }
    saveVisitData({ ...activeRecord, status, updatedAt: now() })
    setSavedTip(status === 'completed' ? '已标记完成' : '已回退为进行中')
    setTimeout(() => setSavedTip(''), 2500)
  }

  // 智能填充应用：普通字段直接覆盖；预置行表格（实验室/通用）按项目名合并行，保留未识别项的已有值；记录数据来源标记
  const applySmartFill = (patch: Record<string, unknown>, source: 'voice' | 'file') => {
    if (!visit || !activeModule) return
    const next = { ...formData }
    for (const [k, v] of Object.entries(patch)) {
      const f = activeModule.fields.find((x) => x.name === k)
      const lockCol = f?.type === 'table' ? (f.labConfig?.itemCol || f.rowPreset?.col) : undefined
      if (f?.type === 'table' && lockCol && Array.isArray(v)) {
        const cur = Array.isArray(next[k]) ? [...(next[k] as Record<string, unknown>[])] : []
        for (const row of v as Record<string, unknown>[]) {
          const i = cur.findIndex((r) => r[lockCol] === row[lockCol])
          if (i >= 0) cur[i] = { ...cur[i], ...row }
          else cur.push(row)
        }
        next[k] = cur
      } else {
        next[k] = v
      }
    }
    next.__fillSource = source
    next.__fillAt = now()
    setFormData(next)
    setFormSeed({ k: Date.now(), vm: `${visit.id}|${activeModule.id}`, data: next })
    setSavedTip('已按识别结果填充，请核对后保存')
    setTimeout(() => setSavedTip(''), 2500)
  }

  // 回复数据疑问：回复后状态变为「已回复」，待管理人员确认关闭
  const answerQuery = (q: DataQuery) => {
    const text = (queryAnswers[q.id] ?? '').trim()
    if (!text) return
    saveQuery({ ...q, status: 'answered', answer: text, answeredBy: signerName, answeredAt: now() })
    setQueryAnswers((prev) => ({ ...prev, [q.id]: '' }))
    setSavedTip('已回复疑问，待管理人员确认关闭')
    setTimeout(() => setSavedTip(''), 2500)
  }

  // 当前模块的疑问面板（录入表单上方展示）
  const renderQueryPanel = () => {
    if (!activeRecord) return null
    const list = queriesOf(activeRecord.id)
    if (list.length === 0) return null
    return (
      <div className="space-y-2">
        {list.map((q) => (
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
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5 pl-5">
              {q.createdByName} · {q.createdAt.slice(0, 10)}
            </div>
            {q.answer ? (
              <div className="text-xs text-slate-600 mt-1.5 ml-5 pl-2 border-l-2 border-blue-200">
                我的回复：{q.answer}
                <span className="text-[10px] text-slate-400 ml-1.5">{q.answeredAt?.slice(0, 10)}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 mt-1.5 ml-5">
                <Input
                  className="h-7 text-xs flex-1"
                  placeholder="回复该疑问，如：已核对原始病历，数据无误…"
                  value={queryAnswers[q.id] ?? ''}
                  onChange={(e) => setQueryAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                />
                <Button
                  size="sm"
                  className="h-7 px-2.5 text-xs bg-orange-500 hover:bg-orange-600 text-white"
                  disabled={!(queryAnswers[q.id] ?? '').trim()}
                  onClick={() => answerQuery(q)}
                >
                  <Send className="w-3 h-3 mr-1" /> 回复
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
    )
  }

  if (!patient || !project) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-400 mb-4">未找到该患者</p>
        <Button variant="outline" asChild>
          <Link to="/entry/patients">返回患者管理</Link>
        </Button>
      </div>
    )
  }

  const centerName =
    project.centers?.find((c) => c.id === patient.centerId)?.name || project.researchCenter

  // 录入表单（两种布局共用）
  const renderForm = () => {
    if (!activeModule || !visit) return null
    // 跨访视矩阵模式：实验室矩阵或通用预置行矩阵，整体以矩阵渲染（编辑即时保存）
    const matrixField = activeModule.fields.find(
      (f) =>
        f.type === 'table' &&
        (f.labConfig?.displayMode === 'matrix' || !!(f.matrixView && f.rowPreset?.col && f.matrixView.valueCol)),
    )
    return (
      <Card className="border-amber-200">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-slate-800">
                {visit.code} {visit.name} · {activeModule.name}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {patient.screeningId} · {patient.nameInitials}
                {savedTip && <span className="ml-2 text-teal-600 font-medium">✓ {savedTip}</span>}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {/* 数据来源标记：语音/文件识别填充 */}
              <FillSourceBadge source={(formData.__fillSource ?? activeRecord?.data?.__fillSource) as string | undefined} />
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
              {/* 智能填充：语音录入 / 上传文件识别（内联展开于表单下方，不遮挡录入区；再次点击收起） */}
              {!matrixField && (
                <>
                  <Button
                    variant="outline" size="sm"
                    className={smartFill === 'voice'
                      ? 'bg-teal-500 text-white border-teal-500 hover:bg-teal-600'
                      : 'text-teal-600 border-teal-200 hover:bg-teal-50'}
                    onClick={() => setSmartFill(smartFill === 'voice' ? null : 'voice')}
                  >
                    <Mic className="w-3.5 h-3.5 mr-1" /> 语音录入
                  </Button>
                  <Button
                    variant="outline" size="sm"
                    className={smartFill === 'file'
                      ? 'bg-teal-500 text-white border-teal-500 hover:bg-teal-600'
                      : 'text-teal-600 border-teal-200 hover:bg-teal-50'}
                    onClick={() => setSmartFill(smartFill === 'file' ? null : 'file')}
                  >
                    <FileUp className="w-3.5 h-3.5 mr-1" /> 上传识别
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleSave('in_progress')}>
                    <Save className="w-3.5 h-3.5 mr-1" /> 暂存
                  </Button>
                  <Button size="sm" className="bg-teal-500 hover:bg-teal-600 text-white" onClick={() => handleSave('completed')}>
                    <CheckCircle className="w-3.5 h-3.5 mr-1" /> 完成录入
                  </Button>
                </>
              )}
              {matrixField && (
                activeRecord?.status === 'completed' ? (
                  <Button variant="outline" size="sm" onClick={() => markMatrixStatus('in_progress')}>
                    回退为进行中
                  </Button>
                ) : (
                  <Button size="sm" className="bg-teal-500 hover:bg-teal-600 text-white" onClick={() => markMatrixStatus('completed')}>
                    <CheckCircle className="w-3.5 h-3.5 mr-1" /> 标记完成
                  </Button>
                )
              )}
              <Button variant="ghost" size="icon" className="text-slate-400" onClick={() => setActiveModuleId('')}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
          {/* 数据疑问面板：管理人员的疑问在此展示并回复 */}
          {renderQueryPanel()}
          {matrixField ? (
            <div className="space-y-2">
              <p className="text-xs text-slate-400 flex items-center gap-1">
                <Table2 className="w-3.5 h-3.5 text-teal-500" />
                跨访视矩阵：行=预置内容、列=访视；记录日期在列头填写一次整列生效；编辑即时保存。
              </p>
              {/* 参考范围：含 单位/正常值范围/判定状态 列的矩阵在此上传（按检测日期自动匹配生效版本） */}
              {(matrixField.columns ?? []).some((c) => c.type === 'unit' || c.type === 'range' || c.type === 'flag') && (
                <div className="flex items-center justify-end gap-1.5">
                  <span className="text-[10px] text-slate-400">参考范围</span>
                  {(() => {
                    const sets = matrixField.labConfig?.sets ?? matrixField.rangeSets ?? []
                    return sets.length > 0 ? (
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500"
                        title={sets.map((s) => `${s.name}${s.effectiveDate ? `（${s.effectiveDate} 起生效）` : ''}`).join('\n')}
                      >
                        共 {sets.length} 套 · 按检测日期自动匹配生效版本
                      </span>
                    ) : (
                      <span className="text-[10px] text-amber-500">暂未上传，暂无法判定偏高/偏低</span>
                    )
                  })()}
                  <Button
                    variant="outline" size="sm"
                    className="h-6 px-2 text-[10px] text-teal-600 border-teal-200 hover:bg-teal-50"
                    onClick={() => setLabUploadField(matrixField)}
                  >
                    <FileUp className="w-3 h-3 mr-0.5" /> 上传参考范围
                  </Button>
                </div>
              )}
              <LabMatrixPanel
                patient={patient}
                project={project}
                visitData={visitData}
                onSaveRecord={saveVisitData}
                module={activeModule}
                field={matrixField}
                showTitle={false}
              />
            </div>
          ) : (
          <CRFFormRenderer
            key={`${visit.id}-${activeModule.id}-${formSeed && formSeed.vm === `${visit.id}|${activeModule.id}` ? formSeed.k : 0}`}
            sections={[]}
            fields={activeModule.fields}
            initialData={formSeed && formSeed.vm === `${visit.id}|${activeModule.id}` ? formSeed.data : activeRecord?.data}
            onChange={(data) => setFormData(data)}
            fieldLayout={activeModule.fieldLayout}
            onUploadLabRanges={(f) => setLabUploadField(f)}
          />
          )}
          {/* 智能填充：内联展示于表单下方，不遮挡录入区 */}
          {smartFill && !matrixField && (
            <SmartFillPanel
              key={smartFill}
              mode={smartFill}
              fields={activeModule.fields}
              onClose={() => setSmartFill(null)}
              onApply={applySmartFill}
            />
          )}
          {/* 参考范围上传弹窗（执行人员） */}
          <LabRangeUploadDialog
            open={labUploadField !== null}
            field={labUploadField}
            uploader={signerName}
            onOpenChange={(o) => { if (!o) setLabUploadField(null) }}
            onSave={handleSaveLabRanges}
          />
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
      {/* 患者切换栏：本研究全部患者编号，点击直接切换，无需返回列表 */}
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
                  id={`pswitch-${p.id}`}
                  to={`/entry/patients/${p.id}${switchProjectNo !== 'all' ? `?projectNo=${switchProjectNo}` : ''}`}
                  title={`${p.screeningId} · ${p.nameInitials} · ${PATIENT_STATUS_LABELS[p.status] ?? p.status}`}
                  className={`flex items-center justify-center gap-1.5 px-1 py-2.5 rounded-lg text-xs transition-colors ${
                    current
                      ? 'bg-sky-50 text-sky-600 font-semibold'
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
      {/* 返回 + 患者信息 + 布局切换 */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild className="text-slate-400 hover:text-slate-600">
          <Link to="/entry/patients"><ArrowLeft className="w-5 h-5" /></Link>
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
        </div>
        {/* 布局切换：时间轴横版 / 竖版 */}
        <div className="flex items-center border rounded-md overflow-hidden bg-white shrink-0">
          <Button
            variant="ghost" size="sm"
            className={`h-8 rounded-none text-xs ${layoutMode === 'timeline' ? 'bg-amber-50 text-amber-600' : 'text-slate-400'}`}
            onClick={() => switchLayout('timeline')}
            title="时间轴横版"
          >
            <Rows3 className="w-4 h-4 mr-1" /> 横版
          </Button>
          <Button
            variant="ghost" size="sm"
            className={`h-8 rounded-none text-xs ${layoutMode === 'vertical' ? 'bg-amber-50 text-amber-600' : 'text-slate-400'}`}
            onClick={() => switchLayout('vertical')}
            title="竖版树状"
          >
            <ListTree className="w-4 h-4 mr-1" /> 竖版
          </Button>
        </div>
      </div>

      {layoutMode === 'timeline' ? (
        <>
          {/* 访视时间轴 */}
          <div className="flex items-stretch gap-2 overflow-x-auto pb-1">
            {sortedVisits.map((v, idx) => {
              const { done, total } = visitProgress(v)
              const active = v.id === visit?.id
              const complete = total > 0 && done === total
              return (
                <div key={v.id} className="flex items-center gap-2 shrink-0">
                  {idx > 0 && <div className="w-6 h-px bg-slate-200" />}
                  <button
                    onClick={() => { setVisitId(v.id); setActiveModuleId('') }}
                    className={`px-4 py-2.5 rounded-xl border text-left transition-all min-w-[120px] ${
                      active
                        ? 'border-amber-400 bg-amber-50 shadow-sm'
                        : 'border-slate-200 bg-white hover:border-amber-300'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className={`text-xs font-bold ${active ? 'text-amber-600' : 'text-slate-500'}`}>{v.code}</span>
                      {complete && <CheckCircle2 className="w-3.5 h-3.5 text-teal-500" />}
                      {v.code === patient.currentVisit && (
                        <span className="text-[10px] px-1 py-0.5 rounded bg-sky-50 text-sky-600">当前</span>
                      )}
                    </div>
                    <div className={`text-xs mt-0.5 truncate ${active ? 'text-slate-700' : 'text-slate-400'}`}>{v.name}</div>
                    <div className="text-[10px] mt-1 text-slate-400">
                      {done}/{total} 模块完成
                    </div>
                  </button>
                </div>
              )
            })}
          </div>

          {/* 所选访视的模块卡片 */}
          {visit && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {modules.map((m) => {
                const rec = recordOf(m.id)
                const st = VD_STATUS[rec?.status ?? 'not_started']
                const StIcon = st.icon
                const open = activeModuleId === m.id
                return (
                  <button
                    key={m.id}
                    onClick={() => openModule(m.id)}
                    className={`text-left p-4 rounded-xl border bg-white transition-all ${
                      open ? 'border-amber-400 shadow-md ring-1 ring-amber-200' : 'border-slate-200 hover:border-amber-300 hover:shadow-sm'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-slate-700 text-sm">{m.name}</span>
                      <span className={`text-[11px] px-2 py-0.5 rounded-full flex items-center gap-1 ${st.color}`}>
                        <StIcon className="w-3 h-3" />
                        {st.label}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1.5 flex items-center gap-1.5">
                      {rec ? `更新于 ${rec.updatedAt.slice(0, 10)}` : '尚未录入，点击开始'}
                      {rec && openQueryCount(rec.id) > 0 && (
                        <span className="text-orange-500 flex items-center gap-0.5">
                          <MessageCircleQuestion className="w-3 h-3" /> 疑问{openQueryCount(rec.id)}
                        </span>
                      )}
                    </div>
                  </button>
                )
              })}
              {modules.length === 0 && (
                <div className="col-span-full text-center py-12 text-slate-400 bg-white rounded-xl border border-dashed border-slate-200">
                  该访视未配置模块
                </div>
              )}
            </div>
          )}

          {/* 录入表单 */}
          {renderForm()}
        </>
      ) : (
        /* ========== 竖版：左侧访视树 + 右侧录入区 ========== */
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
                    {/* 访视行：点击展开/收起 */}
                    <button
                      onClick={() => toggleVisitExpand(v)}
                      className={`w-full flex items-center gap-2 px-3 py-2.5 text-left transition-colors ${
                        expanded ? 'bg-amber-50/60' : 'hover:bg-slate-50'
                      }`}
                    >
                      {expanded ? (
                        <ChevronDown className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-xs font-bold ${expanded ? 'text-amber-600' : 'text-slate-600'}`}>
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
                    {/* 模块行 */}
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
                                  ? 'bg-amber-50 text-amber-700 font-medium border-r-2 border-amber-500'
                                  : 'text-slate-600 hover:bg-slate-50'
                              }`}
                            >
                              <FileText className={`w-3.5 h-3.5 shrink-0 ${active ? 'text-amber-500' : 'text-slate-300'}`} />
                              <span className="flex-1 truncate">{m.name}</span>
                              {rec && openQueryCount(rec.id) > 0 && (
                                <span className="text-orange-500 flex items-center gap-0.5 shrink-0 text-[10px]">
                                  <MessageCircleQuestion className="w-3 h-3" />{openQueryCount(rec.id)}
                                </span>
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

          {/* 右侧：录入区 */}
          <div className="flex-1 min-w-0 space-y-4">
            {activeModule ? (
              renderForm()
            ) : (
              <div className="text-center py-24 text-slate-400 bg-white rounded-xl border border-dashed border-slate-200">
                <ListTree className="w-10 h-10 mx-auto mb-3 text-slate-200" />
                <p className="text-sm">从左侧展开访视，点击模块开始录入</p>
                <p className="text-xs text-slate-300 mt-1">模块较多时推荐使用竖版，结构更清晰</p>
              </div>
            )}
          </div>
        </div>
      )}
      </div>
    </div>
  )
}
