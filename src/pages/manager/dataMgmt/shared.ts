import type { CRFField, VisitData } from '@/types'

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

/** 判断一条字段条件是否命中患者的访视数据（任一访视命中即算） */
export function matchCondition(
  records: VisitData[],
  field: CRFField,
  op: Operator,
  raw: string,
): boolean {
  return records.some((rec) => {
    const v = rec.data[field.name]
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
