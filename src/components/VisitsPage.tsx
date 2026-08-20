import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useAppStorage } from '@/hooks/useAppStorage'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import StatCard from '@/components/StatCard'
import VisitPlanMatrix from '@/components/VisitPlanMatrix'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  CalendarCheck, CheckCircle2, Clock, AlertTriangle, BellRing, ClipboardList, Settings,
  LayoutGrid, Maximize2, Minimize2,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'

const DAY_MS = 24 * 60 * 60 * 1000
// 演示：访视计划按入组/知情日期起每 2 周一次访视估算
const VISIT_INTERVAL_DAYS = 14
// 提醒列表默认展示条数
const REMINDER_PAGE = 10

type VisitStatus = 'completed' | 'in_progress' | 'not_started'

interface PatientVisit {
  patientId: string
  patientLabel: string      // 姓名缩写
  screeningId: string
  projectId: string
  projectNo: string
  visitCode: string
  visitName: string
  visitOrder: number
  moduleCount: number
  status: VisitStatus
  plannedDate: string       // YYYY-MM-DD
  windowDays: number        // 访视窗口期 ±N 天
  diffDays: number          // 相对今天的天数（负数为已过期）
  overdue: boolean
  dueSoon: boolean          // 窗口期内（计划日 ± 窗口期）
}

const STATUS_LABELS: Record<VisitStatus, string> = {
  completed: '已完成',
  in_progress: '进行中',
  not_started: '未开始',
}

const STATUS_COLORS: Record<VisitStatus, string> = {
  completed: 'bg-green-50 text-green-600',
  in_progress: 'bg-blue-50 text-blue-600',
  not_started: 'bg-slate-100 text-slate-500',
}

/** 访视提醒行：按患者聚合，聚焦下一次待办访视 */
interface PatientReminder {
  patientId: string
  projectId: string
  screeningId: string
  patientLabel: string
  projectNo: string
  centerName: string          // 研究中心
  randomizationId: string     // 入组编号（随机编号）
  patientStatus: string       // 患者全流程状态（completed / treatment / withdrawn 等）
  currentVisitName: string   // 当前访视（上一次访视，无为 —）
  nextVisitName: string      // 下一次访视（最早未完成）
  plannedDate: string        // 下一次访视预计日期
  windowDays: number
  diffDays: number
  overdue: boolean
  dueSoon: boolean
  status: 'in_progress' | 'not_started'
  completedCount: number
  totalCount: number
  remainingCount: number        // 剩余访视次数 = 总次数 - 已完成
  rate: number               // 访视完成率 %
}

function addDays(dateStr: string, days: number): Date {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d
}

interface VisitsPageProps {
  actionLabel: string
  actionLink: (r: PatientReminder) => string
  /** entry=录入端扩展列（研究中心/入组编号/患者状态/完成率柱条）；默认管理端布局 */
  variant?: 'entry' | 'manager'
}

export default function VisitsPage({ actionLabel, actionLink, variant = 'manager' }: VisitsPageProps) {
  const { projects, patients, visitData, saveProject } = useAppStorage()
  const [searchParams] = useSearchParams()
  const selectedProjectNo = searchParams.get('projectNo') || 'all'

  // 范围：已发布且有访视设计的项目（可按顶部项目筛选）
  const scopedProjects = useMemo(
    () =>
      projects.filter(
        (p) =>
          p.crfPublished &&
          p.visits.length > 0 &&
          (selectedProjectNo === 'all' || p.projectNo === selectedProjectNo)
      ),
    [projects, selectedProjectNo]
  )

  // 患者 × 访视 明细
  const patientVisits = useMemo<PatientVisit[]>(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const result: PatientVisit[] = []

    scopedProjects.forEach((project) => {
      const projectPatients = patients.filter(
        (p) => p.projectId === project.id && p.status !== 'withdrawn' && p.status !== 'lost'
      )
      projectPatients.forEach((patient) => {
        const baseDate = patient.enrollmentDate || patient.consentDate || patient.createdAt?.slice(0, 10)
        project.visits.forEach((visit) => {
          const moduleCount = visit.crfModuleIds.length
          const records = visitData.filter((v) => v.patientId === patient.id && v.visitId === visit.id)
          const completedModules = records.filter((r) => r.status === 'completed').length
          const status: VisitStatus =
            moduleCount > 0 && completedModules >= moduleCount
              ? 'completed'
              : records.length > 0
              ? 'in_progress'
              : 'not_started'

          const planned = baseDate ? addDays(baseDate, visit.plannedDay ?? visit.order * VISIT_INTERVAL_DAYS) : null
          const windowDays = visit.windowDays ?? 3
          const diffDays = planned ? Math.ceil((planned.getTime() - today.getTime()) / DAY_MS) : 0
          const unfinished = status !== 'completed'
          // 窗口期 [计划日-窗口, 计划日+窗口]：超出窗口上限为逾期，处于窗口内为待访视
          const overdue = unfinished && !!planned && diffDays < -windowDays
          const dueSoon = unfinished && !!planned && diffDays >= -windowDays && diffDays <= windowDays

          result.push({
            patientId: patient.id,
            patientLabel: patient.nameInitials,
            screeningId: patient.screeningId || patient.screeningNo,
            projectId: project.id,
            projectNo: project.projectNo,
            visitCode: visit.code,
            visitName: visit.name,
            visitOrder: visit.order,
            moduleCount,
            status,
            plannedDate: planned ? planned.toISOString().slice(0, 10) : '-',
            windowDays,
            diffDays,
            overdue,
            dueSoon,
          })
        })
      })
    })
    return result
  }, [scopedProjects, patients, visitData])

  // 统计
  const stats = useMemo(() => {
    const completed = patientVisits.filter((v) => v.status === 'completed').length
    const inProgress = patientVisits.filter((v) => v.status === 'in_progress').length
    const overdue = patientVisits.filter((v) => v.overdue).length
    const dueSoon = patientVisits.filter((v) => v.dueSoon).length
    const rate = patientVisits.length > 0 ? Math.round((completed / patientVisits.length) * 100) : 0
    return { total: patientVisits.length, completed, inProgress, overdue, dueSoon, rate }
  }, [patientVisits])

  // 按访视堆叠柱状图
  const byVisitData = useMemo(() => {
    const map = new Map<string, { name: string; order: number; 已完成: number; 进行中: number; 未开始: number }>()
    patientVisits.forEach((v) => {
      const key = `${v.projectNo}|${v.visitCode}`
      if (!map.has(key)) map.set(key, { name: selectedProjectNo === 'all' ? `${v.projectNo} ${v.visitCode}` : v.visitCode, order: v.visitOrder, 已完成: 0, 进行中: 0, 未开始: 0 })
      const row = map.get(key)!
      if (v.status === 'completed') row['已完成']++
      else if (v.status === 'in_progress') row['进行中']++
      else row['未开始']++
    })
    return [...map.values()].sort((a, b) => a.order - b.order)
  }, [patientVisits, selectedProjectNo])

  // 全部研究视图：按研究汇总 累计完成 / 进行中 / 预计剩余
  // 预计剩余口径：在组患者按访视计划全量；退出/失访患者按最后一次有数据记录的访视顺序封顶
  // （例如计划 15 次访视，患者完成第 10 次后退出，则该患者应做访视按 10 次计）
  const byStudyData = useMemo(() => {
    if (selectedProjectNo !== 'all') return []
    return scopedProjects.map((project) => {
      const projectPatients = patients.filter((p) => p.projectId === project.id)
      let completed = 0
      let inProgress = 0
      let expected = 0
      projectPatients.forEach((patient) => {
        const isActive = patient.status !== 'withdrawn' && patient.status !== 'lost'
        let patientExpected = project.visits.length
        if (!isActive) {
          const ordersWithData = project.visits
            .filter((v) => visitData.some((r) => r.patientId === patient.id && r.visitId === v.id))
            .map((v) => v.order)
          patientExpected = ordersWithData.length > 0 ? Math.max(...ordersWithData) : 0
        }
        expected += patientExpected
        project.visits.forEach((visit) => {
          if (visit.order > patientExpected) return
          const records = visitData.filter((r) => r.patientId === patient.id && r.visitId === visit.id)
          const completedModules = records.filter((r) => r.status === 'completed').length
          if (visit.crfModuleIds.length > 0 && completedModules >= visit.crfModuleIds.length) completed++
          else if (records.length > 0) inProgress++
        })
      })
      return {
        name: project.projectNo,
        累计完成: completed,
        进行中: inProgress,
        预计剩余: Math.max(0, expected - completed - inProgress),
      }
    })
  }, [selectedProjectNo, scopedProjects, patients, visitData])

  // 按项目完成率
  const byProjectData = useMemo(() => {
    return scopedProjects.map((project) => {
      const rows = patientVisits.filter((v) => v.projectId === project.id)
      const done = rows.filter((v) => v.status === 'completed').length
      return {
        name: project.projectNo,
        title: project.name,
        done,
        total: rows.length,
        访视次数: done,
        完成率: rows.length > 0 ? Math.round((done / rows.length) * 100) : 0,
      }
    })
  }, [scopedProjects, patientVisits])

  // 单个项目视图下：按患者展示访视完成率（与总体进度条互补，不重复）
  const byPatientData = useMemo(() => {
    if (selectedProjectNo === 'all') return []
    const project = scopedProjects[0]
    if (!project) return []
    const projectPatients = patients.filter(
      (p) => p.projectId === project.id && p.status !== 'withdrawn' && p.status !== 'lost'
    )
    return projectPatients
      .map((pt) => {
        const rows = patientVisits.filter((v) => v.patientId === pt.id)
        const done = rows.filter((v) => v.status === 'completed').length
        return {
          name: `${pt.nameInitials} ${pt.screeningId || pt.screeningNo}`,
          done,
          total: rows.length,
          访视次数: done,
          完成率: rows.length > 0 ? Math.round((done / rows.length) * 100) : 0,
        }
      })
      .sort((a, b) => b.done - a.done || b.完成率 - a.完成率)
  }, [selectedProjectNo, scopedProjects, patients, patientVisits])

  // 提醒列表：按患者聚合——聚焦「下一次待办访视」，展示当前访视、预计日期、逾期天数与完成率
  const reminders = useMemo<PatientReminder[]>(() => {
    const byPatient = new Map<string, PatientVisit[]>()
    patientVisits.forEach((v) => {
      const arr = byPatient.get(v.patientId) ?? []
      arr.push(v)
      byPatient.set(v.patientId, arr)
    })
    const list: PatientReminder[] = []
    byPatient.forEach((rows, patientId) => {
      const sorted = [...rows].sort((a, b) => a.visitOrder - b.visitOrder)
      // 聚焦访视 = 最早未完成的访视（进行中优先展示为状态）
      const focusIdx = sorted.findIndex((v) => v.status !== 'completed')
      if (focusIdx === -1) return // 全部完成，无需提醒
      const focus = sorted[focusIdx]
      if (!focus.overdue && !focus.dueSoon) return
      const prev = focusIdx > 0 ? sorted[focusIdx - 1] : null
      const completedCount = sorted.filter((v) => v.status === 'completed').length
      const patient = patients.find((p) => p.id === patientId)
      const proj = projects.find((x) => x.id === focus.projectId)
      list.push({
        patientId,
        projectId: focus.projectId,
        screeningId: focus.screeningId,
        patientLabel: focus.patientLabel,
        projectNo: focus.projectNo,
        centerName: proj?.centers?.find((c) => c.id === patient?.centerId)?.name || proj?.researchCenter || '—',
        randomizationId: patient?.randomizationId || '—',
        patientStatus: patient?.status || '',
        currentVisitName: prev ? prev.visitName : '—',
        nextVisitName: focus.visitName,
        plannedDate: focus.plannedDate,
        windowDays: focus.windowDays,
        diffDays: focus.diffDays,
        overdue: focus.overdue,
        dueSoon: focus.dueSoon,
        status: focus.status === 'in_progress' ? 'in_progress' : 'not_started',
        completedCount,
        totalCount: sorted.length,
        remainingCount: sorted.length - completedCount,
        rate: sorted.length > 0 ? Math.round((completedCount / sorted.length) * 100) : 0,
      })
    })
    // 逾期优先 → 剩余访视量大的优先 → 距计划日近的优先
    return list.sort((a, b) => {
      if (a.overdue !== b.overdue) return a.overdue ? -1 : 1
      if (a.remainingCount !== b.remainingCount) return b.remainingCount - a.remainingCount
      return a.diffDays - b.diffDays
    })
  }, [patientVisits, patients, projects])

  // 提醒列表展示行数（默认 10 条，可切换 20/50/全部）
  const [reminderLimit, setReminderLimit] = useState(REMINDER_PAGE)
  const visibleReminders = reminders.slice(0, reminderLimit)

  // 访视管理 TAB：基于患者（访视提醒）/ 基于访视（计划完成情况）
  const [visitTab, setVisitTab] = useState<'patient' | 'visit'>('patient')

  // 患者图表 TAB：访视次数 / 访视完成率（图表区域支持横向滚动）
  const [patientChartTab, setPatientChartTab] = useState<'count' | 'rate'>('count')

  // 全部研究视图：项目图表 TAB（访视次数 / 访视完成率），与单研究视图操作逻辑统一
  const [projectChartTab, setProjectChartTab] = useState<'count' | 'rate'>('rate')

  // 图表布局：默认两张卡片并排，类目多时可切换各占整行（记忆用户选择）
  const [chartLayout, setChartLayout] = useState<'side' | 'full'>(() =>
    localStorage.getItem('crf_visits_chart_layout') === 'full' ? 'full' : 'side'
  )
  useEffect(() => {
    localStorage.setItem('crf_visits_chart_layout', chartLayout)
  }, [chartLayout])

  // ========== 访视窗口配置 ==========
  interface ConfigRow { visitId: string; code: string; name: string; plannedDay: number; windowDays: number }
  const configurableProjects = useMemo(
    () => projects.filter((p) => p.crfPublished && p.visits.length > 0),
    [projects]
  )
  const [configOpen, setConfigOpen] = useState(false)
  const [configProjectId, setConfigProjectId] = useState('')
  const [configRows, setConfigRows] = useState<ConfigRow[]>([])
  // 按频率批量设置：首次访视日 + 间隔天数 + 统一窗口期
  const [batchStart, setBatchStart] = useState('0')
  const [batchInterval, setBatchInterval] = useState('7')
  const [batchWindow, setBatchWindow] = useState('3')

  const applyBatch = () => {
    const start = Math.max(0, Number(batchStart) || 0)
    const interval = Math.max(0, Number(batchInterval) || 0)
    const win = Math.max(0, Number(batchWindow) || 0)
    setConfigRows((rows) => rows.map((r, i) => ({ ...r, plannedDay: start + i * interval, windowDays: win })))
  }

  // 当前弹窗中选中的项目（研究编号/标题与项目管理、CRF 配置同源，实时联动）
  const configProject = projects.find((p) => p.id === configProjectId)

  const loadConfigRows = (projectId: string) => {
    const proj = projects.find((p) => p.id === projectId)
    if (!proj) return
    setConfigRows(
      proj.visits.map((v) => ({
        visitId: v.id,
        code: v.code,
        name: v.name,
        plannedDay: v.plannedDay ?? v.order * VISIT_INTERVAL_DAYS,
        windowDays: v.windowDays ?? 3,
      }))
    )
  }

  const openConfig = () => {
    // 默认取当前筛选的项目，否则取第一个可配置项目
    const target =
      scopedProjects.length === 1 ? scopedProjects[0] : (scopedProjects[0] ?? configurableProjects[0])
    if (!target) return
    setConfigProjectId(target.id)
    loadConfigRows(target.id)
    setConfigOpen(true)
  }

  const switchConfigProject = (pid: string) => {
    setConfigProjectId(pid)
    loadConfigRows(pid)
  }

  // ========== 访视 · 模块矩阵 ==========
  // CRF 配置成功后，基于访视与访视中需执行的模块自动生成矩阵图示（访视在上方、模块在左）
  const [matrixOpen, setMatrixOpen] = useState(false)
  const [matrixProjectId, setMatrixProjectId] = useState('')
  const [matrixZoom, setMatrixZoom] = useState(false)
  const matrixProject = projects.find((p) => p.id === matrixProjectId)
  const openMatrix = () => {
    // 默认取当前筛选的项目，否则取第一个已发布项目
    const target =
      scopedProjects.length === 1 ? scopedProjects[0] : (scopedProjects[0] ?? configurableProjects[0])
    if (!target) return
    setMatrixProjectId(target.id)
    setMatrixOpen(true)
  }

  const saveConfig = () => {
    const proj = projects.find((p) => p.id === configProjectId)
    if (!proj) return
    saveProject({
      ...proj,
      visits: proj.visits.map((v) => {
        const row = configRows.find((r) => r.visitId === v.id)
        return row
          ? { ...v, plannedDay: Math.max(0, row.plannedDay || 0), windowDays: Math.max(0, row.windowDays || 0) }
          : v
      }),
    })
    setConfigOpen(false)
  }

  // 访视计划矩阵
  const planMatrix = useMemo(() => {
    const rows: {
      key: string
      projectNo: string
      visitName: string
      moduleCount: number
      expected: number
      completed: number
      inProgress: number
      rate: number
    }[] = []
    scopedProjects.forEach((project) => {
      project.visits.forEach((visit) => {
        const pv = patientVisits.filter((v) => v.projectId === project.id && v.visitCode === visit.code)
        const completed = pv.filter((v) => v.status === 'completed').length
        const inProgress = pv.filter((v) => v.status === 'in_progress').length
        rows.push({
          key: `${project.id}|${visit.id}`,
          projectNo: project.projectNo,
          visitName: visit.name,
          moduleCount: visit.crfModuleIds.length,
          expected: pv.length,
          completed,
          inProgress,
          rate: pv.length > 0 ? Math.round((completed / pv.length) * 100) : 0,
        })
      })
    })
    return rows
  }, [scopedProjects, patientVisits])

  // ========== 超窗访视 ==========
  // 判定：实际访视日期 > 计划日期 + 窗口期（最晚访视日期），超出天数 = 实际 - 最晚
  // 注：实际访视日期暂取该访视首条录入记录的创建日期；后续 CRF 将设计专门的实际访视日期字段
  interface OverWindowRow {
    patientId: string
    screeningId: string
    patientLabel: string
    projectNo: string
    visitName: string
    latestDate: string   // 最晚访视日期 = 计划日期 + 窗口期
    actualDate: string   // 实际访视日期
    overDays: number     // 超窗天数
  }

  const overWindowRows = useMemo<OverWindowRow[]>(() => {
    const rows: OverWindowRow[] = []
    scopedProjects.forEach((project) => {
      const projectPatients = patients.filter(
        (p) => p.projectId === project.id && p.status !== 'withdrawn' && p.status !== 'lost'
      )
      projectPatients.forEach((patient) => {
        const baseDate = patient.enrollmentDate || patient.consentDate || patient.createdAt?.slice(0, 10)
        if (!baseDate) return
        project.visits.forEach((visit) => {
          // 该访视有录入记录才存在实际访视日期
          const recs = visitData.filter((v) => v.patientId === patient.id && v.visitId === visit.id)
          if (recs.length === 0) return
          // 实际访视日期：优先取「访视信息」模块中录入的实际访视日期字段，否则取最早录入日期
          const visitDateRec = recs.find((r) => typeof r.data?.visitDate === 'string' && r.data.visitDate)
          const actual = visitDateRec
            ? (visitDateRec.data.visitDate as string)
            : recs.map((r) => r.createdAt.slice(0, 10)).sort()[0]
          const plannedDay = visit.plannedDay ?? visit.order * VISIT_INTERVAL_DAYS
          const windowDays = visit.windowDays ?? 3
          const latest = addDays(baseDate, plannedDay + windowDays).toISOString().slice(0, 10)
          const overDays = Math.round((new Date(actual).getTime() - new Date(latest).getTime()) / DAY_MS)
          if (overDays > 0) {
            rows.push({
              patientId: patient.id,
              screeningId: patient.screeningId || patient.screeningNo,
              patientLabel: patient.nameInitials,
              projectNo: project.projectNo,
              visitName: visit.name,
              latestDate: latest,
              actualDate: actual,
              overDays,
            })
          }
        })
      })
    })
    // 超窗天数多的排前面
    return rows.sort((a, b) => b.overDays - a.overDays)
  }, [scopedProjects, patients, visitData])

  // 超窗统计图：全部研究按研究汇总超窗次数与累计超窗天数；单个研究按访视汇总超窗例数与平均超窗天数
  const overWindowChartData = useMemo(() => {
    if (selectedProjectNo === 'all') {
      const map = new Map<string, { name: string; 超窗次数: number; 累计超窗天数: number }>()
      overWindowRows.forEach((r) => {
        if (!map.has(r.projectNo)) map.set(r.projectNo, { name: r.projectNo, 超窗次数: 0, 累计超窗天数: 0 })
        const row = map.get(r.projectNo)!
        row['超窗次数']++
        row['累计超窗天数'] += r.overDays
      })
      return [...map.values()].sort((a, b) => b['超窗次数'] - a['超窗次数'])
    }
    const map = new Map<string, { name: string; order: number; 超窗例数: number; totalDays: number }>()
    overWindowRows.forEach((r) => {
      const key = r.visitName
      if (!map.has(key)) {
        const pv = patientVisits.find((v) => v.projectNo === r.projectNo && v.visitName === r.visitName)
        map.set(key, { name: key, order: pv?.visitOrder ?? 0, 超窗例数: 0, totalDays: 0 })
      }
      const row = map.get(key)!
      row['超窗例数']++
      row.totalDays += r.overDays
    })
    return [...map.values()]
      .sort((a, b) => a.order - b.order)
      .map((r) => ({ name: r.name, 超窗例数: r['超窗例数'], 平均超窗天数: Math.round(r.totalDays / r['超窗例数']) }))
  }, [overWindowRows, selectedProjectNo, patientVisits])

  const OVERWINDOW_PAGE = 8
  const [showAllOverWindow, setShowAllOverWindow] = useState(false)
  const visibleOverWindow = showAllOverWindow ? overWindowRows : overWindowRows.slice(0, OVERWINDOW_PAGE)

  const statCards = [
    { label: '计划访视总数', value: stats.total, unit: '次', sub: `覆盖 ${new Set(patientVisits.map((v) => v.patientId)).size} 例患者`, icon: CalendarCheck, gradient: 'from-blue-500 to-blue-600' },
    { label: '已完成访视', value: stats.completed, unit: '次', sub: `完成率 ${stats.rate}%`, icon: CheckCircle2, gradient: 'from-emerald-500 to-green-600' },
    { label: '进行中', value: stats.inProgress, unit: '次', sub: '已开始 · 录入未完成', icon: Clock, gradient: 'from-cyan-500 to-sky-600' },
    { label: '逾期未访视', value: stats.overdue, unit: '次', sub: '需尽快安排访视', icon: AlertTriangle, gradient: 'from-red-500 to-rose-600' },
    { label: '窗口期待访视', value: stats.dueSoon, unit: '次', sub: '窗口期内 · 优先提醒', icon: BellRing, gradient: 'from-amber-500 to-orange-500' },
  ]

  return (
    <div className="space-y-4">
      {/* 统计卡片（全站统一 StatCard） */}
      <div className="grid grid-cols-5 gap-4">
        {statCards.map((s) => (
          <StatCard
            key={s.label}
            label={s.label}
            value={s.value}
            unit={s.unit}
            sub={s.sub}
            icon={s.icon}
            gradient={s.gradient}
          />
        ))}
      </div>

      {/* 总体完成率 */}
      <Card className="bg-white">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-500">总体访视完成率</span>
            <span className="text-lg font-bold text-sky-600">{stats.rate}%</span>
          </div>
          <Progress value={stats.rate} className="h-2.5" />
          <p className="text-[11px] text-slate-400 mt-2">
            计划日期按各项目访视计划配置（入组/知情后第 N 天 ± 窗口期）计算，可在下方「访视窗口配置」中调整；逾期与窗口期内的访视会在提醒列表中置顶。
          </p>
        </CardContent>
      </Card>

      {/* 图表区：默认两张卡片并排；类目多时可切换为各占整行 */}
      <div className="flex items-center justify-end gap-1.5">
        <span className="text-xs text-slate-400">图表布局</span>
        <div className="flex items-center gap-0.5 bg-white border border-slate-200 rounded-lg p-0.5">
          {([
            { key: 'side', label: '并排' },
            { key: 'full', label: '整行' },
          ] as const).map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setChartLayout(key)}
              className={`px-2.5 py-1 rounded-md text-xs transition-colors ${
                chartLayout === key ? 'bg-sky-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className={chartLayout === 'side' ? 'grid grid-cols-2 gap-4 items-stretch' : 'space-y-4'}>
      <Card className="bg-white">
        <CardContent className="p-4">
          <h3 className="text-sm font-medium text-slate-700 mb-2 text-center">
            {selectedProjectNo === 'all' ? '各研究访视进度汇总' : '各访视完成情况'}
          </h3>
          {selectedProjectNo === 'all' ? (
            /* 全部研究：按研究汇总 累计完成/进行中/预计剩余（退出患者按最后数据访视封顶） */
            <>
              <div className="overflow-x-auto">
                <div style={{ width: `max(${byStudyData.length * 96}px, 100%)`, height: 260 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={byStudyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} />
                      <YAxis tick={{ fontSize: 10 }} allowDecimals={false} width={32} />
                      <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                      <Legend wrapperStyle={{ fontSize: 10 }} />
                      <Bar dataKey="累计完成" stackId="a" fill="#22c55e" maxBarSize={64} radius={[0, 0, 0, 0]} />
                      <Bar dataKey="进行中" stackId="a" fill="#3b82f6" maxBarSize={64} radius={[0, 0, 0, 0]} />
                      <Bar dataKey="预计剩余" stackId="a" fill="#cbd5e1" maxBarSize={64} radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <p className="text-[11px] text-slate-400 mt-2 text-center">
                预计剩余 = 应做访视总数 − 累计完成 − 进行中；退出/失访患者的应做访视按最后一次有数据记录的访视封顶
              </p>
            </>
          ) : (
            /* 单个研究：按访视编号统计 */
            <div className="overflow-x-auto">
              <div style={{ width: `max(${byVisitData.length * 72}px, 100%)`, height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={byVisitData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis
                      dataKey="name" tick={{ fontSize: 9 }} interval={0}
                      angle={byVisitData.length > 8 ? -28 : 0}
                      textAnchor={byVisitData.length > 8 ? 'end' : 'middle'}
                      height={byVisitData.length > 8 ? 56 : 30}
                    />
                    <YAxis tick={{ fontSize: 10 }} allowDecimals={false} width={32} />
                    <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Bar dataKey="已完成" stackId="a" fill="#22c55e" maxBarSize={56} radius={[0, 0, 0, 0]} />
                    <Bar dataKey="进行中" stackId="a" fill="#3b82f6" maxBarSize={56} radius={[0, 0, 0, 0]} />
                    <Bar dataKey="未开始" stackId="a" fill="#cbd5e1" maxBarSize={56} radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      <Card className="bg-white">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-slate-700">
              {selectedProjectNo === 'all'
                ? projectChartTab === 'count'
                  ? '各项目访视次数（已完成）'
                  : '各项目访视完成率（%）'
                : patientChartTab === 'count'
                  ? `各患者访视次数（已完成，共 ${byPatientData.length} 例）`
                  : `各患者访视完成率（%，共 ${byPatientData.length} 例）`}
            </h3>
            {selectedProjectNo === 'all' ? (
              byProjectData.length > 0 && (
                <div className="flex items-center gap-0.5 bg-slate-100 border border-slate-200 rounded-lg p-0.5">
                  {([
                    { key: 'count', label: '访视次数' },
                    { key: 'rate', label: '访视完成率' },
                  ] as const).map(({ key, label }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setProjectChartTab(key)}
                      className={`px-2.5 py-1 rounded-md text-xs transition-colors ${
                        projectChartTab === key ? 'bg-sky-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )
            ) : (
              byPatientData.length > 0 && (
                <div className="flex items-center gap-0.5 bg-slate-100 border border-slate-200 rounded-lg p-0.5">
                  {([
                    { key: 'count', label: '访视次数' },
                    { key: 'rate', label: '访视完成率' },
                  ] as const).map(({ key, label }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setPatientChartTab(key)}
                      className={`px-2.5 py-1 rounded-md text-xs transition-colors ${
                        patientChartTab === key ? 'bg-sky-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )
            )}
          </div>
          {selectedProjectNo === 'all' ? (
            projectChartTab === 'count' ? (
              /* 访视次数：柱状图（柱子限宽），超出时横向滚动 */
              <>
                <div className="overflow-x-auto">
                  <div style={{ width: `max(${byProjectData.length * 120}px, 100%)`, height: 260 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={byProjectData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} />
                        <YAxis tick={{ fontSize: 10 }} allowDecimals={false} width={36} />
                        <Tooltip
                          contentStyle={{ fontSize: 11, borderRadius: 8 }}
                          formatter={(value: unknown, _name: unknown, item: { payload?: { done?: number; total?: number } }) => [
                            `${value} 次 / 共 ${item?.payload?.total ?? 0} 次`,
                            '已完成访视次数',
                          ]}
                        />
                        <Bar dataKey="访视次数" name="已完成访视次数" fill="#3b82f6" maxBarSize={64} radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <p className="text-[11px] text-slate-400 mt-2 text-center">
                  已完成访视次数 ÷ 应做访视总数即完成率；点击右上「访视完成率」可切换查看
                </p>
              </>
            ) : byProjectData.length <= 5 ? (
              /* 项目较少时用紧凑进度条列表，避免柱状图被拉宽失真；最小高度与左侧图表对齐 */
              <>
                <div className="space-y-3 py-1 min-h-[260px] flex flex-col justify-center">
                  {byProjectData.length === 0 && (
                    <div className="text-center text-sm text-slate-400 py-8">暂无项目数据</div>
                  )}
                  {byProjectData.map((d) => (
                    <div key={d.name} className="rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2.5">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-medium text-slate-700 font-mono truncate" title={d.title}>{d.name}</span>
                        <span className="text-[10px] text-slate-400 ml-2 whitespace-nowrap">
                          已完成 {d.done}/{d.total} 次
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Progress value={d.完成率} className="h-2 flex-1" />
                        <span className="text-xs font-semibold text-sky-600 w-10 text-right">{d.完成率}%</span>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-slate-400 mt-2 text-center">
                  完成率 = 已完成访视 ÷ 应做访视总数；点击右上「访视次数」可切换为柱状图查看各项目已完成次数
                </p>
              </>
            ) : (
              /* 项目较多时柱状图撑满整卡（柱子限宽），超出时横向滚动 */
              <div className="overflow-x-auto">
                <div style={{ width: `max(${byProjectData.length * 120}px, 100%)`, height: 260 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={byProjectData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} />
                      <YAxis tick={{ fontSize: 10 }} domain={[0, 100]} width={36} />
                      <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                      <Bar dataKey="完成率" fill="#0ea5e9" maxBarSize={64} radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )
          ) : byPatientData.length === 0 ? (
            <div className="h-[260px] flex items-center justify-center text-sm text-slate-400">
              该项目暂无在组患者
            </div>
          ) : (
            /* 患者少时撑满整卡，多时按每例 56px 展开横向滚动；TAB 切换访视次数/完成率 */
            <div className="overflow-x-auto">
              <div style={{ width: `max(${byPatientData.length * 56}px, 100%)`, height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={byPatientData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 9 }} interval={0} />
                    {patientChartTab === 'rate' ? (
                      <YAxis tick={{ fontSize: 10 }} domain={[0, 100]} width={36} />
                    ) : (
                      <YAxis tick={{ fontSize: 10 }} allowDecimals={false} width={36} />
                    )}
                    <Tooltip
                      contentStyle={{ fontSize: 11, borderRadius: 8 }}
                      formatter={(value: unknown, _name: unknown, item: { payload?: { done?: number; total?: number } }) => [
                        patientChartTab === 'rate'
                          ? `${value}%（已完成 ${item?.payload?.done ?? 0}/${item?.payload?.total ?? 0} 次）`
                          : `${value} 次 / 共 ${item?.payload?.total ?? 0} 次`,
                        patientChartTab === 'rate' ? '访视完成率' : '已完成访视次数',
                      ]}
                    />
                    <Bar
                      dataKey={patientChartTab === 'rate' ? '完成率' : '访视次数'}
                      name={patientChartTab === 'rate' ? '访视完成率' : '已完成访视次数'}
                      fill={patientChartTab === 'rate' ? '#0ea5e9' : '#3b82f6'}
                      maxBarSize={64}
                      radius={[3, 3, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      </div>

      {/* 访视管理：大标题 + TAB 切换（基于患者 / 基于访视） */}
      <div>
        <div className="flex items-center gap-3 mb-2 px-1">
          <div className="w-8 h-8 rounded-lg bg-sky-50 flex items-center justify-center flex-shrink-0">
            <CalendarCheck className="w-4 h-4 text-sky-500" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-800">访视管理</h3>
            <p className="text-[11px] text-slate-400">逾期与窗口期待访视提醒，以及访视计划完成情况汇总</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button
              size="sm" variant="outline" className="h-7 text-xs"
              onClick={openMatrix}
              disabled={configurableProjects.length === 0}
            >
              <LayoutGrid className="w-3.5 h-3.5 mr-1" /> 访视模块矩阵
            </Button>
            <Button
              size="sm" variant="outline" className="h-7 text-xs"
              onClick={openConfig}
              disabled={configurableProjects.length === 0}
            >
              <Settings className="w-3.5 h-3.5 mr-1" /> 访视窗口配置
            </Button>
            {visitTab === 'patient' && reminders.length > REMINDER_PAGE && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-400">展示</span>
                <Select value={String(reminderLimit)} onValueChange={(v) => setReminderLimit(Number(v))}>
                  <SelectTrigger className="h-7 w-[70px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[10, 20, 50].map((n) => (
                      <SelectItem key={n} value={String(n)} className="text-xs">{n} 条</SelectItem>
                    ))}
                    <SelectItem value={String(reminders.length)} className="text-xs">全部</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </div>
        <Card className="bg-white overflow-hidden py-0 gap-0">
          {/* TAB 头 */}
          <div className="flex items-center gap-1 px-4 pt-3 border-b border-slate-100">
            {([
              { key: 'patient', label: `基于患者（${reminders.length}）` },
              { key: 'visit', label: '基于访视' },
            ] as const).map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setVisitTab(t.key)}
                className={`px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
                  visitTab === t.key
                    ? 'text-sky-600 border-sky-500 bg-sky-50/50'
                    : 'text-slate-500 border-transparent hover:text-slate-700'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <CardContent className="p-0">
          {visitTab === 'patient' ? (
            /* ===== 基于患者：访视提醒 ===== */
            <div className="overflow-x-auto">
            <div className={variant === 'entry' ? 'min-w-[1280px]' : 'min-w-[1080px]'}>
            {variant === 'entry' ? (
              /* 录入端：12 列扩展布局（研究编号/研究中心/姓名缩写/筛选编号/入组编号/状态/当前访视/下一次访视/预计访视日期/提醒/访视完成率/操作） */
              <>
              <div className="grid grid-cols-[1.05fr_1.2fr_0.7fr_0.65fr_0.75fr_0.8fr_0.85fr_0.85fr_1.15fr_1.05fr_1.1fr_0.75fr] bg-slate-50 border-b border-slate-200">
                {['研究编号', '研究中心', '姓名缩写', '筛选编号', '入组编号', '状态', '当前访视', '下一次访视', '预计访视日期', '提醒', '访视完成率', '操作'].map((h) => (
                  <div key={h} className="py-2.5 px-3 text-center text-xs font-medium text-slate-500 whitespace-nowrap">{h}</div>
                ))}
              </div>
              {reminders.length === 0 && (
                <div className="text-center py-8 text-sm text-slate-400">暂无逾期或临近的访视，录入进度良好</div>
              )}
              {visibleReminders.map((r, idx) => (
                <div
                  key={r.patientId}
                  className={`grid grid-cols-[1.05fr_1.2fr_0.7fr_0.65fr_0.75fr_0.8fr_0.85fr_0.85fr_1.15fr_1.05fr_1.1fr_0.75fr] text-xs text-slate-700 items-center hover:bg-sky-50/40 transition-colors ${
                    idx !== visibleReminders.length - 1 ? 'border-b border-slate-100' : ''
                  }`}
                >
                  <div className="py-3 px-3 text-center font-mono text-slate-500 whitespace-nowrap">{r.projectNo}</div>
                  <div className="py-3 px-3 text-center truncate">{r.centerName}</div>
                  <div className="py-3 px-3 text-center font-medium text-slate-800">{r.patientLabel}</div>
                  <div className="py-3 px-3 text-center font-medium text-slate-800 font-mono">{r.screeningId || '—'}</div>
                  <div className="py-3 px-3 text-center font-mono text-slate-500">{r.randomizationId}</div>
                  <div className="py-3 px-3 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] ${
                      r.patientStatus === 'completed' ? 'bg-purple-50 text-purple-600' :
                      r.patientStatus === 'withdrawn' || r.patientStatus === 'lost' ? 'bg-red-50 text-red-500' :
                      'bg-teal-50 text-teal-600'
                    }`}>
                      {r.patientStatus === 'completed' ? '完成研究' :
                       r.patientStatus === 'withdrawn' || r.patientStatus === 'lost' ? '退出研究' : '进行中'}
                    </span>
                  </div>
                  <div className="py-3 px-3 text-center text-slate-500">{r.currentVisitName}</div>
                  <div className="py-3 px-3 text-center font-medium text-slate-800">{r.nextVisitName}</div>
                  <div className="py-3 px-3 text-center whitespace-nowrap">
                    {r.plannedDate}
                    {r.plannedDate !== '-' && <span className="text-slate-400 ml-1">±{r.windowDays}天</span>}
                  </div>
                  <div className="py-3 px-3 text-center">
                    {r.overdue ? (
                      <Badge variant="outline" className="bg-red-50 text-red-600 border-red-200 text-[10px]">
                        已逾期 {-r.diffDays - r.windowDays} 天
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200 text-[10px]">
                        窗口期内 · 剩 {r.windowDays - r.diffDays} 天
                      </Badge>
                    )}
                  </div>
                  <div className="py-2.5 px-3">
                    <div className="flex items-center gap-1.5">
                      <Progress value={r.rate} className="h-1.5 flex-1" />
                      <span className="text-slate-500 w-9 text-right">{r.rate}%</span>
                    </div>
                  </div>
                  <div className="py-3 px-3 text-center">
                    <Button size="sm" variant="outline" className="h-6 px-2 text-[11px]" asChild>
                      <Link to={actionLink(r)}>
                        <ClipboardList className="w-3 h-3 mr-1" /> {actionLabel}
                      </Link>
                    </Button>
                  </div>
                </div>
              ))}
              </>
            ) : (
              /* 管理端：原 10 列布局 */
              <>
              <div className="grid grid-cols-[0.8fr_0.7fr_1fr_1fr_1fr_1.2fr_1.1fr_0.8fr_1.2fr_0.8fr] bg-slate-50 border-b border-slate-200">
              {['筛选编号', '姓名缩写', '研究编号', '当前访视', '下一次访视', '预计访视日期', '提醒', '状态', '访视完成率', '操作'].map((h) => (
                <div key={h} className="py-2.5 px-3 text-center text-xs font-medium text-slate-500 whitespace-nowrap">{h}</div>
              ))}
            </div>
            {reminders.length === 0 && (
              <div className="text-center py-8 text-sm text-slate-400">暂无逾期或临近的访视，录入进度良好</div>
            )}
            {visibleReminders.map((r, idx) => (
              <div
                key={r.patientId}
                className={`grid grid-cols-[0.8fr_0.7fr_1fr_1fr_1fr_1.2fr_1.1fr_0.8fr_1.2fr_0.8fr] text-xs text-slate-700 items-center hover:bg-sky-50/40 transition-colors ${
                  idx !== visibleReminders.length - 1 ? 'border-b border-slate-100' : ''
                }`}
              >
                <div className="py-3 px-3 text-center text-slate-500">{r.screeningId || '—'}</div>
                <div className="py-3 px-3 text-center font-medium text-slate-800">{r.patientLabel}</div>
                <div className="py-3 px-3 text-center whitespace-nowrap">{r.projectNo}</div>
                <div className="py-3 px-3 text-center text-slate-500">{r.currentVisitName}</div>
                <div className="py-3 px-3 text-center font-medium text-slate-800">{r.nextVisitName}</div>
                <div className="py-3 px-3 text-center whitespace-nowrap">
                  {r.plannedDate}
                  {r.plannedDate !== '-' && <span className="text-slate-400 ml-1">±{r.windowDays}天</span>}
                </div>
                <div className="py-3 px-3 text-center">
                  {r.overdue ? (
                    <Badge variant="outline" className="bg-red-50 text-red-600 border-red-200 text-[10px]">
                      已逾期 {-r.diffDays - r.windowDays} 天
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200 text-[10px]">
                      窗口期内 · 剩 {r.windowDays - r.diffDays} 天
                    </Badge>
                  )}
                </div>
                <div className="py-3 px-3 text-center">
                  <span className={`inline-block px-2 py-0.5 rounded text-[10px] ${STATUS_COLORS[r.status]}`}>
                    {STATUS_LABELS[r.status]}
                  </span>
                </div>
                <div className="py-2.5 px-3">
                  <div className="flex items-center gap-1.5">
                    <Progress value={r.rate} className="h-1.5 flex-1" />
                    <span className="text-slate-500 w-9 text-right">{r.completedCount}/{r.totalCount}</span>
                  </div>
                </div>
                <div className="py-3 px-3 text-center">
                  <Button size="sm" variant="outline" className="h-6 px-2 text-[11px]" asChild>
                    <Link to={actionLink(r)}>
                      <ClipboardList className="w-3 h-3 mr-1" /> {actionLabel}
                    </Link>
                  </Button>
                </div>
              </div>
            ))}
              </>
            )}
            </div>
            </div>
          ) : (
            /* ===== 基于访视：计划与完成情况 ===== */
            <div>
            <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-200">
              {['项目', '访视', '关联模块', '应完成', '已完成', '进行中', '完成率'].map((h) => (
                <div key={h} className="py-2.5 px-3 text-center text-xs font-medium text-slate-500">{h}</div>
              ))}
            </div>
          {planMatrix.length === 0 && (
            <div className="text-center py-8 text-sm text-slate-400">所选项目暂未配置访视</div>
          )}
          {planMatrix.map((row, idx) => (
            <div
              key={row.key}
              className={`grid grid-cols-7 text-xs text-slate-700 items-center hover:bg-sky-50/40 transition-colors ${
                idx !== planMatrix.length - 1 ? 'border-b border-slate-100' : ''
              }`}
            >
              <div className="py-3 px-3 text-center">{row.projectNo}</div>
              <div className="py-3 px-3 text-center font-medium text-slate-800">{row.visitName}</div>
              <div className="py-3 px-3 text-center">{row.moduleCount} 个</div>
              <div className="py-3 px-3 text-center">{row.expected} 例</div>
              <div className="py-3 px-3 text-center text-green-600 font-medium">{row.completed}</div>
              <div className="py-3 px-3 text-center text-blue-600">{row.inProgress}</div>
              <div className="py-2.5 px-4">
                <div className="flex items-center gap-2">
                  <Progress value={row.rate} className="h-1.5 flex-1" />
                  <span className="text-slate-500 w-8 text-right">{row.rate}%</span>
                </div>
              </div>
            </div>
          ))}
            </div>
          )}
          </CardContent>
        </Card>
      </div>

      {/* 超窗访视：左侧统计图，右侧超窗患者列表 */}
      <div>
        <div className="flex items-center gap-3 mb-2 px-1">
          <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-4 h-4 text-red-500" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-800">超窗访视</h3>
            <p className="text-[11px] text-slate-400">
              实际访视日期超出「计划日期 + 窗口期」的访视（{overWindowRows.length} 条）
            </p>
          </div>
          {overWindowRows.length > OVERWINDOW_PAGE && (
            <button
              className="ml-auto text-xs text-sky-500 hover:text-sky-600"
              onClick={() => setShowAllOverWindow(!showAllOverWindow)}
            >
              {showAllOverWindow ? '收起' : `展开全部 ${overWindowRows.length} 条`}
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-4">
          {/* 左：超窗统计图 */}
          <Card className="bg-white">
            <CardContent className="p-4">
              <h4 className="text-sm font-medium text-slate-700 mb-2 text-center">
                {selectedProjectNo === 'all' ? '各研究超窗次数与累计超窗天数' : '各访视超窗例数与平均超窗天数'}
              </h4>
              {overWindowChartData.length === 0 ? (
                <div className="text-center py-16 text-sm text-slate-400">暂无超窗访视，窗口期控制良好</div>
              ) : (
                <div className="overflow-x-auto">
                  <div style={{ width: `max(${overWindowChartData.length * 72}px, 100%)`, height: 260 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={overWindowChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis
                          dataKey="name" tick={{ fontSize: 9 }} interval={0}
                          angle={overWindowChartData.length > 6 ? -28 : 0}
                          textAnchor={overWindowChartData.length > 6 ? 'end' : 'middle'}
                          height={overWindowChartData.length > 6 ? 56 : 30}
                        />
                        <YAxis yAxisId="left" tick={{ fontSize: 10 }} allowDecimals={false} width={32} />
                        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} allowDecimals={false} width={36} />
                        <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                        <Legend wrapperStyle={{ fontSize: 10 }} />
                        <Bar
                          yAxisId="left"
                          dataKey={selectedProjectNo === 'all' ? '超窗次数' : '超窗例数'}
                          fill="#ef4444"
                          maxBarSize={selectedProjectNo === 'all' ? 48 : 40}
                          radius={[2, 2, 0, 0]}
                        />
                        <Bar
                          yAxisId="right"
                          dataKey={selectedProjectNo === 'all' ? '累计超窗天数' : '平均超窗天数'}
                          fill="#f59e0b"
                          maxBarSize={selectedProjectNo === 'all' ? 48 : 40}
                          radius={[2, 2, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
          {/* 右：超窗患者列表 */}
          <Card className="bg-white overflow-hidden py-0 gap-0">
            <CardContent className="p-0">
              <div className="grid grid-cols-[0.8fr_0.8fr_1fr_1.1fr_1.1fr_0.8fr] bg-slate-50 border-b border-slate-200">
                {['患者编号', '姓名缩写', '超窗访视', '最晚访视日期', '实际访视日期', '超窗天数'].map((h) => (
                  <div key={h} className="py-2.5 px-2 text-center text-xs font-medium text-slate-500 whitespace-nowrap">{h}</div>
                ))}
              </div>
              {overWindowRows.length === 0 && (
                <div className="text-center py-16 text-sm text-slate-400">暂无超窗访视</div>
              )}
              {visibleOverWindow.map((r, idx) => (
                <div
                  key={`${r.patientId}|${r.visitName}|${r.actualDate}`}
                  className={`grid grid-cols-[0.8fr_0.8fr_1fr_1.1fr_1.1fr_0.8fr] text-xs text-slate-700 items-center hover:bg-red-50/30 transition-colors ${
                    idx !== visibleOverWindow.length - 1 ? 'border-b border-slate-100' : ''
                  }`}
                >
                  <div className="py-2.5 px-2 text-center text-slate-500">{r.screeningId || '—'}</div>
                  <div className="py-2.5 px-2 text-center font-medium text-slate-800">{r.patientLabel}</div>
                  <div className="py-2.5 px-2 text-center">{r.visitName}</div>
                  <div className="py-2.5 px-2 text-center whitespace-nowrap">{r.latestDate}</div>
                  <div className="py-2.5 px-2 text-center whitespace-nowrap">{r.actualDate}</div>
                  <div className="py-2.5 px-2 text-center">
                    <Badge variant="outline" className="bg-red-50 text-red-600 border-red-200 text-[10px]">
                      +{r.overDays} 天
                    </Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 访视计划弹窗：CRF 发布后自动生成，访视在上、评估模块在左；右上角可手动放大 */}
      <Dialog open={matrixOpen} onOpenChange={setMatrixOpen}>
        <DialogContent className={matrixZoom ? 'sm:max-w-[95vw] max-h-[92vh] overflow-auto' : 'sm:max-w-6xl'}>
          <DialogHeader>
            <div className="flex items-center justify-between pr-6">
              <DialogTitle>访视计划</DialogTitle>
              <Button
                variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-slate-600"
                onClick={() => setMatrixZoom(!matrixZoom)}
                title={matrixZoom ? '还原' : '放大'}
              >
                {matrixZoom ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </Button>
            </div>
          </DialogHeader>
          <div className="space-y-3 min-w-0">
            {/* 研究编号（可切换）与研究标题（联动展示）分开 */}
            <div className="grid grid-cols-[220px_1fr] gap-3 items-end">
              <div>
                <span className="block text-xs text-slate-400 mb-1">研究编号</span>
                <Select value={matrixProjectId} onValueChange={setMatrixProjectId}>
                  <SelectTrigger className="w-full h-8 text-xs">
                    <SelectValue placeholder="选择研究" />
                  </SelectTrigger>
                  <SelectContent>
                    {configurableProjects.map((p) => (
                      <SelectItem key={p.id} value={p.id} className="text-xs">
                        {p.projectNo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="min-w-0">
                <span className="block text-xs text-slate-400 mb-1">研究标题</span>
                <div
                  className="min-h-8 px-3 py-1.5 flex items-center rounded-md border border-slate-200 bg-slate-50 text-xs text-slate-700 leading-snug break-all"
                >
                  {matrixProject?.name || '-'}
                </div>
              </div>
            </div>
            {matrixProject && (
              <VisitPlanMatrix project={matrixProject} />
            )}
            <p className="text-[11px] text-slate-400">
              访视计划由 CRF 配置自动生成：行是研究需执行的评估模块，列是访视（含计划访视日与窗口期），✓ 表示该访视需执行此项评估。调整关联关系请前往 CRF 配置。
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* 访视窗口配置弹窗：设置每次访视的计划访视日与窗口期 */}
      <Dialog open={configOpen} onOpenChange={setConfigOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>访视窗口配置</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* 研究编号（可切换项目）与研究标题（联动展示）分开 */}
            <div className="grid grid-cols-[200px_1fr] gap-3">
              <div>
                <span className="block text-xs text-slate-400 mb-1">研究编号</span>
                <Select value={configProjectId} onValueChange={switchConfigProject}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="选择项目" />
                  </SelectTrigger>
                  <SelectContent>
                    {configurableProjects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.projectNo}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="min-w-0">
                <span className="block text-xs text-slate-400 mb-1">研究标题</span>
                <div
                  className="min-h-9 px-3 py-1.5 flex items-center rounded-md border border-slate-200 bg-slate-50 text-sm text-slate-700 leading-snug break-all"
                >
                  {configProject?.name || '-'}
                </div>
              </div>
            </div>
            {/* 按频率批量设置：首次访视日 + 间隔 + 统一窗口期，一键填充后仍可逐行微调 */}
            <div className="rounded-lg border border-sky-100 bg-sky-50/50 px-3 py-2.5">
              <div className="text-[11px] font-medium text-sky-600 mb-2">按频率批量设置</div>
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <span className="block text-[10px] text-slate-400 mb-1">首次访视（第 N 天）</span>
                  <Input type="number" min={0} className="h-7 w-24 text-xs text-center bg-white" value={batchStart} onChange={(e) => setBatchStart(e.target.value)} />
                </div>
                <div>
                  <span className="block text-[10px] text-slate-400 mb-1">访视间隔（每 N 天一次）</span>
                  <Input type="number" min={0} className="h-7 w-24 text-xs text-center bg-white" value={batchInterval} onChange={(e) => setBatchInterval(e.target.value)} />
                </div>
                <div>
                  <span className="block text-[10px] text-slate-400 mb-1">统一窗口期（± N 天）</span>
                  <Input type="number" min={0} className="h-7 w-24 text-xs text-center bg-white" value={batchWindow} onChange={(e) => setBatchWindow(e.target.value)} />
                </div>
                <Button size="sm" variant="outline" className="h-7 text-xs border-sky-200 text-sky-600 hover:bg-sky-50" onClick={applyBatch}>
                  批量应用
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 px-1 text-xs font-medium text-slate-400">
              <div>访视（按 CRF 配置顺序）</div>
              <div className="text-center">计划访视日（入组后第 N 天）</div>
              <div className="text-center">窗口期（± N 天）</div>
            </div>
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {configRows.map((row) => (
                <div key={row.visitId} className="grid grid-cols-3 gap-3 items-center">
                  <div className="text-sm text-slate-700 font-medium">
                    <span className="text-slate-400 font-mono text-xs mr-1.5">{row.code}</span>
                    {row.name}
                  </div>
                  <Input
                    type="number" min={0} className="h-8 text-sm text-center"
                    value={row.plannedDay}
                    onChange={(e) =>
                      setConfigRows(configRows.map((r) =>
                        r.visitId === row.visitId ? { ...r, plannedDay: Number(e.target.value) } : r
                      ))
                    }
                  />
                  <Input
                    type="number" min={0} className="h-8 text-sm text-center"
                    value={row.windowDays}
                    onChange={(e) =>
                      setConfigRows(configRows.map((r) =>
                        r.visitId === row.visitId ? { ...r, windowDays: Number(e.target.value) } : r
                      ))
                    }
                  />
                </div>
              ))}
            </div>
            <p className="text-[11px] text-slate-400">
              保存后，访视提醒将按「入组/知情日期 + 计划访视日 ± 窗口期」重新计算逾期与窗口期待访视。
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfigOpen(false)}>取消</Button>
            <Button className="bg-sky-500 hover:bg-sky-600" onClick={saveConfig}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
