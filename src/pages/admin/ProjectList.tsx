import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useAppStorage } from '@/hooks/useAppStorage'
import StatCard from '@/components/StatCard'
import type { Project } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import {
  Search, Plus, FileText, FlaskConical, Package, UserCircle,
  Trash2, LayoutGrid, ClipboardCheck, FileSignature, ShieldCheck,
  Rocket, Archive, LayoutList
} from 'lucide-react'

const STATUS_MAP: Record<string, { label: string; color: string; textColor: string; bgColor: string }> = {
  proposal_review: { label: '立项审核', color: 'border-amber-200', textColor: 'text-amber-600', bgColor: 'bg-amber-50' },
  pending: { label: '立项审核', color: 'border-amber-200', textColor: 'text-amber-600', bgColor: 'bg-amber-50' },
  contract_signed: { label: '合同签署', color: 'border-purple-200', textColor: 'text-purple-600', bgColor: 'bg-purple-50' },
  ethics_review: { label: '伦理审核', color: 'border-green-200', textColor: 'text-green-600', bgColor: 'bg-green-50' },
  study_started: { label: '研究启动', color: 'border-cyan-200', textColor: 'text-cyan-600', bgColor: 'bg-cyan-50' },
  active: { label: '研究启动', color: 'border-cyan-200', textColor: 'text-cyan-600', bgColor: 'bg-cyan-50' },
  study_closed: { label: '研究关闭', color: 'border-gray-200', textColor: 'text-gray-600', bgColor: 'bg-gray-50' },
  completed: { label: '研究关闭', color: 'border-gray-200', textColor: 'text-gray-600', bgColor: 'bg-gray-50' },
  suspended: { label: '已暂停', color: 'border-red-200', textColor: 'text-red-600', bgColor: 'bg-red-50' },
}

const STAGE_OPTIONS = [
  { value: 'proposal_review', label: '立项审核' },
  { value: 'contract_signed', label: '合同签署' },
  { value: 'ethics_review', label: '伦理审核' },
  { value: 'study_started', label: '研究启动' },
  { value: 'study_closed', label: '研究关闭' },
  { value: 'suspended', label: '已暂停' },
]

const TAB_ITEMS = [
  { path: 'overview', label: '项目概况', icon: FileText },
  { path: 'modules', label: '模块管理', icon: Package },
  { path: 'crf', label: 'CRF配置', icon: FlaskConical },
  { path: 'account', label: '账号管理', icon: UserCircle },
]

function genId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export default function ProjectList() {
  const { projects, patients, saveProject, deleteProject } = useAppStorage()
  const [searchParams, setSearchParams] = useSearchParams()

  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [showCreate, setShowCreate] = useState(false)
  const [newProject, setNewProject] = useState<Partial<Project>>({
    status: 'proposal_review',
  })

  useEffect(() => {
    if (searchParams.get('create') === '1') {
      setShowCreate(true)
    }
  }, [searchParams])

  const filtered = projects.filter(
    (p) =>
      !search ||
      p.name.includes(search) ||
      p.projectNo.includes(search) ||
      p.principalInvestigator.includes(search)
  )

  // 顶部统计数据
  const totalCount = projects.length
  const proposalCount = projects.filter(
    (p) => p.status === 'proposal_review' || p.status === 'pending'
  ).length
  const contractCount = projects.filter((p) => p.status === 'contract_signed').length
  const ethicsCount = projects.filter((p) => p.status === 'ethics_review').length
  const startedCount = projects.filter(
    (p) => p.status === 'study_started' || p.status === 'active'
  ).length
  const closedCount = projects.filter(
    (p) => p.status === 'study_closed' || p.status === 'completed'
  ).length

  const handleCreate = () => {
    if (!newProject.name || !newProject.projectNo) return
    const project: Project = {
      id: genId(),
      projectNo: newProject.projectNo,
      name: newProject.name,
      sponsor: newProject.sponsor || '',
      principalInvestigator: newProject.principalInvestigator || '',
      researchCenter: newProject.researchCenter || '',
      department: newProject.department || '',
      status: (newProject.status as Project['status']) || 'proposal_review',
      deployEnv: newProject.deployEnv || 'public',
      startDate: newProject.startDate,
      endDate: newProject.endDate,
      targetEnrollment: newProject.targetEnrollment || 100,
      description: newProject.description,
      budget: newProject.budget || 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      visits: [],
      crfModules: [],
    }
    saveProject(project)
    setShowCreate(false)
    setNewProject({ status: 'proposal_review' })
    const newParams = new URLSearchParams(searchParams)
    newParams.delete('create')
    setSearchParams(newParams)
  }

  return (
    <div className="space-y-5">
      {/* 操作栏 */}
      <div className="flex items-center justify-end">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="搜索项目编号/名称/研究者"
              className="pl-9 w-72 bg-white"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button className="bg-sky-500 hover:bg-sky-600 text-white" onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4 mr-1" /> 创建项目
          </Button>
        </div>
      </div>

      {/* 顶部统计卡片（全站统一 StatCard） */}
      <div className="grid grid-cols-6 gap-4">
        <StatCard label="研究总数" value={totalCount} unit="项" sub={`启动 ${startedCount} 项`} icon={LayoutGrid} gradient="from-blue-500 to-blue-600" />
        <StatCard label="立项审核" value={proposalCount} unit="项" sub="待立项审批" icon={ClipboardCheck} gradient="from-amber-500 to-orange-500" />
        <StatCard label="合同签署" value={contractCount} unit="项" sub="合同已签署" icon={FileSignature} gradient="from-purple-500 to-violet-600" />
        <StatCard label="伦理审核" value={ethicsCount} unit="项" sub="伦理审查中" icon={ShieldCheck} gradient="from-emerald-500 to-green-600" />
        <StatCard label="研究启动" value={startedCount} unit="项" sub="正在入组实施" icon={Rocket} gradient="from-cyan-500 to-sky-600" />
        <StatCard label="研究关闭" value={closedCount} unit="项" sub="已完成关闭" icon={Archive} gradient="from-slate-500 to-slate-600" />
      </div>

      {/* 项目列表 */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-lg border border-dashed border-slate-300">
          <FlaskConical className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">暂无项目，点击上方按钮创建</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-400">共 {filtered.length} 个项目</p>
            {/* 视图切换 */}
            <div className="flex items-center border rounded-md overflow-hidden bg-white">
              <Button
                variant="ghost"
                size="icon"
                className={`h-8 w-8 rounded-none ${viewMode === 'grid' ? 'bg-blue-50 text-blue-600' : 'text-slate-400'}`}
                onClick={() => setViewMode('grid')}
              >
                <LayoutGrid className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={`h-8 w-8 rounded-none ${viewMode === 'list' ? 'bg-blue-50 text-blue-600' : 'text-slate-400'}`}
                onClick={() => setViewMode('list')}
              >
                <LayoutList className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <div className={viewMode === 'grid' ? 'grid grid-cols-2 gap-4' : 'space-y-4'}>
            {filtered.map((project) => {
              const projectPatients = patients.filter((p) => p.projectId === project.id)
              const enrolled = projectPatients.filter((p) => p.status !== 'screening').length
              const target = project.targetEnrollment || 100
              const progressPct = target > 0 ? Math.round((enrolled / target) * 100) : 0
              const statusInfo = STATUS_MAP[project.status] || STATUS_MAP.proposal_review

              return (
                <Card key={project.id} className="hover:shadow-md transition-shadow bg-white">
                  <CardContent className="p-5">
                    {/* 项目头部 */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center flex-shrink-0">
                          <FlaskConical className="w-5 h-5 text-teal-600" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-400 font-mono">{project.projectNo}</span>
                          </div>
                          <h3 className="font-semibold text-slate-800 truncate text-sm">{project.name}</h3>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Badge variant="outline" className={`${statusInfo.bgColor} ${statusInfo.textColor} ${statusInfo.color} text-xs`}>
                          {statusInfo.label}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="w-7 h-7 text-slate-300 hover:text-red-500"
                          onClick={() => deleteProject(project.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>

                    {/* 统计信息 */}
                    <div className="grid grid-cols-4 gap-3 mb-4 text-sm">
                      <div className="text-center">
                        <p className="text-xs text-slate-400">主要研究者</p>
                        <p className="font-medium text-slate-700 truncate">{project.principalInvestigator || '-'}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-slate-400">研究科室</p>
                        <p className="font-medium text-slate-700 truncate">{project.department || '-'}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-slate-400">申办方</p>
                        <p className="font-medium text-slate-700 truncate">{project.sponsor || '-'}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-slate-400">临床监查员</p>
                        <p className="font-medium text-slate-700 truncate">{'-'}</p>
                      </div>
                    </div>

                    {/* 入组进度 */}
                    <div className="mb-4">
                      <div className="flex items-center justify-between text-sm mb-1.5">
                        <span className="text-slate-500">入组进度 <span className="font-medium text-slate-700">{enrolled}/{target} 例</span></span>
                        <span className="text-blue-500 font-medium">{progressPct}%</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-400 rounded-full transition-all"
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                    </div>

                    {/* 子导航 - 横向排列 */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-3 border-t border-slate-100">
                      {TAB_ITEMS.map((tab) => {
                        const Icon = tab.icon
                        return (
                          <Button
                            key={tab.path}
                            variant="ghost"
                            size="sm"
                            asChild
                            className="text-slate-500 hover:text-teal-600 h-7 px-1 text-xs"
                          >
                            <Link to={`/admin/projects/${project.id}/${tab.path}`}>
                              <Icon className="w-3.5 h-3.5 mr-1" /> {tab.label}
                            </Link>
                          </Button>
                        )
                      })}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {/* 创建项目弹窗 */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>创建新项目</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm">项目编号 <span className="text-red-500">*</span></Label>
                <Input
                  placeholder="如：CN101CLCT01"
                  value={newProject.projectNo || ''}
                  onChange={(e) => setNewProject({ ...newProject, projectNo: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-sm">项目名称 <span className="text-red-500">*</span></Label>
                <Input
                  placeholder="项目名称"
                  value={newProject.name || ''}
                  onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm">主要研究者</Label>
                <Input
                  placeholder="研究者姓名"
                  value={newProject.principalInvestigator || ''}
                  onChange={(e) => setNewProject({ ...newProject, principalInvestigator: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-sm">研究中心</Label>
                <Input
                  placeholder="医院/中心名称"
                  value={newProject.researchCenter || ''}
                  onChange={(e) => setNewProject({ ...newProject, researchCenter: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm">研究科室</Label>
                <Input
                  placeholder="如：烧伤整形科"
                  value={newProject.department || ''}
                  onChange={(e) => setNewProject({ ...newProject, department: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-sm">研究阶段</Label>
                <select
                  className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
                  value={newProject.status || 'proposal_review'}
                  onChange={(e) => setNewProject({ ...newProject, status: e.target.value as Project['status'] })}
                >
                  {STAGE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <Label className="text-sm">部署环境 <span className="text-red-500">*</span></Label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => setNewProject({ ...newProject, deployEnv: 'public' })}
                  className={`h-9 rounded-md border text-xs font-medium transition-colors ${
                    (newProject.deployEnv || 'public') === 'public'
                      ? 'bg-sky-50 border-sky-300 text-sky-700'
                      : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                  }`}
                >
                  公网部署（多中心研究，云端生效）
                </button>
                <button
                  type="button"
                  onClick={() => setNewProject({ ...newProject, deployEnv: 'intranet' })}
                  className={`h-9 rounded-md border text-xs font-medium transition-colors ${
                    newProject.deployEnv === 'intranet'
                      ? 'bg-teal-50 border-teal-300 text-teal-700'
                      : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                  }`}
                >
                  内网部署（医院局域网，配置包交付）
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm">目标入组数</Label>
                <Input
                  inputMode="numeric"
                  placeholder="100"
                  value={newProject.targetEnrollment || ''}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, '')
                    setNewProject({ ...newProject, targetEnrollment: v ? Number(v) : undefined })
                  }}
                />
              </div>
              <div>
                <Label className="text-sm">申办方</Label>
                <Input
                  placeholder="如：海和药物"
                  value={newProject.sponsor || ''}
                  onChange={(e) => setNewProject({ ...newProject, sponsor: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm">开始日期</Label>
                <Input
                  type="date"
                  value={newProject.startDate || ''}
                  onChange={(e) => setNewProject({ ...newProject, startDate: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-sm">结束日期</Label>
                <Input
                  type="date"
                  value={newProject.endDate || ''}
                  onChange={(e) => setNewProject({ ...newProject, endDate: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label className="text-sm">项目描述</Label>
              <Input
                placeholder="项目简介..."
                value={newProject.description || ''}
                onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>取消</Button>
            <Button
              className="bg-sky-500 hover:bg-sky-600"
              onClick={handleCreate}
              disabled={!newProject.name || !newProject.projectNo}
            >
              创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
