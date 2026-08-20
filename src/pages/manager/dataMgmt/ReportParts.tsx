import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useState } from 'react'
import {
  BarChart3, PieChart as PieChartIcon, Table2, Zap, TrendingUp, LayoutGrid, Plus, X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

// ==================== 通用类型与调色板 ====================

export const PALETTE = ['#0ea5e9', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#64748b', '#ec4899', '#14b8a6']

export type ChartType = 'bar' | 'pie' | 'table'

export interface ChartRow { label: string; value: string; __total: number; [key: string]: string | number }

export interface Slice { label: string; value: string; count: number; color: string }

export interface ProfileBucket { label: string; lo: string; hi: string; count: number }

export interface ProfileItem {
  fieldId: string
  fieldName: string
  label: string
  /** enum=选项分布；numeric=数值直方图；date=日期区间分布；text=TOP 值榜 */
  kind: 'enum' | 'numeric' | 'date' | 'text'
  total: number
  slices: Slice[]
  buckets?: ProfileBucket[]
}

export interface TrendPoint { code: string; name: string; value: number | null; count: number }

export interface QuickPreset {
  key: string
  label: string
  sub: string
  icon: LucideIcon
  gradient: string
  onClick: () => void
  /** 悬浮卡片右上角显示移除按钮 */
  onDelete?: () => void
}

// ==================== 图型切换器 ====================

export function StatTypeSwitcher({
  type, onChange, pieDisabled,
}: {
  type: ChartType
  onChange: (t: ChartType) => void
  pieDisabled?: boolean
}) {
  const items: { value: ChartType; label: string; icon: LucideIcon; disabled?: boolean }[] = [
    { value: 'bar', label: '柱状图', icon: BarChart3 },
    { value: 'pie', label: '饼图', icon: PieChartIcon, disabled: pieDisabled },
    { value: 'table', label: '表格', icon: Table2 },
  ]
  return (
    <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
      {items.map((it) => (
        <button
          key={it.value}
          disabled={it.disabled}
          onClick={() => onChange(it.value)}
          title={it.disabled ? '数值字段或叠加对比时仅支持柱状图' : it.label}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs transition-all ${
            type === it.value ? 'bg-white text-sky-600 shadow-sm font-medium' : 'text-slate-500 hover:text-slate-700'
          } ${it.disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
        >
          <it.icon className="w-3.5 h-3.5" />
          {it.label}
        </button>
      ))}
    </div>
  )
}

// ==================== 分类明细（图右侧：色点 + 类别 + 例数 + 占比） ====================

export function CategoryList({
  slices, total, selected, onToggle,
}: {
  slices: Slice[]
  total: number
  selected?: string[]
  onToggle?: (value: string) => void
}) {
  return (
    <div className="space-y-1">
      {slices.map((s) => {
        const pct = total > 0 ? (s.count / total) * 100 : 0
        const on = selected?.includes(s.value)
        return (
          <button
            key={s.value}
            onClick={() => onToggle?.(s.value)}
            className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-left transition-colors ${
              on ? 'bg-sky-50 ring-1 ring-sky-200' : 'hover:bg-slate-50'
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: s.color }} />
            <span className={`flex-1 text-sm truncate ${on ? 'text-sky-700 font-medium' : 'text-slate-600'}`}>{s.label}</span>
            <span className="text-sm font-semibold text-slate-800 tabular-nums">{s.count}</span>
            <span className="w-14 text-right text-xs text-slate-400 tabular-nums">{pct.toFixed(1)}%</span>
          </button>
        )
      })}
    </div>
  )
}

// ==================== 主统计图（柱状 / 饼图 / 表格） ====================

export function StatMainChart({
  type, numeric, rows, total, centers, compareCenter, stackOptions, onBarClick,
}: {
  type: ChartType
  numeric: boolean
  rows: ChartRow[]
  total: number
  centers: { id: string; name: string }[]
  compareCenter: boolean
  stackOptions: { label: string; value: string }[] | null
  onBarClick: (rowValue: string, stackValue?: string) => void
}) {
  const pctTip = (value: unknown) => {
    const n = Number(value)
    const pct = total > 0 ? ((n / total) * 100).toFixed(1) : '0.0'
    return [`${n} 条（${pct}%）`, '数量']
  }

  if (type === 'table') {
    return (
      <div className="h-full overflow-auto border border-slate-200 rounded-lg">
        <table className="w-full text-sm">
          <thead className="sticky top-0">
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-4 py-2 font-medium text-slate-600">{numeric ? '数值区间' : '类别'}</th>
              <th className="text-right px-4 py-2 font-medium text-slate-600">例数</th>
              <th className="text-right px-4 py-2 font-medium text-slate-600">占比</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={r.value}
                className="border-b border-slate-50 hover:bg-slate-50/60 cursor-pointer"
                onClick={() => onBarClick(r.value)}
                title="点击叠加 / 取消该条件"
              >
                <td className="px-4 py-2 text-slate-700">
                  <span className="inline-block w-2.5 h-2.5 rounded-sm mr-2 align-middle" style={{ background: PALETTE[i % PALETTE.length] }} />
                  {r.label}
                </td>
                <td className="px-4 py-2 text-right font-semibold text-slate-800 tabular-nums">{r.__total}</td>
                <td className="px-4 py-2 text-right text-slate-400 tabular-nums">
                  {total > 0 ? ((r.__total / total) * 100).toFixed(1) : '0.0'}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  if (type === 'pie') {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={rows}
            dataKey="__total"
            nameKey="label"
            innerRadius="55%"
            outerRadius="85%"
            paddingAngle={2}
            cursor="pointer"
            onClick={(data) => {
              const p = (data as unknown as { payload?: ChartRow })?.payload
              if (p) onBarClick(p.value)
            }}
            label={(props: { percent?: number }) => `${(((props.percent) ?? 0) * 100).toFixed(0)}%`}
            labelLine={false}
            fontSize={11}
          >
            {rows.map((r, i) => (
              <Cell key={r.value} fill={PALETTE[i % PALETTE.length]} />
            ))}
          </Pie>
          <Tooltip formatter={pctTip} />
        </PieChart>
      </ResponsiveContainer>
    )
  }

  // 柱状图（含叠加字段堆叠 / 按中心对比 / 单系列渐变柱）
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={rows} margin={{ top: 8, right: 16, bottom: 4, left: -16 }}>
        <defs>
          <linearGradient id="statBarGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#0284c7" />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#64748b' }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#64748b' }} />
        {compareCenter || stackOptions ? (
          <Tooltip cursor={{ fill: 'rgba(14,165,233,0.06)' }} />
        ) : (
          <Tooltip cursor={{ fill: 'rgba(14,165,233,0.06)' }} formatter={pctTip} />
        )}
        {(compareCenter || stackOptions) && <Legend wrapperStyle={{ fontSize: 12 }} />}
        {stackOptions ? (
          stackOptions.map((so, i) => (
            <Bar
              key={so.value}
              dataKey={`stk:${so.value}`}
              name={so.label}
              stackId="stack"
              fill={PALETTE[i % PALETTE.length]}
              radius={i === stackOptions.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]}
              cursor="pointer"
              onClick={(data) => {
                const p = (data as unknown as { payload?: ChartRow })?.payload
                if (p) onBarClick(p.value, so.value)
              }}
            />
          ))
        ) : compareCenter ? (
          centers.map((c, i) => (
            <Bar
              key={c.id}
              dataKey={c.id}
              name={c.name}
              fill={PALETTE[i % PALETTE.length]}
              radius={[3, 3, 0, 0]}
              cursor="pointer"
              onClick={(data) => {
                const p = (data as unknown as { payload?: ChartRow })?.payload
                if (p) onBarClick(p.value)
              }}
            />
          ))
        ) : (
          <Bar
            dataKey="__total"
            name="数量"
            fill="url(#statBarGrad)"
            radius={[3, 3, 0, 0]}
            cursor="pointer"
            onClick={(data) => {
              const p = (data as unknown as { payload?: ChartRow })?.payload
              if (p) onBarClick(p.value)
            }}
          />
        )}
      </BarChart>
    </ResponsiveContainer>
  )
}

// ==================== 模块画像（全字段自动画像，点击交叉筛选） ====================

export function ProfileGrid({
  items, selected, rangeSelected, dateSelected, textSelected, onToggle, onTextToggle, onBucket,
}: {
  items: ProfileItem[]
  selected: Record<string, string[]>
  rangeSelected: Record<string, { min: string; max: string }>
  dateSelected: Record<string, { from: string; to: string }>
  textSelected: Record<string, string>
  onToggle: (fieldName: string, value: string) => void
  onTextToggle: (fieldName: string, value: string) => void
  onBucket: (fieldName: string, lo: string, hi: string, kind: 'numeric' | 'date') => void
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2 flex-wrap">
          <LayoutGrid className="w-4 h-4 text-violet-500" />
          模块画像
          <span className="text-sm font-normal text-slate-400">全字段自动画像 · 点击分类 / 区间 / 词条可交叉筛选</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {items.map((it) => (
            <div key={it.fieldId} className="border border-slate-200 rounded-xl p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-slate-700 truncate">{it.label}</span>
                <span className="text-xs text-slate-400 shrink-0 ml-2">共 {it.total} 条</span>
              </div>

              {/* 选项分布 / 文本 TOP 值：横条列表 */}
              {(it.kind === 'enum' || it.kind === 'text') && (
                <div className="space-y-1">
                  {it.slices.map((s) => {
                    const pct = it.total > 0 ? (s.count / it.total) * 100 : 0
                    const on = it.kind === 'enum'
                      ? selected[it.fieldName]?.includes(s.value)
                      : textSelected[it.fieldName] === s.value
                    return (
                      <button
                        key={s.value}
                        onClick={() => it.kind === 'enum' ? onToggle(it.fieldName, s.value) : onTextToggle(it.fieldName, s.value)}
                        title={s.label}
                        className={`w-full text-left px-2 py-1.5 rounded-lg transition-colors ${
                          on ? 'bg-sky-50 ring-1 ring-sky-200' : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className={`truncate mr-2 ${on ? 'text-sky-700 font-medium' : 'text-slate-600'}`}>{s.label}</span>
                          <span className="text-slate-400 tabular-nums shrink-0">{s.count} · {pct.toFixed(1)}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: s.color }} />
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}

              {/* 数值 / 日期：迷你直方图（点击区间叠加条件） */}
              {(it.kind === 'numeric' || it.kind === 'date') && it.buckets && (
                <div>
                  <div className="flex items-end gap-1 h-20">
                    {(() => {
                      const maxC = Math.max(...it.buckets.map((b) => b.count), 1)
                      return it.buckets.map((b) => {
                        const on = it.kind === 'numeric'
                          ? rangeSelected[it.fieldName]?.min === b.lo && rangeSelected[it.fieldName]?.max === b.hi
                          : dateSelected[it.fieldName]?.from === b.lo && dateSelected[it.fieldName]?.to === b.hi
                        return (
                          <button
                            key={b.label}
                            title={`${b.label}：${b.count} 条（点击叠加 / 取消）`}
                            onClick={() => onBucket(it.fieldName, b.lo, b.hi, it.kind as 'numeric' | 'date')}
                            className="flex-1 h-full flex flex-col items-center justify-end gap-0.5 group"
                          >
                            <span className={`text-[10px] tabular-nums ${on ? 'text-sky-600 font-semibold' : 'text-slate-400'}`}>{b.count}</span>
                            <div
                              className={`w-full rounded-t transition-colors ${on ? 'bg-sky-500' : 'bg-sky-200 group-hover:bg-sky-300'}`}
                              style={{ height: `${Math.max(6, (b.count / maxC) * 82)}%` }}
                            />
                          </button>
                        )
                      })
                    })()}
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-400 mt-1.5">
                    <span>{it.buckets[0]?.label.split('~')[0]}</span>
                    <span>{it.buckets[it.buckets.length - 1]?.label.split('~')[1]}</span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// ==================== 跨访视趋势 ====================

export function TrendChartCard({
  points, mode, fieldLabel,
}: {
  points: TrendPoint[]
  mode: 'mean' | 'count'
  fieldLabel: string
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2 flex-wrap">
          <TrendingUp className="w-4 h-4 text-teal-500" />
          跨访视趋势
          <span className="text-sm font-normal text-slate-400">
            {fieldLabel} · {mode === 'mean' ? '各访视均值变化' : '各访视命中例数变化'}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points} margin={{ top: 8, right: 16, bottom: 4, left: -16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="code" tick={{ fontSize: 12, fill: '#64748b' }} />
              <YAxis allowDecimals={mode === 'mean'} tick={{ fontSize: 12, fill: '#64748b' }} />
              <Tooltip
                formatter={(value, _name, item) => {
                  const p = (item as { payload?: TrendPoint } | undefined)?.payload
                  return [
                    `${value}${mode === 'count' ? ' 条' : ''}（${p?.name ?? ''} · n=${p?.count ?? 0}）`,
                    mode === 'mean' ? '均值' : '例数',
                  ]
                }}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#0d9488"
                strokeWidth={2.5}
                dot={{ r: 4, fill: '#0d9488' }}
                activeDot={{ r: 6 }}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}

// ==================== 重点数据分析入口（拖拽排序 / 自定义添加 / 移除） ====================

export function QuickPresetRow({
  presets,
  onAdd,
  onReorder,
}: {
  presets: QuickPreset[]
  onAdd?: () => void
  /** 拖拽卡片到目标卡片上时触发：fromKey 移到 toKey 的位置 */
  onReorder?: (fromKey: string, toKey: string) => void
}) {
  const [dragKey, setDragKey] = useState<string | null>(null)
  const [overKey, setOverKey] = useState<string | null>(null)

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-sm font-semibold flex items-center gap-2 flex-wrap">
            <Zap className="w-4 h-4 text-amber-500" />
            重点数据分析
            <span className="text-sm font-normal text-slate-400">常用统计一键出图 · 拖拽卡片调整顺序，悬浮可移除</span>
          </CardTitle>
          {onAdd && (
            <button
              onClick={onAdd}
              className="flex items-center gap-1.5 px-3 h-8 rounded-lg border border-dashed border-slate-300 text-xs text-slate-400 hover:border-sky-400 hover:text-sky-600 hover:bg-sky-50/40 transition-colors shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              添加重点分析
            </button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {presets.map((p) => (
            <div
              key={p.key}
              className={`group relative rounded-xl transition-all ${
                dragKey === p.key ? 'opacity-40 scale-95' : ''
              } ${overKey === p.key && dragKey !== p.key ? 'ring-2 ring-sky-400 ring-offset-2' : ''}`}
              draggable={!!onReorder}
              onDragStart={(e) => {
                setDragKey(p.key)
                e.dataTransfer.effectAllowed = 'move'
                e.dataTransfer.setData('text/plain', p.key)
              }}
              onDragOver={(e) => {
                if (!onReorder) return
                e.preventDefault()
                e.dataTransfer.dropEffect = 'move'
                if (overKey !== p.key) setOverKey(p.key)
              }}
              onDragLeave={() => {
                if (overKey === p.key) setOverKey(null)
              }}
              onDrop={(e) => {
                e.preventDefault()
                const from = dragKey ?? e.dataTransfer.getData('text/plain')
                if (from && from !== p.key) onReorder?.(from, p.key)
                setDragKey(null)
                setOverKey(null)
              }}
              onDragEnd={() => {
                setDragKey(null)
                setOverKey(null)
              }}
            >
              <button
                onClick={p.onClick}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-white hover:border-sky-300 hover:shadow-md transition-all text-left ${
                  onReorder ? 'cursor-grab active:cursor-grabbing' : ''
                }`}
              >
                <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${p.gradient} flex items-center justify-center shrink-0 shadow-sm`}>
                  <p.icon className="w-4 h-4 text-white" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-slate-700 truncate group-hover:text-sky-600 transition-colors">
                    {p.label}
                  </div>
                  <div className="text-xs text-slate-400 truncate">{p.sub}</div>
                </div>
              </button>
              {p.onDelete && (
                <button
                  onClick={(e) => { e.stopPropagation(); p.onDelete!() }}
                  title="移除该分析"
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-white border border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-300 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
