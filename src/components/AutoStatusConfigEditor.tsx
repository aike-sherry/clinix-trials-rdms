import { Input } from '@/components/ui/input'
import type { CRFField } from '@/types'

type AutoStatus = NonNullable<CRFField['autoStatus']>

interface Props {
  columns: CRFField[]
  value?: AutoStatus
  onChange: (v: AutoStatus | undefined) => void
}

/**
 * 表格级「状态随日期自动更新」编辑器（两处设计器共用）：
 * 日期列有值→状态列显示「已结束」，为空→显示「持续中」；录入端状态列渲染为只读徽标。
 * 典型场景：不良事件转归随结束日期、合并用药持续状态随结束日期。
 */
export function AutoStatusConfigEditor({ columns, value, onChange }: Props) {
  const dateCols = columns.filter((c) => c.type === 'date')
  const statusCols = columns.filter((c) => c.type === 'text' || c.type === 'select')
  const enabled = !!value

  const patch = (p: Partial<AutoStatus>) => value && onChange({ ...value, ...p })

  const enable = () => {
    onChange({
      dateCol: dateCols[dateCols.length - 1]?.name ?? '',
      statusCol: statusCols[statusCols.length - 1]?.name ?? '',
      emptyText: '持续中',
      filledText: '已结束',
    })
  }

  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1.5 text-[10px] text-slate-500 cursor-pointer select-none">
        <input
          type="checkbox"
          className="accent-teal-500"
          checked={enabled}
          onChange={(e) => (e.target.checked ? enable() : onChange(undefined))}
        />
        状态随日期自动更新：日期列有值→已结束，为空→持续中（录入端状态列只读）
      </label>

      {enabled && value && (
        <div className="ml-4 space-y-1.5 rounded-md border border-slate-100 bg-white p-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-400 shrink-0">日期列</span>
            <select
              value={value.dateCol}
              onChange={(e) => patch({ dateCol: e.target.value })}
              className="h-6 text-[10px] rounded border border-slate-200 px-1 bg-white flex-1 min-w-0"
            >
              <option value="">选择日期列</option>
              {dateCols.map((c) => (
                <option key={c.id} value={c.name}>{c.label}</option>
              ))}
            </select>
            <span className="text-[10px] text-slate-400 shrink-0">状态列</span>
            <select
              value={value.statusCol}
              onChange={(e) => patch({ statusCol: e.target.value })}
              className="h-6 text-[10px] rounded border border-slate-200 px-1 bg-white flex-1 min-w-0"
            >
              <option value="">选择状态列</option>
              {statusCols.map((c) => (
                <option key={c.id} value={c.name}>{c.label}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-400 shrink-0">日期为空显示</span>
            <Input
              className="h-6 text-[10px] w-20 px-1"
              placeholder="持续中"
              value={value.emptyText ?? ''}
              onChange={(e) => patch({ emptyText: e.target.value })}
            />
            <span className="text-[10px] text-slate-400 shrink-0">有值显示</span>
            <Input
              className="h-6 text-[10px] w-20 px-1"
              placeholder="已结束"
              value={value.filledText ?? ''}
              onChange={(e) => patch({ filledText: e.target.value })}
            />
          </div>
          {dateCols.length === 0 && (
            <div className="text-[10px] text-amber-500">⚠ 表格中还没有日期列，请先添加</div>
          )}
        </div>
      )}
    </div>
  )
}
