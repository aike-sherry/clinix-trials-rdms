import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useAppStorage } from '@/hooks/useAppStorage'
import StatCard from '@/components/StatCard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import type { Patient, Project, Visit } from '@/types'
import {
  ClipboardList, Users, CheckCircle,
  BellRing, ChevronRight, FolderOpen, TrendingUp, TrendingDown,
  CalendarClock, CalendarCheck, ListChecks, BarChart3, AlarmClock, GripVertical,
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface PendingItem {
  patient: Patient
  project: Project
  visit: Visit
  moduleName: string
  moduleId: string
  status: 'not_started' | 'in_progress'
  centerName: string
  plannedDate: string   // 该访视的计划日期 YYYY-MM-DD（无基线日期时为空）
  overdueDays: number   // 超出访视窗口期的天数（0=未逾期）
}

/** 访视提醒行：按患者聚合，聚焦下一次待办访视 */
interface HomeReminder {
  patient: Patient
  project: Project
  visit: Visit
  lastVisit?: Visit     // 上一次已完成的访视
  plannedDate: string   // YYYY-MM-DD
  windowDays: number
  daysUntil: number     // 计划日 - 今天（负数=已过期）
  overdueDays: number   // 超出窗口期的天数（0=未逾期）
  inWindow: boolean     // 处于窗口期 [计划日-窗口, 计划日+窗口]
}

const VISIT_INTERVAL_DAYS = 7
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)

export default function EntryHome() {
  const { projects, patients, visitData } = useAppStorage()
  const nav = useNavigate()
  // 访视提醒范围 Tab：近 7 日 / 近 15 日
  const [reminderRange, setReminderRange] = useState<7 | 15>(7)
  // 录入提醒逾期 Tab：全部 / 逾期≤5天 / 逾期≥5天
  const [pendingTab, setPendingTab] = useState<'all' | 'le5' | 'ge5'>('all')
  // 登记/筛选失败/入组进度：按日 / 按月 / 按年
  const [progressUnit, setProgressUnit] = useState<'day' | 'month' | 'year'>('month')
  // 患者访视统计：项目筛选（全部 / 指定项目编号）
  const [visitChartProject, setVisitChartProject] = useState<string>('all')
  // 图表布局：并排 / 整行
  const [chartLayout, setChartLayout] = useState<'side' | 'full'>(() =>
    localStorage.getItem('crf_home_chart_layout') === 'full' ? 'full' : 'side',
  )
  useEffect(() => {
    localStorage.setItem('crf_home_chart_layout', chartLayout)
  }, [chartLayout])

  // ---------- 访视提醒 / 待录入：左右分栏可拖动调节 ----------
  const [split, setSplit] = useState(60)
  const splitRef = useRef<HTMLDivElement>(null)
  const splitPctRef = useRef(60)
  const [isLg, setIsLg] = useState(() => window.matchMedia('(min-width: 1024px)').matches)

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const fn = () => setIsLg(mq.matches)
    mq.addEventListener('change', fn)
    return () => mq.removeEventListener('change', fn)
  }, [])

  useEffect(() => {
    const v = Number(localStorage.getItem('crf_home_split'))
    if (v >= 35 && v <= 80) {
      setSplit(v)
      splitPctRef.current = v
    }
  }, [])

  const onSplitDragStart = (e: React.MouseEvent) => {
    e.preventDefault()
    const move = (ev: MouseEvent) => {
      const rect = splitRef.current?.getBoundingClientRect()
      if (!rect || rect.width === 0) return
      const p = Math.min(80, Math.max(35, ((ev.clientX - rect.left) / rect.width) * 100))
      splitPctRef.current = p
      setSplit(p)
    }
    const up = () => {
      localStorage.setItem('crf_home_split', String(Math.round(splitPctRef.current)))
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }

  const currentUser = useMemo(() => {
    try {
      const raw = localStorage.getItem('clini_x_rdms_data')
      if (raw) return JSON.parse(raw).currentUser
    } catch { /* ignore */ }
    return null
  }, [])

  const myProjects = useMemo(() => projects.filter((p) => p.crfPublished), [projects])
  const myPatients = useMemo(
    () => patients.filter((p) => myProjects.some((proj) => proj.id === p.projectId)),
    [patients, myProjects],
  )
  const myPatientIds = useMemo(() => new Set(myPatients.map((p) => p.id)), [myPatients])
  const myVisitData = useMemo(
    () => visitData.filter((v) => myPatientIds.has(v.patientId)),
    [visitData, myPatientIds],
  )

  const today = new Date()
  const today0 = new Date(today.getFullYear(), today.getMonth(), today.getDate())

  // ---------- 完成访视实例：某患者某访视的全部模块均完成，完成时间取最晚记录时间 ----------
  const completedVisitInstances = useMemo(() => {
    const out: { key: string; date: string }[] = []
    for (const patient of myPatients) {
      const project = myProjects.find((p) => p.id === patient.projectId)
      if (!project) continue
      for (const visit of project.visits) {
        const mods = project.crfModules.filter((m) => visit.crfModuleIds.includes(m.id))
        if (mods.length === 0) continue
        const recs = mods.map((m) =>
          visitData.find((vd) => vd.patientId === patient.id && vd.visitId === visit.id && vd.moduleId === m.id),
        )
        if (recs.every((r) => r && (r.status === 'completed' || r.status === 'locked'))) {
          const date = recs.reduce((mx, r) => (r!.updatedAt > mx ? r!.updatedAt : mx), '')
          out.push({ key: `${patient.id}|${visit.id}`, date })
        }
      }
    }
    return out
  }, [myPatients, myProjects, visitData])

  // ---------- 月度桶统计：较上月增加比率 ----------
  const bucketByMonth = (dates: (string | undefined)[]) => {
    const b: Record<string, number> = {}
    for (const d of dates) {
      if (!d) continue
      const k = d.slice(0, 7)
      b[k] = (b[k] ?? 0) + 1
    }
    return b
  }
  const momRatio = (buckets: Record<string, number>) => {
    const cur = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
    const prevD = new Date(today.getFullYear(), today.getMonth() - 1, 1)
    const prev = `${prevD.getFullYear()}-${String(prevD.getMonth() + 1).padStart(2, '0')}`
    const c = buckets[cur] ?? 0
    const p = buckets[prev] ?? 0
    if (p === 0) return c > 0 ? 100 : 0
    return Math.round(((c - p) / p) * 100)
  }

  const stats = useMemo(() => {
    const regBuckets = bucketByMonth(myPatients.map((p) => p.createdAt))
    const visitBuckets = bucketByMonth(completedVisitInstances.map((v) => v.date))
    const completedRecs = myVisitData.filter((v) => v.status === 'completed')
    const recBuckets = bucketByMonth(completedRecs.map((v) => v.updatedAt))
    return {
      totalProjects: myProjects.length,
      totalPatients: myPatients.length,
      completedVisits: completedVisitInstances.length,
      completedRecords: completedRecs.length,
      regRatio: momRatio(regBuckets),
      visitRatio: momRatio(visitBuckets),
      recRatio: momRatio(recBuckets),
    }
  }, [myProjects, myPatients, myVisitData, completedVisitInstances])

  // ---------- 待录入：患者应到访视（含当前）内未完成的模块 ----------
  const pendingItems = useMemo(() => {
    const items: PendingItem[] = []
    for (const patient of myPatients) {
      if (patient.status === 'withdrawn' || patient.status === 'lost') continue
      const project = myProjects.find((p) => p.id === patient.projectId)
      if (!project) continue
      const centerName = project.centers?.find((c) => c.id === patient.centerId)?.name || project.researchCenter
      const baseStr = patient.enrollmentDate || patient.consentDate
      const base = baseStr ? new Date(baseStr) : null
      const visits = [...project.visits].sort((a, b) => a.order - b.order)
      const currentIdx = visits.findIndex((v) => v.code === patient.currentVisit)
      const expected = currentIdx >= 0 ? visits.slice(0, currentIdx + 1) : visits.slice(0, 1)
      for (const visit of expected) {
        // 访视计划日期与逾期天数（与访视提醒同口径）
        let plannedDate = ''
        let overdueDays = 0
        if (base) {
          const planned = addDays(base, visit.plannedDay ?? visit.order * VISIT_INTERVAL_DAYS)
          const windowDays = visit.windowDays ?? 3
          const daysUntil = Math.round((planned.getTime() - today0.getTime()) / 86400000)
          plannedDate = planned.toISOString().slice(0, 10)
          overdueDays = daysUntil < -windowDays ? -daysUntil - windowDays : 0
        }
        const modules = project.crfModules.filter((m) => visit.crfModuleIds.includes(m.id))
        for (const m of modules) {
          const rec = visitData.find(
            (vd) => vd.patientId === patient.id && vd.visitId === visit.id && vd.moduleId === m.id,
          )
          if (rec?.status === 'completed' || rec?.status === 'locked') continue
          items.push({
            patient,
            project,
            visit,
            moduleName: m.name,
            moduleId: m.id,
            status: rec?.status === 'in_progress' ? 'in_progress' : 'not_started',
            centerName,
            plannedDate,
            overdueDays,
          })
        }
      }
    }
    return items.sort((a, b) =>
      (b.overdueDays > 0 ? 1 : 0) - (a.overdueDays > 0 ? 1 : 0) ||
      b.overdueDays - a.overdueDays ||
      (a.status === 'in_progress' ? 0 : 1) - (b.status === 'in_progress' ? 0 : 1) ||
      a.visit.order - b.visit.order,
    )
  }, [myPatients, myProjects, visitData, today0])

  // ---------- 待录入按访视聚合：同一患者同一访视的多个待录入模块合并为一条 ----------
  const pendingVisits = useMemo(() => {
    const map = new Map<string, {
      patient: Patient
      project: Project
      visit: Visit
      centerName: string
      plannedDate: string
      overdueDays: number
      status: 'not_started' | 'in_progress'
      moduleCount: number
    }>()
    for (const item of pendingItems) {
      const key = `${item.patient.id}|${item.visit.id}`
      const g = map.get(key)
      if (g) {
        g.moduleCount += 1
        if (item.status === 'in_progress') g.status = 'in_progress'
      } else {
        map.set(key, {
          patient: item.patient,
          project: item.project,
          visit: item.visit,
          centerName: item.centerName,
          plannedDate: item.plannedDate,
          overdueDays: item.overdueDays,
          status: item.status,
          moduleCount: 1,
        })
      }
    }
    return [...map.values()].sort((a, b) =>
      (b.overdueDays > 0 ? 1 : 0) - (a.overdueDays > 0 ? 1 : 0) ||
      b.overdueDays - a.overdueDays ||
      (a.status === 'in_progress' ? 0 : 1) - (b.status === 'in_progress' ? 0 : 1) ||
      a.visit.order - b.visit.order,
    )
  }, [pendingItems])

  // 按逾期 Tab 过滤：全部 / 逾期≤5天（1~5天）/ 逾期≥5天
  const filteredPendingVisits = useMemo(
    () => pendingVisits.filter((g) =>
      pendingTab === 'all' ? true
        : pendingTab === 'le5' ? g.overdueDays > 0 && g.overdueDays <= 5
          : g.overdueDays >= 5,
    ),
    [pendingVisits, pendingTab],
  )

  // ---------- 访视提醒：按患者聚焦下一次待办访视 ----------
  const reminders = useMemo(() => {
    const out: HomeReminder[] = []
    for (const patient of myPatients) {
      if (patient.status === 'withdrawn' || patient.status === 'lost') continue
      const project = myProjects.find((p) => p.id === patient.projectId)
      if (!project) continue
      const baseStr = patient.enrollmentDate || patient.consentDate
      if (!baseStr) continue
      const base = new Date(baseStr)
      const visits = [...project.visits].sort((a, b) => a.order - b.order)
      // 找到第一个未完成的访视，同时记录上一次已完成的访视
      let lastDone: Visit | undefined
      for (const visit of visits) {
        const mods = project.crfModules.filter((m) => visit.crfModuleIds.includes(m.id))
        const done = mods.length > 0 && mods.every((m) =>
          visitData.some(
            (vd) => vd.patientId === patient.id && vd.visitId === visit.id && vd.moduleId === m.id &&
              (vd.status === 'completed' || vd.status === 'locked'),
          ),
        )
        if (done) { lastDone = visit; continue }
        const planned = addDays(base, visit.plannedDay ?? visit.order * VISIT_INTERVAL_DAYS)
        const windowDays = visit.windowDays ?? 3
        const daysUntil = Math.round((planned.getTime() - today0.getTime()) / 86400000)
        const overdueDays = daysUntil < -windowDays ? -daysUntil - windowDays : 0
        const inWindow = Math.abs(daysUntil) <= windowDays
        out.push({
          patient, project, visit, lastVisit: lastDone,
          plannedDate: planned.toISOString().slice(0, 10),
          windowDays, daysUntil, overdueDays, inWindow,
        })
        break // 只聚焦下一次待办访视
      }
    }
    // 逾期优先，其后按计划日期升序
    return out.sort((a, b) =>
      (b.overdueDays > 0 ? 1 : 0) - (a.overdueDays > 0 ? 1 : 0) ||
      a.daysUntil - b.daysUntil,
    )
  }, [myPatients, myProjects, visitData, today0])

  const rangeReminders = useMemo(
    // 已逾期的一律保留；未逾期的按计划日落在范围内过滤
    () => reminders.filter((r) => r.overdueDays > 0 || r.daysUntil <= reminderRange),
    [reminders, reminderRange],
  )

  // ---------- 登记 / 筛选失败 / 入组进度（按日 / 按月 / 按年） ----------
  const progressData = useMemo(() => {
    const rows: { label: string; 登记: number; 入组: number; 筛选失败: number }[] = []
    if (progressUnit === 'day') {
      // 最近 30 天
      for (let i = 29; i >= 0; i--) {
        const d = addDays(today0, -i)
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        rows.push({ label: `${d.getMonth() + 1}/${d.getDate()}`, 登记: 0, 入组: 0, 筛选失败: 0, ...{ key } } as never)
      }
    } else if (progressUnit === 'month') {
      // 最近 12 个月
      for (let i = 11; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1)
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        rows.push({ label: `${d.getMonth() + 1}月`, 登记: 0, 入组: 0, 筛选失败: 0, ...{ key } } as never)
      }
    } else {
      const years = new Set<string>()
      myPatients.forEach((p) => { if (p.createdAt) years.add(p.createdAt.slice(0, 4)) })
      years.add(String(today.getFullYear()))
      const sorted = [...years].sort()
      for (const y of sorted) rows.push({ label: `${y}年`, 登记: 0, 入组: 0, 筛选失败: 0, ...{ key: y } } as never)
    }
    const idxOf = (iso?: string) => {
      if (!iso) return -1
      const key = progressUnit === 'day' ? iso.slice(0, 10) : progressUnit === 'month' ? iso.slice(0, 7) : iso.slice(0, 4)
      return rows.findIndex((r) => (r as never as { key: string }).key === key)
    }
    for (const p of myPatients) {
      const ri = idxOf(p.createdAt)
      if (ri >= 0) rows[ri].登记 += 1
      // 入组：已入组/治疗中/已完成，按入组日期归入
      if ((p.status === 'enrolled' || p.status === 'treatment' || p.status === 'completed') && p.enrollmentDate) {
        const ei = idxOf(p.enrollmentDate)
        if (ei >= 0) rows[ei].入组 += 1
      }
      // 筛选失败：退出且有筛选失败原因（登记/筛选阶段），按更新时间归入
      if (p.status === 'withdrawn' && p.screeningFailReason) {
        const fi = idxOf(p.updatedAt)
        if (fi >= 0) rows[fi].筛选失败 += 1
      }
    }
    return rows
  }, [myPatients, progressUnit, today])

  // ---------- 患者访视统计：每个患者完成的访视总数（可按项目筛选） ----------
  const patientVisitStats = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const inst of completedVisitInstances) {
      const pid = inst.key.split('|')[0]
      counts[pid] = (counts[pid] ?? 0) + 1
    }
    return myPatients
      .filter((p) =>
        visitChartProject === 'all' ||
        myProjects.find((proj) => proj.id === p.projectId)?.projectNo === visitChartProject,
      )
      .sort((a, b) => a.screeningNo.localeCompare(b.screeningNo))
      .map((p) => ({ name: p.screeningId, 完成访视: counts[p.id] ?? 0, initials: p.nameInitials }))
  }, [myPatients, myProjects, completedVisitInstances, visitChartProject])

  // ---------- 项目完成度 ----------
  const projectProgress = (project: Project) => {
    const pats = myPatients.filter((p) => p.projectId === project.id)
    let expected = 0
    let done = 0
    for (const patient of pats) {
      const visits = [...project.visits].sort((a, b) => a.order - b.order)
      const currentIdx = visits.findIndex((v) => v.code === patient.currentVisit)
      const exp = currentIdx >= 0 ? visits.slice(0, currentIdx + 1) : []
      for (const visit of exp) {
        const modules = project.crfModules.filter((m) => visit.crfModuleIds.includes(m.id))
        expected += modules.length
        done += modules.filter((m) =>
          visitData.some(
            (vd) => vd.patientId === patient.id && vd.visitId === visit.id && vd.moduleId === m.id && vd.status === 'completed',
          ),
        ).length
      }
    }
    return { expected, done, patients: pats.length }
  }

  const dateStr = `${today.getFullYear()} 年 ${today.getMonth() + 1} 月 ${today.getDate()} 日`

  // ---------- 统计卡片配置（参照目标/绩效卡片样式） ----------
  const RatioLine = ({ ratio }: { ratio: number }) =>
    ratio > 0 ? (
      <span className="inline-flex items-center gap-1 text-teal-500">
        较上月上涨：{ratio}% <TrendingUp className="w-3 h-3" />
      </span>
    ) : ratio < 0 ? (
      <span className="inline-flex items-center gap-1 text-red-400">
        较上月下降：{Math.abs(ratio)}% <TrendingDown className="w-3 h-3" />
      </span>
    ) : (
      <span className="text-slate-400">较上月持平</span>
    )

  const statCards = [
    {
      label: '参与项目', value: stats.totalProjects, unit: '项',
      icon: FolderOpen, gradient: 'from-indigo-500 to-indigo-600',
      sub: <span className="text-slate-300 select-none">&nbsp;</span>,
    },
    {
      label: '登记受试者', value: stats.totalPatients, unit: '例',
      icon: Users, gradient: 'from-teal-500 to-emerald-600',
      sub: <RatioLine ratio={stats.regRatio} />,
    },
    {
      label: '完成访视', value: stats.completedVisits, unit: '次',
      icon: CheckCircle, gradient: 'from-sky-500 to-blue-600',
      sub: <RatioLine ratio={stats.visitRatio} />,
    },
    {
      label: '数据录入', value: stats.completedRecords, unit: '条',
      icon: ListChecks, gradient: 'from-amber-500 to-orange-500',
      sub: <RatioLine ratio={stats.recRatio} />,
    },
  ]

  return (
    <div className="space-y-5">
      {/* 欢迎头 */}
      <div>
        <h1 className="text-base font-bold text-slate-800">
          {today.getHours() < 12 ? '上午好' : today.getHours() < 18 ? '下午好' : '晚上好'}，{currentUser?.name || '录入员'}
        </h1>
        <p className="text-sm text-slate-400 mt-0.5">{dateStr} · 数据录入工作台</p>
      </div>

      {/* 顶图统计（全站统一 StatCard；副信息行为较上月比率） */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((c) => (
          <StatCard
            key={c.label}
            label={c.label}
            value={c.value}
            unit={c.unit}
            sub={c.sub}
            icon={c.icon}
            gradient={c.gradient}
          />
        ))}
      </div>

      {/* 访视提醒 / 待录入：左右分栏，可拖动调节宽度 */}
      <div ref={splitRef} className="flex flex-col lg:flex-row lg:items-stretch gap-4 lg:gap-0">
        {/* 访视提醒：表格样式，重点提示近 7 日计划访视患者数 */}
        <div className="min-w-0" style={isLg ? { width: `${split}%` } : undefined}>
        <Card className="h-full lg:h-[520px] flex flex-col">
          <CardHeader className="pb-2 shrink-0">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <AlarmClock className="w-4 h-4 text-amber-500" />
                访视提醒
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 font-medium">
                  近 {reminderRange} 日计划访视 {rangeReminders.length} 例
                </span>
              </CardTitle>
              <div className="flex items-center gap-2">
                <div className="flex rounded-full bg-slate-100 p-0.5">
                  {([{ k: 7 as const, label: '近 7 日' }, { k: 15 as const, label: '近 15 日' }]).map((t) => (
                    <button
                      key={t.k}
                      onClick={() => setReminderRange(t.k)}
                      className={`px-3 h-6 text-[11px] rounded-full transition-colors ${
                        reminderRange === t.k ? 'bg-white text-teal-600 shadow-sm font-medium' : 'text-slate-400 hover:text-slate-600'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                <Button variant="outline" size="sm" className="h-7 text-xs text-teal-600 border-teal-200 hover:bg-teal-50" asChild>
                  <Link to="/entry/visits">访视管理 <ChevronRight className="w-3.5 h-3.5 ml-0.5" /></Link>
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1 min-h-0 overflow-y-auto">
            {rangeReminders.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400">
                <CalendarClock className="w-8 h-8 mb-2 text-teal-200" />
                近 {reminderRange} 日无待访视提醒
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full table-fixed">
                  <thead className="sticky top-0 bg-white z-10">
                    <tr className="text-[11px] text-slate-400 border-b border-slate-100">
                      <th className="text-left font-medium py-2 pr-3 whitespace-nowrap w-[26%]">研究中心</th>
                      <th className="text-left font-medium py-2 pr-3 whitespace-nowrap w-[9%]">筛选编号</th>
                      <th className="text-left font-medium py-2 pr-3 whitespace-nowrap w-[10%]">随机编号</th>
                      <th className="text-left font-medium py-2 pr-3 whitespace-nowrap w-[9%]">姓名缩写</th>
                      <th className="text-left font-medium py-2 pr-3 whitespace-nowrap w-[7%]">性别</th>
                      <th className="text-left font-medium py-2 pr-3 whitespace-nowrap w-[13%]">上次访视</th>
                      <th className="text-left font-medium py-2 pr-3 whitespace-nowrap w-[14%]">近期访视</th>
                      <th className="text-left font-medium py-2 whitespace-nowrap">距下次访视</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {rangeReminders.map((r, idx) => {
                        const centerName = r.project.centers?.find((c) => c.id === r.patient.centerId)?.name || r.project.researchCenter
                        return (
                          <tr
                            key={idx}
                            className="hover:bg-teal-50/40 cursor-pointer transition-colors"
                            onClick={() => nav(`/entry/patients/${r.patient.id}`)}
                          >
                            <td className="py-2.5 pr-3 text-xs text-slate-500 max-w-[110px] truncate">{centerName}</td>
                            <td className="py-2.5 pr-3 font-mono text-sm text-slate-700">{r.patient.screeningId}</td>
                            <td className="py-2.5 pr-3 font-mono text-xs text-slate-500">{r.patient.randomizationId || '—'}</td>
                            <td className="py-2.5 pr-3 text-sm text-slate-600">{r.patient.nameInitials}</td>
                            <td className="py-2.5 pr-3 text-xs text-slate-500">{r.patient.gender === 'male' ? '男' : '女'}</td>
                            <td className="py-2.5 pr-3 text-xs text-slate-500 whitespace-nowrap">
                              {r.lastVisit ? `${r.lastVisit.code} ${r.lastVisit.name}` : '—'}
                            </td>
                            <td className="py-2.5 pr-3 whitespace-nowrap">
                              <span className="text-[11px] px-1.5 py-0.5 rounded bg-sky-50 text-sky-600 font-medium">
                                {r.visit.code} {r.visit.name}
                              </span>
                              <span className="block text-[11px] text-slate-400 mt-0.5 pl-0.5">{r.plannedDate}</span>
                            </td>
                            <td className="py-2.5 text-left whitespace-nowrap">
                              {r.overdueDays > 0 ? (
                                <span className="text-[11px] px-1.5 py-0.5 rounded bg-red-50 text-red-500 font-medium">已逾期 {r.overdueDays} 天</span>
                              ) : r.daysUntil === 0 ? (
                                <span className="text-[11px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 font-medium">今天到访</span>
                              ) : r.inWindow ? (
                                <span className="text-[11px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 font-medium">窗口期内</span>
                              ) : (
                                <span className="text-[11px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">还剩 {r.daysUntil} 天</span>
                              )}
                            </td>
                          </tr>
                        )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
        </div>

        {/* 左右拖拽手柄：拖动调节两栏宽度 */}
        <div
          className="hidden lg:flex items-center justify-center w-4 shrink-0 cursor-col-resize group"
          onMouseDown={onSplitDragStart}
          title="拖动调节左右宽度"
        >
          <GripVertical className="w-3.5 h-3.5 text-slate-300 group-hover:text-teal-500" />
        </div>

        {/* 待录入数据 */}
        <div className="min-w-0 flex-1">
        <Card className="h-full lg:h-[520px] flex flex-col">
          <CardHeader className="pb-2 shrink-0">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <BellRing className={`w-4 h-4 ${pendingVisits.length > 0 ? 'text-red-400' : 'text-teal-400'}`} />
                待录入数据
                {pendingVisits.length > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-50 text-red-500 font-medium">{pendingVisits.length}</span>
                )}
              </CardTitle>
              <div className="flex items-center gap-2">
                <div className="flex rounded-full bg-slate-100 p-0.5">
                  {([
                    { k: 'all' as const, label: '全部', n: pendingVisits.length },
                    { k: 'le5' as const, label: '逾期≤5天', n: pendingVisits.filter((g) => g.overdueDays > 0 && g.overdueDays <= 5).length },
                    { k: 'ge5' as const, label: '逾期≥5天', n: pendingVisits.filter((g) => g.overdueDays >= 5).length },
                  ]).map((t) => (
                    <button
                      key={t.k}
                      onClick={() => setPendingTab(t.k)}
                      className={`px-3 h-6 text-[11px] rounded-full transition-colors ${
                        pendingTab === t.k ? 'bg-white text-amber-600 shadow-sm font-medium' : 'text-slate-400 hover:text-slate-600'
                      }`}
                    >
                      {t.label}{t.n > 0 ? ` ${t.n}` : ''}
                    </button>
                  ))}
                </div>
                <Button variant="outline" size="sm" className="h-7 text-xs text-amber-600 border-amber-200 hover:bg-amber-50" asChild>
                  <Link to="/entry/data-entry">数据录入 <ChevronRight className="w-3.5 h-3.5 ml-0.5" /></Link>
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1 min-h-0 overflow-y-auto">
            {pendingVisits.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400">
                <CheckCircle className="w-8 h-8 mb-2 text-teal-200" />
                太棒了，暂无待录入的数据
              </div>
            ) : filteredPendingVisits.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400">
                <CheckCircle className="w-8 h-8 mb-2 text-teal-200" />
                该分类下暂无待录入访视
              </div>
            ) : (
              <div className="space-y-1.5">
                {filteredPendingVisits.map((g, idx) => (
                  <Link
                    key={idx}
                    to={`/entry/data-entry?projectNo=${g.project.projectNo}&patientId=${g.patient.id}&visitId=${g.visit.id}`}
                    title="点击前往访视录入矩阵定位该格子，再点击格子进入录入"
                    className="block rounded-lg border border-slate-100 hover:border-amber-300 hover:shadow-sm transition-all overflow-hidden group"
                  >
                    <div className="flex">
                      {/* 左侧状态色条：逾期红 / 进行中蓝 / 未开始灰 */}
                      <div className={`w-1 shrink-0 ${
                        g.overdueDays > 0 ? 'bg-red-400' : g.status === 'in_progress' ? 'bg-blue-400' : 'bg-slate-200'
                      }`} />
                      <div className="flex-1 min-w-0 px-3 py-2.5">
                        {/* 第一行：筛选编号 · 随机编号 · 状态 · 逾期 */}
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-semibold text-slate-800">{g.patient.screeningId}</span>
                          <span className="font-mono text-[11px] text-slate-400 truncate">{g.patient.randomizationId || '—'}</span>
                          <span className="flex-1" />
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 ${
                            g.status === 'in_progress' ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-400'
                          }`}>
                            {g.status === 'in_progress' ? '进行中' : '未开始'}
                          </span>
                          {g.overdueDays > 0 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-50 text-red-500 font-medium shrink-0">
                              逾期 {g.overdueDays} 天
                            </span>
                          )}
                          <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-amber-500 shrink-0" />
                        </div>
                        {/* 第二行：访视 + 待录入模块数 */}
                        <div className="mt-1.5 flex items-center gap-2">
                          <span className="text-[11px] px-1.5 py-0.5 rounded bg-sky-50 text-sky-600 font-medium shrink-0">
                            {g.visit.code} {g.visit.name}
                          </span>
                          <span className="text-xs text-slate-500">待录入 <span className="font-semibold text-slate-700">{g.moduleCount}</span> 个模块</span>
                        </div>
                        {/* 第三行：研究中心 · 访视日期 */}
                        <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-400">
                          <span className="truncate">{g.centerName}</span>
                          <span className="shrink-0">·</span>
                          <span className="shrink-0">访视日期 {g.plannedDate || '—'}</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        </div>
      </div>

      {/* 图表布局切换：并排 / 整行 */}
      <div className="flex items-center justify-end gap-2">
        <span className="text-xs text-slate-400">图表布局</span>
        <div className="flex rounded-full bg-slate-100 p-0.5">
          {([{ k: 'side' as const, label: '并排' }, { k: 'full' as const, label: '整行' }]).map((t) => (
            <button
              key={t.k}
              onClick={() => setChartLayout(t.k)}
              className={`px-3 h-6 text-[11px] rounded-full transition-colors ${
                chartLayout === t.k ? 'bg-white text-teal-600 shadow-sm font-medium' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className={chartLayout === 'side' ? 'grid grid-cols-1 lg:grid-cols-2 gap-4' : 'grid grid-cols-1 gap-4'}>
      {/* 患者登记 · 筛选失败 · 入组进度（按日 / 按月 / 按年） */}
      <Card className="min-w-0">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-teal-500" />
              进度统计
            </CardTitle>
            <div className="flex rounded-full bg-slate-100 p-0.5">
              {([{ k: 'day' as const, label: '按日' }, { k: 'month' as const, label: '按月' }, { k: 'year' as const, label: '按年' }]).map((t) => (
                <button
                  key={t.k}
                  onClick={() => setProgressUnit(t.k)}
                  className={`px-3 h-6 text-[11px] rounded-full transition-colors ${
                    progressUnit === t.k ? 'bg-white text-teal-600 shadow-sm font-medium' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={progressData} margin={{ top: 8, right: 12, left: -16, bottom: 0 }} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                  cursor={{ fill: 'rgba(20,184,166,0.06)' }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="登记" fill="#14b8a6" radius={[3, 3, 0, 0]} maxBarSize={28} />
                <Bar dataKey="筛选失败" fill="#ef4444" radius={[3, 3, 0, 0]} maxBarSize={28} />
                <Bar dataKey="入组" fill="#3b82f6" radius={[3, 3, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* 患者访视统计：每个患者完成的访视总数，可按项目编号筛选 */}
      <Card className="min-w-0">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <CalendarCheck className="w-4 h-4 text-sky-500" />
              访视统计
            </CardTitle>
            <Select value={visitChartProject} onValueChange={setVisitChartProject}>
              <SelectTrigger className="h-7 w-36 text-xs bg-slate-50 border-slate-200">
                <SelectValue placeholder="全部项目" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">全部项目</SelectItem>
                {myProjects.map((p) => (
                  <SelectItem key={p.id} value={p.projectNo} className="text-xs">{p.projectNo}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            {patientVisitStats.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-slate-400">所选项目暂无患者</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={patientVisitStats} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                    cursor={{ fill: 'rgba(59,130,246,0.06)' }}
                    formatter={(value: number | string, name: string) => [value, name === '完成访视' ? '完成访视（次）' : name]}
                    labelFormatter={(label: string) => {
                      const item = patientVisitStats.find((x) => x.name === label)
                      return `筛选编号 ${label}${item ? ` · ${item.initials}` : ''}`
                    }}
                  />
                  <Bar dataKey="完成访视" fill="#3b82f6" radius={[3, 3, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>
      </div>

      {/* 我的项目概览 */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-amber-500" />
              我的项目概览
            </CardTitle>
            <Button variant="ghost" size="sm" className="text-slate-400" asChild>
              <Link to="/entry/projects">全部项目 <ChevronRight className="w-3.5 h-3.5 ml-0.5" /></Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {myProjects.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-6 col-span-2">暂无分配的项目</p>
            )}
            {myProjects.map((project) => {
              const prog = projectProgress(project)
              const pct = prog.expected > 0 ? Math.round((prog.done / prog.expected) * 100) : 0
              return (
                <div key={project.id} className="p-4 rounded-xl border border-slate-100 hover:border-amber-200 transition-colors">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-xs font-mono text-amber-600">{project.projectNo}</div>
                      <div className="font-medium text-sm text-slate-800 truncate mt-0.5">{project.name}</div>
                    </div>
                    <span className="text-xs text-slate-400 shrink-0">{prog.patients} 例</span>
                  </div>
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-slate-400">录入完成度</span>
                      <span className="text-slate-600 font-medium">{prog.done}/{prog.expected} · {pct}%</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-teal-500' : 'bg-amber-400'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
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
