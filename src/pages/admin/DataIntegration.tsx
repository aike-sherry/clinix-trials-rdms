import { useEffect, useMemo, useState } from 'react'
import { useAppStorage } from '@/hooks/useAppStorage'
import type { Patient } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Database, Zap, Clock, History, Link2, X, CheckCircle2, CalendarClock,
  UserSearch, FileSearch, ChevronDown, ChevronRight, Sparkles, AlertCircle,
  PencilLine, Save,
} from 'lucide-react'

// ==================== 类型与持久化 ====================

interface FetchTask {
  id: string
  planTime: string
  scope: string
  patientCount: number
  status: 'scheduled' | 'cancelled' | 'done'
  createdAt: string
}

interface FetchRecord {
  id: string
  time: string
  mode: '手动抓取' | '定时抓取'
  scopeLabel: string
  fieldCount: number
  patientCount: number
  status: '成功' | '失败'
}

interface IntegrationCfg {
  enabled: boolean
  tasks: FetchTask[]
  records: FetchRecord[]
}

/** 智能填充预览：单字段结果 */
interface FillField {
  label: string
  value?: string
  source?: '检验系统' | '病历原文' | '护理记录' | '生命体征'
  missing?: boolean
}

interface FillPreview {
  patient: Patient
  fields: FillField[]
}

/** 患者匹配：匹配路径与号码 */
type MatchType = 'idcard' | 'outpatient' | 'inpatient'
interface MatchInfo {
  type: MatchType
  no: string
}

const MATCH_TYPE_LABELS: Record<MatchType, string> = {
  idcard: '身份证号',
  outpatient: '门诊号',
  inpatient: '住院号',
}

const MATCH_TYPE_PLACEHOLDERS: Record<MatchType, string> = {
  idcard: '输入 18 位身份证号',
  outpatient: '输入门诊号',
  inpatient: '输入住院号',
}

const CFG_KEY = 'clini_x_integration_cfg'
const MATCH_KEY = 'clini_x_patient_match'

const DEFAULT_CFG: IntegrationCfg = {
  enabled: false,
  tasks: [],
  records: [
    { id: 'demo-r1', time: '2026-08-14 09:32', mode: '手动抓取', scopeLabel: '全部研究', fieldCount: 36, patientCount: 12, status: '成功' },
  ],
}

function loadCfg(): IntegrationCfg {
  try {
    const raw = localStorage.getItem(CFG_KEY)
    if (raw) return { ...DEFAULT_CFG, ...JSON.parse(raw) }
  } catch {
    /* ignore */
  }
  return DEFAULT_CFG
}

function loadMatch(): Record<string, MatchInfo> {
  try {
    const raw = localStorage.getItem(MATCH_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    /* ignore */
  }
  return {}
}

function nowStr() {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

/** 稳定的伪随机：按字符串 hash */
function hashOf(s: string) {
  return [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7)
}

/** 模拟：拉取病历包后对当前研究 CRF 的智能填充结果 */
function buildFillPreview(p: Patient): FillPreview {
  const h = hashOf(p.id)
  const fields: FillField[] = [
    { label: '性别', value: p.gender === 'male' ? '男' : '女', source: '病历原文' },
    { label: '出生日期', value: p.birthDate || '1978-05-12', source: '病历原文' },
    { label: '身高', value: `${160 + (h % 25)} cm`, source: '护理记录' },
    { label: '体重', value: `${52 + (h % 30)} kg`, source: '护理记录' },
    { label: '白细胞计数', value: `${(4 + (h % 50) / 10).toFixed(1)} ×10⁹/L`, source: '检验系统' },
    { label: '血红蛋白', value: `${110 + (h % 45)} g/L`, source: '检验系统' },
    { label: '收缩压/舒张压', value: `${118 + (h % 20)}/${72 + (h % 15)} mmHg`, source: '生命体征' },
    { label: '既往病史', value: '高血压 5 年，规律服药', source: '病历原文' },
    { label: '不良事件', missing: true },
    { label: '研究量表评分', missing: true },
  ]
  return { patient: p, fields }
}

const SOURCE_STYLE: Record<string, string> = {
  检验系统: 'bg-cyan-50 text-cyan-600 border-cyan-200',
  病历原文: 'bg-violet-50 text-violet-600 border-violet-200',
  护理记录: 'bg-sky-50 text-sky-600 border-sky-200',
  生命体征: 'bg-teal-50 text-teal-600 border-teal-200',
}

/** 卡片标题图标徽章 */
function TitleIcon({ children }: { children: React.ReactNode }) {
  return (
    <span className="w-6 h-6 rounded-md bg-gradient-to-br from-teal-50 to-cyan-50 border border-teal-100/80 flex items-center justify-center shrink-0">
      {children}
    </span>
  )
}

export default function DataIntegrationPage() {
  const { projects, patients } = useAppStorage()
  const [cfg, setCfg] = useState<IntegrationCfg>(loadCfg)

  // ---- 患者匹配（受试者定位表格内编辑）----
  const [matchMap, setMatchMap] = useState<Record<string, MatchInfo>>(loadMatch)
  const [editing, setEditing] = useState(false)
  const [drafts, setDrafts] = useState<Record<string, MatchInfo>>({})

  // ---- 数据抓取 ----
  const [scope, setScope] = useState<string>('all')
  const [dateFrom, setDateFrom] = useState('2026-08-01')
  const [dateTo, setDateTo] = useState('2026-08-16')
  const [selecting, setSelecting] = useState(false)
  const [planTime, setPlanTime] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [previews, setPreviews] = useState<FillPreview[] | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  useEffect(() => {
    localStorage.setItem(CFG_KEY, JSON.stringify(cfg))
  }, [cfg])

  useEffect(() => {
    localStorage.setItem(MATCH_KEY, JSON.stringify(matchMap))
  }, [matchMap])

  const scopeLabel = (s: string) =>
    s === 'all' ? '全部研究' : projects.find((p) => p.id === s)?.name ?? s

  /** 患者是否已完成匹配（填了匹配号码） */
  const isMatched = (p: Patient) => !!matchMap[p.id]?.no?.trim()

  const scopedPatients = useMemo(
    () => patients.filter((p) => scope === 'all' || p.projectId === scope),
    [patients, scope],
  )
  const matchedCount = scopedPatients.filter(isMatched).length

  // ---- 患者匹配编辑模式 ----

  const enterEdit = () => {
    const init: Record<string, MatchInfo> = {}
    scopedPatients.forEach((p) => {
      init[p.id] = matchMap[p.id] ?? { type: 'inpatient', no: '' }
    })
    setDrafts(init)
    setEditing(true)
  }

  const saveMatch = () => {
    setMatchMap((prev) => {
      const next = { ...prev }
      Object.entries(drafts).forEach(([pid, info]) => {
        if (info.no.trim()) next[pid] = { type: info.type, no: info.no.trim() }
        else delete next[pid]
      })
      return next
    })
    setEditing(false)
  }

  const updateDraft = (pid: string, patch: Partial<MatchInfo>) =>
    setDrafts((d) => ({ ...d, [pid]: { ...d[pid], ...patch } }))

  // ---- 抓取 ----

  const exitSelecting = () => {
    setSelecting(false)
    setSelected(new Set())
  }

  const toggleSelect = (id: string) =>
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  /** 全选/取消全选（仅已匹配的受试者可被选） */
  const allMatchedSelected = matchedCount > 0 && selected.size >= matchedCount
  const toggleSelectAll = () => {
    if (allMatchedSelected) setSelected(new Set())
    else setSelected(new Set(scopedPatients.filter(isMatched).map((p) => p.id)))
  }

  const activeTasks = useMemo(
    () => cfg.tasks.filter((t) => t.status === 'scheduled').sort((a, b) => a.planTime.localeCompare(b.planTime)),
    [cfg.tasks],
  )

  const runNow = () => {
    const targets = scopedPatients.filter((p) => selected.has(p.id))
    if (targets.length === 0) return
    setPreviews(targets.map(buildFillPreview))
    setExpanded(new Set(targets.slice(0, 1).map((p) => p.id)))
  }

  const confirmPreviews = () => {
    if (!previews) return
    const fieldCount = previews.reduce(
      (sum, pv) => sum + pv.fields.filter((f) => !f.missing).length, 0,
    )
    const rec: FetchRecord = {
      id: `r-${Date.now()}`,
      time: nowStr(),
      mode: '手动抓取',
      scopeLabel: `${scopeLabel(scope)} · ${dateFrom} ~ ${dateTo}`,
      fieldCount,
      patientCount: previews.length,
      status: '成功',
    }
    setCfg((c) => ({ ...c, records: [rec, ...c.records] }))
    setPreviews(null)
    exitSelecting()
  }

  const addPlan = () => {
    if (!planTime) return
    const t = new Date(planTime)
    if (Number.isNaN(t.getTime()) || t.getTime() <= Date.now()) return
    const task: FetchTask = {
      id: `t-${Date.now()}`,
      planTime: planTime.replace('T', ' '),
      scope,
      patientCount: selected.size,
      status: 'scheduled',
      createdAt: nowStr(),
    }
    setCfg((c) => ({ ...c, tasks: [task, ...c.tasks] }))
    setPlanTime('')
  }

  const cancelTask = (id: string) =>
    setCfg((c) => ({ ...c, tasks: c.tasks.map((t) => (t.id === id ? { ...t, status: 'cancelled' } : t)) }))

  const planValid = planTime && new Date(planTime).getTime() > Date.now()

  // ==================== 渲染 ====================

  return (
    <div className="p-6 space-y-5 max-w-[1200px]">
      {/* 页面说明 */}
      <div className="rounded-xl border border-cyan-200/70 bg-gradient-to-r from-cyan-50/90 via-teal-50/70 to-white px-5 py-4 flex items-start gap-3.5 shadow-sm">
        <span className="w-9 h-9 rounded-lg bg-white border border-cyan-100 shadow-sm flex items-center justify-center shrink-0 mt-0.5">
          <Database className="w-4.5 h-4.5 text-cyan-600" />
        </span>
        <div className="text-sm text-slate-600 leading-relaxed">
          <p className="font-semibold text-slate-800 mb-0.5">医院病历智能抓取（HIS / EMR）</p>
          在「受试者定位」中点击「患者匹配」，为受试者登记匹配路径与号码（住院号/门诊号/身份证号），建立研究侧与医院系统的身份对应；
          再点击「选择抓取」勾选受试者，批量抓取病历数据包，系统智能填充当前研究 CRF 所需字段，
          <span className="font-medium text-slate-800">病历中未找到的字段留空由人工补录</span>，自动值须录入端确认后生效。
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* 连接状态 + 总开关 */}
        <Card className="border-slate-200/80 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <TitleIcon><Link2 className="w-3.5 h-3.5 text-teal-600" /></TitleIcon> 连接与总开关
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-gradient-to-r from-slate-50/80 to-teal-50/30 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-slate-700">江苏大学附属医院 · HIS 接口</p>
                <p className="text-xs text-slate-400 mt-0.5">内网部署 · 只读中间库视图（模拟）</p>
              </div>
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-full px-2.5 py-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> 已连接
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-slate-700">数据抓取总开关</p>
                <p className="text-xs text-slate-400 mt-0.5">关闭后，手动与定时抓取均不执行</p>
              </div>
              <button
                type="button"
                onClick={() => setCfg((c) => ({ ...c, enabled: !c.enabled }))}
                className={`relative w-11 h-6 rounded-full transition-colors ${cfg.enabled ? 'bg-teal-500' : 'bg-slate-300'}`}
              >
                <span
                  className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${cfg.enabled ? 'translate-x-[22px]' : 'translate-x-0.5'}`}
                />
              </button>
            </div>
            <p className="text-xs text-slate-400">
              当前状态：{cfg.enabled ? (
                <span className="text-teal-600 font-medium">已激活，可执行抓取</span>
              ) : (
                <span className="text-slate-500 font-medium">未激活，抓取功能停用</span>
              )}
            </p>
          </CardContent>
        </Card>

        {/* 抓取设置 */}
        <Card className="border-slate-200/80 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <TitleIcon><FileSearch className="w-3.5 h-3.5 text-teal-600" /></TitleIcon> 抓取设置
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-xs text-slate-500 mb-1.5 block">研究范围</Label>
              <Select value={scope} onValueChange={(v) => { setScope(v); setSelected(new Set()); setEditing(false); setSelecting(false) }}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部研究</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-slate-500 mb-1.5 block">病历数据时间范围</Label>
              <div className="flex items-center gap-2">
                <Input type="date" className="h-9 text-sm flex-1" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                <span className="text-slate-400 text-sm">至</span>
                <Input type="date" className="h-9 text-sm flex-1" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
              </div>
              <p className="text-[11px] text-slate-400 mt-1.5">
                仅抓取该时间范围内的检验报告、病程记录等病历内容；默认可按访视窗口期自动带出。
              </p>
            </div>
            <div className="rounded-lg border border-teal-100/70 bg-teal-50/50 px-4 py-3">
              <p className="text-xs text-slate-500 leading-relaxed">
                <span className="font-medium text-teal-700">患者定位：</span>
                按下方「受试者定位」中维护的匹配号码与医院系统一一对应；未维护匹配号码的受试者标记为「未匹配」，不可抓取。
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 受试者定位 */}
      <Card className="border-slate-200/80 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TitleIcon><UserSearch className="w-3.5 h-3.5 text-teal-600" /></TitleIcon> 受试者定位
              <span className="text-xs font-normal text-slate-400">
                共 {scopedPatients.length} 人 · 已匹配 {matchedCount} 人{selecting && ` · 已选 ${selected.size} 人`}
              </span>
            </CardTitle>
            <div className="flex items-center gap-2">
              {editing ? (
                <>
                  <Button size="sm" variant="outline" onClick={() => setEditing(false)}>取消</Button>
                  <Button size="sm" className="bg-teal-600 hover:bg-teal-700" onClick={saveMatch}>
                    <Save className="w-3.5 h-3.5 mr-1" /> 保存
                  </Button>
                </>
              ) : selecting ? (
                <>
                  <Button size="sm" variant="outline" onClick={exitSelecting}>取消</Button>
                  <Button
                    size="sm"
                    disabled={!cfg.enabled || selected.size === 0}
                    onClick={runNow}
                    className="bg-teal-600 hover:bg-teal-700"
                  >
                    <Zap className="w-3.5 h-3.5 mr-1" /> 立即抓取（{selected.size}）
                  </Button>
                </>
              ) : (
                <>
                  <Button size="sm" variant="outline" onClick={enterEdit} disabled={scopedPatients.length === 0}>
                    <PencilLine className="w-3.5 h-3.5 mr-1" /> 患者匹配
                  </Button>
                  <Button
                    size="sm"
                    className="bg-teal-600 hover:bg-teal-700"
                    onClick={() => setSelecting(true)}
                    disabled={scopedPatients.length === 0}
                  >
                    <Zap className="w-3.5 h-3.5 mr-1" /> 选择抓取
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {scopedPatients.length === 0 ? (
            <p className="text-sm text-slate-400 py-6 text-center">该范围内暂无受试者</p>
          ) : (
            <div className="rounded-lg border border-slate-100 overflow-hidden">
              <div className="max-h-[340px] overflow-y-auto">
                <table className="w-full text-sm table-fixed">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-slate-50/95 backdrop-blur text-xs text-slate-500 border-b border-slate-100">
                      {selecting && (
                        <th className="text-center font-medium py-2.5 px-2 w-10">
                          <input
                            type="checkbox"
                            title="全选 / 取消全选（已匹配）"
                            className="rounded border-slate-300 text-teal-600 focus:ring-teal-500 disabled:opacity-40"
                            disabled={matchedCount === 0}
                            checked={allMatchedSelected}
                            onChange={toggleSelectAll}
                          />
                        </th>
                      )}
                      <th className="text-center font-medium py-2.5 px-2 w-20">筛选编号</th>
                      <th className="text-center font-medium py-2.5 px-2 w-24">入组编号</th>
                      <th className="text-center font-medium py-2.5 px-2 w-24">姓名缩写</th>
                      <th className="text-center font-medium py-2.5 px-2 w-12">性别</th>
                      <th className="text-center font-medium py-2.5 px-2 w-28">知情日期</th>
                      <th className="text-center font-medium py-2.5 px-2 w-28">入组日期</th>
                      <th className="text-center font-medium py-2.5 px-2 w-32">匹配路径</th>
                      <th className="text-center font-medium py-2.5 px-2 w-44">匹配号码</th>
                      <th className="text-center font-medium py-2.5 px-2">所属研究</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {scopedPatients.map((p) => {
                      const saved = matchMap[p.id]
                      const ok = isMatched(p)
                      const draft = drafts[p.id]
                      return (
                        <tr key={p.id} className="text-slate-600 hover:bg-teal-50/30 transition-colors">
                          {selecting && (
                            <td className="py-2 px-2 text-center">
                              <input
                                type="checkbox"
                                className="rounded border-slate-300 text-teal-600 focus:ring-teal-500 disabled:opacity-40"
                                disabled={!ok}
                                checked={selected.has(p.id)}
                                onChange={() => toggleSelect(p.id)}
                              />
                            </td>
                          )}
                          <td className="py-2 px-2 text-center font-medium text-slate-700">{p.screeningId}</td>
                          <td className="py-2 px-2 text-center">{p.randomizationId || '-'}</td>
                          <td className="py-2 px-2 text-center">{p.nameInitials}</td>
                          <td className="py-2 px-2 text-center">{p.gender === 'male' ? '男' : '女'}</td>
                          <td className="py-2 px-2 text-center text-xs">{p.consentDate || '-'}</td>
                          <td className="py-2 px-2 text-center text-xs">{p.enrollmentDate || '-'}</td>
                          {editing ? (
                            <>
                              <td className="py-1.5 px-2">
                                <Select
                                  value={draft?.type ?? 'inpatient'}
                                  onValueChange={(v) => updateDraft(p.id, { type: v as MatchType })}
                                >
                                  <SelectTrigger className="h-8 text-xs w-full">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {(Object.keys(MATCH_TYPE_LABELS) as MatchType[]).map((k) => (
                                      <SelectItem key={k} value={k}>{MATCH_TYPE_LABELS[k]}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </td>
                              <td className="py-1.5 px-2">
                                <Input
                                  className="h-8 text-xs text-center"
                                  placeholder={MATCH_TYPE_PLACEHOLDERS[draft?.type ?? 'inpatient']}
                                  value={draft?.no ?? ''}
                                  onChange={(e) => updateDraft(p.id, { no: e.target.value })}
                                />
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="py-2 px-2 text-center text-xs">
                                {saved ? MATCH_TYPE_LABELS[saved.type] : <span className="text-slate-300">—</span>}
                              </td>
                              <td className="py-2 px-2 text-center text-xs font-mono">
                                {saved ? saved.no : <span className="text-amber-500 font-sans">待补充</span>}
                              </td>
                            </>
                          )}
                          <td className="py-2 px-2 text-center text-xs text-slate-500 leading-snug break-words" title={projects.find((pr) => pr.id === p.projectId)?.name ?? p.projectId}>
                            {projects.find((pr) => pr.id === p.projectId)?.name ?? p.projectId}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          <p className="text-[11px] text-slate-400 mt-3 leading-relaxed">
            匹配号码由抓取人员依据病历资料手工录入，一次维护长期有效；点击「选择抓取」后勾选受试者，未填写匹配号码的受试者不可勾选。
          </p>
          {/* 定时抓取 */}
          <div className="mt-4 rounded-lg border border-teal-100/60 bg-gradient-to-r from-teal-50/60 via-slate-50/60 to-cyan-50/40 px-4 py-3 flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5">
              <CalendarClock className="w-4 h-4 text-teal-500" />
              <p className="text-sm font-medium text-slate-700">定时抓取</p>
            </div>
            <Input
              type="datetime-local"
              className="h-9 text-sm w-56 bg-white"
              value={planTime}
              min={new Date(Date.now() + 60000).toISOString().slice(0, 16)}
              onChange={(e) => setPlanTime(e.target.value)}
            />
            <Button size="sm" variant="outline" className="bg-white" disabled={!cfg.enabled || !planValid || selected.size === 0} onClick={addPlan}>
              对选中 {selected.size} 人添加计划
            </Button>
            <p className="text-[11px] text-slate-400">到达设定时间执行一次；过期计划自动作废，不会周期重复。</p>
          </div>
        </CardContent>
      </Card>

      {/* 定时计划列表 */}
      <Card className="border-slate-200/80 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <TitleIcon><Clock className="w-3.5 h-3.5 text-teal-600" /></TitleIcon> 定时计划
            <span className="text-xs font-normal text-slate-400">（{activeTasks.length} 条待执行）</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activeTasks.length === 0 ? (
            <p className="text-sm text-slate-400 py-6 text-center">暂无待执行的定时计划</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {activeTasks.map((t) => (
                <div key={t.id} className="flex items-center justify-between py-2.5">
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-medium text-slate-700">{t.planTime}</span>
                    <span className="text-xs text-slate-500">{scopeLabel(t.scope)} · {t.patientCount} 名受试者</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-50 text-cyan-600 border border-cyan-100">待执行</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => cancelTask(t.id)}
                    className="text-xs text-slate-400 hover:text-red-500 inline-flex items-center gap-1"
                  >
                    <X className="w-3.5 h-3.5" /> 取消
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 抓取记录 */}
      <Card className="border-slate-200/80 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <TitleIcon><History className="w-3.5 h-3.5 text-teal-600" /></TitleIcon> 抓取记录
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-slate-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50/90 text-xs text-slate-500 border-b border-slate-100">
                  <th className="text-left font-medium py-2.5 px-4">执行时间</th>
                  <th className="text-left font-medium py-2.5 px-2">方式</th>
                  <th className="text-left font-medium py-2.5 px-2">范围</th>
                  <th className="text-right font-medium py-2.5 px-2">受试者</th>
                  <th className="text-right font-medium py-2.5 px-2">填充字段数</th>
                  <th className="text-right font-medium py-2.5 px-4">结果</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {cfg.records.map((r) => (
                  <tr key={r.id} className="text-slate-600 hover:bg-teal-50/20 transition-colors">
                    <td className="py-2.5 px-4">{r.time}</td>
                    <td className="py-2.5 px-2">
                      <span className={`text-[11px] px-1.5 py-0.5 rounded border ${r.mode === '手动抓取' ? 'bg-teal-50 text-teal-600 border-teal-100' : 'bg-sky-50 text-sky-600 border-sky-100'}`}>
                        {r.mode}
                      </span>
                    </td>
                    <td className="py-2.5 px-2 text-xs">{r.scopeLabel}</td>
                    <td className="py-2.5 px-2 text-right">{r.patientCount} 人</td>
                    <td className="py-2.5 px-2 text-right">{r.fieldCount}</td>
                    <td className="py-2.5 px-4 text-right">
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                        <CheckCircle2 className="w-3.5 h-3.5" /> {r.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ==================== 智能填充预览弹窗 ==================== */}
      <Dialog open={!!previews} onOpenChange={(open) => !open && setPreviews(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Sparkles className="w-4.5 h-4.5 text-teal-600" />
              智能填充预览
              <span className="text-xs font-normal text-slate-400">
                病历时间范围 {dateFrom} ~ {dateTo} · 共 {previews?.length ?? 0} 名受试者
              </span>
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {previews?.map((pv) => {
              const filled = pv.fields.filter((f) => !f.missing)
              const missing = pv.fields.filter((f) => f.missing)
              const isOpen = expanded.has(pv.patient.id)
              const saved = matchMap[pv.patient.id]
              return (
                <div key={pv.patient.id} className="border border-slate-200 rounded-xl overflow-hidden">
                  <button
                    type="button"
                    className="w-full flex items-center justify-between px-4 py-3 bg-slate-50/70 hover:bg-slate-100/60 transition-colors"
                    onClick={() =>
                      setExpanded((s) => {
                        const next = new Set(s)
                        if (next.has(pv.patient.id)) next.delete(pv.patient.id)
                        else next.add(pv.patient.id)
                        return next
                      })
                    }
                  >
                    <div className="flex items-center gap-3 text-sm">
                      {isOpen ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                      <span className="font-semibold text-slate-800">{pv.patient.screeningId} · {pv.patient.nameInitials}</span>
                      <span className="text-xs text-slate-400">{saved ? `${MATCH_TYPE_LABELS[saved.type]} ${saved.no}` : ''}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="px-2 py-0.5 rounded-full bg-teal-50 text-teal-600 border border-teal-100">已填充 {filled.length} 项</span>
                      {missing.length > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-100">待补录 {missing.length} 项</span>
                      )}
                    </div>
                  </button>
                  {isOpen && (
                    <div className="divide-y divide-slate-50">
                      {pv.fields.map((f) => (
                        <div key={f.label} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                          <span className="w-32 shrink-0 text-slate-500">{f.label}</span>
                          {f.missing ? (
                            <span className="inline-flex items-center gap-1.5 text-xs text-amber-600">
                              <AlertCircle className="w-3.5 h-3.5" /> 病历中未找到 · 需手动录入
                            </span>
                          ) : (
                            <>
                              <span className="font-medium text-slate-800">{f.value}</span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded border whitespace-nowrap ${SOURCE_STYLE[f.source!]}`}>{f.source}</span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 border border-amber-200 ml-auto whitespace-nowrap">待录入端确认</span>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          <DialogFooter className="pt-3">
            <Button variant="outline" onClick={() => setPreviews(null)}>取消</Button>
            <Button className="bg-teal-600 hover:bg-teal-700" onClick={confirmPreviews}>
              <CheckCircle2 className="w-4 h-4 mr-1.5" /> 确认生效（生成待确认数据）
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
