import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useAppStorage } from '@/hooks/useAppStorage'
import StatCard from '@/components/StatCard'
import { usePageSize } from '@/hooks/usePageSize'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Database, CheckCircle2, FileSignature, PenLine, ClipboardList,
  ChevronLeft, ChevronRight, PieChart, ShieldCheck, ClipboardCheck,
  Hourglass, Timer, UserX, Layers, User, Filter, Users, UserCog,
  Columns2, Rows2, FileDown,
} from 'lucide-react'

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100]
const DAY_MS = 24 * 60 * 60 * 1000
// 与访视管理一致：未配置计划访视日时按入组/知情后每 2 周一次估算
const VISIT_INTERVAL_DAYS = 14
// 审核时效口径：数据完成超过该天数仍未确认视为「逾期未审核」
const REVIEW_OVERDUE_DAYS = 3

function addDays(dateStr: string, days: number): Date {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d
}

/** 数据管理 · 进度总览（管理端 & 录入端共用；审核时效 / 人员工作量 / PDF 下载仅管理端可见） */
export default function ProgressOverview({ role = 'manager' }: { role?: 'manager' | 'entry' }) {
  const isManager = role === 'manager'
  const { projects, patients, visitData, users } = useAppStorage()
  const [searchParams] = useSearchParams()
  const selectedProjectNo = searchParams.get('projectNo') || 'all'

  // 范围：已发布项目（可经顶部项目筛选，支持全部研究）
  const scopedProjects = useMemo(
    () =>
      projects.filter(
        (p) => p.crfPublished && (selectedProjectNo === 'all' || p.projectNo === selectedProjectNo)
      ),
    [projects, selectedProjectNo]
  )
  const scopedProjectIds = useMemo(() => new Set(scopedProjects.map((p) => p.id)), [scopedProjects])
  const scopedPatients = useMemo(
    () => patients.filter((p) => scopedProjectIds.has(p.projectId)),
    [patients, scopedProjectIds]
  )
  const scopedVisitData = useMemo(
    () => visitData.filter((v) => scopedProjectIds.has(v.projectId)),
    [visitData, scopedProjectIds]
  )

  // 每位患者应录入的模块数 = 项目所有访视关联模块数之和
  const expectedModulesOf = (projectId: string) => {
    const proj = projects.find((p) => p.id === projectId)
    return proj ? proj.visits.reduce((sum, v) => sum + v.crfModuleIds.length, 0) : 0
  }

  // 总体统计：录入 → 审核 → 签名 三级漏斗
  const stats = useMemo(() => {
    const expected = scopedPatients.reduce((sum, p) => sum + expectedModulesOf(p.projectId), 0)
    const completed = scopedVisitData.filter((v) => v.status === 'completed').length
    const reviewed = scopedVisitData.filter((v) => v.status === 'completed' && v.reviewedAt).length
    const signed = scopedVisitData.filter((v) => v.status === 'completed' && v.signedAt).length
    const rate = expected > 0 ? Math.round((completed / expected) * 100) : 0
    const reviewRate = completed > 0 ? Math.round((reviewed / completed) * 100) : 0
    const signRate = completed > 0 ? Math.round((signed / completed) * 100) : 0
    return {
      expected, completed, reviewed, signed,
      unreviewed: completed - reviewed, unsigned: completed - signed,
      rate, reviewRate, signRate,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopedPatients, scopedVisitData, projects])

  // 基于研究的进度
  const byProject = useMemo(() => {
    return scopedProjects.map((proj) => {
      const pp = scopedPatients.filter((p) => p.projectId === proj.id)
      const vd = scopedVisitData.filter((v) => v.projectId === proj.id)
      const expected = pp.length * expectedModulesOf(proj.id)
      const completed = vd.filter((v) => v.status === 'completed').length
      const reviewed = vd.filter((v) => v.status === 'completed' && v.reviewedAt).length
      const signed = vd.filter((v) => v.status === 'completed' && v.signedAt).length
      // 超窗统计：实际访视日期 > 计划日期 + 窗口期（口径与访视管理一致）
      let visited = 0
      let overWindow = 0
      pp.filter((p) => p.status !== 'withdrawn' && p.status !== 'lost').forEach((patient) => {
        const baseDate = patient.enrollmentDate || patient.consentDate || patient.createdAt?.slice(0, 10)
        if (!baseDate) return
        proj.visits.forEach((visit) => {
          const recs = vd.filter((v) => v.patientId === patient.id && v.visitId === visit.id)
          if (recs.length === 0) return
          visited++
          const visitDateRec = recs.find((r) => typeof r.data?.visitDate === 'string' && r.data.visitDate)
          const actual = visitDateRec
            ? (visitDateRec.data.visitDate as string)
            : recs.map((r) => r.createdAt.slice(0, 10)).sort()[0]
          const latest = addDays(baseDate, (visit.plannedDay ?? visit.order * VISIT_INTERVAL_DAYS) + (visit.windowDays ?? 3))
          if (new Date(actual).getTime() > latest.getTime()) overWindow++
        })
      })
      return {
        id: proj.id,
        projectNo: proj.projectNo,
        name: proj.name,
        patientCount: pp.length,
        expected,
        completed,
        rate: expected > 0 ? Math.round((completed / expected) * 100) : 0,
        reviewRate: completed > 0 ? Math.round((reviewed / completed) * 100) : 0,
        signRate: completed > 0 ? Math.round((signed / completed) * 100) : 0,
        overWindow,
        visited,
        overWindowRate: visited > 0 ? Math.round((overWindow / visited) * 100) : 0,
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopedProjects, scopedPatients, scopedVisitData, projects])

  // 基于患者的进度
  const byPatient = useMemo(() => {
    return scopedPatients
      .map((p) => {
        const proj = projects.find((x) => x.id === p.projectId)
        const vd = scopedVisitData.filter((v) => v.patientId === p.id)
        const expected = expectedModulesOf(p.projectId)
        const completed = vd.filter((v) => v.status === 'completed').length
        const reviewed = vd.filter((v) => v.status === 'completed' && v.reviewedAt).length
        const signed = vd.filter((v) => v.status === 'completed' && v.signedAt).length
        // 超窗访视次数：实际访视日期 > 计划日期 + 窗口期（口径与访视管理一致）
        let overWindow = 0
        if (proj && p.status !== 'withdrawn' && p.status !== 'lost') {
          const baseDate = p.enrollmentDate || p.consentDate || p.createdAt?.slice(0, 10)
          if (baseDate) {
            proj.visits.forEach((visit) => {
              const recs = vd.filter((v) => v.visitId === visit.id)
              if (recs.length === 0) return
              const visitDateRec = recs.find((r) => typeof r.data?.visitDate === 'string' && r.data.visitDate)
              const actual = visitDateRec
                ? (visitDateRec.data.visitDate as string)
                : recs.map((r) => r.createdAt.slice(0, 10)).sort()[0]
              const latest = addDays(baseDate, (visit.plannedDay ?? visit.order * VISIT_INTERVAL_DAYS) + (visit.windowDays ?? 3))
              if (new Date(actual).getTime() > latest.getTime()) overWindow++
            })
          }
        }
        return {
          id: p.id,
          label: p.nameInitials,
          screeningId: p.screeningId || p.screeningNo,
          projectNo: proj?.projectNo || '-',
          currentVisit: p.currentVisit || '-',
          expected,
          completed,
          rate: expected > 0 ? Math.round((completed / expected) * 100) : 0,
          reviewRate: completed > 0 ? Math.round((reviewed / completed) * 100) : 0,
          signRate: completed > 0 ? Math.round((signed / completed) * 100) : 0,
          signed,
          reviewed,
          unsigned: completed - signed,
          overWindow,
        }
      })
      .sort((a, b) => b.unsigned - a.unsigned || a.projectNo.localeCompare(b.projectNo))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopedPatients, scopedVisitData, projects])

  // ========== 数据录入时效：访视结束 → 数据录入 ==========
  const timeliness = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return scopedProjects.map((proj) => {
      const projPatients = scopedPatients.filter(
        (p) => p.projectId === proj.id && p.status !== 'withdrawn' && p.status !== 'lost'
      )
      const cycles: number[] = []
      const overdueDays: number[] = []
      const overduePatientIds = new Set<string>()

      projPatients.forEach((patient) => {
        const baseDate = patient.enrollmentDate || patient.consentDate || patient.createdAt?.slice(0, 10)
        if (!baseDate) return
        proj.visits.forEach((visit) => {
          const moduleCount = visit.crfModuleIds.length
          if (moduleCount === 0) return
          const planned = addDays(baseDate, visit.plannedDay ?? visit.order * VISIT_INTERVAL_DAYS)
          const windowDays = visit.windowDays ?? 3
          const deadline = addDays(baseDate, (visit.plannedDay ?? visit.order * VISIT_INTERVAL_DAYS) + windowDays)
          const recs = scopedVisitData.filter(
            (v) => v.patientId === patient.id && v.visitId === visit.id && v.status === 'completed'
          )
          if (recs.length >= moduleCount) {
            const firstEntry = recs.reduce((min, r) => (r.createdAt < min ? r.createdAt : min), recs[0].createdAt)
            const days = Math.round((new Date(firstEntry.slice(0, 10)).getTime() - planned.getTime()) / DAY_MS)
            cycles.push(days)
          } else if (today.getTime() > deadline.getTime()) {
            overdueDays.push(Math.round((today.getTime() - deadline.getTime()) / DAY_MS))
            overduePatientIds.add(patient.id)
          }
        })
      })

      return {
        id: proj.id,
        projectNo: proj.projectNo,
        name: proj.name,
        avgCycle: cycles.length > 0 ? Math.round((cycles.reduce((s, d) => s + d, 0) / cycles.length) * 10) / 10 : null,
        completedVisits: cycles.length,
        overduePatients: overduePatientIds.size,
        avgOverdue: overdueDays.length > 0 ? Math.round((overdueDays.reduce((s, d) => s + d, 0) / overdueDays.length) * 10) / 10 : null,
      }
    })
  }, [scopedProjects, scopedPatients, scopedVisitData])

  // 基于患者的数据录入时效（具体研究视图下使用）
  const patientTimeliness = useMemo(() => {
    if (selectedProjectNo === 'all') return []
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return scopedPatients
      .filter((p) => p.status !== 'withdrawn' && p.status !== 'lost')
      .map((patient) => {
        const proj = projects.find((x) => x.id === patient.projectId)
        if (!proj) return null
        const baseDate = patient.enrollmentDate || patient.consentDate || patient.createdAt?.slice(0, 10)
        if (!baseDate) return null
        const cycles: number[] = []
        const overdueDays: number[] = []
        proj.visits.forEach((visit) => {
          const moduleCount = visit.crfModuleIds.length
          if (moduleCount === 0) return
          const plannedDay = visit.plannedDay ?? visit.order * VISIT_INTERVAL_DAYS
          const planned = addDays(baseDate, plannedDay)
          const deadline = addDays(baseDate, plannedDay + (visit.windowDays ?? 3))
          const recs = scopedVisitData.filter(
            (v) => v.patientId === patient.id && v.visitId === visit.id && v.status === 'completed'
          )
          if (recs.length >= moduleCount) {
            const firstEntry = recs.reduce((min, r) => (r.createdAt < min ? r.createdAt : min), recs[0].createdAt)
            cycles.push(Math.round((new Date(firstEntry.slice(0, 10)).getTime() - planned.getTime()) / DAY_MS))
          } else if (today.getTime() > deadline.getTime()) {
            overdueDays.push(Math.round((today.getTime() - deadline.getTime()) / DAY_MS))
          }
        })
        return {
          id: patient.id,
          label: patient.nameInitials,
          screeningId: patient.screeningId || patient.screeningNo,
          currentVisit: patient.currentVisit || '-',
          completedVisits: cycles.length,
          avgCycle: cycles.length > 0 ? Math.round((cycles.reduce((s, d) => s + d, 0) / cycles.length) * 10) / 10 : null,
          overdueVisits: overdueDays.length,
          avgOverdue: overdueDays.length > 0 ? Math.round((overdueDays.reduce((s, d) => s + d, 0) / overdueDays.length) * 10) / 10 : null,
        }
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .sort((a, b) => b.overdueVisits - a.overdueVisits)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProjectNo, scopedPatients, scopedVisitData, projects])

  // ========== 审核时效：数据完成 → 管理人员确认 ==========
  // 口径：审核周期 = reviewedAt - 记录最后更新（完成）时间；完成超过 REVIEW_OVERDUE_DAYS 天未确认视为逾期
  const reviewTimeliness = useMemo(() => {
    const todayMs = Date.now()
    return scopedProjects.map((proj) => {
      const vd = scopedVisitData.filter((v) => v.projectId === proj.id && v.status === 'completed')
      const cycles: number[] = []
      const overdueDays: number[] = []
      vd.forEach((r) => {
        const doneMs = new Date(r.updatedAt).getTime()
        if (r.reviewedAt) {
          cycles.push(Math.max(0, Math.round((new Date(r.reviewedAt).getTime() - doneMs) / DAY_MS)))
        } else {
          const waiting = Math.floor((todayMs - doneMs) / DAY_MS)
          if (waiting > REVIEW_OVERDUE_DAYS) overdueDays.push(waiting - REVIEW_OVERDUE_DAYS)
        }
      })
      return {
        id: proj.id,
        projectNo: proj.projectNo,
        name: proj.name,
        reviewedCount: cycles.length,
        pendingReview: vd.length - cycles.length,
        avgCycle: cycles.length > 0 ? Math.round((cycles.reduce((s, d) => s + d, 0) / cycles.length) * 10) / 10 : null,
        overdueCount: overdueDays.length,
        avgOverdue: overdueDays.length > 0 ? Math.round((overdueDays.reduce((s, d) => s + d, 0) / overdueDays.length) * 10) / 10 : null,
      }
    })
  }, [scopedProjects, scopedVisitData])

  // 基于患者的审核时效（具体研究视图下使用）
  const patientReviewTimeliness = useMemo(() => {
    if (selectedProjectNo === 'all') return []
    const todayMs = Date.now()
    return scopedPatients
      .map((patient) => {
        const vd = scopedVisitData.filter((v) => v.patientId === patient.id && v.status === 'completed')
        if (vd.length === 0) return null
        const cycles: number[] = []
        const overdueDays: number[] = []
        vd.forEach((r) => {
          const doneMs = new Date(r.updatedAt).getTime()
          if (r.reviewedAt) {
            cycles.push(Math.max(0, Math.round((new Date(r.reviewedAt).getTime() - doneMs) / DAY_MS)))
          } else {
            const waiting = Math.floor((todayMs - doneMs) / DAY_MS)
            if (waiting > REVIEW_OVERDUE_DAYS) overdueDays.push(waiting - REVIEW_OVERDUE_DAYS)
          }
        })
        return {
          id: patient.id,
          label: patient.nameInitials,
          screeningId: patient.screeningId || patient.screeningNo,
          currentVisit: patient.currentVisit || '-',
          reviewedCount: cycles.length,
          pendingReview: vd.length - cycles.length,
          avgCycle: cycles.length > 0 ? Math.round((cycles.reduce((s, d) => s + d, 0) / cycles.length) * 10) / 10 : null,
          overdueCount: overdueDays.length,
          avgOverdue: overdueDays.length > 0 ? Math.round((overdueDays.reduce((s, d) => s + d, 0) / overdueDays.length) * 10) / 10 : null,
        }
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .sort((a, b) => b.overdueCount - a.overdueCount || b.pendingReview - a.pendingReview)
  }, [selectedProjectNo, scopedPatients, scopedVisitData])

  // ========== 人员工作量 ==========
  // 录入人员：按记录创建人聚合
  const entryWorkload = useMemo(() => {
    const map = new Map<string, { completed: number; inProgress: number; patientIds: Set<string> }>()
    scopedVisitData.forEach((v) => {
      if (!v.createdBy) return
      const cur = map.get(v.createdBy) ?? { completed: 0, inProgress: 0, patientIds: new Set<string>() }
      if (v.status === 'completed') cur.completed++
      else cur.inProgress++
      cur.patientIds.add(v.patientId)
      map.set(v.createdBy, cur)
    })
    return [...map.entries()]
      .map(([uid, w]) => {
        const u = users.find((x) => x.id === uid)
        return {
          id: uid,
          name: u?.name ?? '未知人员',
          organization: u?.organization ?? '-',
          patients: w.patientIds.size,
          completed: w.completed,
          inProgress: w.inProgress,
        }
      })
      .sort((a, b) => b.completed - a.completed)
  }, [scopedVisitData, users])

  // 审核 / 签署人员：按审核人、签署人聚合（历史种子数据可能存的是用户 ID，统一解析为姓名）
  const reviewerWorkload = useMemo(() => {
    const resolveName = (key: string) => users.find((u) => u.id === key)?.name ?? key
    const map = new Map<string, { reviewed: number; signed: number; cycles: number[] }>()
    scopedVisitData.forEach((v) => {
      if (v.status !== 'completed') return
      if (v.reviewedBy) {
        const name = resolveName(v.reviewedBy)
        const cur = map.get(name) ?? { reviewed: 0, signed: 0, cycles: [] }
        cur.reviewed++
        if (v.reviewedAt) {
          cur.cycles.push(Math.max(0, Math.round((new Date(v.reviewedAt).getTime() - new Date(v.updatedAt).getTime()) / DAY_MS)))
        }
        map.set(name, cur)
      }
      if (v.signedBy) {
        const name = resolveName(v.signedBy)
        const cur = map.get(name) ?? { reviewed: 0, signed: 0, cycles: [] }
        cur.signed++
        map.set(name, cur)
      }
    })
    return [...map.entries()]
      .map(([name, w]) => ({
        name,
        reviewed: w.reviewed,
        signed: w.signed,
        avgCycle: w.cycles.length > 0 ? Math.round((w.cycles.reduce((s, d) => s + d, 0) / w.cycles.length) * 10) / 10 : null,
      }))
      .sort((a, b) => b.reviewed - a.reviewed)
  }, [scopedVisitData, users])

  // 主表 Tab：基于研究 / 基于患者（具体研究视图下默认基于患者）
  const [mainTab, setMainTab] = useState<'project' | 'patient'>(selectedProjectNo === 'all' ? 'project' : 'patient')
  useEffect(() => {
    setMainTab(selectedProjectNo === 'all' ? 'project' : 'patient')
  }, [selectedProjectNo])

  // 患者表分页（按角色分别记忆每页行数）
  const [pageSize, setPageSize] = usePageSize(`crf_pagesize_${role}_datamgmt`)
  const [page, setPage] = useState(1)
  const totalPages = Math.max(1, Math.ceil(byPatient.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const pagedPatients = useMemo(
    () => byPatient.slice((safePage - 1) * pageSize, safePage * pageSize),
    [byPatient, safePage, pageSize]
  )
  useEffect(() => {
    setPage(1)
  }, [byPatient])

  // 数据录入时效（基于患者）分页
  const [tlPageSize, setTlPageSize] = usePageSize(`crf_pagesize_${role}_datamgmt_tl`)
  const [tlPage, setTlPage] = useState(1)
  const tlTotalPages = Math.max(1, Math.ceil(patientTimeliness.length / tlPageSize))
  const tlSafePage = Math.min(tlPage, tlTotalPages)
  const pagedTimeliness = useMemo(
    () => patientTimeliness.slice((tlSafePage - 1) * tlPageSize, tlSafePage * tlPageSize),
    [patientTimeliness, tlSafePage, tlPageSize]
  )
  useEffect(() => {
    setTlPage(1)
  }, [patientTimeliness])

  // 审核时效（基于患者）分页
  const [rtPageSize, setRtPageSize] = usePageSize(`crf_pagesize_${role}_datamgmt_rt`)
  const [rtPage, setRtPage] = useState(1)
  const rtTotalPages = Math.max(1, Math.ceil(patientReviewTimeliness.length / rtPageSize))
  const rtSafePage = Math.min(rtPage, rtTotalPages)
  const pagedReviewTimeliness = useMemo(
    () => patientReviewTimeliness.slice((rtSafePage - 1) * rtPageSize, rtSafePage * rtPageSize),
    [patientReviewTimeliness, rtSafePage, rtPageSize]
  )
  useEffect(() => {
    setRtPage(1)
  }, [patientReviewTimeliness])

  // 人员工作量布局：并排 / 整行
  const [workloadLayout, setWorkloadLayout] = useState<'grid' | 'rows'>('grid')

  const statCards = [
    { label: '应录入总数', value: stats.expected, unit: '项', sub: '按 CRF 配置应录入', icon: Database, gradient: 'from-blue-500 to-blue-600' },
    { label: '已完成录入', value: stats.completed, unit: '项', sub: `完成率 ${stats.rate}%`, icon: CheckCircle2, gradient: 'from-emerald-500 to-green-600' },
    { label: '已审核', value: stats.reviewed, unit: '项', sub: `审核率 ${stats.reviewRate}%`, icon: ShieldCheck, gradient: 'from-teal-500 to-cyan-600' },
    { label: '待审核', value: stats.unreviewed, unit: '项', sub: '待管理人员确认', icon: ClipboardCheck, gradient: 'from-orange-500 to-amber-600' },
    { label: '已签名', value: stats.signed, unit: '项', sub: `签署率 ${stats.signRate}%`, icon: FileSignature, gradient: 'from-purple-500 to-violet-600' },
    { label: '待签名', value: stats.unsigned, unit: '项', sub: '待研究人员签署', icon: PenLine, gradient: 'from-amber-500 to-yellow-600' },
  ]

  const progressBars = [
    { label: '总体录入进度', rate: stats.rate, color: 'text-green-600', note: `已完成 ${stats.completed} / 应录入 ${stats.expected} 项` },
    { label: '总体审核进度', rate: stats.reviewRate, color: 'text-teal-600', note: `已审核 ${stats.reviewed} / 已完成 ${stats.completed} 项，由管理人员确认数据` },
    { label: '总体签名进度', rate: stats.signRate, color: 'text-purple-600', note: `已签名 ${stats.signed} / 已完成 ${stats.completed} 项，由研究人员签署确认` },
  ]

  // 数据流转漏斗：应录入 → 已完成 → 已审核 → 已签名
  const funnelStages = [
    { label: '应录入', value: stats.expected, barColor: 'bg-blue-400', textColor: 'text-blue-600', rate: null as number | null },
    { label: '已完成', value: stats.completed, barColor: 'bg-green-400', textColor: 'text-green-600', rate: stats.rate },
    { label: '已审核', value: stats.reviewed, barColor: 'bg-teal-400', textColor: 'text-teal-600', rate: stats.reviewRate },
    { label: '已签名', value: stats.signed, barColor: 'bg-purple-400', textColor: 'text-purple-600', rate: stats.signRate },
  ]

  return (
    <div className="space-y-4">
      {/* 指定项目但未发布 CRF 时给出明确提示，避免全零页面看起来像空白页 */}
      {selectedProjectNo !== 'all' && scopedProjects.length === 0 && (
        <Card className="bg-amber-50/60 border-amber-200">
          <CardContent className="py-8 text-center">
            <p className="text-sm text-amber-700 font-medium">该项目尚未发布 CRF，暂无录入、审核、签名数据</p>
            <p className="text-xs text-amber-500 mt-1">完成 CRF 配置并发布、登记患者后，此处将自动展示数据进度统计</p>
          </CardContent>
        </Card>
      )}
      {/* 统计卡片（全站统一 StatCard） */}
      <div className="grid grid-cols-6 gap-4">
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

      {/* 数据流转漏斗：录入 → 审核 → 签名 */}
      <Card className="bg-white overflow-hidden py-0 gap-0">
        <CardContent className="p-0">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-3">
            <Filter className="w-4 h-4 text-indigo-500" />
            <h3 className="text-sm font-semibold text-slate-800">数据流转漏斗</h3>
            <span className="text-xs text-slate-400">应录入 → 已完成 → 已审核 → 已签名 逐级流转与转化率</span>
          </div>
          <div className="px-6 py-4 space-y-2.5">
            {funnelStages.map((s, i) => {
              const widthPct = stats.expected > 0 ? Math.max(2, Math.round((s.value / stats.expected) * 100)) : 0
              return (
                <div key={s.label} className="flex items-center gap-3">
                  <span className="w-12 text-xs text-slate-500 text-right shrink-0">{s.label}</span>
                  <div className="flex-1 h-7 bg-slate-50 rounded-md overflow-hidden">
                    <div
                      className={`h-full ${s.barColor} rounded-md flex items-center justify-end pr-2 transition-all`}
                      style={{ width: `${widthPct}%` }}
                    >
                      {widthPct >= 8 && (
                        <span className="text-[11px] font-bold text-white">{s.value}</span>
                      )}
                    </div>
                  </div>
                  <span className="w-24 shrink-0 text-xs">
                    {widthPct < 8 && <span className={`font-bold ${s.textColor} mr-1.5`}>{s.value}</span>}
                    {s.rate !== null && (
                      <span className="text-slate-400">
                        {i === 1 ? '完成率' : i === 2 ? '审核率' : '签署率'}{' '}
                        <span className={`font-semibold ${s.textColor}`}>{s.rate}%</span>
                      </span>
                    )}
                  </span>
                </div>
              )
            })}
            <div className="grid grid-cols-3 gap-6 pt-3 mt-1 border-t border-dashed border-slate-100">
              {progressBars.map((b) => (
                <p key={b.label} className="text-[11px] text-slate-400">
                  <span className={`font-medium ${b.color}`}>{b.label} {b.rate}%</span> · {b.note}
                </p>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 录入 & 审核 & 签名：基于研究 / 基于患者 Tab 切换 */}
      <Card className="bg-white overflow-hidden py-0 gap-0">
        <CardContent className="p-0">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-3">
            <PieChart className="w-4 h-4 text-sky-500" />
            <h3 className="text-sm font-semibold text-slate-800">录入 & 审核 & 签名</h3>
            <div className="ml-auto flex items-center gap-0.5 bg-slate-100 rounded-lg p-0.5">
              {([
                { key: 'project', label: '基于研究', icon: Layers },
                { key: 'patient', label: '基于患者', icon: User },
              ] as const).map(({ key, label, icon: TabIcon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setMainTab(key)}
                  className={`px-3 py-1 rounded-md text-xs flex items-center gap-1 transition-colors ${
                    mainTab === key ? 'bg-white text-sky-600 shadow-sm font-medium' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <TabIcon className="w-3 h-3" /> {label}
                </button>
              ))}
            </div>
          </div>

          {mainTab === 'project' ? (
            <>
              {/* 基于研究 */}
              <div className="grid grid-cols-8 bg-slate-50 border-b border-slate-200">
                {['项目', '患者数', '应录入', '已完成', '录入完成率', '审核比率', '签名比率', '超窗率'].map((h) => (
                  <div key={h} className="py-2.5 px-3 text-center text-xs font-medium text-slate-500">{h}</div>
                ))}
              </div>
              {byProject.length === 0 && (
                <div className="text-center py-8 text-sm text-slate-400">所选范围暂无已发布项目</div>
              )}
              {byProject.map((row, idx) => (
                <div
                  key={row.id}
                  className={`grid grid-cols-8 text-xs text-slate-700 items-center hover:bg-sky-50/40 transition-colors ${
                    idx !== byProject.length - 1 ? 'border-b border-slate-100' : ''
                  }`}
                >
                  <div className="py-3 px-3 text-center">
                    <div className="font-medium text-slate-800">{row.projectNo}</div>
                    <div className="text-[10px] text-slate-400 truncate max-w-[140px] mx-auto" title={row.name}>{row.name}</div>
                  </div>
                  <div className="py-3 px-3 text-center">{row.patientCount} 例</div>
                  <div className="py-3 px-3 text-center">{row.expected}</div>
                  <div className="py-3 px-3 text-center text-green-600 font-medium">{row.completed}</div>
                  {([
                    { v: row.rate, c: 'text-green-600' },
                    { v: row.reviewRate, c: 'text-teal-600' },
                    { v: row.signRate, c: 'text-purple-600' },
                  ]).map((r, i) => (
                    <div key={i} className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        <Progress value={r.v} className="h-1.5 flex-1" />
                        <span className={`w-8 text-right ${r.c}`}>{r.v}%</span>
                      </div>
                    </div>
                  ))}
                  <div className="py-3 px-3 text-center">
                    {row.visited === 0 ? (
                      <span className="text-slate-300">—</span>
                    ) : (
                      <>
                        <span className={row.overWindow > 0 ? 'text-red-600 font-medium' : 'text-slate-500'}>
                          {row.overWindowRate}%
                        </span>
                        <span className="text-[10px] text-slate-400 ml-1">
                          {row.overWindow}/{row.visited}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </>
          ) : (
            <>
              {/* 基于患者 */}
              <div className="grid grid-cols-11 bg-slate-50 border-b border-slate-200">
                {['患者', '项目', '当前访视', '应录入', '已完成', '完成率', '审核比率', '签名比率', '超窗', '签名状态', '操作'].map((h) => (
                  <div key={h} className="py-2.5 px-3 text-center text-xs font-medium text-slate-500">{h}</div>
                ))}
              </div>
              {pagedPatients.length === 0 && (
                <div className="text-center py-8 text-sm text-slate-400">所选范围暂无患者数据</div>
              )}
              {pagedPatients.map((row, idx) => (
                <div
                  key={row.id}
                  className={`grid grid-cols-11 text-xs text-slate-700 items-center hover:bg-sky-50/40 transition-colors ${
                    idx !== pagedPatients.length - 1 ? 'border-b border-slate-100' : ''
                  }`}
                >
                  <div className="py-3 px-3 text-center">
                    <span className="font-medium text-slate-800">{row.label}</span>
                    <span className="text-slate-400 ml-1">{row.screeningId}</span>
                  </div>
                  <div className="py-3 px-3 text-center">{row.projectNo}</div>
                  <div className="py-3 px-3 text-center">{row.currentVisit}</div>
                  <div className="py-3 px-3 text-center">{row.expected}</div>
                  <div className="py-3 px-3 text-center text-green-600 font-medium">{row.completed}</div>
                  <div className="py-3 px-3 text-center">{row.rate}%</div>
                  <div className="py-3 px-3 text-center text-teal-600">{row.reviewRate}%</div>
                  <div className="py-3 px-3 text-center text-purple-600">{row.signRate}%</div>
                  <div className="py-3 px-3 text-center">
                    {row.overWindow > 0 ? (
                      <span className="inline-flex items-center gap-1 text-red-600 font-medium" title={`${row.overWindow} 次访视超出窗口期`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
                        {row.overWindow} 次
                      </span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </div>
                  <div className="py-3 px-3 text-center">
                    {row.completed === 0 ? (
                      <Badge variant="outline" className="bg-slate-50 text-slate-500 border-slate-200 text-[10px]">暂无数据</Badge>
                    ) : row.unsigned === 0 ? (
                      <Badge variant="outline" className="bg-green-50 text-green-600 border-green-200 text-[10px]">全部已签</Badge>
                    ) : row.signed > 0 ? (
                      <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200 text-[10px]">部分签署</Badge>
                    ) : (
                      <Badge variant="outline" className="bg-red-50 text-red-600 border-red-200 text-[10px]">待签署</Badge>
                    )}
                  </div>
                  <div className="py-3 px-3 text-center">
                    <div className="flex flex-col items-center gap-1.5">
                      <Button size="sm" variant="outline" className="h-6 px-2 text-[11px]" asChild>
                        <Link to={isManager ? `/manager/review/${row.id}` : `/entry/patients/${row.id}`}>
                          <ClipboardList className="w-3 h-3 mr-1" /> 查看数据
                        </Link>
                      </Button>
                      {isManager && (row.expected > 0 && row.completed === row.expected && row.reviewed === row.completed && row.signed === row.completed ? (
                        <Button size="sm" variant="outline" className="h-6 px-2 text-[11px] text-sky-600 border-sky-200 hover:bg-sky-50" asChild>
                          <Link to={`/manager/patient-print/${row.id}`} target="_blank">
                            <FileDown className="w-3 h-3 mr-1" /> 下载PDF
                          </Link>
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 px-2 text-[11px] text-slate-300 border-slate-100 cursor-not-allowed"
                          disabled
                          title="数据全部录入、审核、签署完成后可下载 PDF"
                        >
                          <FileDown className="w-3 h-3 mr-1" /> 下载PDF
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
              ))}

              {/* 分页栏 */}
              {byPatient.length > 0 && (
                <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-200 bg-slate-50/50">
                  <span className="text-xs text-slate-500">
                    共 {byPatient.length} 例 · 第 {(safePage - 1) * pageSize + 1}-{Math.min(safePage * pageSize, byPatient.length)} 例
                  </span>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-slate-400">每页</span>
                      <Select
                        value={String(pageSize)}
                        onValueChange={(v) => { setPageSize(Number(v)); setPage(1) }}
                      >
                        <SelectTrigger className="h-7 w-[64px] text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PAGE_SIZE_OPTIONS.map((n) => (
                            <SelectItem key={n} value={String(n)} className="text-xs">{n}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <span className="text-xs text-slate-400">行</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline" size="sm" className="h-7 w-7 p-0"
                        disabled={safePage <= 1}
                        onClick={() => setPage(safePage - 1)}
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </Button>
                      <span className="text-xs text-slate-600 min-w-[52px] text-center">
                        {safePage} / {totalPages}
                      </span>
                      <Button
                        variant="outline" size="sm" className="h-7 w-7 p-0"
                        disabled={safePage >= totalPages}
                        onClick={() => setPage(safePage + 1)}
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* 数据录入时效：全部研究时基于研究，具体研究视图下基于患者 */}
      <Card className="bg-white overflow-hidden py-0 gap-0">
        <CardContent className="p-0">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-3">
            <Hourglass className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-semibold text-slate-800">数据录入时效</h3>
            <span className="text-xs text-slate-400">
              访视结束到数据录入的周期统计{selectedProjectNo === 'all' ? '（基于不同研究）' : '（基于患者）'}
            </span>
          </div>
          {selectedProjectNo === 'all' ? (
            <>
          <div className="grid grid-cols-6 bg-slate-50 border-b border-slate-200">
            {['项目', '已统计访视', '平均录入周期', '逾期未录入患者', '平均逾期时间', '时效评价'].map((h) => (
              <div key={h} className="py-2.5 px-3 text-center text-xs font-medium text-slate-500">{h}</div>
            ))}
          </div>
          {timeliness.length === 0 && (
            <div className="text-center py-8 text-sm text-slate-400">所选范围暂无已发布项目</div>
          )}
          {timeliness.map((row, idx) => (
            <div
              key={row.id}
              className={`grid grid-cols-6 text-xs text-slate-700 items-center hover:bg-sky-50/40 transition-colors ${
                idx !== timeliness.length - 1 ? 'border-b border-slate-100' : ''
              }`}
            >
              <div className="py-3 px-3 text-center">
                <div className="font-medium text-slate-800">{row.projectNo}</div>
                <div className="text-[10px] text-slate-400 truncate max-w-[140px] mx-auto" title={row.name}>{row.name}</div>
              </div>
              <div className="py-3 px-3 text-center">{row.completedVisits} 次</div>
              <div className="py-3 px-3 text-center">
                {row.avgCycle !== null ? (
                  <span className="flex items-center justify-center gap-1 text-sky-600 font-medium">
                    <Timer className="w-3.5 h-3.5" /> {row.avgCycle} 天
                  </span>
                ) : (
                  <span className="text-slate-400">-</span>
                )}
              </div>
              <div className="py-3 px-3 text-center">
                {row.overduePatients > 0 ? (
                  <span className="flex items-center justify-center gap-1 text-red-600 font-medium">
                    <UserX className="w-3.5 h-3.5" /> {row.overduePatients} 例
                  </span>
                ) : (
                  <span className="text-green-600">0 例</span>
                )}
              </div>
              <div className="py-3 px-3 text-center">
                {row.avgOverdue !== null ? (
                  <span className="text-red-600 font-medium">{row.avgOverdue} 天</span>
                ) : (
                  <span className="text-slate-400">-</span>
                )}
              </div>
              <div className="py-3 px-3 text-center">
                {row.overduePatients > 0 ? (
                  <Badge variant="outline" className="bg-red-50 text-red-600 border-red-200 text-[10px]">存在逾期</Badge>
                ) : row.avgCycle !== null && row.avgCycle <= 3 ? (
                  <Badge variant="outline" className="bg-green-50 text-green-600 border-green-200 text-[10px]">录入及时</Badge>
                ) : row.avgCycle !== null ? (
                  <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200 text-[10px]">录入偏慢</Badge>
                ) : (
                  <Badge variant="outline" className="bg-slate-50 text-slate-500 border-slate-200 text-[10px]">暂无数据</Badge>
                )}
              </div>
            </div>
          ))}
            </>
          ) : (
            <>
          <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-200">
            {['患者', '当前访视', '已统计访视', '平均录入周期', '逾期未录入访视', '平均逾期时间', '时效评价'].map((h) => (
              <div key={h} className="py-2.5 px-3 text-center text-xs font-medium text-slate-500">{h}</div>
            ))}
          </div>
          {patientTimeliness.length === 0 && (
            <div className="text-center py-8 text-sm text-slate-400">该研究暂无患者数据</div>
          )}
          {pagedTimeliness.map((row, idx) => (
            <div
              key={row.id}
              className={`grid grid-cols-7 text-xs text-slate-700 items-center hover:bg-sky-50/40 transition-colors ${
                idx !== pagedTimeliness.length - 1 ? 'border-b border-slate-100' : ''
              }`}
            >
              <div className="py-3 px-3 text-center">
                <span className="font-medium text-slate-800">{row.label}</span>
                <span className="text-slate-400 ml-1">{row.screeningId}</span>
              </div>
              <div className="py-3 px-3 text-center">{row.currentVisit}</div>
              <div className="py-3 px-3 text-center">{row.completedVisits} 次</div>
              <div className="py-3 px-3 text-center">
                {row.avgCycle !== null ? (
                  <span className="flex items-center justify-center gap-1 text-sky-600 font-medium">
                    <Timer className="w-3.5 h-3.5" /> {row.avgCycle} 天
                  </span>
                ) : (
                  <span className="text-slate-400">-</span>
                )}
              </div>
              <div className="py-3 px-3 text-center">
                {row.overdueVisits > 0 ? (
                  <span className="flex items-center justify-center gap-1 text-red-600 font-medium">
                    <UserX className="w-3.5 h-3.5" /> {row.overdueVisits} 次
                  </span>
                ) : (
                  <span className="text-green-600">0 次</span>
                )}
              </div>
              <div className="py-3 px-3 text-center">
                {row.avgOverdue !== null ? (
                  <span className="text-red-600 font-medium">{row.avgOverdue} 天</span>
                ) : (
                  <span className="text-slate-400">-</span>
                )}
              </div>
              <div className="py-3 px-3 text-center">
                {row.overdueVisits > 0 ? (
                  <Badge variant="outline" className="bg-red-50 text-red-600 border-red-200 text-[10px]">存在逾期</Badge>
                ) : row.avgCycle !== null && row.avgCycle <= 3 ? (
                  <Badge variant="outline" className="bg-green-50 text-green-600 border-green-200 text-[10px]">录入及时</Badge>
                ) : row.avgCycle !== null ? (
                  <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200 text-[10px]">录入偏慢</Badge>
                ) : (
                  <Badge variant="outline" className="bg-slate-50 text-slate-500 border-slate-200 text-[10px]">暂无数据</Badge>
                )}
              </div>
            </div>
          ))}
          {/* 分页栏 */}
          {patientTimeliness.length > 0 && (
            <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-200 bg-slate-50/50">
              <span className="text-xs text-slate-500">
                共 {patientTimeliness.length} 例 · 第 {(tlSafePage - 1) * tlPageSize + 1}-{Math.min(tlSafePage * tlPageSize, patientTimeliness.length)} 例
              </span>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-slate-400">每页</span>
                  <Select
                    value={String(tlPageSize)}
                    onValueChange={(v) => { setTlPageSize(Number(v)); setTlPage(1) }}
                  >
                    <SelectTrigger className="h-7 w-[64px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAGE_SIZE_OPTIONS.map((n) => (
                        <SelectItem key={n} value={String(n)} className="text-xs">{n}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="text-xs text-slate-400">行</span>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline" size="sm" className="h-7 w-7 p-0"
                    disabled={tlSafePage <= 1}
                    onClick={() => setTlPage(tlSafePage - 1)}
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </Button>
                  <span className="text-xs text-slate-600 min-w-[52px] text-center">
                    {tlSafePage} / {tlTotalPages}
                  </span>
                  <Button
                    variant="outline" size="sm" className="h-7 w-7 p-0"
                    disabled={tlSafePage >= tlTotalPages}
                    onClick={() => setTlPage(tlSafePage + 1)}
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          )}
            </>
          )}
        </CardContent>
      </Card>

      {/* 审核时效：数据完成 → 管理人员确认（全部研究时基于研究，具体研究视图下基于患者；仅管理端可见） */}
      {isManager && (
      <Card className="bg-white overflow-hidden py-0 gap-0">
        <CardContent className="p-0">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-3">
            <ShieldCheck className="w-4 h-4 text-teal-500" />
            <h3 className="text-sm font-semibold text-slate-800">审核时效</h3>
            <span className="text-xs text-slate-400">
              数据完成到管理人员确认的周期统计{selectedProjectNo === 'all' ? '（基于不同研究）' : '（基于患者）'} · 完成超 {REVIEW_OVERDUE_DAYS} 天未确认视为逾期
            </span>
          </div>
          {selectedProjectNo === 'all' ? (
            <>
              <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-200">
                {['项目', '已审核记录', '待审核', '平均审核周期', '逾期未审核', '平均逾期时间', '时效评价'].map((h) => (
                  <div key={h} className="py-2.5 px-3 text-center text-xs font-medium text-slate-500">{h}</div>
                ))}
              </div>
              {reviewTimeliness.length === 0 && (
                <div className="text-center py-8 text-sm text-slate-400">所选范围暂无已发布项目</div>
              )}
              {reviewTimeliness.map((row, idx) => (
                <div
                  key={row.id}
                  className={`grid grid-cols-7 text-xs text-slate-700 items-center hover:bg-sky-50/40 transition-colors ${
                    idx !== reviewTimeliness.length - 1 ? 'border-b border-slate-100' : ''
                  }`}
                >
                  <div className="py-3 px-3 text-center">
                    <div className="font-medium text-slate-800">{row.projectNo}</div>
                    <div className="text-[10px] text-slate-400 truncate max-w-[140px] mx-auto" title={row.name}>{row.name}</div>
                  </div>
                  <div className="py-3 px-3 text-center text-teal-600 font-medium">{row.reviewedCount}</div>
                  <div className="py-3 px-3 text-center">
                    {row.pendingReview > 0 ? (
                      <span className="text-orange-500 font-medium">{row.pendingReview}</span>
                    ) : (
                      <span className="text-slate-300">0</span>
                    )}
                  </div>
                  <div className="py-3 px-3 text-center">
                    {row.avgCycle !== null ? (
                      <span className="flex items-center justify-center gap-1 text-sky-600 font-medium">
                        <Timer className="w-3.5 h-3.5" /> {row.avgCycle} 天
                      </span>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </div>
                  <div className="py-3 px-3 text-center">
                    {row.overdueCount > 0 ? (
                      <span className="text-red-600 font-medium">{row.overdueCount} 条</span>
                    ) : (
                      <span className="text-green-600">0 条</span>
                    )}
                  </div>
                  <div className="py-3 px-3 text-center">
                    {row.avgOverdue !== null ? (
                      <span className="text-red-600 font-medium">{row.avgOverdue} 天</span>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </div>
                  <div className="py-3 px-3 text-center">
                    {row.overdueCount > 0 ? (
                      <Badge variant="outline" className="bg-red-50 text-red-600 border-red-200 text-[10px]">存在逾期</Badge>
                    ) : row.avgCycle !== null && row.avgCycle <= 2 ? (
                      <Badge variant="outline" className="bg-green-50 text-green-600 border-green-200 text-[10px]">审核及时</Badge>
                    ) : row.avgCycle !== null ? (
                      <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200 text-[10px]">审核偏慢</Badge>
                    ) : (
                      <Badge variant="outline" className="bg-slate-50 text-slate-500 border-slate-200 text-[10px]">暂无数据</Badge>
                    )}
                  </div>
                </div>
              ))}
            </>
          ) : (
            <>
              <div className="grid grid-cols-8 bg-slate-50 border-b border-slate-200">
                {['患者', '当前访视', '已审核记录', '待审核', '平均审核周期', '逾期未审核', '平均逾期时间', '时效评价'].map((h) => (
                  <div key={h} className="py-2.5 px-3 text-center text-xs font-medium text-slate-500">{h}</div>
                ))}
              </div>
              {patientReviewTimeliness.length === 0 && (
                <div className="text-center py-8 text-sm text-slate-400">该研究暂无已完成数据</div>
              )}
              {pagedReviewTimeliness.map((row, idx) => (
                <div
                  key={row.id}
                  className={`grid grid-cols-8 text-xs text-slate-700 items-center hover:bg-sky-50/40 transition-colors ${
                    idx !== pagedReviewTimeliness.length - 1 ? 'border-b border-slate-100' : ''
                  }`}
                >
                  <div className="py-3 px-3 text-center">
                    <span className="font-medium text-slate-800">{row.label}</span>
                    <span className="text-slate-400 ml-1">{row.screeningId}</span>
                  </div>
                  <div className="py-3 px-3 text-center">{row.currentVisit}</div>
                  <div className="py-3 px-3 text-center text-teal-600 font-medium">{row.reviewedCount}</div>
                  <div className="py-3 px-3 text-center">
                    {row.pendingReview > 0 ? (
                      <span className="text-orange-500 font-medium">{row.pendingReview}</span>
                    ) : (
                      <span className="text-slate-300">0</span>
                    )}
                  </div>
                  <div className="py-3 px-3 text-center">
                    {row.avgCycle !== null ? (
                      <span className="flex items-center justify-center gap-1 text-sky-600 font-medium">
                        <Timer className="w-3.5 h-3.5" /> {row.avgCycle} 天
                      </span>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </div>
                  <div className="py-3 px-3 text-center">
                    {row.overdueCount > 0 ? (
                      <span className="text-red-600 font-medium">{row.overdueCount} 条</span>
                    ) : (
                      <span className="text-green-600">0 条</span>
                    )}
                  </div>
                  <div className="py-3 px-3 text-center">
                    {row.avgOverdue !== null ? (
                      <span className="text-red-600 font-medium">{row.avgOverdue} 天</span>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </div>
                  <div className="py-3 px-3 text-center">
                    {row.overdueCount > 0 ? (
                      <Badge variant="outline" className="bg-red-50 text-red-600 border-red-200 text-[10px]">存在逾期</Badge>
                    ) : row.avgCycle !== null && row.avgCycle <= 2 ? (
                      <Badge variant="outline" className="bg-green-50 text-green-600 border-green-200 text-[10px]">审核及时</Badge>
                    ) : row.avgCycle !== null ? (
                      <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200 text-[10px]">审核偏慢</Badge>
                    ) : (
                      <Badge variant="outline" className="bg-slate-50 text-slate-500 border-slate-200 text-[10px]">暂无数据</Badge>
                    )}
                  </div>
                </div>
              ))}
              {/* 分页栏 */}
              {patientReviewTimeliness.length > 0 && (
                <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-200 bg-slate-50/50">
                  <span className="text-xs text-slate-500">
                    共 {patientReviewTimeliness.length} 例 · 第 {(rtSafePage - 1) * rtPageSize + 1}-{Math.min(rtSafePage * rtPageSize, patientReviewTimeliness.length)} 例
                  </span>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-slate-400">每页</span>
                      <Select
                        value={String(rtPageSize)}
                        onValueChange={(v) => { setRtPageSize(Number(v)); setRtPage(1) }}
                      >
                        <SelectTrigger className="h-7 w-[64px] text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PAGE_SIZE_OPTIONS.map((n) => (
                            <SelectItem key={n} value={String(n)} className="text-xs">{n}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <span className="text-xs text-slate-400">行</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline" size="sm" className="h-7 w-7 p-0"
                        disabled={rtSafePage <= 1}
                        onClick={() => setRtPage(rtSafePage - 1)}
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </Button>
                      <span className="text-xs text-slate-600 min-w-[52px] text-center">
                        {rtSafePage} / {rtTotalPages}
                      </span>
                      <Button
                        variant="outline" size="sm" className="h-7 w-7 p-0"
                        disabled={rtSafePage >= rtTotalPages}
                        onClick={() => setRtPage(rtSafePage + 1)}
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
      )}

      {/* 人员工作量：录入人员 / 审核签署人员（可切换并排/整行；仅管理端可见） */}
      {isManager && (
      <>
      <div className="flex items-center justify-between px-1">
        <span className="text-sm font-medium text-slate-500">人员工作量</span>
        <div className="flex rounded-lg border border-slate-200 overflow-hidden">
          <button
            onClick={() => setWorkloadLayout('grid')}
            title="并排展示"
            className={`px-2.5 py-1 transition-colors ${
              workloadLayout === 'grid' ? 'bg-teal-600 text-white' : 'bg-white text-slate-400 hover:bg-slate-50'
            }`}
          >
            <Columns2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setWorkloadLayout('rows')}
            title="整行展示"
            className={`px-2.5 py-1 transition-colors ${
              workloadLayout === 'rows' ? 'bg-teal-600 text-white' : 'bg-white text-slate-400 hover:bg-slate-50'
            }`}
          >
            <Rows2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <div className={`grid gap-4 ${workloadLayout === 'grid' ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {/* 录入人员工作量 */}
        <Card className="bg-white overflow-hidden py-0 gap-0">
          <CardContent className="p-0">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-3">
              <Users className="w-4 h-4 text-amber-500" />
              <h3 className="text-sm font-semibold text-slate-800">录入人员工作量</h3>
              <span className="text-xs text-slate-400">按数据记录创建人统计</span>
            </div>
            <div className="grid grid-cols-5 bg-slate-50 border-b border-slate-200">
              {['姓名', '单位', '涉及患者', '完成录入', '录入中'].map((h) => (
                <div key={h} className="py-2.5 px-3 text-center text-xs font-medium text-slate-500">{h}</div>
              ))}
            </div>
            {entryWorkload.length === 0 && (
              <div className="text-center py-8 text-sm text-slate-400">所选范围暂无录入记录</div>
            )}
            {entryWorkload.map((row, idx) => (
              <div
                key={row.id}
                className={`grid grid-cols-5 text-xs text-slate-700 items-center hover:bg-sky-50/40 transition-colors ${
                  idx !== entryWorkload.length - 1 ? 'border-b border-slate-100' : ''
                }`}
              >
                <div className="py-3 px-3 text-center font-medium text-slate-800">{row.name}</div>
                <div className="py-3 px-3 text-center text-slate-500 truncate" title={row.organization}>{row.organization}</div>
                <div className="py-3 px-3 text-center">{row.patients} 例</div>
                <div className="py-3 px-3 text-center text-green-600 font-medium">{row.completed}</div>
                <div className="py-3 px-3 text-center">
                  {row.inProgress > 0 ? (
                    <span className="text-amber-500 font-medium">{row.inProgress}</span>
                  ) : (
                    <span className="text-slate-300">0</span>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* 审核 / 签署人员工作量 */}
        <Card className="bg-white overflow-hidden py-0 gap-0">
          <CardContent className="p-0">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-3">
              <UserCog className="w-4 h-4 text-teal-500" />
              <h3 className="text-sm font-semibold text-slate-800">审核 & 签署工作量</h3>
              <span className="text-xs text-slate-400">按审核人 / 签署人统计</span>
            </div>
            <div className="grid grid-cols-4 bg-slate-50 border-b border-slate-200">
              {['姓名', '审核数', '平均审核周期', '签署数'].map((h) => (
                <div key={h} className="py-2.5 px-3 text-center text-xs font-medium text-slate-500">{h}</div>
              ))}
            </div>
            {reviewerWorkload.length === 0 && (
              <div className="text-center py-8 text-sm text-slate-400">所选范围暂无审核 / 签署记录</div>
            )}
            {reviewerWorkload.map((row, idx) => (
              <div
                key={row.name}
                className={`grid grid-cols-4 text-xs text-slate-700 items-center hover:bg-sky-50/40 transition-colors ${
                  idx !== reviewerWorkload.length - 1 ? 'border-b border-slate-100' : ''
                }`}
              >
                <div className="py-3 px-3 text-center font-medium text-slate-800">{row.name}</div>
                <div className="py-3 px-3 text-center text-teal-600 font-medium">{row.reviewed}</div>
                <div className="py-3 px-3 text-center">
                  {row.avgCycle !== null ? (
                    <span className="flex items-center justify-center gap-1 text-sky-600 font-medium">
                      <Timer className="w-3.5 h-3.5" /> {row.avgCycle} 天
                    </span>
                  ) : (
                    <span className="text-slate-400">-</span>
                  )}
                </div>
                <div className="py-3 px-3 text-center text-purple-600 font-medium">{row.signed}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
      </>
      )}
    </div>
  )
}
