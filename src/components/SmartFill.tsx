import { useRef, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Mic, MicOff, FileUp, Loader2, Wand2, CheckCircle, X } from 'lucide-react'
import type { CRFField } from '@/types'

// ==================== 文本 → 字段 解析 ====================

export interface FillMatch {
  fieldName: string
  fieldLabel: string
  value: unknown
  display: string
  selected: boolean
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** 标签匹配键：完整标签 + 去掉括号单位的别名（如「收缩压(mmHg)」→「收缩压」） */
function labelKeys(label: string): string[] {
  const stripped = label.replace(/[(（][^)）]*[)）]/g, '').trim()
  return stripped && stripped !== label ? [label, stripped] : [label]
}

/** 在文本中查找 标签附近的数字 */
function numNear(text: string, label: string): number | undefined {
  for (const key of labelKeys(label)) {
    const m = text.match(new RegExp(`${esc(key)}[^\\d\\-]{0,8}(-?\\d+(?:\\.\\d+)?)`))
    if (m) return Number(m[1])
  }
  return undefined
}

/** 在文本中查找 标签附近的日期（2026-08-06 / 2026年8月6日 / 2026/8/6） */
function dateNear(text: string, label: string): string | undefined {
  for (const key of labelKeys(label)) {
    const m = text.match(new RegExp(`${esc(key)}[^\\d]{0,8}(\\d{4})[-/年](\\d{1,2})[-/月](\\d{1,2})[日号]?`))
    if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
  }
  return undefined
}

/** 在文本中查找 标签后的短文本 */
function textNear(text: string, label: string): string | undefined {
  for (const key of labelKeys(label)) {
    const m = text.match(new RegExp(`${esc(key)}[:：，,]?\\s*([^，。；\\n]{1,40})`))
    if (m && m[1].trim()) return m[1].trim()
  }
  return undefined
}

/** 在文本中查找 标签后的是/否类词 */
function boolNear(text: string, label: string): boolean | undefined {
  for (const key of labelKeys(label)) {
    const m = text.match(new RegExp(`${esc(key)}[^，。；\\n]{0,6}(是|有|阳性|否|无|阴性)`))
    if (m) return ['是', '有', '阳性'].includes(m[1])
  }
  return undefined
}

/** 检验项目清单：优先设计时配置的 items；兼容旧数据（从已上传范围套取并集） */
function labItemsOf(lab: { items?: { name: string }[]; sets: { items: { name: string }[] }[] }) {
  return lab.items && lab.items.length > 0
    ? lab.items
    : Array.from(new Map(lab.sets.flatMap((s) => s.items).map((it) => [it.name, it])).values())
}

/** 把一段文本解析为字段填充值（含实验室检查动态表格） */
export function parseTextToFields(text: string, fields: CRFField[]): FillMatch[] {
  const matches: FillMatch[] = []
  for (const f of fields) {
    if (['label', 'signature', 'fileUpload', 'richText', 'scale', 'numberRange'].includes(f.type)) continue

    // 表格（实验室/通用预置行）：按预置项目名匹配数值
    if (f.type === 'table') {
      const lab = f.labConfig
      const presetCol = lab?.itemCol || f.rowPreset?.col
      const valueCol = lab?.valueCol || f.matrixView?.valueCol || f.columns?.find((c) => c.type === 'number')?.name
      if (!presetCol || !valueCol) continue
      const items = lab
        ? labItemsOf(lab)
        : (f.rowPreset?.rows ?? []).filter((n) => n).map((n) => ({ name: n }))
      const rows: Record<string, unknown>[] = []
      for (const it of items) {
        const v = numNear(text, it.name)
        if (v !== undefined) rows.push({ [presetCol]: it.name, [valueCol]: v })
      }
      if (rows.length > 0) {
        matches.push({
          fieldName: f.name, fieldLabel: f.label, value: rows,
          display: rows.map((r) => `${r[presetCol]}=${r[valueCol]}`).join('，'),
          selected: true,
        })
      }
      continue
    }

    if (f.type === 'select' || f.type === 'radio') {
      const keys = labelKeys(f.label)
      if (!keys.some((k) => text.includes(k))) continue
      const hit = (f.options ?? []).find((o) => o.label && text.includes(o.label))
      if (hit) {
        matches.push({ fieldName: f.name, fieldLabel: f.label, value: hit.value, display: hit.label, selected: true })
      }
      continue
    }
    if (f.type === 'checkbox') {
      const keys = labelKeys(f.label)
      if (!keys.some((k) => text.includes(k))) continue
      const hits = (f.options ?? []).filter((o) => o.label && text.includes(o.label))
      if (hits.length > 0) {
        matches.push({
          fieldName: f.name, fieldLabel: f.label, value: hits.map((h) => h.value),
          display: hits.map((h) => h.label).join('、'), selected: true,
        })
      }
      continue
    }
    if (f.type === 'toggle') {
      const v = boolNear(text, f.label)
      if (v !== undefined) {
        matches.push({ fieldName: f.name, fieldLabel: f.label, value: v, display: v ? '是' : '否', selected: true })
      }
      continue
    }
    if (f.type === 'number') {
      const v = numNear(text, f.label)
      if (v !== undefined) {
        matches.push({ fieldName: f.name, fieldLabel: f.label, value: v, display: String(v), selected: true })
      }
      continue
    }
    if (f.type === 'date' || f.type === 'datetime') {
      const v = dateNear(text, f.label)
      if (v) {
        matches.push({ fieldName: f.name, fieldLabel: f.label, value: v, display: v, selected: true })
      }
      continue
    }
    // text / textarea：标签后的短文本
    const v = textNear(text, f.label)
    if (v) {
      matches.push({ fieldName: f.name, fieldLabel: f.label, value: v, display: v, selected: true })
    }
  }
  return matches
}

/** 模拟识别文本（演示环境无 OCR 服务：按字段结构生成一段"化验单"式文本） */
function mockRecognizedText(fields: CRFField[]): string {
  const parts: string[] = []
  for (const f of fields) {
    if (f.type === 'table' && (f.labConfig || (f.rowPreset?.rows ?? []).length > 0)) {
      const items = f.labConfig
        ? labItemsOf(f.labConfig)
        : (f.rowPreset?.rows ?? []).filter((n) => n).map((n) => ({ name: n }))
      const sets = f.labConfig?.sets ?? f.rangeSets ?? []
      const latest = sets[sets.length - 1]
      for (const it of items) {
        const range = latest?.items.find((x) => x.name === it.name)
        const low = range?.low ?? ('low' in it ? (it as { low?: number }).low : undefined)
        const high = range?.high ?? ('high' in it ? (it as { high?: number }).high : undefined)
        if (low === undefined || high === undefined) {
          parts.push(`${it.name} ${Math.round((1 + Math.random() * 99) * 10) / 10}`)
          continue
        }
        const span = high - low
        const r = Math.random()
        const v = r < 0.2 ? high + span * 0.15 : r < 0.35 ? low - span * 0.15 : low + span * 0.5
        parts.push(`${it.name} ${Math.round(v * 10) / 10}`)
      }
      continue
    }
    if (f.type === 'number') parts.push(`${f.label} ${Math.round((1 + Math.random() * 99) * 10) / 10}`)
    else if (f.type === 'select' || f.type === 'radio') {
      const opts = f.options ?? []
      if (opts.length) parts.push(`${f.label} ${opts[Math.floor(Math.random() * opts.length)].label}`)
    } else if (f.type === 'date') parts.push(`${f.label} 2026-08-06`)
    else if (f.type === 'text') parts.push(`${f.label} 未见明显异常`)
  }
  return parts.join('，')
}

// ==================== 组件 ====================

interface Props {
  open: boolean
  mode: 'voice' | 'file'
  fields: CRFField[]
  onOpenChange: (open: boolean) => void
  onApply: (patch: Record<string, unknown>, source: 'voice' | 'file') => void
}

/** 智能填充主体（内联/弹窗共用） */
interface BodyProps {
  mode: 'voice' | 'file'
  fields: CRFField[]
  onApply: (patch: Record<string, unknown>, source: 'voice' | 'file') => void
  onClose: () => void
}

/** 数据来源徽标：标记该模块数据由语音/文件识别填充 */
export function FillSourceBadge({ source }: { source?: string }) {
  if (source === 'voice') {
    return (
      <span className="text-[11px] px-2 py-1 rounded-full bg-teal-50 text-teal-600 flex items-center gap-1" title="由语音录入识别填充">
        <Mic className="w-3 h-3" /> 语音填充
      </span>
    )
  }
  if (source === 'file') {
    return (
      <span className="text-[11px] px-2 py-1 rounded-full bg-sky-50 text-sky-600 flex items-center gap-1" title="由上传文件识别填充">
        <FileUp className="w-3 h-3" /> 文件填充
      </span>
    )
  }
  return null
}

interface SpeechRecognitionLike {
  lang: string
  interimResults: boolean
  continuous: boolean
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

/** 智能填充主体：语音录入 / 上传文件识别 → 解析 → 确认 → 自动填充表单 */
function SmartFillBody({ mode, fields, onApply, onClose }: BodyProps) {
  const [listening, setListening] = useState(false)
  const [text, setText] = useState('')
  const [recognizing, setRecognizing] = useState(false)
  const [simulated, setSimulated] = useState(false)
  const [matches, setMatches] = useState<FillMatch[] | null>(null)
  const recogRef = useRef<SpeechRecognitionLike | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const SpeechRec = (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike })
  const speechSupported = !!(SpeechRec.SpeechRecognition || SpeechRec.webkitSpeechRecognition)

  const toggleListen = () => {
    if (listening) {
      recogRef.current?.stop()
      setListening(false)
      return
    }
    const Ctor = SpeechRec.SpeechRecognition ?? SpeechRec.webkitSpeechRecognition
    if (!Ctor) return
    const r = new Ctor()
    r.lang = 'zh-CN'
    r.interimResults = false
    r.continuous = true
    r.onresult = (e) => {
      const last = e.results[e.results.length - 1]
      if (last && last[0]) setText((t) => (t ? `${t}，` : '') + last[0].transcript)
    }
    r.onend = () => setListening(false)
    recogRef.current = r
    r.start()
    setListening(true)
  }

  const handleFile = (file: File) => {
    setMatches(null)
    setSimulated(false)
    if (/\.(txt|csv)$/i.test(file.name)) {
      const reader = new FileReader()
      reader.onload = () => {
        setText(String(reader.result || ''))
        parseAndPreview(String(reader.result || ''))
      }
      reader.readAsText(file, 'utf-8')
      return
    }
    // 图片/PDF：演示环境无 OCR 服务，模拟识别
    setRecognizing(true)
    setTimeout(() => {
      const t = mockRecognizedText(fields)
      setRecognizing(false)
      setSimulated(true)
      setText(t)
      parseAndPreview(t)
    }, 1500)
  }

  const parseAndPreview = (t: string) => {
    setMatches(parseTextToFields(t, fields))
  }

  const apply = () => {
    if (!matches) return
    const patch: Record<string, unknown> = {}
    for (const m of matches.filter((x) => x.selected)) patch[m.fieldName] = m.value
    onApply(patch, mode)
    onClose()
    setMatches(null)
    setText('')
    setSimulated(false)
  }

  return (
    <div className="space-y-3">
          {mode === 'voice' ? (
            <div className="flex items-center gap-3">
              <Button
                variant={listening ? 'destructive' : 'outline'}
                size="sm"
                disabled={!speechSupported}
                onClick={toggleListen}
              >
                {listening ? <MicOff className="w-3.5 h-3.5 mr-1" /> : <Mic className="w-3.5 h-3.5 mr-1" />}
                {listening ? '停止' : '开始说话'}
              </Button>
              <span className="text-xs text-slate-400">
                {speechSupported
                  ? listening ? '正在聆听…说出如「收缩压 165，脉搏 88」' : '点击开始，支持连续识别（zh-CN）'
                  : '当前环境不支持语音识别，可直接在下方粘贴/输入文本'}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={recognizing}>
                {recognizing ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <FileUp className="w-3.5 h-3.5 mr-1" />}
                {recognizing ? '识别中…' : '选择文件'}
              </Button>
              <span className="text-xs text-slate-400">支持 .txt/.csv 直接解析；图片/PDF 为模拟识别（演示）</span>
              <input
                ref={fileRef}
                type="file"
                accept=".txt,.csv,.png,.jpg,.jpeg,.pdf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) handleFile(f)
                  e.target.value = ''
                }}
              />
            </div>
          )}

          <Textarea
            rows={4}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={mode === 'voice' ? '识别文本将显示在这里，也可手动编辑…' : '文件识别文本将显示在这里，也可手动粘贴…'}
            className="text-sm"
          />
          {simulated && (
            <div className="text-[10px] text-amber-500">⚠ 演示环境：图片/PDF 识别结果为模拟生成</div>
          )}

          <div className="flex justify-end">
            <Button size="sm" variant="outline" onClick={() => parseAndPreview(text)} disabled={!text.trim()}>
              解析
            </Button>
          </div>

          {matches && (
            <div className="border border-slate-200 rounded-md overflow-hidden">
              <div className="px-3 py-2 bg-slate-50 text-xs font-medium text-slate-600">
                识别结果（{matches.filter((m) => m.selected).length}/{matches.length} 项将填充）
              </div>
              {matches.length === 0 && (
                <div className="px-3 py-6 text-center text-xs text-slate-400">未识别到可填充的字段，请检查文本</div>
              )}
              <div className="max-h-56 overflow-y-auto divide-y divide-slate-50">
                {matches.map((m, i) => (
                  <label key={i} className="flex items-center gap-2 px-3 py-1.5 text-xs cursor-pointer hover:bg-slate-50">
                    <input
                      type="checkbox"
                      className="accent-teal-500"
                      checked={m.selected}
                      onChange={(e) =>
                        setMatches(matches.map((x, j) => (j === i ? { ...x, selected: e.target.checked } : x)))
                      }
                    />
                    <span className="text-slate-500 w-28 shrink-0 truncate">{m.fieldLabel}</span>
                    <span className="text-slate-700 font-medium truncate">{m.display}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {matches && matches.length > 0 && (
            <div className="flex justify-end">
              <Button size="sm" className="bg-teal-500 hover:bg-teal-600 text-white" onClick={apply}>
                <CheckCircle className="w-3.5 h-3.5 mr-1" /> 应用到表单
              </Button>
            </div>
          )}
    </div>
  )
}

/** 弹窗形态（保留兼容） */
export function SmartFillDialog({ open, mode, fields, onOpenChange, onApply }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
            <Wand2 className="w-4 h-4 text-teal-500" />
            {mode === 'voice' ? '语音录入' : '上传文件识别'}
          </DialogTitle>
        </DialogHeader>
        <SmartFillBody mode={mode} fields={fields} onApply={onApply} onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}

/** 内联形态：展示在录入表单下方，不遮挡录入区 */
export function SmartFillPanel({ mode, fields, onApply, onClose }: BodyProps) {
  return (
    <div className="rounded-xl border border-teal-200 bg-teal-50/40 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 bg-teal-50 border-b border-teal-100">
        <span className="w-6 h-6 rounded-md bg-white flex items-center justify-center shrink-0">
          <Wand2 className="w-3.5 h-3.5 text-teal-500" />
        </span>
        <span className="text-sm font-medium text-slate-700">
          {mode === 'voice' ? '语音录入' : '上传文件识别'}
        </span>
        <span className="text-[11px] text-slate-400 hidden sm:inline">识别结果解析后可勾选填充到上方表单</span>
        <button
          type="button"
          onClick={onClose}
          className="ml-auto p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-white/70 transition-colors"
          title="收起"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="p-4">
        <SmartFillBody mode={mode} fields={fields} onApply={onApply} onClose={onClose} />
      </div>
    </div>
  )
}
