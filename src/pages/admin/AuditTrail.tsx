import { useMemo, useState } from 'react'
import { useAppStorage } from '@/hooks/useAppStorage'
import StatCard from '@/components/StatCard'
import { usePageSize, PAGE_SIZE_OPTIONS } from '@/hooks/usePageSize'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  History, Search, PlusCircle, PencilLine, Trash2, ChevronDown, ChevronRight,
  Activity, Users, Database,
} from 'lucide-react'
import type { AuditLog, UserRole } from '@/types'

const ACTION_LABELS: Record<AuditLog['action'], string> = {
  create: '新增',
  update: '更新',
  delete: '删除',
}

const ACTION_STYLES: Record<AuditLog['action'], string> = {
  create: 'bg-green-50 text-green-600 border-green-200',
  update: 'bg-blue-50 text-blue-600 border-blue-200',
  delete: 'bg-red-50 text-red-600 border-red-200',
}

const ACTION_ICONS: Record<AuditLog['action'], typeof PlusCircle> = {
  create: PlusCircle,
  update: PencilLine,
  delete: Trash2,
}

const ENTITY_LABELS: Record<AuditLog['entityType'], string> = {
  patient: '受试者',
  visitData: '访视数据',
  project: '研究项目',
  user: '账号',
  moduleLibrary: '模块库',
  projectPermission: '项目授权',
  query: '数据疑问',
  configPackage: '配置包',
}

const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: '超级管理员',
  admin: '管理员',
  manager: '课题主持人',
  data_entry: '数据录入员',
}

const GRID_COLS = 'grid-cols-[150px_minmax(0,1fr)_76px_88px_minmax(0,1.6fr)_minmax(0,1.8fr)_56px]'

export default function AuditTrail() {
  const { auditLogs } = useAppStorage()

  const [actionFilter, setActionFilter] = useState<'all' | AuditLog['action']>('all')
  const [entityFilter, setEntityFilter] = useState<'all' | AuditLog['entityType']>('all')
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [pageSize, setPageSize] = usePageSize('crf_pagesize_admin_audit', 10)
  const [page, setPage] = useState(1)

  // 最新在前
  const sorted = useMemo(() => [...auditLogs].reverse(), [auditLogs])

  const filtered = useMemo(
    () =>
      sorted.filter((log) => {
        if (actionFilter !== 'all' && log.action !== actionFilter) return false
        if (entityFilter !== 'all' && log.entityType !== entityFilter) return false
        if (search) {
          const q = search.toLowerCase()
          const hit =
            log.entityLabel.toLowerCase().includes(q) ||
            log.summary.toLowerCase().includes(q) ||
            log.userName.toLowerCase().includes(q)
          if (!hit) return false
        }
        return true
      }),
    [sorted, actionFilter, entityFilter, search]
  )

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const pageRows = filtered.slice((safePage - 1) * pageSize, safePage * pageSize)

  // 统计
  const stats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    return {
      total: auditLogs.length,
      today: auditLogs.filter((l) => l.timestamp.slice(0, 10) === today).length,
      operators: new Set(auditLogs.map((l) => l.userId)).size,
      dataChanges: auditLogs.filter((l) => l.entityType === 'visitData' || l.entityType === 'patient').length,
    }
  }, [auditLogs])

  const statCards = [
    { label: '留痕总条数', value: stats.total, unit: '条', sub: '全部操作留痕', icon: History, gradient: 'from-sky-500 to-blue-600' },
    { label: '今日变动', value: stats.today, unit: '条', sub: '今日新增留痕', icon: Activity, gradient: 'from-emerald-500 to-green-600' },
    { label: '涉及操作人', value: stats.operators, unit: '人', sub: '有操作记录的账号', icon: Users, gradient: 'from-violet-500 to-purple-600' },
    { label: '数据类变动', value: stats.dataChanges, unit: '条', sub: '患者与访视数据变动', icon: Database, gradient: 'from-amber-500 to-orange-500' },
  ]

  const resetPage = () => setPage(1)

  return (
    <div className="space-y-4">
      {/* 统计卡片（全站统一 StatCard） */}
      <div className="grid grid-cols-4 gap-4">
        {statCards.map((s) => (
          <StatCard
            key={s.label}
            label={s.label}
            value={s.value}
            unit={s.unit}
            sub={s.sub}
            icon={s.icon}
            gradient={s.gradient}
          />
        ))}
      </div>

      {/* 筛选区 */}
      <Card className="bg-white">
        <CardContent className="p-3 flex items-center gap-3 flex-wrap">
          <div className="relative w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              className="pl-9 h-9 text-sm"
              placeholder="搜索对象 / 摘要 / 操作人"
              value={search}
              onChange={(e) => { setSearch(e.target.value); resetPage() }}
            />
          </div>
          <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v as typeof actionFilter); resetPage() }}>
            <SelectTrigger className="w-32 h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部操作</SelectItem>
              <SelectItem value="create">新增</SelectItem>
              <SelectItem value="update">更新</SelectItem>
              <SelectItem value="delete">删除</SelectItem>
            </SelectContent>
          </Select>
          <Select value={entityFilter} onValueChange={(v) => { setEntityFilter(v as typeof entityFilter); resetPage() }}>
            <SelectTrigger className="w-36 h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部数据类型</SelectItem>
              {Object.entries(ENTITY_LABELS).map(([k, label]) => (
                <SelectItem key={k} value={k}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-xs text-slate-400 ml-auto">
            共 {filtered.length} 条留痕记录，任何数据的新增、修改、删除均会自动记录
          </span>
        </CardContent>
      </Card>

      {/* 留痕列表 */}
      <Card className="bg-white overflow-hidden py-0 gap-0">
        <CardContent className="p-0">
          <div className={`grid ${GRID_COLS} bg-slate-50 border-b border-slate-200`}>
            {['时间', '操作人', '操作', '数据类型', '对象', '摘要', '明细'].map((h) => (
              <div key={h} className="py-2.5 px-3 text-center text-xs font-medium text-slate-500">{h}</div>
            ))}
          </div>
          {pageRows.length === 0 && (
            <div className="text-center py-10 text-sm text-slate-400">暂无符合条件的留痕记录</div>
          )}
          {pageRows.map((log, idx) => {
            const ActionIcon = ACTION_ICONS[log.action]
            const expanded = expandedId === log.id
            const hasChanges = !!log.changes && log.changes.length > 0
            // 医院内网部署原则：后台管理员不可见临床数据，仅保留操作元数据（何时/何人/何动作/何对象）
            const isClinical = log.entityType === 'visitData' || log.entityType === 'patient'
            return (
              <div key={log.id} className={idx !== pageRows.length - 1 ? 'border-b border-slate-100' : ''}>
                <div className={`grid ${GRID_COLS} text-xs text-slate-700 items-center hover:bg-sky-50/40 transition-colors`}>
                  <div className="py-3 px-3 text-center text-slate-500">
                    {log.timestamp.slice(0, 10)}
                    <span className="block text-[10px] text-slate-400">{log.timestamp.slice(11, 19)}</span>
                  </div>
                  <div className="py-3 px-3 text-center">
                    <span className="font-medium text-slate-800">{log.userName}</span>
                    <span className="block text-[10px] text-slate-400">{ROLE_LABELS[log.role]}</span>
                  </div>
                  <div className="py-3 px-3 text-center">
                    <Badge variant="outline" className={`${ACTION_STYLES[log.action]} text-[10px] gap-0.5`}>
                      <ActionIcon className="w-3 h-3" /> {ACTION_LABELS[log.action]}
                    </Badge>
                  </div>
                  <div className="py-3 px-3 text-center text-slate-500">{ENTITY_LABELS[log.entityType]}</div>
                  <div className="py-3 px-3 truncate" title={log.entityLabel}>{log.entityLabel}</div>
                  <div className="py-3 px-3 truncate text-slate-500" title={isClinical ? '涉及临床数据，已脱敏' : log.summary}>
                    {isClinical ? <span className="text-slate-400 italic">涉及临床数据，已脱敏</span> : log.summary}
                  </div>
                  <div className="py-3 px-3 text-center">
                    {hasChanges ? (
                      <button
                        className="text-sky-500 hover:text-sky-600 inline-flex items-center"
                        onClick={() => setExpandedId(expanded ? null : log.id)}
                      >
                        {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </button>
                    ) : (
                      <span className="text-slate-300">-</span>
                    )}
                  </div>
                </div>
                {expanded && hasChanges && (
                  <div className="bg-slate-50/70 border-t border-slate-100 px-6 py-3">
                    <div className="text-[11px] font-medium text-slate-500 mb-2">
                      字段变更明细（{log.changes!.length} 项）
                      {isClinical && <span className="ml-2 text-amber-500 font-normal">临床数值已按内网部署原则脱敏，仅保留字段名</span>}
                    </div>
                    <div className="space-y-1.5">
                      {log.changes!.map((c, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs">
                          <span className="w-40 flex-shrink-0 font-mono text-slate-600 truncate" title={c.field}>{c.field}</span>
                          {isClinical ? (
                            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-400 tracking-widest">••• → •••</span>
                          ) : (
                            <>
                              <span className="px-2 py-0.5 rounded bg-red-50 text-red-600 line-through max-w-[38%] truncate" title={c.before}>
                                {c.before}
                              </span>
                              <span className="text-slate-400">→</span>
                              <span className="px-2 py-0.5 rounded bg-green-50 text-green-600 max-w-[38%] truncate" title={c.after}>
                                {c.after}
                              </span>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </CardContent>
      </Card>

      {/* 分页 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span>每页</span>
          <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(1) }}>
            <SelectTrigger className="w-20 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map((n) => (
                <SelectItem key={n} value={String(n)}>{n} 条</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span>第 {safePage} / {totalPages} 页</span>
          <button
            className="px-2.5 py-1 rounded border border-slate-200 bg-white disabled:opacity-40 hover:bg-slate-50"
            disabled={safePage <= 1}
            onClick={() => setPage(safePage - 1)}
          >上一页</button>
          <button
            className="px-2.5 py-1 rounded border border-slate-200 bg-white disabled:opacity-40 hover:bg-slate-50"
            disabled={safePage >= totalPages}
            onClick={() => setPage(safePage + 1)}
          >下一页</button>
        </div>
      </div>
    </div>
  )
}
