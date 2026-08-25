import { useMemo, useRef, useState } from 'react'
import { useAppStorage } from '@/hooks/useAppStorage'
import type { ConfigPackage, Project } from '@/types'
import StatCard from '@/components/StatCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Rocket, Globe, Building2, Download, Upload, FileJson, History,
  ShieldCheck, Package, CalendarRange, Layers, Hash, Plus, Minus, RefreshCw,
} from 'lucide-react'

// ============================================================
// 配置发布（配置中心 · 演示版）
// 双模式交付：
//  - 公网客户：CRF 配置一键发布（演示环境以「导出配置包」留痕）
//  - 内网客户：导出配置包 → 医院内网系统导入 → 差异预览 → 生效
// 配置包仅含 CRF 结构（访视/模块/字段），不含任何患者数据
// ============================================================

const PKG_TYPE = 'clini-x-crf-config-package'

interface PackagePayload {
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

function genId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}
function now() {
  return new Date().toISOString()
}

/** 稳定序列化（忽略 updatedAt 等易变字段），用于校验码与差异比对 */
function stableStringify(v: unknown): string {
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
function checksumOf(payload: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < payload.length; i++) {
    h ^= payload.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, '0').toUpperCase()
}

function countFields(p: Pick<Project, 'crfModules'>) {
  return p.crfModules.reduce((s, m) => s + m.fields.length, 0)
}

/** 配置差异（导入预览用） */
interface PkgDiff {
  visitsAdded: string[]
  visitsRemoved: string[]
  modulesAdded: string[]
  modulesRemoved: string[]
  modulesChanged: string[]
}

function diffPackage(current: Project | undefined, pkg: PackagePayload): PkgDiff {
  const curVisits = new Set((current?.visits ?? []).map((v) => v.name))
  const pkgVisits = new Set(pkg.visits.map((v) => v.name))
  const curMods = new Map((current?.crfModules ?? []).map((m) => [m.name, m]))
  const pkgMods = new Map(pkg.crfModules.map((m) => [m.name, m]))
  return {
    visitsAdded: pkg.visits.filter((v) => !curVisits.has(v.name)).map((v) => v.name),
    visitsRemoved: (current?.visits ?? []).filter((v) => !pkgVisits.has(v.name)).map((v) => v.name),
    modulesAdded: pkg.crfModules.filter((m) => !curMods.has(m.name)).map((m) => m.name),
    modulesRemoved: (current?.crfModules ?? []).filter((m) => !pkgMods.has(m.name)).map((m) => m.name),
    modulesChanged: pkg.crfModules
      .filter((m) => curMods.has(m.name) && stableStringify(curMods.get(m.name)!) !== stableStringify(m))
      .map((m) => m.name),
  }
}

type TabKey = 'export' | 'import' | 'records'
const TABS: { key: TabKey; label: string; icon: typeof Rocket }[] = [
  { key: 'export', label: '发布管理', icon: Rocket },
  { key: 'import', label: '导入部署（内网）', icon: Upload },
  { key: 'records', label: '版本记录', icon: History },
]

export default function ConfigPublish() {
  const { projects, patients, configPackages, saveProject, saveConfigPackage, currentUser } = useAppStorage()
  const operator = currentUser?.name ?? '后台管理员'

  const [tab, setTab] = useState<TabKey>('export')

  // ========== 发布 / 导出 ==========
  const [exportProject, setExportProject] = useState<Project | null>(null)
  const [dialogMode, setDialogMode] = useState<'publish' | 'export'>('publish')
  const [exportVersion, setExportVersion] = useState('')
  const [exportNote, setExportNote] = useState('')

  // ========== 导入 ==========
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importPayload, setImportPayload] = useState<PackagePayload | null>(null)
  const [importError, setImportError] = useState('')

  const records = useMemo(
    () => [...(configPackages ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [configPackages]
  )
  const publishCount = records.filter((r) => r.mode === 'publish').length
  const exportCount = records.filter((r) => r.mode === 'export').length
  const importCount = records.filter((r) => r.mode === 'import').length

  /** 项目最新版本号（导出/导入记录中的最大值） */
  const latestVersion = (projectId: string) => {
    const list = records.filter((r) => r.projectId === projectId)
    return list.length > 0 ? list[0].version : '-'
  }
  /** 建议的下一版本号 */
  const suggestVersion = (projectId: string) => {
    const n = records.filter((r) => r.projectId === projectId).length
    return `v1.${n}`
  }

  // ========== 发布 / 导出逻辑 ==========
  const openDialog = (p: Project, mode: 'publish' | 'export') => {
    setDialogMode(mode)
    setExportProject(p)
    setExportVersion(suggestVersion(p.id))
    setExportNote('')
  }

  const buildPayload = (p: Project, version: string): PackagePayload => {
    const core = { visits: p.visits, crfModules: p.crfModules }
    return {
      type: PKG_TYPE,
      packageVersion: version,
      exportedAt: now(),
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

  const confirmExport = () => {
    if (!exportProject || !exportVersion.trim()) return
    const payload = buildPayload(exportProject, exportVersion.trim())
    if (dialogMode === 'export') {
      // 内网交付：下载配置文件
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `CRF配置包_${exportProject.projectNo}_${payload.packageVersion}.json`
      a.click()
      URL.revokeObjectURL(url)
    } else {
      // 公网一键发布：直接生效（标记 CRF 已发布）
      saveProject({
        ...exportProject,
        crfPublished: true,
        crfPublishedAt: exportProject.crfPublishedAt ?? now(),
        updatedAt: now(),
      })
    }
    // 留痕
    const rec: ConfigPackage = {
      id: genId(),
      projectId: exportProject.id,
      projectNo: exportProject.projectNo,
      projectName: exportProject.name,
      version: payload.packageVersion,
      mode: dialogMode,
      checksum: payload.checksum,
      visitCount: exportProject.visits.length,
      moduleCount: exportProject.crfModules.length,
      fieldCount: countFields(exportProject),
      note: exportNote.trim() || undefined,
      createdBy: operator,
      createdAt: now(),
    }
    saveConfigPackage(rec)
    setExportProject(null)
  }

  // ========== 导入逻辑 ==========
  const handleFile = (file: File) => {
    setImportError('')
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as PackagePayload
        if (parsed.type !== PKG_TYPE || !parsed.project?.projectNo || !Array.isArray(parsed.crfModules)) {
          setImportError('文件格式不正确：请选择本系统导出的 CRF 配置包（.json）')
          return
        }
        // 校验码核对（防篡改提示）
        const expect = checksumOf(stableStringify({ visits: parsed.visits, crfModules: parsed.crfModules }))
        if (parsed.checksum && parsed.checksum !== expect) {
          setImportError(`校验码不一致（文件 ${parsed.checksum} / 计算 ${expect}），配置包可能被修改过，请重新导出`)
          return
        }
        setImportPayload(parsed)
      } catch {
        setImportError('文件解析失败：不是有效的 JSON 文件')
      }
    }
    reader.readAsText(file)
  }

  const importTarget = useMemo(
    () => (importPayload ? projects.find((p) => p.projectNo === importPayload.project.projectNo) : undefined),
    [importPayload, projects]
  )
  const importDiff = useMemo(
    () => (importPayload ? diffPackage(importTarget, importPayload) : null),
    [importPayload, importTarget]
  )
  const importPatientCount = useMemo(
    () => (importTarget ? patients.filter((p) => p.projectId === importTarget.id).length : 0),
    [importTarget, patients]
  )

  const confirmImport = () => {
    if (!importPayload) return
    let projectId: string
    if (importTarget) {
      // 已有项目：仅更新 CRF 结构（访视 + 模块），不动患者数据
      saveProject({
        ...importTarget,
        visits: importPayload.visits,
        crfModules: importPayload.crfModules,
        updatedAt: now(),
      })
      projectId = importTarget.id
    } else {
      // 新项目：按配置包创建项目骨架
      const p: Project = {
        id: genId(),
        projectNo: importPayload.project.projectNo,
        name: importPayload.project.name,
        sponsor: importPayload.project.sponsor,
        principalInvestigator: importPayload.project.principalInvestigator ?? '-',
        researchCenter: importPayload.project.researchCenter ?? '-',
        department: importPayload.project.department,
        status: 'study_started',
        visits: importPayload.visits,
        crfModules: importPayload.crfModules,
        crfPublished: true,
        crfPublishedAt: now(),
        createdAt: now(),
        updatedAt: now(),
      }
      saveProject(p)
      projectId = p.id
    }
    const rec: ConfigPackage = {
      id: genId(),
      projectId,
      projectNo: importPayload.project.projectNo,
      projectName: importPayload.project.name,
      version: importPayload.packageVersion,
      mode: 'import',
      checksum: importPayload.checksum,
      visitCount: importPayload.visits.length,
      moduleCount: importPayload.crfModules.length,
      fieldCount: countFields(importPayload),
      note: importTarget ? '内网导入：更新现有项目 CRF 结构' : '内网导入：按配置包创建新项目',
      createdBy: operator,
      createdAt: now(),
    }
    saveConfigPackage(rec)
    setImportPayload(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const diffEmpty =
    importDiff &&
    importDiff.visitsAdded.length === 0 &&
    importDiff.visitsRemoved.length === 0 &&
    importDiff.modulesAdded.length === 0 &&
    importDiff.modulesRemoved.length === 0 &&
    importDiff.modulesChanged.length === 0

  return (
    <div className="space-y-5">
      {/* 双模式说明 */}
      <Card className="bg-gradient-to-r from-teal-50/80 via-white to-white border-teal-100">
        <CardContent className="p-4 flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center shrink-0 shadow-md">
            <Rocket className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-sm font-semibold text-slate-800">配置中心 · 一套后台，两种交付</h2>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              CRF 配置（访视 / 模块 / 字段）在这里统一设计，配置包仅含结构、不含任何患者数据：
            </p>
            <div className="flex items-center gap-6 mt-2.5">
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <Globe className="w-3.5 h-3.5 text-sky-500" />
                <span><span className="font-medium">公网 / 多中心研究</span>：一键发布，云端直接生效</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <Building2 className="w-3.5 h-3.5 text-teal-600" />
                <span><span className="font-medium">医院内网部署</span>：导出配置包 → 内网导入 → 差异预览后生效</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-teal-600 bg-teal-50 border border-teal-100 rounded-full px-2.5 py-1 shrink-0">
            <ShieldCheck className="w-3.5 h-3.5" /> 配置不含患者数据
          </div>
        </CardContent>
      </Card>

      {/* 统计卡 */}
      <div className="grid grid-cols-5 gap-4">
        <StatCard label="配置项目" value={projects.length} unit="个" sub="当前在管研究" icon={Package} gradient="from-blue-500 to-blue-600" />
        <StatCard label="一键发布" value={publishCount} unit="次" sub="公网环境直接生效" icon={Rocket} gradient="from-sky-500 to-blue-600" />
        <StatCard label="配置包导出" value={exportCount} unit="次" sub="内网交付 / 配置备份" icon={Download} gradient="from-teal-500 to-emerald-600" />
        <StatCard label="配置包导入" value={importCount} unit="次" sub="内网环境配置包导入" icon={Upload} gradient="from-violet-500 to-purple-600" />
        <StatCard label="版本记录" value={records.length} unit="条" sub={records.length > 0 ? `最近：${records[0].projectNo} ${records[0].version}` : '暂无发布记录'} icon={History} gradient="from-amber-500 to-orange-500" />
      </div>

      {/* 页签 */}
      <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1 w-fit">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-medium transition-colors ${
              tab === t.key ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <t.icon className="w-3.5 h-3.5" /> {t.label}
          </button>
        ))}
      </div>

      {/* ==================== 导出发布 ==================== */}
      {tab === 'export' && (
        <Card className="bg-white">
          <CardContent className="p-0">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <p className="text-sm font-medium text-slate-700">选择项目：公网环境「一键发布」直接生效，内网部署「导出配置包」线下交付</p>
              <span className="text-[11px] text-slate-400">配置包 = 项目信息 + 访视 + 模块字段 + 校验码</span>
            </div>
            <div className="divide-y divide-slate-100">
              {projects.map((p) => {
                const version = latestVersion(p.id)
                return (
                  <div key={p.id} className="flex items-center gap-4 px-4 py-3 hover:bg-slate-50/60">
                    <div className="w-9 h-9 rounded-lg bg-teal-50 flex items-center justify-center shrink-0">
                      <FileJson className="w-4 h-4 text-teal-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-800 truncate">{p.name}</span>
                        <Badge variant="outline" className="text-[10px] h-4 px-1.5 font-mono shrink-0">{p.projectNo}</Badge>
                        {p.crfPublished ? (
                          <Badge variant="outline" className="text-[10px] h-4 px-1.5 bg-emerald-50 text-emerald-600 border-emerald-200 shrink-0">已发布</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] h-4 px-1.5 bg-amber-50 text-amber-600 border-amber-200 shrink-0">设计中</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-400">
                        <span className="flex items-center gap-1"><CalendarRange className="w-3 h-3" />{p.visits.length} 次访视</span>
                        <span className="flex items-center gap-1"><Layers className="w-3 h-3" />{p.crfModules.length} 个模块</span>
                        <span className="flex items-center gap-1"><Hash className="w-3 h-3" />{countFields(p)} 个字段</span>
                        <span>最新版本：<span className="text-slate-600 font-medium">{version}</span></span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="sm"
                        className="h-8 text-xs bg-sky-500 hover:bg-sky-600"
                        onClick={() => openDialog(p, 'publish')}
                      >
                        <Rocket className="w-3.5 h-3.5 mr-1" /> 一键发布
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs text-teal-600 border-teal-200 hover:bg-teal-50"
                        onClick={() => openDialog(p, 'export')}
                      >
                        <Download className="w-3.5 h-3.5 mr-1" /> 导出配置包
                      </Button>
                    </div>
                  </div>
                )
              })}
              {projects.length === 0 && (
                <div className="py-14 text-center text-sm text-slate-400">暂无项目，请先在项目管理中创建</div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ==================== 导入部署 ==================== */}
      {tab === 'import' && (
        <Card className="bg-white">
          <CardContent className="p-6">
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) handleFile(f)
              }}
            />
            <div
              className="border-2 border-dashed border-slate-200 rounded-xl py-12 flex flex-col items-center justify-center hover:border-teal-300 hover:bg-teal-50/30 transition-colors cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="w-12 h-12 rounded-xl bg-teal-50 flex items-center justify-center mb-3">
                <Upload className="w-6 h-6 text-teal-600" />
              </div>
              <p className="text-sm font-medium text-slate-700">点击选择 CRF 配置包（.json）</p>
              <p className="text-xs text-slate-400 mt-1.5">模拟医院内网环境导入：校验 → 差异预览 → 确认生效</p>
            </div>
            {importError && (
              <div className="mt-3 text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{importError}</div>
            )}
            <div className="mt-4 text-[11px] text-slate-400 leading-relaxed bg-slate-50 rounded-lg px-3 py-2.5">
              导入规则：按「研究编号」匹配项目——已存在则仅更新 CRF 结构（不影响已录入的患者数据）；不存在则按配置包创建新项目。文件校验码不一致会被拒绝导入。
            </div>
          </CardContent>
        </Card>
      )}

      {/* ==================== 版本记录 ==================== */}
      {tab === 'records' && (
        <Card className="bg-white">
          <CardContent className="p-0">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <p className="text-sm font-medium text-slate-700">配置包版本记录</p>
              <span className="text-[11px] text-slate-400">每次发布 / 导出 / 导入自动留痕，可回溯校验码</span>
            </div>
            {records.length === 0 ? (
              <div className="py-14 text-center">
                <History className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                <p className="text-sm text-slate-400">暂无版本记录，发布、导出或导入配置后在此展示</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {records.map((r) => (
                  <div key={r.id} className="flex items-center gap-4 px-4 py-3 hover:bg-slate-50/60">
                    <Badge
                      variant="outline"
                      className={`text-[10px] h-5 px-1.5 shrink-0 ${
                        r.mode === 'publish'
                          ? 'bg-sky-50 text-sky-600 border-sky-200'
                          : r.mode === 'export'
                            ? 'bg-teal-50 text-teal-600 border-teal-200'
                            : 'bg-violet-50 text-violet-600 border-violet-200'
                      }`}
                    >
                      {r.mode === 'publish' ? '发布' : r.mode === 'export' ? '导出' : '导入'}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-800 truncate">{r.projectName}</span>
                        <span className="text-xs font-mono text-slate-500 shrink-0">{r.projectNo}</span>
                        <Badge variant="secondary" className="text-[10px] h-4 px-1.5 shrink-0">{r.version}</Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-400">
                        <span>{r.visitCount} 访视</span>
                        <span>{r.moduleCount} 模块</span>
                        <span>{r.fieldCount} 字段</span>
                        <span>校验码 <span className="font-mono text-slate-500">{r.checksum}</span></span>
                        {r.note && <span className="truncate">· {r.note}</span>}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs text-slate-600">{r.createdBy}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">{new Date(r.createdAt).toLocaleString('zh-CN')}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ==================== 发布 / 导出确认弹窗 ==================== */}
      <Dialog open={!!exportProject} onOpenChange={(open) => !open && setExportProject(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{dialogMode === 'publish' ? '一键发布 CRF 配置' : '导出 CRF 配置包（内网交付）'}</DialogTitle>
          </DialogHeader>
          {exportProject && (
            <div className="space-y-4 py-2">
              <div className="bg-slate-50 rounded-lg px-3 py-2.5 text-xs text-slate-600 space-y-1">
                <div><span className="text-slate-400">研究：</span>{exportProject.name}（{exportProject.projectNo}）</div>
                <div>
                  <span className="text-slate-400">内容：</span>
                  {exportProject.visits.length} 次访视 · {exportProject.crfModules.length} 个模块 · {countFields(exportProject)} 个字段
                </div>
              </div>
              <div className={`text-xs rounded-lg px-3 py-2 border ${
                dialogMode === 'publish'
                  ? 'bg-sky-50 text-sky-700 border-sky-100'
                  : 'bg-teal-50 text-teal-700 border-teal-100'
              }`}>
                {dialogMode === 'publish'
                  ? '公网部署模式：发布后 CRF 配置直接在云端生效，无需下载文件，管理端与录入端即时可用'
                  : '内网部署模式：导出 .json 配置包后，由实施人员带至医院内网环境，在「导入部署」页签导入生效'}
              </div>
              <div>
                <Label className="text-sm">版本号 <span className="text-red-500">*</span></Label>
                <Input value={exportVersion} onChange={(e) => setExportVersion(e.target.value)} placeholder="如 v1.0" />
                <p className="text-[11px] text-slate-400 mt-1">按该项目历史记录自动建议，可修改（如 v1.1、v2.0）</p>
              </div>
              <div>
                <Label className="text-sm">备注</Label>
                <Textarea
                  rows={2}
                  value={exportNote}
                  onChange={(e) => setExportNote(e.target.value)}
                  placeholder="如：伦理批件后首次发布 / 修订既往病史模块"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setExportProject(null)}>取消</Button>
            {dialogMode === 'publish' ? (
              <Button className="bg-sky-500 hover:bg-sky-600" disabled={!exportVersion.trim()} onClick={confirmExport}>
                <Rocket className="w-3.5 h-3.5 mr-1" /> 确认发布
              </Button>
            ) : (
              <Button className="bg-teal-500 hover:bg-teal-600" disabled={!exportVersion.trim()} onClick={confirmExport}>
                <Download className="w-3.5 h-3.5 mr-1" /> 导出并留痕
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================== 导入差异预览弹窗 ==================== */}
      <Dialog open={!!importPayload} onOpenChange={(open) => !open && setImportPayload(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>导入配置包 · 差异预览</DialogTitle>
          </DialogHeader>
          {importPayload && importDiff && (
            <div className="space-y-4 py-2">
              <div className="bg-slate-50 rounded-lg px-3 py-2.5 text-xs text-slate-600 space-y-1">
                <div><span className="text-slate-400">配置包：</span>{importPayload.project.name}（{importPayload.project.projectNo}）<Badge variant="secondary" className="text-[10px] h-4 px-1.5 ml-1.5">{importPayload.packageVersion}</Badge></div>
                <div>
                  <span className="text-slate-400">内容：</span>
                  {importPayload.visits.length} 次访视 · {importPayload.crfModules.length} 个模块 · {countFields(importPayload)} 个字段
                  <span className="ml-2 text-slate-400">校验码</span> <span className="font-mono">{importPayload.checksum}</span>
                </div>
                <div><span className="text-slate-400">导出来源：</span>{importPayload.exportedBy} · {new Date(importPayload.exportedAt).toLocaleString('zh-CN')}</div>
              </div>

              {importTarget ? (
                <div className="text-xs rounded-lg px-3 py-2 bg-sky-50 text-sky-700 border border-sky-100">
                  匹配到现有项目「{importTarget.name}」：将<span className="font-medium">仅更新 CRF 结构</span>，已录入的 {importPatientCount} 例患者数据不受影响
                </div>
              ) : (
                <div className="text-xs rounded-lg px-3 py-2 bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5" /> 未匹配到同编号项目：将按配置包<span className="font-medium">创建新项目</span>
                </div>
              )}

              {diffEmpty ? (
                <div className="text-xs text-slate-500 text-center py-3 bg-slate-50 rounded-lg">
                  配置内容与当前项目完全一致，无差异
                </div>
              ) : (
                <div className="space-y-2.5 text-xs">
                  {importDiff.visitsAdded.length > 0 && (
                    <DiffRow icon={<Plus className="w-3 h-3" />} tone="text-emerald-600 bg-emerald-50 border-emerald-100" label="新增访视" items={importDiff.visitsAdded} />
                  )}
                  {importDiff.visitsRemoved.length > 0 && (
                    <DiffRow icon={<Minus className="w-3 h-3" />} tone="text-red-600 bg-red-50 border-red-100" label="移除访视" items={importDiff.visitsRemoved} />
                  )}
                  {importDiff.modulesAdded.length > 0 && (
                    <DiffRow icon={<Plus className="w-3 h-3" />} tone="text-emerald-600 bg-emerald-50 border-emerald-100" label="新增模块" items={importDiff.modulesAdded} />
                  )}
                  {importDiff.modulesChanged.length > 0 && (
                    <DiffRow icon={<RefreshCw className="w-3 h-3" />} tone="text-amber-600 bg-amber-50 border-amber-100" label="变更模块" items={importDiff.modulesChanged} />
                  )}
                  {importDiff.modulesRemoved.length > 0 && (
                    <DiffRow icon={<Minus className="w-3 h-3" />} tone="text-red-600 bg-red-50 border-red-100" label="移除模块" items={importDiff.modulesRemoved} />
                  )}
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportPayload(null)}>取消</Button>
            <Button className="bg-teal-500 hover:bg-teal-600" onClick={confirmImport}>
              <Upload className="w-3.5 h-3.5 mr-1" /> 确认导入生效
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/** 差异行：新增 / 移除 / 变更 */
function DiffRow({ icon, tone, label, items }: { icon: React.ReactNode; tone: string; label: string; items: string[] }) {
  return (
    <div className={`rounded-lg border px-3 py-2 ${tone}`}>
      <div className="flex items-center gap-1.5 font-medium">
        {icon} {label}（{items.length}）
      </div>
      <div className="mt-1 opacity-80">{items.join('、')}</div>
    </div>
  )
}
