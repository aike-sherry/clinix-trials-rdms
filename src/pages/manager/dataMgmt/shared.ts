import type { CRFModule, CRFField, TreeOption, VisitData } from '@/types'

// ==================== 动态表格分析支持 ====================

/** 可分析字段：普通字段原样；动态表格的列展开为独立字段，tableName 记录来源表格 */
export type AnalysisField = CRFField & { tableName?: string }

/**
 * 展开模块的可分析字段：普通字段 + 动态表格的列。
 * 表格列的显示名加上表格前缀（如「不良事件记录·严重程度」），便于在筛选/统计下拉中辨识。
 */
export function analysisFields(module: CRFModule | undefined): AnalysisField[] {
  if (!module) return []
  return module.fields.flatMap((f) =>
    f.type === 'table'
      ? (f.columns || []).map((c) => ({ ...c, tableName: f.name, label: `${f.label}·${c.label}` }))
      : [f],
  )
}

/**
 * 将一条访视数据展开为分析行：模块含动态表格时按表格行展开
 * （行数据 = 顶层标量字段 + 表格行合并，列名与普通字段同名寻址）；
 * 无表格字段时返回 [data] 单行。
 */
export function explodeRows(module: CRFModule, vd: VisitData): Record<string, unknown>[] {
  const table = module.fields.find((f) => f.type === 'table')
  if (!table) return [vd.data]
  const rows = Array.isArray(vd.data[table.name]) ? (vd.data[table.name] as Record<string, unknown>[]) : []
  return rows.map((r) => ({ ...vd.data, ...r }))
}

// ==================== 患者状态 ====================

export const PATIENT_STATUS_LABELS: Record<string, string> = {
  screening: '筛选中',
  enrolled: '已入组',
  treatment: '治疗期',
  completed: '已完成',
  withdrawn: '已退出',
  lost: '失访',
}

export const PATIENT_STATUS_COLORS: Record<string, string> = {
  screening: 'bg-violet-50 text-violet-600',
  enrolled: 'bg-blue-50 text-blue-600',
  treatment: 'bg-teal-50 text-teal-600',
  completed: 'bg-amber-50 text-amber-600',
  withdrawn: 'bg-red-50 text-red-600',
  lost: 'bg-slate-100 text-slate-500',
}

// ==================== 条件运算符 ====================

export type Operator = 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains' | 'notEmpty'

export const NUM_OPS: { value: Operator; label: string }[] = [
  { value: 'eq', label: '=' }, { value: 'ne', label: '≠' },
  { value: 'gt', label: '>' }, { value: 'lt', label: '<' },
  { value: 'gte', label: '≥' }, { value: 'lte', label: '≤' },
  { value: 'notEmpty', label: '非空' },
]

export const TEXT_OPS: { value: Operator; label: string }[] = [
  { value: 'eq', label: '=' }, { value: 'ne', label: '≠' },
  { value: 'contains', label: '包含' }, { value: 'notEmpty', label: '非空' },
]

// ==================== 工具函数 ====================

export function calcAge(birthDate?: string): string {
  if (!birthDate) return '-'
  const birth = new Date(birthDate)
  const now = new Date()
  let age = now.getFullYear() - birth.getFullYear()
  if (now.getMonth() < birth.getMonth() ||
    (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())) age--
  return String(age)
}

/** 将存储值格式化为可读文本（选项值 → 选项标签） */
export function displayValue(field: CRFField | undefined, value: unknown): string {
  if (value === undefined || value === null || value === '') return '-'
  if (field?.options?.length) {
    const opt = field.options.find((o) => o.value === value)
    if (opt) return opt.label
  }
  if (Array.isArray(value)) return value.join('、')
  if (typeof value === 'boolean') return value ? '是' : '否'
  return String(value)
}

// ==================== 矩阵单元格文本 ====================

export function treePathLabel(nodes: TreeOption[], value: string): string {
  const find = (ns: TreeOption[], trail: string[]): string[] | null => {
    for (const n of ns) {
      if (n.value === value) return [...trail, n.label]
      if (n.children) {
        const r = find(n.children, [...trail, n.label])
        if (r) return r
      }
    }
    return null
  }
  return find(nodes, [])?.join(' / ') ?? value
}

/** 矩阵单元格展示文本（处理特殊组件类型） */
export function cellText(field: CRFField, value: unknown): string {
  if (value === undefined || value === null || value === '') return '—'
  if (field.type === 'table') return Array.isArray(value) ? `共 ${value.length} 条记录` : '—'
  if (field.type === 'fileUpload') return Array.isArray(value) ? `${value.length} 个附件` : '—'
  if (field.type === 'signature') return '已签名'
  if (field.type === 'richText') {
    const text = String(value).replace(/<[^>]+>/g, '').trim()
    return text ? (text.length > 30 ? `${text.slice(0, 30)}…` : text) : '—'
  }
  if (field.type === 'treeSelect') return treePathLabel(field.treeOptions || [], String(value))
  return displayValue(field, value)
}

/** 判断一条字段条件是否命中患者的访视数据（任一访视命中即算；表格列字段任一行命中即算） */
export function matchCondition(
  records: VisitData[],
  field: AnalysisField,
  op: Operator,
  raw: string,
): boolean {
  return records.some((rec) => {
    // 表格列：取该表所有行的列值集合；普通字段：单值
    const vals: unknown[] = field.tableName
      ? (Array.isArray(rec.data[field.tableName])
          ? (rec.data[field.tableName] as Record<string, unknown>[]).map((r) => r[field.name])
          : [])
      : [rec.data[field.name]]
    return vals.some((v) => {
      if (op === 'notEmpty') return v !== undefined && v !== null && v !== ''
      if (v === undefined || v === null || v === '') return false
      if (field.type === 'number' || field.type === 'numberRange' || field.type === 'scale') {
        const num = Number(v)
        const target = Number(raw)
        if (Number.isNaN(num) || raw === '' || Number.isNaN(target)) return false
        switch (op) {
          case 'eq': return num === target
          case 'ne': return num !== target
          case 'gt': return num > target
          case 'lt': return num < target
          case 'gte': return num >= target
          case 'lte': return num <= target
          default: return false
        }
      }
      const s = String(v)
      switch (op) {
        case 'eq': return s === raw
        case 'ne': return s !== raw
        case 'contains': return raw !== '' && s.includes(raw)
        default: return false
      }
    })
  })
}

// ==================== CSV 导出 ====================

function csvCell(v: unknown): string {
  const s = String(v ?? '')
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function downloadCsv(filename: string, rows: unknown[][]) {
  const csv = rows.map((r) => r.map(csvCell).join(',')).join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function dateTag(): string {
  return new Date().toISOString().slice(0, 10).replace(/-/g, '')
}
