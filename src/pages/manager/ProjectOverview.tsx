import { useState, Fragment } from 'react'
import { useParams } from 'react-router'
import { useAppStorage } from '@/hooks/useAppStorage'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { Building2, Plus, Check, Pencil, Trash2, Info, TrendingUp } from 'lucide-react'
import type { Center, ProjectStatus } from '@/types'

function genId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

// 研究阶段四段式：立项 → 伦理审核 → 入组 → 完成
const STAGE_FLOW = ['立项', '伦理审核', '入组', '完成'] as const
type StageName = (typeof STAGE_FLOW)[number]
function stageIndex(status: ProjectStatus): number {
  if (status === 'study_closed' || status === 'completed') return 3
  if (status === 'study_started' || status === 'active') return 2
  if (status === 'ethics_review') return 1
  return 0
}
// 阶段 → 项目状态（基本信息编辑提交时同步）
const STAGE_TO_STATUS: Record<StageName, ProjectStatus> = {
  立项: 'proposal_review',
  伦理审核: 'ethics_review',
  入组: 'study_started',
  完成: 'study_closed',
}

export default function ProjectOverview({ readOnly = false }: { readOnly?: boolean }) {
  const { projectId } = useParams<{ projectId: string }>()
  const { projects, patients, saveProject } = useAppStorage()
  const [showAddCenter, setShowAddCenter] = useState(false)
  const [editingCenterId, setEditingCenterId] = useState<string | null>(null)
  const [newCenter, setNewCenter] = useState<Partial<Center>>({})
  // 基本信息编辑模式
  const [editingInfo, setEditingInfo] = useState(false)
  const [infoForm, setInfoForm] = useState({
    startDate: '',
    budget: '',
    stage: '立项' as StageName,
    researchCenter: '',
    principalInvestigator: '',
    department: '',
    targetScreening: '',
    targetEnrollment: '',
  })

  const project = projects.find((p) => p.id === projectId)
  if (!project) return <div>项目不存在</div>

  const projectPatients = patients.filter((p) => p.projectId === project.id)
  const enrolled = projectPatients.filter((p) => p.status !== 'screening').length
  const target = project.targetEnrollment || 100
  const pct = target > 0 ? Math.min(100, Math.round((enrolled / target) * 100)) : 0
  const centers = project.centers ?? []
  const currentStage = stageIndex(project.status)

  const progressData = [
    { name: '已入组', value: enrolled, color: '#14b8a6' },
    { name: '待入组', value: Math.max(0, target - enrolled), color: '#e2e8f0' },
  ]

  const openAddCenter = () => {
    setEditingCenterId(null)
    setNewCenter({})
    setShowAddCenter(true)
  }

  const openEditCenter = (c: Center) => {
    setEditingCenterId(c.id)
    setNewCenter({ ...c })
    setShowAddCenter(true)
  }

  const handleDeleteCenter = (c: Center) => {
    if (!window.confirm(`确定删除研究中心「${c.name}」？已登记患者的中心归属不受影响。`)) return
    saveProject({
      ...project,
      centers: centers.filter((x) => x.id !== c.id),
      updatedAt: new Date().toISOString(),
    })
  }

  const handleSaveCenter = () => {
    if (!newCenter.name) return
    if (editingCenterId) {
      // 编辑：保留原 id 更新字段
      saveProject({
        ...project,
        centers: centers.map((x) =>
          x.id === editingCenterId
            ? {
                ...x,
                name: newCenter.name!,
                department: newCenter.department || '',
                investigator: newCenter.investigator || '',
                position: newCenter.position || '',
                email: newCenter.email || '',
                phone: newCenter.phone || '',
              }
            : x
        ),
        updatedAt: new Date().toISOString(),
      })
    } else {
      const center: Center = {
        id: genId(),
        name: newCenter.name,
        department: newCenter.department || '',
        investigator: newCenter.investigator || '',
        position: newCenter.position || '',
        email: newCenter.email || '',
        phone: newCenter.phone || '',
      }
      saveProject({ ...project, centers: [...centers, center], updatedAt: new Date().toISOString() })
    }
    setShowAddCenter(false)
    setEditingCenterId(null)
    setNewCenter({})
  }

  // 信息表格单元格
  const InfoCell = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div className="grid grid-cols-[110px_1fr] border-b border-slate-100">
      <div className="py-3 px-4 text-sm text-slate-500 bg-slate-50/60 border-r border-slate-100">{label}</div>
      <div className="py-3 px-4 text-sm font-medium text-slate-800">{value || '—'}</div>
    </div>
  )

  // 编辑态单元格
  const EditCell = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="grid grid-cols-[110px_1fr] border-b border-slate-100">
      <div className="py-2 px-4 text-sm text-slate-500 bg-slate-50/60 border-r border-slate-100 flex items-center">{label}</div>
      <div className="py-2 px-3">{children}</div>
    </div>
  )

  // 进入编辑：用当前项目数据填充表单
  const startEditInfo = () => {
    setInfoForm({
      startDate: project.startDate?.slice(0, 10) ?? '',
      budget: project.budget != null ? String(project.budget) : '',
      stage: STAGE_FLOW[currentStage],
      researchCenter: project.researchCenter ?? '',
      principalInvestigator: project.principalInvestigator ?? '',
      department: project.department ?? '',
      targetScreening: project.targetScreening != null ? String(project.targetScreening) : '',
      targetEnrollment: project.targetEnrollment != null ? String(project.targetEnrollment) : '',
    })
    setEditingInfo(true)
  }

  // 提交基本信息更新
  const submitInfo = () => {
    saveProject({
      ...project,
      startDate: infoForm.startDate || undefined,
      budget: infoForm.budget ? Number(infoForm.budget) : undefined,
      status: STAGE_TO_STATUS[infoForm.stage],
      researchCenter: infoForm.researchCenter.trim(),
      principalInvestigator: infoForm.principalInvestigator.trim(),
      department: infoForm.department.trim(),
      targetScreening: infoForm.targetScreening ? Number(infoForm.targetScreening) : undefined,
      targetEnrollment: infoForm.targetEnrollment ? Number(infoForm.targetEnrollment) : undefined,
      updatedAt: new Date().toISOString(),
    })
    setEditingInfo(false)
  }

  return (
    <div className="space-y-5">
      {/* 信息条：主要研究者 | 研究科室 | 中心数量 | 研究阶段 */}
      <Card className="bg-white">
        <CardContent className="p-0 grid grid-cols-4 divide-x divide-slate-100">
          <div className="py-4 px-5 text-center">
            <p className="text-xs text-slate-400 mb-1">主要研究者</p>
            <p className="text-sm font-semibold text-slate-800">{project.principalInvestigator || '—'}</p>
          </div>
          <div className="py-4 px-5 text-center">
            <p className="text-xs text-slate-400 mb-1">研究科室</p>
            <p className="text-sm font-semibold text-slate-800">{project.department || '—'}</p>
          </div>
          <div className="py-4 px-5 text-center">
            <p className="text-xs text-slate-400 mb-1">中心数量</p>
            <p className="text-sm font-semibold text-slate-800">{centers.length || 1} 家</p>
          </div>
          <div className="py-4 px-5 text-center">
            <p className="text-xs text-slate-400 mb-1">研究阶段</p>
            <p className="inline-flex items-center gap-1 text-sm font-semibold text-teal-600">
              <Check className="w-4 h-4" />
              {STAGE_FLOW[currentStage]}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* 研究阶段四段式进度条：立项 → 伦理审核 → 入组 → 完成 */}
      <Card className="bg-white">
        <CardContent className="py-5 px-6 sm:px-10">
          <div className="flex items-start">
            {STAGE_FLOW.map((s, i) => {
              const done = i < currentStage
              const current = i === currentStage
              return (
                <Fragment key={s}>
                  <div className="flex flex-col items-center gap-1.5 min-w-[76px]">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                        done
                          ? 'bg-teal-500 text-white'
                          : current
                            ? 'bg-teal-600 text-white ring-4 ring-teal-100'
                            : 'bg-slate-100 text-slate-400 border border-slate-200'
                      }`}
                    >
                      {done ? <Check className="w-4 h-4" /> : i + 1}
                    </div>
                    <span
                      className={`text-xs whitespace-nowrap ${
                        current ? 'font-semibold text-teal-600' : done ? 'text-slate-600' : 'text-slate-400'
                      }`}
                    >
                      {s}
                    </span>
                    {current && (
                      <span className="text-[10px] text-teal-500 bg-teal-50 border border-teal-100 rounded-full px-2 py-px -mt-0.5">
                        当前阶段
                      </span>
                    )}
                  </div>
                  {i < STAGE_FLOW.length - 1 && (
                    <div className="flex-1 px-2 pt-4">
                      <div className={`h-0.5 rounded-full ${i < currentStage ? 'bg-teal-400' : 'bg-slate-200'}`} />
                    </div>
                  )}
                </Fragment>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* 左：信息表格 右：入组进度图示（各自高度自适应，避免下方留白） */}
      <div className="grid grid-cols-2 gap-5 items-start">
        <Card className="bg-white">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-semibold flex items-center gap-2"><Info className="w-4 h-4 text-sky-500" />基本信息</CardTitle>
            {editingInfo ? (
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setEditingInfo(false)}>
                  取消
                </Button>
                <Button size="sm" className="h-8 bg-teal-600 hover:bg-teal-700 text-xs" onClick={submitInfo}>
                  提交
                </Button>
              </div>
            ) : (
              !readOnly && (
                <Button size="sm" variant="outline" className="h-8 text-xs" onClick={startEditInfo}>
                  <Pencil className="w-3.5 h-3.5 mr-1" /> 更新
                </Button>
              )
            )}
          </CardHeader>
          <CardContent className="p-0 border-t border-slate-100">
            {editingInfo ? (
              <div className="grid grid-cols-2">
                <EditCell label="立项日期">
                  <Input
                    type="date"
                    className="h-8 text-sm"
                    value={infoForm.startDate}
                    onChange={(e) => setInfoForm({ ...infoForm, startDate: e.target.value })}
                  />
                </EditCell>
                <EditCell label="预算金额">
                  <Input
                    inputMode="numeric"
                    className="h-8 text-sm"
                    placeholder="元"
                    value={infoForm.budget}
                    onChange={(e) => setInfoForm({ ...infoForm, budget: e.target.value.replace(/\D/g, '') })}
                  />
                </EditCell>
                <EditCell label="研究阶段">
                  <Select
                    value={infoForm.stage}
                    onValueChange={(v) => setInfoForm({ ...infoForm, stage: v as StageName })}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STAGE_FLOW.map((s) => (
                        <SelectItem key={s} value={s} className="text-sm">{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </EditCell>
                <EditCell label="主持单位">
                  <Input
                    className="h-8 text-sm"
                    placeholder="牵头单位"
                    value={infoForm.researchCenter}
                    onChange={(e) => setInfoForm({ ...infoForm, researchCenter: e.target.value })}
                  />
                </EditCell>
                <EditCell label="主要研究者">
                  <Input
                    className="h-8 text-sm"
                    value={infoForm.principalInvestigator}
                    onChange={(e) => setInfoForm({ ...infoForm, principalInvestigator: e.target.value })}
                  />
                </EditCell>
                <EditCell label="研究科室">
                  <Input
                    className="h-8 text-sm"
                    value={infoForm.department}
                    onChange={(e) => setInfoForm({ ...infoForm, department: e.target.value })}
                  />
                </EditCell>
                <EditCell label="目标筛选例数">
                  <Input
                    inputMode="numeric"
                    placeholder="如：150"
                    className="h-8 text-sm"
                    value={infoForm.targetScreening}
                    onChange={(e) => setInfoForm({ ...infoForm, targetScreening: e.target.value.replace(/\D/g, '') })}
                  />
                </EditCell>
                <EditCell label="目标入组例数">
                  <Input
                    inputMode="numeric"
                    placeholder="如：100"
                    className="h-8 text-sm"
                    value={infoForm.targetEnrollment}
                    onChange={(e) => setInfoForm({ ...infoForm, targetEnrollment: e.target.value.replace(/\D/g, '') })}
                  />
                </EditCell>
              </div>
            ) : (
              <div className="grid grid-cols-2">
                <InfoCell label="立项日期" value={project.startDate?.slice(0, 10)} />
                <InfoCell label="预算金额" value={project.budget ? `${project.budget.toLocaleString()} 元` : '—'} />
                <InfoCell label="研究阶段" value={STAGE_FLOW[currentStage]} />
                <InfoCell label="主持单位" value={project.researchCenter} />
                <InfoCell label="主要研究者" value={project.principalInvestigator} />
                <InfoCell label="研究科室" value={project.department} />
                <InfoCell label="目标筛选例数" value={project.targetScreening != null ? `${project.targetScreening} 例` : '—'} />
                <InfoCell label="目标入组例数" value={`${target} 例`} />
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2"><TrendingUp className="w-4 h-4 text-sky-500" />入组进度图示</CardTitle>
          </CardHeader>
          <CardContent className="relative">
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={progressData}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={100}
                  startAngle={90}
                  endAngle={-270}
                  dataKey="value"
                  stroke="none"
                >
                  {progressData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-xl font-bold text-teal-600">{pct}%</span>
              <span className="text-xs text-slate-400 mt-1">{enrolled}/{target} 例</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 研究中心 */}
      <Card className="bg-white">
        <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Building2 className="w-4 h-4 text-teal-600" /> 研究中心
          </CardTitle>
          {!readOnly && (
            <Button
              size="sm"
              className="h-8 bg-teal-600 hover:bg-teal-700 text-xs"
              onClick={openAddCenter}
            >
              <Plus className="w-3.5 h-3.5 mr-1" /> 新增研究中心
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50/60 border-y border-slate-100">
                {['序号', '研究中心', '研究科室', '主持人', '职位', '邮箱', '联系方式', ...(readOnly ? [] : ['操作'])].map((h) => (
                  <th key={h} className="py-2.5 px-3 text-center text-xs font-medium text-slate-500 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {centers.map((c, i) => (
                <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50/40">
                  <td className="py-2.5 px-3 text-center text-sm text-slate-500">{i + 1}</td>
                  <td className="py-2.5 px-3 text-center text-sm font-medium text-slate-800">{c.name}</td>
                  <td className="py-2.5 px-3 text-center text-sm text-slate-600">{c.department || '—'}</td>
                  <td className="py-2.5 px-3 text-center text-sm text-slate-600">{c.investigator || '—'}</td>
                  <td className="py-2.5 px-3 text-center text-sm text-slate-600">{c.position || '—'}</td>
                  <td className="py-2.5 px-3 text-center text-sm text-slate-600">{c.email || '—'}</td>
                  <td className="py-2.5 px-3 text-center text-sm text-slate-600">{c.phone || '—'}</td>
                  {!readOnly && (
                    <td className="py-2.5 px-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="ghost" size="icon"
                          className="w-7 h-7 text-slate-400 hover:text-teal-600"
                          title="编辑中心"
                          onClick={() => openEditCenter(c)}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost" size="icon"
                          className="w-7 h-7 text-slate-400 hover:text-red-500"
                          title="删除中心"
                          onClick={() => handleDeleteCenter(c)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {centers.length === 0 && (
                <tr>
                  <td colSpan={readOnly ? 7 : 8} className="py-10 text-center text-sm text-slate-400">
                    {readOnly ? '暂无研究中心' : '暂无研究中心，点击右上角「新增研究中心」添加'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* 新增/编辑研究中心弹窗 */}
      <Dialog open={showAddCenter} onOpenChange={setShowAddCenter}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingCenterId ? '编辑研究中心' : '新增研究中心'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label className="text-sm">研究中心 <span className="text-red-500">*</span></Label>
                <Input
                  placeholder="医院/中心名称"
                  value={newCenter.name || ''}
                  onChange={(e) => setNewCenter({ ...newCenter, name: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-sm">研究科室</Label>
                <Input
                  placeholder="如：内分泌科"
                  value={newCenter.department || ''}
                  onChange={(e) => setNewCenter({ ...newCenter, department: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-sm">主持人</Label>
                <Input
                  placeholder="主持人姓名"
                  value={newCenter.investigator || ''}
                  onChange={(e) => setNewCenter({ ...newCenter, investigator: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-sm">职位</Label>
                <Input
                  placeholder="如：主任医师"
                  value={newCenter.position || ''}
                  onChange={(e) => setNewCenter({ ...newCenter, position: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-sm">联系方式</Label>
                <Input
                  placeholder="手机/电话"
                  value={newCenter.phone || ''}
                  onChange={(e) => setNewCenter({ ...newCenter, phone: e.target.value })}
                />
              </div>
              <div className="col-span-2">
                <Label className="text-sm">邮箱</Label>
                <Input
                  placeholder="邮箱地址"
                  value={newCenter.email || ''}
                  onChange={(e) => setNewCenter({ ...newCenter, email: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddCenter(false)}>取消</Button>
            <Button
              className="bg-teal-600 hover:bg-teal-700"
              onClick={handleSaveCenter}
              disabled={!newCenter.name}
            >
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
