import { Card, CardContent } from '@/components/ui/card'
import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

/**
 * 全站统一统计卡片：
 * 渐变彩色图标 + 标签 + 大数字（单位缩小分离、基线对齐）+ 可选副信息行 + hover 微浮起。
 *
 * gradient 示例：'from-blue-500 to-blue-600'（bg-gradient-to-br 方向固定）
 */
export default function StatCard({
  label,
  value,
  unit,
  sub,
  icon: Icon,
  gradient,
}: {
  /** 指标名，如「已完成访视」 */
  label: string
  /** 数值 */
  value: number | string
  /** 单位（小字灰色，如 例 / 次 / 条 / 项） */
  unit?: string
  /** 副信息行（小灰字，给数字上下文，如「完成率 50%」；支持自定义节点，如环比标签） */
  sub?: ReactNode
  icon: LucideIcon
  /** 图标渐变，如 'from-blue-500 to-blue-600' */
  gradient: string
}) {
  return (
    <Card className="bg-white hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
      <CardContent className="p-4 flex items-center gap-3.5">
        <div
          className={`w-11 h-11 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center flex-shrink-0 shadow-md`}
        >
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div className="min-w-0">
          <div className="text-xs text-slate-400">{label}</div>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-bold text-slate-800 tabular-nums leading-none">{value}</span>
            {unit && <span className="text-xs text-slate-400">{unit}</span>}
          </div>
          {sub && <div className="text-[11px] text-slate-400 mt-1.5 truncate">{sub}</div>}
        </div>
      </CardContent>
    </Card>
  )
}
