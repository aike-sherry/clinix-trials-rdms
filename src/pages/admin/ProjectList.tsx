import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useAppStorage } from '@/hooks/useAppStorage'
import type { Project } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Search, Plus, FileText, FlaskConical, Users, Database, BarChart3, Trash2 } from 'lucide-react'

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending: { label: '立项', color: 'bg-amber-50 text-amber-600 border-amber-200' },
  active: { label: '进行中', color: 'bg-teal-50 text-teal-600 border-teal-200' },
  completed: { label: '已完成', color: 'bg-blue-50 text-blue-600 border-blue-200' },
  suspended: { label: '已暂停', color: 'bg-red-50 text-red-600 border-red-200' },
}

function genId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export default function ProjectList() {
  const { projects, patients, saveProject, deleteProject } = useAppStorage()
  const [searchParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [newProject, setNewProject] = useState<Partial<Project>>({
    status: 'pending',
  })

  useEffect(() => {
    if (searchParams.get('create') === '1') {
      setShowCreate(true)
    }
  }, [searchParams])

  const filtered = projects.filter(
    (p) =>
      p.name.includes(search) ||
      p.projectNo.includes(search) ||
      p.principalInvestigator.includes(search)
  )

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
      status: (newProject.status as Project['status']) || 'pending',
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
    setNewProject({ status: 'pending' })
  }

  return (
    <div className="space-y-5">
      {/* 标题栏 */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-800">项目管理</h1>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="搜索项目编号/名称/研究者"
              className="pl-9 w-72"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button className="bg-teal-500 hover:bg-teal-600" onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4 mr-1" /> 创建项目
          </Button>
        </div>
      </div>

      {/* 项目列表 */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-lg border border-dashed border-slate-300">
          <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">暂无项目，点击上方按钮创建</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((project) => {
            const projectPatients = patients.filter((p) => p.projectId === project.id)
            const screened = projectPatients.length
            const enrolled = projectPatients.filter((p) => p.status !== 'screening').length
            const statusInfo = STATUS_MAP[project.status] || STATUS_MAP.pending

            return (
              <Card key={project.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                  {/* 项目头部 */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center">
                        <FlaskConical className="w-5 h-5 text-teal-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-800">{project.name}</h3>
                        <p className="text-xs text-slate-400">{project.projectNo}</p>
                      </div>
                    </div>
                    <Badge variant="outline" className={statusInfo.color}>
                      {statusInfo.label}
                    </Badge>
                  </div>

                  {/* 统计信息 */}
                  <div className="grid grid-cols-4 gap-4 mb-4 text-sm">
                    <div>
                      <span className="text-slate-400">主要研究者</span>
                      <p className="font-medium text-slate-700">{project.principalInvestigator || '-'}</p>
                    </div>
                    <div>
                      <span className="text-slate-400">研究中心</span>
                      <p className="font-medium text-slate-700">{project.researchCenter || '-'}</p>
                    </div>
                    <div>
                      <span className="text-slate-400">筛选例数</span>
                      <p className="font-medium text-slate-700">{screened}</p>
                    </div>
                    <div>
                      <span className="text-slate-400">入组例数</span>
                      <p className="font-medium text-slate-700">{enrolled}</p>
                    </div>
                  </div>

                  {/* 子导航 */}
                  <div className="flex items-center gap-1 pt-3 border-t border-slate-100">
                    <Button variant="ghost" size="sm" asChild className="text-slate-500 hover:text-teal-600">
                      <Link to={`/projects/${project.id}/overview`}>
                        <FileText className="w-3.5 h-3.5 mr-1" /> 项目概况
                      </Link>
                    </Button>
                    <Button variant="ghost" size="sm" asChild className="text-slate-500 hover:text-teal-600">
                      <Link to={`/projects/${project.id}/crf`}>
                        <FlaskConical className="w-3.5 h-3.5 mr-1" /> CRF配制
                      </Link>
                    </Button>
                    <Button variant="ghost" size="sm" asChild className="text-slate-500 hover:text-teal-600">
                      <Link to={`/projects/${project.id}/patients`}>
                        <Users className="w-3.5 h-3.5 mr-1" /> 患者管理
                      </Link>
                    </Button>
                    <Button variant="ghost" size="sm" asChild className="text-slate-500 hover:text-teal-600">
                      <Link to={`/projects/${project.id}/data`}>
                        <Database className="w-3.5 h-3.5 mr-1" /> 数据管理
                      </Link>
                    </Button>
                    <Button variant="ghost" size="sm" asChild className="text-slate-500 hover:text-teal-600">
                      <Link to={`/projects/${project.id}/stats`}>
                        <BarChart3 className="w-3.5 h-3.5 mr-1" /> 统计分析
                      </Link>
                    </Button>
                    <div className="flex-1" />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-400 hover:text-red-600"
                      onClick={() => deleteProject(project.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* 创建项目弹窗 */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>创建新项目</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm">项目编号 <span className="text-red-500">*</span></Label>
                <Input
                  placeholder="如：ON101CLCT01"
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
                <Label className="text-sm">目标入组数</Label>
                <Input
                  type="number"
                  placeholder="100"
                  value={newProject.targetEnrollment || ''}
                  onChange={(e) => setNewProject({ ...newProject, targetEnrollment: Number(e.target.value) })}
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
              className="bg-teal-500 hover:bg-teal-600"
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
