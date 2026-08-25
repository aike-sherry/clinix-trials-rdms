import type { ConfigPackage, Project } from '@/types'

// ============================================================
// CRF 配置包共用工具（配置发布 / 项目 CRF 页发布留痕共用）
// 配置包仅含 CRF 结构（访视/模块/字段），不含任何患者数据
// ============================================================

export const PKG_TYPE = 'clini-x-crf-config-package'

export interface PackagePayload {
  type: typeof PKG_TYPE
  packageVersion: string
  exportedAt: string
  exportedBy: string
  checksum: string
  project: {
    projectNo: string
    name: string
    sponsor?: string
    principalInvestigator?: string
    researchCenter?: string
    department?: string
  }
  visits: Project['visits']
  crfModules: Project['crfModules']
}

export function nowIso() {
  return new Date().toISOString()
}

/** 稳定序列化（忽略 updatedAt 等易变字段），用于校验码与差异比对 */
export function stableStringify(v: unknown): string {
  return JSON.stringify(v, (key, value) => {
    if (key === 'updatedAt' || key === 'createdAt') return undefined
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return Object.keys(value as Record<string, unknown>)
        .sort()
        .reduce((acc: Record<string, unknown>, k) => {
          acc[k] = (value as Record<string, unknown>)[k]
          return acc
        }, {})
    }
    return value
  })
}

/** FNV-1a 简易哈希，生成配置校验码 */
export function checksumOf(payload: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < payload.length; i++) {
    h ^= payload.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, '0').toUpperCase()
}

export function countFields(p: Pick<Project, 'crfModules'>) {
  return p.crfModules.reduce((s, m) => s + m.fields.length, 0)
}

/** 建议的下一版本号：按该项目历史记录数递增（v1.0、v1.1…） */
export function suggestVersion(records: Pick<ConfigPackage, 'projectId'>[], projectId: string) {
  const n = records.filter((r) => r.projectId === projectId).length
  return `v1.${n}`
}

/** 组装配置包内容（导出 / 发布留痕共用） */
export function buildPayload(p: Project, version: string, operator: string): PackagePayload {
  const core = { visits: p.visits, crfModules: p.crfModules }
  return {
    type: PKG_TYPE,
    packageVersion: version,
    exportedAt: nowIso(),
    exportedBy: operator,
    checksum: checksumOf(stableStringify(core)),
    project: {
      projectNo: p.projectNo,
      name: p.name,
      sponsor: p.sponsor,
      principalInvestigator: p.principalInvestigator,
      researchCenter: p.researchCenter,
      department: p.department,
    },
    visits: p.visits,
    crfModules: p.crfModules,
  }
}

/** 组装版本留痕记录 */
export function buildRecord(
  p: Project,
  payload: PackagePayload,
  mode: ConfigPackage['mode'],
  operator: string,
  note?: string,
): ConfigPackage {
  return {
    id: Math.random().toString(36).slice(2) + Date.now().toString(36),
    projectId: p.id,
    projectNo: p.projectNo,
    projectName: p.name,
    version: payload.packageVersion,
    mode,
    checksum: payload.checksum,
    visitCount: p.visits.length,
    moduleCount: p.crfModules.length,
    fieldCount: countFields(p),
    note: note?.trim() || undefined,
    createdBy: operator,
    createdAt: nowIso(),
  }
}
