import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAppStorage } from '@/hooks/useAppStorage'
import DonutWithLegend from '@/components/DonutWithLegend'
import StatCard from '@/components/StatCard'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, LineChart, Line
} from 'recharts'
import {
  LayoutGrid, Wallet, UserCog, TrendingUp, Package, History, PlayCircle, ShieldCheck
} from 'lucide-react'

const STATUS_COLORS: Record<string, string> = {
  proposal_review: '#f59e0b',
  contract_signed: '#fb923c',
  ethics_review: '#eab308',
  study_started: '#14b8a6',
  study_closed: '#3b82f6',
  suspended: '#ef4444',
}

const STATUS_LABELS: Record<string, string> = {
  proposal_review: '立项审核',
  contract_signed: '合同签署',
  ethics_review: '伦理审核',
  study_started: '进行中',
  study_closed: '已关闭',
  suspended: '已暂停',
  // 兼容旧数据
  pending: '立项',
  active: '进行中',
  completed: '结束',
}

const ROLE_LABELS: Record<string, string> = {
  super_admin: '超级管理员',
  admin: '管理员',
  manager: '课题主持人',
  data_entry: '数据录入',
}

const ROLE_COLORS: Record<string, string> = {
  super_admin: '#8b5cf6',
  admin: '#14b8a6',
  manager: '#3b82f6',
  data_entry: '#f59e0b',
}

/** 可授权功能模块（与账号管理一致） */
const MODULE_LABELS: [string, string][] = [
  ['patients', '患者管理'],
  ['visits', '访视管理'],
  ['dataMgmt', '数据管理'],
  ['statistics', '统计分析'],
  ['queries', '疑问管理'],
  ['integration', '数据集成'],
]

/**
 * 后台首页（内网部署原则：后台管理员不涉及任何研究数据）
 * 仅展示纯运营指标：课题、账号、模块库、权限开通、系统操作留痕
 */
export default function AdminHome() {
  const { projects, users, moduleLibrary, auditLogs } = useAppStorage()

  // 课题状态统计
  const statusData = [
    ...(['proposal_review', 'contract_signed', 'ethics_review', 'study_started', 'study_closed', 'suspended'] as const)
      .map((s) => ({
        name: STATUS_LABELS[s],
        value: projects.filter((p) => p.status === s).length,
        color: STATUS_COLORS[s],
      })),
  ].filter((d) => d.value > 0)

  // 预算汇总（按项目）
  const budgetData = projects.map((p) => ({
    name: p.projectNo,
    budget: p.budget || 0,
  }))

  // 账号角色分布
  const roleData = (Object.keys(ROLE_LABELS) as (keyof typeof ROLE_LABELS)[])
    .map((r) => ({
      name: ROLE_LABELS[r],
      value: users.filter((u) => u.role === r).length,
      color: ROLE_COLORS[r],
    }))
    .filter((d) => d.value > 0)

  // 模块授权开通统计（课题主持人 / 数据录入 各模块开通人数）
  const ALL_MODULES = MODULE_LABELS.map(([k]) => k)
  const moduleAccessData = MODULE_LABELS.map(([key, label]) => ({
    name: label,
    manager: users.filter((u) => u.role === 'manager' && (u.moduleAccess ?? ALL_MODULES).includes(key as never)).length,
    entry: users.filter((u) => u.role === 'data_entry' && (u.moduleAccess ?? ALL_MODULES).includes(key as never)).length,
  }))

  // 近 30 日系统操作活跃（留痕元数据，不含任何数据内容）
  const today = new Date()
  const activityData = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(today)
    d.setDate(d.getDate() - (29 - i))
    const key = d.toISOString().slice(0, 10)
    return {
      date: key.slice(5),
      count: auditLogs.filter((l) => l.timestamp.slice(0, 10) === key).length,
    }
  })
  const todayStr = today.toISOString().slice(0, 10)
  const todayOps = auditLogs.filter((l) => l.timestamp.slice(0, 10) === todayStr).length

  const activeCount = projects.filter((p) => p.status === 'study_started' || p.status === 'active').length
  const managerCount = users.filter((u) => u.role === 'manager').length
  const entryCount = users.filter((u) => u.role === 'data_entry').length

  return (
    <div className="space-y-5">
      {/* 顶部统计卡片（纯运营指标） */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          label="总课题数" value={projects.length} unit="项"
          sub={`进行中 ${activeCount} 项`}
          icon={LayoutGrid} gradient="from-blue-500 to-blue-600"
        />
        <StatCard
          label="进行中" value={activeCount} unit="项"
          sub={`占全部 ${projects.length > 0 ? Math.round((activeCount / projects.length) * 100) : 0}%`}
          icon={PlayCircle} gradient="from-teal-500 to-emerald-600"
        />
        <StatCard
          label="系统账号" value={users.length} unit="个"
          sub={`主持人 ${managerCount} · 录入 ${entryCount}`}
          icon={UserCog} gradient="from-violet-500 to-purple-600"
        />
        <StatCard
          label="数据留痕" value={auditLogs.length} unit="条"
          sub={`今日新增 ${todayOps} 条`}
          icon={History} gradient="from-amber-500 to-orange-500"
        />
      </div>

      {/* 图表区域 1：课题状态 + 预算 */}
      <div className="grid grid-cols-2 gap-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2"><LayoutGrid className="w-4 h-4 text-sky-500" />课题状态一览</CardTitle>
          </CardHeader>
          <CardContent>
            <DonutWithLegend data={statusData} height={200} centerLabel="课题总数" valueUnit="个" legendWidthClass="w-32" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2"><Wallet className="w-4 h-4 text-sky-500" />预算汇总</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={budgetData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="budget" fill="#14b8a6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* 图表区域 2：账号角色 + 模块授权 */}
      <div className="grid grid-cols-2 gap-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2"><UserCog className="w-4 h-4 text-sky-500" />账号角色分布</CardTitle>
          </CardHeader>
          <CardContent>
            <DonutWithLegend data={roleData} height={200} centerLabel="账号总数" valueUnit="个" legendWidthClass="w-32" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-sky-500" />模块授权开通统计</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={moduleAccessData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="manager" name="课题主持人" fill="#3b82f6" radius={[2, 2, 0, 0]} />
                <Bar dataKey="entry" name="数据录入" fill="#f59e0b" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* 图表区域 3：系统操作活跃 + 模块库 */}
      <div className="grid grid-cols-3 gap-5">
        <Card className="col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2"><TrendingUp className="w-4 h-4 text-sky-500" />近 30 日系统操作活跃</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={activityData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} interval={4} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="count" name="操作留痕" stroke="#14b8a6" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2"><Package className="w-4 h-4 text-sky-500" />模块库概况</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg border border-slate-100 bg-slate-50/60 px-4 py-3 flex items-center justify-between">
              <span className="text-sm text-slate-600">模块总数</span>
              <span className="text-lg font-bold text-slate-800">{moduleLibrary.length} <span className="text-xs font-normal text-slate-400">个</span></span>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50/60 px-4 py-3 flex items-center justify-between">
              <span className="text-sm text-slate-600">系统内置模块</span>
              <span className="text-lg font-bold text-teal-600">{moduleLibrary.filter((m) => m.isSystem).length} <span className="text-xs font-normal text-slate-400">个</span></span>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50/60 px-4 py-3 flex items-center justify-between">
              <span className="text-sm text-slate-600">自定义模块</span>
              <span className="text-lg font-bold text-sky-600">{moduleLibrary.filter((m) => !m.isSystem).length} <span className="text-xs font-normal text-slate-400">个</span></span>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50/60 px-4 py-3 flex items-center justify-between">
              <span className="text-sm text-slate-600">字段总数</span>
              <span className="text-lg font-bold text-slate-800">{moduleLibrary.reduce((s, m) => s + m.fields.length, 0)} <span className="text-xs font-normal text-slate-400">个</span></span>
            </div>
          </CardContent>
        </Card>
      </div>

      <p className="text-center text-[11px] text-slate-400 pt-1">
        内网部署模式 · 后台仅展示运营指标，不涉及任何研究数据与受试者信息
      </p>
    </div>
  )
}
