import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router'
import { useAppStorage } from '@/hooks/useAppStorage'
import StatCard from '@/components/StatCard'
import { usePageSize, PAGE_SIZE_OPTIONS } from '@/hooks/usePageSize'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { ClipboardCheck, ChevronLeft, ChevronRight, Users, FileCheck, BadgeCheck, Hourglass, CheckCheck, PenLine, ScanSearch, Settings2, Send, Loader2 } from 'lucide-react'
import VisitStatusMatrix from '@/components/dataMgmt/VisitStatusMatrix'
import { runDataChecks, CHECK_RULES, CATEGORY_LABELS, SEVERITY_LABELS, type CheckIssue, type CheckSeverity, type CheckCategory } from '@/lib/dataChecks'

// 卡片列宽模板（表头与卡片共用）
const GRID_COLS = 'grid-cols-[0.5fr_1fr_1fr_0.9fr_0.8fr_0.6fr_0.6fr_1.1fr_1.1fr_1.35fr]'
const HEADERS = ['筛选序号', '研究编号', '筛选编号', '姓名缩写', '当前访视', '应录入', '已完成', '审核进度', '签名进度', '操作']

// 智能核查：徽标配色
const SEV_STYLE: Record<CheckSeverity, string> = {
  high: 'bg-red-50 text-red-600 border-red-200',
  medium: 'bg-amber-50 text-amber-600 border-amber-200',
  low: 'bg-slate-50 text-slate-500 border-slate-200',
}
const CAT_STYLE: Record<CheckCategory, string> = {
  logic: 'bg-blue-50 text-blue-600 border-blue-200',
  range: 'bg-orange-50 text-orange-600 border-orange-200',
  statistical: 'bg-purple-50 text-purple-600 border-purple-200',
}

function genId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export default function ReviewList() {
  const { projects, patients, visitData, saveVisitData, currentUser, queries, saveQuery, moduleLibrary } = useAppStorage()
  const reviewerName = currentUser?.name ?? '管理人员'
  const now = () => new Date().toISOString()

  // 一键审核：将该患者全部「已完成未审核」的记录标记为已审核
  const reviewAll = (patientId: string, count: number) => {
    if (count === 0) return
    if (!window.confirm(`将该患者 ${count} 条已完成记录全部标记为「已审核」？`)) return
    visitData
      .filter((r) => r.patientId === patientId && r.status === 'completed' && !r.reviewedAt)
      .forEach((r) => saveVisitData({ ...r, reviewedAt: now(), reviewedBy: reviewerName }))
  }

  // 一键签署：将该患者全部「已审核未签署」的记录标记为已签署
  const signAll = (patientId: string, count: number) => {
    if (count === 0) return
    if (!window.confirm(`将该患者 ${count} 条已审核记录全部「签署」？`)) return
    visitData
      .filter((r) => r.patientId === patientId && r.status === 'completed' && r.reviewedAt && !r.signedAt)
      .forEach((r) => saveVisitData({ ...r, signedAt: now(), signedBy: reviewerName }))
  }
  const [searchParams] = useSearchParams()
  const location = useLocation()
  // 双端共用：/entry/review 与 /manager/review
  const base = location.pathname.startsWith('/manager') ? '/manager/review' : '/entry/review'
  const selectedProjectNo = searchParams.get('projectNo') || 'all'
  // 视图切换：审核清单（逐患者审核/签署）| 访视矩阵（患者 × 访视 录入状态一览）
  const [view, setView] = useState<'list' | 'matrix'>('list')

  // ========== 智能核查 ==========
  const [checking, setChecking] = useState(false)
  const [issues, setIssues] = useState<CheckIssue[] | null>(null)
  const [showRules, setShowRules] = useState(false)
  const [enabledRules, setEnabledRules] = useState<Set<string>>(new Set(CHECK_RULES.map((r) => r.id)))
  const [issuedIds, setIssuedIds] = useState<Set<string>>(new Set())

  const runCheck = () => {
    setChecking(true)
    setIssues(null)
    // 模拟分析过程，让「核查中」状态可感知
    setTimeout(() => {
      setIssues(runDataChecks({ projects: scopedProjects, patients, visitData, moduleLibrary, enabledRuleIds: enabledRules }))
      setChecking(false)
    }, 900)
  }

  // 发起质疑：疑点 → 正式数据疑问（待回复状态，走现有质疑流程）
  const issueToQuery = (issue: CheckIssue) => {
    const patient = patients.find((p) => p.id === issue.patientId)
    saveQuery({
      id: genId(),
      visitDataId: issue.visitDataId ?? '',
      patientId: issue.patientId,
      projectId: issue.projectId,
      visitId: issue.visitId ?? '',
      moduleId: issue.moduleId ?? '',
      fieldName: issue.fieldName,
      fieldLabel: issue.fieldLabel,
      content: `【智能核查·${issue.ruleName}】${patient ? `受试者 ${patient.nameInitials}（${patient.screeningId || patient.screeningNo}）：` : ''}${issue.description}`,
      status: 'open',
      createdBy: currentUser?.id ?? 'manager',
      createdByName: reviewerName,
      createdAt: now(),
    })
    setIssuedIds((prev) => new Set([...prev, issue.id]))
  }

  const isIssued = (issue: CheckIssue) =>
    issuedIds.has(issue.id) ||
    queries.some((q) => q.fieldName === issue.fieldName && q.patientId === issue.patientId && q.visitDataId === (issue.visitDataId ?? '') && q.content.includes(issue.description.slice(0, 20)))

  // 已发布项目的登记患者（可经顶部项目筛选）
  const scopedProjects = useMemo(
    () =>
      projects.filter(
        (p) => p.crfPublished && (selectedProjectNo === 'all' || p.projectNo === selectedProjectNo)
      ),
    [projects, selectedProjectNo]
  )
  const scopedProjectIds = useMemo(() => new Set(scopedProjects.map((p) => p.id)), [scopedProjects])

  const list = useMemo(
    () =>
      patients
        .filter((p) => scopedProjectIds.has(p.projectId))
        .map((p) => {
          const proj = projects.find((x) => x.id === p.projectId)
          // 应录入 = 全部访视配置的模块总数
          const total = (proj?.visits ?? []).reduce((s, v) => s + v.crfModuleIds.length, 0)
          const recs = visitData.filter((vd) => vd.patientId === p.id)
          const done = recs.filter((r) => r.status === 'completed').length
          const reviewed = recs.filter((r) => r.status === 'completed' && r.reviewedAt).length
          const signed = recs.filter((r) => r.status === 'completed' && r.signedAt).length
          const reviewable = recs.filter((r) => r.status === 'completed' && !r.reviewedAt).length
          const signable = recs.filter((r) => r.status === 'completed' && r.reviewedAt && !r.signedAt).length
          return {
            patient: p,
            projectNo: proj?.projectNo ?? '-',
            total,
            done,
            reviewed,
            signed,
            reviewable,
            signable,
          }
        })
        .sort((a, b) => a.projectNo.localeCompare(b.projectNo) || a.patient.screeningNo.localeCompare(b.patient.screeningNo)),
    [patients, scopedProjectIds, projects, visitData]
  )

  // 顶部统计
  const stats = useMemo(() => {
    const patientCount = list.length
    const doneAll = list.reduce((s, x) => s + x.done, 0)
    const reviewedAll = list.reduce((s, x) => s + x.reviewed, 0)
    const pending = doneAll - reviewedAll
    const signableAll = list.reduce((s, x) => s + x.signable, 0)
    return { patientCount, doneAll, reviewedAll, pending, signableAll }
  }, [list])

  const statCards = [
    { label: '患者总数', value: stats.patientCount, unit: '例', sub: '当前范围全部患者', icon: Users, gradient: 'from-blue-500 to-blue-600' },
    { label: '已完成记录', value: stats.doneAll, unit: '条', sub: '已完成录入的数据', icon: FileCheck, gradient: 'from-teal-500 to-cyan-600' },
    { label: '已审核', value: stats.reviewedAll, unit: '条', sub: `审核率 ${stats.doneAll > 0 ? Math.round((stats.reviewedAll / stats.doneAll) * 100) : 0}%`, icon: BadgeCheck, gradient: 'from-emerald-500 to-green-600' },
    { label: '待审核', value: stats.pending, unit: '条', sub: '待管理人员审核', icon: Hourglass, gradient: 'from-amber-500 to-orange-500' },
  ]

  // 全局一键审核：当前筛选范围内全部患者的待审核记录一次处理完
  const reviewAllScoped = () => {
    if (stats.pending === 0) return
    if (!window.confirm(`将当前筛选范围内全部患者的 ${stats.pending} 条待审核记录一键审核？`)) return
    visitData
      .filter((r) => scopedProjectIds.has(r.projectId) && r.status === 'completed' && !r.reviewedAt)
      .forEach((r) => saveVisitData({ ...r, reviewedAt: now(), reviewedBy: reviewerName }))
  }

  // 全局一键签署：当前筛选范围内全部患者的「已审核未签署」记录一次处理完
  const signAllScoped = () => {
    if (stats.signableAll === 0) return
    if (!window.confirm(`将当前筛选范围内全部患者的 ${stats.signableAll} 条已审核记录一键签署？`)) return
    visitData
      .filter((r) => scopedProjectIds.has(r.projectId) && r.status === 'completed' && r.reviewedAt && !r.signedAt)
      .forEach((r) => saveVisitData({ ...r, signedAt: now(), signedBy: reviewerName }))
  }

  // 分页
  const [pageSize, setPageSize] = usePageSize('crf_pagesize_review_list')
  const [page, setPage] = useState(1)
  const totalPages = Math.max(1, Math.ceil(list.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const paged = list.slice((safePage - 1) * pageSize, safePage * pageSize)
  useEffect(() => {
    setPage(1)
  }, [selectedProjectNo, pageSize])

  return (
    <div className="space-y-4">
      {/* 视图切换：审核清单 | 访视矩阵 */}
      <div className="flex items-center justify-end">
        <div className="inline-flex items-center gap-1 rounded-lg bg-slate-100 p-1">
          {(
            [
              ['list', '审核清单'],
              ['matrix', '访视矩阵'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setView(key)}
              className={`px-4 h-8 rounded-md text-sm transition-colors ${
                view === key
                  ? 'bg-white text-slate-800 font-medium shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {view === 'matrix' ? (
        <VisitStatusMatrix
          title="访视状态矩阵"
          pageSizeKey="crf_pagesize_manager_review_matrix"
          patientLink={(p) => `${base}/${p.id}`}
          cellLink={(p, v) => `${base}/${p.id}?visitId=${v.id}`}
          identityLayout="entry"
          showSearch={false}
        />
      ) : (
      <>
      {/* 统计卡（全站统一 StatCard） */}
      <div className="grid grid-cols-4 gap-4">
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

      {/* ==================== 智能核查面板 ==================== */}
      <Card className="bg-white border-slate-200 overflow-hidden">
        <CardContent className="p-0">
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-violet-50/80 via-white to-white border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-sm shadow-violet-200">
                <ScanSearch className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-800">智能核查</h3>
                <p className="text-[11px] text-slate-400">规则引擎 + 统计算法，自动识别当前范围内的数据疑点（演示版）</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm" variant="outline"
                className={`h-8 text-xs ${showRules ? 'border-violet-300 text-violet-600 bg-violet-50' : ''}`}
                onClick={() => setShowRules(!showRules)}
              >
                <Settings2 className="w-3.5 h-3.5 mr-1" /> 核查规则（{enabledRules.size}/{CHECK_RULES.length}）
              </Button>
              <Button
                size="sm"
                className="h-8 text-xs bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white shadow-sm shadow-violet-200"
                disabled={checking || enabledRules.size === 0}
                onClick={runCheck}
              >
                {checking ? <><Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> 核查中…</> : <><ScanSearch className="w-3.5 h-3.5 mr-1" /> 开始核查</>}
              </Button>
            </div>
          </div>

          {/* 规则开关 */}
          {showRules && (
            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50 grid grid-cols-2 gap-x-6 gap-y-1.5">
              {CHECK_RULES.map((r) => (
                <label key={r.id} className="flex items-start gap-2 cursor-pointer group py-0.5">
                  <input
                    type="checkbox"
                    checked={enabledRules.has(r.id)}
                    onChange={(e) => {
                      const next = new Set(enabledRules)
                      if (e.target.checked) next.add(r.id)
                      else next.delete(r.id)
                      setEnabledRules(next)
                    }}
                    className="mt-0.5 accent-violet-600"
                  />
                  <span className="text-xs text-slate-600 group-hover:text-slate-800">
                    <span className="font-medium">{r.name}</span>
                    <span className="text-slate-400 ml-1.5">{r.description}</span>
                  </span>
                </label>
              ))}
            </div>
          )}

          {/* 核查结果 */}
          {issues !== null && !checking && (
            <div className="px-4 py-3">
              {issues.length === 0 ? (
                <div className="py-8 text-center">
                  <BadgeCheck className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                  <p className="text-sm text-slate-500">未发现数据疑点，当前范围数据质量良好</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    <span className="text-xs text-slate-500">共识别 <span className="font-semibold text-slate-700">{issues.length}</span> 项疑点</span>
                    {(['logic', 'range', 'statistical'] as const).map((c) => {
                      const n = issues.filter((i) => i.category === c).length
                      if (n === 0) return null
                      return (
                        <span key={c} className={`text-[11px] px-2 py-0.5 rounded-full border ${CAT_STYLE[c]}`}>
                          {CATEGORY_LABELS[c]} {n}
                        </span>
                      )
                    })}
                    <span className="text-[11px] text-slate-300 ml-auto">AI 标记仅供参考，正式质疑需人工确认后发起</span>
                  </div>
                  <div className="border border-slate-100 rounded-lg divide-y divide-slate-50 max-h-[420px] overflow-y-auto">
                    {issues.map((issue) => {
                      const patient = patients.find((p) => p.id === issue.patientId)
                      const proj = projects.find((p) => p.id === issue.projectId)
                      const visitName = proj?.visits.find((v) => v.id === issue.visitId)?.name
                      const moduleName = proj?.crfModules.find((m) => m.id === issue.moduleId)?.name
                        ?? moduleLibrary.find((m) => m.id === issue.moduleId)?.name
                      const issued = isIssued(issue)
                      return (
                        <div key={issue.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50/60">
                          <span className={`shrink-0 text-[11px] px-1.5 py-0.5 rounded border ${SEV_STYLE[issue.severity]}`}>
                            {SEVERITY_LABELS[issue.severity]}
                          </span>
                          <span className={`shrink-0 text-[11px] px-1.5 py-0.5 rounded border ${CAT_STYLE[issue.category]}`}>
                            {CATEGORY_LABELS[issue.category]}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs text-slate-700 leading-relaxed">{issue.description}</div>
                            <div className="text-[11px] text-slate-400 mt-0.5 truncate">
                              {issue.ruleName}
                              {patient && ` · ${patient.nameInitials}（${patient.screeningId || patient.screeningNo}）`}
                              {visitName && ` · ${visitName}`}
                              {moduleName && ` · ${moduleName}`}
                              {issue.valueText && <span className="text-slate-500"> · 当前值：{issue.valueText}</span>}
                            </div>
                          </div>
                          {issue.patientId ? (
                            <Button
                              size="sm" variant="outline"
                              className={`h-7 text-xs shrink-0 ${issued ? 'border-slate-200 text-slate-300 cursor-default' : 'border-violet-200 text-violet-600 hover:bg-violet-50'}`}
                              disabled={issued}
                              onClick={() => issueToQuery(issue)}
                            >
                              <Send className="w-3 h-3 mr-1" /> {issued ? '已发起质疑' : '发起质疑'}
                            </Button>
                          ) : (
                            <span className="shrink-0 text-[11px] text-slate-300 px-2">跨患者预警</span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 表头 + 全局一键审核 */}
      <div className="flex items-center gap-3 px-1">
        <div className={`grid ${GRID_COLS} flex-1 px-3`}>
          {HEADERS.map((h) => (
            <div key={h} className="py-2 text-center text-xs font-medium text-slate-400 whitespace-nowrap">{h}</div>
          ))}
        </div>
        <Button
          size="sm" variant="outline"
          className="h-7 text-xs border-green-200 text-green-600 hover:bg-green-50 shrink-0"
          disabled={stats.pending === 0}
          title={stats.pending > 0 ? `一键审核当前范围内全部 ${stats.pending} 条待审核记录` : '当前范围暂无待审核记录'}
          onClick={reviewAllScoped}
        >
          <CheckCheck className="w-3.5 h-3.5 mr-1" /> 全部一键审核{stats.pending > 0 ? `（${stats.pending}）` : ''}
        </Button>
        <Button
          size="sm" variant="outline"
          className="h-7 text-xs border-purple-200 text-purple-600 hover:bg-purple-50 shrink-0"
          disabled={stats.signableAll === 0}
          title={stats.signableAll > 0 ? `一键签署当前范围内全部 ${stats.signableAll} 条已审核记录` : '当前范围暂无可签署记录（需先审核）'}
          onClick={signAllScoped}
        >
          <PenLine className="w-3.5 h-3.5 mr-1" /> 全部一键签署{stats.signableAll > 0 ? `（${stats.signableAll}）` : ''}
        </Button>
      </div>

      {/* 患者卡片清单 */}
      {paged.length === 0 && (
        <Card className="bg-white">
          <CardContent className="py-16 text-center text-sm text-slate-400">
            所选范围暂无登记患者
          </CardContent>
        </Card>
      )}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm divide-y divide-slate-100 overflow-hidden">
        {paged.map(({ patient: p, projectNo, total, done, reviewed, signed, reviewable, signable }) => {
          const reviewPct = done > 0 ? Math.round((reviewed / done) * 100) : 0
          const signPct = done > 0 ? Math.round((signed / done) * 100) : 0
          return (
            <div key={p.id} className={`grid ${GRID_COLS} items-center px-4 py-2.5 hover:bg-slate-50 transition-colors`}>
                <div className="text-center text-sm text-slate-500">{p.screeningNo}</div>
                <div className="text-center text-sm text-slate-700">{projectNo}</div>
                <div className="text-center">
                  <Link
                    to={`${base}/${p.id}${selectedProjectNo !== 'all' ? `?projectNo=${selectedProjectNo}` : ''}`}
                    className="text-sm font-medium text-teal-600 underline underline-offset-2 hover:text-teal-700"
                  >
                    {p.screeningId || '—'}
                  </Link>
                </div>
                <div className="text-center text-sm font-medium text-slate-800">{p.nameInitials}</div>
                <div className="text-center text-sm text-slate-700">{p.currentVisit || '—'}</div>
                <div className="text-center text-sm text-slate-700">{total}</div>
                <div className="text-center text-sm text-slate-700">{done}</div>
                {/* 审核进度 */}
                <div className="px-2">
                  <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                    <span>{reviewed}/{done}</span>
                    <span className={reviewPct === 100 ? 'text-green-600 font-medium' : ''}>{reviewPct}%</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${reviewPct === 100 ? 'bg-green-500' : 'bg-sky-400'}`}
                      style={{ width: `${reviewPct}%` }}
                    />
                  </div>
                </div>
                {/* 签名进度 */}
                <div className="px-2">
                  <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                    <span>{signed}/{done}</span>
                    <span className={signPct === 100 ? 'text-purple-600 font-medium' : ''}>{signPct}%</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${signPct === 100 ? 'bg-purple-500' : 'bg-purple-300'}`}
                      style={{ width: `${signPct}%` }}
                    />
                  </div>
                </div>
                <div className="flex items-center justify-center gap-1.5">
                  <Button
                    size="sm" variant="outline"
                    className="h-7 px-2 text-xs border-sky-200 text-sky-600 hover:bg-sky-50"
                    asChild
                  >
                    <Link to={`${base}/${p.id}${selectedProjectNo !== 'all' ? `?projectNo=${selectedProjectNo}` : ''}`}>
                      <ClipboardCheck className="w-3.5 h-3.5 mr-1" /> 审核数据
                    </Link>
                  </Button>
                  <Button
                    size="sm" variant="outline"
                    className="h-7 w-7 p-0 border-green-200 text-green-600 hover:bg-green-50"
                    disabled={reviewable === 0}
                    title={reviewable > 0 ? `一键审核 ${reviewable} 条已完成记录` : '暂无待审核记录'}
                    onClick={() => reviewAll(p.id, reviewable)}
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    size="sm" variant="outline"
                    className="h-7 w-7 p-0 border-purple-200 text-purple-600 hover:bg-purple-50"
                    disabled={signable === 0}
                    title={signable > 0 ? `一键签署 ${signable} 条已审核记录` : '暂无可签署记录（需先审核）'}
                    onClick={() => signAll(p.id, signable)}
                  >
                    <PenLine className="w-3.5 h-3.5" />
                  </Button>
                </div>
            </div>
          )
        })}
      </div>

      {/* 分页栏 */}
      {list.length > 0 && (
        <div className="flex items-center justify-between px-2 py-1">
          <span className="text-xs text-slate-500">
            共 {list.length} 例 · 第 {(safePage - 1) * pageSize + 1}-{Math.min(safePage * pageSize, list.length)} 例
          </span>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-400">每页</span>
              <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
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
              <span className="text-xs text-slate-600 min-w-[52px] text-center">{safePage} / {totalPages}</span>
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
    </div>
  )
}
