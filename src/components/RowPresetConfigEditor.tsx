import { Trash2, Wand2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import type { CRFField } from '@/types'

interface Props {
  field: CRFField
  onChange: (patch: Partial<Pick<CRFField, 'rowPreset' | 'matrixView' | 'columns'>>) => void
}

const genId = () => `col_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

/**
 * 供标题行「+ 添加行」按钮使用：在当前预置行清单末尾追加一行空行。
 * 返回 null 表示表格还没有文本列（固定首列自动取第一个文本列），需先添加列。
 */
export function addRowPatch(field: CRFField): Partial<CRFField> | null {
  const columns = field.columns || []
  const firstTextCol = columns.find((c) => c.type === 'text')
  if (!firstTextCol) return null
  const rows = field.rowPreset?.rows ?? []
  return { rowPreset: { col: field.rowPreset?.col || firstTextCol.name, rows: [...rows, ''] } }
}

/**
 * 表格行配置（两处设计器共用，实验室模式下隐藏——实验室自带预置项目与矩阵选项）：
 * 逐条添加行内容即为「预置行」（录入端行锁定、首列只读，固定首列自动取第一个文本列）；
 * 一行都不加则为「自由行」（执行人员自行增删行）；
 * 勾选「跨访视展示」即矩阵视图：行=预置内容、列=访视，内容列与记录日期可调整。
 */
export function RowPresetConfigEditor({ field, onChange }: Props) {
  const columns = field.columns || []
  const firstTextCol = columns.find((c) => c.type === 'text')
  const preset = field.rowPreset
  const matrix = field.matrixView
  const rows = preset?.rows ?? []

  /** 写行清单：空清单=自由行（清除 rowPreset 与矩阵） */
  const setRows = (next: string[]) => {
    if (next.length === 0) {
      onChange({ rowPreset: undefined, matrixView: undefined })
      return
    }
    if (!firstTextCol) return
    onChange({ rowPreset: { col: preset?.col || firstTextCol.name, rows: next } })
  }

  // 内容列候选：除固定首列外的 文本/数字 列
  const valueCols = columns.filter(
    (c) => (c.type === 'text' || c.type === 'number') && c.name !== preset?.col,
  )

  /**
   * 一键配置跨访视矩阵：自动补齐「项目（文本）+ 测量值（数字）」两列（已有则复用），
   * 开启预置行 + 矩阵展示 + 列头记录日期；用户只需逐条填写行内容
   */
  const quickMatrix = () => {
    const cols = [...columns]
    let itemCol = cols.find((c) => c.type === 'text')
    if (!itemCol) {
      itemCol = { id: genId(), type: 'text', label: '项目', name: 'item', order: cols.length }
      cols.push(itemCol)
    }
    let valueCol = cols.find((c) => c.type === 'number' && c.name !== itemCol!.name)
    if (!valueCol) {
      valueCol = { id: genId(), type: 'number', label: '测量值', name: 'value', order: cols.length }
      cols.push(valueCol)
    }
    onChange({
      columns: cols,
      rowPreset: { col: itemCol.name, rows: rows.length ? rows : [''] },
      matrixView: { valueCol: valueCol.name, showDate: true },
    })
  }

  return (
    <div className="space-y-1.5 pt-1 border-t border-slate-100">
      <div className="flex items-center justify-between">
        <div className="text-[10px] text-slate-400">
          表格行配置（可选）：用上方「+ 添加行」逐条添加行内容，录入端行固定、首列只读；不添加则执行人员自行增删行
        </div>
        {!(preset && matrix) && (
          <Button
            variant="ghost" size="sm"
            className="h-5 px-1.5 text-[10px] text-teal-600 hover:bg-teal-50 shrink-0"
            title="自动生成「项目+测量值」两列，开启预置行与跨访视矩阵、列头记录日期；只需再逐条填写行内容"
            onClick={quickMatrix}
          >
            <Wand2 className="w-2.5 h-2.5 mr-0.5" /> 一键配置跨访视矩阵
          </Button>
        )}
      </div>

      {/* 行清单：逐条添加 */}
      <div className="space-y-1">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center gap-1">
            <span className="text-[10px] text-slate-300 w-4 text-center shrink-0">{i + 1}</span>
            <Input
              className="h-6 text-[10px] px-1 flex-1"
              placeholder="如 收缩压(mmHg)"
              value={r}
              onChange={(e) => setRows(rows.map((x, j) => (j === i ? e.target.value : x)))}
            />
            <Button
              variant="ghost" size="icon" className="w-5 h-5 text-slate-400 hover:text-red-500 shrink-0"
              onClick={() => setRows(rows.filter((_, j) => j !== i))}
            >
              <Trash2 className="w-2.5 h-2.5" />
            </Button>
          </div>
        ))}
        {rows.length > 0 && !firstTextCol && (
          <div className="text-[10px] text-amber-500">⚠ 表格中还没有文本列作为首列，请先添加一列</div>
        )}
      </div>

      {/* 跨访视展示：一个勾选 */}
      <div className="space-y-1.5">
        <label className={`flex items-start gap-1.5 text-[10px] select-none ${rows.length === 0 ? 'text-slate-300' : 'text-slate-500 cursor-pointer'}`}>
          <input
            type="checkbox"
            className="accent-teal-500 mt-0.5"
            disabled={rows.length === 0}
            checked={!!matrix}
            onChange={(e) =>
              e.target.checked
                ? onChange({ matrixView: { valueCol: valueCols[0]?.name ?? '', showDate: true } })
                : onChange({ matrixView: undefined })
            }
          />
          <span>
            跨访视展示：行=上方行内容、列=访视，<span className={rows.length === 0 ? '' : 'text-teal-600'}>一屏看全各次访视</span>，编辑即时保存
            {rows.length === 0 && <span className="block">（请先添加行内容）</span>}
          </span>
        </label>
        {matrix && (
          <div className="ml-4 space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] text-slate-400 shrink-0">内容列</span>
              <select
                value={matrix.valueCol}
                onChange={(e) => onChange({ matrixView: { ...matrix, valueCol: e.target.value } })}
                className="h-6 text-[10px] rounded border border-slate-200 px-1 bg-white min-w-0"
              >
                <option value="">选择列</option>
                {valueCols.map((c) => (
                  <option key={c.id} value={c.name}>{c.label}</option>
                ))}
              </select>
              <label className="flex items-center gap-1 text-[10px] text-slate-500 cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="accent-teal-500"
                  checked={matrix.showDate ?? false}
                  onChange={(e) => onChange({ matrixView: { ...matrix, showDate: e.target.checked } })}
                />
                列头显示记录日期（一次填写整列生效）
              </label>
            </div>
            <div className="text-[10px] text-slate-400 leading-relaxed">
              内容列 = 矩阵交叉格里要填写的值存放在哪一列（如「测量值」，通常选数字列）：行是上方添加的行内容，列是各次访视，交叉格的值就写入内容列
            </div>
            {/* 矩阵示意预览：设计端无访视上下文，用示例访视列展示结构 */}
            {rows.some((r) => r) && matrix.valueCol && (
              <div className="rounded-md border border-slate-200 overflow-hidden">
                <div className="px-2 py-1 bg-slate-50 text-[10px] text-slate-400">
                  录入端效果示意（列=该模块所在访视，此处用示例访视）
                </div>
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="px-2 py-1 text-left text-[10px] font-medium text-slate-500">{columns.find((c) => c.name === preset?.col)?.label ?? '项目'}</th>
                      <th className="px-2 py-1 text-center text-[10px] font-medium text-slate-500 border-l border-slate-100">V1 示例访视</th>
                      <th className="px-2 py-1 text-center text-[10px] font-medium text-slate-500 border-l border-slate-100">V2 示例访视</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.filter((r) => r).slice(0, 3).map((r, i) => (
                      <tr key={i} className="border-b border-slate-50 last:border-0">
                        <td className="px-2 py-1 text-[10px] text-slate-600">{r}</td>
                        <td className="px-2 py-1 text-center text-[10px] text-slate-300 border-l border-slate-50">填{columns.find((c) => c.name === matrix.valueCol)?.label ?? '内容'}</td>
                        <td className="px-2 py-1 text-center text-[10px] text-slate-300 border-l border-slate-50">填{columns.find((c) => c.name === matrix.valueCol)?.label ?? '内容'}</td>
                      </tr>
                    ))}
                    {rows.filter((r) => r).length > 3 && (
                      <tr>
                        <td colSpan={3} className="px-2 py-0.5 text-center text-[10px] text-slate-300">…共 {rows.filter((r) => r).length} 行</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
