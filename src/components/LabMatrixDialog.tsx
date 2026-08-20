import { useMemo } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Table2 } from 'lucide-react'
import type { CRFModule, CRFField, Patient, Project, Visit, VisitData } from '@/types'
import { labFlagOfValue, labRangeItemOf, labRangeText } from '@/utils/labRanges'

export interface MatrixFieldRef {
  module: CRFModule
  field: CRFField
}

const genId = () => `vd_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
const nowIso = () => new Date().toISOString()

/** 项目中所有矩阵展示的表格字段（实验室矩阵 + 通用预置行矩阵） */
export function collectMatrixFields(project: Project): MatrixFieldRef[] {
  const out: MatrixFieldRef[] = []
  for (const m of project.crfModules) {
    for (const f of m.fields) {
      if (f.type !== 'table') continue
      const isLabMatrix = !!(f.labConfig && f.labConfig.itemCol && f.labConfig.valueCol && f.labConfig.displayMode === 'matrix')
      const isGenericMatrix = !!(f.matrixView && f.rowPreset && f.rowPreset.col && f.matrixView.valueCol)
      if (isLabMatrix || isGenericMatrix) out.push({ module: m, field: f })
    }
  }
  return out
}

interface PanelProps {
  patient: Patient
  project: Project
  visitData: VisitData[]
  onSaveRecord: (vd: VisitData) => void
  module: CRFModule
  field: CRFField
  /** 是否显示「模块 · 字段」小节标题（弹窗内多小节时开启） */
  showTitle?: boolean
}

/**
 * 跨访视矩阵面板（通用）：
 * 行=预置内容（实验室项目或通用预置行），列=该模块所在访视；
 * 记录日期在列头一次填写、整列生效；单元格编辑即时保存。
 * 实验室模式额外提供 单位/正常值范围/↑↓判定 三列。
 */
export function LabMatrixPanel({ patient, project, visitData, onSaveRecord, module, field, showTitle = true }: PanelProps) {
  const lab = field.labConfig && field.labConfig.displayMode === 'matrix' ? field.labConfig : undefined
  const generic = !lab && field.matrixView && field.rowPreset ? field.matrixView : undefined

  // 行/列键与展示配置
  const rowCol = lab?.itemCol ?? field.rowPreset?.col ?? ''
  const valueCol = lab?.valueCol ?? generic?.valueCol ?? ''
  const showDate = lab ? true : (generic?.showDate ?? false)
  const valueColDef = field.columns?.find((c) => c.name === valueCol)
  const valueInputType = lab || valueColDef?.type === 'number' ? 'number' : 'text'
  const rowHeader = field.columns?.find((c) => c.name === rowCol)?.label ?? '项目'
  // 参考范围来源：实验室模式=labConfig.sets；通用表格（含单位/范围/判定列）=rangeSets
  const cols = field.columns ?? []
  const rangeSets = field.labConfig?.sets ?? field.rangeSets ?? []
  // 单位/正常值范围列：实验室矩阵自带；通用矩阵按列类型启用
  const showUnitCol = !!lab || cols.some((c) => c.type === 'unit')
  const showRangeCol = !!lab || cols.some((c) => c.type === 'range')
  // 偏离判定（↑↓箭头）：实验室矩阵自带；通用矩阵需含「判定状态」列
  const judgeEnabled = !!lab || cols.some((c) => c.type === 'flag')

  const sortedVisits = useMemo(
    () => [...project.visits].sort((a, b) => a.order - b.order),
    [project],
  )
  // 该模块所在的访视列
  const visits = useMemo(
    () => sortedVisits.filter((v) => v.crfModuleIds.includes(module.id)),
    [sortedVisits, module.id],
  )

  const recordOf = (visitId: string) =>
    visitData.find((v) => v.patientId === patient.id && v.visitId === visitId && v.moduleId === module.id)

  const rowsOf = (visitId: string): Record<string, unknown>[] => {
    const v = recordOf(visitId)?.data[field.name]
    return Array.isArray(v) ? (v as Record<string, unknown>[]) : []
  }

  // 行清单：实验室=预置项目（兼容旧数据从范围套取并集）；通用=预置行
  const items: { name: string; unit?: string }[] = useMemo(() => {
    if (lab) {
      if (lab.items && lab.items.length > 0) return lab.items
      return Array.from(new Map(lab.sets.flatMap((s) => s.items).map((it) => [it.name, it])).values())
    }
    return (field.rowPreset?.rows ?? []).filter((n) => n).map((n) => ({ name: n }))
  }, [lab, field.rowPreset])

  /**
   * 适用参考范围：按检测日期解析生效版本——
   * 生效日期 ≤ 检测日期的最新一套；未传日期按今天（单位/范围列显示当前生效版本）
   */
  const rangeOf = (itemName: string, testDate?: string) =>
    labRangeItemOf(rangeSets, itemName, testDate)

  const flagOf = (itemName: string, v: unknown, testDate?: string): 'high' | 'low' | null => {
    if (!judgeEnabled) return null
    const f = labFlagOfValue(rangeOf(itemName, testDate), v)
    return f === 'normal' ? null : f
  }

  const buildRecord = (visitId: string, rows: Record<string, unknown>[]): VisitData => {
    const rec = recordOf(visitId)
    return {
      id: rec?.id ?? genId(),
      patientId: patient.id,
      projectId: project.id,
      visitId,
      moduleId: module.id,
      data: { ...(rec?.data ?? {}), [field.name]: rows },
      status: rec?.status === 'completed' || rec?.status === 'locked' ? rec.status : 'in_progress',
      createdAt: rec?.createdAt ?? nowIso(),
      updatedAt: nowIso(),
      createdBy: rec?.createdBy,
    }
  }

  /** 写某个 访视×行 的内容值 */
  const saveCell = (visit: Visit, itemName: string, val: unknown) => {
    const rows = [...rowsOf(visit.id)]
    const i = rows.findIndex((r) => r[rowCol] === itemName)
    if (i >= 0) rows[i] = { ...rows[i], [valueCol]: val }
    else rows.push({ [rowCol]: itemName, [valueCol]: val })
    onSaveRecord(buildRecord(visit.id, rows))
  }

  /** 列头日期：整列（该访视全部行）一次填写 */
  const saveColumnDate = (visit: Visit, date: string) => {
    const existing = rowsOf(visit.id)
    const rows = items.map((it) => {
      const ex = existing.find((r) => r[rowCol] === it.name)
      return { ...(ex ?? { [rowCol]: it.name }), testDate: date }
    })
    onSaveRecord(buildRecord(visit.id, rows))
  }

  /** 该访视列的共用日期（所有行一致才显示，否则空） */
  const columnDateOf = (visitId: string): string => {
    const dates = rowsOf(visitId).map((r) => r.testDate).filter((d): d is string => !!d)
    if (dates.length === 0) return ''
    return dates.every((d) => d === dates[0]) ? dates[0] : ''
  }

  return (
    <div className="space-y-1.5">
      {showTitle && (
        <div className="text-sm font-semibold text-slate-700">{module.name} · {field.label}</div>
      )}
      <div className="overflow-x-auto rounded-md border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-slate-600 border-b whitespace-nowrap sticky left-0 bg-slate-50">{rowHeader}</th>
              {showUnitCol && (
                <th className="px-2 py-2 text-left text-xs font-medium text-slate-600 border-b whitespace-nowrap" title="按各列检测日期自动匹配生效版本，此处显示当前生效">单位</th>
              )}
              {showRangeCol && (
                <th className="px-2 py-2 text-left text-xs font-medium text-slate-600 border-b whitespace-nowrap" title="按各列检测日期自动匹配生效版本，此处显示当前生效">正常值范围</th>
              )}
              {visits.map((v) => (
                <th key={v.id} className="px-2 py-1.5 text-center text-xs font-medium text-slate-600 border-b border-l whitespace-nowrap min-w-36">
                  <div>{v.code} {v.name}</div>
                  {showDate && (
                    <div className="mt-1 flex items-center justify-center gap-1">
                      <span className="text-[10px] font-normal text-slate-400">{lab ? '检测日期' : '记录日期'}</span>
                      <Input
                        type="date"
                        className="h-6 text-[11px] w-32 px-1"
                        value={columnDateOf(v.id)}
                        onChange={(e) => saveColumnDate(v, e.target.value)}
                      />
                    </div>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.name} className="border-b border-slate-100 last:border-0">
                <td className="px-3 py-1.5 text-xs font-medium text-slate-700 whitespace-nowrap sticky left-0 bg-white">{it.name}</td>
                {showUnitCol && (
                  <td className="px-2 py-1.5 text-[11px] text-slate-400 whitespace-nowrap">{rangeOf(it.name)?.unit || it.unit || '—'}</td>
                )}
                {showRangeCol && (
                  <td className="px-2 py-1.5 text-[11px] text-slate-500 whitespace-nowrap">
                    {labRangeText(rangeOf(it.name)) || <span className="text-slate-300">—</span>}
                  </td>
                )}
                {visits.map((v) => {
                  const row = rowsOf(v.id).find((r) => r[rowCol] === it.name)
                  const val = row?.[valueCol]
                  const visitDate = columnDateOf(v.id) || undefined
                  const flag = flagOf(it.name, val, visitDate)
                  const applied = judgeEnabled ? rangeOf(it.name, visitDate) : undefined
                  return (
                    <td key={v.id} className="px-2 py-1 border-l border-slate-100">
                      <div
                        className="flex items-center justify-center gap-1"
                        title={applied ? `判定依据：${applied.setName ?? ''} ${labRangeText(applied)}`.trim() : undefined}
                      >
                        <Input
                          type={valueInputType}
                          className={`h-7 text-xs text-center ${valueInputType === 'number' ? 'w-24' : 'w-32'} ${
                            flag === 'high' ? 'border-red-300 text-red-600 font-semibold'
                            : flag === 'low' ? 'border-sky-300 text-sky-600 font-semibold'
                            : ''
                          }`}
                          defaultValue={val !== undefined ? String(val) : ''}
                          key={`${v.id}-${it.name}-${val ?? ''}`}
                          onBlur={(e) => {
                            const raw = e.target.value
                            const nv = raw === '' ? undefined : valueInputType === 'number' ? Number(raw) : raw
                            if (nv !== val) saveCell(v, it.name, nv)
                          }}
                        />
                        {flag === 'high' && <span className="text-red-500 text-[11px] font-bold" title="高于参考上限">↑</span>}
                        {flag === 'low' && <span className="text-sky-600 text-[11px] font-bold" title="低于参考下限">↓</span>}
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={visits.length + 1 + (showUnitCol ? 1 : 0) + (showRangeCol ? 1 : 0)} className="px-3 py-6 text-center text-xs text-slate-400">
                  暂无预置行，请在模块设计中配置
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  patient: Patient
  project: Project
  visitData: VisitData[]
  onSaveRecord: (vd: VisitData) => void
}

/** 跨访视矩阵总览弹窗：汇总本研究全部矩阵展示的模块（实验室 + 通用预置行） */
export function LabMatrixDialog({ open, onOpenChange, patient, project, visitData, onSaveRecord }: DialogProps) {
  const matrixFields = useMemo(() => collectMatrixFields(project), [project])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
            <Table2 className="w-4 h-4 text-teal-500" />
            跨访视矩阵 · {patient.screeningId} {patient.nameInitials}
          </DialogTitle>
        </DialogHeader>
        <p className="text-xs text-slate-400 -mt-1">
          行=预置内容、列=访视；记录日期在列头填写一次整列生效；实验室项目偏离范围自动提示 ↑偏高/↓偏低。
        </p>

        {matrixFields.length === 0 && (
          <div className="text-center py-10 text-sm text-slate-400">本研究暂无矩阵展示的模块</div>
        )}

        {matrixFields.map((lf) => (
          <LabMatrixPanel
            key={lf.field.id}
            patient={patient}
            project={project}
            visitData={visitData}
            onSaveRecord={onSaveRecord}
            module={lf.module}
            field={lf.field}
          />
        ))}
      </DialogContent>
    </Dialog>
  )
}
