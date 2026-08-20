import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { useAppStorage } from '@/hooks/useAppStorage'
import StatCard from '@/components/StatCard'
import { usePageSize } from '@/hooks/usePageSize'
import type { Patient, Gender } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Plus, UserPlus, Users, Clock, XCircle, UserCheck, ChevronLeft, ChevronRight, PieChart as PieChartIcon, BarChart3, Table as TableIcon } from 'lucide-react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'

function genId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

function now() {
  return new Date().toISOString()
}

// 登记模块状态：筛选中（登记后立即显示）/ 筛选失败（录入数据提示不符合）/ 入组（提示符合）
// 由数据录入结果同步更新；入组后的治疗中/已完成统一归入「入组」
function regStatusOf(status: string): string {
  if (status === 'screening') return 'screening'
  if (status === 'withdrawn') return 'failed'
  if (status === 'lost') return 'lost'
  return 'enrolled'
}

const STATUS_LABELS: Record<string, string> = {
  screening: '筛选中',
  failed: '筛选失败',
  enrolled: '筛选成功',
  lost: '筛选成功',
}

const STATUS_TEXT_COLORS: Record<string, string> = {
  screening: 'text-teal-600',
  failed: 'text-red-500',
  enrolled: 'text-emerald-600',
  lost: 'text-slate-400',
}

const FAIL_REASON_COLORS = ['#ef4444', '#f97316', '#eab308', '#8b5cf6', '#94a3b8', '#14b8a6']

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100]

// 受试者清单表格列宽模板（表头与表体共用）：全部列按内容比例分配宽度，间距均匀无大片空白
const GRID_COLS = 'grid-cols-[0.45fr_1.15fr_1.5fr_0.75fr_0.55fr_0.95fr_0.75fr_0.95fr_0.8fr]'
const TABLE_HEADERS = ['序号', '研究编号', '研究中心', '姓名缩写', '性别', '出生日期', '筛选编号', '知情日期', '筛选状态']

interface SubjectForm {
  projectId: string
  centerId: string
  nameInitials: string
  gender: Gender
  birthDate: string
  consentDate: string
}

const EMPTY_FORM: SubjectForm = {
  projectId: '',
  centerId: '',
  nameInitials: '',
  gender: 'male',
  birthDate: '',
  consentDate: '',
}

export default function EntrySubjectRegister() {
  const { projects, patients, savePatient } = useAppStorage()
  const [searchParams] = useSearchParams()

  // 筛选条件来自顶部 Header（与其他页面统一置顶）
  const search = searchParams.get('search') || ''
  const selectedProjectNo = searchParams.get('projectNo') || 'all'

  const [showDialog, setShowDialog] = useState(false)
  const [form, setForm] = useState<SubjectForm>(EMPTY_FORM)
  // 筛选失败原因统计的展示方式：饼图 / 柱状图 / 表格
  const [chartView, setChartView] = useState<'pie' | 'bar' | 'table'>('pie')

  const publishedProjects = useMemo(() => projects.filter((p) => p.crfPublished), [projects])
  // Header 项目筛选传的是 projectNo，这里映射回项目 ID
  const projectFilter = selectedProjectNo === 'all'
    ? 'all'
    : (projects.find((p) => p.projectNo === selectedProjectNo)?.id ?? 'all')

  const filtered = useMemo(() => {
    return patients
      .filter((p) => {
        if (!publishedProjects.some((proj) => proj.id === p.projectId)) return false
        if (projectFilter !== 'all' && p.projectId !== projectFilter) return false
        if (search) {
          const s = search.trim().toLowerCase()
          return (
            p.screeningId.toLowerCase().includes(s) ||
            p.screeningNo.toLowerCase().includes(s) ||
            p.nameInitials.toLowerCase().includes(s)
          )
        }
        return true
      })
      .sort((a, b) => a.projectId.localeCompare(b.projectId) || a.screeningNo.localeCompare(b.screeningNo))
  }, [patients, publishedProjects, projectFilter, search])

  // 分页：可选行数
  const [pageSize, setPageSize] = usePageSize('crf_pagesize_entry_subjects')
  const [page, setPage] = useState(1)
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const paged = useMemo(
    () => filtered.slice((safePage - 1) * pageSize, safePage * pageSize),
    [filtered, safePage, pageSize]
  )
  useEffect(() => {
    setPage(1)
  }, [filtered])

  const centerNameOf = (p: Patient): string => {
    const proj = projects.find((x) => x.id === p.projectId)
    return proj?.centers?.find((c) => c.id === p.centerId)?.name || proj?.researchCenter || '-'
  }

  const projectNoOf = (p: Patient): string =>
    projects.find((x) => x.id === p.projectId)?.projectNo || '-'

  // 添加受试者：筛选序号按项目内现有最大值 +1
  const nextScreeningNo = (projectId: string): string => {
    const nums = patients
      .filter((p) => p.projectId === projectId)
      .map((p) => Number(p.screeningNo))
      .filter((n) => !Number.isNaN(n))
    return String((nums.length > 0 ? Math.max(...nums) : 0) + 1).padStart(2, '0')
  }

  const formProject = publishedProjects.find((p) => p.id === form.projectId)

  // 统计范围：项目筛选后（不受搜索词影响）
  const scopedPatients = useMemo(
    () =>
      patients.filter((p) => {
        if (!publishedProjects.some((proj) => proj.id === p.projectId)) return false
        if (projectFilter !== 'all' && p.projectId !== projectFilter) return false
        return true
      }),
    [patients, publishedProjects, projectFilter]
  )

  const stats = useMemo(() => {
    const screening = scopedPatients.filter((p) => regStatusOf(p.status) === 'screening').length
    const failed = scopedPatients.filter((p) => regStatusOf(p.status) === 'failed').length
    const enrolled = scopedPatients.filter((p) => regStatusOf(p.status) === 'enrolled').length
    return { total: scopedPatients.length, screening, failed, enrolled }
  }, [scopedPatients])

  // 登记状况构成：筛选中 / 筛选失败 / 入组
  const statusPieData = useMemo(
    () =>
      [
        { name: '筛选中', value: stats.screening, color: '#14b8a6' },
        { name: '筛选失败', value: stats.failed, color: '#ef4444' },
        { name: '入组', value: stats.enrolled, color: '#f59e0b' },
      ].filter((d) => d.value > 0),
    [stats]
  )

  // 筛选失败原因统计（根据录入的数据统计）
  const failReasonData = useMemo(() => {
    const counts = new Map<string, number>()
    scopedPatients
      .filter((p) => regStatusOf(p.status) === 'failed')
      .forEach((p) => {
        const reason = p.screeningFailReason || '未记录原因'
        counts.set(reason, (counts.get(reason) || 0) + 1)
      })
    return [...counts.entries()].map(([name, value], i) => ({
      name,
      value,
      color: FAIL_REASON_COLORS[i % FAIL_REASON_COLORS.length],
    }))
  }, [scopedPatients])

  const handleSave = () => {
    if (!form.projectId || !form.nameInitials) return
    const no = nextScreeningNo(form.projectId)
    const proj = publishedProjects.find((p) => p.id === form.projectId)
    const firstVisit = proj ? [...proj.visits].sort((a, b) => a.order - b.order)[0] : undefined
    const patient: Patient = {
      id: genId(),
      projectId: form.projectId,
      centerId: form.centerId || undefined,
      screeningNo: no,
      screeningId: no,
      nameInitials: form.nameInitials.toUpperCase(),
      gender: form.gender,
      birthDate: form.birthDate || undefined,
      consentDate: form.consentDate || undefined,
      status: 'screening', // 登记后立即显示「筛选中」，后续由录入数据同步更新
      currentVisit: firstVisit?.code,
      nextVisit: firstVisit?.code,
      createdAt: now(),
      updatedAt: now(),
    }
    savePatient(patient)
    setShowDialog(false)
    setForm(EMPTY_FORM)
  }

  const openDialog = () => {
    setForm({ ...EMPTY_FORM, projectId: projectFilter !== 'all' ? projectFilter : (publishedProjects[0]?.id ?? '') })
    setShowDialog(true)
  }

  return (
    <div className="space-y-5">
      {/* 统计报表（全站统一 StatCard） */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: '累计登记', value: stats.total, unit: '例', sub: '全部已登记受试者', icon: Users, gradient: 'from-blue-500 to-blue-600' },
          { label: '筛选中', value: stats.screening, unit: '例', sub: '待完成筛选评估', icon: Clock, gradient: 'from-teal-500 to-cyan-600' },
          { label: '筛选失败', value: stats.failed, unit: '例', sub: `失败率 ${stats.total > 0 ? Math.round((stats.failed / stats.total) * 100) : 0}%`, icon: XCircle, gradient: 'from-red-500 to-rose-600' },
          { label: '入组', value: stats.enrolled, unit: '例', sub: `入组率 ${stats.total > 0 ? Math.round((stats.enrolled / stats.total) * 100) : 0}%`, icon: UserCheck, gradient: 'from-amber-500 to-orange-500' },
        ].map((s) => (
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
      {/* 图表区：登记状况 + 筛选失败原因（两张图占满整行） */}
      <div className="grid grid-cols-2 gap-4 items-stretch">
        {/* 登记状况统计 */}
        <Card className="bg-white flex flex-col">
          <CardContent className="p-4 flex flex-col flex-1">
            <div className="mb-2">
              <h3 className="text-sm font-medium text-slate-700">登记状况统计</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">筛选中 / 筛选失败 / 入组 构成</p>
            </div>
            {statusPieData.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-sm text-slate-400 min-h-[180px]">
                暂无登记数据
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center gap-20 min-h-[180px]">
                <div className="relative w-[220px] shrink-0">
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={statusPieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={48}
                        outerRadius={80}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {statusPieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-xl font-bold text-slate-800">{stats.total}</span>
                    <span className="text-[11px] text-slate-400">总例数</span>
                  </div>
                </div>
                <div className="w-28 shrink-0 space-y-2">
                  {statusPieData.map((d) => (
                    <div key={d.name} className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: d.color }} />
                      <span className="text-xs text-slate-600 flex-1">{d.name}</span>
                      <span className="text-xs font-semibold text-slate-800 tabular-nums">{d.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 筛选失败原因统计：饼图 / 柱状图 / 表格 可切换 */}
        <Card className="bg-white flex flex-col">
          <CardContent className="p-4 flex flex-col flex-1">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div>
                <h3 className="text-sm font-medium text-slate-700">筛选失败原因统计</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">根据数据录入人员录入的筛选结果自动汇总</p>
              </div>
              <div className="flex items-center gap-0.5 bg-slate-100 rounded-lg p-0.5 flex-shrink-0">
                {([
                  { key: 'pie', label: '饼图', Icon: PieChartIcon },
                  { key: 'bar', label: '柱状图', Icon: BarChart3 },
                  { key: 'table', label: '表格', Icon: TableIcon },
                ] as const).map(({ key, label, Icon }) => (
                  <button
                    key={key}
                    type="button"
                    title={label}
                    onClick={() => setChartView(key)}
                    className={`p-1.5 rounded-md transition-colors ${
                      chartView === key ? 'bg-white text-teal-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </button>
                ))}
              </div>
            </div>

            {failReasonData.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-sm text-slate-400 min-h-[180px]">
                当前范围暂无筛选失败记录
              </div>
            ) : chartView === 'pie' ? (
              <div className="flex-1 flex items-center justify-center gap-20 min-h-[180px]">
                <div className="relative w-[220px] shrink-0">
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={failReasonData}
                        cx="50%"
                        cy="50%"
                        innerRadius={48}
                        outerRadius={80}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {failReasonData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-xl font-bold text-slate-800">{failReasonData.reduce((s, d) => s + d.value, 0)}</span>
                    <span className="text-[11px] text-slate-400">总例数</span>
                  </div>
                </div>
                <div className="w-32 shrink-0 space-y-2">
                  {failReasonData.map((d) => (
                    <div key={d.name} className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: d.color }} />
                      <span className="text-xs text-slate-600 flex-1">{d.name}</span>
                      <span className="text-xs font-semibold text-slate-800 tabular-nums">{d.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : chartView === 'bar' ? (
              <div className="flex-1 min-h-[180px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={failReasonData} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                    <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                    <Bar dataKey="value" name="例数" radius={[3, 3, 0, 0]}>
                      {failReasonData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex-1 overflow-auto">
                <div className="grid grid-cols-3 bg-slate-50 border-y border-slate-200">
                  {['失败原因', '例数', '占比'].map((h) => (
                    <div key={h} className="py-2 px-3 text-center text-xs font-medium text-slate-500">{h}</div>
                  ))}
                </div>
                {failReasonData.map((d, i) => {
                  const total = failReasonData.reduce((sum, x) => sum + x.value, 0)
                  return (
                    <div key={i} className={`grid grid-cols-3 text-xs ${i !== failReasonData.length - 1 ? 'border-b border-slate-100' : ''}`}>
                      <div className="py-2 px-3 text-center flex items-center justify-center gap-1.5 text-slate-700">
                        <span className="w-2 h-2 rounded-full inline-block flex-shrink-0" style={{ background: d.color }} />
                        {d.name}
                      </div>
                      <div className="py-2 px-3 text-center font-medium text-slate-800">{d.value}</div>
                      <div className="py-2 px-3 text-center text-slate-500">
                        {total > 0 ? `${Math.round((d.value / total) * 100)}%` : '-'}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 受试者清单表格（与患者管理统一：标题栏 + 表头 + 行 + 分页栏一体卡片） */}
      <Card className="bg-white overflow-hidden py-0 gap-0">
        <CardContent className="p-0">
          {/* 登记管理标题栏：图标 + 标题 + 登记按钮 */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
            <h3 className="text-sm font-medium text-slate-700 flex items-center gap-2">
              <span className="w-6 h-6 rounded-md bg-teal-50 flex items-center justify-center shrink-0">
                <UserPlus className="w-3.5 h-3.5 text-teal-500" />
              </span>
              登记管理
              <span className="text-xs font-normal text-slate-400">共 {filtered.length} 例</span>
            </h3>
            <Button size="sm" className="bg-teal-500 hover:bg-teal-600 text-white" onClick={openDialog}>
              <Plus className="w-4 h-4 mr-1" /> 登记
            </Button>
          </div>

          {/* 表头 */}
          <div className={`grid ${GRID_COLS} bg-slate-50 border-b border-slate-200`}>
            {TABLE_HEADERS.map((h) => (
              <div key={h} className="py-2.5 px-3 text-center text-xs font-medium text-slate-500 whitespace-nowrap">
                {h}
              </div>
            ))}
          </div>

          {/* 表体 */}
          {filtered.length === 0 && (
            <div className="text-center py-16 text-slate-400">
              <UserPlus className="w-10 h-10 mx-auto mb-3 text-slate-200" />
              暂无受试者，点击右上角「登记」开始
            </div>
          )}
          {paged.map((p, idx) => (
            <div
              key={p.id}
              className={`grid ${GRID_COLS} text-xs text-slate-700 hover:bg-amber-50/40 transition-colors ${
                idx !== paged.length - 1 ? 'border-b border-slate-100' : ''
              }`}
            >
              <div className="py-3 px-3 text-center font-mono text-slate-600">{p.screeningNo}</div>
              <div className="py-3 px-3 text-center font-mono text-slate-500">{projectNoOf(p)}</div>
              <div className="py-3 px-3 text-center truncate">{centerNameOf(p)}</div>
              <div className="py-3 px-3 text-center font-medium text-slate-800">{p.nameInitials}</div>
              <div className="py-3 px-3 text-center">
                {p.gender === 'male' ? (
                  <span className="text-sky-500">♂ 男</span>
                ) : (
                  <span className="text-pink-500">♀ 女</span>
                )}
              </div>
              <div className="py-3 px-3 text-center text-slate-500">{p.birthDate || '-'}</div>
              <div className="py-3 px-3 text-center font-medium text-slate-800 font-mono">{p.screeningId}</div>
              <div className="py-3 px-3 text-center text-slate-500">{p.consentDate || '-'}</div>
              <div className={`py-3 px-3 text-center font-medium ${STATUS_TEXT_COLORS[regStatusOf(p.status)] ?? 'text-slate-500'}`}>
                <span className={`inline-block px-2 py-0.5 rounded text-[10px] ${
                  regStatusOf(p.status) === 'screening' ? 'bg-teal-50 text-teal-600' :
                  regStatusOf(p.status) === 'failed' ? 'bg-red-50 text-red-500' :
                  regStatusOf(p.status) === 'enrolled' ? 'bg-emerald-50 text-emerald-600' :
                  'bg-slate-50 text-slate-500'
                }`}>
                  {STATUS_LABELS[regStatusOf(p.status)] ?? p.status}
                </span>
              </div>
            </div>
          ))}

          {/* 分页栏：可选行数 */}
          {filtered.length > 0 && (
            <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-200 bg-slate-50/50">
              <span className="text-xs text-slate-500">
                共 {filtered.length} 例 · 第 {(safePage - 1) * pageSize + 1}-{Math.min(safePage * pageSize, filtered.length)} 例
              </span>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-slate-400">每页</span>
                  <Select
                    value={String(pageSize)}
                    onValueChange={(v) => { setPageSize(Number(v)); setPage(1) }}
                  >
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

      {/* 登记受试者弹窗：研究中心、姓名缩写、性别、出生日期、知情日期 */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>登记受试者</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* 研究编号（可切换）与研究标题（联动完整展示）分开 */}
            <div className="grid grid-cols-[170px_1fr] gap-3">
              <div>
                <Label className="text-sm">研究编号 <span className="text-red-500">*</span></Label>
                <Select
                  value={form.projectId}
                  onValueChange={(v) => setForm({ ...form, projectId: v, centerId: '' })}
                >
                  <SelectTrigger><SelectValue placeholder="选择研究" /></SelectTrigger>
                  <SelectContent>
                    {publishedProjects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.projectNo}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm">研究标题</Label>
                <div
                  className="min-h-9 px-3 py-1.5 flex items-center rounded-md border border-slate-200 bg-slate-50 text-sm text-slate-700 leading-snug"
                  title={formProject?.name}
                >
                  {formProject?.name || '选择研究编号后自动显示'}
                </div>
              </div>
            </div>
            <div>
              <Label className="text-sm">研究中心</Label>
              <Select
                value={form.centerId}
                onValueChange={(v) => setForm({ ...form, centerId: v })}
                disabled={!formProject?.centers?.length}
              >
                <SelectTrigger>
                  <SelectValue placeholder={formProject?.centers?.length ? '选择中心' : '单中心研究'} />
                </SelectTrigger>
                <SelectContent>
                  {(formProject?.centers ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm">姓名缩写 <span className="text-red-500">*</span></Label>
                <Input
                  placeholder="如：ZSL"
                  value={form.nameInitials}
                  onChange={(e) => setForm({ ...form, nameInitials: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-sm">性别</Label>
                <Select value={form.gender} onValueChange={(v) => setForm({ ...form, gender: v as Gender })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">男</SelectItem>
                    <SelectItem value="female">女</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm">出生日期</Label>
                <Input type="date" value={form.birthDate} onChange={(e) => setForm({ ...form, birthDate: e.target.value })} />
              </div>
              <div>
                <Label className="text-sm">知情日期</Label>
                <Input type="date" value={form.consentDate} onChange={(e) => setForm({ ...form, consentDate: e.target.value })} />
              </div>
            </div>
            <p className="text-[11px] text-slate-400">
              提交后状态自动置为「筛选中」，后续根据录入的筛选数据同步更新为「入组」或「筛选失败」。
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>取消</Button>
            <Button
              className="bg-teal-500 hover:bg-teal-600 text-white"
              onClick={handleSave}
              disabled={!form.projectId || !form.nameInitials}
            >
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
