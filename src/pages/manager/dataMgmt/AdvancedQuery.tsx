import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Filter, Plus, Trash2, Download, FileSpreadsheet, Users, RotateCcw } from 'lucide-react'
import { useAppStorage } from '@/hooks/useAppStorage'
import type { Patient, Project } from '@/types'
import {
  PATIENT_STATUS_LABELS, PATIENT_STATUS_COLORS,
  NUM_OPS, TEXT_OPS, type Operator,
  calcAge, displayValue, cellText, matchCondition, downloadCsv, dateTag,
  analysisFields, explodeRows, type AnalysisField,
} from './shared'

interface Condition {
  id: string
  moduleId: string
  fieldName: string
  operator: Operator
  value: string
}

/** 高级筛选：跨模块字段条件构建器（AND 组合） */
export default function AdvancedQuery() {
  const { projects, patients, visitData } = useAppStorage()
  const [searchParams] = useSearchParams()

  // 项目由顶栏筛选框通过 URL 参数驱动
  const projectNoParam = searchParams.get('projectNo') || ''
  const [centerId, setCenterId] = useState<string>('all')
  const [status, setStatus] = useState<string>('all')
  const [visitCode, setVisitCode] = useState<string>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [conditions, setConditions] = useState<Condition[]>([])

  const project: Project | undefined =
    projects.find((p) => p.projectNo === projectNoParam)
    ?? projects.find((p) => p.crfModules.length > 0)
    ?? projects[0]
  const sortedVisits = useMemo(
    () => (project ? [...project.visits].sort((a, b) => a.order - b.order) : []),
    [project],
  )

  const addCondition = () => {
    if (!project) return
    const firstModule = project.crfModules[0]
    const firstField = firstModule?.fields.find((f) => f.type !== 'label')
    setConditions((prev) => [
      ...prev,
      {
        id: `cond_${Date.now()}_${prev.length}`,
        moduleId: firstModule?.id ?? '',
        fieldName: firstField?.name ?? '',
        operator: 'eq',
        value: '',
      },
    ])
  }

  const updateCondition = (id: string, patch: Partial<Condition>) => {
    setConditions((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)))
  }

  const removeCondition = (id: string) => {
    setConditions((prev) => prev.filter((c) => c.id !== id))
  }

  const resetAll = () => {
    setCenterId('all')
    setStatus('all')
    setVisitCode('all')
    setDateFrom('')
    setDateTo('')
    setConditions([])
  }

  // 项目中心列表
  const centers = project?.centers ?? []

  // ---------- 过滤逻辑（实时联动） ----------
  const filtered = useMemo(() => {
    return patients.filter((p) => {
      if (project && p.projectId !== project.id) return false
      if (centerId !== 'all' && p.centerId !== centerId) return false
      if (status !== 'all' && p.status !== status) return false
      if (visitCode !== 'all' && p.currentVisit !== visitCode) return false
      if (dateFrom && (p.enrollmentDate || '') < dateFrom) return false
      if (dateTo && (p.enrollmentDate || '') > dateTo) return false
      for (const cond of conditions) {
        const module = project?.crfModules.find((m) => m.id === cond.moduleId)
        const field = module ? analysisFields(module).find((f) => f.name === cond.fieldName) : undefined
        if (!module || !field) continue
        const records = visitData.filter(
          (vd) => vd.patientId === p.id && vd.moduleId === cond.moduleId,
        )
        if (!matchCondition(records, field, cond.operator, cond.value)) return false
      }
      return true
    })
  }, [patients, centerId, status, visitCode, dateFrom, dateTo, conditions, project, visitData])

  const totalInScope = useMemo(
    () => (project ? patients.filter((p) => p.projectId === project.id).length : patients.length),
    [patients, project],
  )

  /** 条件涉及字段（含动态表格展开列） */
  const condFieldOf = (cond: Condition): AnalysisField | undefined => {
    const module = project?.crfModules.find((m) => m.id === cond.moduleId)
    return module ? analysisFields(module).find((f) => f.name === cond.fieldName) : undefined
  }

  /** 条件字段的患者维度显示文本：表格列取全部命中行的列值去重拼接，普通字段取最新/命中记录值 */
  const condText = (patient: Patient, cond: Condition): string => {
    const module = project?.crfModules.find((m) => m.id === cond.moduleId)
    const field = condFieldOf(cond)
    if (!module || !field) return ''
    const records = visitData
      .filter((vd) => vd.patientId === patient.id && vd.moduleId === cond.moduleId)
      .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))
    if (records.length === 0) return ''
    const matched = records.filter((rec) =>
      matchCondition([rec], field, cond.operator, cond.value),
    )
    const source = matched.length > 0 ? matched[matched.length - 1] : records[records.length - 1]
    if (field.tableName) {
      const vals = explodeRows(module, source)
        .map((r) => cellText(field, r[field.name]))
        .filter((t) => t && t !== '-')
      return Array.from(new Set(vals)).join('；')
    }
    return displayValue(field, source.data[cond.fieldName])
  }

  // ---------- 导出 ----------
  const exportRoster = () => {
    const header = [
      '项目编号', '项目名称', '筛选编号', '随机编号', '姓名缩写', '性别', '年龄',
      '中心', '状态', '当前访视', '知情同意日期', '入组日期',
      ...conditions.map((c) => {
        const mod = project?.crfModules.find((m) => m.id === c.moduleId)
        const field = condFieldOf(c)
        return `${mod?.name ?? ''}-${field?.label ?? c.fieldName}`
      }),
    ]
    const rows = filtered.map((p) => {
      const proj = projects.find((pj) => pj.id === p.projectId)
      return [
        proj?.projectNo ?? '', proj?.name ?? '', p.screeningId, p.randomizationId ?? '',
        p.nameInitials, p.gender === 'male' ? '男' : '女', calcAge(p.birthDate),
        centers.find((c) => c.id === p.centerId)?.name ?? '',
        PATIENT_STATUS_LABELS[p.status] ?? p.status, p.currentVisit ?? '',
        p.consentDate ?? '', p.enrollmentDate ?? '',
        ...conditions.map((c) => condText(p, c)),
      ]
    })
    downloadCsv(`患者清单_${dateTag()}.csv`, [header, ...rows])
  }

  const exportVisitData = () => {
    const header = [
      '项目编号', '筛选编号', '随机编号', '姓名缩写', '患者状态',
      '访视编码', '访视名称', '模块', '字段', '字段标识', '值', '数据状态', '更新时间',
    ]
    const patientIds = new Set(filtered.map((p) => p.id))
    const rows: unknown[][] = []
    for (const vd of visitData) {
      if (!patientIds.has(vd.patientId)) continue
      const patient = filtered.find((p) => p.id === vd.patientId)!
      const proj = projects.find((pj) => pj.id === vd.projectId)
      const visit = proj?.visits.find((v) => v.id === vd.visitId)
      const module = proj?.crfModules.find((m) => m.id === vd.moduleId)
      if (!module) continue
      const aFields = analysisFields(module).filter(
        (f) => !['label', 'table', 'richText', 'fileUpload'].includes(f.type),
      )
      for (const row of explodeRows(module, vd)) {
        for (const field of aFields) {
          const value = row[field.name]
          if (value === undefined || value === null || value === '') continue
          rows.push([
            proj?.projectNo ?? '', patient.screeningId, patient.randomizationId ?? '',
            patient.nameInitials, PATIENT_STATUS_LABELS[patient.status] ?? patient.status,
            visit?.code ?? '', visit?.name ?? '', module?.name ?? '',
            field.label, field.name, cellText(field, value),
            vd.status === 'completed' ? '已完成' : vd.status === 'in_progress' ? '录入中' : vd.status,
            vd.updatedAt.slice(0, 10),
          ])
        }
      }
    }
    downloadCsv(`访视数据_${dateTag()}.csv`, [header, ...rows])
  }

  // ==================== 渲染 ====================

  return (
    <div className="space-y-4">
      {/* ================= 筛选区 ================= */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Filter className="w-4 h-4 text-sky-500" />
              数据筛选
            </CardTitle>
            <Button variant="ghost" size="sm" className="text-slate-400" onClick={resetAll}>
              <RotateCcw className="w-3.5 h-3.5 mr-1" />
              重置
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 基础条件 */}
          <div className="flex flex-wrap items-center gap-3">
            {centers.length > 0 && (
              <Select value={centerId} onValueChange={setCenterId}>
                <SelectTrigger className="w-44 bg-slate-50 border-slate-200">
                  <SelectValue placeholder="中心" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部中心</SelectItem>
                  {centers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-36 bg-slate-50 border-slate-200">
                <SelectValue placeholder="患者状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                {Object.entries(PATIENT_STATUS_LABELS).map(([v, l]) => (
                  <SelectItem key={v} value={v}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={visitCode} onValueChange={setVisitCode} disabled={!project}>
              <SelectTrigger className="w-40 bg-slate-50 border-slate-200">
                <SelectValue placeholder="当前访视" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部访视</SelectItem>
                {sortedVisits.map((v) => (
                  <SelectItem key={v.id} value={v.code}>{v.code} · {v.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center gap-1.5 text-sm text-slate-500">
              <span>入组日期</span>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-38 bg-slate-50 border-slate-200" />
              <span>至</span>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-38 bg-slate-50 border-slate-200" />
            </div>
          </div>

          {/* 字段级条件 */}
          {conditions.length > 0 && (
            <div className="space-y-2">
              {conditions.map((cond, idx) => {
                const module = project?.crfModules.find((m) => m.id === cond.moduleId)
                const field = condFieldOf(cond)
                const isNum = field?.type === 'number' || field?.type === 'numberRange'
                const ops = isNum ? NUM_OPS : TEXT_OPS
                const hasOptions = !!field?.options?.length
                return (
                  <div key={cond.id} className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2">
                    <span className="text-xs text-slate-400 w-14 shrink-0">条件 {idx + 1}</span>
                    <Select
                      value={cond.moduleId}
                      onValueChange={(v) => {
                        const mod = project?.crfModules.find((m) => m.id === v)
                        const f = mod
                          ? analysisFields(mod).find(
                              (x) => !['label', 'table', 'richText', 'fileUpload'].includes(x.type),
                            )
                          : undefined
                        updateCondition(cond.id, { moduleId: v, fieldName: f?.name ?? '', operator: 'eq', value: '' })
                      }}
                    >
                      <SelectTrigger className="w-36 bg-white border-slate-200 h-9">
                        <SelectValue placeholder="模块" />
                      </SelectTrigger>
                      <SelectContent>
                        {project?.crfModules.map((m) => (
                          <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select
                      value={cond.fieldName}
                      onValueChange={(v) => updateCondition(cond.id, { fieldName: v, value: '' })}
                    >
                      <SelectTrigger className="w-44 bg-white border-slate-200 h-9">
                        <SelectValue placeholder="字段" />
                      </SelectTrigger>
                      <SelectContent>
                        {(module ? analysisFields(module) : [])
                          .filter((f) => !['label', 'table', 'richText', 'fileUpload'].includes(f.type))
                          .map((f) => (
                          <SelectItem key={f.id} value={f.name}>{f.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select
                      value={cond.operator}
                      onValueChange={(v) => updateCondition(cond.id, { operator: v as Operator })}
                    >
                      <SelectTrigger className="w-20 bg-white border-slate-200 h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ops.map((o) => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {cond.operator !== 'notEmpty' && (
                      hasOptions ? (
                        <Select value={cond.value} onValueChange={(v) => updateCondition(cond.id, { value: v })}>
                          <SelectTrigger className="w-36 bg-white border-slate-200 h-9">
                            <SelectValue placeholder="选择值" />
                          </SelectTrigger>
                          <SelectContent>
                            {field?.options?.map((o) => (
                              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          value={cond.value}
                          onChange={(e) => updateCondition(cond.id, { value: e.target.value })}
                          placeholder={isNum ? '数值' : '文本'}
                          className="w-36 bg-white border-slate-200 h-9"
                        />
                      )
                    )}

                    <Button
                      variant="ghost" size="icon"
                      className="h-8 w-8 text-slate-300 hover:text-red-500"
                      onClick={() => removeCondition(cond.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                )
              })}
            </div>
          )}

          <div className="flex items-center gap-3">
            <Button
              variant="outline" size="sm"
              className="border-dashed border-slate-300 text-slate-500"
              onClick={addCondition}
              disabled={!project}
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              添加字段条件
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ================= 结果区 ================= */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Users className="w-4 h-4 text-sky-500" />
              患者清单
              <span className="text-sm font-normal text-slate-400">
                符合条件 <span className="text-sky-600 font-semibold">{filtered.length}</span> 例 / 共 {totalInScope} 例
              </span>
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" className="text-slate-600" onClick={exportRoster} disabled={filtered.length === 0}>
                <Download className="w-3.5 h-3.5 mr-1" />
                导出清单
              </Button>
              <Button size="sm" className="bg-sky-500 hover:bg-sky-600 text-white" onClick={exportVisitData} disabled={filtered.length === 0}>
                <FileSpreadsheet className="w-3.5 h-3.5 mr-1" />
                导出访视数据
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="border border-slate-200 rounded-lg overflow-auto max-h-[520px]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-2.5 font-medium text-slate-600">筛选编号</th>
                  <th className="text-left px-4 py-2.5 font-medium text-slate-600">随机编号</th>
                  <th className="text-left px-4 py-2.5 font-medium text-slate-600">姓名缩写</th>
                  <th className="text-left px-4 py-2.5 font-medium text-slate-600">性别</th>
                  <th className="text-left px-4 py-2.5 font-medium text-slate-600">年龄</th>
                  <th className="text-left px-4 py-2.5 font-medium text-slate-600">中心</th>
                  <th className="text-left px-4 py-2.5 font-medium text-slate-600">状态</th>
                  <th className="text-left px-4 py-2.5 font-medium text-slate-600">当前访视</th>
                  <th className="text-left px-4 py-2.5 font-medium text-slate-600">入组日期</th>
                  {conditions.map((c) => (
                    <th key={c.id} className="text-left px-4 py-2.5 font-medium text-sky-600 whitespace-nowrap">
                      {condFieldOf(c)?.label ?? c.fieldName}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50/60">
                    <td className="px-4 py-2.5 font-medium text-slate-700">{p.screeningId}</td>
                    <td className="px-4 py-2.5 text-slate-500">{p.randomizationId || '-'}</td>
                    <td className="px-4 py-2.5 text-slate-700">{p.nameInitials}</td>
                    <td className="px-4 py-2.5 text-slate-500">{p.gender === 'male' ? '男' : '女'}</td>
                    <td className="px-4 py-2.5 text-slate-500">{calcAge(p.birthDate)}</td>
                    <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap">
                      {centers.find((c) => c.id === p.centerId)?.name || '-'}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${PATIENT_STATUS_COLORS[p.status] ?? 'bg-slate-100 text-slate-500'}`}>
                        {PATIENT_STATUS_LABELS[p.status] ?? p.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-500">{p.currentVisit || '-'}</td>
                    <td className="px-4 py-2.5 text-slate-500">{p.enrollmentDate || '-'}</td>
                    {conditions.map((c) => (
                      <td key={c.id} className="px-4 py-2.5 text-slate-700 whitespace-nowrap">
                        {condText(p, c) || '-'}
                      </td>
                    ))}
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={9 + conditions.length} className="text-center py-12 text-slate-400">
                      没有符合条件的患者，请调整筛选条件
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
