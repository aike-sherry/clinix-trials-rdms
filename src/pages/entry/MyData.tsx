import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useAppStorage } from '@/hooks/useAppStorage'
import StatCard from '@/components/StatCard'
import { Card, CardContent } from '@/components/ui/card'
import type { Patient, Project, Visit } from '@/types'
import {
  MessageCircleQuestion, AlarmClock, Save, ChevronRight,
  ClipboardList, CheckCircle2, ShieldQuestion, History, Database,
} from 'lucide-react'

const VISIT_INTERVAL_DAYS = 7
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)

const ACTION_LABELS: Record<string, string> = { create: '新增', update: '修改', delete: '删除' }
const ACTION_COLORS: Record<string, string> = {
  create: 'bg-teal-50 text-teal-600',
  update: 'bg-amber-50 text-amber-600',
  delete: 'bg-red-50 text-red-500',
}

interface OverdueVisit {
  patient: Patient
  project: Project
  visit: Visit
  plannedDate: string
  overdueDays: number
}

export default function EntryMyData() {
  const { projects, patients, visitData, queries, auditLogs, currentUser } = useAppStorage()
  const [searchParams] = useSearchParams()
  const selectedProjectNo = searchParams.get('projectNo') || 'all'

  const myProjects = useMemo(
    () => projects.filter(
      (p) => p.crfPublished && (selectedProjectNo === 'all' || p.projectNo === selectedProjectNo),
    ),
    [projects, selectedProjectNo],
  )
  const myPatients = useMemo(
    () => patients.filter((p) => myProjects.some((proj) => proj.id === p.projectId)),
    [patients, myProjects],
  )
  const myPatientIds = useMemo(() => new Set(myPatients.map((p) => p.id)), [myPatients])

  const today = new Date()
  const today0 = new Date(today.getFullYear(), today.getMonth(), today.getDate())

  // ---------- 待办 1：待回复疑问 ----------
  const openQueries = useMemo(() => {
    return (queries ?? [])
      .filter((q) => q.status === 'open' && myPatientIds.has(q.patientId))
      .map((q) => {
        const project = projects.find((p) => p.id === q.projectId)
        const patient = patients.find((p) => p.id === q.patientId)
        const visit = project?.visits.find((v) => v.id === q.visitId)
        const module = project?.crfModules.find((m) => m.id === q.moduleId)
        return {
          ...q,
          patientLabel: patient ? `${patient.nameInitials} ${patient.screeningId || ''}`.trim() : '-',
          visitModule: `${visit?.name ?? '-'} · ${module?.name ?? '-'}`,
        }
      })
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  }, [queries, myPatientIds, projects, patients])

  // ---------- 待办 2：逾期访视（与首页访视提醒同口径） ----------
  const overdueVisits = useMemo(() => {
    const out: OverdueVisit[] = []
    for (const patient of myPatients) {
      if (patient.status === 'withdrawn' || patient.status === 'lost') continue
      const project = myProjects.find((p) => p.id === patient.projectId)
      if (!project) continue
      const baseStr = patient.enrollmentDate || patient.consentDate
      if (!baseStr) continue
      const base = new Date(baseStr)
      const visits = [...project.visits].sort((a, b) => a.order - b.order)
      for (const visit of visits) {
        const mods = project.crfModules.filter((m) => visit.crfModuleIds.includes(m.id))
        const done = mods.length > 0 && mods.every((m) =>
          visitData.some(
            (vd) => vd.patientId === patient.id && vd.visitId === visit.id && vd.moduleId === m.id &&
              (vd.status === 'completed' || vd.status === 'locked'),
          ),
        )
        if (done) continue
        const planned = addDays(base, visit.plannedDay ?? visit.order * VISIT_INTERVAL_DAYS)
        const windowDays = visit.windowDays ?? 3
        const daysUntil = Math.round((planned.getTime() - today0.getTime()) / 86400000)
        const overdueDays = daysUntil < -windowDays ? -daysUntil - windowDays : 0
        if (overdueDays > 0) {
          out.push({ patient, project, visit, plannedDate: planned.toISOString().slice(0, 10), overdueDays })
        }
        break // 只聚焦下一次待办访视
      }
    }
    return out.sort((a, b) => b.overdueDays - a.overdueDays)
  }, [myPatients, myProjects, visitData, today0])

  // ---------- 待办 3：暂存未完成的模块 ----------
  const drafts = useMemo(() => {
    return visitData
      .filter((v) => v.status === 'in_progress' && myPatientIds.has(v.patientId))
      .map((v) => {
        const project = projects.find((p) => p.id === v.projectId)
        const patient = patients.find((p) => p.id === v.patientId)
        const visit = project?.visits.find((x) => x.id === v.visitId)
        const module = project?.crfModules.find((m) => m.id === v.moduleId)
        return {
          ...v,
          patientLabel: patient ? `${patient.nameInitials} ${patient.screeningId || ''}`.trim() : '-',
          visitModule: `${visit?.name ?? '-'} · ${module?.name ?? '-'}`,
        }
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }, [visitData, myPatientIds, projects, patients])

  // ---------- 我的录入质量 ----------
  const quality = useMemo(() => {
    const myRecords = visitData.filter((v) => myPatientIds.has(v.patientId))
    const completed = myRecords.filter((v) => v.status === 'completed' || v.status === 'locked')
    const myQueries = (queries ?? []).filter((q) => myPatientIds.has(q.patientId))
    const closed = myQueries.filter((q) => q.status === 'closed')
    const closeRate = myQueries.length === 0 ? null : Math.round((closed.length / myQueries.length) * 100)
    return {
      records: myRecords.length,
      completed: completed.length,
      queriesTotal: myQueries.length,
      queriesClosed: closed.length,
      closeRate,
    }
  }, [visitData, queries, myPatientIds])

  // ---------- 我的操作留痕（近 30 天，本人操作） ----------
  const AUDIT_PREVIEW = 8
  const [showAllAudit, setShowAllAudit] = useState(false)
  const myAuditLogs = useMemo(() => {
    const cutoff = new Date(today0.getTime() - 30 * 86400000).toISOString()
    return (auditLogs ?? [])
      .filter((l) => l.userId === currentUser?.id && l.timestamp >= cutoff)
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
  }, [auditLogs, currentUser, today0])
  const visibleLogs = showAllAudit ? myAuditLogs : myAuditLogs.slice(0, AUDIT_PREVIEW)

  return (
    <div className="space-y-4">
      {/* ================= 今日待办 ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 待回复疑问 */}
        <Card className="overflow-hidden py-0 gap-0">
          <CardContent className="p-0">
            <div className="px-4 py-3 border-b border-slate-100 bg-orange-50/50 flex items-center gap-2">
              <MessageCircleQuestion className="w-4 h-4 text-orange-500" />
              <h3 className="text-sm font-semibold text-slate-800">待回复疑问</h3>
              <span className="text-xs text-orange-600 font-medium">{openQueries.length} 条</span>
              {openQueries.length > 0 && (
                <Link to="/entry/queries" className="ml-auto text-xs text-orange-500 hover:text-orange-700 flex items-center">
                  全部 <ChevronRight className="w-3 h-3" />
                </Link>
              )}
            </div>
            <div className="min-h-[148px]">
              {openQueries.length === 0 ? (
                <p className="text-xs text-slate-300 text-center py-14">✓ 暂无待回复疑问</p>
              ) : (
                openQueries.slice(0, 4).map((q) => (
                  <Link
                    key={q.id}
                    to="/entry/queries"
                    className="flex items-center gap-2 px-4 py-2.5 text-xs hover:bg-orange-50/40 border-b border-slate-50 last:border-0"
                  >
                    <span className="font-medium text-slate-700 shrink-0">{q.patientLabel}</span>
                    <span className="text-slate-400 shrink-0 hidden xl:inline">{q.visitModule}</span>
                    <span className="flex-1 min-w-0 truncate text-slate-500" title={q.content}>{q.content}</span>
                  </Link>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* 逾期访视 */}
        <Card className="overflow-hidden py-0 gap-0">
          <CardContent className="p-0">
            <div className="px-4 py-3 border-b border-slate-100 bg-red-50/50 flex items-center gap-2">
              <AlarmClock className="w-4 h-4 text-red-500" />
              <h3 className="text-sm font-semibold text-slate-800">逾期访视</h3>
              <span className="text-xs text-red-600 font-medium">{overdueVisits.length} 例</span>
              {overdueVisits.length > 0 && (
                <Link to="/entry/visits" className="ml-auto text-xs text-red-500 hover:text-red-700 flex items-center">
                  全部 <ChevronRight className="w-3 h-3" />
                </Link>
              )}
            </div>
            <div className="min-h-[148px]">
              {overdueVisits.length === 0 ? (
                <p className="text-xs text-slate-300 text-center py-14">✓ 暂无逾期访视</p>
              ) : (
                overdueVisits.slice(0, 4).map((r) => (
                  <Link
                    key={`${r.patient.id}-${r.visit.id}`}
                    to={`/entry/patients/${r.patient.id}`}
                    className="flex items-center gap-2 px-4 py-2.5 text-xs hover:bg-red-50/40 border-b border-slate-50 last:border-0"
                  >
                    <span className="font-mono font-medium text-slate-700 shrink-0">{r.patient.screeningId}</span>
                    <span className="flex-1 min-w-0 truncate text-slate-500">{r.visit.name}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-50 text-red-500 font-medium shrink-0">
                      逾期 {r.overdueDays} 天
                    </span>
                  </Link>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* 暂存未完成 */}
        <Card className="overflow-hidden py-0 gap-0">
          <CardContent className="p-0">
            <div className="px-4 py-3 border-b border-slate-100 bg-blue-50/50 flex items-center gap-2">
              <Save className="w-4 h-4 text-blue-500" />
              <h3 className="text-sm font-semibold text-slate-800">暂存未完成</h3>
              <span className="text-xs text-blue-600 font-medium">{drafts.length} 项</span>
              {drafts.length > 0 && (
                <Link to="/entry/data-entry" className="ml-auto text-xs text-blue-500 hover:text-blue-700 flex items-center">
                  去录入 <ChevronRight className="w-3 h-3" />
                </Link>
              )}
            </div>
            <div className="min-h-[148px]">
              {drafts.length === 0 ? (
                <p className="text-xs text-slate-300 text-center py-14">✓ 暂无暂存数据</p>
              ) : (
                drafts.slice(0, 4).map((d) => (
                  <Link
                    key={d.id}
                    to={`/entry/patients/${d.patientId}`}
                    className="flex items-center gap-2 px-4 py-2.5 text-xs hover:bg-blue-50/40 border-b border-slate-50 last:border-0"
                  >
                    <span className="font-medium text-slate-700 shrink-0">{d.patientLabel}</span>
                    <span className="flex-1 min-w-0 truncate text-slate-500">{d.visitModule}</span>
                    <span className="text-slate-300 shrink-0">{d.updatedAt.slice(5, 10)}</span>
                  </Link>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ================= 我的录入质量（全站统一 StatCard） ================= */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: '录入记录', value: quality.records, unit: '条', sub: '我录入的全部数据', icon: Database, gradient: 'from-sky-500 to-blue-600' },
          { label: '已完成记录', value: quality.completed, unit: '条', sub: `完成率 ${quality.records > 0 ? Math.round((quality.completed / quality.records) * 100) : 0}%`, icon: CheckCircle2, gradient: 'from-teal-500 to-emerald-600' },
          { label: '被发起疑问', value: quality.queriesTotal, unit: '条', sub: '管理人员对我的质疑', icon: ShieldQuestion, gradient: 'from-orange-500 to-amber-600' },
          { label: '疑问已关闭', value: quality.queriesClosed, unit: '条', sub: `关闭率 ${quality.closeRate ?? 0}%`, icon: ClipboardList, gradient: 'from-slate-400 to-slate-500' },
        ].map((s) => (
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

      {quality.closeRate !== null && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-slate-700">疑问关闭率</p>
              <p className="text-sm font-bold text-teal-600">{quality.closeRate}%</p>
            </div>
            <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-teal-500 transition-all"
                style={{ width: `${quality.closeRate}%` }}
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1.5">
              已关闭 {quality.queriesClosed} / 被发起 {quality.queriesTotal} 条；及时回复并配合管理人员关闭疑问，有助于提升数据质量
            </p>
          </CardContent>
        </Card>
      )}

      {/* ================= 我的操作留痕 ================= */}
      <Card className="overflow-hidden py-0 gap-0">
        <CardContent className="p-0">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100">
            <span className="w-6 h-6 rounded-md bg-slate-100 flex items-center justify-center shrink-0">
              <History className="w-3.5 h-3.5 text-slate-500" />
            </span>
            <h3 className="text-sm font-semibold text-slate-800">我的操作留痕</h3>
            <span className="text-xs text-slate-400">近 30 天 · 共 {myAuditLogs.length} 条</span>
            {myAuditLogs.length > AUDIT_PREVIEW && (
              <button
                className="ml-auto text-xs text-sky-500 hover:text-sky-700"
                onClick={() => setShowAllAudit(!showAllAudit)}
              >
                {showAllAudit ? '收起' : `展开全部 ${myAuditLogs.length} 条`}
              </button>
            )}
          </div>
          {visibleLogs.length === 0 ? (
            <p className="text-xs text-slate-300 text-center py-12">近 30 天暂无操作记录</p>
          ) : (
            <div className="divide-y divide-slate-50">
              {visibleLogs.map((l) => (
                <div key={l.id} className="flex items-center gap-3 px-4 py-2.5 text-xs hover:bg-slate-50/60">
                  <span className="text-slate-400 shrink-0 w-32">
                    {l.timestamp.slice(0, 16).replace('T', ' ')}
                  </span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] shrink-0 ${ACTION_COLORS[l.action] ?? 'bg-slate-100 text-slate-500'}`}>
                    {ACTION_LABELS[l.action] ?? l.action}
                  </span>
                  <span className="font-medium text-slate-700 shrink-0 max-w-[220px] truncate" title={l.entityLabel}>
                    {l.entityLabel}
                  </span>
                  <span className="flex-1 min-w-0 truncate text-slate-500" title={l.summary}>{l.summary}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
