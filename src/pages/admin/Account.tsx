import { useEffect, useMemo, useState } from 'react'
import type { ModuleKey, ProjectPermission, User, UserRole } from '@/types'
import { useAppStorage } from '@/hooks/useAppStorage'
import StatCard from '@/components/StatCard'
import { usePageSize, PAGE_SIZE_OPTIONS } from '@/hooks/usePageSize'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Search, UserPlus, Trash2, Users, UserCheck, Ban, Clock, Pencil,
  ChevronLeft, ChevronRight, FolderCheck, Mail,
} from 'lucide-react'
import {
  Legend, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts'
import DonutWithLegend from '@/components/DonutWithLegend'

function genId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}
// 生成随机初始密码（授权邮件用）：字母+数字+符号
function genPassword() {
  const letters = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ'
  const digits = '23456789'
  const symbols = '#$%&!@'
  const pick = (s: string, n: number) =>
    Array.from({ length: n }, () => s[Math.floor(Math.random() * s.length)]).join('')
  return `${pick(letters, 4)}${pick(digits, 3)}${pick(symbols, 1)}${pick(letters, 2)}`
}
function now() {
  return new Date().toISOString()
}
function today() {
  return new Date().toISOString().slice(0, 10)
}

// ==================== 常量 ====================

const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: '超级管理员',
  admin: '管理员',
  manager: '课题主持人',
  data_entry: '数据录入',
}

const ROLE_COLORS: Record<UserRole, string> = {
  super_admin: 'bg-purple-50 text-purple-600',
  admin: 'bg-teal-50 text-teal-600',
  manager: 'bg-blue-50 text-blue-600',
  data_entry: 'bg-amber-50 text-amber-600',
}

const AVATAR_COLORS: Record<UserRole, string> = {
  super_admin: 'bg-purple-100 text-purple-600',
  admin: 'bg-teal-100 text-teal-600',
  manager: 'bg-blue-100 text-blue-600',
  data_entry: 'bg-amber-100 text-amber-600',
}

/** 可授权的功能模块（课题主持人 / 数据录入）；integration / smartCheck 为特殊模块，仅后台可配置 */
const MODULE_OPTIONS: { key: ModuleKey; label: string }[] = [
  { key: 'patients', label: '患者管理' },
  { key: 'visits', label: '访视管理' },
  { key: 'dataMgmt', label: '数据管理' },
  { key: 'statistics', label: '统计分析' },
  { key: 'queries', label: '疑问管理' },
  { key: 'integration', label: '数据集成' },
  { key: 'smartCheck', label: '智能核查' },
]
const ALL_MODULES = MODULE_OPTIONS.map((m) => m.key)

type TabKey = 'admin' | 'manager' | 'data_entry'
const TABS: { key: TabKey; label: string; role: UserRole; grantor: string }[] = [
  { key: 'admin', label: '管理员', role: 'admin', grantor: '超级管理员' },
  { key: 'manager', label: '课题主持人', role: 'manager', grantor: '管理员' },
  { key: 'data_entry', label: '数据录入', role: 'data_entry', grantor: '课题主持人' },
]

// 账号状态：使用中 / 冻结 / 已到期
type AccountStatus = 'active' | 'frozen' | 'expired'
function accountStatus(u: User): AccountStatus {
  if (!u.isActive) return 'frozen'
  if (u.expiresAt && u.expiresAt < today()) return 'expired'
  return 'active'
}
const STATUS_LABELS: Record<AccountStatus, string> = { active: '使用中', frozen: '冻结', expired: '已到期' }
const STATUS_COLORS: Record<AccountStatus, string> = {
  active: 'bg-green-50 text-green-600',
  frozen: 'bg-slate-100 text-slate-400',
  expired: 'bg-red-50 text-red-500',
}

const PIE_COLORS = ['#14b8a6', '#3b82f6', '#f59e0b']

export default function AdminAccount() {
  const {
    users, projects, projectPermissions, currentUser,
    saveUser, deleteUser, saveProjectPermission, deleteProjectPermission,
  } = useAppStorage()

  const [tab, setTab] = useState<TabKey>('admin')
  const [search, setSearch] = useState('')
  const [showDialog, setShowDialog] = useState(false)
  const [editingUser, setEditingUser] = useState<Partial<User>>({})
  const [grantUserId, setGrantUserId] = useState<string>('') // 项目授权弹窗目标用户
  const [mailPreview, setMailPreview] = useState<{ name: string; email: string; username: string; password: string; roleLabel: string } | null>(null) // 授权邮件预览
  const [pageSize, setPageSize] = usePageSize('crf_pagesize_admin_account', 10)
  const [page, setPage] = useState(1)

  // ==================== 统计 ====================
  const stats = useMemo(() => {
    const total = users.length
    const active = users.filter((u) => accountStatus(u) === 'active').length
    const frozen = users.filter((u) => accountStatus(u) === 'frozen').length
    const expired = users.filter((u) => accountStatus(u) === 'expired').length
    return { total, active, frozen, expired }
  }, [users])

  const rolePie = useMemo(() => {
    return [
      { name: '管理员', value: users.filter((u) => u.role === 'admin' || u.role === 'super_admin').length },
      { name: '课题主持人', value: users.filter((u) => u.role === 'manager').length },
      { name: '数据录入', value: users.filter((u) => u.role === 'data_entry').length },
    ].filter((d) => d.value > 0)
  }, [users])

  // 权限分配统计：各功能模块在课题主持人 / 数据录入中的开通人数
  const moduleGrantBars = useMemo(() => {
    return MODULE_OPTIONS.map((m) => ({
      name: m.label,
      课题主持人: users.filter((u) => u.role === 'manager' && (u.moduleAccess ?? ALL_MODULES).includes(m.key)).length,
      数据录入: users.filter((u) => u.role === 'data_entry' && (u.moduleAccess ?? ALL_MODULES).includes(m.key)).length,
    }))
  }, [users])

  // ==================== 列表 ====================
  const tabRole = TABS.find((t) => t.key === tab)!.role
  const filtered = users.filter((u) => {
    // 管理员 Tab 展示超级管理员与管理员；其余按角色精确匹配
    const matchRole = tab === 'admin' ? (u.role === 'admin' || u.role === 'super_admin') : u.role === tabRole
    const matchSearch = !search
      || u.name.includes(search) || u.username.includes(search)
      || (u.organization || '').includes(search) || (u.email || '').includes(search)
    return matchRole && matchSearch
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize)
  useEffect(() => { setPage(1) }, [tab, search, pageSize])

  // ==================== 操作 ====================
  const toggleModule = (user: User, key: ModuleKey, on: boolean) => {
    const current = user.moduleAccess ?? ALL_MODULES
    const next = on ? [...new Set([...current, key])] : current.filter((k) => k !== key)
    saveUser({ ...user, moduleAccess: next, updatedAt: now() })
  }

  const toggleActive = (user: User) => {
    saveUser({ ...user, isActive: !user.isActive, updatedAt: now() })
  }

  const suspendModules = (user: User) => {
    const suspended = (user.moduleAccess ?? ALL_MODULES).length === 0
    saveUser({ ...user, moduleAccess: suspended ? ALL_MODULES : [], updatedAt: now() })
  }

  const handleDelete = (user: User) => {
    if (!confirm(`确定删除账号「${user.name}」？该操作会同步撤销其项目授权。`)) return
    deleteUser(user.id)
  }

  const openCreate = () => {
    setEditingUser({
      role: tabRole,
      moduleAccess: tabRole === 'admin' ? undefined : ALL_MODULES,
      grantedBy: currentUser?.id,
    })
    setShowDialog(true)
  }

  const openEdit = (user: User) => {
    setEditingUser({ ...user })
    setShowDialog(true)
  }

  const handleSave = () => {
    if (!editingUser.name || !editingUser.username) return
    const isNew = !editingUser.id
    // 新授权账号：生成随机初始密码，首次登录强制修改账号与密码
    const initialPwd = isNew ? genPassword() : undefined
    const role = (editingUser.role as UserRole) || tabRole
    const newUser: User = {
      id: editingUser.id || genId(),
      username: editingUser.username,
      name: editingUser.name,
      role,
      email: editingUser.email,
      phone: editingUser.phone,
      department: editingUser.department,
      organization: editingUser.organization,
      expiresAt: editingUser.expiresAt,
      grantedBy: editingUser.grantedBy ?? currentUser?.id,
      moduleAccess: editingUser.role === 'admin' || editingUser.role === 'super_admin'
        ? undefined
        : (editingUser.moduleAccess ?? ALL_MODULES),
      password: editingUser.password ?? initialPwd,
      mustChangePassword: isNew ? true : editingUser.mustChangePassword,
      createdAt: editingUser.createdAt || now(),
      updatedAt: now(),
      isActive: editingUser.isActive ?? true,
    }
    saveUser(newUser)
    setShowDialog(false)
    setEditingUser({})
    // 新账号：弹出授权邮件预览（实际部署时由后端发送真实邮件）
    if (isNew && initialPwd) {
      setMailPreview({
        name: newUser.name,
        email: newUser.email || '（未填写邮箱）',
        username: newUser.username,
        password: initialPwd,
        roleLabel: ROLE_LABELS[role],
      })
    }
  }

  // ==================== 项目授权（数据录入） ====================
  const grantUser = users.find((u) => u.id === grantUserId)
  const permsOf = (userId: string) => projectPermissions.filter((p) => p.userId === userId)

  const toggleProjectGrant = (user: User, projectId: string, on: boolean) => {
    const existing = projectPermissions.find((p) => p.userId === user.id && p.projectId === projectId)
    if (on && !existing) {
      const perm: ProjectPermission = {
        id: genId(),
        projectId,
        userId: user.id,
        grantedBy: currentUser?.id ?? 'user_admin_01',
        grantedAt: now(),
        canCreatePatient: true,
        canEditData: true,
        canViewData: true,
      }
      saveProjectPermission(perm)
    } else if (!on && existing) {
      deleteProjectPermission(existing.id)
    }
  }

  // ==================== 渲染 ====================

  const moduleSwitch = (user: User, key: ModuleKey) => {
    const on = (user.moduleAccess ?? ALL_MODULES).includes(key)
    return (
      <div className="flex justify-center">
        <Switch
          checked={on}
          onCheckedChange={(v) => toggleModule(user, key, v)}
          className="data-[state=checked]:bg-teal-500"
        />
      </div>
    )
  }

  const rowOps = (user: User) => {
    const builtin = user.role === 'super_admin'
    return (
      <div className="flex items-center justify-center gap-0.5">
        <Button
          variant="ghost" size="icon" className="w-7 h-7 text-slate-400 hover:text-sky-600"
          title="编辑" onClick={() => openEdit(user)}
        >
          <Pencil className="w-3.5 h-3.5" />
        </Button>
        {user.role !== 'admin' && user.role !== 'super_admin' && (
          <Button
            variant="ghost" size="sm"
            className="h-7 px-1.5 text-[11px] text-slate-400 hover:text-amber-600"
            title={(user.moduleAccess ?? ALL_MODULES).length === 0 ? '恢复权限' : '暂停权限'}
            onClick={() => suspendModules(user)}
          >
            {(user.moduleAccess ?? ALL_MODULES).length === 0 ? '恢复权限' : '暂停权限'}
          </Button>
        )}
        {!builtin && (
          <>
            <Button
              variant="ghost" size="sm"
              className={`h-7 px-1.5 text-[11px] ${user.isActive ? 'text-slate-400 hover:text-amber-600' : 'text-teal-600 hover:text-teal-700'}`}
              onClick={() => toggleActive(user)}
            >
              {user.isActive ? '冻结账号' : '解冻账号'}
            </Button>
            <Button
              variant="ghost" size="icon" className="w-7 h-7 text-slate-300 hover:text-red-500"
              title="删除账号" onClick={() => handleDelete(user)}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </>
        )}
        {builtin && <span className="text-[10px] text-slate-300 px-1">系统内置</span>}
      </div>
    )
  }

  const statusBadge = (user: User) => {
    const st = accountStatus(user)
    return <span className={`inline-block px-2 py-0.5 rounded text-[10px] ${STATUS_COLORS[st]}`}>{STATUS_LABELS[st]}</span>
  }

  // 表格列定义（按 Tab）
  const GRIDS: Record<TabKey, { cols: string; headers: string[] }> = {
    admin: {
      cols: 'grid-cols-[0.4fr_1fr_0.9fr_0.9fr_1.4fr_1fr_0.8fr_1fr_1.6fr]',
      headers: ['序号', '姓名', '用户名', '角色', '邮箱', '创建日期', '状态', '结束日期', '操作'],
    },
    manager: {
      cols: 'grid-cols-[0.4fr_1fr_1.2fr_1.2fr_0.9fr_0.7fr_0.75fr_0.75fr_0.75fr_0.75fr_0.75fr_0.75fr_0.75fr_1.5fr]',
      headers: ['序号', '姓名', '单位', '邮箱', '创建日期', '状态', '患者管理', '访视管理', '数据管理', '统计分析', '疑问管理', '数据集成', '智能核查', '操作'],
    },
    data_entry: {
      cols: 'grid-cols-[0.4fr_1fr_1.2fr_1.2fr_1fr_0.9fr_0.7fr_0.75fr_0.75fr_0.75fr_0.75fr_0.75fr_0.75fr_0.75fr_1.5fr]',
      headers: ['序号', '姓名', '单位', '邮箱', '项目授权', '创建日期', '状态', '患者管理', '访视管理', '数据管理', '统计分析', '疑问管理', '数据集成', '智能核查', '操作'],
    },
  }
  const grid = GRIDS[tab]

  const statCards = [
    { label: '累计开通', value: stats.total, unit: '个', sub: '全部已授权账号', icon: Users, gradient: 'from-blue-500 to-blue-600' },
    { label: '使用中', value: stats.active, unit: '个', sub: `占比 ${stats.total > 0 ? Math.round((stats.active / stats.total) * 100) : 0}%`, icon: UserCheck, gradient: 'from-emerald-500 to-green-600' },
    { label: '冻结', value: stats.frozen, unit: '个', sub: '暂停登录使用', icon: Ban, gradient: 'from-slate-400 to-slate-500' },
    { label: '已到期 / 关闭', value: stats.expired, unit: '个', sub: '需重新授权', icon: Clock, gradient: 'from-red-500 to-rose-600' },
  ]

  return (
    <div className="space-y-4">
      {/* 说明 + 操作栏 */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-400">
          三级授权体系：超级管理员授权管理员 → 管理员授权课题主持人并开通模块 → 课题主持人授权数据录入人员
        </p>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="搜索姓名/用户名/单位/邮箱"
              className="pl-9 w-64 bg-white"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button className="bg-sky-500 hover:bg-sky-600 text-white" onClick={openCreate}>
            <UserPlus className="w-4 h-4 mr-1" /> 授权{TABS.find((t) => t.key === tab)!.label}
          </Button>
        </div>
      </div>

      {/* 统计报表：状态统计卡（独占一行，全站统一 StatCard） */}
      <div className="grid grid-cols-4 gap-4">
        {statCards.map((c) => (
          <StatCard
            key={c.label}
            label={c.label}
            value={c.value}
            unit={c.unit}
            sub={c.sub}
            icon={c.icon}
            gradient={c.gradient}
          />
        ))}
      </div>

      {/* 统计图示：账号角色分布 + 权限分配 */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="bg-white">
          <CardContent className="p-4">
            <p className="text-sm font-medium text-slate-700 mb-1">账号角色分布</p>
            <p className="text-[11px] text-slate-400 mb-2">各级账号数量占比</p>
            <div className="h-44 flex items-center">
              <DonutWithLegend
                data={rolePie.map((d, i) => ({ ...d, color: PIE_COLORS[i % PIE_COLORS.length] }))}
                height={150}
                pieWidth={170}
                gapClass="gap-10"
                legendWidthClass="w-24"
                centerLabel="账号总数"
                valueUnit="个"
              />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white">
          <CardContent className="p-4">
            <p className="text-sm font-medium text-slate-700 mb-1">权限分配统计</p>
            <p className="text-[11px] text-slate-400 mb-2">各功能模块开通人数（按角色）</p>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={moduleGrantBars} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v: number, name: string) => [`${v} 人`, name]} />
                  <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="课题主持人" fill="#3b82f6" radius={[3, 3, 0, 0]} barSize={18} />
                  <Bar dataKey="数据录入" fill="#f59e0b" radius={[3, 3, 0, 0]} barSize={18} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 账号列表：Tab 切换 */}
      <Card className="bg-white overflow-hidden py-0 gap-0">
        {/* TAB 头 */}
        <div className="flex items-center gap-1 px-4 pt-3 border-b border-slate-100">
          {TABS.map((t) => {
            const count = t.key === 'admin'
              ? users.filter((u) => u.role === 'admin' || u.role === 'super_admin').length
              : users.filter((u) => u.role === t.role).length
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-4 py-2 text-sm rounded-t-lg border-b-2 transition-colors ${
                  tab === t.key
                    ? 'border-sky-500 text-sky-600 font-medium'
                    : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                {t.label}（{count}）
              </button>
            )
          })}
          <span className="ml-auto text-[11px] text-slate-300 pb-2">
            {TABS.find((t) => t.key === tab)!.label}由{TABS.find((t) => t.key === tab)!.grantor}授权开通
          </span>
        </div>

        <CardContent className="p-0">
          {/* 表头 */}
          <div className={`grid ${grid.cols} bg-slate-50 border-b border-slate-200`}>
            {grid.headers.map((h) => (
              <div key={h} className="py-2.5 px-2 text-center text-xs font-medium text-slate-500 whitespace-nowrap">
                {h}
              </div>
            ))}
          </div>

          {filtered.length === 0 && (
            <div className="text-center py-12 text-sm text-slate-400">暂无账号，点击右上角按钮授权开通</div>
          )}

          {paged.map((user, idx) => (
            <div
              key={user.id}
              className={`grid ${grid.cols} items-center text-xs text-slate-700 hover:bg-sky-50/40 transition-colors ${
                idx !== paged.length - 1 ? 'border-b border-slate-100' : ''
              }`}
            >
              {/* 序号 */}
              <div className="py-3 px-2 text-center text-slate-400">{(safePage - 1) * pageSize + idx + 1}</div>
              {/* 姓名 */}
              <div className="py-3 px-2">
                <div className="flex items-center gap-2 justify-center">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-[11px] font-bold ${AVATAR_COLORS[user.role]}`}>
                    {user.name.slice(0, 1)}
                  </div>
                  <span className="font-medium text-slate-800">{user.name}</span>
                </div>
              </div>

              {tab === 'admin' && (
                <>
                  <div className="py-3 px-2 text-center text-slate-500">{user.username}</div>
                  <div className="py-3 px-2 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] ${ROLE_COLORS[user.role]}`}>
                      {ROLE_LABELS[user.role]}
                    </span>
                  </div>
                  <div className="py-3 px-2 text-center text-slate-500 truncate" title={user.email}>{user.email || '-'}</div>
                </>
              )}

              {tab !== 'admin' && (
                <>
                  <div className="py-3 px-2 text-center text-slate-500 truncate" title={user.organization}>
                    {user.organization || user.department || '-'}
                  </div>
                  <div className="py-3 px-2 text-center text-slate-500 truncate" title={user.email}>{user.email || '-'}</div>
                </>
              )}

              {/* 数据录入：项目授权 */}
              {tab === 'data_entry' && (
                <div className="py-3 px-2 text-center">
                  <Button
                    variant="outline" size="sm" className="h-7 text-[11px] px-2"
                    onClick={() => setGrantUserId(user.id)}
                  >
                    <FolderCheck className="w-3.5 h-3.5 mr-1 text-teal-500" />
                    {permsOf(user.id).length > 0 ? `已授权 ${permsOf(user.id).length} 项` : '授权项目'}
                  </Button>
                </div>
              )}

              {/* 创建日期 */}
              <div className="py-3 px-2 text-center text-slate-500">
                {user.createdAt ? new Date(user.createdAt).toLocaleDateString('zh-CN') : '-'}
              </div>
              {/* 状态 */}
              <div className="py-3 px-2 text-center">{statusBadge(user)}</div>

              {/* 管理员 Tab：结束日期 */}
              {tab === 'admin' && (
                <div className="py-3 px-2 text-center text-slate-500">{user.expiresAt || '长期'}</div>
              )}

              {/* 模块开关（课题主持人 / 数据录入） */}
              {tab !== 'admin' && MODULE_OPTIONS.map((m) => (
                <div key={m.key} className="py-3 px-2">{moduleSwitch(user, m.key)}</div>
              ))}

              {/* 操作 */}
              <div className="py-3 px-2">{rowOps(user)}</div>
            </div>
          ))}

          {/* 分页栏 */}
          {filtered.length > 0 && (
            <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-200 bg-slate-50/50">
              <span className="text-xs text-slate-500">
                共 {filtered.length} 个账号 · 第 {(safePage - 1) * pageSize + 1}-{Math.min(safePage * pageSize, filtered.length)} 个
              </span>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-slate-400">每页</span>
                  <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
                    <SelectTrigger className="h-7 w-[64px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAGE_SIZE_OPTIONS.map((n) => (
                        <SelectItem key={n} value={String(n)} className="text-xs">{n}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="text-xs text-slate-400">行</span>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}>
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </Button>
                  <span className="text-xs text-slate-600 min-w-[52px] text-center">{safePage} / {totalPages}</span>
                  <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={safePage >= totalPages} onClick={() => setPage(safePage + 1)}>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 授权/编辑账号弹窗 */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingUser.id ? `编辑${ROLE_LABELS[editingUser.role as UserRole] ?? '账号'}` : `授权${TABS.find((t) => t.key === tab)!.label}`}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm">姓名 <span className="text-red-500">*</span></Label>
                <Input
                  placeholder="如：张三"
                  value={editingUser.name || ''}
                  onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-sm">用户名 <span className="text-red-500">*</span></Label>
                <Input
                  placeholder="如：zhangsan"
                  value={editingUser.username || ''}
                  onChange={(e) => setEditingUser({ ...editingUser, username: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm">角色</Label>
                <Select
                  value={editingUser.role || tabRole}
                  onValueChange={(v) => setEditingUser({ ...editingUser, role: v as UserRole })}
                  disabled={editingUser.role === 'super_admin'}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {editingUser.role === 'super_admin' && <SelectItem value="super_admin">超级管理员</SelectItem>}
                    <SelectItem value="admin">管理员</SelectItem>
                    <SelectItem value="manager">课题主持人</SelectItem>
                    <SelectItem value="data_entry">数据录入</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm">单位</Label>
                <Input
                  placeholder="如：上海瑞金医院"
                  value={editingUser.organization || ''}
                  onChange={(e) => setEditingUser({ ...editingUser, organization: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm">邮箱（接收授权邮件）</Label>
                <Input
                  placeholder="选填"
                  value={editingUser.email || ''}
                  onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-sm">结束日期（授权到期）</Label>
                <Input
                  type="date"
                  value={editingUser.expiresAt || ''}
                  onChange={(e) => setEditingUser({ ...editingUser, expiresAt: e.target.value || undefined })}
                />
              </div>
            </div>
            {/* 模块开通（课题主持人 / 数据录入） */}
            {editingUser.role !== 'admin' && editingUser.role !== 'super_admin' && (
              <div>
                <Label className="text-sm">开通模块</Label>
                <div className="grid grid-cols-2 gap-2 mt-1.5">
                  {MODULE_OPTIONS.map((m) => {
                    const on = (editingUser.moduleAccess ?? ALL_MODULES).includes(m.key)
                    return (
                      <label key={m.key} className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                        <Checkbox
                          checked={on}
                          onCheckedChange={(v) => {
                            const cur = editingUser.moduleAccess ?? ALL_MODULES
                            const next = v ? [...new Set([...cur, m.key])] : cur.filter((k) => k !== m.key)
                            setEditingUser({ ...editingUser, moduleAccess: next })
                          }}
                        />
                        {m.label}
                      </label>
                    )
                  })}
                </div>
              </div>
            )}
            <p className="text-[11px] text-slate-400">
              授权人：{currentUser?.name ?? '当前账号'}（{ROLE_LABELS[(currentUser?.role ?? 'admin') as UserRole]}）；保存后账号实时同步到各端。
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>取消</Button>
            <Button
              className="bg-sky-500 hover:bg-sky-600"
              onClick={handleSave}
              disabled={!editingUser.name || !editingUser.username}
            >
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 项目授权弹窗（数据录入） */}
      <Dialog open={!!grantUserId} onOpenChange={(v) => !v && setGrantUserId('')}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>项目授权{grantUser ? ` · ${grantUser.name}` : ''}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2 max-h-72 overflow-y-auto">
            {projects.map((p) => {
              const granted = !!projectPermissions.find((x) => x.userId === grantUserId && x.projectId === p.id)
              return (
                <label key={p.id} className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-slate-50 cursor-pointer">
                  <Checkbox
                    checked={granted}
                    onCheckedChange={(v) => grantUser && toggleProjectGrant(grantUser, p.id, !!v)}
                  />
                  <div className="min-w-0">
                    <div className="text-sm text-slate-700 font-medium">{p.projectNo}</div>
                    <div className="text-[11px] text-slate-400 truncate">{p.name}</div>
                  </div>
                  {p.crfPublished && (
                    <Badge variant="outline" className="ml-auto text-[10px] bg-teal-50 text-teal-600 border-teal-200 shrink-0">
                      已发布
                    </Badge>
                  )}
                </label>
              )
            })}
          </div>
          <DialogFooter>
            <Button className="bg-sky-500 hover:bg-sky-600" onClick={() => setGrantUserId('')}>完成</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 授权邮件预览（模拟发送） */}
      <Dialog open={!!mailPreview} onOpenChange={(v) => !v && setMailPreview(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-teal-600" /> 授权邮件预览
            </DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <div className="rounded-lg border border-slate-200 overflow-hidden">
              <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 text-xs text-slate-500 space-y-1">
                <div>发件人：科研数据管理平台 &lt;no-reply@clini-x.cn&gt;</div>
                <div>收件人：{mailPreview?.email}</div>
                <div>主题：【科研数据管理平台】您的{mailPreview?.roleLabel}账号已开通</div>
              </div>
              <div className="px-5 py-4 text-sm text-slate-700 space-y-3 leading-relaxed">
                <p>{mailPreview?.name}，您好：</p>
                <p>您的{mailPreview?.roleLabel}账号已授权开通，请使用以下信息登录系统：</p>
                <div className="rounded-lg bg-teal-50 border border-teal-100 px-4 py-3 space-y-1.5">
                  <div>登录链接：<span className="text-teal-600 underline">{window.location.origin}/login</span></div>
                  <div>登录账号：<span className="font-mono font-medium">{mailPreview?.username}</span></div>
                  <div>初始密码：<span className="font-mono font-medium">{mailPreview?.password}</span></div>
                </div>
                <p className="text-xs text-slate-400">
                  首次登录请使用登录账号（或邮箱）与初始密码，登录后系统将引导您修改登录账号与密码。如非本人操作，请忽略本邮件。
                </p>
              </div>
            </div>
            <p className="text-[11px] text-slate-400 mt-3">
              演示环境为邮件预览；生产环境部署邮件服务（SMTP/邮件 API）后将自动发送真实邮件。
            </p>
          </div>
          <DialogFooter>
            <Button className="bg-teal-600 hover:bg-teal-700" onClick={() => setMailPreview(null)}>知道了</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
