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
import { ClipboardCheck, ChevronLeft, ChevronRight, Users, FileCheck, BadgeCheck, Hourglass, CheckCheck, PenLine } from 'lucide-react'
import VisitStatusMatrix from '@/components/dataMgmt/VisitStatusMatrix'

// 卡片列宽模板（表头与卡片共用）
const GRID_COLS = 'grid-cols-[0.5fr_1fr_1fr_0.9fr_0.8fr_0.6fr_0.6fr_1.1fr_1.1fr_1.35fr]'
const HEADERS = ['筛选序号', '研究编号', '筛选编号', '姓名缩写', '当前访视', '应录入', '已完成', '审核进度', '签名进度', '操作']

export default function ReviewList() {
  const { projects, patients, visitData, saveVisitData, currentUser } = useAppStorage()
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
