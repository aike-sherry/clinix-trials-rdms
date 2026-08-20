import type { Patient, Project } from '@/types'
import { PATIENT_STATUS_LABELS, analysisFields } from './shared'

// ==================== 文字查询 · 结构化语义解析 ====================
// 规则式解析：从项目 CRF 结构自动构建词典，贪心最长匹配。
// 识别结果以条件标签形式呈现，所见即所得；未识别片段标记为 unknown。

export interface ParsedCondition {
  id: string
  kind: 'module' | 'fieldOption' | 'visit' | 'center' | 'status' | 'patient' | 'unknown'
  label: string          // 条件标签显示文本
  raw: string            // 命中的原文片段
  moduleId?: string
  fieldName?: string
  optionValue?: string
  visitCode?: string
  centerId?: string
  patientStatus?: string
  patientId?: string
}

interface Candidate {
  text: string
  cond: Omit<ParsedCondition, 'id' | 'raw'>
}

// 无实际筛选意义的词：匹配剩余片段时直接丢弃
const STOPWORDS = new Set([
  '的', '和', '与', '及', '或', '患者', '病人', '受试者', '例', '所有', '全部',
  '查询', '统计', '一下', '想', '要', '想知道', '知道', '看看', '看一下', '我', '我们',
  '请', '帮我', '帮忙', '多少', '几个', '人数', '例数', '数量', '名单', '清单', '数据',
  '情况', '哪些', '什么', '有没有', '是否有', '中', '里', '内', '了', '呢', '吧', '吗',
])

const PUNCT = /[\s,，。.、;；:：!！?？()（）""'']+/g

// 中心别名：去掉城市前缀和医院/中心后缀，如 上海瑞金医院 → 瑞金 / 瑞金医院
function centerAliases(name: string): string[] {
  const aliases = new Set<string>([name])
  const noSuffix = name.replace(/(医院|医疗中心|研究中心)$/, '')
  if (noSuffix.length >= 2) aliases.add(noSuffix)
  const noCityFull = name.replace(/^(北京|上海|广州|深圳|天津|重庆|杭州|南京|武汉|成都|江苏|浙江|山东|四川|湖南|湖北|中国|中南大学|首都)/, '')
  if (noCityFull.length >= 2) aliases.add(noCityFull) // 保留“医院”后缀：中山医院
  const short = noCityFull.replace(/(大学附属|大学)/g, '').replace(/(医院|医疗中心|研究中心)$/, '')
  if (short.length >= 2) aliases.add(short)
  return [...aliases].filter((a) => a.length >= 2)
}

// 常见说法 → 患者状态
const STATUS_VARIANTS: Record<string, string> = {
  退出: 'withdrawn', 脱落: 'withdrawn', 剔除: 'withdrawn',
  入组: 'enrolled', 完成: 'completed', 筛选: 'screening',
}

function buildCandidates(project: Project, patients: Patient[]): Candidate[] {
  const list: Candidate[] = []
  const seen = new Set<string>()
  const push = (cand: Candidate) => {
    const key = `${cand.text}|${cand.cond.kind}|${cand.cond.moduleId ?? ''}|${cand.cond.fieldName ?? ''}|${cand.cond.optionValue ?? ''}`
    if (cand.text.length < 2 || seen.has(key)) return
    seen.add(key)
    list.push(cand)
  }

  // 模块名
  for (const m of project.crfModules) {
    push({ text: m.name, cond: { kind: 'module', label: `模块：${m.name}`, moduleId: m.id } })
  }

  // 字段选项（选项文本 → 该字段=该选项；同时隐含切入所属模块；含动态表格列）
  for (const m of project.crfModules) {
    for (const f of analysisFields(m)) {
      if ((f.type === 'select' || f.type === 'radio' || f.type === 'checkbox') && f.options) {
        for (const o of f.options) {
          push({
            text: o.label,
            cond: {
              kind: 'fieldOption', label: `${f.label}：${o.label}`,
              moduleId: m.id, fieldName: f.name, optionValue: o.value,
            },
          })
        }
      }
      // 同义词：字段名含「关系」（如 与试验药物关系）→ “药物相关”系列说法
      if (f.label.includes('关系') && f.options) {
        const related = f.options.find((o) => o.label === '有关' || o.label === '相关')
        const maybe = f.options.find((o) => o.label === '可能有关' || o.label === '可能相关')
        if (related) {
          for (const t of ['药物相关', '研究药物相关', '试验药物相关', '和药物相关', '和试验药物相关', '和研究药物相关']) {
            push({
              text: t,
              cond: {
                kind: 'fieldOption', label: `${f.label}：${related.label}`,
                moduleId: m.id, fieldName: f.name, optionValue: related.value,
              },
            })
          }
        }
        if (maybe) {
          for (const t of ['药物可能相关', '可能相关']) {
            push({
              text: t,
              cond: {
                kind: 'fieldOption', label: `${f.label}：${maybe.label}`,
                moduleId: m.id, fieldName: f.name, optionValue: maybe.value,
              },
            })
          }
        }
      }
    }
  }

  // 访视：编码 + 名称
  for (const v of project.visits) {
    push({ text: v.code, cond: { kind: 'visit', label: `访视：${v.code} ${v.name}`, visitCode: v.code } })
    push({ text: v.name, cond: { kind: 'visit', label: `访视：${v.code} ${v.name}`, visitCode: v.code } })
  }

  // 中心：全名 + 别名
  for (const c of project.centers ?? []) {
    for (const alias of centerAliases(c.name)) {
      push({ text: alias, cond: { kind: 'center', label: `中心：${c.name}`, centerId: c.id } })
    }
  }

  // 患者状态：标准标签 + 常见说法
  for (const [value, label] of Object.entries(PATIENT_STATUS_LABELS)) {
    push({ text: label, cond: { kind: 'status', label: `状态：${label}`, patientStatus: value } })
  }
  for (const [variant, value] of Object.entries(STATUS_VARIANTS)) {
    const label = PATIENT_STATUS_LABELS[value] ?? value
    push({ text: variant, cond: { kind: 'status', label: `状态：${label}`, patientStatus: value } })
  }

  // 患者：随机编号 / 筛选编号
  for (const p of patients.filter((x) => x.projectId === project.id)) {
    if (p.randomizationId) {
      push({ text: p.randomizationId, cond: { kind: 'patient', label: `患者：${p.randomizationId}`, patientId: p.id } })
    }
    push({ text: p.screeningId, cond: { kind: 'patient', label: `患者：筛选号 ${p.screeningId}`, patientId: p.id } })
  }

  return list
}

export function parseQueryText(text: string, project: Project, patients: Patient[]): ParsedCondition[] {
  const candidates = buildCandidates(project, patients)
  // 长文本优先，避免「可能有关」被「有关」抢先占用
  candidates.sort((a, b) => b.text.length - a.text.length)

  const lower = text.toLowerCase()
  const used = new Array<boolean>(text.length).fill(false)
  const found: ParsedCondition[] = []
  let seq = 0

  for (const cand of candidates) {
    const needle = cand.text.toLowerCase()
    let idx = lower.indexOf(needle)
    while (idx !== -1) {
      let free = true
      for (let k = idx; k < idx + needle.length; k++) {
        if (used[k]) { free = false; break }
      }
      if (free) {
        for (let k = idx; k < idx + needle.length; k++) used[k] = true
        found.push({ ...cand.cond, id: `pc_${seq++}`, raw: cand.text })
        break // 同一候选词只取一次
      }
      idx = lower.indexOf(needle, idx + 1)
    }
  }

  // 剩余片段：去掉停用词和标点后，长度 ≥2 的标记为未识别
  let seg: number[] = []
  const flush = () => {
    if (seg.length === 0) return
    const raw = text.slice(seg[0], seg[seg.length - 1] + 1).replace(PUNCT, ' ').trim()
    seg = []
    // 去掉“的”后再判断：的/患者/的患者 等残余视为无意义
    const norm = raw.replace(/的/g, '')
    if (raw.length < 2 || norm.length < 2 || STOPWORDS.has(raw) || STOPWORDS.has(norm)) return
    found.push({
      id: `pc_${seq++}`, kind: 'unknown',
      label: `未识别：${raw}`, raw,
    })
  }
  for (let i = 0; i < text.length; i++) {
    if (used[i]) flush()
    else seg.push(i)
  }
  flush()

  // 按原文出现顺序排列标签
  return found.sort((a, b) => text.indexOf(a.raw) - text.indexOf(b.raw))
}
