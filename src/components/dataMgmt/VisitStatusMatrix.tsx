import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { ClipboardEdit, ChevronLeft, ChevronRight, Search, Users, Crosshair, X } from 'lucide-react'
import { useAppStorage } from '@/hooks/useAppStorage'
import { usePageSize, PAGE_SIZE_OPTIONS } from '@/hooks/usePageSize'
import type { Patient, Project, Visit, VisitData } from '@/types'

type CellStatus = 'completed' | 'in_progress' | 'not_started'

/** 单个 患者 × 访视 格子的录入状态 */
interface VisitCell {
  status: CellStatus
  done: number   // 已完成模块数
  total: number  // 该访视应录入模块数
}

function cellOf(patient: Patient, visit: Visit, visitData: VisitData[]): VisitCell {
  const total = visit.crfModuleIds.length
  const records = visitData.filter((v) => v.patientId === patient.id && v.visitId === visit.id)
  const done = records.filter((r) => r.status === 'completed').length
  const status: CellStatus =
    total > 0 && done >= total ? 'completed' : records.length > 0 ? 'in_progress' : 'not_started'
  return { status, done, total }
}

function CellBadge({ cell }: { cell: VisitCell }) {
  if (cell.status === 'completed') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-teal-50 text-teal-600 text-[11px] font-medium">
        <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />
        已完成
      </span>
    )
  }
  if (cell.status === 'in_progress') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-600 text-[11px] font-medium">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
        进行中 {cell.done}/{cell.total}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-50 text-slate-400 text-[11px]">
      <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
      未开始
    </span>
  )
}

/**
 * 患者 × 访视 录入状态矩阵（录入端 & 管理端共用）。
 * 点击访视格子 → cellLink（直达该患者对应访视）；点击患者编号 → patientLink。
 * 顶部项目筛选框通过 URL 参数驱动（全部研究时回落到第一个已发布 CRF 的项目）。
 */
export default function VisitStatusMatrix({
  title,
  pageSizeKey,
  patientLink,
  cellLink,
  identityLayout = 'default',
  showSearch = true,
}: {
  title: string
  pageSizeKey: string
  patientLink: (p: Patient) => string
  cellLink: (p: Patient, v: Visit) => string
  /** entry=录入端身份列（筛选编号/入组编号/研究编号/研究中心）；default=患者编号/项目编号/研究中心 */
  identityLayout?: 'default' | 'entry'
  /** 是否显示右上角快速搜索框（管理端数据审核页关闭） */
  showSearch?: boolean
}) {
  const { projects, patients, visitData } = useAppStorage()
  const [searchParams, setSearchParams] = useSearchParams()

  const projectNoParam = searchParams.get('projectNo') || ''
  // 定位参数：从首页待录入提醒等入口跳入时，自动翻页 + 滚动 + 高亮目标格子
  const locatePatientId = searchParams.get('patientId') || ''
  const locateVisitId = searchParams.get('visitId') || ''
  const [highlight, setHighlight] = useState<string | null>(null)
  const project: Project | undefined =
    projects.find((p) => p.projectNo === projectNoParam)
    ?? projects.find((p) => p.crfPublished && p.visits.length > 0)
    ?? projects[0]

  const sortedVisits = useMemo(
    () => (project ? [...project.visits].sort((a, b) => a.order - b.order) : []),
    [project],
  )

  const list = useMemo(
    () =>
      project
        ? patients
            .filter((p) => p.projectId === project.id)
            .sort((a, b) => a.screeningNo.localeCompare(b.screeningNo, 'zh', { numeric: true }))
        : [],
    [project, patients],
  )

  // 右上角快速搜索：筛选编号 / 随机编号 / 姓名缩写
  const [kw, setKw] = useState('')
  const filtered = useMemo(() => {
    const k = kw.trim().toLowerCase()
    if (!k) return list
    return list.filter((p) =>
      [p.screeningId, p.randomizationId, p.nameInitials, p.screeningNo].some((v) =>
        (v || '').toLowerCase().includes(k),
      ),
    )
  }, [list, kw])

  // 分页
  const [pageSize, setPageSize] = usePageSize(pageSizeKey)
  const [page, setPage] = useState(1)
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize)
  useEffect(() => {
    setPage(1)
  }, [project?.id, pageSize, kw])

  // 定位：翻到目标患者所在页并高亮目标格子（4.5 秒后自动消褪）
  useEffect(() => {
    if (!locatePatientId) return
    const idx = filtered.findIndex((p) => p.id === locatePatientId)
    if (idx < 0) return
    setPage(Math.floor(idx / pageSize) + 1)
    setHighlight(locateVisitId ? `${locatePatientId}|${locateVisitId}` : null)
    const t = setTimeout(() => setHighlight(null), 4500)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locatePatientId, locateVisitId, filtered, pageSize])

  // 翻页渲染后滚动到目标行
  useEffect(() => {
    if (!locatePatientId) return
    document.getElementById(`vsm-row-${locatePatientId}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [locatePatientId, safePage])

  const clearLocate = () => {
    const next = new URLSearchParams(searchParams)
    next.delete('patientId')
    next.delete('visitId')
    setSearchParams(next, { replace: true })
    setHighlight(null)
  }

  const locatePatient = locatePatientId ? list.find((p) => p.id === locatePatientId) : undefined
  const locateVisit = locateVisitId ? sortedVisits.find((v) => v.id === locateVisitId) : undefined

  if (!project) {
    return <div className="text-center py-20 text-slate-400">暂无项目数据</div>
  }

  return (
    <div className="space-y-4">
      {/* 标题栏：图标 + 标题 + 计数 + 右侧快速搜索 */}
      <div className="flex items-center justify-between gap-3 px-1 flex-wrap">
        <h3 className="text-sm font-medium text-slate-700 flex items-center gap-2 flex-wrap">
          <span className="w-6 h-6 rounded-md bg-sky-50 flex items-center justify-center shrink-0">
            <ClipboardEdit className="w-3.5 h-3.5 text-sky-500" />
          </span>
          {title}
          <span className="text-xs font-normal text-slate-400">
            {project.projectNo} · {project.name}
          </span>
          <span className="text-xs font-normal text-slate-400">
            {filtered.length === list.length
              ? `共 ${list.length} 例患者 · ${sortedVisits.length} 个访视`
              : `筛选出 ${filtered.length} / ${list.length} 例`}
          </span>
          {locatePatient && (
            <span className="inline-flex items-center gap-1 text-[11px] text-sky-600 bg-sky-50 border border-sky-100 px-2 py-0.5 rounded-full">
              <Crosshair className="w-3 h-3" />
              已定位：{locatePatient.screeningId}{locateVisit ? ` · ${locateVisit.code}` : ''}
              <button
                type="button"
                onClick={clearLocate}
                className="ml-0.5 text-sky-400 hover:text-sky-600"
                title="清除定位"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
        </h3>
        {showSearch && (
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              value={kw}
              onChange={(e) => setKw(e.target.value)}
              placeholder="搜索筛选编号 / 姓名缩写 / 随机编号"
              className="h-8 w-60 pl-8 pr-3 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-teal-400 focus:border-teal-400"
            />
          </div>
        )}
      </div>

      {/* 矩阵 */}
      <Card className="bg-white">
        <CardContent className="p-0">
          {sortedVisits.length === 0 ? (
            <div className="text-center py-16 text-sm text-slate-400">该项目暂未配置访视</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    {identityLayout === 'entry' ? (
                      <>
                        <th className="text-center px-4 py-2.5 text-xs font-medium text-slate-500 whitespace-nowrap sticky left-0 bg-slate-50 z-10">
                          筛选编号
                        </th>
                        <th className="text-center px-3 py-2.5 text-xs font-medium text-slate-500 whitespace-nowrap">
                          入组编号
                        </th>
                        <th className="text-center px-3 py-2.5 text-xs font-medium text-slate-500 whitespace-nowrap">
                          研究编号
                        </th>
                        <th className="text-center px-3 py-2.5 text-xs font-medium text-slate-500 whitespace-nowrap">
                          研究中心
                        </th>
                      </>
                    ) : (
                      <>
                        <th className="text-center px-4 py-2.5 text-xs font-medium text-slate-500 whitespace-nowrap sticky left-0 bg-slate-50 z-10">
                          患者编号
                        </th>
                        <th className="text-center px-3 py-2.5 text-xs font-medium text-slate-500 whitespace-nowrap">
                          项目编号
                        </th>
                        <th className="text-center px-3 py-2.5 text-xs font-medium text-slate-500 whitespace-nowrap">
                          研究中心
                        </th>
                      </>
                    )}
                    {sortedVisits.map((v) => (
                      <th
                        key={v.id}
                        className="text-center px-3 py-2.5 text-xs font-medium text-sky-600 whitespace-nowrap"
                        title={`${v.code} · ${v.name}`}
                      >
                        {v.code}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paged.map((p) => (
                    <tr key={p.id} id={`vsm-row-${p.id}`} className="border-b border-slate-50 hover:bg-sky-50/30 transition-colors">
                      <td className="px-4 py-2.5 text-center whitespace-nowrap sticky left-0 bg-white z-10">
                        <Link
                          to={patientLink(p)}
                          className="text-sm font-medium text-teal-600 underline underline-offset-2 hover:text-teal-700"
                          title={`${p.nameInitials} · 进入该患者页面`}
                        >
                          {p.screeningId || '—'}
                        </Link>
                      </td>
                      {identityLayout === 'entry' && (
                        <td className="px-3 py-2.5 text-center whitespace-nowrap text-xs font-mono text-slate-500">
                          {p.randomizationId || '—'}
                        </td>
                      )}
                      <td className="px-3 py-2.5 text-center whitespace-nowrap text-xs font-mono text-slate-500">
                        {project.projectNo}
                      </td>
                      <td className="px-3 py-2.5 text-center whitespace-nowrap text-xs text-slate-600">
                        {project.centers?.find((c) => c.id === p.centerId)?.name || project.researchCenter || '—'}
                      </td>
                      {sortedVisits.map((v) => {
                        const cell = cellOf(p, v, visitData)
                        return (
                          <td key={v.id} className="px-2 py-1.5 text-center whitespace-nowrap">
                            <Link
                              to={cellLink(p, v)}
                              className={`inline-block rounded-full transition-shadow ${
                                highlight === `${p.id}|${v.id}`
                                  ? 'ring-2 ring-sky-400 shadow-[0_0_14px_rgba(56,189,248,0.55)] animate-pulse'
                                  : 'hover:ring-2 hover:ring-sky-200'
                              }`}
                              title={`${v.code} · ${v.name}：点击进入`}
                            >
                              <CellBadge cell={cell} />
                            </Link>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                  {paged.length === 0 && (
                    <tr>
                      <td colSpan={sortedVisits.length + (identityLayout === 'entry' ? 4 : 3)} className="text-center py-12 text-slate-400">
                        <Users className="w-8 h-8 mx-auto mb-2 text-slate-200" />
                        {list.length === 0 ? '该项目暂无登记患者' : '未找到匹配的患者，请调整搜索条件'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* 分页栏 */}
          {filtered.length > 0 && (
            <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-100">
              <span className="text-xs text-slate-500">
                共 {filtered.length} 例 · 第 {(safePage - 1) * pageSize + 1}-{Math.min(safePage * pageSize, filtered.length)} 例
              </span>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-slate-400">每页</span>
                  <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(1) }}>
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
        </CardContent>
      </Card>
    </div>
  )
}
