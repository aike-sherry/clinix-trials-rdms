import { useRef, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { FileUp, CheckCircle } from 'lucide-react'
import type { CRFField, LabRangeItem, LabRangeSet } from '@/types'

const genId = () => `labset_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

interface Props {
  open: boolean
  field: CRFField | null
  uploader: string
  onOpenChange: (open: boolean) => void
  onSave: (set: LabRangeSet) => void
}

interface ParsedLine extends LabRangeItem {
  matched: boolean
}

/**
 * 上传参考范围（执行人员）：文件或粘贴文本，每行「项目,单位,下限,上限」（单位可省略）。
 * 解析后预览并保存；保存后自动同步到所有录入/审核页面。
 */
export function LabRangeUploadDialog({ open, field, uploader, onOpenChange, onSave }: Props) {
  const [name, setName] = useState('')
  const [effectiveDate, setEffectiveDate] = useState('')
  const [text, setText] = useState('')
  const [parsed, setParsed] = useState<ParsedLine[] | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // 设计端项目清单：实验室模式=预置检验项目；普通表格=预置行内容（用于上传时匹配校验）
  const designItems = field?.labConfig?.items?.length
    ? field.labConfig.items
    : (field?.rowPreset?.rows ?? []).filter((n) => n).map((n) => ({ name: n }))

  const parse = (t: string) => {
    const lines = t.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
    const out: ParsedLine[] = []
    for (const line of lines) {
      const parts = line.split(/[,，\t;；、]/).map((p) => p.trim()).filter((p) => p !== '')
      if (parts.length < 3) continue
      const [itemName, a, b, c] = parts
      // 4 列：项目,单位,下限,上限；3 列：项目,下限,上限
      const hasUnit = parts.length >= 4
      const low = Number(hasUnit ? b : a)
      const high = Number(hasUnit ? c : b)
      if (!itemName || isNaN(low) || isNaN(high)) continue
      out.push({
        name: itemName,
        unit: hasUnit ? a : undefined,
        low, high,
        matched: designItems.length === 0 || designItems.some((it) => it.name === itemName),
      })
    }
    setParsed(out)
  }

  const handleFile = (f: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      const t = String(reader.result || '')
      setText(t)
      parse(t)
    }
    reader.readAsText(f, 'utf-8')
  }

  const save = () => {
    if (!parsed || parsed.length === 0 || !name.trim() || !effectiveDate) return
    onSave({
      id: genId(),
      name: name.trim(),
      effectiveDate,
      uploadedBy: uploader,
      uploadedAt: new Date().toISOString(),
      items: parsed.map(({ name: n, unit, low, high }) => ({ name: n, unit, low, high })),
    })
    onOpenChange(false)
    setName(''); setEffectiveDate(''); setText(''); setParsed(null)
  }

  const unmatched = parsed?.filter((p) => !p.matched) ?? []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
            <FileUp className="w-4 h-4 text-teal-500" />
            上传参考范围{field ? ` · ${field.label}` : ''}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Input
              className="h-8 text-xs flex-1"
              placeholder="版本名，如 2026 版试剂盒标准"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Input
              className="h-8 text-xs w-32"
              type="date"
              title="生效日期"
              value={effectiveDate}
              onChange={(e) => setEffectiveDate(e.target.value)}
            />
          </div>
          <div className="text-[10px] text-slate-400 -mt-1">
            生效日期必填：检测日期在生效日期当天及以后的记录，按本套范围判定偏高/偏低；此前的记录仍按旧版本判定
          </div>

          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              <FileUp className="w-3.5 h-3.5 mr-1" /> 选择文件
            </Button>
            <span className="text-xs text-slate-400">支持 .csv/.txt，每行：项目,单位,下限,上限（单位可省略）</span>
            <input
              ref={fileRef}
              type="file"
              accept=".txt,.csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) handleFile(f)
                e.target.value = ''
              }}
            />
          </div>

          <Textarea
            rows={5}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={'或直接粘贴文本，例如：\n血红蛋白,g/L,115,150\nALT,U/L,7,45'}
            className="text-sm font-mono"
          />
          <div className="flex justify-end">
            <Button size="sm" variant="outline" onClick={() => parse(text)} disabled={!text.trim()}>
              解析
            </Button>
          </div>

          {parsed && (
            <div className="border border-slate-200 rounded-md overflow-hidden">
              <div className="px-3 py-2 bg-slate-50 text-xs font-medium text-slate-600">
                解析结果（{parsed.length} 项）
                {unmatched.length > 0 && (
                  <span className="ml-2 text-amber-500 font-normal">
                    {unmatched.length} 项不在本模块项目清单中
                  </span>
                )}
              </div>
              {parsed.length === 0 && (
                <div className="px-3 py-6 text-center text-xs text-slate-400">未解析到有效行，请检查格式</div>
              )}
              <div className="max-h-48 overflow-y-auto divide-y divide-slate-50">
                {parsed.map((p, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-1.5 text-xs">
                    <span className={`w-28 shrink-0 truncate ${p.matched ? 'text-slate-700' : 'text-amber-500'}`}>
                      {p.name}
                    </span>
                    <span className="text-slate-400 w-16">{p.unit || '—'}</span>
                    <span className="text-slate-700">{p.low} ~ {p.high}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {parsed && parsed.length > 0 && (
            <div className="flex justify-end">
              <Button
                size="sm"
                className="bg-teal-500 hover:bg-teal-600 text-white"
                onClick={save}
                disabled={!name.trim() || !effectiveDate}
                title={!effectiveDate ? '请先填写生效日期' : undefined}
              >
                <CheckCircle className="w-3.5 h-3.5 mr-1" /> 保存并同步
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
