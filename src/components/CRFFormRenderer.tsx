import { useState, useRef, useEffect } from 'react'
import type { CRFField, FieldOption, TreeOption, UploadedFile } from '@/types'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { CalendarIcon, Plus, Trash2, ChevronDown, ChevronRight, Bold, Italic, Underline, Strikethrough, List, ListOrdered, Upload, X, File, Download, FileUp, Database } from 'lucide-react'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { labFlagOfValue, labRangeItemOf, labRangeText } from '@/utils/labRanges'

interface CRFSectionLike {
  id: string
  title: string
  description?: string
  order: number
}

interface CRFFormRendererProps {
  sections?: CRFSectionLike[]
  fields: CRFField[]
  initialData?: Record<string, unknown>
  onChange?: (data: Record<string, unknown>) => void
  readOnly?: boolean
  /** 字段布局：vertical=标签在上控件在下（默认）；horizontal=标签在左控件在右（宽控件自动整行） */
  fieldLayout?: 'vertical' | 'horizontal'
  /** 实验室检查模式：提供后在检验表格工具栏显示「上传参考范围」按钮（执行人员上传，上传后全端同步） */
  onUploadLabRanges?: (field: CRFField) => void
}

function SignatureCanvas({
  value,
  onChange,
  readOnly,
}: {
  value: string
  onChange: (v: string) => void
  readOnly: boolean
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    if ('touches' in e) {
      const t = e.touches[0] || e.changedTouches[0]
      return { x: t.clientX - rect.left, y: t.clientY - rect.top }
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    if (readOnly) return
    e.preventDefault()
    setIsDrawing(true)
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const pos = getPos(e)
    ctx.beginPath()
    ctx.moveTo(pos.x, pos.y)
  }

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || readOnly) return
    e.preventDefault()
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const pos = getPos(e)
    ctx.lineTo(pos.x, pos.y)
    ctx.strokeStyle = '#0f766e'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.stroke()
  }

  const endDraw = () => {
    if (!isDrawing) return
    setIsDrawing(false)
    const canvas = canvasRef.current
    if (!canvas) return
    onChange(canvas.toDataURL('image/png'))
  }

  const clear = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    onChange('')
  }

  // 当有已保存的签名值时，绘制到 canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !value) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const img = new Image()
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0)
    }
    img.src = value
  }, [])

  if (value && readOnly) {
    return (
      <div className="border border-slate-200 rounded-md p-2 bg-white">
        <img src={value} alt="签名" className="max-w-full h-auto" />
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="border border-slate-200 rounded-md bg-white overflow-hidden">
        <canvas
          ref={canvasRef}
          width={400}
          height={120}
          className="w-full cursor-crosshair touch-none"
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={endDraw}
          style={{ background: '#fafafa' }}
        />
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" className="text-xs h-7" onClick={clear} disabled={readOnly}>
          <Trash2 className="w-3 h-3 mr-1" /> 清除签名
        </Button>
        {value && <span className="text-[10px] text-green-600">✓ 已签名</span>}
      </div>
    </div>
  )
}

// ==================== 树形选择组件 ====================
function TreeSelect({
  value,
  options,
  onChange,
  readOnly,
  placeholder,
}: {
  value: string
  options: TreeOption[]
  onChange: (v: string) => void
  readOnly: boolean
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const toggle = (v: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(v)) next.delete(v)
      else next.add(v)
      return next
    })
  }

  // 查找选中项的标签路径（如：心脏疾病 / 心力衰竭）
  const findPath = (nodes: TreeOption[], val: string, trail: string[] = []): string[] | null => {
    for (const n of nodes) {
      const t = [...trail, n.label]
      if (n.value === val) return t
      if (n.children) {
        const r = findPath(n.children, val, t)
        if (r) return r
      }
    }
    return null
  }
  const selectedLabel = value ? findPath(options, value)?.join(' / ') : null

  const renderNodes = (nodes: TreeOption[], depth: number): React.ReactNode =>
    nodes.map((n) => (
      <div key={n.value}>
        <div
          className="flex items-center gap-1 py-1.5 pr-2 rounded cursor-pointer hover:bg-teal-50 text-sm text-slate-700"
          style={{ paddingLeft: depth * 18 + 8 }}
        >
          {n.children && n.children.length > 0 ? (
            <button
              type="button"
              className="w-4 h-4 flex items-center justify-center text-slate-400 hover:text-teal-600 flex-shrink-0"
              onClick={(e) => {
                e.stopPropagation()
                toggle(n.value)
              }}
            >
              {expanded.has(n.value) ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
            </button>
          ) : (
            <span className="w-4 flex-shrink-0" />
          )}
          <span
            className={`flex-1 ${value === n.value ? 'text-teal-600 font-medium' : ''}`}
            onClick={() => {
              if (readOnly) return
              if (n.children && n.children.length > 0) {
                toggle(n.value)
                return
              }
              onChange(n.value)
              setOpen(false)
            }}
          >
            {n.label}
          </span>
        </div>
        {n.children && expanded.has(n.value) && renderNodes(n.children, depth + 1)}
      </div>
    ))

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn('w-full justify-start text-left font-normal', !selectedLabel && 'text-muted-foreground')}
          disabled={readOnly}
        >
          {selectedLabel || placeholder || '请选择'}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 max-h-64 overflow-y-auto p-1" align="start">
        {options.length === 0 ? (
          <p className="text-xs text-slate-400 p-3 text-center">暂无选项，请在字段配置中添加树形选项</p>
        ) : (
          renderNodes(options, 0)
        )}
      </PopoverContent>
    </Popover>
  )
}

// ==================== 富文本编辑器 ====================
function RichTextEditor({
  value,
  onChange,
  readOnly,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  readOnly: boolean
  placeholder?: string
}) {
  const editorRef = useRef<HTMLDivElement>(null)

  // 外部值变化且编辑器未聚焦时同步内容，避免输入过程中光标跳动
  useEffect(() => {
    const el = editorRef.current
    if (!el || readOnly) return
    if (document.activeElement !== el && el.innerHTML !== value) {
      el.innerHTML = value || ''
    }
  }, [value, readOnly])

  if (readOnly) {
    return value ? (
      <div
        className="text-sm text-slate-700 bg-slate-50 border border-slate-100 rounded-md p-3 min-h-[60px] [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
        dangerouslySetInnerHTML={{ __html: value }}
      />
    ) : (
      <div className="text-sm text-slate-400 bg-slate-50 border border-slate-100 rounded-md p-3">（未填写）</div>
    )
  }

  const exec = (cmd: string) => {
    editorRef.current?.focus()
    document.execCommand(cmd, false)
    if (editorRef.current) onChange(editorRef.current.innerHTML)
  }

  const tools: { icon: React.ReactNode; cmd: string; title: string }[] = [
    { icon: <Bold className="w-3.5 h-3.5" />, cmd: 'bold', title: '加粗' },
    { icon: <Italic className="w-3.5 h-3.5" />, cmd: 'italic', title: '斜体' },
    { icon: <Underline className="w-3.5 h-3.5" />, cmd: 'underline', title: '下划线' },
    { icon: <Strikethrough className="w-3.5 h-3.5" />, cmd: 'strikeThrough', title: '删除线' },
    { icon: <List className="w-3.5 h-3.5" />, cmd: 'insertUnorderedList', title: '无序列表' },
    { icon: <ListOrdered className="w-3.5 h-3.5" />, cmd: 'insertOrderedList', title: '有序列表' },
  ]

  return (
    <div className="border border-input rounded-md overflow-hidden focus-within:ring-1 focus-within:ring-teal-500">
      <div className="flex items-center gap-0.5 px-2 py-1 bg-slate-50 border-b border-slate-200">
        {tools.map((t) => (
          <button
            key={t.cmd}
            type="button"
            title={t.title}
            className="w-7 h-7 flex items-center justify-center rounded text-slate-500 hover:bg-slate-200 hover:text-slate-700"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => exec(t.cmd)}
          >
            {t.icon}
          </button>
        ))}
      </div>
      <div className="relative">
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          className="min-h-[96px] max-h-64 overflow-y-auto px-3 py-2 text-sm text-slate-700 outline-none [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
          onInput={() => {
            if (editorRef.current) onChange(editorRef.current.innerHTML)
          }}
          data-placeholder={placeholder || '请输入内容，支持加粗、列表等简单排版...'}
        />
        {!value && (
          <span className="absolute left-3 top-2 text-sm text-slate-400 pointer-events-none">
            {placeholder || '请输入内容，支持加粗、列表等简单排版...'}
          </span>
        )}
      </div>
    </div>
  )
}

// ==================== 文件上传 ====================
const FILE_MAX_MB = 5

function FileUploadInput({
  value,
  onChange,
  readOnly,
}: {
  value: UploadedFile[]
  onChange: (v: UploadedFile[]) => void
  readOnly: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState('')

  const fmtSize = (bytes: number) =>
    bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return
    setError('')
    const list = Array.from(files)
    const oversize = list.find((f) => f.size > FILE_MAX_MB * 1024 * 1024)
    if (oversize) {
      setError(`「${oversize.name}」超过 ${FILE_MAX_MB}MB 限制，已跳过`)
      return
    }
    Promise.all(
      list.map(
        (f) =>
          new Promise<UploadedFile>((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () =>
              resolve({ name: f.name, size: f.size, type: f.type, dataUrl: String(reader.result) })
            reader.onerror = reject
            reader.readAsDataURL(f)
          })
      )
    ).then((loaded) => onChange([...value, ...loaded]))
  }

  return (
    <div className="space-y-2">
      {!readOnly && (
        <>
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
            onChange={(e) => {
              handleFiles(e.target.files)
              e.target.value = ''
            }}
          />
          <button
            type="button"
            className="w-full flex items-center justify-center gap-2 px-3 py-5 border border-dashed border-slate-300 rounded-md text-sm text-slate-500 hover:border-teal-400 hover:text-teal-600 hover:bg-teal-50/40 transition-colors"
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="w-4 h-4" />
            点击上传附件（图片 / PDF / Office，单个不超过 {FILE_MAX_MB}MB）
          </button>
          {error && <p className="text-xs text-red-500">{error}</p>}
        </>
      )}
      {value.length > 0 && (
        <div className="space-y-1.5">
          {value.map((f, idx) => (
            <div
              key={idx}
              className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-100 rounded-md text-sm"
            >
              <File className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <span className="flex-1 truncate text-slate-700">{f.name}</span>
              <span className="text-xs text-slate-400 flex-shrink-0">{fmtSize(f.size)}</span>
              <a
                href={f.dataUrl}
                download={f.name}
                className="text-slate-400 hover:text-teal-600 flex-shrink-0"
                title="下载"
              >
                <Download className="w-4 h-4" />
              </a>
              {!readOnly && (
                <button
                  type="button"
                  className="text-slate-400 hover:text-red-500 flex-shrink-0"
                  title="删除"
                  onClick={() => onChange(value.filter((_, i) => i !== idx))}
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      {value.length === 0 && readOnly && (
        <div className="text-sm text-slate-400 bg-slate-50 border border-slate-100 rounded-md p-3">（无附件）</div>
      )}
    </div>
  )
}

export default function CRFFormRenderer({
  sections,
  fields,
  initialData = {},
  onChange,
  readOnly = false,
  fieldLayout = 'vertical',
  onUploadLabRanges,
}: CRFFormRendererProps) {
  const [data, setData] = useState<Record<string, unknown>>(initialData)
  // HIS 自动填充状态：pending=待确认 confirmed=已确认（原型为模拟抓取，部署期由数据集成服务写入）
  const [autoFill, setAutoFill] = useState<Record<string, 'pending' | 'confirmed'>>({})

  const mockValueFor = (field: CRFField): unknown => {
    switch (field.type) {
      case 'number':
        return 120
      case 'date':
        return format(new Date(), 'yyyy-MM-dd')
      case 'select':
      case 'radio':
        return field.options?.[0]?.value ?? ''
      case 'checkbox':
        return field.options?.[0] ? [field.options[0].value] : []
      case 'textarea':
        return '由医院系统自动填充的示例文本'
      default:
        return '自动填充值'
    }
  }

  const simulateFetch = (field: CRFField) => {
    if (readOnly) return
    const next = { ...data, [field.name]: mockValueFor(field) }
    setData(next)
    onChange?.(next)
    setAutoFill((s) => ({ ...s, [field.name]: 'pending' }))
  }

  const confirmAutoFill = (name: string) => setAutoFill((s) => ({ ...s, [name]: 'confirmed' }))

  /** 外部填充字段的状态徽标 + 操作（模拟抓取 / 确认） */
  const autoFillNode = (field: CRFField) => {
    if (!field.externalFill?.enabled || readOnly) return null
    const st = autoFill[field.name]
    return (
      <div className="mt-1.5 flex items-center gap-2">
        {st === 'pending' ? (
          <>
            <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
              <Database className="w-3 h-3" /> HIS 自动填充 · 待确认
            </span>
            <button type="button" className="text-[10px] text-teal-600 hover:underline" onClick={() => confirmAutoFill(field.name)}>
              确认无误
            </button>
          </>
        ) : st === 'confirmed' ? (
          <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600 border border-emerald-200">
            <Database className="w-3 h-3" /> HIS 自动填充 · 已确认
          </span>
        ) : (
          <button
            type="button"
            className="inline-flex items-center gap-1 text-[10px] text-cyan-600 hover:underline"
            onClick={() => simulateFetch(field)}
            title={field.externalFill.sourceField ? `映射：${field.externalFill.sourceField}` : '模拟从医院系统抓取'}
          >
            <Database className="w-3 h-3" /> 模拟抓取填充
          </button>
        )}
      </div>
    )
  }

  const updateField = (name: string, value: unknown) => {
    if (readOnly) return
    const next = { ...data, [name]: value }
    setData(next)
    onChange?.(next)
  }

  const updateExtraInput = (fieldName: string, optionValue: string, extraValue: string) => {
    if (readOnly) return
    const key = `${fieldName}_extra_${optionValue}`
    const next = { ...data, [key]: extraValue }
    setData(next)
    onChange?.(next)
  }

  const shouldShowField = (field: CRFField): boolean => {
    if (!field.showIf) return true
    const { fieldName, operator, value } = field.showIf
    const dependentValue = data[fieldName]
    switch (operator) {
      case 'equals':
        return String(dependentValue) === value
      case 'notEquals':
        return String(dependentValue) !== value
      case 'contains':
        return String(dependentValue).includes(value || '')
      case 'notEmpty':
        return dependentValue !== undefined && dependentValue !== '' && dependentValue !== null
      default:
        return true
    }
  }

  const renderField = (field: CRFField) => {
    const value = data[field.name]
    const commonProps = {
      id: field.name,
      name: field.name,
      disabled: readOnly,
      placeholder: field.placeholder,
    }

    switch (field.type) {
      case 'text':
        return (
          <Input
            {...commonProps}
            value={(value as string) || ''}
            onChange={(e) => updateField(field.name, e.target.value)}
          />
        )

      case 'textarea':
        return (
          <Textarea
            {...commonProps}
            rows={4}
            value={(value as string) || ''}
            onChange={(e) => updateField(field.name, e.target.value)}
          />
        )

      case 'number':
        return (
          <div className="flex items-center gap-2">
            <Input
              {...commonProps}
              type="number"
              step={field.decimals !== undefined ? Math.pow(10, -field.decimals) : undefined}
              value={value !== undefined ? String(value) : ''}
              onChange={(e) => {
                const v = e.target.value === '' ? undefined : Number(e.target.value)
                updateField(field.name, v)
              }}
              onBlur={(e) => {
                if (field.decimals !== undefined && e.target.value !== '') {
                  updateField(field.name, Number(Number(e.target.value).toFixed(field.decimals)))
                }
              }}
            />
            {field.unit && (
              <span className="text-sm text-slate-500 whitespace-nowrap">{field.unit}</span>
            )}
          </div>
        )

      case 'date':
        return (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  'w-full justify-start text-left font-normal',
                  !value && 'text-muted-foreground'
                )}
                disabled={readOnly}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {value ? format(new Date(value as string), 'yyyy-MM-dd', { locale: zhCN }) : '选择日期'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={value ? new Date(value as string) : undefined}
                onSelect={(date) => updateField(field.name, date?.toISOString())}
                locale={zhCN}
              />
            </PopoverContent>
          </Popover>
        )

      case 'datetime':
        return (
          <Input
            {...commonProps}
            type="datetime-local"
            value={(value as string) || ''}
            onChange={(e) => updateField(field.name, e.target.value || undefined)}
          />
        )

      case 'dateRange': {
        const rv = Array.isArray(value) ? (value as (string | undefined)[]) : []
        return (
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={rv[0] || ''}
              onChange={(e) => updateField(field.name, [e.target.value || undefined, rv[1]])}
              disabled={readOnly}
              className="text-sm"
            />
            <span className="text-slate-400 text-sm whitespace-nowrap">至</span>
            <Input
              type="date"
              value={rv[1] || ''}
              min={rv[0] || undefined}
              onChange={(e) => updateField(field.name, [rv[0], e.target.value || undefined])}
              disabled={readOnly}
              className="text-sm"
            />
          </div>
        )
      }

      case 'select': {
        const selectedOpt = field.options?.find((opt) => opt.value === value)
        const extraKey = `${field.name}_extra_${value}`
        const extraValue = (data[extraKey] as string) || ''
        return (
          <div className="space-y-2">
            <Select
              value={(value as string) || ''}
              onValueChange={(v) => updateField(field.name, v)}
              disabled={readOnly}
            >
              <SelectTrigger>
                <SelectValue placeholder={field.placeholder || '请选择'} />
              </SelectTrigger>
              <SelectContent>
                {field.options?.map((opt: FieldOption) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedOpt?.hasExtraInput && (
              <Input
                placeholder={selectedOpt.extraInputPlaceholder || selectedOpt.extraInputLabel || '请补充说明'}
                value={extraValue}
                onChange={(e) => updateExtraInput(field.name, value as string, e.target.value)}
                disabled={readOnly}
                className="text-sm"
              />
            )}
          </div>
        )
      }

      case 'radio': {
        const selectedRadioOpt = field.options?.find((opt) => opt.value === value)
        const radioExtraKey = `${field.name}_extra_${value}`
        const radioExtraValue = (data[radioExtraKey] as string) || ''
        return (
          <div className="space-y-2">
            <RadioGroup
              value={(value as string) || ''}
              onValueChange={(v) => updateField(field.name, v)}
              disabled={readOnly}
              className="flex flex-col gap-2"
            >
              {field.options?.map((opt: FieldOption) => (
                <div key={opt.value} className="flex items-center space-x-2">
                  <RadioGroupItem value={opt.value} id={`${field.name}-${opt.value}`} />
                  <Label htmlFor={`${field.name}-${opt.value}`} className="font-normal cursor-pointer">
                    {opt.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
            {selectedRadioOpt?.hasExtraInput && (
              <Input
                placeholder={selectedRadioOpt.extraInputPlaceholder || selectedRadioOpt.extraInputLabel || '请补充说明'}
                value={radioExtraValue}
                onChange={(e) => updateExtraInput(field.name, value as string, e.target.value)}
                disabled={readOnly}
                className="text-sm mt-1"
              />
            )}
          </div>
        )
      }

      case 'checkbox': {
        const arr = Array.isArray(value) ? (value as string[]) : []
        return (
          <div className="flex flex-col gap-2">
            {field.options?.map((opt: FieldOption) => {
              const isChecked = arr.includes(opt.value)
              const cbExtraKey = `${field.name}_extra_${opt.value}`
              const cbExtraValue = (data[cbExtraKey] as string) || ''
              return (
                <div key={opt.value} className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id={`${field.name}-${opt.value}`}
                      checked={isChecked}
                      onCheckedChange={(checked) => {
                        const next = checked
                          ? [...arr, opt.value]
                          : arr.filter((v) => v !== opt.value)
                        updateField(field.name, next)
                      }}
                      disabled={readOnly}
                    />
                    <Label htmlFor={`${field.name}-${opt.value}`} className="font-normal cursor-pointer">
                      {opt.label}
                    </Label>
                  </div>
                  {isChecked && opt.hasExtraInput && (
                    <Input
                      placeholder={opt.extraInputPlaceholder || opt.extraInputLabel || '请补充说明'}
                      value={cbExtraValue}
                      onChange={(e) => updateExtraInput(field.name, opt.value, e.target.value)}
                      disabled={readOnly}
                      className="text-sm ml-6 w-auto"
                    />
                  )}
                </div>
              )
            })}
          </div>
        )
      }

      case 'treeSelect':
        return (
          <TreeSelect
            value={(value as string) || ''}
            options={field.treeOptions || []}
            onChange={(v) => updateField(field.name, v)}
            readOnly={readOnly}
            placeholder={field.placeholder}
          />
        )

      case 'richText':
        return (
          <RichTextEditor
            value={(value as string) || ''}
            onChange={(v) => updateField(field.name, v)}
            readOnly={readOnly}
            placeholder={field.placeholder}
          />
        )

      case 'fileUpload':
        return (
          <FileUploadInput
            value={Array.isArray(value) ? (value as UploadedFile[]) : []}
            onChange={(v) => updateField(field.name, v)}
            readOnly={readOnly}
          />
        )

      case 'toggle':
        return (
          <div className="flex items-center space-x-2">
            <Switch
              id={field.name}
              checked={!!value}
              onCheckedChange={(v) => updateField(field.name, v)}
              disabled={readOnly}
            />
            <Label htmlFor={field.name} className="font-normal">
              {value ? '是' : '否'}
            </Label>
          </div>
        )

      case 'label':
        return (
          <div className="text-sm text-slate-600 bg-slate-50 p-3 rounded-md border border-slate-100">
            {field.helpText || field.label}
          </div>
        )

      case 'table': {
        const storedRows = Array.isArray(value) ? (value as Record<string, unknown>[]) : []
        const cols = field.columns || []
        // 实验室检查模式：行=设计时预置的检验项目（固定，不可增删）；参考范围由执行人员上传后据此判定
        // 数值列未显式指定时，自动取第一个数字列
        const labRaw = field.labConfig
        const labValueCol = labRaw?.valueCol || cols.find((c) => c.type === 'number')?.name || ''
        const lab = labRaw && labRaw.itemCol && labValueCol ? { ...labRaw, valueCol: labValueCol } : undefined
        // 预置项目清单：优先设计时配置的 items；兼容旧数据（从已上传范围套取并集）
        const labItems = lab
          ? (lab.items && lab.items.length > 0
              ? lab.items
              : Array.from(new Map(lab.sets.flatMap((s) => s.items).map((it) => [it.name, it])).values()))
          : []
        // 检测日期列：labConfig.dateCol 或第一个日期列（生效日期判定依据：检测日期当天及以后适用新版本）
        const labDateCol = lab?.dateCol || cols.find((c) => c.type === 'date')?.name || ''
        const rowDateOf = (row?: Record<string, unknown>) =>
          (row && labDateCol ? (row[labDateCol] as string | undefined) : undefined) || undefined
        // 当前行适用范围：按该行检测日期解析生效版本（未上传则无判定依据）
        const labRangeOf = (itemName: unknown, row?: Record<string, unknown>) =>
          labRangeItemOf(lab?.sets ?? [], itemName, rowDateOf(row))
        // 通用 单位/正常值范围 列（不要求实验室模式）：范围来源=labConfig.sets（实验室）或 rangeSets（普通表格），行定位=项目列/预置行首列/第一个文本列
        const rangeSets = field.labConfig?.sets ?? field.rangeSets ?? []
        const rangeItemCol =
          field.labConfig?.itemCol || field.rowPreset?.col || cols.find((c) => c.type === 'text')?.name || ''
        const rangeItemOf = (row: Record<string, unknown>) =>
          rangeItemCol ? labRangeItemOf(rangeSets, row[rangeItemCol], rowDateOf(row)) : undefined
        // 预置行（通用）：首列内容设计端固定，录入端行不可增删、首列只读（实验室模式本身即预置行，互斥）
        const preset = !lab && field.rowPreset && field.rowPreset.col ? field.rowPreset : undefined
        const rows =
          lab
            ? labItems
                .filter((it) => it.name)
                .map((it) => storedRows.find((r) => r[lab.itemCol] === it.name) ?? { [lab.itemCol]: it.name })
            : preset
              ? preset.rows
                  .filter((n) => n)
                  .map((n) => storedRows.find((r) => r[preset.col] === n) ?? { [preset.col]: n })
              : storedRows
        // 偏离判定：high=偏高 low=偏低 normal=正常（无已上传范围时不判定）；按行检测日期匹配生效版本
        const labFlagOf = (itemName: unknown, v: unknown, row?: Record<string, unknown>): 'high' | 'low' | 'normal' | null =>
          labFlagOfValue(labRangeOf(itemName, row), v)
        // 表格级自动状态：日期列有值→filledText，为空→emptyText（写入状态列，只读展示）
        const autoSt = field.autoStatus
        const applyAutoStatus = (nr: Record<string, unknown>) => {
          if (!autoSt) return
          const sv = nr[autoSt.dateCol]
          const has = sv !== undefined && sv !== null && sv !== ''
          nr[autoSt.statusCol] = has ? (autoSt.filledText || '已结束') : (autoSt.emptyText || '持续中')
        }
        const addRow = () => {
          const newRow: Record<string, unknown> = {}
          cols.forEach((col) => {
            if (col.defaultValue !== undefined) newRow[col.name] = col.defaultValue
            // 自动状态列：新行初始化为「空值态」文本
            if (col.autoStatusFrom !== undefined) newRow[col.name] = col.autoStatusEmpty || '持续中'
            // 自动编号列：新行自动取下一个行号
            if (col.autoNumber) newRow[col.name] = rows.length + 1
          })
          applyAutoStatus(newRow)
          updateField(field.name, [...rows, newRow])
        }
        const removeRow = (idx: number) => {
          const next = [...rows]
          next.splice(idx, 1)
          // 自动编号列：删除行后重新顺排
          const autoCols = cols.filter((c) => c.autoNumber)
          if (autoCols.length > 0) {
            next.forEach((r, i) => autoCols.forEach((c) => { r[c.name] = i + 1 }))
          }
          updateField(field.name, next)
        }
        const updateCell = (rowIdx: number, colName: string, val: unknown) => {
          // 预置行/实验室模式：按首列内容定位存储行（展示行可能多于已存行）
          const lockCol = lab?.itemCol ?? preset?.col
          if (lockCol) {
            const keyVal = rows[rowIdx]?.[lockCol]
            const si = storedRows.findIndex((r) => r[lockCol] === keyVal)
            const base = si >= 0 ? { ...storedRows[si] } : { [lockCol]: keyVal }
            const nr = { ...base, [colName]: val }
            cols.forEach((c) => {
              if (c.autoStatusFrom !== undefined) {
                const sv = nr[c.autoStatusFrom]
                const has = sv !== undefined && sv !== null && sv !== ''
                nr[c.name] = has ? (c.autoStatusFilled || '已结束') : (c.autoStatusEmpty || '持续中')
              }
            })
            applyAutoStatus(nr)
            const next = si >= 0 ? storedRows.map((r, i) => (i === si ? nr : r)) : [...storedRows, nr]
            updateField(field.name, next)
            return
          }
          const next = rows.map((r, i) => {
            if (i !== rowIdx) return r
            const nr = { ...r, [colName]: val }
            // 自动状态列：随绑定的源列（如结束日期）实时重算
            cols.forEach((c) => {
              if (c.autoStatusFrom !== undefined) {
                const sv = nr[c.autoStatusFrom]
                const has = sv !== undefined && sv !== null && sv !== ''
                nr[c.name] = has ? (c.autoStatusFilled || '已结束') : (c.autoStatusEmpty || '持续中')
              }
            })
            applyAutoStatus(nr)
            return nr
          })
          updateField(field.name, next)
        }
        const renderCellInput = (col: CRFField, row: Record<string, unknown>, rowIdx: number) => {
          const cellValue = row[col.name]
          // 实验室模式·项目列：只读项目名 + 单位（单位优先取当前行生效参考范围，上传后自动同步）
          if (lab && col.name === lab.itemCol) {
            const item = labRangeOf(cellValue, row) ?? labItems.find((it) => it.name === cellValue)
            return (
              <div className="flex items-baseline gap-1 whitespace-nowrap">
                <span className="text-xs font-medium text-slate-700">{String(cellValue ?? '')}</span>
                {item?.unit && <span className="text-[10px] text-slate-400">({item.unit})</span>}
              </div>
            )
          }
          // 预置行·首列：只读固定内容
          if (preset && col.name === preset.col) {
            return (
              <span className="text-xs font-medium text-slate-700 whitespace-nowrap">{String(cellValue ?? '')}</span>
            )
          }
          // 通用·单位列（列类型=单位）：只读，按行项目+检测日期从已上传范围自动带出
          if (col.type === 'unit') {
            const item = rangeItemOf(row)
            return (
              <span
                className="text-xs text-slate-500 whitespace-nowrap"
                title={item?.setName ? `来源：${item.setName}` : '执行人员上传参考范围后自动显示'}
              >
                {item?.unit ?? <span className="text-slate-300">—</span>}
              </span>
            )
          }
          // 通用·正常值范围列（列类型=正常值范围）：只读，按行项目+检测日期自动匹配生效版本
          if (col.type === 'range') {
            const item = rangeItemOf(row)
            const text = labRangeText(item)
            return (
              <span
                className="text-xs text-slate-500 whitespace-nowrap"
                title={item?.setName ? `判定依据：${item.setName}` : '执行人员上传参考范围后自动显示'}
              >
                {text || <span className="text-slate-300">—</span>}
              </span>
            )
          }
          // 实验室模式·正常值范围列（旧版 rangeCol 配置，兼容）：只读，自动显示当前行生效范围
          if (lab && lab.rangeCol && col.name === lab.rangeCol) {
            const item = labRangeOf(row[lab.itemCol], row)
            return (
              <span className="text-xs text-slate-500 whitespace-nowrap" title={item?.setName ? `判定依据：${item.setName}` : undefined}>
                {item && (item.low !== undefined || item.high !== undefined)
                  ? `${item.low ?? '—'}~${item.high ?? '—'}${item.unit ? ` ${item.unit}` : ''}`
                  : <span className="text-slate-300">—</span>}
              </span>
            )
          }
          // 通用·判定状态列（列类型=判定状态）：只读，按数值列与该行生效范围自动判定（↑偏高红 / ↓偏低蓝）
          if (col.type === 'flag') {
            const valueColName = field.labConfig?.valueCol || cols.find((c) => c.type === 'number')?.name || ''
            const flag = labFlagOfValue(rangeItemOf(row), valueColName ? row[valueColName] : undefined)
            if (flag === 'high') {
              return (
                <span className="inline-flex items-center gap-0.5 text-red-500 text-[11px] font-bold whitespace-nowrap" title="高于参考上限">
                  ↑<span className="font-medium">偏高</span>
                </span>
              )
            }
            if (flag === 'low') {
              return (
                <span className="inline-flex items-center gap-0.5 text-sky-600 text-[11px] font-bold whitespace-nowrap" title="低于参考下限">
                  ↓<span className="font-medium">偏低</span>
                </span>
              )
            }
            return <span className="text-[11px] text-slate-300">—</span>
          }
          // 实验室模式·状态列（旧版 flagCol 配置，兼容）：只读，系统按检测值与范围自动判定（↑偏高红 / ↓偏低蓝）
          if (lab && lab.flagCol && col.name === lab.flagCol) {
            const flag = labFlagOf(row[lab.itemCol], row[lab.valueCol], row)
            if (flag === 'high') {
              return (
                <span className="inline-flex items-center gap-0.5 text-red-500 text-[11px] font-bold whitespace-nowrap" title="高于参考上限">
                  ↑<span className="font-medium">偏高</span>
                </span>
              )
            }
            if (flag === 'low') {
              return (
                <span className="inline-flex items-center gap-0.5 text-sky-600 text-[11px] font-bold whitespace-nowrap" title="低于参考下限">
                  ↓<span className="font-medium">偏低</span>
                </span>
              )
            }
            return <span className="text-[11px] text-slate-300">—</span>
          }
          // 实验室模式·数值列：输入框 + 偏离箭头（↑偏高红 / ↓偏低蓝）+ 参考范围
          if (lab && col.name === lab.valueCol) {
            const flag = labFlagOf(row[lab.itemCol], cellValue, row)
            const item = labRangeOf(row[lab.itemCol], row)
            return (
              <div className="space-y-0.5">
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    disabled={readOnly}
                    value={cellValue !== undefined ? String(cellValue) : ''}
                    onChange={(e) => {
                      const v = e.target.value === '' ? undefined : Number(e.target.value)
                      updateCell(rowIdx, col.name, v)
                    }}
                    className={`h-8 text-xs ${
                      flag === 'high' ? 'border-red-300 text-red-600 font-semibold'
                      : flag === 'low' ? 'border-sky-300 text-sky-600 font-semibold'
                      : ''
                    }`}
                  />
                  {flag === 'high' && (
                    <span className="inline-flex items-center gap-0.5 text-red-500 text-[11px] font-bold whitespace-nowrap" title="高于参考上限">
                      ↑<span className="font-medium">偏高</span>
                    </span>
                  )}
                  {flag === 'low' && (
                    <span className="inline-flex items-center gap-0.5 text-sky-600 text-[11px] font-bold whitespace-nowrap" title="低于参考下限">
                      ↓<span className="font-medium">偏低</span>
                    </span>
                  )}
                </div>
                {!lab.rangeCol && item && (item.low !== undefined || item.high !== undefined) && (
                  <div className="text-[10px] text-slate-400 whitespace-nowrap">
                    参考 {item.low ?? '—'}~{item.high ?? '—'}{item.unit ? ` ${item.unit}` : ''}
                  </div>
                )}
              </div>
            )
          }
          // 自动编号列：只读，显示当前行号（不依赖存储值，兼容历史数据）
          if (col.autoNumber) {
            return (
              <span
                className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-[11px] font-semibold text-slate-500"
                title="自动编号，随行号自动更新"
              >
                {rowIdx + 1}
              </span>
            )
          }
          // 表格级自动状态列：只读徽标，由日期列推导（不依赖存储值，兼容历史数据）
          if (autoSt && col.name === autoSt.statusCol) {
            const sv = row[autoSt.dateCol]
            const has = sv !== undefined && sv !== null && sv !== ''
            const text = has ? (autoSt.filledText || '已结束') : (autoSt.emptyText || '持续中')
            return (
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap ${
                  has ? 'bg-slate-100 text-slate-500' : 'bg-green-50 text-green-600'
                }`}
                title={`由「${cols.find((c) => c.name === autoSt.dateCol)?.label ?? autoSt.dateCol}」自动推导`}
              >
                {text}
              </span>
            )
          }
          // 自动状态列：只读徽标，显示由源列推导（不依赖存储值，兼容历史数据）
          if (col.autoStatusFrom !== undefined) {
            const sv = row[col.autoStatusFrom]
            const has = sv !== undefined && sv !== null && sv !== ''
            const text = has ? (col.autoStatusFilled || '已结束') : (col.autoStatusEmpty || '持续中')
            return (
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap ${
                  has ? 'bg-slate-100 text-slate-500' : 'bg-green-50 text-green-600'
                }`}
                title={`由「${cols.find((c) => c.name === col.autoStatusFrom)?.label ?? col.autoStatusFrom}」自动推导`}
              >
                {text}
              </span>
            )
          }
          const cellProps = {
            disabled: readOnly,
            placeholder: col.placeholder,
          }
          switch (col.type) {
            case 'text':
              return (
                <Input
                  {...cellProps}
                  value={(cellValue as string) || ''}
                  onChange={(e) => updateCell(rowIdx, col.name, e.target.value)}
                  className="h-8 text-xs"
                />
              )
            case 'number':
              return (
                <Input
                  {...cellProps}
                  type="number"
                  step={col.decimals !== undefined ? Math.pow(10, -col.decimals) : undefined}
                  value={cellValue !== undefined ? String(cellValue) : ''}
                  onChange={(e) => {
                    const v = e.target.value === '' ? undefined : Number(e.target.value)
                    updateCell(rowIdx, col.name, v)
                  }}
                  onBlur={(e) => {
                    if (col.decimals !== undefined && e.target.value !== '') {
                      updateCell(rowIdx, col.name, Number(Number(e.target.value).toFixed(col.decimals)))
                    }
                  }}
                  className="h-8 text-xs"
                />
              )
            case 'date':
              return (
                <Input
                  {...cellProps}
                  type="date"
                  value={(cellValue as string) || ''}
                  onChange={(e) => updateCell(rowIdx, col.name, e.target.value)}
                  className="h-8 text-xs"
                />
              )
            case 'select':
              return (
                <Select
                  value={(cellValue as string) || ''}
                  onValueChange={(v) => updateCell(rowIdx, col.name, v)}
                  disabled={readOnly}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder={col.placeholder || '请选择'} />
                  </SelectTrigger>
                  <SelectContent>
                    {col.options?.map((opt: FieldOption) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )
            case 'textarea':
              return (
                <Textarea
                  {...cellProps}
                  rows={2}
                  value={(cellValue as string) || ''}
                  onChange={(e) => updateCell(rowIdx, col.name, e.target.value)}
                  className="text-xs min-h-0"
                />
              )
            case 'toggle':
              return (
                <Switch
                  checked={!!cellValue}
                  onCheckedChange={(v) => updateCell(rowIdx, col.name, v)}
                  disabled={readOnly}
                />
              )
            case 'radio':
              return (
                <RadioGroup
                  value={(cellValue as string) || ''}
                  onValueChange={(v) => updateCell(rowIdx, col.name, v)}
                  disabled={readOnly}
                  className="flex flex-col gap-1"
                >
                  {col.options?.map((opt: FieldOption) => (
                    <div key={opt.value} className="flex items-center space-x-1.5">
                      <RadioGroupItem value={opt.value} id={`${field.name}-${rowIdx}-${col.name}-${opt.value}`} />
                      <Label
                        htmlFor={`${field.name}-${rowIdx}-${col.name}-${opt.value}`}
                        className="font-normal text-xs cursor-pointer"
                      >
                        {opt.label}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              )
            case 'checkbox': {
              const arr = Array.isArray(cellValue) ? (cellValue as string[]) : []
              return (
                <div className="flex flex-col gap-1">
                  {col.options?.map((opt: FieldOption) => (
                    <div key={opt.value} className="flex items-center space-x-1.5">
                      <Checkbox
                        id={`${field.name}-${rowIdx}-${col.name}-${opt.value}`}
                        checked={arr.includes(opt.value)}
                        onCheckedChange={(checked) => {
                          const next = checked
                            ? [...arr, opt.value]
                            : arr.filter((v) => v !== opt.value)
                          updateCell(rowIdx, col.name, next)
                        }}
                        disabled={readOnly}
                      />
                      <Label
                        htmlFor={`${field.name}-${rowIdx}-${col.name}-${opt.value}`}
                        className="font-normal text-xs cursor-pointer"
                      >
                        {opt.label}
                      </Label>
                    </div>
                  ))}
                </div>
              )
            }
            case 'datetime':
              return (
                <Input
                  {...cellProps}
                  type="datetime-local"
                  value={(cellValue as string) || ''}
                  onChange={(e) => updateCell(rowIdx, col.name, e.target.value || undefined)}
                  className="h-8 text-xs"
                />
              )
            case 'treeSelect':
              return (
                <TreeSelect
                  value={(cellValue as string) || ''}
                  options={col.treeOptions || []}
                  onChange={(v) => updateCell(rowIdx, col.name, v)}
                  readOnly={readOnly}
                  placeholder={col.placeholder}
                />
              )
            default:
              return (
                <Input {...cellProps} disabled placeholder={`${col.type}`} className="h-8 text-xs" />
              )
          }
        }
        return (
          <div className="space-y-2">
            {/* 参考范围：执行人员上传，可维护多套；按检查日期自动匹配生效版本（含单位/正常值范围/判定状态列时显示） */}
            {(lab || cols.some((c) => c.type === 'unit' || c.type === 'range' || c.type === 'flag')) && (
              <div className="flex items-center justify-end gap-1.5">
                <span className="text-[10px] text-slate-400">参考范围</span>
                {rangeSets.length > 0 ? (
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500"
                    title={rangeSets.map((s) => `${s.name}${s.effectiveDate ? `（${s.effectiveDate} 起生效）` : ''}`).join('\n')}
                  >
                    共 {rangeSets.length} 套 · 按{labDateCol ? (cols.find((c) => c.name === labDateCol)?.label ?? '检查日期') : '检查日期'}自动匹配生效版本
                  </span>
                ) : (
                  <span className="text-[10px] text-amber-500">
                    暂未上传{lab ? '，暂无法判定偏高/偏低' : '，单位/正常值范围列暂无法显示'}
                  </span>
                )}
                {!readOnly && onUploadLabRanges && (
                  <Button
                    variant="outline" size="sm"
                    className="h-6 px-2 text-[10px] text-teal-600 border-teal-200 hover:bg-teal-50"
                    onClick={() => onUploadLabRanges(field)}
                  >
                    <FileUp className="w-3 h-3 mr-0.5" /> 上传参考范围
                  </Button>
                )}
              </div>
            )}
            <div className="overflow-x-auto rounded-md border border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    {field.autoRowNumber && (
                      <th className="px-2 py-1.5 text-center text-xs font-medium text-slate-600 border-b w-12">序号</th>
                    )}
                    {cols.map((col) => (
                      <th key={col.id} className="px-2 py-1.5 text-left text-xs font-medium text-slate-600 border-b whitespace-nowrap">
                        {col.label}
                        {col.validation?.required && <span className="text-red-500 ml-0.5">*</span>}
                      </th>
                    ))}
                    {!readOnly && !lab && !preset && <th className="px-2 py-1.5 text-center text-xs font-medium text-slate-600 border-b w-16">操作</th>}
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={cols.length + (readOnly || lab || preset ? 0 : 1) + (field.autoRowNumber ? 1 : 0)} className="px-2 py-4 text-center text-xs text-slate-400">
                        {lab ? '暂无预置检验项目，请在模块设计中配置' : preset ? '暂无预置行，请在模块设计中配置' : '暂无数据，点击下方按钮添加'}
                      </td>
                    </tr>
                  )}
                  {rows.map((row, rowIdx) => (
                    <tr key={rowIdx} className="border-b border-slate-100 last:border-0">
                      {field.autoRowNumber && (
                        <td className="px-2 py-1 align-top text-center">
                          <span
                            className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-[11px] font-semibold text-slate-500 mt-1"
                            title="自动序号，随行号自动更新"
                          >
                            {rowIdx + 1}
                          </span>
                        </td>
                      )}
                      {cols.map((col) => (
                        <td key={col.id} className="px-2 py-1 align-top">
                          {renderCellInput(col, row, rowIdx)}
                        </td>
                      ))}
                      {!readOnly && !lab && !preset && (
                        <td className="px-2 py-1 align-top text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-red-500 text-xs"
                            onClick={() => removeRow(rowIdx)}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!readOnly && !lab && !preset && (
              <Button variant="outline" size="sm" className="text-xs" onClick={addRow}>
                <Plus className="w-3 h-3 mr-1" /> 添加一行
              </Button>
            )}
          </div>
        )
      }

      case 'signature':
        return (
          <SignatureCanvas
            value={(value as string) || ''}
            onChange={(v) => updateField(field.name, v)}
            readOnly={readOnly}
          />
        )

      case 'scale': {
        const sc = field.scaleConfig || { min: 0, max: 10, step: 1 }
        const labels = sc.labels || []
        const numValue = value !== undefined ? Number(value) : sc.min
        return (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={sc.min}
                max={sc.max}
                step={sc.step}
                value={numValue}
                onChange={(e) => updateField(field.name, Number(e.target.value))}
                disabled={readOnly}
                className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-teal-500"
              />
              <span className="text-sm font-semibold text-teal-600 w-10 text-center">
                {numValue}
              </span>
            </div>
            {labels.length > 0 && (
              <div className="flex justify-between text-[10px] text-slate-400 px-1">
                {labels.map((l) => (
                  <span key={l.value} className={numValue === l.value ? 'text-teal-600 font-medium' : ''}>
                    {l.label}
                  </span>
                ))}
              </div>
            )}
          </div>
        )
      }

      case 'numberRange': {
        const rangeVal = Array.isArray(value) ? (value as number[]) : [undefined, undefined]
        const rv = field.validation || {}
        return (
          <div className="flex items-center gap-2">
            <Input
              type="number"
              placeholder={field.placeholder || '最小值'}
              value={rangeVal[0] !== undefined ? String(rangeVal[0]) : ''}
              min={rv.min}
              max={rv.max}
              onChange={(e) => {
                const v = e.target.value === '' ? undefined : Number(e.target.value)
                updateField(field.name, [v, rangeVal[1]])
              }}
              disabled={readOnly}
              className="text-sm"
            />
            <span className="text-slate-400 text-sm">~</span>
            <Input
              type="number"
              placeholder={field.placeholder || '最大值'}
              value={rangeVal[1] !== undefined ? String(rangeVal[1]) : ''}
              min={rv.min}
              max={rv.max}
              onChange={(e) => {
                const v = e.target.value === '' ? undefined : Number(e.target.value)
                updateField(field.name, [rangeVal[0], v])
              }}
              disabled={readOnly}
              className="text-sm"
            />
          </div>
        )
      }

      default:
        return <Input {...commonProps} disabled placeholder="未知字段类型" />
    }
  }

  const span2Types = new Set(['textarea', 'label', 'table', 'scale', 'numberRange', 'dateRange', 'richText', 'fileUpload'])
  // 多行控件（单选/多选组）左右结构时标签顶部对齐
  const multiLineTypes = new Set(['radio', 'checkbox'])

  const renderFieldRow = (field: CRFField) => {
    const isWide = span2Types.has(field.type)
    const pendingHi = autoFill[field.name] === 'pending'
    const labelNode = field.type !== 'label' && (
      <Label
        htmlFor={field.name}
        className={cn(
          'text-sm font-medium text-slate-700',
          fieldLayout === 'horizontal' && !isWide
            ? cn('w-36 shrink-0 text-right leading-5', multiLineTypes.has(field.type) ? 'pt-1' : 'pt-2')
            : 'mb-1.5 block',
        )}
      >
        {field.label}
        {field.validation?.required && <span className="text-red-500 ml-0.5">*</span>}
        {field.externalFill?.enabled && (
          <Database
            className="inline-block w-3 h-3 ml-1 -mt-0.5 text-cyan-500"
            aria-label="允许医院系统自动填充"
          />
        )}
      </Label>
    )

    if (fieldLayout === 'horizontal' && !isWide) {
      return (
        <div
          key={field.id}
          className={cn('flex gap-3', multiLineTypes.has(field.type) ? 'items-start' : 'items-center')}
        >
          {labelNode}
          <div className="flex-1 min-w-0">
            <div className={cn(pendingHi && 'rounded-lg ring-2 ring-amber-300/70 bg-amber-50/40 p-1.5 -m-1.5')}>
              {renderField(field)}
            </div>
            {autoFillNode(field)}
            {field.helpText && field.type !== 'label' && (
              <p className="mt-1 text-xs text-slate-400">{field.helpText}</p>
            )}
          </div>
        </div>
      )
    }

    return (
      <div key={field.id} className={isWide ? 'md:col-span-2' : ''}>
        {labelNode}
        <div className={cn(pendingHi && 'rounded-lg ring-2 ring-amber-300/70 bg-amber-50/40 p-1.5 -m-1.5')}>
          {renderField(field)}
        </div>
        {autoFillNode(field)}
        {field.helpText && field.type !== 'label' && (
          <p className="mt-1 text-xs text-slate-400">{field.helpText}</p>
        )}
      </div>
    )
  }

  const sortedFields = [...fields].sort((a, b) => a.order - b.order)

  // 如果没有 sections，直接渲染所有字段（过滤条件显示）
  const visibleFields = sortedFields.filter(shouldShowField)

  if (!sections || sections.length === 0) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {visibleFields.map(renderFieldRow)}
      </div>
    )
  }

  // 有 sections 时按 section 分组渲染（过滤条件显示）
  const sortedSections = [...sections].sort((a, b) => a.order - b.order)

  // 兼容旧数据中的 sectionId（如果存在）
  const fieldsBySection = sortedSections.map((section) => ({
    section,
    fields: sortedFields.filter((f) => (f as any).sectionId === section.id && shouldShowField(f)),
  }))

  const ungrouped = sortedFields.filter((f) => !(f as any).sectionId && shouldShowField(f))

  return (
    <div className="space-y-8">
      {fieldsBySection.map(({ section, fields }) => (
        <div key={section.id} className="bg-white rounded-lg border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-1">{section.title}</h3>
          {section.description && (
            <p className="text-sm text-slate-500 mb-4">{section.description}</p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {fields.map(renderFieldRow)}
          </div>
        </div>
      ))}

      {ungrouped.length > 0 && (
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {ungrouped.map(renderFieldRow)}
          </div>
        </div>
      )}
    </div>
  )
}
