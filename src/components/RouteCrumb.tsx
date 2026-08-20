import { useLocation } from 'react-router'
import {
  Home, FolderOpen, BarChart3, Users, Database, CalendarCheck,
  MessageCircleQuestion, ClipboardCheck, PieChart, UserCircle,
  PanelLeft, ClipboardList, UserPlus, BookOpen, Building2, History,
  LayoutGrid, FileEdit, type LucideIcon,
} from 'lucide-react'
import type { ReactNode } from 'react'

export interface CrumbRule {
  /** 路径前缀（按数组顺序匹配，越精确的规则应放在越前面） */
  prefix: string
  /** 模块名，如「患者管理」 */
  module: string
  /** 子页面名，如「患者清单」 */
  sub: string
}

/** 模块名 → 图标（页面主标题左侧展示） */
const MODULE_ICONS: Record<string, LucideIcon> = {
  首页: Home,
  项目管理: FolderOpen,
  进度管理: BarChart3,
  患者管理: Users,
  受试者登记: UserPlus,
  访视管理: CalendarCheck,
  数据录入: ClipboardList,
  数据管理: Database,
  数据审核: ClipboardCheck,
  疑问管理: MessageCircleQuestion,
  统计分析: PieChart,
  账户管理: UserCircle,
  账号管理: UserCircle,
  我的工作台: LayoutGrid,
  我的数据: Database,
  模块管理: BookOpen,
  模块库: BookOpen,
  CRF配置: FileEdit,
  客户管理: Building2,
  数据留痕: History,
}

/**
 * 页面主标题条：图标 + 模块名（大标题）/ 子页面（小字）。
 * trailing：可选的右侧附加内容（如页面级 Tab 切换器），与标题同行展示。
 */
export default function RouteCrumb({ rules, trailing }: { rules: CrumbRule[]; trailing?: ReactNode }) {
  const location = useLocation()
  const path = location.pathname
  const rule = rules.find((r) =>
    r.prefix.endsWith('/')
      ? path.startsWith(r.prefix)
      : path === r.prefix || path.startsWith(r.prefix + '/'),
  )
  if (!rule) return null
  const Icon = MODULE_ICONS[rule.module] ?? PanelLeft
  return (
    <div className="flex items-center gap-2.5 mb-4 select-none">
      <span className="w-[26px] h-[26px] rounded-lg bg-sky-50 flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-sky-500" />
      </span>
      <h1 className="text-base font-bold text-slate-800 leading-none">{rule.module}</h1>
      <span className="text-slate-300 leading-none">/</span>
      <span className="text-xs text-slate-400 leading-none mt-0.5">{rule.sub}</span>
      {trailing && <span className="ml-auto">{trailing}</span>}
    </div>
  )
}
