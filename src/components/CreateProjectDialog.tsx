import { useState } from 'react'
import { useAppStorage } from '@/hooks/useAppStorage'
import type { Center, Project } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Trash2, Plus, Building2, Info } from 'lucide-react'

// 研究阶段（与项目概况四段式一致）→ 项目状态
const CREATE_STAGE_OPTIONS = ['立项', '伦理审核', '入组', '完成'] as const
type CreateStage = (typeof CREATE_STAGE_OPTIONS)[number]
const STAGE_TO_STATUS: Record<CreateStage, Project['status']> = {
  立项: 'proposal_review',
  伦理审核: 'ethics_review',
  入组: 'study_started',
  完成: 'study_closed',
}

function genId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

/**
 * 创建项目弹窗（管理端 & 录入端共用）。
 * 打开后填写基本信息 + 研究中心，创建的项目写入同一存储，各角色端立即可见。
 */
export default function CreateProjectDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated?: (project: Project) => void
}) {
  const { saveProject } = useAppStorage()
  const [newProject, setNewProject] = useState<Partial<Project>>({})
  const [createStage, setCreateStage] = useState<CreateStage>('立项')
  const [newCenters, setNewCenters] = useState<Partial<Center>[]>([])

  const resetForm = () => {
    setNewProject({})
    setCreateStage('立项')
    setNewCenters([])
  }

  const updateCenter = (idx: number, patch: Partial<Center>) => {
    setNewCenters((prev) => prev.map((c, i) => (i === idx ? { ...c, ...patch } : c)))
  }

  const handleCreate = () => {
    if (!newProject.name || !newProject.projectNo) return
    const centers: Center[] = newCenters
      .filter((c) => c.name?.trim())
      .map((c) => ({
        id: genId(),
        name: c.name!.trim(),
        department: c.department?.trim() || undefined,
        investigator: c.investigator?.trim() || undefined,
        position: c.position?.trim() || undefined,
        email: c.email?.trim() || undefined,
        phone: c.phone?.trim() || undefined,
      }))
    const project: Project = {
      id: genId(),
      projectNo: newProject.projectNo,
      name: newProject.name,
      principalInvestigator: newProject.principalInvestigator || '',
      researchCenter: newProject.researchCenter || '',
      department: newProject.department || '',
      status: STAGE_TO_STATUS[createStage],
      startDate: newProject.startDate,
      targetScreening: newProject.targetScreening,
      targetEnrollment: newProject.targetEnrollment,
      budget: newProject.budget || 0,
      centers: centers.length > 0 ? centers : undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      visits: [],
      crfModules: [],
    }
    saveProject(project)
    resetForm()
    onOpenChange(false)
    onCreated?.(project)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v)
        if (!v) resetForm()
      }}
    >
      <DialogContent className="sm:max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>创建新项目</DialogTitle>
        </DialogHeader>
        <div className="space-y-5 py-2">
          {/* ============ 基本信息 ============ */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Info className="w-4 h-4 text-sky-500" />
              <h3 className="text-sm font-semibold text-slate-800">基本信息</h3>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm">研究标题 <span className="text-red-500">*</span></Label>
                  <Input
                    placeholder="研究标题"
                    value={newProject.name || ''}
                    onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-sm">研究编号 <span className="text-red-500">*</span></Label>
                  <Input
                    placeholder="如：ON101CLCT01"
                    value={newProject.projectNo || ''}
                    onChange={(e) => setNewProject({ ...newProject, projectNo: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm">立项日期</Label>
                  <Input
                    type="date"
                    value={newProject.startDate || ''}
                    onChange={(e) => setNewProject({ ...newProject, startDate: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-sm">预算金额</Label>
                  <Input
                    inputMode="numeric"
                    placeholder="如：500000"
                    value={newProject.budget || ''}
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, '')
                      setNewProject({ ...newProject, budget: v ? Number(v) : undefined })
                    }}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm">研究阶段</Label>
                  <select
                    className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
                    value={createStage}
                    onChange={(e) => setCreateStage(e.target.value as CreateStage)}
                  >
                    {CREATE_STAGE_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label className="text-sm">主持单位</Label>
                  <Input
                    placeholder="如：上海瑞金医院"
                    value={newProject.researchCenter || ''}
                    onChange={(e) => setNewProject({ ...newProject, researchCenter: e.target.value })}
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
                  <Label className="text-sm">研究科室</Label>
                  <Input
                    placeholder="如：内分泌科"
                    value={newProject.department || ''}
                    onChange={(e) => setNewProject({ ...newProject, department: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm">目标筛选例数</Label>
                  <Input
                    inputMode="numeric"
                    placeholder="如：150"
                    value={newProject.targetScreening || ''}
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, '')
                      setNewProject({ ...newProject, targetScreening: v ? Number(v) : undefined })
                    }}
                  />
                </div>
                <div>
                  <Label className="text-sm">目标入组例数</Label>
                  <Input
                    inputMode="numeric"
                    placeholder="如：100"
                    value={newProject.targetEnrollment || ''}
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, '')
                      setNewProject({ ...newProject, targetEnrollment: v ? Number(v) : undefined })
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* ============ 研究中心 ============ */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-teal-500" />
                <h3 className="text-sm font-semibold text-slate-800">研究中心</h3>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-sky-600 border-sky-200 hover:bg-sky-50"
                onClick={() => setNewCenters((prev) => [...prev, {}])}
              >
                <Plus className="w-3.5 h-3.5 mr-1" /> 新增研究中心
              </Button>
            </div>
            <div className="rounded-lg border border-slate-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-center px-2 py-2.5 font-medium text-slate-500 text-xs w-10">序号</th>
                    <th className="text-left px-2 py-2.5 font-medium text-slate-500 text-xs">研究中心</th>
                    <th className="text-left px-2 py-2.5 font-medium text-slate-500 text-xs">研究科室</th>
                    <th className="text-left px-2 py-2.5 font-medium text-slate-500 text-xs">主持人</th>
                    <th className="text-left px-2 py-2.5 font-medium text-slate-500 text-xs">职位</th>
                    <th className="text-left px-2 py-2.5 font-medium text-slate-500 text-xs">邮箱</th>
                    <th className="text-left px-2 py-2.5 font-medium text-slate-500 text-xs">联系方式</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {newCenters.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-8 text-xs text-slate-400">
                        暂无研究中心，点击右上角「新增研究中心」添加
                      </td>
                    </tr>
                  ) : (
                    newCenters.map((c, idx) => (
                      <tr key={idx} className="border-b border-slate-100 last:border-0">
                        <td className="text-center px-2 py-1.5 text-xs text-slate-400">{idx + 1}</td>
                        {(
                          [
                            ['name', '医院/中心名称'],
                            ['department', '科室'],
                            ['investigator', '姓名'],
                            ['position', '职位'],
                            ['email', '邮箱'],
                            ['phone', '电话'],
                          ] as const
                        ).map(([key, ph]) => (
                          <td key={key} className="px-1.5 py-1.5">
                            <Input
                              className="h-8 text-xs"
                              placeholder={ph}
                              value={(c[key] as string) || ''}
                              onChange={(e) => updateCenter(idx, { [key]: e.target.value })}
                            />
                          </td>
                        ))}
                        <td className="px-1 text-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="w-7 h-7 text-slate-300 hover:text-red-500"
                            onClick={() => setNewCenters((prev) => prev.filter((_, i) => i !== idx))}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false)
              resetForm()
            }}
          >
            取消
          </Button>
          <Button
            className="bg-blue-500 hover:bg-blue-600"
            onClick={handleCreate}
            disabled={!newProject.name || !newProject.projectNo}
          >
            创建
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
