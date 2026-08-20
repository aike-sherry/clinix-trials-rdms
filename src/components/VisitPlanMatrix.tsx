import { useMemo } from 'react'
import { Check } from 'lucide-react'
import type { Project } from '@/types'

// 访视计划兜底间隔（未配置 plannedDay 时按序数估算）
const VISIT_INTERVAL_DAYS = 14

interface Props {
  project: Project
  /** 可编辑模式：点击格子切换 访视×模块 的执行关系 */
  editable?: boolean
  onToggle?: (visitId: string, moduleId: string) => void
  /** 行级一键操作：把某模块应用到全部访视 / 从全部访视移除 */
  onToggleRow?: (moduleId: string, enable: boolean) => void
}

/**
 * 访视计划（评估时间表）：由 CRF 配置自动生成
 * 访视在上方（列，含计划访视日 ± 窗口期），评估模块在左侧（行），✓ 表示该访视需执行此项评估。
 * editable 时点击格子直接切换，行尾「全部」一键应用/移除全部访视。
 */
export default function VisitPlanMatrix({ project, editable, onToggle, onToggleRow }: Props) {
  const visits = useMemo(() => [...project.visits].sort((a, b) => a.order - b.order), [project])
  const modules = useMemo(() => [...project.crfModules].sort((a, b) => a.order - b.order), [project])

  if (visits.length === 0 || modules.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-slate-400 border border-dashed border-slate-200 rounded-lg">
        暂无访视或模块配置，无法生成访视计划
      </div>
    )
  }

  return (
    <div className="border border-slate-200 rounded-lg overflow-auto max-w-full">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="bg-slate-50">
            <th className="sticky left-0 bg-slate-50 z-10 px-3 py-2 text-left font-medium text-slate-500 border-b border-r border-slate-200 min-w-[140px]">
              评估 ＼ 访视
            </th>
            {visits.map((v) => (
              <th
                key={v.id}
                className="px-3 py-2 text-center font-medium text-slate-600 border-b border-slate-200 min-w-[104px] whitespace-nowrap"
              >
                <div>{v.code}</div>
                <div className="text-slate-800">{v.name}</div>
                <div className="text-[10px] text-slate-400 font-normal">
                  第 {v.plannedDay ?? v.order * VISIT_INTERVAL_DAYS} 天 ±{v.windowDays ?? 3} 天
                </div>
              </th>
            ))}
            {editable && (
              <th className="px-3 py-2 text-center font-medium text-slate-500 border-b border-l border-slate-200 min-w-[64px] whitespace-nowrap">
                全部
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {modules.map((m) => {
            const enabledCount = visits.filter((v) => v.crfModuleIds.includes(m.id)).length
            const allOn = enabledCount === visits.length
            return (
              <tr key={m.id} className="hover:bg-slate-50/60">
                <td className="sticky left-0 bg-white z-10 px-3 py-2 text-slate-700 border-r border-b border-slate-100 font-medium">
                  {m.name}
                </td>
                {visits.map((v) => {
                  const on = v.crfModuleIds.includes(m.id)
                  const cell = on ? (
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-teal-50">
                      <Check className="w-3.5 h-3.5 text-teal-500" />
                    </span>
                  ) : (
                    <span className="text-slate-200">—</span>
                  )
                  return (
                    <td key={v.id} className="px-3 py-2 text-center border-b border-slate-100">
                      {editable && onToggle ? (
                        <button
                          type="button"
                          className={`inline-flex items-center justify-center w-full h-7 rounded transition-colors ${
                            on ? 'hover:bg-red-50' : 'hover:bg-teal-50/70'
                          }`}
                          title={on ? '点击：该访视不再执行此项评估' : '点击：该访视增加此项评估'}
                          onClick={() => onToggle(v.id, m.id)}
                        >
                          {cell}
                        </button>
                      ) : (
                        cell
                      )}
                    </td>
                  )
                })}
                {editable && onToggleRow && (
                  <td className="px-2 py-1.5 text-center border-b border-l border-slate-100">
                    <button
                      type="button"
                      className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors whitespace-nowrap ${
                        allOn
                          ? 'border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-200 hover:bg-red-50'
                          : 'border-teal-200 text-teal-600 hover:bg-teal-50'
                      }`}
                      title={allOn ? '从全部访视移除该模块' : '将该模块应用到全部访视'}
                      onClick={() => onToggleRow(m.id, !allOn)}
                    >
                      {allOn ? '清空' : '全选'}
                    </button>
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
