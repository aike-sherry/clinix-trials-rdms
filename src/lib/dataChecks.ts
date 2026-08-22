import type { ModuleLibraryItem, Patient, Project, VisitData } from '@/types'

// ============================================================
// 智能核查引擎（演示版）
// 三类规则：
//  - logic       逻辑核查：跨字段/跨模块确定性矛盾（日期先后、医学逻辑等）
//  - range       范围异常：超出生理极限 / 合理区间
//  - statistical 统计预警：离群值、直线录入、尾数偏好、中心漏报
// 规则按「字段语义名」匹配（如 systolicBP、aeRecords），与具体项目解耦
// ============================================================

export type CheckCategory = 'logic' | 'range' | 'statistical'
export type CheckSeverity = 'high' | 'medium' | 'low'

export interface CheckIssue {
  id: string
  ruleId: string
  ruleName: string
  category: CheckCategory
  severity: CheckSeverity
  patientId: string
  projectId: string
  visitId?: string
  moduleId?: string
  visitDataId?: string
  fieldName?: string
  fieldLabel?: string
  description: string
  valueText?: string
}

export interface CheckRuleMeta {
  id: string
  name: string
  category: CheckCategory
  severity: CheckSeverity
  description: string
}

export const CATEGORY_LABELS: Record<CheckCategory, string> = {
  logic: '逻辑核查',
  range: '范围异常',
  statistical: '统计预警',
}

export const SEVERITY_LABELS: Record<CheckSeverity, string> = {
  high: '高',
  medium: '中',
  low: '低',
}

export const CHECK_RULES: CheckRuleMeta[] = [
  { id: 'L01', name: '知情日期晚于入组日期', category: 'logic', severity: 'high', description: '患者知情同意日期应早于入组日期' },
  { id: 'L02', name: '知情书版本日期晚于签署日期', category: 'logic', severity: 'high', description: '受试者签署日期不能早于知情同意书版本日期' },
  { id: 'L03', name: '收缩压低于舒张压', category: 'logic', severity: 'high', description: '同一次测量的收缩压必须大于舒张压' },
  { id: 'L04', name: 'BMI 与身高体重不符', category: 'logic', severity: 'medium', description: 'BMI 与 体重/身高² 计算值偏差超过 1.5' },
  { id: 'L05', name: '不良事件发生日期晚于结束日期', category: 'logic', severity: 'high', description: '不良事件的结束日期不能早于发生日期' },
  { id: 'L06', name: '不良事件转归与结束日期矛盾', category: 'logic', severity: 'medium', description: '已填写结束日期但转归仍为「持续中」' },
  { id: 'L07', name: '合并用药开始日期晚于结束日期', category: 'logic', severity: 'high', description: '合并用药的结束日期不能早于开始日期' },
  { id: 'L08', name: '疗效评估日期早于入组日期', category: 'logic', severity: 'medium', description: '疗效评价记录的评估日期应晚于患者入组日期' },
  { id: 'R01', name: '生命体征超出生理极限', category: 'range', severity: 'high', description: '血压/脉搏/呼吸/体温/心率超出人类生理极限值' },
  { id: 'R02', name: '身高体重 BMI 超出合理范围', category: 'range', severity: 'medium', description: '身高 100-230cm、体重 25-250kg、BMI 10-60' },
  { id: 'S01', name: '数值离群（IQR）', category: 'statistical', severity: 'medium', description: '数值超出全体受试者四分位距 1.5 倍边界' },
  { id: 'S02', name: '直线录入', category: 'statistical', severity: 'medium', description: '同一患者同一字段连续 ≥3 次访视数值完全相同' },
  { id: 'S03', name: '尾数偏好', category: 'statistical', severity: 'low', description: '同一录入人填写的数值尾数为 0/5 的比例 ≥70%' },
  { id: 'S04', name: '中心不良事件报告率偏低', category: 'statistical', severity: 'medium', description: '某中心人均不良事件数为 0 且显著低于其他中心' },
]

// ---------- 工具 ----------

function genId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

function toDate(v: unknown): Date | null {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(v)) return null
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d
}

function toNum(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v)
  return null
}

function fmtDate(v: unknown): string {
  return typeof v === 'string' ? v.slice(0, 10) : String(v ?? '')
}

/** 生理极限（范围异常 R01） */
const PHYSIO_LIMITS: Record<string, { label: string; min: number; max: number }> = {
  systolicBP: { label: '收缩压', min: 60, max: 260 },
  diastolicBP: { label: '舒张压', min: 30, max: 180 },
  pulse: { label: '脉搏', min: 30, max: 220 },
  respiratoryRate: { label: '呼吸频率', min: 5, max: 45 },
  temperature: { label: '体温', min: 34, max: 43 },
  heartRate: { label: '心率', min: 20, max: 250 },
}

/** 合理范围（R02） */
const REASONABLE_LIMITS: Record<string, { label: string; min: number; max: number }> = {
  height: { label: '身高', min: 100, max: 230 },
  weight: { label: '体重', min: 25, max: 250 },
  bmi: { label: 'BMI', min: 10, max: 60 },
}

// ---------- 主入口 ----------

export function runDataChecks(args: {
  projects: Project[]
  patients: Patient[]
  visitData: VisitData[]
  moduleLibrary: ModuleLibraryItem[]
  enabledRuleIds?: Set<string>
}): CheckIssue[] {
  const { projects, patients, visitData, enabledRuleIds } = args
  const enabled = (id: string) => !enabledRuleIds || enabledRuleIds.has(id)
  const issues: CheckIssue[] = []
  const publishedIds = new Set(projects.filter((p) => p.crfPublished).map((p) => p.id))
  const scopedPatients = patients.filter((p) => publishedIds.has(p.projectId))
  const patientById = new Map(scopedPatients.map((p) => [p.id, p]))
  const scopedData = visitData.filter((v) => patientById.has(v.patientId))

  const push = (issue: Omit<CheckIssue, 'id'>) => issues.push({ ...issue, id: genId() })
  const ruleMeta = (id: string) => CHECK_RULES.find((r) => r.id === id)!
  const base = (ruleId: string, extra: Partial<CheckIssue>) => {
    const meta = ruleMeta(ruleId)
    return { ruleId, ruleName: meta.name, category: meta.category, severity: meta.severity, ...extra } as Omit<CheckIssue, 'id'>
  }

  // ---------- L01 知情日期晚于入组日期（患者级） ----------
  if (enabled('L01')) {
    scopedPatients.forEach((p) => {
      const consent = toDate(p.consentDate)
      const enroll = toDate(p.enrollmentDate)
      if (consent && enroll && consent > enroll) {
        push(base('L01', {
          patientId: p.id, projectId: p.projectId,
          description: `知情同意日期 ${fmtDate(p.consentDate)} 晚于入组日期 ${fmtDate(p.enrollmentDate)}`,
          valueText: `${fmtDate(p.consentDate)} > ${fmtDate(p.enrollmentDate)}`,
        }))
      }
    })
  }

  // ---------- 逐记录字段级检查 ----------
  scopedData.forEach((rec) => {
    const d = rec.data ?? {}
    const patient = patientById.get(rec.patientId)!
    const common = { patientId: rec.patientId, projectId: rec.projectId, visitId: rec.visitId, moduleId: rec.moduleId, visitDataId: rec.id }

    // L02 知情书版本日期晚于签署日期
    if (enabled('L02')) {
      const ver = toDate(d.icfVersionDate)
      const sign = toDate(d.signDate)
      if (ver && sign && ver > sign) {
        push(base('L02', { ...common, fieldName: 'signDate', fieldLabel: '受试者签署日期',
          description: `知情同意书版本日期 ${fmtDate(d.icfVersionDate)} 晚于签署日期 ${fmtDate(d.signDate)}`,
          valueText: `${fmtDate(d.icfVersionDate)} > ${fmtDate(d.signDate)}` }))
      }
    }

    // L03 收缩压 ≤ 舒张压
    if (enabled('L03')) {
      const sys = toNum(d.systolicBP)
      const dia = toNum(d.diastolicBP)
      if (sys !== null && dia !== null && sys <= dia) {
        push(base('L03', { ...common, fieldName: 'systolicBP', fieldLabel: '收缩压',
          description: `收缩压 ${sys}mmHg 未大于舒张压 ${dia}mmHg，存在逻辑矛盾`,
          valueText: `收缩压 ${sys} / 舒张压 ${dia}` }))
      }
    }

    // L04 BMI 一致性
    if (enabled('L04')) {
      const h = toNum(d.height)
      const w = toNum(d.weight)
      const bmi = toNum(d.bmi)
      if (h !== null && w !== null && bmi !== null && h > 0) {
        const calc = w / Math.pow(h / 100, 2)
        if (Math.abs(calc - bmi) > 1.5) {
          push(base('L04', { ...common, fieldName: 'bmi', fieldLabel: 'BMI',
            description: `BMI 填写 ${bmi}，按身高 ${h}cm / 体重 ${w}kg 计算应为 ${calc.toFixed(1)}，偏差 ${Math.abs(calc - bmi).toFixed(1)}`,
            valueText: `BMI ${bmi}（计算值 ${calc.toFixed(1)}）` }))
        }
      }
    }

    // L05/L06 不良事件表
    const aeRows = Array.isArray(d.aeRecords) ? (d.aeRecords as Record<string, unknown>[]) : []
    aeRows.forEach((row, i) => {
      const rowTag = `第 ${i + 1} 行「${String(row.eventName ?? '未命名事件')}」`
      if (enabled('L05')) {
        const onset = toDate(row.onsetDate)
        const end = toDate(row.endDate)
        if (onset && end && onset > end) {
          push(base('L05', { ...common, fieldName: 'aeRecords', fieldLabel: '不良事件记录',
            description: `不良事件${rowTag}：发生日期 ${fmtDate(row.onsetDate)} 晚于结束日期 ${fmtDate(row.endDate)}`,
            valueText: `${fmtDate(row.onsetDate)} > ${fmtDate(row.endDate)}` }))
        }
      }
      if (enabled('L06')) {
        const end = toDate(row.endDate)
        if (end && String(row.outcome ?? '') === '持续中') {
          push(base('L06', { ...common, fieldName: 'aeRecords', fieldLabel: '不良事件记录',
            description: `不良事件${rowTag}：已填写结束日期 ${fmtDate(row.endDate)}，但转归仍为「持续中」`,
            valueText: `结束日期 ${fmtDate(row.endDate)} / 转归 持续中` }))
        }
      }
    })

    // L07 合并用药表
    const medRows = Array.isArray(d.medRecords) ? (d.medRecords as Record<string, unknown>[]) : []
    medRows.forEach((row, i) => {
      if (!enabled('L07')) return
      const start = toDate(row.startDate)
      const end = toDate(row.endDate)
      if (start && end && start > end) {
        push(base('L07', { ...common, fieldName: 'medRecords', fieldLabel: '合并用药记录',
          description: `合并用药第 ${i + 1} 行「${String(row.drugName ?? '未命名药物')}」：开始日期 ${fmtDate(row.startDate)} 晚于结束日期 ${fmtDate(row.endDate)}`,
          valueText: `${fmtDate(row.startDate)} > ${fmtDate(row.endDate)}` }))
      }
    })

    // L08 疗效评估日期早于入组日期
    if (enabled('L08')) {
      const evalDate = toDate(d.evalDate)
      const enroll = toDate(patient.enrollmentDate)
      if (evalDate && enroll && evalDate < enroll) {
        push(base('L08', { ...common, fieldName: 'evalDate', fieldLabel: '评估日期',
          description: `疗效评估日期 ${fmtDate(d.evalDate)} 早于患者入组日期 ${fmtDate(patient.enrollmentDate)}`,
          valueText: `${fmtDate(d.evalDate)} < ${fmtDate(patient.enrollmentDate)}` }))
      }
    }

    // R01 生理极限
    if (enabled('R01')) {
      Object.entries(PHYSIO_LIMITS).forEach(([field, lim]) => {
        const v = toNum(d[field])
        if (v !== null && (v < lim.min || v > lim.max)) {
          push(base('R01', { ...common, fieldName: field, fieldLabel: lim.label,
            description: `${lim.label} ${v} 超出生理极限范围（${lim.min}-${lim.max}），疑为录入错误`,
            valueText: `${v}` }))
        }
      })
    }

    // R02 合理范围
    if (enabled('R02')) {
      Object.entries(REASONABLE_LIMITS).forEach(([field, lim]) => {
        const v = toNum(d[field])
        if (v !== null && (v < lim.min || v > lim.max)) {
          push(base('R02', { ...common, fieldName: field, fieldLabel: lim.label,
            description: `${lim.label} ${v} 超出合理范围（${lim.min}-${lim.max}）`,
            valueText: `${v}` }))
        }
      })
    }
  })

  // ---------- S01 数值离群（IQR） ----------
  if (enabled('S01')) {
    // 按字段名收集全体数值
    const byField = new Map<string, { rec: VisitData; value: number }[]>()
    scopedData.forEach((rec) => {
      Object.entries(rec.data ?? {}).forEach(([k, v]) => {
        const n = toNum(v)
        if (n === null) return
        if (!byField.has(k)) byField.set(k, [])
        byField.get(k)!.push({ rec, value: n })
      })
    })
    byField.forEach((rows, field) => {
      if (rows.length < 8) return
      const sorted = rows.map((r) => r.value).sort((a, b) => a - b)
      const q1 = sorted[Math.floor(sorted.length * 0.25)]
      const q3 = sorted[Math.floor(sorted.length * 0.75)]
      const iqr = q3 - q1
      if (iqr === 0) return
      const lo = q1 - 1.5 * iqr
      const hi = q3 + 1.5 * iqr
      rows.forEach(({ rec, value }) => {
        if (value < lo || value > hi) {
          push(base('S01', {
            patientId: rec.patientId, projectId: rec.projectId, visitId: rec.visitId,
            moduleId: rec.moduleId, visitDataId: rec.id, fieldName: field,
            description: `字段「${field}」取值 ${value} 超出全体受试者四分位边界（${lo.toFixed(1)} ~ ${hi.toFixed(1)}），建议复核`,
            valueText: `${value}（边界 ${lo.toFixed(1)}~${hi.toFixed(1)}）`,
          }))
        }
      })
    })
  }

  // ---------- S02 直线录入 ----------
  if (enabled('S02')) {
    // 患者 × 字段 分组，跨访视值完全相同且 ≥3 条
    const byPF = new Map<string, { rec: VisitData; value: number }[]>()
    scopedData.forEach((rec) => {
      Object.entries(rec.data ?? {}).forEach(([k, v]) => {
        const n = toNum(v)
        if (n === null) return
        const key = `${rec.patientId}|${k}`
        if (!byPF.has(key)) byPF.set(key, [])
        byPF.get(key)!.push({ rec, value: n })
      })
    })
    byPF.forEach((rows, key) => {
      const visits = new Set(rows.map((r) => r.rec.visitId))
      if (visits.size < 3) return
      const same = rows.every((r) => r.value === rows[0].value)
      if (!same) return
      const [, field] = key.split('|')
      const rec = rows[0].rec
      push(base('S02', {
        patientId: rec.patientId, projectId: rec.projectId, visitDataId: rec.id, fieldName: field,
        description: `字段「${field}」在 ${visits.size} 次访视中取值完全相同（${rows[0].value}），疑为复制录入`,
        valueText: `${rows[0].value} × ${visits.size} 次访视`,
      }))
    })
  }

  // ---------- S03 尾数偏好（录入行为） ----------
  if (enabled('S03')) {
    const byUser = new Map<string, number[]>()
    scopedData.forEach((rec) => {
      const user = rec.createdBy
      if (!user) return
      Object.values(rec.data ?? {}).forEach((v) => {
        const n = toNum(v)
        if (n === null) return
        if (!byUser.has(user)) byUser.set(user, [])
        byUser.get(user)!.push(n)
      })
    })
    byUser.forEach((nums, user) => {
      if (nums.length < 8) return
      const round05 = nums.filter((n) => {
        const tail = Math.abs(Math.round(n * 10)) % 10
        return tail === 0 || tail === 5
      }).length
      const ratio = round05 / nums.length
      if (ratio >= 0.7) {
        const sample = scopedData.find((r) => r.createdBy === user)!
        push(base('S03', {
          patientId: '', projectId: sample.projectId,
          description: `录入人（${user}）填写的 ${nums.length} 个数值中 ${round05} 个尾数为 0/5（占比 ${Math.round(ratio * 100)}%），疑为估读录入`,
          valueText: `尾数 0/5 占比 ${Math.round(ratio * 100)}%`,
        }))
      }
    })
  }

  // ---------- S04 中心不良事件报告率偏低 ----------
  if (enabled('S04')) {
    const centerOf = (p: Patient) => p.centerId || '未分配中心'
    const centerPatient = new Map<string, number>()
    const centerAE = new Map<string, number>()
    scopedPatients.forEach((p) => {
      const c = centerOf(p)
      centerPatient.set(c, (centerPatient.get(c) ?? 0) + 1)
    })
    scopedData.forEach((rec) => {
      const rows = rec.data?.aeRecords
      if (!Array.isArray(rows) || rows.length === 0) return
      const c = centerOf(patientById.get(rec.patientId)!)
      centerAE.set(c, (centerAE.get(c) ?? 0) + rows.length)
    })
    if (centerPatient.size > 1) {
      const rates = [...centerPatient.entries()].map(([c, n]) => ({ c, rate: (centerAE.get(c) ?? 0) / n }))
      const maxRate = Math.max(...rates.map((r) => r.rate))
      rates.forEach(({ c, rate }) => {
        if (rate === 0 && maxRate >= 0.3) {
          const sample = scopedPatients.find((p) => centerOf(p) === c)!
          push(base('S04', {
            patientId: '', projectId: sample.projectId,
            description: `中心「${c}」共 ${centerPatient.get(c)} 例受试者，无一条不良事件记录；其他中心人均最高 ${maxRate.toFixed(1)} 条，疑为漏报`,
            valueText: `0 条 / ${centerPatient.get(c)} 例`,
          }))
        }
      })
    }
  }

  // 排序：严重程度 > 类别
  const sevOrder: Record<CheckSeverity, number> = { high: 0, medium: 1, low: 2 }
  return issues.sort((a, b) => sevOrder[a.severity] - sevOrder[b.severity])
}
