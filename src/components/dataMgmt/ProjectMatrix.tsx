import { useMemo, useState, Fragment, type ReactNode } from 'react'
import { Link } from 'react-router'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Database, Download, FileSpreadsheet,
  ChevronLeft, ChevronRight, ChevronDown, Users, ClipboardList,
} from 'lucide-react'
import { usePageSize } from '@/hooks/usePageSize'
import type { CRFField, Patient, Project, Visit, VisitData } from '@/types'
import {
  PATIENT_STATUS_LABELS, PATIENT_STATUS_COLORS,
  downloadCsv, dateTag, cellText,
} from '@/pages/manager/dataMgmt/shared'

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100]

/** 行操作按钮所需的定位上下文（去录入直达等） */
export interface MatrixRowActionCtx {
  visitId?: string
  moduleId?: string
}

/**
 * 数据管理 · 单项目数据矩阵（管理端 & 录入端共用）。
 *
 * - 访视/模块/仅显示已录入 支持受控（定位栏统一控制）或自控（全部分区各自选择）
 * - renderExpandedDetail：传入后行可点击展开（管理端审核详情）
 * - patientHomeLink：筛选编号旁的患者直达小图标（管理端审核详情页）
 * - rowAction：传入后渲染「操作」列（录入端去录入直达）
 */
export default function ProjectMatrix({
  project,
  patientsInProject,
  totalInProject,
  visitData,
  pageSizeKey,
  exportTag,
  renderExpandedDetail,
  patientHomeLink,
  rowAction,
  visitId: visitIdProp,
  moduleId: moduleIdProp,
  onlyWithData: onlyWithDataProp,
  onLocatorsChange,
}: {
  project: Project
  patientsInProject: Patient[]
  totalInProject: number
  visitData: VisitData[]
  pageSizeKey: string
  exportTag?: string
  renderExpandedDetail?: (patient: Patient) => ReactNode
  patientHomeLink?: (patient: Patient) => string
  rowAction?: (patient: Patient, ctx: MatrixRowActionCtx) => ReactNode
  visitId?: string
  moduleId?: string
  onlyWithData?: boolean
  onLocatorsChange?: (next: { visitId?: string; moduleId?: string; onlyWithData?: boolean }) => void
}) {
  const [innerVisitId, setInnerVisitId] = useState('all')
  const [innerModuleId, setInnerModuleId] = useState('all')
  const [innerOnlyWithData, setInnerOnlyWithData] = useState(false)
  const controlled = !!onLocatorsChange
  const visitId = controlled ? (visitIdProp ?? 'all') : innerVisitId
  const moduleId = controlled ? (moduleIdProp ?? 'all') : innerModuleId
  const onlyWithData = controlled ? (onlyWithDataProp ?? false) : innerOnlyWithData
  const setVisitId = (v: string) => (onLocatorsChange ? onLocatorsChange({ visitId: v }) : setInnerVisitId(v))
  const setModuleId = (v: string) => (onLocatorsChange ? onLocatorsChange({ moduleId: v }) : setInnerModuleId(v))
  const setOnlyWithData = (v: boolean) =>
    onLocatorsChange ? onLocatorsChange({ onlyWithData: v }) : setInnerOnlyWithData(v)

  const expandable = !!renderExpandedDetail

  const centers = project.centers ?? []
  const sortedVisits = useMemo(
    () => [...project.visits].sort((a, b) => a.order - b.order),
    [project],
  )

  // 模块选项随访视联动：选择某次访视时只能选该访视中的模块
  const moduleOptions = useMemo(() => {
    if (visitId === 'all') return project.crfModules
    const visit = project.visits.find((v) => v.id === visitId)
    if (!visit) return project.crfModules
    return project.crfModules.filter((m) => visit.crfModuleIds.includes(m.id))
  }, [project, visitId])

  // 当前生效模块：所选不在可选范围时回落到第一个
  const activeModule = useMemo(
    () => moduleOptions.find((m) => m.id === moduleId) ?? moduleOptions[0],
    [moduleOptions, moduleId],
  )

  // 矩阵涉及的访视：全部访视时取所有包含该模块的访视
  const visitsInvolved: Visit[] = useMemo(() => {
    if (!activeModule) return []
    if (visitId !== 'all') {
      const v = project.visits.find((x) => x.id === visitId)
      return v ? [v] : []
    }
    return sortedVisits.filter((v) => v.crfModuleIds.includes(activeModule.id))
  }, [project, activeModule, visitId, sortedVisits])

  const matrixFields = useMemo(
    () => (activeModule?.fields ?? []).filter((f) => f.type !== 'label'),
    [activeModule],
  )

  // 列 = 访视 × 字段
  const columns = useMemo(
    () =>
      visitsInvolved.flatMap((v) => matrixFields.map((f) => ({ visit: v, field: f }))),
    [visitsInvolved, matrixFields],
  )

  // ---------- 患者过滤（中心/状态由父级完成，此处处理「仅显示已录入」） ----------
  const filtered = useMemo(() => {
    if (!activeModule || !onlyWithData) return patientsInProject
    const visitIds = new Set(visitsInvolved.map((v) => v.id))
    return patientsInProject.filter((p) =>
      visitData.some(
        (vd) => vd.patientId === p.id && vd.moduleId === activeModule.id && visitIds.has(vd.visitId),
      ),
    )
  }, [patientsInProject, onlyWithData, activeModule, visitsInvolved, visitData])

  // ---------- 分页 ----------
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = usePageSize(pageSizeKey)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const paged = useMemo(
    () => filtered.slice((safePage - 1) * pageSize, safePage * pageSize),
    [filtered, safePage, pageSize],
  )

  // ---------- 数据查找 ----------
  const recordOf = (patientId: string, visit: Visit): VisitData | undefined =>
    visitData.find(
      (vd) => vd.patientId === patientId && vd.moduleId === activeModule?.id && vd.visitId === visit.id,
    )

  // 行操作上下文：定位到当前筛选的访视（全部访视时取第一个涉及访视）与模块
  const rowActionCtx: MatrixRowActionCtx = {
    visitId: visitId !== 'all' ? visitId : visitsInvolved[0]?.id,
    moduleId: activeModule?.id,
  }

  // ---------- 导出 ----------
  const colHeader = (visit: Visit, field: CRFField) =>
    visitsInvolved.length > 1 ? `${visit.code}·${field.label}` : field.label

  const exportMatrix = () => {
    const header = [
      '筛选编号', '随机编号', '姓名缩写', '性别', '中心', '患者状态',
      ...columns.map((c) => colHeader(c.visit, c.field)),
    ]
    const rows = filtered.map((p) => [
      p.screeningId, p.randomizationId ?? '', p.nameInitials,
      p.gender === 'male' ? '男' : '女',
      centers.find((c) => c.id === p.centerId)?.name ?? '',
      PATIENT_STATUS_LABELS[p.status] ?? p.status,
      ...columns.map((c) => {
        const rec = recordOf(p.id, c.visit)
        const text = cellText(c.field, rec?.data[c.field.name])
        return text === '—' ? '' : text
      }),
    ])
    downloadCsv(`数据矩阵_${exportTag ? `${exportTag}_` : ''}${activeModule?.name ?? ''}_${dateTag()}.csv`, [header, ...rows])
  }

  const exportLong = () => {
    const header = [
      '筛选编号', '随机编号', '姓名缩写', '中心', '患者状态',
      '访视编码', '访视名称', '字段', '字段标识', '值', '数据状态', '更新时间',
    ]
    const rows: unknown[][] = []
    for (const p of filtered) {
      for (const v of visitsInvolved) {
        const rec = recordOf(p.id, v)
        if (!rec) continue
        for (const f of matrixFields) {
          const value = rec.data[f.name]
          if (value === undefined || value === null || value === '') continue
          rows.push([
            p.screeningId, p.randomizationId ?? '', p.nameInitials,
            centers.find((c) => c.id === p.centerId)?.name ?? '',
            PATIENT_STATUS_LABELS[p.status] ?? p.status,
            v.code, v.name, f.label, f.name, cellText(f, value),
            rec.status === 'completed' ? '已完成' : rec.status === 'in_progress' ? '录入中' : rec.status,
            rec.updatedAt.slice(0, 10),
          ])
        }
      }
    }
    downloadCsv(`数据导出_${exportTag ? `${exportTag}_` : ''}${activeModule?.name ?? ''}_${dateTag()}.csv`, [header, ...rows])
  }

  const baseColCount = 5 + columns.length + (rowAction ? 1 : 0)

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2 flex-wrap">
            <Database className="w-4 h-4 text-sky-500" />
            {activeModule?.name ?? '数据矩阵'}
            <span className="text-sm font-normal text-slate-400">
              <span className="text-sky-600 font-semibold">{filtered.length}</span> 例患者 / 共 {totalInProject} 例
              {visitsInvolved.length > 1 && ` · ${visitsInvolved.length} 个访视`}
            </span>
          </CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            <Button size="sm" variant="outline" className="text-slate-600" onClick={exportMatrix} disabled={filtered.length === 0 || columns.length === 0}>
              <Download className="w-3.5 h-3.5 mr-1" />
              导出矩阵
            </Button>
            <Button size="sm" className="bg-sky-500 hover:bg-sky-600 text-white" onClick={exportLong} disabled={filtered.length === 0 || columns.length === 0}>
              <FileSpreadsheet className="w-3.5 h-3.5 mr-1" />
              导出明细
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="border border-slate-200 rounded-lg overflow-auto max-h-[520px]">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-2.5 font-medium text-slate-600 whitespace-nowrap sticky left-0 bg-slate-50">筛选编号</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-600 whitespace-nowrap">随机编号</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-600 whitespace-nowrap">姓名缩写</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-600 whitespace-nowrap">中心</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-600 whitespace-nowrap">状态</th>
                {columns.map((c) => (
                  <th key={`${c.visit.id}-${c.field.id}`} className="text-left px-4 py-2.5 font-medium text-sky-600 whitespace-nowrap">
                    {colHeader(c.visit, c.field)}
                  </th>
                ))}
                {rowAction && (
                  <th className="text-center px-4 py-2.5 font-medium text-slate-600 whitespace-nowrap sticky right-0 bg-slate-50">操作</th>
                )}
              </tr>
            </thead>
            <tbody>
              {paged.map((p) => (
                <Fragment key={p.id}>
                  <tr
                    className={`border-b border-slate-50 hover:bg-sky-50/50 ${expandable ? 'cursor-pointer' : ''} ${expandedId === p.id ? 'bg-sky-50/40' : ''}`}
                    onClick={expandable ? () => setExpandedId((cur) => (cur === p.id ? null : p.id)) : undefined}
                    title={expandable ? '点击展开该患者全部访视数据' : undefined}
                  >
                    <td className="px-4 py-2.5 font-medium text-slate-700 whitespace-nowrap sticky left-0 bg-white">
                      <span className="inline-flex items-center gap-1">
                        {expandable && (
                          expandedId === p.id ? (
                            <ChevronDown className="w-3.5 h-3.5 text-sky-500" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
                          )
                        )}
                        {p.screeningId}
                        {patientHomeLink && (
                          <Link
                            to={patientHomeLink(p)}
                            onClick={(e) => e.stopPropagation()}
                            title="打开该患者详情页"
                            className="ml-1.5 inline-flex items-center text-slate-300 hover:text-sky-500 transition-colors"
                          >
                            <ClipboardList className="w-3.5 h-3.5" />
                          </Link>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap">{p.randomizationId || '-'}</td>
                    <td className="px-4 py-2.5 text-slate-700 whitespace-nowrap">{p.nameInitials}</td>
                    <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap">
                      {centers.find((c) => c.id === p.centerId)?.name || '-'}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${PATIENT_STATUS_COLORS[p.status] ?? 'bg-slate-100 text-slate-500'}`}>
                        {PATIENT_STATUS_LABELS[p.status] ?? p.status}
                      </span>
                    </td>
                    {columns.map((c) => {
                      const rec = recordOf(p.id, c.visit)
                      const text = cellText(c.field, rec?.data[c.field.name])
                      return (
                        <td key={`${c.visit.id}-${c.field.id}`} className="px-4 py-2.5 whitespace-nowrap">
                          {rec && (
                            <span
                              className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 align-middle ${
                                rec.status === 'completed' ? 'bg-teal-500' : 'bg-amber-400'
                              }`}
                              title={rec.status === 'completed' ? '已完成' : '录入中'}
                            />
                          )}
                          <span className={text === '—' ? 'text-slate-300' : 'text-slate-700'}>{text}</span>
                        </td>
                      )
                    })}
                    {rowAction && (
                      <td className="px-4 py-2.5 text-center whitespace-nowrap sticky right-0 bg-white">
                        {rowAction(p, rowActionCtx)}
                      </td>
                    )}
                  </tr>
                  {expandable && expandedId === p.id && (
                    <tr key={`${p.id}-detail`} className="border-b border-slate-100">
                      <td colSpan={baseColCount} className="bg-slate-50/60 px-5 py-4">
                        {renderExpandedDetail(p)}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
              {paged.length === 0 && (
                <tr>
                  <td colSpan={baseColCount} className="text-center py-12 text-slate-400">
                    <Users className="w-8 h-8 mx-auto mb-2 text-slate-200" />
                    没有符合条件的患者，请调整筛选条件
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* 分页栏 */}
        {filtered.length > 0 && (
          <div className="flex items-center justify-between px-2 py-2.5">
            <span className="text-xs text-slate-500">
              共 {filtered.length} 例 · 第 {(safePage - 1) * pageSize + 1}-{Math.min(safePage * pageSize, filtered.length)} 例
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
      </CardContent>
    </Card>
  )
}
