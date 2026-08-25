import { useEffect, useMemo, useState } from 'react'
import { useAppStorage } from '@/hooks/useAppStorage'
import StatCard from '@/components/StatCard'
import { usePageSize } from '@/hooks/usePageSize'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Building2, Search, Plus, FolderOpen, UserCheck, Clock,
  ChevronLeft, ChevronRight, Trash2,
} from 'lucide-react'

// ==================== 类型与演示数据 ====================
type CustomerType = '申办方' | '医疗机构' | 'CRO'
type AccountStatus = 'active' | 'pending'

interface Customer {
  id: string
  name: string
  type: CustomerType
  contact: string
  phone: string
  email: string
  since: string          // 合作开始日期
  accountStatus: AccountStatus
}

const ADDED_KEY = 'crf_admin_customers_added'
const STATUS_KEY = 'crf_admin_customer_status'

const DEMO_CONTACTS = ['王经理', '李主任', '陈博士', '刘主管', '赵经理', '孙老师']
const DEMO_PHONES = ['138-5166-2041', '139-1772-8853', '137-2094-6618', '136-8830-1147', '135-6421-9902', '138-0057-3376']

function genId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

const TYPE_COLORS: Record<CustomerType, string> = {
  申办方: 'bg-blue-50 text-blue-600',
  医疗机构: 'bg-teal-50 text-teal-600',
  CRO: 'bg-purple-50 text-purple-600',
}

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100]

export default function Customers() {
  const { projects } = useAppStorage()
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | CustomerType>('all')
  const [showCreate, setShowCreate] = useState(false)
  const [pageSize, setPageSize] = usePageSize('crf_pagesize_admin_customers', 10)
  const [page, setPage] = useState(1)

  // 本地新增客户 + 账号状态覆盖（localStorage 持久化）
  const [added, setAdded] = useState<Customer[]>(() => {
    try { return JSON.parse(localStorage.getItem(ADDED_KEY) || '[]') } catch { return [] }
  })
  const [statusMap, setStatusMap] = useState<Record<string, AccountStatus>>(() => {
    try { return JSON.parse(localStorage.getItem(STATUS_KEY) || '{}') } catch { return {} }
  })

  useEffect(() => { localStorage.setItem(ADDED_KEY, JSON.stringify(added)) }, [added])
  useEffect(() => { localStorage.setItem(STATUS_KEY, JSON.stringify(statusMap)) }, [statusMap])

  // 从项目数据推导客户：申办方 + 牵头中心/参与中心
  const derived = useMemo<Customer[]>(() => {
    const list: Customer[] = []
    const seen = new Set<string>()
    let i = 0
    const push = (name: string, type: CustomerType, since?: string) => {
      if (!name || seen.has(name)) return
      seen.add(name)
      list.push({
        id: `derived_${name}`,
        name,
        type,
        contact: DEMO_CONTACTS[i % DEMO_CONTACTS.length],
        phone: DEMO_PHONES[i % DEMO_PHONES.length],
        email: `contact${i + 1}@${type === '申办方' ? 'pharma' : type === 'CRO' ? 'cro' : 'hospital'}.com.cn`,
        since: (since || '2025-01-01').slice(0, 10),
        accountStatus: i % 4 === 3 ? 'pending' : 'active',
      })
      i++
    }
    projects.forEach((p) => {
      push(p.sponsor || '', '申办方', p.createdAt)
      push(p.researchCenter || '', '医疗机构', p.createdAt)
      ;(p.centers || []).forEach((c) => push(c.name, '医疗机构', p.createdAt))
    })
    return list
  }, [projects])

  // 合并 + 应用账号状态覆盖
  const customers = useMemo(() => {
    const all = [...derived, ...added]
    return all.map((c) => ({ ...c, accountStatus: statusMap[c.id] ?? c.accountStatus }))
  }, [derived, added, statusMap])

  const filtered = customers.filter((c) => {
    const matchSearch = !search || c.name.includes(search) || c.contact.includes(search)
    const matchType = typeFilter === 'all' || c.type === typeFilter
    return matchSearch && matchType
  })

  // 关联项目数
  const projectCountOf = (name: string) =>
    projects.filter(
      (p) => p.sponsor === name || p.researchCenter === name || (p.centers || []).some((c) => c.name === name)
    ).length

  // 统计
  const totalCount = customers.length
  const activeCount = customers.filter((c) => c.accountStatus === 'active').length
  const pendingCount = totalCount - activeCount
  const relatedProjects = new Set(
    customers.flatMap((c) =>
      projects
        .filter((p) => p.sponsor === c.name || p.researchCenter === c.name || (p.centers || []).some((x) => x.name === c.name))
        .map((p) => p.id)
    )
  ).size

  // 分页
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize)
  useEffect(() => { setPage(1) }, [search, typeFilter, pageSize])

  // 新建客户
  const [draft, setDraft] = useState<Partial<Customer>>({ type: '申办方' })
  const handleCreate = () => {
    if (!draft.name) return
    setAdded((prev) => [
      ...prev,
      {
        id: genId(),
        name: draft.name!,
        type: (draft.type as CustomerType) || '申办方',
        contact: draft.contact || '-',
        phone: draft.phone || '-',
        email: draft.email || '-',
        since: new Date().toISOString().slice(0, 10),
        accountStatus: 'pending',
      },
    ])
    setShowCreate(false)
    setDraft({ type: '申办方' })
  }

  const toggleStatus = (c: Customer) => {
    const next: AccountStatus = c.accountStatus === 'active' ? 'pending' : 'active'
    setStatusMap((m) => ({ ...m, [c.id]: next }))
  }

  const removeAdded = (c: Customer) => {
    if (!c.id.startsWith('derived_')) {
      setAdded((prev) => prev.filter((x) => x.id !== c.id))
    }
  }

  const HEADERS = ['客户名称', '类型', '联系人', '联系电话', '关联项目', '账号状态', '合作开始', '操作']

  return (
    <div className="space-y-5">
      {/* 统计卡片（全站统一 StatCard） */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="客户总数" value={totalCount} unit="家" sub="全部合作客户" icon={Building2} gradient="from-blue-500 to-blue-600" />
        <StatCard label="已开通账号" value={activeCount} unit="家" sub={`开通率 ${totalCount > 0 ? Math.round((activeCount / totalCount) * 100) : 0}%`} icon={UserCheck} gradient="from-teal-500 to-emerald-600" />
        <StatCard label="待开通" value={pendingCount} unit="家" sub="待授权开通账号" icon={Clock} gradient="from-amber-500 to-orange-500" />
        <StatCard label="关联项目" value={relatedProjects} unit="项" sub="客户名下研究项目" icon={FolderOpen} gradient="from-purple-500 to-violet-600" />
      </div>

      {/* 客户详情 */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
          <Building2 className="w-4 h-4 text-sky-500" /> 客户详情
        </h3>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="搜索客户名称/联系人"
              className="pl-9 w-64 bg-white"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as CustomerType | 'all')}>
            <SelectTrigger className="w-32 bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部类型</SelectItem>
              <SelectItem value="申办方">申办方</SelectItem>
              <SelectItem value="医疗机构">医疗机构</SelectItem>
              <SelectItem value="CRO">CRO</SelectItem>
            </SelectContent>
          </Select>
          <Button className="bg-sky-500 hover:bg-sky-600 text-white" onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4 mr-1" /> 新建客户
          </Button>
        </div>
      </div>

      {/* 客户列表 */}
      <Card className="bg-white overflow-hidden py-0 gap-0">
        <CardContent className="p-0">
          <div className="grid grid-cols-[2fr_1fr_1fr_1.2fr_0.8fr_1fr_1fr_1fr] bg-slate-50 border-b border-slate-200">
            {HEADERS.map((h) => (
              <div key={h} className="py-2.5 px-3 text-center first:text-left text-xs font-medium text-slate-500 whitespace-nowrap">
                {h}
              </div>
            ))}
          </div>

          {filtered.length === 0 && (
            <div className="text-center py-12 text-sm text-slate-400">暂无客户数据</div>
          )}
          {paged.map((c, idx) => {
            const relCount = projectCountOf(c.name)
            const isAdded = !c.id.startsWith('derived_')
            return (
              <div
                key={c.id}
                className={`grid grid-cols-[2fr_1fr_1fr_1.2fr_0.8fr_1fr_1fr_1fr] items-center text-xs text-slate-700 hover:bg-sky-50/40 transition-colors ${
                  idx !== paged.length - 1 ? 'border-b border-slate-100' : ''
                }`}
              >
                <div className="py-3 px-3 text-left">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                      <Building2 className="w-3.5 h-3.5 text-slate-500" />
                    </div>
                    <span className="font-medium text-slate-800">{c.name}</span>
                  </div>
                </div>
                <div className="py-3 px-3 text-center">
                  <span className={`inline-block px-2 py-0.5 rounded text-[10px] ${TYPE_COLORS[c.type]}`}>
                    {c.type}
                  </span>
                </div>
                <div className="py-3 px-3 text-center">{c.contact}</div>
                <div className="py-3 px-3 text-center text-slate-500">{c.phone}</div>
                <div className="py-3 px-3 text-center">
                  <Badge variant="outline" className="text-[10px]">{relCount} 个</Badge>
                </div>
                <div className="py-3 px-3 text-center">
                  <span className={`inline-block px-2 py-0.5 rounded text-[10px] ${
                    c.accountStatus === 'active' ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'
                  }`}>
                    {c.accountStatus === 'active' ? '已开通' : '待开通'}
                  </span>
                </div>
                <div className="py-3 px-3 text-center text-slate-500">{c.since}</div>
                <div className="py-3 px-3 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <Button
                      variant="ghost" size="sm"
                      className={`h-7 px-2 text-[11px] ${
                        c.accountStatus === 'active'
                          ? 'text-slate-400 hover:text-amber-600'
                          : 'text-teal-600 hover:text-teal-700'
                      }`}
                      onClick={() => toggleStatus(c)}
                    >
                      {c.accountStatus === 'active' ? '停用' : '开通'}
                    </Button>
                    {isAdded && (
                      <Button
                        variant="ghost" size="icon"
                        className="w-7 h-7 text-slate-300 hover:text-red-500"
                        onClick={() => removeAdded(c)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}

          {/* 分页栏 */}
          {filtered.length > 0 && (
            <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-200 bg-slate-50/50">
              <span className="text-xs text-slate-500">
                共 {filtered.length} 家 · 第 {(safePage - 1) * pageSize + 1}-{Math.min(safePage * pageSize, filtered.length)} 家
              </span>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-slate-400">每页</span>
                  <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(1) }}>
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
                  <Button
                    variant="outline" size="sm" className="h-7 w-7 p-0"
                    disabled={safePage <= 1}
                    onClick={() => setPage(safePage - 1)}
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </Button>
                  <span className="text-xs text-slate-600 min-w-[52px] text-center">
                    {safePage} / {totalPages}
                  </span>
                  <Button
                    variant="outline" size="sm" className="h-7 w-7 p-0"
                    disabled={safePage >= totalPages}
                    onClick={() => setPage(safePage + 1)}
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 新建客户弹窗 */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>新建客户</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-sm">客户名称 <span className="text-red-500">*</span></Label>
              <Input
                placeholder="如：某制药有限公司 / 某三甲医院"
                value={draft.name || ''}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-sm">客户类型</Label>
              <Select
                value={(draft.type as CustomerType) || '申办方'}
                onValueChange={(v) => setDraft({ ...draft, type: v as CustomerType })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="申办方">申办方</SelectItem>
                  <SelectItem value="医疗机构">医疗机构</SelectItem>
                  <SelectItem value="CRO">CRO</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm">联系人</Label>
                <Input
                  placeholder="联系人姓名"
                  value={draft.contact || ''}
                  onChange={(e) => setDraft({ ...draft, contact: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-sm">联系电话</Label>
                <Input
                  placeholder="手机或座机"
                  value={draft.phone || ''}
                  onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label className="text-sm">邮箱</Label>
              <Input
                placeholder="contact@example.com"
                value={draft.email || ''}
                onChange={(e) => setDraft({ ...draft, email: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>取消</Button>
            <Button
              className="bg-sky-500 hover:bg-sky-600"
              onClick={handleCreate}
              disabled={!draft.name}
            >
              创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
