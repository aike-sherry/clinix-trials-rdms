import type { ModuleLibraryItem, Project } from '@/types'

/**
 * CRF 组装智能体（演示版·规则模拟）：
 * 把「哪次访视挂哪些模块」的自然语言描述解析成挂载计划：
 * 1) 访视匹配：支持访视编码（V0/V1…，带数字边界防 V1 误中 V10）、访视全名、名称关键词（筛选/基线/随访…）；
 * 2) 模块匹配：先查项目内已有模块，再查模块库（标记"从库导入"），都不存在则列入缺失清单；
 * 3) 支持「每次访视/全部访视」一键挂载到所有访视；已挂载的模块自动跳过。
 * 接入真实大模型后只需替换 generateCRFPlan 的解析实现，预览-确认-应用链路不变。
 */

export interface PlanModule {
  /** 用户写的名称（缺失时）或匹配到的正式名称 */
  name: string
  source: 'project' | 'library' | 'missing'
  /** project → CRFModule.id；library → ModuleLibraryItem.id */
  refId?: string
  /** 该访视下已挂载，跳过（挂载模式） */
  already?: boolean
  /** 该访视下未挂载，无需移除（移除模式） */
  notMounted?: boolean
}

export interface PlanVisit {
  visitId: string
  visitName: string
  modules: PlanModule[]
}

export interface CRFPlan {
  /** mount=挂载；remove=从访视中移除（模块保留在研究中） */
  mode: 'mount' | 'remove'
  items: PlanVisit[]
  missingModules: string[]
  /** 文本中提到但未匹配到的访视线索 */
  missingVisits: string[]
}

export interface CRFAgentReply {
  text: string
  plan?: CRFPlan
}

const ALL_VISITS_RE = /每次访视|每个访视|全部访视|所有访视|各访视|每一访视/
const REMOVE_RE = /去掉|移除|删除|取消挂载|不挂|不需要/

/** 从访视名中提取可匹配的关键词部分：去掉编码前缀与"访视"后缀 */
function visitNamePart(name: string): string {
  return name.replace(/^v\d+\s*[-–—]?\s*/i, '').replace(/访视$/, '').trim()
}

/** 在单个分句中匹配项目访视 */
function matchVisitsInClause(clause: string, project: Project) {
  const c = clause.toLowerCase()
  return project.visits.filter((v) => {
    // 编码匹配需带数字边界，避免 V1 误中 V10
    if (new RegExp(`${v.code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![0-9])`, 'i').test(clause)) return true
    if (c.includes(v.name.toLowerCase())) return true
    const part = visitNamePart(v.name)
    return part.length >= 2 && c.includes(part.toLowerCase())
  })
}

/** 模块匹配：项目内已有 → 模块库 → 缺失 */
function matchModule(
  token: string,
  project: Project,
  library: ModuleLibraryItem[],
): PlanModule | null {
  const t = token.trim()
  if (t.length < 2) return null
  const inProj =
    project.crfModules.find((m) => m.name === t) ??
    project.crfModules.find((m) => m.name.includes(t) || t.includes(m.name))
  if (inProj) return { name: inProj.name, source: 'project', refId: inProj.id }
  const inLib =
    library.find((m) => m.name === t) ??
    library.find((m) => m.name.includes(t) || t.includes(m.name))
  if (inLib) return { name: inLib.name, source: 'library', refId: inLib.id }
  return { name: t, source: 'missing' }
}

/** 从分句中剥离访视引用与动词，剩余部分切分为模块名 token */
function extractModuleTokens(clause: string, project: Project, allVisits: boolean): string {
  let rest = clause
  if (allVisits) rest = rest.replace(ALL_VISITS_RE, '|')
  // 去掉匹配到的访视名称/编码/关键词部分
  for (const v of project.visits) {
    rest = rest.replace(new RegExp(v.code, 'gi'), '|')
    rest = rest.split(v.name).join('|')
    const part = visitNamePart(v.name)
    if (part.length >= 2) rest = rest.split(part).join('|')
  }
  // 去掉连接动词与虚词（长词优先；含移除类动词）
  rest = rest.replace(
    /(每一次|每次|每个|全部|所有|访视|期间|取消挂载|挂载到|挂载|挂到|不挂|不需要|去掉|移除|删除|取消|挂|配置到|配置|放入|放|加入|加|执行|安排|需要|把|的|模块|都|：|:)/g,
    '|',
  )
  return rest
}

export function generateCRFPlan(
  text: string,
  project: Project,
  library: ModuleLibraryItem[],
): CRFAgentReply {
  if (project.visits.length === 0) {
    return {
      text: '当前研究还没有任何访视，请先在左侧「访视结构」中创建访视（如 V0-筛选、V1-基线……），再告诉我每次访视要挂哪些模块。',
    }
  }

  const allVisits = ALL_VISITS_RE.test(text)
  const isRemove = REMOVE_RE.test(text)
  const clauses = text.split(/[；;。\n]+/).map((s) => s.trim()).filter(Boolean)

  const items: PlanVisit[] = []
  const missingModules = new Set<string>()
  const missingVisits = new Set<string>()
  /** visitId → 计划项（跨分句合并） */
  const itemMap = new Map<string, PlanVisit>()

  for (const clause of clauses) {
    let targets = matchVisitsInClause(clause, project)
    if (targets.length === 0 && allVisits) targets = [...project.visits]
    if (targets.length === 0) {
      // 分句里似乎提到了访视但匹配不上 → 记入未识别
      const hint = clause.match(/v\d+/i)?.[0] ?? clause.match(/[\u4e00-\u9fa5]{2,6}(?:期|访视)/)?.[0]
      if (hint) missingVisits.add(hint)
      continue
    }

    const rest = extractModuleTokens(clause, project, allVisits)
    const tokens = rest
      .split(/[|、，,]|和|以及/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 2)
    if (tokens.length === 0) continue

    for (const visit of targets) {
      let item = itemMap.get(visit.id)
      if (!item) {
        item = { visitId: visit.id, visitName: visit.name, modules: [] }
        itemMap.set(visit.id, item)
      }
      for (const tk of tokens) {
        if (isRemove) {
          // 移除模式：只匹配项目内模块；未挂载的标记 notMounted（跳过）
          const inProj =
            project.crfModules.find((m) => m.name === tk) ??
            project.crfModules.find((m) => m.name.includes(tk) || tk.includes(m.name))
          if (!inProj) {
            if (!item.modules.some((x) => x.name === tk)) item.modules.push({ name: tk, source: 'missing', notMounted: true })
            continue
          }
          const mounted = visit.crfModuleIds.includes(inProj.id)
          if (!item.modules.some((x) => x.refId === inProj.id))
            item.modules.push({ name: inProj.name, source: 'project', refId: inProj.id, notMounted: !mounted })
          continue
        }
        const m = matchModule(tk, project, library)
        if (!m) continue
        if (m.source === 'missing') {
          missingModules.add(m.name)
          continue
        }
        // 已挂载标记
        if (m.source === 'project' && visit.crfModuleIds.includes(m.refId!)) m.already = true
        // 同一次访视内去重
        if (!item.modules.some((x) => x.refId === m.refId)) item.modules.push(m)
      }
    }
  }

  items.push(...itemMap.values())

  if (items.length === 0) {
    return {
      text: '我还没解析出可执行的计划。可以这样告诉我：\n· 「筛选期挂知情同意、人口学特征」\n· 「V1 挂生命体征、实验室检查；V2 挂生命体征」\n· 「每次访视都挂生命体征」\n· 「V2 去掉心电图检查」（从访视中移除）\n我会自动匹配访视与模块（库里有而项目里没有的模块会自动导入），生成计划供您确认。',
      plan: missingVisits.size
        ? { mode: isRemove ? 'remove' : 'mount', items: [], missingModules: [], missingVisits: [...missingVisits] }
        : undefined,
    }
  }

  if (isRemove) {
    const rmCount = items.flatMap((i) => i.modules).filter((m) => !m.notMounted && m.source !== 'missing').length
    const parts = items.map((i) => {
      const n = i.modules.filter((m) => !m.notMounted && m.source !== 'missing').length
      return `「${i.visitName}」移除 ${n} 个`
    })
    let text2 = `已生成移除计划：${parts.join('，')}。模块本身保留在研究中，仅从对应访视中移除。`
    if (rmCount === 0) text2 = '这些模块在对应访视中均未挂载，无需移除（计划中已灰色标出）。'
    if (missingVisits.size > 0) text2 += `另外，${[...missingVisits].join('、')} 未匹配到访视，已跳过。`
    if (rmCount > 0) text2 += '请核对下方计划，确认后我将一键移除。'
    return {
      text: text2,
      plan: { mode: 'remove', items, missingModules: [], missingVisits: [...missingVisits] },
    }
  }

  const libCount = items.flatMap((i) => i.modules).filter((m) => m.source === 'library').length
  const parts = items.map((i) => {
    const news = i.modules.filter((m) => !m.already).length
    return `「${i.visitName}」新增 ${news} 个`
  })
  let text2 = `已生成挂载计划：${parts.join('，')}。`
  if (libCount > 0) text2 += `其中 ${libCount} 个模块将从模块库自动导入到本研究。`
  if (missingModules.size > 0) text2 += `注意：${[...missingModules].join('、')} 在模块库中不存在，已列入下方缺失清单，可先在模块管理中创建（或直接告诉模块设计助手）。`
  if (missingVisits.size > 0) text2 += `另外，${[...missingVisits].join('、')} 未匹配到访视，已跳过。`
  text2 += '请核对下方计划，确认后我将一键应用。'

  return {
    text: text2,
    plan: { mode: 'mount', items, missingModules: [...missingModules], missingVisits: [...missingVisits] },
  }
}
