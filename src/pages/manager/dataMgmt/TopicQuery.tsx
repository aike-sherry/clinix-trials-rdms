import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Bookmark, Download, FileSpreadsheet, Users, X, RotateCcw, BarChart3, Filter,
  Activity, AlertTriangle, ArrowLeft, ChevronDown, PieChart as PieChartIcon, Pill, Plus, Cigarette, HeartPulse,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { parseQueryText, type ParsedCondition } from './parseQuery'
import { useAppStorage } from '@/hooks/useAppStorage'
import StatCard from '@/components/StatCard'
import type { CRFModule, CRFField, Patient, Project, VisitData } from '@/types'
import {
  PATIENT_STATUS_LABELS, PATIENT_STATUS_COLORS,
  calcAge, cellText, downloadCsv, dateTag,
  analysisFields, explodeRows, type AnalysisField,
} from './shared'
import {
  PALETTE, CategoryList, StatMainChart, StatTypeSwitcher, ProfileGrid, TrendChartCard, QuickPresetRow,
  type ChartRow, type ChartType, type ProfileItem, type TrendPoint, type QuickPreset,
} from './ReportParts'

// ==================== 筛选状态模型 ====================

interface RangeVal { min: string; max: string }
interface DateRangeVal { from: string; to: string }

interface TopicFilters {
  enumFilters: Record<string, string[]>
  rangeFilters: Record<string, RangeVal>
  textFilters: Record<string, string>
  dateFilters: Record<string, DateRangeVal>
}

const EMPTY_FILTERS: TopicFilters = {
  enumFilters: {}, rangeFilters: {}, textFilters: {}, dateFilters: {},
}

interface SavedQuery extends TopicFilters {
  id: string
  name: string
  projectId: string
  moduleId: string
  visitCode: string
  patientStatus: string
  createdAt: string
}

const SAVED_KEY = 'crf_saved_queries'

function loadSavedQueries(): SavedQuery[] {
  try {
    return JSON.parse(localStorage.getItem(SAVED_KEY) || '[]')
  } catch {
    return []
  }
}

// ==================== 重点数据分析（用户自定义，按项目持久化） ====================

interface KeyAnalysisItem { id: string; label: string; moduleId: string; fieldName: string; visitCode?: string }

const keyAnalysisKey = (pid: string) => `crf_key_analysis_${pid}`

function loadKeyAnalyses(pid: string): KeyAnalysisItem[] | null {
  try {
    const raw = localStorage.getItem(keyAnalysisKey(pid))
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

// ==================== 记录匹配 ====================

function recordMatches(
  data: Record<string, unknown>,
  module: CRFModule,
  f: TopicFilters,
  skipFields?: Set<string>,
): boolean {
  // 可分析字段：普通字段 + 动态表格列（调用方传入的数据为展开后的行）
  for (const field of analysisFields(module)) {
    const name = field.name
    if (skipFields?.has(name)) continue
    const v = data[name]

    // 选项型（含多选、开关）
    const enumSel = f.enumFilters[name]
    if (enumSel && enumSel.length > 0) {
      if (Array.isArray(v)) {
        if (!v.some((x) => enumSel.includes(String(x)))) return false
      } else if (v === undefined || v === null || v === '' || !enumSel.includes(String(v))) {
        return false
      }
    }

    // 数值区间
    const range = f.rangeFilters[name]
    if (range && (range.min !== '' || range.max !== '')) {
      const num = Number(v)
      if (v === undefined || v === null || v === '' || Number.isNaN(num)) return false
      if (range.min !== '' && num < Number(range.min)) return false
      if (range.max !== '' && num > Number(range.max)) return false
    }

    // 日期区间
    const dr = f.dateFilters[name]
    if (dr && (dr.from !== '' || dr.to !== '')) {
      const s = String(v ?? '')
      if (!s) return false
      if (dr.from !== '' && s < dr.from) return false
      if (dr.to !== '' && s > dr.to) return false
    }

    // 文本包含
    const kw = f.textFilters[name]
    if (kw && kw.trim() !== '') {
      if (!String(v ?? '').includes(kw.trim())) return false
    }
  }
  return true
}

function hasActiveFilters(f: TopicFilters): boolean {
  return Object.values(f.enumFilters).some((a) => a.length > 0)
    || Object.values(f.rangeFilters).some((r) => r.min !== '' || r.max !== '')
    || Object.values(f.dateFilters).some((r) => r.from !== '' || r.to !== '')
    || Object.values(f.textFilters).some((t) => t.trim() !== '')
}

/** 选项值匹配（多选数组任一命中即算） */
const matchVal = (v: unknown, val: string) =>
  Array.isArray(v) ? v.some((x) => String(x) === val) : String(v ?? '') === val

// ==================== 主题查询组件 ====================

interface SearchRequest {
  text: string
  nonce: number
}

export default function TopicQuery({ searchRequest }: { searchRequest?: SearchRequest }) {
  const { projects, patients, visitData } = useAppStorage()
  const [searchParams, setSearchParams] = useSearchParams()

  // 项目由顶栏筛选框通过 URL 参数驱动；中心/模块/患者/状态/访视为页内筛选条件
  const projectNoParam = searchParams.get('projectNo') || ''
  const [centerId, setCenterId] = useState('all') // 'all' = 全部中心
  const [moduleId, setModuleId] = useState('all') // 'all' = 全部模块
  const [patientId, setPatientId] = useState('all')
  const [visitCode, setVisitCode] = useState('all')
  const [patientStatus, setPatientStatus] = useState('all')
  const [filters, setFilters] = useState<TopicFilters>(EMPTY_FILTERS)
  // 字段条件面板：默认折叠保持页面清爽；有生效条件时自动展开
  const [fieldPanelOpen, setFieldPanelOpen] = useState(false)
  const activeFieldCondCount =
    Object.values(filters.enumFilters).reduce((s, a) => s + a.length, 0)
    + Object.values(filters.rangeFilters).filter((r) => r.min !== '' || r.max !== '').length
    + Object.values(filters.dateFilters).filter((r) => r.from !== '' || r.to !== '').length
    + Object.values(filters.textFilters).filter((t) => t.trim() !== '').length
  const fieldPanelVisible = fieldPanelOpen || activeFieldCondCount > 0
  const [savedQueries, setSavedQueries] = useState<SavedQuery[]>(loadSavedQueries)
  const [saveName, setSaveName] = useState('')
  const [showSave, setShowSave] = useState(false)
  // 文字查询（顶部搜索框通过 searchRequest 驱动）
  const [chips, setChips] = useState<ParsedCondition[]>([])

  const defaultProject = projects.find((p) => p.crfModules.length > 0) ?? projects[0]
  const project: Project | undefined =
    projects.find((p) => p.projectNo === projectNoParam) ?? defaultProject
  const modules = useMemo(
    () => (project ? [...project.crfModules].sort((a, b) => a.order - b.order) : []),
    [project],
  )

  // 访视 → 模块联动：选定访视后，模块下拉只保留该访视包含的模块
  const availableModules = useMemo(() => {
    if (!project || visitCode === 'all') return modules
    const visit = project.visits.find((v) => v.code === visitCode)
    if (!visit) return modules
    return modules.filter((m) => visit.crfModuleIds.includes(m.id))
  }, [project, modules, visitCode])

  // 当前模块选择：不在可选范围内（如切换访视后失效）时回退到“全部模块”
  const resolvedModuleId = availableModules.some((m) => m.id === moduleId) ? moduleId : 'all'
  const activeModule: CRFModule | undefined =
    resolvedModuleId === 'all' ? undefined : modules.find((m) => m.id === resolvedModuleId)

  // 模块 → 访视联动：选了具体模块，访视下拉只列该模块参与的访视；全部模块则列出全部访视
  const moduleVisits = useMemo(() => {
    if (!project) return []
    const visits = [...project.visits].sort((a, b) => a.order - b.order)
    if (!activeModule) return visits
    return visits.filter((v) => v.crfModuleIds.includes(activeModule.id))
  }, [project, activeModule])

  // 切换项目/模块后访视参数可能失效，静默回退到“全部访视”
  const effectiveVisitCode = moduleVisits.some((v) => v.code === visitCode) ? visitCode : 'all'

  // 顶栏切换项目时重置页内条件
  const projectId = project?.id ?? ''
  useEffect(() => {
    setCenterId('all')
    setModuleId('all')
    setChartFieldName('')
    setStackFieldName('')
    setCompareCenter(false)
    setPatientId('all')
    setVisitCode('all')
    setPatientStatus('all')
    setFilters(EMPTY_FILTERS)
  }, [projectId])

  // 项目中心列表与患者-中心映射
  const centers = useMemo(() => project?.centers ?? [], [project])
  const centerOfPatient = useMemo(() => {
    const map = new Map<string, string | undefined>()
    for (const p of patients) map.set(p.id, p.centerId)
    return map
  }, [patients])

  // 模块切换（页内）：重置字段条件；当前访视仍包含新模块时保留访视选择
  const switchModule = (mid: string) => {
    setModuleId(mid)
    setChartFieldName('')
    setStackFieldName('')
    if (mid !== 'all' && visitCode !== 'all') {
      const visit = project?.visits.find((v) => v.code === visitCode)
      if (visit && !visit.crfModuleIds.includes(mid)) setVisitCode('all')
    }
    setFilters(EMPTY_FILTERS)
  }

  // ---------- 筛选操作 ----------
  const toggleEnum = (field: string, value: string) => {
    setFilters((prev) => {
      const cur = prev.enumFilters[field] ?? []
      const next = cur.includes(value) ? cur.filter((x) => x !== value) : [...cur, value]
      return { ...prev, enumFilters: { ...prev.enumFilters, [field]: next } }
    })
  }
  const setRange = (field: string, key: 'min' | 'max', value: string) => {
    setFilters((prev) => ({
      ...prev,
      rangeFilters: { ...prev.rangeFilters, [field]: { ...{ min: '', max: '' }, ...prev.rangeFilters[field], [key]: value } },
    }))
  }
  const setDateRange = (field: string, key: 'from' | 'to', value: string) => {
    setFilters((prev) => ({
      ...prev,
      dateFilters: { ...prev.dateFilters, [field]: { ...{ from: '', to: '' }, ...prev.dateFilters[field], [key]: value } },
    }))
  }
  const setText = (field: string, value: string) => {
    setFilters((prev) => ({ ...prev, textFilters: { ...prev.textFilters, [field]: value } }))
  }

  // ---------- 文字查询：解析 → 条件标签 → 应用 ----------
  const applyChips = (list: ParsedCondition[]) => {
    const known = list.filter((c) => c.kind !== 'unknown')
    const moduleChip = known.find((c) => c.kind === 'module')
    const fieldOptionChip = known.find((c) => c.kind === 'fieldOption' && c.moduleId)
    const mod = moduleChip?.moduleId ?? fieldOptionChip?.moduleId ?? 'all'
    let visit = 'all'
    let center = 'all'
    let status = 'all'
    let patient = 'all'
    const enumFilters: Record<string, string[]> = {}
    for (const c of known) {
      if (c.kind === 'visit' && c.visitCode) visit = c.visitCode
      if (c.kind === 'center' && c.centerId) center = c.centerId
      if (c.kind === 'status' && c.patientStatus) status = c.patientStatus
      if (c.kind === 'patient' && c.patientId) patient = c.patientId
      if (c.kind === 'fieldOption' && c.moduleId === mod && c.fieldName && c.optionValue) {
        enumFilters[c.fieldName] = [...(enumFilters[c.fieldName] ?? []), c.optionValue]
      }
    }
    setModuleId(mod)
    setVisitCode(visit)
    setCenterId(center)
    setPatientStatus(status)
    setPatientId(patient)
    setFilters({ ...EMPTY_FILTERS, enumFilters })
    // 查询识别到具体字段条件时，统计图自动锁定该字段（如「药物相关的不良事件」→ 与试验药物关系）
    const optChip = known.find((c) => c.kind === 'fieldOption' && c.moduleId === mod && c.fieldName)
    if (optChip?.fieldName) setChartFieldName(optChip.fieldName)
  }

  const runTextQuery = (text: string) => {
    if (!text.trim() || !project) return
    const parsed = parseQueryText(text.trim(), project, patients)
    setChips(parsed)
    applyChips(parsed)
  }

  // 顶部搜索框提交的查询：nonce 变化时执行解析（含从高级筛选切回时的首次挂载）
  const searchNonce = searchRequest?.nonce ?? 0
  useEffect(() => {
    if (searchNonce > 0 && searchRequest?.text) runTextQuery(searchRequest.text)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchNonce])

  const removeChip = (id: string) => {
    const next = chips.filter((c) => c.id !== id)
    setChips(next)
    applyChips(next)
  }

  const clearChips = () => {
    setChips([])
    applyChips([])
  }

  // ---------- 命中计算（实时联动） ----------
  // 基础命中：项目+中心+患者+访视+模块（不含字段条件），供图表分布使用
  const baseRecords: VisitData[] = useMemo(() => {
    if (!project) return []
    return visitData.filter((vd) => {
      if (vd.projectId !== project.id) return false
      if (patientId !== 'all' && vd.patientId !== patientId) return false
      if (centerId !== 'all' && centerOfPatient.get(vd.patientId) !== centerId) return false
      if (effectiveVisitCode !== 'all') {
        const visit = project.visits.find((v) => v.id === vd.visitId)
        if (visit?.code !== effectiveVisitCode) return false
      }
      if (resolvedModuleId !== 'all' && vd.moduleId !== resolvedModuleId) return false
      return true
    })
  }, [project, visitData, patientId, centerId, centerOfPatient, effectiveVisitCode, resolvedModuleId])

  // 分析行：具体模块时按动态表格行展开（无表格则每记录一行；行=顶层标量+表格行合并）
  const analysisRows = useMemo(() => {
    if (!activeModule) return baseRecords.map((vd) => ({ vd, row: vd.data }))
    return baseRecords.flatMap((vd) => explodeRows(activeModule, vd).map((row) => ({ vd, row })))
  }, [baseRecords, activeModule])

  // 最终命中行：具体模块时叠加字段条件（行级命中，例数=行数，如不良事件条数）
  const matchedRows = useMemo(() => {
    if (!project) return []
    if (resolvedModuleId === 'all' || !activeModule) return analysisRows
    return analysisRows.filter(({ row }) => recordMatches(row, activeModule, filters))
  }, [project, analysisRows, resolvedModuleId, activeModule, filters])

  // 命中记录（VisitData 视图：患者推导与计数；同一记录的多行算多例）
  const matchedRecords: VisitData[] = useMemo(() => matchedRows.map((r) => r.vd), [matchedRows])

  const matchedPatients: Patient[] = useMemo(() => {
    const ids = new Set(matchedRecords.map((r) => r.patientId))
    return patients.filter((p) => {
      if (!ids.has(p.id)) return false
      if (patientId !== 'all' && p.id !== patientId) return false
      if (centerId !== 'all' && p.centerId !== centerId) return false
      if (patientStatus !== 'all' && p.status !== patientStatus) return false
      return true
    })
  }, [matchedRecords, patients, patientId, centerId, patientStatus])

  const recordCountOf = (patientId: string) =>
    matchedRecords.filter((r) => r.patientId === patientId).length

  const latestRecordOf = (patientId: string) => {
    const recs = matchedRecords
      .filter((r) => r.patientId === patientId)
      .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))
    return recs[recs.length - 1]
  }

  /** 患者维度的字段展示值：表格列取该患者全部命中行的列值去重拼接，普通字段取最新记录值 */
  const patientCellText = (patientId: string, field: AnalysisField) => {
    if (field.tableName) {
      const vals = matchedRows
        .filter((r) => r.vd.patientId === patientId)
        .map((r) => cellText(field, r.row[field.name]))
        .filter((t) => t && t !== '-')
      return Array.from(new Set(vals)).join('；') || '-'
    }
    const rec = latestRecordOf(patientId)
    return cellText(field, rec?.data[field.name])
  }

  const scopePatients = project ? patients.filter((p) => p.projectId === project.id).length : 0
  const isAllModules = resolvedModuleId === 'all'
  const displayFields = useMemo(
    () =>
      (activeModule ? analysisFields(activeModule) : [])
        .filter((f) => !['label', 'table', 'richText', 'fileUpload'].includes(f.type))
        .slice(0, 6),
    [activeModule],
  )
  const moduleNameOf = (moduleId: string | undefined) =>
    project?.crfModules.find((m) => m.id === moduleId)?.name ?? ''
  const visitCodeOf = (visitId: string | undefined) =>
    project?.visits.find((v) => v.id === visitId)?.code ?? ''

  // ---------- 目标字段统计图 ----------
  // 仅在选定目标模块时出图：横轴=目标字段取值，纵轴=命中记录数
  // 可选「叠加字段」做二维交叉（堆叠柱）；「按中心对比」与叠加字段互斥
  const [chartFieldName, setChartFieldName] = useState('')
  const [stackFieldName, setStackFieldName] = useState('')
  const [compareCenter, setCompareCenter] = useState(false)
  const [chartType, setChartType] = useState<ChartType>('pie')

  // 字段分类：选项型 → 饼图/柱状图；数值型 → 分布直方图（自动分桶）
  const isOptionField = (f: CRFField) =>
    (((f.type === 'select' || f.type === 'radio' || f.type === 'checkbox') && (f.options?.length ?? 0) > 0)
      || f.type === 'toggle')
  const isNumericField = (f: CRFField) => f.type === 'number' || f.type === 'scale'

  // 目标模块中可统计的字段（选项型 + 数值型；动态表格的列也参与）
  const chartFields = useMemo(() => {
    if (!activeModule) return []
    return analysisFields(activeModule).filter((f) => isOptionField(f) || isNumericField(f))
  }, [activeModule])

  const chartField = useMemo(
    () => chartFields.find((f) => f.name === chartFieldName) ?? chartFields[0],
    [chartFields, chartFieldName],
  )
  const numericChart = chartField ? isNumericField(chartField) : false

  // 切换统计字段时给图型一个智能默认：选项型 → 饼图（看占比）；数值型 → 柱状图（看分布）
  const chartFieldKey = chartField?.name ?? ''
  useEffect(() => {
    setChartType(numericChart ? 'bar' : 'pie')
  }, [chartFieldKey, numericChart])

  // 叠加字段：只能是选项型，且不能与统计字段相同
  const stackField = useMemo(
    () => chartFields.find((f) => f.name === stackFieldName && f.name !== chartField?.name && isOptionField(f)),
    [chartFields, stackFieldName, chartField],
  )

  const fieldOptionsOf = (f: CRFField | undefined) => {
    if (!f) return []
    return f.type === 'toggle'
      ? [{ value: 'true', label: '是' }, { value: 'false', label: '否' }]
      : f.options ?? []
  }

  const stackOptions = useMemo(() => fieldOptionsOf(stackField), [stackField])

  // ---------- 重点数据分析：默认自动扫描，支持用户自定义（按项目持久化） ----------
  const applyPreset = (mid: string, fieldName: string, visit = 'all') => {
    setModuleId(mid)
    setChartFieldName(fieldName)
    setStackFieldName('')
    setCompareCenter(false)
    setFilters(EMPTY_FILTERS)
    const valid = visit !== 'all' && !!project?.visits.find((v) => v.code === visit)?.crfModuleIds.includes(mid)
    setVisitCode(valid ? visit : 'all')
  }

  // 返回全部数据（统计分析初始视图）
  const resetToOverview = () => {
    setModuleId('all')
    setChartFieldName('')
    setStackFieldName('')
    setCompareCenter(false)
    setFilters(EMPTY_FILTERS)
    setChips([])
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const presetStyleOf = (label: string): { icon: LucideIcon; gradient: string } => {
    if (/性别/.test(label)) return { icon: Users, gradient: 'from-sky-500 to-blue-600' }
    if (/严重|程度|分级/.test(label)) return { icon: AlertTriangle, gradient: 'from-amber-500 to-orange-600' }
    if (/药物|相关|关系/.test(label)) return { icon: Pill, gradient: 'from-violet-500 to-purple-600' }
    if (/转归|结局|恢复/.test(label)) return { icon: Activity, gradient: 'from-teal-500 to-emerald-600' }
    if (/吸烟|饮酒/.test(label)) return { icon: Cigarette, gradient: 'from-slate-500 to-slate-600' }
    if (/体征|血压|脉搏|体温|呼吸/.test(label)) return { icon: HeartPulse, gradient: 'from-rose-500 to-pink-600' }
    return { icon: BarChart3, gradient: 'from-blue-500 to-indigo-600' }
  }

  // 自动扫描的候选项（项目内全部可统计字段；选项型优先，更贴合常用统计）
  const autoPresetItems: KeyAnalysisItem[] = useMemo(() => {
    const optionFound: KeyAnalysisItem[] = []
    const numericFound: KeyAnalysisItem[] = []
    for (const m of modules) {
      for (const f of analysisFields(m)) {
        const item = { id: `${m.id}:${f.name}`, label: `${f.label.split('·').pop()}分布`, moduleId: m.id, fieldName: f.name }
        if (isOptionField(f)) optionFound.push(item)
        else if (isNumericField(f)) numericFound.push(item)
      }
    }
    return [...optionFound, ...numericFound]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modules])

  // 用户自定义列表（null = 未自定义过，用自动默认）
  const [customPresets, setCustomPresets] = useState<KeyAnalysisItem[] | null>(null)
  const [showAddPreset, setShowAddPreset] = useState(false)
  const [addModuleId, setAddModuleId] = useState('')
  const [addFieldName, setAddFieldName] = useState('')
  const [addLabel, setAddLabel] = useState('')
  const [addVisitCode, setAddVisitCode] = useState('all')

  useEffect(() => {
    setCustomPresets(projectId ? loadKeyAnalyses(projectId) : null)
  }, [projectId])

  const presetItems = customPresets ?? autoPresetItems.slice(0, 8)

  const persistPresets = (list: KeyAnalysisItem[]) => {
    setCustomPresets(list)
    if (projectId) localStorage.setItem(keyAnalysisKey(projectId), JSON.stringify(list))
  }

  // 拖拽排序：把 fromKey 移到 toKey 的位置，顺序随列表持久化
  const reorderPreset = (fromKey: string, toKey: string) => {
    const from = presetItems.findIndex((x) => x.id === fromKey)
    const to = presetItems.findIndex((x) => x.id === toKey)
    if (from < 0 || to < 0 || from === to) return
    const list = [...presetItems]
    const [item] = list.splice(from, 1)
    list.splice(to, 0, item)
    persistPresets(list)
  }

  const presets: QuickPreset[] = presetItems.map((it) => {
    const st = presetStyleOf(it.label)
    const mod = modules.find((m) => m.id === it.moduleId)
    const visit = it.visitCode && it.visitCode !== 'all' ? project?.visits.find((v) => v.code === it.visitCode) : undefined
    return {
      key: it.id,
      label: it.label,
      sub: `${mod?.name ?? ''}${visit ? ` · ${visit.code} ${visit.name}` : ''}`,
      icon: st.icon,
      gradient: st.gradient,
      onClick: () => applyPreset(it.moduleId, it.fieldName, it.visitCode ?? 'all'),
      onDelete: () => persistPresets(presetItems.filter((x) => x.id !== it.id)),
    }
  })

  const openAddPreset = () => {
    setAddVisitCode('all')
    setAddModuleId(modules[0]?.id ?? '')
    setAddFieldName('')
    setAddLabel('')
    setShowAddPreset(true)
  }

  // 目标访视 → 目标模块联动：选了具体访视后，模块下拉只列该访视包含的模块
  const addPresetModules = useMemo(() => {
    if (addVisitCode === 'all') return modules
    const visit = project?.visits.find((v) => v.code === addVisitCode)
    if (!visit) return modules
    return modules.filter((m) => visit.crfModuleIds.includes(m.id))
  }, [modules, addVisitCode, project])

  const addPresetFields = useMemo(() => {
    const m = addPresetModules.find((x) => x.id === addModuleId)
    return m ? analysisFields(m).filter((f) => isOptionField(f) || isNumericField(f)) : []
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addPresetModules, addModuleId])

  const savePreset = () => {
    const field = addPresetFields.find((f) => f.name === addFieldName)
    if (!field || !addModuleId) return
    const label = addLabel.trim() || `${field.label.split('·').pop()}分布`
    const item: KeyAnalysisItem = { id: `${addVisitCode}:${addModuleId}:${addFieldName}`, label, moduleId: addModuleId, fieldName: addFieldName, visitCode: addVisitCode }
    persistPresets([...presetItems.filter((x) => x.id !== item.id), item])
    setShowAddPreset(false)
  }

  // 图表数据：基础筛选 + 其他字段的条件（横轴字段与叠加字段自身除外，保证各分类/区间完整可见）
  // 效果：在筛选面板点击「有关」等分类标签，图表立即变为该分类下的分布
  const chartBaseRows = useMemo(() => {
    if (!activeModule || !chartField) return analysisRows
    const skip = new Set<string>([chartField.name])
    if (stackField) skip.add(stackField.name)
    return analysisRows.filter(({ row }) => recordMatches(row, activeModule, filters, skip))
  }, [analysisRows, activeModule, chartField, stackField, filters])

  const chartRows: ChartRow[] = useMemo(() => {
    if (!project || !activeModule || !chartField) return []
    type Row = { vd: VisitData; row: Record<string, unknown> }
    const numOf = (v: unknown) => {
      if (v === undefined || v === null || v === '') return NaN
      return Number(v)
    }
    const fillDimensions = (row: ChartRow, base: Row[]) => {
      row.__total = base.length
      if (stackField) {
        for (const so of stackOptions) {
          row[`stk:${so.value}`] = base.filter((r) => matchVal(r.row[stackField.name], so.value)).length
        }
      } else {
        for (const c of centers) {
          row[c.id] = base.filter((r) => centerOfPatient.get(r.vd.patientId) === c.id).length
        }
      }
      return row
    }

    // 数值型字段：自动分桶直方图
    if (isNumericField(chartField)) {
      const vals = chartBaseRows.map((r) => numOf(r.row[chartField.name])).filter((n) => !Number.isNaN(n))
      if (vals.length === 0) return []
      let mn = Math.min(...vals)
      let mx = Math.max(...vals)
      if (mn === mx) { mn -= 0.5; mx += 0.5 }
      const BUCKETS = 6
      const w = (mx - mn) / BUCKETS
      const fmt = (n: number) => (mx - mn) <= 10 ? n.toFixed(1) : String(Math.round(n))
      return Array.from({ length: BUCKETS }, (_, i) => {
        const lo = mn + i * w
        const hi = mn + (i + 1) * w
        const base = chartBaseRows.filter((r) => {
          const n = numOf(r.row[chartField.name])
          if (Number.isNaN(n)) return false
          return i === BUCKETS - 1 ? n >= lo && n <= hi : n >= lo && n < hi
        })
        const row: ChartRow = { label: `${fmt(lo)}~${fmt(hi)}`, value: `${lo}|${hi}`, __total: 0 }
        return fillDimensions(row, base)
      })
    }

    // 选项型字段：按选项统计
    const opts = fieldOptionsOf(chartField)
    return opts.map((o) => {
      const base = chartBaseRows.filter((r) => matchVal(r.row[chartField.name], o.value))
      const row: ChartRow = { label: o.label, value: o.value, __total: 0 }
      return fillDimensions(row, base)
    })
  }, [project, activeModule, chartField, stackField, stackOptions, centers, chartBaseRows, centerOfPatient])

  const chartTotal = useMemo(
    () => chartRows.reduce((s, r) => s + r.__total, 0),
    [chartRows],
  )

  // 图型实际生效值：数值字段 / 叠加字段 / 中心对比时饼图不可用，回退柱状图
  const pieDisabled = numericChart || !!stackField || compareCenter
  const effectiveChartType: ChartType = pieDisabled && chartType === 'pie' ? 'bar' : chartType

  // 分类明细（图右侧列表）：类别 + 例数 + 占比，点击叠加条件
  const categorySlices = useMemo(
    () => chartRows.map((r, i) => ({
      label: r.label, value: r.value, count: r.__total, color: PALETTE[i % PALETTE.length],
    })),
    [chartRows],
  )

  // ---------- 模块画像：全字段自动画像（交叉筛选，跳过字段自身条件） ----------
  // 选项 → 分布条；数值 → 迷你直方图；日期 → 区间分布；文本 → TOP 值榜（无重复值的字段如姓名自动跳过）
  const PROFILE_SKIP_TYPES = ['label', 'table', 'richText', 'fileUpload', 'signature', 'numberRange', 'textarea', 'unit', 'range', 'flag']
  const profileData: ProfileItem[] = useMemo(() => {
    if (!activeModule) return []
    return analysisFields(activeModule)
      .filter((f) => !PROFILE_SKIP_TYPES.includes(f.type))
      .map((f): ProfileItem | null => {
        const skip = new Set<string>([f.name])
        const rows = analysisRows.filter(({ row }) => recordMatches(row, activeModule, filters, skip))
        const vals = rows
          .map((r) => r.row[f.name])
          .filter((v) => v !== undefined && v !== null && v !== '')

        // 选项型 → 分类分布
        if (isOptionField(f)) {
          const slices = fieldOptionsOf(f).map((o, i) => ({
            label: o.label,
            value: o.value,
            count: rows.filter((r) => matchVal(r.row[f.name], o.value)).length,
            color: PALETTE[i % PALETTE.length],
          }))
          return { fieldId: f.id, fieldName: f.name, label: f.label, kind: 'enum', total: rows.length, slices }
        }

        // 数值型 → 自动分桶直方图
        if (isNumericField(f)) {
          const nums = vals.map(Number).filter((n) => !Number.isNaN(n))
          if (nums.length === 0) return null
          let mn = Math.min(...nums)
          let mx = Math.max(...nums)
          if (mn === mx) { mn -= 0.5; mx += 0.5 }
          const BUCKETS = 6
          const w = (mx - mn) / BUCKETS
          const fmt = (n: number) => (mx - mn) <= 10 ? n.toFixed(1) : String(Math.round(n))
          const buckets = Array.from({ length: BUCKETS }, (_, i) => {
            const lo = mn + i * w
            const hi = mn + (i + 1) * w
            const count = nums.filter((n) => (i === BUCKETS - 1 ? n >= lo && n <= hi : n >= lo && n < hi)).length
            return { label: `${fmt(lo)}~${fmt(hi)}`, lo: String(lo), hi: String(hi), count }
          })
          return { fieldId: f.id, fieldName: f.name, label: f.label, kind: 'numeric', total: nums.length, slices: [], buckets }
        }

        // 日期型 → 时间区间分布
        if (f.type === 'date' || f.type === 'datetime') {
          const ts = vals.map((v) => new Date(String(v)).getTime()).filter((t) => !Number.isNaN(t))
          if (ts.length === 0) return null
          let mn = Math.min(...ts)
          let mx = Math.max(...ts)
          if (mn === mx) { mn -= 43200000; mx += 43200000 }
          const BUCKETS = 6
          const w = (mx - mn) / BUCKETS
          const fmtDate = (t: number) => new Date(t).toISOString().slice(0, 10)
          const fmtShort = (t: number) => new Date(t).toISOString().slice(2, 7).replace('-', '/')
          const buckets = Array.from({ length: BUCKETS }, (_, i) => {
            const lo = mn + i * w
            const hi = mn + (i + 1) * w
            const count = ts.filter((t) => (i === BUCKETS - 1 ? t >= lo && t <= hi : t >= lo && t < hi)).length
            return { label: `${fmtShort(lo)}~${fmtShort(hi)}`, lo: fmtDate(lo), hi: fmtDate(hi), count }
          })
          return { fieldId: f.id, fieldName: f.name, label: f.label, kind: 'date', total: ts.length, slices: [], buckets }
        }

        // 其余（文本等）→ TOP 值榜；身份标识类字段（姓名/证件/电话）与无重复值的高基数字段自动跳过
        if (/姓名|身份证|联系电话|联系方式|证件/.test(f.label)) return null
        const counts = new Map<string, number>()
        for (const v of vals) {
          const s = String(v)
          counts.set(s, (counts.get(s) ?? 0) + 1)
        }
        const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1])
        if (sorted.length === 0 || sorted[0][1] < 2) return null
        const slices = sorted.slice(0, 5).map(([label, count], i) => ({
          label, value: label, count, color: PALETTE[i % PALETTE.length],
        }))
        return { fieldId: f.id, fieldName: f.name, label: f.label, kind: 'text', total: vals.length, slices }
      })
      .filter((p): p is ProfileItem => p !== null && p.total > 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeModule, analysisRows, filters])

  // 画像交叉筛选：数值 / 日期区间叠加（再次点击取消）
  const toggleProfileBucket = (fieldName: string, lo: string, hi: string, kind: 'numeric' | 'date') => {
    if (kind === 'numeric') {
      setFilters((prev) => {
        const cur = prev.rangeFilters[fieldName]
        const same = cur && cur.min === lo && cur.max === hi
        return {
          ...prev,
          rangeFilters: { ...prev.rangeFilters, [fieldName]: same ? { min: '', max: '' } : { min: lo, max: hi } },
        }
      })
    } else {
      setFilters((prev) => {
        const cur = prev.dateFilters[fieldName]
        const same = cur && cur.from === lo && cur.to === hi
        return {
          ...prev,
          dateFilters: { ...prev.dateFilters, [fieldName]: same ? { from: '', to: '' } : { from: lo, to: hi } },
        }
      })
    }
  }

  // 画像交叉筛选：文本 TOP 值叠加（再次点击取消）
  const toggleProfileText = (fieldName: string, value: string) => {
    setFilters((prev) => ({
      ...prev,
      textFilters: { ...prev.textFilters, [fieldName]: prev.textFilters[fieldName] === value ? '' : value },
    }))
  }

  // ---------- 跨访视趋势：数值字段 → 各访视均值；选项字段 → 各访视命中例数 ----------
  const trendData: TrendPoint[] = useMemo(() => {
    if (!project || !activeModule || !chartField || effectiveVisitCode !== 'all') return []
    const visits = [...project.visits]
      .filter((v) => v.crfModuleIds.includes(activeModule.id))
      .sort((a, b) => a.order - b.order)
    if (visits.length < 2) return []
    return visits.map((v) => {
      const rows = chartBaseRows.filter((r) => r.vd.visitId === v.id)
      if (isNumericField(chartField)) {
        const nums = rows
          .map((r) => Number(r.row[chartField.name]))
          .filter((n) => !Number.isNaN(n))
        return {
          code: v.code, name: v.name,
          value: nums.length ? +(nums.reduce((s, n) => s + n, 0) / nums.length).toFixed(1) : null,
          count: nums.length,
        }
      }
      return { code: v.code, name: v.name, value: rows.length, count: rows.length }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project, activeModule, chartField, effectiveVisitCode, chartBaseRows])

  // 点击柱子：选项型叠加该选项；数值型叠加/取消该区间；堆叠模式再叠加叠加字段取值
  const handleBarClick = (rowValue: string, stackValue?: string) => {
    if (!chartField) return
    if (numericChart) {
      const [lo, hi] = rowValue.split('|')
      setFilters((prev) => {
        const cur = prev.rangeFilters[chartField.name]
        const same = cur && cur.min === lo && cur.max === hi
        return {
          ...prev,
          rangeFilters: {
            ...prev.rangeFilters,
            [chartField.name]: same ? { min: '', max: '' } : { min: lo, max: hi },
          },
        }
      })
    } else {
      toggleEnum(chartField.name, rowValue)
    }
    if (stackField && stackValue !== undefined) toggleEnum(stackField.name, stackValue)
  }

  // 选择叠加字段：自动关闭中心对比（三维无法同图展示）
  const changeStackField = (name: string) => {
    setStackFieldName(name)
    if (name) setCompareCenter(false)
  }
  // 打开中心对比：自动取消叠加字段
  const toggleCompareCenter = () => {
    setCompareCenter((v) => {
      if (!v) setStackFieldName('')
      return !v
    })
  }

  // ---------- 保存查询 ----------
  const persistSaved = (list: SavedQuery[]) => {
    setSavedQueries(list)
    localStorage.setItem(SAVED_KEY, JSON.stringify(list))
  }

  const saveCurrent = () => {
    const name = saveName.trim()
    if (!name || !project) return
    persistSaved([
      ...savedQueries,
      {
        id: `sq_${Date.now()}`, name,
        projectId: project.id, moduleId: resolvedModuleId, visitCode, patientStatus,
        ...filters,
        createdAt: new Date().toISOString(),
      },
    ])
    setSaveName('')
    setShowSave(false)
  }

  const applySaved = (q: SavedQuery) => {
    const proj = projects.find((x) => x.id === q.projectId)
    const newParams = new URLSearchParams(searchParams)
    if (proj) newParams.set('projectNo', proj.projectNo)
    setSearchParams(newParams)
    setModuleId(q.moduleId)
    setVisitCode(q.visitCode)
    setPatientStatus(q.patientStatus)
    setFilters({
      enumFilters: q.enumFilters ?? {},
      rangeFilters: q.rangeFilters ?? {},
      textFilters: q.textFilters ?? {},
      dateFilters: q.dateFilters ?? {},
    })
  }

  const deleteSaved = (id: string) => {
    persistSaved(savedQueries.filter((q) => q.id !== id))
  }

  // ---------- 导出 ----------
  const exportRecords = () => {
    if (!project) return
    // 全部模块：长表导出（每个字段一行）
    if (resolvedModuleId === 'all') {
      const header = [
        '项目编号', '筛选编号', '随机编号', '姓名缩写', '患者状态',
        '访视编码', '访视名称', '模块', '字段', '字段标识', '值', '数据状态', '更新时间',
      ]
      const rows: (string | number)[][] = []
      for (const vd of matchedRecords) {
        const patient = patients.find((p) => p.id === vd.patientId)
        const visit = project.visits.find((v) => v.id === vd.visitId)
        const mod = project.crfModules.find((m) => m.id === vd.moduleId)
        const base = [
          project.projectNo, patient?.screeningId ?? '', patient?.randomizationId ?? '',
          patient?.nameInitials ?? '', PATIENT_STATUS_LABELS[patient?.status ?? ''] ?? '',
          visit?.code ?? '', visit?.name ?? '', mod?.name ?? '',
        ]
        const fields = (mod?.fields ?? []).filter((f) => f.type !== 'label')
        for (const f of fields) {
          const v = vd.data[f.name]
          if (v === undefined || v === null || v === '') continue
          rows.push([
            ...base, f.label, f.name, cellText(f, v),
            vd.status === 'completed' ? '已完成' : vd.status === 'in_progress' ? '录入中' : vd.status,
            vd.updatedAt.slice(0, 10),
          ])
        }
      }
      downloadCsv(`全部模块_命中记录_${dateTag()}.csv`, [header, ...rows])
      return
    }
    // 具体模块：宽表导出（每个分析行一行，字段为列；动态表格按行展开）
    if (!activeModule) return
    const fields = analysisFields(activeModule).filter((f) => f.type !== 'label')
    const header = [
      '项目编号', '筛选编号', '随机编号', '姓名缩写', '患者状态',
      '访视编码', '访视名称',
      ...fields.map((f) => f.label),
      '数据状态', '更新时间',
    ]
    const rows = matchedRows.map(({ vd, row }) => {
      const patient = patients.find((p) => p.id === vd.patientId)
      const visit = project.visits.find((v) => v.id === vd.visitId)
      return [
        project.projectNo, patient?.screeningId ?? '', patient?.randomizationId ?? '',
        patient?.nameInitials ?? '', PATIENT_STATUS_LABELS[patient?.status ?? ''] ?? '',
        visit?.code ?? '', visit?.name ?? '',
        ...fields.map((f) => cellText(f, row[f.name])),
        vd.status === 'completed' ? '已完成' : vd.status === 'in_progress' ? '录入中' : vd.status,
        vd.updatedAt.slice(0, 10),
      ]
    })
    downloadCsv(`${activeModule.name}_命中记录_${dateTag()}.csv`, [header, ...rows])
  }

  const exportRoster = () => {
    if (!project) return
    const header = [
      '项目编号', '筛选编号', '随机编号', '姓名缩写', '性别', '年龄',
      '中心', '状态', '当前访视', '入组日期', '命中记录数',
      ...displayFields.map((f) => f.label),
    ]
    const rows = matchedPatients.map((p) => {
      return [
        project.projectNo, p.screeningId, p.randomizationId ?? '', p.nameInitials,
        p.gender === 'male' ? '男' : '女', calcAge(p.birthDate),
        centers.find((c) => c.id === p.centerId)?.name ?? '',
        PATIENT_STATUS_LABELS[p.status] ?? p.status, p.currentVisit ?? '', p.enrollmentDate ?? '',
        recordCountOf(p.id),
        ...displayFields.map((f) => patientCellText(p.id, f)),
      ]
    })
    downloadCsv(`患者清单_${dateTag()}.csv`, [header, ...rows])
  }

  // ==================== 渲染 ====================

  return (
    <div className="space-y-4">
      {/* ================= 筛选面板（基础条件 + 字段条件） ================= */}
      {modules.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3 flex-wrap">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 shrink-0"><Filter className="w-4 h-4 text-sky-500" />筛选条件</CardTitle>
              <span className="w-px h-5 bg-gradient-to-b from-sky-300 to-teal-300 shrink-0 mx-1.5" />
              {/* 基础条件：中心 → 患者 → 状态 → 访视 → 模块（与标题同行） */}
              <div className="flex flex-wrap items-center gap-2.5 flex-1">
                {centers.length > 0 && (
                  <Select value={centerId} onValueChange={setCenterId}>
                    <SelectTrigger className="w-40 h-9 bg-slate-50 border-slate-200">
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

                <Select value={patientId} onValueChange={setPatientId}>
                  <SelectTrigger className="w-44 h-9 bg-slate-50 border-slate-200">
                    <SelectValue placeholder="患者" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部患者</SelectItem>
                    {patients
                      .filter((p) => p.projectId === project?.id)
                      .filter((p) => centerId === 'all' || p.centerId === centerId)
                      .map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.screeningId} · {p.nameInitials}{p.randomizationId ? ` · ${p.randomizationId}` : ''}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>

                <Select value={patientStatus} onValueChange={setPatientStatus}>
                  <SelectTrigger className="w-32 h-9 bg-slate-50 border-slate-200">
                    <SelectValue placeholder="患者状态" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部状态</SelectItem>
                    {Object.entries(PATIENT_STATUS_LABELS).map(([v, l]) => (
                      <SelectItem key={v} value={v}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={effectiveVisitCode} onValueChange={setVisitCode}>
                  <SelectTrigger className="w-40 h-9 bg-slate-50 border-slate-200">
                    <SelectValue placeholder="访视" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部访视</SelectItem>
                    {moduleVisits.map((v) => (
                      <SelectItem key={v.id} value={v.code}>{v.code} · {v.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={resolvedModuleId} onValueChange={switchModule}>
                  <SelectTrigger className="w-36 h-9 bg-slate-50 border-slate-200">
                    <SelectValue placeholder="模块" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部模块</SelectItem>
                    {availableModules.map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* 字段条件：与筛选框同排，点击展开 / 收起 */}
                {activeModule && (
                  <button
                    onClick={() => setFieldPanelOpen(!fieldPanelVisible)}
                    className={`flex items-center gap-1.5 h-9 px-3 rounded-md border text-sm transition-colors ${
                      fieldPanelVisible
                        ? 'border-sky-300 bg-sky-50 text-sky-700'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-sky-300 hover:text-sky-600'
                    }`}
                  >
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${fieldPanelVisible ? '' : '-rotate-90'}`} />
                    字段条件
                    {activeFieldCondCount > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full bg-sky-500 text-white text-[10px] font-medium leading-none">{activeFieldCondCount}</span>
                    )}
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-auto">
                {hasActiveFilters(filters) && (
                  <Button variant="ghost" size="sm" className="text-slate-400" onClick={() => setFilters(EMPTY_FILTERS)}>
                    <RotateCcw className="w-3.5 h-3.5 mr-1" />
                    清空条件
                  </Button>
                )}
                <Button variant="ghost" size="sm" className="text-sky-600" onClick={() => setShowSave((v) => !v)}>
                  <Bookmark className="w-3.5 h-3.5 mr-1" />
                  保存为查询
                </Button>
              </div>
            </div>
          </CardHeader>
          {/* 正文仅在内容时渲染（识别标签 / 保存查询 / 已存查询 / 字段条件），否则卡片为一整行 */}
          {(chips.length > 0 || showSave || savedQueries.length > 0 || (activeModule && fieldPanelVisible)) && (
          <CardContent className="space-y-4">
            {/* 顶部文字查询识别出的条件标签 */}
            {chips.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-slate-400">识别条件：</span>
                {chips.map((chip) =>
                  chip.kind === 'unknown' ? (
                    <span
                      key={chip.id}
                      className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-slate-100 text-slate-400 text-sm border border-slate-200"
                      title="未识别，未参与筛选"
                    >
                      {chip.label}
                    </span>
                  ) : (
                    <span
                      key={chip.id}
                      className="inline-flex items-center gap-1 pl-3 pr-1.5 py-1 rounded-full bg-sky-50 text-sky-700 text-sm border border-sky-200"
                    >
                      {chip.label}
                      <button className="text-sky-400 hover:text-sky-600" onClick={() => removeChip(chip.id)}>
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  ),
                )}
                {chips.some((c) => c.kind !== 'unknown') && (
                  <button className="text-xs text-slate-400 hover:text-slate-600 underline" onClick={clearChips}>
                    清除全部
                  </button>
                )}
              </div>
            )}

            {/* 保存查询行 */}
            {showSave && (
              <div className="flex items-center gap-2 bg-sky-50 rounded-lg px-3 py-2">
                <Input
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  placeholder="给当前筛选起个名字，如：药物相关不良事件"
                  className="w-72 bg-white border-slate-200 h-9"
                  onKeyDown={(e) => e.key === 'Enter' && saveCurrent()}
                />
                <Button size="sm" className="bg-sky-500 hover:bg-sky-600 text-white" onClick={saveCurrent} disabled={!saveName.trim()}>
                  保存
                </Button>
              </div>
            )}

            {/* 已保存的查询 */}
            {savedQueries.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-slate-400">我的查询：</span>
                {savedQueries.map((q) => (
                  <span key={q.id} className="inline-flex items-center gap-1 pl-3 pr-1.5 py-1 rounded-full bg-amber-50 text-amber-700 text-sm border border-amber-200">
                    <button className="hover:underline" onClick={() => applySaved(q)}>{q.name}</button>
                    <button className="text-amber-400 hover:text-amber-600" onClick={() => deleteSaved(q.id)}>
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* CRF 字段自动生成的条件（展开时展示为双列网格） */}
            {activeModule && fieldPanelVisible && (
              <div className="border border-slate-100 rounded-xl bg-slate-50/50 px-4 py-4 grid grid-cols-1 xl:grid-cols-2 gap-x-8 gap-y-3">
              {analysisFields(activeModule).map((field) => {
                if (field.type === 'label' || field.type === 'table' || field.type === 'signature' || field.type === 'numberRange' || field.type === 'richText' || field.type === 'fileUpload') return null

                // 选项型 → 标签组
                if (field.type === 'select' || field.type === 'radio' || field.type === 'checkbox') {
                  const selected = filters.enumFilters[field.name] ?? []
                  return (
                    <div key={field.id} className="flex items-start gap-3">
                      <span className="w-36 shrink-0 text-sm text-slate-500 pt-1.5">{field.label}</span>
                      <div className="flex flex-wrap gap-1.5">
                        {field.options?.map((o) => {
                          const on = selected.includes(o.value)
                          return (
                            <button
                              key={o.value}
                              onClick={() => toggleEnum(field.name, o.value)}
                              className={`px-3 py-1 rounded-full text-sm border transition-all ${
                                on
                                  ? 'bg-sky-500 text-white border-sky-500'
                                  : 'bg-white text-slate-600 border-slate-200 hover:border-sky-300'
                              }`}
                            >
                              {o.label}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                }

                // 开关 → 是/否
                if (field.type === 'toggle') {
                  const selected = filters.enumFilters[field.name] ?? []
                  return (
                    <div key={field.id} className="flex items-start gap-3">
                      <span className="w-36 shrink-0 text-sm text-slate-500 pt-1.5">{field.label}</span>
                      <div className="flex gap-1.5">
                        {[['true', '是'], ['false', '否']].map(([v, l]) => {
                          const on = selected.includes(v)
                          return (
                            <button
                              key={v}
                              onClick={() => toggleEnum(field.name, v)}
                              className={`px-3 py-1 rounded-full text-sm border transition-all ${
                                on ? 'bg-sky-500 text-white border-sky-500' : 'bg-white text-slate-600 border-slate-200 hover:border-sky-300'
                              }`}
                            >
                              {l}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                }

                // 数值 → 区间
                if (field.type === 'number' || field.type === 'scale') {
                  const range = filters.rangeFilters[field.name] ?? { min: '', max: '' }
                  return (
                    <div key={field.id} className="flex items-center gap-3">
                      <span className="w-36 shrink-0 text-sm text-slate-500">{field.label}</span>
                      <div className="flex items-center gap-1.5">
                        <Input value={range.min} onChange={(e) => setRange(field.name, 'min', e.target.value)} placeholder="最小值" className="w-24 h-9 bg-slate-50 border-slate-200" />
                        <span className="text-slate-400">~</span>
                        <Input value={range.max} onChange={(e) => setRange(field.name, 'max', e.target.value)} placeholder="最大值" className="w-24 h-9 bg-slate-50 border-slate-200" />
                      </div>
                    </div>
                  )
                }

                // 日期 → 区间
                if (field.type === 'date' || field.type === 'datetime') {
                  const dr = filters.dateFilters[field.name] ?? { from: '', to: '' }
                  return (
                    <div key={field.id} className="flex items-center gap-3">
                      <span className="w-36 shrink-0 text-sm text-slate-500">{field.label}</span>
                      <div className="flex items-center gap-1.5">
                        <Input type="date" value={dr.from} onChange={(e) => setDateRange(field.name, 'from', e.target.value)} className="w-38 h-9 bg-slate-50 border-slate-200" />
                        <span className="text-slate-400">至</span>
                        <Input type="date" value={dr.to} onChange={(e) => setDateRange(field.name, 'to', e.target.value)} className="w-38 h-9 bg-slate-50 border-slate-200" />
                      </div>
                    </div>
                  )
                }

                // 文本 → 关键词
                const kw = filters.textFilters[field.name] ?? ''
                return (
                  <div key={field.id} className="flex items-center gap-3">
                    <span className="w-36 shrink-0 text-sm text-slate-500">{field.label}</span>
                    <Input value={kw} onChange={(e) => setText(field.name, e.target.value)} placeholder="包含关键词…" className="w-64 h-9 bg-slate-50 border-slate-200" />
                  </div>
                )
              })}
              </div>
            )}
          </CardContent>
          )}
        </Card>
      )}

      {/* ================= 统计结果分节 ================= */}
      {modules.length > 0 && (
        <div className="flex items-center gap-2.5 pt-1">
          <div className="w-1 h-4 rounded-full bg-gradient-to-b from-sky-500 to-teal-500" />
          <span className="text-sm font-semibold text-slate-700">统计结果</span>
          <span className="text-xs text-slate-400">以下图表与患者清单随筛选条件实时联动</span>
          {activeModule && (
            <button
              onClick={resetToOverview}
              className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm text-sky-600 bg-sky-50 border border-sky-200 hover:bg-sky-100 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              返回全部数据
            </button>
          )}
        </div>
      )}

      {/* ================= 命中概览 ================= */}
      {modules.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard label="命中记录" value={matchedRecords.length} unit="条" icon={FileSpreadsheet} gradient="from-sky-500 to-blue-600" sub={activeModule ? `目标模块：${activeModule.name}` : '全部模块'} />
          <StatCard label="涉及患者" value={matchedPatients.length} unit="例" icon={Users} gradient="from-teal-500 to-emerald-600" sub={`项目共 ${scopePatients} 例`} />
          <StatCard label="患者占比" value={scopePatients > 0 ? ((matchedPatients.length / scopePatients) * 100).toFixed(1) : '0.0'} unit="%" icon={PieChartIcon} gradient="from-violet-500 to-purple-600" sub="命中患者 / 项目患者" />
        </div>
      )}

      {/* ================= 重点数据分析（全部模块时展示，支持自定义） ================= */}
      {!activeModule && (presets.length > 0 || customPresets !== null) && (
        <QuickPresetRow presets={presets} onAdd={openAddPreset} onReorder={reorderPreset} />
      )}

      {/* ================= 模块画像（选定模块时展示） ================= */}
      {activeModule && profileData.length > 0 && (
        <ProfileGrid
          items={profileData}
          selected={filters.enumFilters}
          rangeSelected={filters.rangeFilters}
          dateSelected={filters.dateFilters}
          textSelected={filters.textFilters}
          onToggle={toggleEnum}
          onTextToggle={toggleProfileText}
          onBucket={toggleProfileBucket}
        />
      )}

      {/* ================= 目标字段统计图 ================= */}
      {activeModule && chartField && chartRows.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 flex-wrap">
                <BarChart3 className="w-4 h-4 text-sky-500" />
                目标字段统计
                <span className="text-sm font-normal text-slate-400">
                  纵轴为命中记录数 · 点柱子或上方筛选标签均可叠加条件
                </span>
              </CardTitle>
              <div className="flex items-center gap-2">
                <StatTypeSwitcher type={effectiveChartType} onChange={setChartType} pieDisabled={pieDisabled} />
                <Select value={chartField.name} onValueChange={setChartFieldName}>
                  <SelectTrigger className="w-40 h-8 text-sm bg-slate-50 border-slate-200">
                    <SelectValue placeholder="统计字段" />
                  </SelectTrigger>
                  <SelectContent>
                    {chartFields.map((f) => (
                      <SelectItem key={f.id} value={f.name}>{f.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={stackFieldName || 'none'} onValueChange={(v) => changeStackField(v === 'none' ? '' : v)}>
                  <SelectTrigger className="w-40 h-8 text-sm bg-slate-50 border-slate-200">
                    <SelectValue placeholder="叠加字段" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">不叠加</SelectItem>
                    {chartFields.filter((f) => f.name !== chartField.name && isOptionField(f)).map((f) => (
                      <SelectItem key={f.id} value={f.name}>叠加：{f.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  variant={compareCenter ? 'default' : 'outline'}
                  className={compareCenter ? 'bg-sky-500 hover:bg-sky-600 text-white' : 'text-slate-600'}
                  onClick={toggleCompareCenter}
                >
                  按中心对比
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex gap-6">
              <div className="flex-1 min-w-0 h-64">
                <StatMainChart
                  type={effectiveChartType}
                  numeric={numericChart}
                  rows={chartRows}
                  total={chartTotal}
                  centers={centers}
                  compareCenter={compareCenter}
                  stackOptions={stackField ? stackOptions : null}
                  onBarClick={handleBarClick}
                />
              </div>
              {!numericChart && effectiveChartType !== 'table' && (
                <div className="w-60 shrink-0 border-l border-slate-100 pl-5 overflow-auto max-h-64">
                  <div className="text-xs text-slate-400 mb-2">分类明细 · 点击叠加条件</div>
                  <CategoryList
                    slices={categorySlices}
                    total={chartTotal}
                    selected={filters.enumFilters[chartField.name]}
                    onToggle={(v) => toggleEnum(chartField.name, v)}
                  />
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ================= 跨访视趋势 ================= */}
      {activeModule && chartField && trendData.length >= 2 && trendData.some((p) => p.value !== null) && (
        <TrendChartCard points={trendData} mode={numericChart ? 'mean' : 'count'} fieldLabel={chartField.label} />
      )}

      {/* ================= 结果区 ================= */}
      {modules.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 flex-wrap">
                <Users className="w-4 h-4 text-sky-500" />
                患者清单
                <span className="text-sm font-normal text-slate-400">
                  共 <span className="text-sky-600 font-semibold">{matchedPatients.length}</span> 例命中患者 · 点击图表分类可叠加条件
                </span>
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" className="text-slate-600" onClick={exportRoster} disabled={matchedPatients.length === 0}>
                  <Download className="w-3.5 h-3.5 mr-1" />
                  导出清单
                </Button>
                <Button size="sm" className="bg-sky-500 hover:bg-sky-600 text-white" onClick={exportRecords} disabled={matchedRecords.length === 0}>
                  <FileSpreadsheet className="w-3.5 h-3.5 mr-1" />
                  导出命中记录
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="border border-slate-200 rounded-lg overflow-auto max-h-[520px]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left px-4 py-2.5 font-medium text-slate-600 whitespace-nowrap">筛选编号</th>
                    <th className="text-left px-4 py-2.5 font-medium text-slate-600 whitespace-nowrap">随机编号</th>
                    <th className="text-left px-4 py-2.5 font-medium text-slate-600 whitespace-nowrap">姓名缩写</th>
                    <th className="text-left px-4 py-2.5 font-medium text-slate-600 whitespace-nowrap">性别</th>
                    <th className="text-left px-4 py-2.5 font-medium text-slate-600 whitespace-nowrap">年龄</th>
                    <th className="text-left px-4 py-2.5 font-medium text-slate-600 whitespace-nowrap">中心</th>
                    <th className="text-left px-4 py-2.5 font-medium text-slate-600 whitespace-nowrap">状态</th>
                    <th className="text-left px-4 py-2.5 font-medium text-slate-600 whitespace-nowrap">命中条数</th>
                    {isAllModules && (
                      <>
                        <th className="text-left px-4 py-2.5 font-medium text-sky-600 whitespace-nowrap">最近命中模块</th>
                        <th className="text-left px-4 py-2.5 font-medium text-sky-600 whitespace-nowrap">最近命中访视</th>
                      </>
                    )}
                    {displayFields.map((f) => (
                      <th key={f.id} className="text-left px-4 py-2.5 font-medium text-sky-600 whitespace-nowrap">{f.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {matchedPatients.map((p) => {
                    const rec = latestRecordOf(p.id)
                    return (
                      <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50/60">
                        <td className="px-4 py-2.5 font-medium text-slate-700">{p.screeningId}</td>
                        <td className="px-4 py-2.5 text-slate-500">{p.randomizationId || '-'}</td>
                        <td className="px-4 py-2.5 text-slate-700">{p.nameInitials}</td>
                        <td className="px-4 py-2.5 text-slate-500">{p.gender === 'male' ? '男' : '女'}</td>
                        <td className="px-4 py-2.5 text-slate-500">{calcAge(p.birthDate)}</td>
                        <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap">
                          {centers.find((c) => c.id === p.centerId)?.name || '-'}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${PATIENT_STATUS_COLORS[p.status] ?? 'bg-slate-100 text-slate-500'}`}>
                            {PATIENT_STATUS_LABELS[p.status] ?? p.status}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-slate-700">{recordCountOf(p.id)}</td>
                        {isAllModules && (
                          <>
                            <td className="px-4 py-2.5 text-slate-700 whitespace-nowrap">{moduleNameOf(rec?.moduleId) || '-'}</td>
                            <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap">{visitCodeOf(rec?.visitId) || '-'}</td>
                          </>
                        )}
                        {displayFields.map((f) => (
                          <td key={f.id} className="px-4 py-2.5 text-slate-700 whitespace-nowrap">
                            {patientCellText(p.id, f)}
                          </td>
                        ))}
                      </tr>
                    )
                  })}
                  {matchedPatients.length === 0 && (
                    <tr>
                      <td colSpan={8 + displayFields.length + (isAllModules ? 2 : 0)} className="text-center py-12 text-slate-400">
                        没有符合条件的记录，请调整筛选条件
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ================= 添加重点数据分析弹窗 ================= */}
      {showAddPreset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 backdrop-blur-sm" onClick={() => setShowAddPreset(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-[420px] p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-slate-800 mb-4">添加重点数据分析</h3>
            <div className="space-y-3.5">
              <div>
                <div className="text-xs text-slate-400 mb-1.5">目标访视</div>
                <Select value={addVisitCode} onValueChange={(v) => { setAddVisitCode(v); setAddModuleId(''); setAddFieldName('') }}>
                  <SelectTrigger className="w-full bg-slate-50 border-slate-200">
                    <SelectValue placeholder="全部访视" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部访视</SelectItem>
                    {[...(project?.visits ?? [])].sort((a, b) => a.order - b.order).map((v) => (
                      <SelectItem key={v.code} value={v.code}>{v.code} {v.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <div className="text-xs text-slate-400 mb-1.5">目标模块</div>
                <Select value={addModuleId} onValueChange={(v) => { setAddModuleId(v); setAddFieldName('') }}>
                  <SelectTrigger className="w-full bg-slate-50 border-slate-200">
                    <SelectValue placeholder="选择模块" />
                  </SelectTrigger>
                  <SelectContent>
                    {addPresetModules.map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <div className="text-xs text-slate-400 mb-1.5">统计字段（选项型 / 数值型）</div>
                <Select
                  value={addFieldName}
                  onValueChange={(v) => {
                    setAddFieldName(v)
                    const f = addPresetFields.find((x) => x.name === v)
                    if (f && !addLabel.trim()) setAddLabel(`${f.label.split('·').pop()}分布`)
                  }}
                >
                  <SelectTrigger className="w-full bg-slate-50 border-slate-200">
                    <SelectValue placeholder="选择字段" />
                  </SelectTrigger>
                  <SelectContent>
                    {addPresetFields.map((f) => (
                      <SelectItem key={f.id} value={f.name}>{f.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <div className="text-xs text-slate-400 mb-1.5">显示名称（留空自动生成）</div>
                <Input
                  value={addLabel}
                  onChange={(e) => setAddLabel(e.target.value)}
                  placeholder="如：药物相关不良事件占比"
                  className="bg-slate-50 border-slate-200"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <Button variant="outline" className="text-slate-600" onClick={() => setShowAddPreset(false)}>取消</Button>
              <Button className="bg-sky-500 hover:bg-sky-600 text-white" onClick={savePreset} disabled={!addFieldName}>
                <Plus className="w-3.5 h-3.5 mr-1" />
                保存
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
