import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'

export interface DonutItem {
  name: string
  value: number
  color: string
}

/**
 * 统一环形图样式：中心显示总数 + 右侧分类数字图例。
 * 用于全系统所有分类构成类饼图，保持视觉一致。
 */
export default function DonutWithLegend({
  data,
  height = 200,
  pieWidth = 220,
  legendWidthClass = 'w-28',
  centerLabel = '总例数',
  valueUnit,
  gapClass = 'gap-20',
}: {
  data: DonutItem[]
  height?: number
  pieWidth?: number
  legendWidthClass?: string
  centerLabel?: string
  /** Tooltip 中数值的单位，如「个」「例」 */
  valueUnit?: string
  /** 饼图与图例之间的间距，默认 gap-20 */
  gapClass?: string
}) {
  const total = data.reduce((s, d) => s + d.value, 0)
  const inner = Math.round(height * 0.24)
  const outer = Math.round(height * 0.4)

  return (
    <div className={`flex items-center justify-center ${gapClass}`}>
      <div className="relative shrink-0" style={{ width: pieWidth }}>
        <ResponsiveContainer width="100%" height={height}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={inner}
              outerRadius={outer}
              paddingAngle={3}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip formatter={valueUnit ? (v: number, name: string) => [`${v} ${valueUnit}`, name] : undefined} />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-xl font-bold text-slate-800">{total}</span>
          <span className="text-[11px] text-slate-400">{centerLabel}</span>
        </div>
      </div>
      <div className={`${legendWidthClass} shrink-0 space-y-2`}>
        {data.map((d) => (
          <div key={d.name} className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: d.color }} />
            <span className="text-xs text-slate-600 flex-1">{d.name}</span>
            <span className="text-xs font-semibold text-slate-800 tabular-nums">{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
