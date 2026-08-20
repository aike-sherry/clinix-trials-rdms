import type { LabRangeItem, LabRangeSet } from '@/types'

const today = () => new Date().toISOString().slice(0, 10)

/**
 * 按检测日期解析应适用的参考范围版本（生效日期规则）：
 * - 生效日期 ≤ 检测日期的版本中，取生效日期最新的一套；
 * - 全部版本的生效日期都晚于检测日期时，取生效日期最早的一套（视为历史基线）；
 * - 未填检测日期时按今天解析（即"现在录入用当前生效版本"）；
 * - 未填生效日期的版本视为自始至终有效（排最前）。
 */
export function resolveLabSet(sets: LabRangeSet[], testDate?: string): LabRangeSet | undefined {
  if (sets.length === 0) return undefined
  const ref = testDate || today()
  const eff = (s: LabRangeSet) => s.effectiveDate || ''
  const sorted = [...sets].sort((a, b) => eff(a).localeCompare(eff(b)))
  const eligible = sorted.filter((s) => eff(s) <= ref)
  return eligible.length > 0 ? eligible[eligible.length - 1] : sorted[0]
}

/** 某项目在某检测日期下适用的参考范围记录（含单位） */
export function labRangeItemOf(
  sets: LabRangeSet[],
  itemName: unknown,
  testDate?: string,
): (LabRangeItem & { setName?: string }) | undefined {
  const set = resolveLabSet(sets, testDate)
  const item = set?.items.find((it) => it.name === itemName)
  return item ? { ...item, setName: set?.name } : undefined
}

/** 偏离判定：high=偏高 low=偏低 normal=正常 null=无判定依据 */
export function labFlagOfValue(
  item: { low?: number; high?: number } | undefined,
  v: unknown,
): 'high' | 'low' | 'normal' | null {
  if (!item || v === undefined || v === null || v === '' || isNaN(Number(v))) return null
  const n = Number(v)
  if (item.low !== undefined && n < item.low) return 'low'
  if (item.high !== undefined && n > item.high) return 'high'
  return 'normal'
}

/** 范围显示文本，如 115~150 g/L */
export function labRangeText(item: { low?: number; high?: number; unit?: string } | undefined): string {
  if (!item || (item.low === undefined && item.high === undefined)) return ''
  return `${item.low ?? '—'}~${item.high ?? '—'}${item.unit ? ` ${item.unit}` : ''}`
}
