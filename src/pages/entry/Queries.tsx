import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  MessageCircleQuestion, Clock, CheckCircle2, Archive,
  ChevronLeft, ChevronRight, ClipboardList,
} from 'lucide-react'
import { useAppStorage } from '@/hooks/useAppStorage'
import StatCard from '@/components/StatCard'
import { usePageSize, PAGE_SIZE_OPTIONS } from '@/hooks/usePageSize'
import type { DataQuery } from '@/types'

const QUERY_STATUS: Record<DataQuery['status'], { label: string; color: string }> = {
  open: { label: '待回复', color: 'bg-orange-50 text-orange-600 border-orange-200' },
  answered: { label: '已回复待关闭', color: 'bg-blue-50 text-blue-600 border-blue-200' },
  closed: { label: '已关闭', color: 'bg-slate-100 text-slate-500 border-slate-200' },
}

type StatusFilter = 'all' | DataQuery['status']

/** 富化后的疑问（附带患者/项目/访视/模块名称） */
type EnrichedQuery = DataQuery & {
  patientLabel: string
  projectNo: string
  visitName: string
  moduleName: string
}

export default function EntryQueries() {
  const { projects, patients, queries, saveQuery, currentUser } = useAppStorage()
  const entryName = currentUser?.name ?? '录入人员'
  const [searchParams] = useSearchParams()
  const projectNoParam = searchParams.get('projectNo') || 'all'

  const [status, setStatus] = useState<StatusFilter>('all')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = usePageSize('crf_pagesize_entry_queries')

  // 回复弹窗
  const [replyTarget, setReplyTarget] = useState<EnrichedQuery | null>(null)
  const [replyText, setReplyText] = useState('')

  // ---------- 疑问富化（患者 / 项目 / 访视 / 模块名称） ----------
  const enriched = useMemo(() => {
    return (queries ?? [])
      .filter((q) => {
        if (projectNoParam === 'all') return true
        const proj = projects.find((p) => p.id === q.projectId)
        return proj?.projectNo === projectNoParam
      })
      .map((q) => {
        const pt = patients.find((p) => p.id === q.patientId)
        const proj = projects.find((p) => p.id === q.projectId)
        const visitName = proj?.visits.find((v) => v.id === q.visitId)?.name ?? q.visitId
        const moduleName =
          proj?.crfModules.find((m) => m.id === q.moduleId)?.name ?? q.moduleId
        return {
          ...q,
          patientLabel: pt ? `${pt.nameInitials} ${pt.screeningId || pt.screeningNo || ''}`.trim() : q.patientId,
          projectNo: proj?.projectNo ?? '',
          visitName,
          moduleName,
        }
      })
      .sort((a, b) => {
        // 待回复最优先（按等待时间升序），其余按发起时间倒序
        const rank = (s: DataQuery['status']) => (s === 'open' ? 0 : s === 'answered' ? 1 : 2)
        if (rank(a.status) !== rank(b.status)) return rank(a.status) - rank(b.status)
        return a.status === 'open'
          ? a.createdAt.localeCompare(b.createdAt)
          : b.createdAt.localeCompare(a.createdAt)
      })
  }, [queries, projects, patients, projectNoParam])

  const stats = useMemo(
    () => ({
      total: enriched.length,
      open: enriched.filter((q) => q.status === 'open').length,
      answered: enriched.filter((q) => q.status === 'answered').length,
      closed: enriched.filter((q) => q.status === 'closed').length,
    }),
    [enriched],
  )

  const filtered = useMemo(
    () => (status === 'all' ? enriched : enriched.filter((q) => q.status === status)),
    [enriched, status],
  )

  useEffect(() => {
    setPage(1)
  }, [status, projectNoParam])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize)

  const openReply = (q: EnrichedQuery) => {
    setReplyTarget(q)
    setReplyText(q.answer ?? '')
  }

  const submitReply = () => {
    if (!replyTarget || !replyText.trim()) return
    saveQuery({
      ...replyTarget,
      status: 'answered',
      answer: replyText.trim(),
      answeredBy: entryName,
      answeredAt: new Date().toISOString(),
    })
    setReplyTarget(null)
    setReplyText('')
  }

  const statCards = [
    { label: '全部疑问', value: stats.total, unit: '条', sub: '管理人员发起的质疑', icon: MessageCircleQuestion, gradient: 'from-sky-500 to-blue-600' },
    { label: '待回复', value: stats.open, unit: '条', sub: '需尽快核对回复', icon: Clock, gradient: 'from-orange-500 to-amber-600' },
    { label: '已回复待关闭', value: stats.answered, unit: '条', sub: '待管理人员确认', icon: CheckCircle2, gradient: 'from-blue-500 to-indigo-600' },
    { label: '已关闭', value: stats.closed, unit: '条', sub: `关闭率 ${stats.total > 0 ? Math.round((stats.closed / stats.total) * 100) : 0}%`, icon: Archive, gradient: 'from-slate-400 to-slate-500' },
  ]

  const statusTabs: { key: StatusFilter; label: string; count: number }[] = [
    { key: 'all', label: '全部', count: stats.total },
    { key: 'open', label: '待回复', count: stats.open },
    { key: 'answered', label: '已回复', count: stats.answered },
    { key: 'closed', label: '已关闭', count: stats.closed },
  ]

  return (
    <div className="space-y-4">
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

      {/* 待回复提醒 */}
      {stats.open > 0 && (
        <div className="rounded-lg border border-orange-200 bg-orange-50/60 px-4 py-3 flex items-center gap-2">
          <Clock className="w-4 h-4 text-orange-500 shrink-0" />
          <p className="text-sm text-orange-700">
            有 <span className="font-semibold">{stats.open}</span> 条疑问等待您核对并回复，请及时处理。
          </p>
          <button
            type="button"
            className="text-sm text-orange-600 underline underline-offset-2 hover:text-orange-800"
            onClick={() => setStatus('open')}
          >
            立即回复
          </button>
        </div>
      )}

      {/* 状态筛选 */}
      <div className="flex items-center gap-2">
        {statusTabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setStatus(t.key)}
            className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
              status === t.key
                ? 'bg-orange-500 text-white border-orange-500'
                : 'bg-white text-slate-600 border-slate-200 hover:border-orange-300'
            }`}
          >
            {t.label}（{t.count}）
          </button>
        ))}
      </div>

      {/* 疑问列表 */}
      <Card>
        <CardContent className="p-0">
          {paged.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-16">暂无符合条件的疑问</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {paged.map((q) => (
                <div key={q.id} className="px-5 py-3.5 hover:bg-slate-50/60">
                  <div className="flex items-start gap-3">
                    <MessageCircleQuestion className="w-4 h-4 text-orange-400 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      {/* 第一行：定位信息 + 状态 */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-slate-800">{q.patientLabel}</span>
                        <span className="text-xs text-slate-400">{q.projectNo}</span>
                        <span className="text-xs text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                          {q.visitName} · {q.moduleName}
                        </span>
                        <span className={`ml-auto text-[11px] px-2 py-0.5 rounded-full border shrink-0 ${QUERY_STATUS[q.status].color}`}>
                          {QUERY_STATUS[q.status].label}
                        </span>
                      </div>
                      {/* 第二行：疑问内容 */}
                      <p className="text-sm text-slate-700 mt-1.5">
                        {q.fieldLabel && <span className="text-orange-500 mr-1">[{q.fieldLabel}]</span>}
                        {q.content}
                      </p>
                      {/* 回复 */}
                      {q.answer && (
                        <div className="text-sm text-slate-600 mt-1.5 pl-3 border-l-2 border-blue-200">
                          我的回复：{q.answer}
                          <span className="text-xs text-slate-400 ml-2">
                            {q.answeredAt?.slice(0, 10)}
                          </span>
                        </div>
                      )}
                      {/* 第三行：元信息 + 操作 */}
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-xs text-slate-400">
                          {q.createdByName} 发起于 {q.createdAt.slice(0, 10)}
                        </span>
                        <div className="ml-auto flex items-center gap-2">
                          <Link
                            to={`/entry/patients/${q.patientId}?visitId=${q.visitId}&moduleId=${q.moduleId}`}
                            title="跳到该患者对应访视 · 模块的录入页"
                            className="text-xs text-sky-500 hover:text-sky-700 flex items-center gap-0.5"
                          >
                            <ClipboardList className="w-3 h-3" />
                            去患者页核对
                          </Link>
                          {q.status !== 'closed' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs border-orange-200 text-orange-600 hover:bg-orange-50"
                              onClick={() => openReply(q)}
                            >
                              {q.status === 'answered' ? '修改回复' : '回复'}
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 分页 */}
          {filtered.length > 0 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100">
              <p className="text-xs text-slate-400">
                共 {filtered.length} 条 · 第 {(safePage - 1) * pageSize + 1}-
                {Math.min(safePage * pageSize, filtered.length)} 条
              </p>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">每页</span>
                <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(1) }}>
                  <SelectTrigger className="w-16 h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAGE_SIZE_OPTIONS.map((n) => (
                      <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-xs text-slate-400">条</span>
                <Button
                  variant="outline" size="icon" className="h-7 w-7"
                  disabled={safePage <= 1}
                  onClick={() => setPage(safePage - 1)}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-xs text-slate-500">{safePage} / {totalPages}</span>
                <Button
                  variant="outline" size="icon" className="h-7 w-7"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage(safePage + 1)}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 回复弹窗 */}
      <Dialog open={!!replyTarget} onOpenChange={(open) => { if (!open) setReplyTarget(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>回复数据疑问</DialogTitle>
          </DialogHeader>
          {replyTarget && (
            <div className="space-y-4 py-2">
              <div className="text-xs text-slate-500 bg-slate-50 rounded-md px-3 py-2 space-y-1">
                <p>{replyTarget.patientLabel} · {replyTarget.visitName} · {replyTarget.moduleName}</p>
                <p className="text-orange-600">
                  {replyTarget.fieldLabel && <span className="mr-1">[{replyTarget.fieldLabel}]</span>}
                  {replyTarget.content}
                </p>
              </div>
              <div>
                <Label className="text-sm">回复内容 <span className="text-red-500">*</span></Label>
                <Input
                  placeholder="请说明核对结果或修正情况"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                />
              </div>
              <p className="text-[11px] text-slate-400">
                提交后状态变为「已回复待关闭」，由管理人员核对确认后关闭。
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReplyTarget(null)}>取消</Button>
            <Button
              className="bg-orange-500 hover:bg-orange-600 text-white"
              disabled={!replyText.trim()}
              onClick={submitReply}
            >
              提交回复
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
