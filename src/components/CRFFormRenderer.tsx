import { useState, useRef, useEffect } from 'react'
import type { CRFField, FieldOption } from '@/types'
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
import { CalendarIcon, Plus, Trash2 } from 'lucide-react'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { cn } from '@/lib/utils'

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

export default function CRFFormRenderer({
  sections,
  fields,
  initialData = {},
  onChange,
  readOnly = false,
}: CRFFormRendererProps) {
  const [data, setData] = useState<Record<string, unknown>>(initialData)

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
              value={value !== undefined ? String(value) : ''}
              onChange={(e) => {
                const v = e.target.value === '' ? undefined : Number(e.target.value)
                updateField(field.name, v)
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
            value={value ? (value as string).slice(0, 16) : ''}
            onChange={(e) => updateField(field.name, e.target.value ? new Date(e.target.value).toISOString() : undefined)}
          />
        )

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
        const rows = Array.isArray(value) ? (value as Record<string, unknown>[]) : []
        const cols = field.columns || []
        const addRow = () => {
          const newRow: Record<string, unknown> = {}
          cols.forEach((col) => {
            if (col.defaultValue !== undefined) newRow[col.name] = col.defaultValue
          })
          updateField(field.name, [...rows, newRow])
        }
        const removeRow = (idx: number) => {
          const next = [...rows]
          next.splice(idx, 1)
          updateField(field.name, next)
        }
        const updateCell = (rowIdx: number, colName: string, val: unknown) => {
          const next = rows.map((r, i) => (i === rowIdx ? { ...r, [colName]: val } : r))
          updateField(field.name, next)
        }
        const renderCellInput = (col: CRFField, row: Record<string, unknown>, rowIdx: number) => {
          const cellValue = row[col.name]
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
                  value={cellValue !== undefined ? String(cellValue) : ''}
                  onChange={(e) => {
                    const v = e.target.value === '' ? undefined : Number(e.target.value)
                    updateCell(rowIdx, col.name, v)
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
            default:
              return (
                <Input {...cellProps} disabled placeholder={`${col.type}`} className="h-8 text-xs" />
              )
          }
        }
        return (
          <div className="space-y-2">
            <div className="overflow-x-auto rounded-md border border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    {cols.map((col) => (
                      <th key={col.id} className="px-2 py-1.5 text-left text-xs font-medium text-slate-600 border-b whitespace-nowrap">
                        {col.label}
                        {col.validation?.required && <span className="text-red-500 ml-0.5">*</span>}
                      </th>
                    ))}
                    {!readOnly && <th className="px-2 py-1.5 text-center text-xs font-medium text-slate-600 border-b w-16">操作</th>}
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={cols.length + (readOnly ? 0 : 1)} className="px-2 py-4 text-center text-xs text-slate-400">
                        暂无数据，点击下方按钮添加
                      </td>
                    </tr>
                  )}
                  {rows.map((row, rowIdx) => (
                    <tr key={rowIdx} className="border-b border-slate-100 last:border-0">
                      {cols.map((col) => (
                        <td key={col.id} className="px-2 py-1 align-top">
                          {renderCellInput(col, row, rowIdx)}
                        </td>
                      ))}
                      {!readOnly && (
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
            {!readOnly && (
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

  const span2Types = new Set(['textarea', 'label', 'table', 'scale', 'numberRange'])

  const sortedFields = [...fields].sort((a, b) => a.order - b.order)

  // 如果没有 sections，直接渲染所有字段（过滤条件显示）
  const visibleFields = sortedFields.filter(shouldShowField)

  if (!sections || sections.length === 0) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {visibleFields.map((field) => (
          <div key={field.id} className={span2Types.has(field.type) ? 'md:col-span-2' : ''}>
            {field.type !== 'label' && (
              <Label htmlFor={field.name} className="mb-1.5 block text-sm font-medium text-slate-700">
                {field.label}
                {field.validation?.required && <span className="text-red-500 ml-0.5">*</span>}
              </Label>
            )}
            {renderField(field)}
            {field.helpText && field.type !== 'label' && (
              <p className="mt-1 text-xs text-slate-400">{field.helpText}</p>
            )}
          </div>
        ))}
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
            {fields.map((field) => (
              <div key={field.id} className={span2Types.has(field.type) ? 'md:col-span-2' : ''}>
                {field.type !== 'label' && (
                  <Label htmlFor={field.name} className="mb-1.5 block text-sm font-medium text-slate-700">
                    {field.label}
                    {field.validation?.required && <span className="text-red-500 ml-0.5">*</span>}
                  </Label>
                )}
                {renderField(field)}
                {field.helpText && field.type !== 'label' && (
                  <p className="mt-1 text-xs text-slate-400">{field.helpText}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {ungrouped.length > 0 && (
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {ungrouped.map((field) => (
              <div key={field.id} className={span2Types.has(field.type) ? 'md:col-span-2' : ''}>
                {field.type !== 'label' && (
                  <Label htmlFor={field.name} className="mb-1.5 block text-sm font-medium text-slate-700">
                    {field.label}
                    {field.validation?.required && <span className="text-red-500 ml-0.5">*</span>}
                  </Label>
                )}
                {renderField(field)}
                {field.helpText && field.type !== 'label' && (
                  <p className="mt-1 text-xs text-slate-400">{field.helpText}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
