import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { useAppStorage } from '@/hooks/useAppStorage'
import DonutWithLegend from '@/components/DonutWithLegend'
import StatCard from '@/components/StatCard'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import {
  FolderOpen, PlayCircle, ClipboardList, UserCheck, PieChart as PieIcon,
  UserRound, BarChart3, Columns2, Rows2,
} from 'lucide-react'

// 受试者状态配色
const SUBJECT_COLORS = {
  screening: '#8b5cf6',   // 筛选
  screenFail: '#ef4444',  // 筛选失败
  enrolled: '#3b82f6',    // 入组
  treatment: '#14b8a6',   // 治疗期
  completed: '#f59e0b',   // 完成研究
  withdrawn: '#f97316',   // 退出研究
}

type Period = 'day' | 'month' | 'year'

export default function AdminHome() {
  const { projects, patients, users, visitData, projectPermissions } = useAppStorage()

  // 受试者状态分类：筛选失败=退出且有失败原因；退出研究=入组后退出/失访
  const isScreenFail = (s: string, reason?: string) => s === 'withdrawn' && !!reason
  const isWithdrawn = (s: string, reason?: string) => (s === 'withdrawn' && !reason) || s === 'lost'
  const isEnrolled = (s: string) => s === 'enrolled' || s === 'treatment' || s === 'completed'

  // ==================== 1. 顶部统计卡 ====================
  const inProgressCount = projects.filter((p) => p.status === 'study_started' || p.status === 'active').length
  const enrolledCount = patients.filter((p) => isEnrolled(p.status)).length
  const statCards = [
    {
      label: '项目总数', value: projects.length, unit: '项', sub: `进行中 ${inProgressCount} 项`,
      icon: FolderOpen, gradient: 'from-blue-500 to-blue-600',
    },
    {
      label: '进行中', value: inProgressCount, unit: '项',
      sub: `占全部 ${projects.length > 0 ? Math.round((inProgressCount / projects.length) * 100) : 0}%`,
      icon: PlayCircle, gradient: 'from-teal-500 to-emerald-600',
    },
    {
      label: '筛选例数', value: patients.length, unit: '例', sub: '全部受试者',
      icon: ClipboardList, gradient: 'from-violet-500 to-purple-600',
    },
    {
      label: '入组例数', value: enrolledCount, unit: '例',
      sub: `入组率 ${patients.length > 0 ? Math.round((enrolledCount / patients.length) * 100) : 0}%`,
      icon: UserCheck, gradient: 'from-amber-500 to-orange-500',
    },
  ]

  // ==================== 2. 筛选入组进度（按研究） ====================
  const enrollProgressData = useMemo(
    () =>
      projects.map((p) => {
        const pts = patients.filter((pt) => pt.projectId === p.id)
        return {
          name: p.projectNo,
          筛选例数: pts.length,
          筛选失败: pts.filter((pt) => isScreenFail(pt.status, pt.screeningFailReason)).length,
          入组例数: pts.filter((pt) => isEnrolled(pt.status)).length,
        }
      }),
    [projects, patients]
  )

  // ==================== 3. 患者注册进度（日/月/年 + 研究筛选） ====================
  const [regPeriod, setRegPeriod] = useState<Period>('month')
  const [regProjectNo, setRegProjectNo] = useState<string>('all')
  const [subjectLayout, setSubjectLayout] = useState<'grid' | 'rows'>('grid')
  const [progressLayout, setProgressLayout] = useState<'grid' | 'rows'>('rows')
  const [staffLayout, setStaffLayout] = useState<'grid' | 'rows'>('grid')

  const regPatients = useMemo(
    () =>
      regProjectNo === 'all'
        ? patients
        : patients.filter((pt) => projects.find((p) => p.id === pt.projectId)?.projectNo === regProjectNo),
    [patients, projects, regProjectNo]
  )

  const regData = useMemo(() => {
    const keyOf = (d?: string) => {
      if (!d) return undefined
      if (regPeriod === 'day') return d.slice(0, 10)
      if (regPeriod === 'month') return d.slice(0, 7)
      return d.slice(0, 4)
    }
    let sorted: string[]
    if (regPeriod === 'month') {
      // 月维度固定展示最近 12 个月（含无数据月份），避免早年数据拉乱时间轴
      const now = new Date()
      sorted = []
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
        sorted.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
      }
    } else {
      const keys = new Set<string>()
      regPatients.forEach((pt) => {
        const k = keyOf(pt.consentDate)
        if (k) keys.add(k)
      })
      sorted = [...keys].sort()
      if (regPeriod === 'day') sorted = sorted.slice(-14) // 日维度只展示最近 14 天，避免拥挤
    }
    return sorted.map((k) => {
      const inPeriod = regPatients.filter((pt) => keyOf(pt.consentDate) === k)
      return {
        name: regPeriod === 'day' ? k.slice(5) : k,
        筛选例数: inPeriod.length,
        筛选失败: inPeriod.filter((pt) => isScreenFail(pt.status, pt.screeningFailReason)).length,
        入组例数: inPeriod.filter((pt) => isEnrolled(pt.status)).length,
      }
    })
  }, [regPatients, regPeriod])

  // ==================== 4. 受试者状态 ====================
  const subjectPie = useMemo(() => {
    const items = [
      { name: '筛选', value: patients.filter((p) => p.status === 'screening').length, color: SUBJECT_COLORS.screening },
      { name: '筛选失败', value: patients.filter((p) => isScreenFail(p.status, p.screeningFailReason)).length, color: SUBJECT_COLORS.screenFail },
      { name: '入组', value: patients.filter((p) => p.status === 'enrolled').length, color: SUBJECT_COLORS.enrolled },
      { name: '治疗期', value: patients.filter((p) => p.status === 'treatment').length, color: SUBJECT_COLORS.treatment },
      { name: '完成研究', value: patients.filter((p) => p.status === 'completed').length, color: SUBJECT_COLORS.completed },
      { name: '退出研究', value: patients.filter((p) => isWithdrawn(p.status, p.screeningFailReason)).length, color: SUBJECT_COLORS.withdrawn },
    ]
    return items.filter((d) => d.value > 0)
  }, [patients])

  const subjectByProject = useMemo(
    () =>
      projects.map((p) => {
        const pts = patients.filter((pt) => pt.projectId === p.id)
        return {
          name: p.projectNo,
          筛选失败: pts.filter((pt) => isScreenFail(pt.status, pt.screeningFailReason)).length,
          入组: pts.filter((pt) => pt.status === 'enrolled').length,
          治疗期: pts.filter((pt) => pt.status === 'treatment').length,
          完成研究: pts.filter((pt) => pt.status === 'completed').length,
          退出研究: pts.filter((pt) => isWithdrawn(pt.status, pt.screeningFailReason)).length,
        }
      }),
    [projects, patients]
  )

  // ==================== 5. 录入人员 ====================
  const entryStaff = useMemo(() => {
    const now = new Date().toISOString()
    return users
      .filter((u) => u.role === 'data_entry')
      .map((u) => {
        const onDuty = u.isActive && (!u.expiresAt || u.expiresAt > now)
        const projectCount = new Set(
          projectPermissions.filter((pp) => pp.userId === u.id).map((pp) => pp.projectId)
        ).size
        const myPatients = patients.filter((pt) => pt.createdBy === u.id)
        const myPatientIds = new Set(myPatients.map((pt) => pt.id))
        const doneVisits = visitData.filter(
          (vd) => myPatientIds.has(vd.patientId) && vd.status === 'completed'
        ).length
        return {
          user: u,
          onDuty,
          projectCount,
          patientCount: myPatients.length,
          doneVisits,
        }
      })
  }, [users, projectPermissions, patients, visitData])

  const staffChartData = entryStaff.map((s) => ({
    name: s.user.name,
    负责患者: s.patientCount,
    完成访视: s.doneVisits,
  }))

  return (
    <div className="space-y-5">
      {/* 1. 顶部统计卡（全站统一 StatCard） */}
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

      {/* 2+3. 筛选入组进度 / 患者注册进度（可切换并排/整行） */}
      <div className="flex items-center justify-between px-1">
        <span className="text-sm font-medium text-slate-500">入组与注册进度</span>
        <div className="flex rounded-lg border border-slate-200 overflow-hidden">
          <button
            onClick={() => setProgressLayout('grid')}
            title="并排展示"
            className={`px-2.5 py-1 transition-colors ${
              progressLayout === 'grid' ? 'bg-teal-600 text-white' : 'bg-white text-slate-400 hover:bg-slate-50'
            }`}
          >
            <Columns2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setProgressLayout('rows')}
            title="整行展示"
            className={`px-2.5 py-1 transition-colors ${
              progressLayout === 'rows' ? 'bg-teal-600 text-white' : 'bg-white text-slate-400 hover:bg-slate-50'
            }`}
          >
            <Rows2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <div className={`grid gap-5 ${progressLayout === 'grid' ? 'grid-cols-2' : 'grid-cols-1'}`}>
      {/* 2. 筛选入组进度（整行） */}
      <Card className="bg-white">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-teal-600" /> 筛选入组进度
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={enrollProgressData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="筛选例数" fill="#14b8a6" radius={[2, 2, 0, 0]} />
              <Bar dataKey="筛选失败" fill="#ef4444" radius={[2, 2, 0, 0]} />
              <Bar dataKey="入组例数" fill="#f97316" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* 3. 患者注册进度（整行，日/月/年 + 研究筛选） */}
      <Card className="bg-white">
        <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-violet-600" /> 患者注册进度
          </CardTitle>
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-slate-200 overflow-hidden">
              {(['day', 'month', 'year'] as Period[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setRegPeriod(p)}
                  className={`px-3 py-1 text-xs transition-colors ${
                    regPeriod === p ? 'bg-teal-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  {p === 'day' ? '日' : p === 'month' ? '月' : '年'}
                </button>
              ))}
            </div>
            <Select value={regProjectNo} onValueChange={setRegProjectNo}>
              <SelectTrigger className="h-8 w-[150px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">全部研究</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.projectNo} className="text-xs">{p.projectNo}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={regData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="筛选例数" fill="#8b5cf6" radius={[2, 2, 0, 0]} />
              <Bar dataKey="筛选失败" fill="#ef4444" radius={[2, 2, 0, 0]} />
              <Bar dataKey="入组例数" fill="#3b82f6" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      </div>

      {/* 4. 受试者状态：左饼图 + 右分研究柱状图（可切换并排/整行） */}
      <div className="flex items-center justify-between px-1">
        <span className="text-sm font-medium text-slate-500">受试者状态</span>
        <div className="flex rounded-lg border border-slate-200 overflow-hidden">
          <button
            onClick={() => setSubjectLayout('grid')}
            title="并排展示"
            className={`px-2.5 py-1 transition-colors ${
              subjectLayout === 'grid' ? 'bg-teal-600 text-white' : 'bg-white text-slate-400 hover:bg-slate-50'
            }`}
          >
            <Columns2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setSubjectLayout('rows')}
            title="整行展示"
            className={`px-2.5 py-1 transition-colors ${
              subjectLayout === 'rows' ? 'bg-teal-600 text-white' : 'bg-white text-slate-400 hover:bg-slate-50'
            }`}
          >
            <Rows2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <div className={`grid gap-5 ${subjectLayout === 'grid' ? 'grid-cols-2' : 'grid-cols-1'}`}>
        <Card className="bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <PieIcon className="w-4 h-4 text-blue-600" /> 受试者状态分布
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DonutWithLegend data={subjectPie} height={220} centerLabel="总例数" legendWidthClass="w-28" />
          </CardContent>
        </Card>

        <Card className="bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-teal-600" /> 各研究受试者状态
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={subjectByProject}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="筛选失败" stackId="s" fill={SUBJECT_COLORS.screenFail} />
                <Bar dataKey="入组" stackId="s" fill={SUBJECT_COLORS.enrolled} />
                <Bar dataKey="治疗期" stackId="s" fill={SUBJECT_COLORS.treatment} />
                <Bar dataKey="完成研究" stackId="s" fill={SUBJECT_COLORS.completed} />
                <Bar dataKey="退出研究" stackId="s" fill={SUBJECT_COLORS.withdrawn} radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* 5. 录入人员：左信息表 + 右工作量统计（可切换并排/整行） */}
      <div className="flex items-center justify-between px-1">
        <span className="text-sm font-medium text-slate-500">录入人员</span>
        <div className="flex rounded-lg border border-slate-200 overflow-hidden">
          <button
            onClick={() => setStaffLayout('grid')}
            title="并排展示"
            className={`px-2.5 py-1 transition-colors ${
              staffLayout === 'grid' ? 'bg-teal-600 text-white' : 'bg-white text-slate-400 hover:bg-slate-50'
            }`}
          >
            <Columns2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setStaffLayout('rows')}
            title="整行展示"
            className={`px-2.5 py-1 transition-colors ${
              staffLayout === 'rows' ? 'bg-teal-600 text-white' : 'bg-white text-slate-400 hover:bg-slate-50'
            }`}
          >
            <Rows2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <div className={`grid gap-5 ${staffLayout === 'grid' ? 'grid-cols-2' : 'grid-cols-1'}`}>
        <Card className="bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <UserRound className="w-4 h-4 text-teal-600" /> 录入人员信息
            </CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  {['姓名', '单位', '角色', '加入日期', '状态', '项目总数'].map((h) => (
                    <th key={h} className="py-2 text-center text-xs font-medium text-slate-400 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entryStaff.map(({ user: u, onDuty, projectCount }) => (
                  <tr key={u.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="py-2.5 text-center text-sm font-medium text-slate-800">{u.name}</td>
                    <td className="py-2.5 text-center text-xs text-slate-500 max-w-[120px] truncate">{u.organization || u.department || '—'}</td>
                    <td className="py-2.5 text-center text-xs text-slate-600">数据录入</td>
                    <td className="py-2.5 text-center text-xs text-slate-500">{u.createdAt?.slice(0, 10) || '—'}</td>
                    <td className="py-2.5 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        onDuty ? 'bg-green-50 text-green-600' : 'bg-slate-100 text-slate-400'
                      }`}>
                        {onDuty ? '在岗' : '退出'}
                      </span>
                    </td>
                    <td className="py-2.5 text-center text-sm text-slate-700">{projectCount}</td>
                  </tr>
                ))}
                {entryStaff.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-sm text-slate-400">暂无录入人员账号</td>
                  </tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card className="bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-violet-600" /> 录入人员工作量
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={staffChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="负责患者" fill="#14b8a6" radius={[2, 2, 0, 0]} />
                <Bar dataKey="完成访视" fill="#8b5cf6" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
