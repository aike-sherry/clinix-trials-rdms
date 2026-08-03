import { useState, useMemo, useEffect } from 'react'
import { useParams } from 'react-router'
import { useAppStorage } from '@/hooks/useAppStorage'
import type { CRFField, CRFModule, Project, Visit, FieldType, ModuleLibraryItem } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import CRFFormRenderer from '@/components/CRFFormRenderer'
import {
  Plus, Trash2, Pencil, ChevronRight, ChevronLeft,
  Hash, Type, Calendar, ListChecks, ToggleLeft, AlignLeft, FileText,
  Package, Check, Lock, Unlock, Rocket, AlertCircle,
  Search, X, Layers, Settings2, GripVertical, FlaskConical, Eye, Table, SlidersHorizontal, ArrowLeftRight, Pen,
} from 'lucide-react'

// ==================== 常量 ====================
const FIELD_TYPE_ICONS: Record<FieldType, React.ReactNode> = {
  text: <Type className="w-3.5 h-3.5" />,
  textarea: <AlignLeft className="w-3.5 h-3.5" />,
  number: <Hash className="w-3.5 h-3.5" />,
  date: <Calendar className="w-3.5 h-3.5" />,
  datetime: <Calendar className="w-3.5 h-3.5" />,
  select: <ListChecks className="w-3.5 h-3.5" />,
  radio: <ListChecks className="w-3.5 h-3.5" />,
  checkbox: <ListChecks className="w-3.5 h-3.5" />,
  toggle: <ToggleLeft className="w-3.5 h-3.5" />,
  label: <FileText className="w-3.5 h-3.5" />,
  scale: <SlidersHorizontal className="w-3.5 h-3.5" />,
  numberRange: <ArrowLeftRight className="w-3.5 h-3.5" />,
  table: <Table className="w-3.5 h-3.5" />,
  signature: <Pen className="w-3.5 h-3.5" />,
}

const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: '单行文本', textarea: '多行文本', number: '数字', date: '日期',
  datetime: '日期时间', select: '下拉选择', radio: '单选', checkbox: '多选',
  toggle: '开关', label: '说明文本', table: '表格',
  scale: '量表评分', numberRange: '数值范围',
  signature: '电子签名',
}


function genId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

function now() {
  return new Date().toISOString()
}

// ==================== 模块图标组件 ====================
const AVAILABLE_ICONS = [
  'Layers', 'Heart', 'Activity', 'FileText', 'Stethoscope', 'Pill',
  'Syringe', 'Clipboard', 'FlaskConical', 'Microscope', 'Scan',
  'Thermometer', 'Weight', 'Ruler', 'Clock', 'Calendar', 'User',
  'Users', 'Baby', 'Brain', 'Bone', 'Eye', 'Ear', 'Dna',
]

function ModuleIcon({ name }: { name?: string }) {
  const iconMap: Record<string, React.ReactNode> = {
    Layers: <Layers className="w-5 h-5 text-teal-600" />,
    Heart: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-teal-600"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>,
    Activity: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-teal-600"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>,
    FileText: <FileText className="w-5 h-5 text-teal-600" />,
    Stethoscope: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-teal-600"><path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3"/><path d="M8 15v1a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6v-4"/><circle cx="20" cy="10" r="2"/></svg>,
    Pill: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-teal-600"><path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/><path d="m8.5 8.5 7 7"/></svg>,
    Syringe: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-teal-600"><path d="m18 2 4 4"/><path d="m17 7 3-3"/><path d="M19 9 8.7 19.3c-1 1-2.5 1-3.4 0l-.6-.6c-1-1-1-2.5 0-3.4L15 5"/><path d="m9 11 4 4"/><path d="m10 17-5 5"/><path d="m14 9 4 4"/></svg>,
    Clipboard: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-teal-600"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/></svg>,
    FlaskConical: <FlaskConical className="w-5 h-5 text-teal-600" />,
    Microscope: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-teal-600"><path d="M6 18h8"/><path d="M3 22h18"/><path d="M14 22a7 7 0 1 0 0-14h-1"/><path d="M9 14h2"/><path d="M9 12a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2Z"/><path d="M5 10a7 7 0 0 1 14 0"/></svg>,
    Scan: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-teal-600"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><rect width="10" height="6" x="7" y="9" rx="1"/></svg>,
    Thermometer: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-teal-600"><path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z"/></svg>,
    Weight: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-teal-600"><circle cx="12" cy="5" r="3"/><path d="M6.5 8a2 2 0 0 0-1.905 1.46L2.1 18.1A2 2 0 0 0 4 21h16a2 2 0 0 0 1.925-2.54L19.4 9.4A2 2 0 0 0 17.48 8Z"/></svg>,
    Ruler: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-teal-600"><path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.41 2.41 0 0 1 0-3.4l2.6-2.6a2.41 2.41 0 0 1 3.4 0Z"/><path d="m14.5 12.5 2-2"/><path d="m11.5 9.5 2-2"/><path d="m8.5 6.5 2-2"/><path d="m17.5 15.5 2-2"/></svg>,
    Clock: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-teal-600"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
    Calendar: <Calendar className="w-5 h-5 text-teal-600" />,
    User: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-teal-600"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
    Users: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-teal-600"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
    Baby: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-teal-600"><path d="M9 12h.01"/><path d="M15 12h.01"/><path d="M10 16c.5.3 1.2.5 2 .5s1.5-.2 2-.5"/><path d="M19 6.3a9 9 0 0 1 1.8 3.9 2 2 0 0 1 0 3.6 9 9 0 0 1-17.6 0 2 2 0 0 1 0-3.6A9 9 0 0 1 12 3c2 0 3 1 3 1"/><path d="M12 3v6"/></svg>,
    Brain: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-teal-600"><path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/><path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/><path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4"/><path d="M17.599 6.5a3 3 0 0 0 .399-1.375"/><path d="M6.003 5.125A3 3 0 0 0 6.401 6.5"/><path d="M3.477 10.896a4 4 0 0 1 .585-.396"/><path d="M19.938 10.5a4 4 0 0 1 .585.396"/><path d="M6 18a4 4 0 0 1-1.967-.516"/><path d="M19.967 17.484A4 4 0 0 1 18 18"/></svg>,
    Bone: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-teal-600"><path d="M17 10c.7-.7 1.69 0 2.5 0a2.5 2.5 0 1 0 0-5 .5.5 0 0 1-.5-.5 2.5 2.5 0 1 0-5 0c0 .81.7 1.8 0 2.5l-7 7c-.7.7-1.69 0-2.5 0a2.5 2.5 0 0 0 0 5c.28 0 .5.22.5.5a2.5 2.5 0 1 0 5 0c0-.81-.7-1.8 0-2.5Z"/></svg>,
    Eye: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-teal-600"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>,
    Ear: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-teal-600"><path d="M6 8.5a6.5 6.5 0 1 1 13 0c0 6-6 6-6 10"/><path d="M12 18.5v2"/><path d="M12 11.5a2.5 2.5 0 0 1 0-5 2.5 2.5 0 0 1 0 5Z"/></svg>,
    Dna: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-teal-600"><path d="m2 15 5.88-5.88a2.12 2.12 0 1 1 3 3L5 18"/><path d="m9.88 7.88 3 3a2.12 2.12 0 1 1-3 3L6.8 10.8"/><path d="m14 13 5.88-5.88a2.12 2.12 0 1 1 3 3L17 16"/><path d="m21 6-3 3"/></svg>,
  }

  return <>{iconMap[name || ''] || <Layers className="w-5 h-5 text-teal-600" />}</>
}

// ==================== 模块信息编辑弹窗 ====================
function ModuleInfoDialog({ open, onOpenChange, module, onSave }: {
  open: boolean; onOpenChange: (v: boolean) => void; module: CRFModule; onSave: (m: CRFModule) => void
}) {
  const [m, setM] = useState<CRFModule>(module)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>编辑模块信息</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label className="text-sm">模块名称</Label>
            <Input value={m.name} onChange={(e) => setM({ ...m, name: e.target.value })} />
          </div>
          <div>
            <Label className="text-sm">描述</Label>
            <Input value={m.description || ''} onChange={(e) => setM({ ...m, description: e.target.value })} />
          </div>
          <div>
            <Label className="text-sm mb-2 block">模块图标</Label>
            <div className="grid grid-cols-8 gap-2">
              {AVAILABLE_ICONS.map((iconName) => (
                <button
                  key={iconName}
                  onClick={() => setM({ ...m, icon: iconName })}
                  className={`w-10 h-10 rounded-lg flex items-center justify-center border transition-colors ${
                    m.icon === iconName ? 'border-teal-500 bg-teal-50' : 'border-slate-200 hover:border-teal-300 hover:bg-slate-50'
                  }`}
                  title={iconName}
                >
                  <ModuleIcon name={iconName} />
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between border rounded-md p-3">
            <div>
              <div className="text-sm font-medium">在录入页面显示图标</div>
              <div className="text-xs text-slate-400">开启后，数据录入人员可在录入页面看到此模块图标</div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" checked={m.showIcon !== false} onChange={(e) => setM({ ...m, showIcon: e.target.checked })} />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-teal-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-500" />
            </label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button className="bg-teal-500 hover:bg-teal-600" onClick={() => onSave(m)}>保存</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ==================== 主页面 ====================
export default function ProjectCRFView() {
  const { projectId } = useParams<{ projectId: string }>()
  const { projects, moduleLibrary, saveProject } = useAppStorage()
  const project = projects.find((p) => p.id === projectId)

  if (!project) return <div className="text-center py-20 text-slate-500">项目不存在</div>

  const isPublished = !!project.crfPublished

  const updateProject = (updater: (p: Project) => Project) => {
    const next = updater({ ...project })
    next.updatedAt = now()
    saveProject(next)
  }

  const handlePublish = () => {
    if (!confirm('发布 CRF 后将锁定编辑，数据录入人员可以开始使用。确定发布吗？')) return
    updateProject((p) => ({ ...p, crfPublished: true, crfPublishedAt: now() }))
  }

  const handleUnpublish = () => {
    if (!confirm('取消发布后将允许重新编辑 CRF，已录入的数据不会丢失。确定取消吗？')) return
    updateProject((p) => ({ ...p, crfPublished: false, crfPublishedAt: undefined }))
  }

  return (
    <div className="space-y-4">
      {/* 顶部状态栏 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold text-slate-700">CRF 配置</h3>
          {isPublished ? (
            <Badge variant="outline" className="bg-green-50 text-green-600 border-green-200 text-xs">
              <Lock className="w-3 h-3 mr-1" /> 已发布
            </Badge>
          ) : (
            <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200 text-xs">
              <AlertCircle className="w-3 h-3 mr-1" /> 未发布
            </Badge>
          )}
          {project.crfPublishedAt && (
            <span className="text-xs text-slate-400">
              发布于 {new Date(project.crfPublishedAt).toLocaleString('zh-CN')}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isPublished ? (
            <Button variant="outline" size="sm" onClick={handleUnpublish}>
              <Unlock className="w-3.5 h-3.5 mr-1" /> 取消发布
            </Button>
          ) : (
            <Button className="bg-teal-500 hover:bg-teal-600" size="sm" onClick={handlePublish} disabled={project.visits.length === 0}>
              <Rocket className="w-3.5 h-3.5 mr-1" /> 发布 CRF
            </Button>
          )}
        </div>
      </div>

      {isPublished && (
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-700 flex items-center gap-2">
          <Lock className="w-4 h-4" />
          CRF 已发布，当前处于只读模式。如需修改，请先取消发布。
        </div>
      )}

      <CRFConfigurator project={project} onUpdate={updateProject} moduleLibrary={moduleLibrary} readOnly={isPublished} />
    </div>
  )
}

// ==================== CRF 配置器（以访视为中心）====================
function CRFConfigurator({
  project,
  onUpdate,
  moduleLibrary,
  readOnly,
}: {
  project: Project
  onUpdate: (updater: (p: Project) => Project) => void
  moduleLibrary: ModuleLibraryItem[]
  readOnly: boolean
}) {
  const [activeVisitId, setActiveVisitId] = useState<string>(
    project.visits.length > 0 ? project.visits[0].id : ''
  )
  const [mode, setMode] = useState<'visit' | 'module' | 'preview'>('visit')
  const [editingModuleId, setEditingModuleId] = useState<string>('')
  const [previewingModuleId, setPreviewingModuleId] = useState<string>('')

  // 弹窗状态
  const [showAddModuleDialog, setShowAddModuleDialog] = useState(false)
  const [showVisitDialog, setShowVisitDialog] = useState(false)
  const [editingVisit, setEditingVisit] = useState<Visit | null>(null)
  const [showFieldDialog, setShowFieldDialog] = useState(false)
  const [editingField, setEditingField] = useState<CRFField | null>(null)
  const [showModuleInfoDialog, setShowModuleInfoDialog] = useState(false)
  const [editingModuleInfo, setEditingModuleInfo] = useState<CRFModule | null>(null)

  // 自动清理：移除访视中引用但已不存在的模块ID（修复旧数据损坏）
  useEffect(() => {
    const projectModuleIds = new Set(project.crfModules.map((m) => m.id))
    const hasGhostIds = project.visits.some((v) =>
      v.crfModuleIds.some((mid) => !projectModuleIds.has(mid))
    )
    if (hasGhostIds) {
      onUpdate((p) => ({
        ...p,
        visits: p.visits.map((v) => ({
          ...v,
          crfModuleIds: v.crfModuleIds.filter((mid) => projectModuleIds.has(mid)),
        })),
      }))
    }
  }, [project.crfModules.length, project.visits.length])

  const sortedVisits = useMemo(() => [...project.visits].sort((a, b) => a.order - b.order), [project.visits])

  // 关键修复：直接从 project.crfModules 查找，不通过 useMemo 中间层
  const activeVisit = sortedVisits.find((v) => v.id === activeVisitId)

  // ---------- 访视操作 ----------
  const addVisit = () => {
    if (readOnly) return
    const nextOrder = project.visits.length
    const v: Visit = {
      id: genId(), projectId: project.id,
      name: `V${nextOrder}-新访视`, code: `V${nextOrder}`,
      order: nextOrder, crfModuleIds: [],
    }
    onUpdate((p) => ({ ...p, visits: [...p.visits, v] }))
    setActiveVisitId(v.id)
    setMode('visit')
  }

  const saveVisit = (visit: Visit) => {
    onUpdate((p) => ({ ...p, visits: p.visits.map((v) => (v.id === visit.id ? visit : v)) }))
    setShowVisitDialog(false)
    setEditingVisit(null)
  }

  const deleteVisit = (id: string) => {
    if (readOnly) return
    if (!confirm('确定删除此访视？关联的模块数据不会丢失，但会从访视中移除。')) return
    onUpdate((p) => ({ ...p, visits: p.visits.filter((v) => v.id !== id) }))
    if (activeVisitId === id) {
      const remaining = project.visits.filter((v) => v.id !== id)
      setActiveVisitId(remaining.length > 0 ? remaining[0].id : '')
      setMode('visit')
    }
  }

  const moveVisit = (index: number, dir: number) => {
    if (readOnly) return
    const arr = [...sortedVisits]
    const ni = index + dir
    if (ni < 0 || ni >= arr.length) return
    ;[arr[index], arr[ni]] = [arr[ni], arr[index]]
    onUpdate((p) => ({ ...p, visits: arr.map((v, i) => ({ ...v, order: i })) }))
  }

  // ---------- 模块操作（关键修复：全部在 onUpdate 回调中完成）----------
  const addModulesToVisit = (moduleIds: string[]) => {
    if (readOnly) return
    onUpdate((p) => {
      const visit = p.visits.find((v) => v.id === activeVisitId)
      if (!visit) return p

      const newProjectModules: CRFModule[] = []
      moduleIds.forEach((mid) => {
        const exists = p.crfModules.find((m) => m.id === mid)
        if (!exists) {
          const libMod = moduleLibrary.find((m) => m.id === mid)
          if (libMod) {
            newProjectModules.push({
              id: libMod.id,
              projectId: p.id,
              name: libMod.name,
              description: libMod.description,
              fields: libMod.fields.map((f) => ({ ...f, id: genId() })),
              order: p.crfModules.length + newProjectModules.length,
            })
          }
        }
      })

      return {
        ...p,
        crfModules: [...p.crfModules, ...newProjectModules],
        visits: p.visits.map((v) =>
          v.id === activeVisitId
            ? { ...v, crfModuleIds: [...new Set([...v.crfModuleIds, ...moduleIds])] }
            : v
        ),
      }
    })
  }

  const removeModuleFromVisit = (moduleId: string) => {
    if (readOnly) return
    if (!confirm('确定从该访视中移除此模块？模块本身不会被删除。')) return
    onUpdate((p) => ({
      ...p,
      visits: p.visits.map((v) =>
        v.id === activeVisitId ? { ...v, crfModuleIds: v.crfModuleIds.filter((id) => id !== moduleId) } : v
      ),
    }))
  }

  const deleteProjectModule = (moduleId: string) => {
    if (readOnly) return
    if (!confirm('确定删除此模块？该模块将从所有访视中移除，且字段数据将丢失。')) return
    onUpdate((p) => ({
      ...p,
      crfModules: p.crfModules.filter((m) => m.id !== moduleId),
      visits: p.visits.map((v) => ({ ...v, crfModuleIds: v.crfModuleIds.filter((id) => id !== moduleId) })),
    }))
    if (editingModuleId === moduleId) {
      setMode('visit')
      setEditingModuleId('')
    }
    if (previewingModuleId === moduleId) {
      setMode('visit')
      setPreviewingModuleId('')
    }
  }

  const saveModuleInfo = (module: CRFModule) => {
    onUpdate((p) => ({
      ...p,
      crfModules: p.crfModules.map((m) => (m.id === module.id ? module : m)),
    }))
    setShowModuleInfoDialog(false)
    setEditingModuleInfo(null)
  }

  // ---------- 字段操作 ----------
  const openModuleEditor = (moduleId: string) => {
    setEditingModuleId(moduleId)
    setMode('module')
  }

  const openModulePreview = (moduleId: string) => {
    setPreviewingModuleId(moduleId)
    setMode('preview')
  }

  const backToVisit = () => {
    setMode('visit')
    setEditingModuleId('')
    setPreviewingModuleId('')
  }

  // 关键修复：直接从 project.crfModules 查找当前模块
  const activeModule = project.crfModules.find((m) => m.id === editingModuleId)
  const previewModule = project.crfModules.find((m) => m.id === previewingModuleId)

  const addField = (type: FieldType) => {
    if (readOnly || !activeModule) return
    const f: CRFField = {
      id: genId(), type,
      label: FIELD_TYPE_LABELS[type],
      name: `field_${type}_${Date.now()}`,
      order: activeModule.fields.length,
    }
    if (type === 'select' || type === 'radio' || type === 'checkbox') {
      f.options = [{ label: '选项1', value: 'opt1' }, { label: '选项2', value: 'opt2' }]
    }
    onUpdate((p) => ({
      ...p,
      crfModules: p.crfModules.map((m) =>
        m.id === activeModule.id ? { ...m, fields: [...m.fields, f] } : m
      ),
    }))
    setEditingField(f)
    setShowFieldDialog(true)
  }

  const saveField = (field: CRFField) => {
    if (!activeModule) return
    onUpdate((p) => ({
      ...p,
      crfModules: p.crfModules.map((m) =>
        m.id === activeModule.id ? { ...m, fields: m.fields.map((fld) => (fld.id === field.id ? field : fld)) } : m
      ),
    }))
    setShowFieldDialog(false)
    setEditingField(null)
  }

  const deleteField = (fieldId: string) => {
    if (readOnly || !activeModule) return
    if (!confirm('确定删除此字段？')) return
    onUpdate((p) => ({
      ...p,
      crfModules: p.crfModules.map((m) =>
        m.id === activeModule.id ? { ...m, fields: m.fields.filter((f) => f.id !== fieldId) } : m
      ),
    }))
  }

  const moveField = (index: number, dir: number) => {
    if (readOnly || !activeModule) return
    const arr = [...activeModule.fields].sort((a, b) => a.order - b.order)
    const ni = index + dir
    if (ni < 0 || ni >= arr.length) return
    ;[arr[index], arr[ni]] = [arr[ni], arr[index]]
    onUpdate((p) => ({
      ...p,
      crfModules: p.crfModules.map((m) =>
        m.id === activeModule.id ? { ...m, fields: arr.map((f, i) => ({ ...f, order: i })) } : m
      ),
    }))
  }

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden flex" style={{ minHeight: 'calc(100vh - 360px)' }}>
      {/* ========== 左侧：访视列表 ========== */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col flex-shrink-0">
        <div className="px-4 py-3 border-b border-slate-100">
          <span className="text-sm font-semibold text-slate-700">访视列表</span>
          <p className="text-xs text-slate-400 mt-0.5">选择访视配置模块</p>
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          {sortedVisits.length === 0 ? (
            <div className="text-center py-8 px-4">
              <Layers className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs text-slate-400">暂无访视</p>
            </div>
          ) : (
            sortedVisits.map((visit, vi) => {
              const moduleCount = visit.crfModuleIds.length
              const isActive = activeVisitId === visit.id
              return (
                <div
                  key={visit.id}
                  className={`mx-2 mb-1 rounded-lg cursor-pointer transition-colors ${
                    isActive ? 'bg-teal-50 border border-teal-200' : 'hover:bg-slate-50 border border-transparent'
                  }`}
                >
                  <div
                    className="px-3 py-2.5 flex items-center gap-2"
                    onClick={() => { setActiveVisitId(visit.id); setMode('visit') }}
                  >
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isActive ? 'bg-teal-500' : 'bg-slate-300'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{visit.name}</div>
                      <div className="text-[10px] text-slate-400">{visit.code} · {moduleCount} 个模块</div>
                    </div>
                    {!readOnly && isActive && (
                      <div className="flex items-center gap-0.5 flex-shrink-0">
                        <Button variant="ghost" size="icon" className="w-6 h-6" onClick={(e) => { e.stopPropagation(); moveVisit(vi, -1) }} disabled={vi === 0}>
                          <ChevronLeft className="w-3 h-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="w-6 h-6" onClick={(e) => { e.stopPropagation(); moveVisit(vi, 1) }} disabled={vi === sortedVisits.length - 1}>
                          <ChevronRight className="w-3 h-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="w-6 h-6" onClick={(e) => { e.stopPropagation(); setEditingVisit(visit); setShowVisitDialog(true) }}>
                          <Pencil className="w-3 h-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="w-6 h-6 text-red-400" onClick={(e) => { e.stopPropagation(); deleteVisit(visit.id) }}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
        {!readOnly && (
          <div className="p-3 border-t border-slate-100">
            <Button variant="outline" size="sm" className="w-full h-8 text-xs" onClick={addVisit}>
              <Plus className="w-3.5 h-3.5 mr-1" /> 添加访视
            </Button>
          </div>
        )}
      </aside>

      {/* ========== 右侧：内容区 ========== */}
      <main className="flex-1 bg-slate-50 overflow-hidden flex flex-col">
        {!activeVisit ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Layers className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">请先添加访视开始配置</p>
            </div>
          </div>
        ) : mode === 'visit' ? (
          <VisitModulesView
            visit={activeVisit}
            allModules={project.crfModules}
            readOnly={readOnly}
            onAddModule={() => setShowAddModuleDialog(true)}
            onEditModule={openModuleEditor}
            onPreviewModule={openModulePreview}
            onEditModuleInfo={(mod) => { setEditingModuleInfo(mod); setShowModuleInfoDialog(true) }}
            onRemoveModule={removeModuleFromVisit}
            onDeleteModule={deleteProjectModule}
            onReorderModules={(newOrder) => {
              onUpdate((p) => ({
                ...p,
                visits: p.visits.map((v) =>
                  v.id === activeVisit.id ? { ...v, crfModuleIds: newOrder } : v
                ),
              }))
            }}
          />
        ) : mode === 'module' && activeModule ? (
          <ModuleFieldEditor
            module={activeModule}
            readOnly={readOnly}
            onBack={backToVisit}
            onAddField={addField}
            onEditField={(f) => { setEditingField(f); setShowFieldDialog(true) }}
            onDeleteField={deleteField}
            onMoveField={moveField}
          />
        ) : mode === 'preview' && previewModule ? (
          <ModulePreviewView module={previewModule} onBack={backToVisit} />
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-500">
            {mode === 'module' ? '模块不存在' : '预览模块不存在'}
          </div>
        )}
      </main>

      {/* ========== 弹窗 ========== */}
      <AddModuleDialog open={showAddModuleDialog} onClose={() => setShowAddModuleDialog(false)} moduleLibrary={moduleLibrary} visit={activeVisit} projectModuleIds={new Set(project.crfModules.map((m) => m.id))} onAdd={addModulesToVisit} />
      {editingVisit && (
        <Dialog open={showVisitDialog} onOpenChange={setShowVisitDialog}>
          <DialogContent>
            <DialogHeader><DialogTitle>编辑访视</DialogTitle></DialogHeader>
            <div className="space-y-3 py-2">
              <div><Label className="text-sm">访视名称</Label><Input value={editingVisit.name} onChange={(e) => setEditingVisit({ ...editingVisit, name: e.target.value })} /></div>
              <div><Label className="text-sm">访视编码</Label><Input value={editingVisit.code} onChange={(e) => setEditingVisit({ ...editingVisit, code: e.target.value })} /></div>
              <div><Label className="text-sm">描述</Label><Input value={editingVisit.description || ''} onChange={(e) => setEditingVisit({ ...editingVisit, description: e.target.value })} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowVisitDialog(false)}>取消</Button>
              <Button className="bg-teal-500 hover:bg-teal-600" onClick={() => saveVisit(editingVisit)}>保存</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      {editingModuleInfo && (
        <ModuleInfoDialog open={showModuleInfoDialog} onOpenChange={setShowModuleInfoDialog} module={editingModuleInfo} onSave={saveModuleInfo} />
      )}
      {editingField && showFieldDialog && (
        <FieldEditDialog open={showFieldDialog} onOpenChange={setShowFieldDialog} field={editingField} onSave={saveField} />
      )}
    </div>
  )
}

// ==================== 访视模块视图（左模块配置 + 右实时预览）====================
function VisitModulesView({
  visit,
  allModules,
  readOnly,
  onAddModule,
  onEditModule,
  onPreviewModule,
  onEditModuleInfo,
  onRemoveModule,
  onDeleteModule,
  onReorderModules,
}: {
  visit: Visit
  allModules: CRFModule[]
  readOnly: boolean
  onAddModule: () => void
  onEditModule: (moduleId: string) => void
  onPreviewModule: (moduleId: string) => void
  onEditModuleInfo: (module: CRFModule) => void
  onRemoveModule: (moduleId: string) => void
  onDeleteModule: (moduleId: string) => void
  onReorderModules: (newOrder: string[]) => void
}) {
  const [showPreview, setShowPreview] = useState(true)
  const [previewWidth, setPreviewWidth] = useState(460)
  const [isResizing, setIsResizing] = useState(false)
  const modules: CRFModule[] = visit.crfModuleIds
    .map((mid) => allModules.find((m) => m.id === mid))
    .filter(Boolean) as CRFModule[]

  // 模块拖拽排序
  const [dragModuleId, setDragModuleId] = useState<string | null>(null)
  const [dragOverModuleId, setDragOverModuleId] = useState<string | null>(null)

  const handleModuleDragStart = (e: React.DragEvent, moduleId: string) => {
    setDragModuleId(moduleId)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', moduleId)
  }

  const handleModuleDragOver = (e: React.DragEvent, moduleId: string) => {
    e.preventDefault()
    if (dragModuleId && dragModuleId !== moduleId) {
      setDragOverModuleId(moduleId)
    }
  }

  const handleModuleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault()
    if (!dragModuleId || dragModuleId === targetId) {
      setDragModuleId(null)
      setDragOverModuleId(null)
      return
    }
    const fromIndex = visit.crfModuleIds.indexOf(dragModuleId)
    const toIndex = visit.crfModuleIds.indexOf(targetId)
    if (fromIndex === -1 || toIndex === -1) {
      setDragModuleId(null)
      setDragOverModuleId(null)
      return
    }
    const newOrder = [...visit.crfModuleIds]
    const [moved] = newOrder.splice(fromIndex, 1)
    newOrder.splice(toIndex, 0, moved)
    onReorderModules(newOrder)
    setDragModuleId(null)
    setDragOverModuleId(null)
  }

  const handleModuleDragEnd = () => {
    setDragModuleId(null)
    setDragOverModuleId(null)
  }

  // 拖拽调整宽度
  const startResize = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
    const startX = e.clientX
    const startWidth = previewWidth

    const onMove = (moveEvent: MouseEvent) => {
      const delta = startX - moveEvent.clientX
      const newWidth = Math.max(280, Math.min(800, startWidth + delta))
      setPreviewWidth(newWidth)
    }

    const onUp = () => {
      setIsResizing(false)
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  // 预览数据：将所有模块字段合并，按模块分组为 sections
  const previewSections = modules.map((mod, i) => ({
    id: mod.id,
    title: mod.name,
    description: mod.description,
    order: i,
  }))
  const previewFields = modules.flatMap((mod) =>
    mod.fields.map((f) => ({ ...f, sectionId: mod.id }))
  )

  return (
    <div className="flex flex-col h-full">
      {/* 访视头部 */}
      <div className="px-6 py-4 bg-white border-b border-slate-200">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-800">{visit.name}</h2>
              <Badge variant="outline" className="text-xs">{visit.code}</Badge>
            </div>
            {visit.description && <p className="text-sm text-slate-400 mt-1">{visit.description}</p>}
          </div>
          <div className="flex items-center gap-2">
            {modules.length > 0 && (
              <Button variant="outline" size="sm" className="h-9 text-xs" onClick={() => setShowPreview((v) => !v)}>
                {showPreview ? (
                  <><ChevronRight className="w-3.5 h-3.5 mr-1" /> 收起预览</>
                ) : (
                  <><Eye className="w-3.5 h-3.5 mr-1" /> 展开预览</>
                )}
              </Button>
            )}
            {!readOnly && (
              <Button className="bg-teal-500 hover:bg-teal-600" onClick={onAddModule}>
                <Plus className="w-4 h-4 mr-1" /> 添加模块
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* 调试面板 */}
      <div className="px-6 pt-3">
        <details className="bg-amber-50 border border-amber-200 rounded-md text-xs">
          <summary className="px-3 py-2 cursor-pointer font-medium text-amber-700 flex items-center gap-2">
            <AlertCircle className="w-3.5 h-3.5" />
            调试信息（点击查看数据状态）
          </summary>
          <div className="px-3 pb-3 space-y-2 text-amber-800">
            <div>
              <span className="font-semibold">访视中 crfModuleIds：</span>
              <span className="font-mono">{JSON.stringify(visit.crfModuleIds)}</span>
            </div>
            <div>
              <span className="font-semibold">项目模块 IDs：</span>
              <span className="font-mono">{JSON.stringify(allModules.map((m) => m.id))}</span>
            </div>
            <div>
              <span className="font-semibold">匹配结果：</span>
              {modules.length > 0 ? (
                <span className="text-green-600">✓ 成功匹配 {modules.length} 个模块</span>
              ) : visit.crfModuleIds.length > 0 ? (
                <span className="text-red-500">✗ 有 {visit.crfModuleIds.length} 个模块ID但无匹配（数据不一致）</span>
              ) : (
                <span className="text-slate-400">无模块ID</span>
              )}
            </div>
            {visit.crfModuleIds.length > 0 && modules.length === 0 && (
              <div className="bg-red-50 border border-red-200 rounded p-2 text-red-600">
                <p className="font-semibold">检测到数据不一致！</p>
                <p>原因：之前添加模块时模块ID已变更，导致访视中保存的ID和实际模块ID不匹配。</p>
                <p className="mt-1">建议：清除浏览器 LocalStorage 后刷新页面重新测试。</p>
              </div>
            )}
          </div>
        </details>
      </div>

      {/* 主体：左模块配置 + 右实时预览 */}
      <div className={`flex-1 flex overflow-hidden ${isResizing ? 'select-none' : ''}`}>
        {/* 左侧：模块卡片网格 */}
        <div className="flex-1 overflow-y-auto p-6 min-w-0">
          {modules.length === 0 ? (
            <div className="text-center py-16">
              <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 mb-1">该访视尚未配置模块</p>
              <p className="text-sm text-slate-400 mb-4">点击上方按钮从模块库中添加</p>
              {!readOnly && (
                <Button className="bg-teal-500 hover:bg-teal-600" onClick={onAddModule}>
                  <Plus className="w-4 h-4 mr-1" /> 添加模块
                </Button>
              )}
            </div>
          ) : (
            <div className={"grid gap-4 " + (showPreview ? "grid-cols-1" : "grid-cols-2")}>
              {modules.map((mod) => (
                <div
                  key={mod.id}
                  draggable={!readOnly}
                  onDragStart={(e) => handleModuleDragStart(e, mod.id)}
                  onDragOver={(e) => handleModuleDragOver(e, mod.id)}
                  onDrop={(e) => handleModuleDrop(e, mod.id)}
                  onDragEnd={handleModuleDragEnd}
                  className={`bg-white rounded-lg border p-5 hover:shadow-md transition-shadow cursor-move ${
                    dragOverModuleId === mod.id ? 'border-teal-400 ring-1 ring-teal-100' : 'border-slate-200'
                  } ${dragModuleId === mod.id ? 'opacity-50' : ''}`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center flex-shrink-0">
                        <ModuleIcon name={mod.icon} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-800 text-sm">{mod.name}</h3>
                        <p className="text-xs text-slate-400 line-clamp-1">{mod.description || '暂无描述'}</p>
                      </div>
                    </div>
                    {!readOnly && (
                      <Button variant="ghost" size="icon" className="w-7 h-7 text-slate-400 hover:text-teal-600" onClick={() => onEditModuleInfo(mod)}>
                        <Pencil className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mb-4">
                    <Badge variant="secondary" className="text-[10px] h-5">{mod.fields.length} 个字段</Badge>
                    {mod.fields.some((f) => f.validation?.required) && (
                      <Badge variant="outline" className="text-[10px] h-5 text-red-500 border-red-200">含必填</Badge>
                    )}
                  </div>
                  <div className="space-y-1.5 mb-4">
                    {mod.fields.slice(0, 4).map((f) => (
                      <div key={f.id} className="flex items-center gap-2 text-xs text-slate-500">
                        <span className="text-slate-300">{FIELD_TYPE_ICONS[f.type]}</span>
                        <span className="truncate">{f.label}</span>
                        {f.validation?.required && <span className="text-red-400">*</span>}
                      </div>
                    ))}
                    {mod.fields.length > 4 && <div className="text-xs text-slate-400">+{mod.fields.length - 4} 个字段</div>}
                  </div>
                  <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
                    <Button variant="outline" size="sm" className="flex-1 h-8 text-xs" onClick={() => onEditModule(mod.id)}>
                      <Settings2 className="w-3 h-3 mr-1" /> 设计字段
                    </Button>
                    <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => onPreviewModule(mod.id)}>
                      <Eye className="w-3 h-3 mr-1" /> 预览
                    </Button>
                    {!readOnly && (
                      <>
                        <Button variant="outline" size="sm" className="h-8 text-xs text-amber-600 border-amber-200 hover:bg-amber-50" onClick={() => onRemoveModule(mod.id)}>
                          <X className="w-3 h-3 mr-1" /> 移除
                        </Button>
                        <Button variant="outline" size="sm" className="h-8 text-xs text-red-500 border-red-200 hover:bg-red-50" onClick={() => onDeleteModule(mod.id)}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 拖拽条 */}
        {modules.length > 0 && showPreview && (
          <div
            className="w-1.5 bg-slate-200 hover:bg-teal-400 cursor-col-resize flex-shrink-0 transition-colors"
            onMouseDown={startResize}
            title="拖拽调整预览面板宽度"
          />
        )}

        {/* 右侧：实时预览 */}
        {modules.length > 0 && showPreview && (
          <aside
            className="border-l border-slate-200 bg-slate-50 flex flex-col flex-shrink-0"
            style={{ width: previewWidth }}
          >
            <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">录入预览</span>
              <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-600 border-blue-200">
                <Eye className="w-2.5 h-2.5 mr-0.5" /> 实时
              </Badge>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <div className="bg-white rounded-lg border border-slate-200 p-5">
                <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
                  <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center">
                    <FlaskConical className="w-4 h-4 text-teal-600" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-slate-700">{visit.name}</h4>
                    <p className="text-[10px] text-slate-400">{modules.length} 个模块 · {previewFields.length} 个字段</p>
                  </div>
                </div>
                <CRFFormRenderer
                  sections={previewSections}
                  fields={previewFields}
                  onChange={(data) => {
                    // 预览模式不保存数据
                    console.log('visit preview data', data)
                  }}
                />
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  )
}

// ==================== 模块预览视图（右侧分栏）====================
function ModulePreviewView({ module, onBack }: { module: CRFModule; onBack: () => void }) {
  return (
    <>
      {/* 顶部栏 */}
      <div className="px-6 py-3 bg-white border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" className="h-8 text-slate-500" onClick={onBack}>
            <ChevronLeft className="w-4 h-4 mr-1" /> 返回访视
          </Button>
          <div className="w-px h-5 bg-slate-200" />
          <div className="flex items-center gap-2">
            <ModuleIcon name={module.icon} />
            <h2 className="font-semibold text-slate-800">预览: {module.name}</h2>
          </div>
          <Badge variant="outline" className="text-xs">{module.fields.length} 字段</Badge>
        </div>
        <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200 text-xs">
          <Eye className="w-3 h-3 mr-1" /> 录入预览
        </Badge>
      </div>

      {/* 预览内容 */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto space-y-4">
          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <CRFFormRenderer sections={[]} fields={module.fields} />
          </div>
          <p className="text-xs text-slate-400 text-center">以上为数据录入人员看到的模块样式</p>
        </div>
      </div>
    </>
  )
}

// ==================== 模块字段编辑器 ====================
function ModuleFieldEditor({
  module,
  readOnly,
  onBack,
  onAddField,
  onEditField,
  onDeleteField,
  onMoveField,
}: {
  module: CRFModule
  readOnly: boolean
  onBack: () => void
  onAddField: (type: FieldType) => void
  onEditField: (field: CRFField) => void
  onDeleteField: (fieldId: string) => void
  onMoveField: (index: number, dir: number) => void
}) {
  const sortedFields = [...module.fields].sort((a, b) => a.order - b.order)

  return (
    <>
      <div className="px-6 py-3 bg-white border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" className="h-8 text-slate-500" onClick={onBack}>
            <ChevronLeft className="w-4 h-4 mr-1" /> 返回访视
          </Button>
          <div className="w-px h-5 bg-slate-200" />
          <h2 className="font-semibold text-slate-800">{module.name}</h2>
          <Badge variant="outline" className="text-xs">{module.fields.length} 字段</Badge>
        </div>
        {!readOnly && (
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-xs text-slate-400 mr-1">添加字段:</span>
            {(Object.keys(FIELD_TYPE_LABELS) as FieldType[]).map((type) => (
              <Button key={type} variant="outline" size="sm" className="h-7 text-xs px-2" onClick={() => onAddField(type)}>
                {FIELD_TYPE_ICONS[type]} <span className="ml-1">{FIELD_TYPE_LABELS[type]}</span>
              </Button>
            ))}
          </div>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-6">
        {sortedFields.length === 0 ? (
          <div className="text-center py-16">
            <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 mb-1">暂无字段</p>
            <p className="text-sm text-slate-400">{readOnly ? 'CRF 已发布，无法编辑' : '点击上方按钮添加字段'}</p>
          </div>
        ) : (
          <div className="space-y-3 max-w-3xl mx-auto">
            {sortedFields.map((f, fi) => (
              <div key={f.id} className="bg-white rounded-lg border border-slate-200 p-4 hover:shadow-sm transition-shadow">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <GripVertical className="w-3.5 h-3.5 text-slate-300" />
                    <span className="text-xs text-slate-400 font-mono">#{fi + 1}</span>
                    <span className="text-slate-400">{FIELD_TYPE_ICONS[f.type]}</span>
                    <span className="font-medium text-sm text-slate-700">{f.label}</span>
                    {f.validation?.required && <span className="text-red-400 text-xs">*</span>}
                    <Badge variant="outline" className="text-[10px] h-4 px-1.5">{FIELD_TYPE_LABELS[f.type]}</Badge>
                    <span className="text-xs text-slate-400 font-mono">{f.name}</span>
                  </div>
                  {!readOnly && (
                    <div className="flex items-center gap-0.5">
                      <Button variant="ghost" size="icon" className="w-6 h-6" onClick={() => onMoveField(fi, -1)} disabled={fi === 0}>
                        <ChevronLeft className="w-3 h-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="w-6 h-6" onClick={() => onMoveField(fi, 1)} disabled={fi === sortedFields.length - 1}>
                        <ChevronRight className="w-3 h-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="w-6 h-6 text-slate-400 hover:text-teal-600" onClick={() => onEditField(f)}>
                        <Pencil className="w-3 h-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="w-6 h-6 text-slate-400 hover:text-red-500" onClick={() => onDeleteField(f.id)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                </div>
                <div className="bg-slate-50 rounded-md p-3">
                  <CRFFormRenderer sections={[]} fields={[f]} readOnly />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}

// ==================== 添加模块对话框 ====================
function AddModuleDialog({
  open,
  onClose,
  moduleLibrary,
  visit,
  projectModuleIds,
  onAdd,
}: {
  open: boolean
  onClose: () => void
  moduleLibrary: ModuleLibraryItem[]
  visit: Visit | undefined
  projectModuleIds: Set<string>
  onAdd: (moduleIds: string[]) => void
}) {
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('全部')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const categories = useMemo(() => {
    const set = new Set(moduleLibrary.map((m) => m.category))
    return ['全部', ...Array.from(set)]
  }, [moduleLibrary])

  const filtered = useMemo(() => {
    return moduleLibrary.filter((m) => {
      const matchSearch = m.name.includes(search) || (m.description?.includes(search) ?? false)
      const matchCategory = activeCategory === '全部' || m.category === activeCategory
      return matchSearch && matchCategory
    })
  }, [moduleLibrary, search, activeCategory])

  // 已添加 = 在访视的crfModuleIds中 AND 确实存在于项目模块中
  const alreadyAddedIds = useMemo(() => {
    const visitIds = visit?.crfModuleIds || []
    return new Set(visitIds.filter((id) => projectModuleIds.has(id)))
  }, [visit, projectModuleIds])

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleAdd = () => {
    onAdd(Array.from(selectedIds))
    setSelectedIds(new Set())
    setSearch('')
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5 text-teal-600" />
            添加模块到访视
            {visit && <span className="text-sm font-normal text-slate-400">· {visit.name}</span>}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input placeholder="搜索模块名称/描述..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
              {search && <button className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" onClick={() => setSearch('')}><X className="w-3.5 h-3.5" /></button>}
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {categories.map((cat) => (
              <button key={cat} onClick={() => setActiveCategory(cat)} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${activeCategory === cat ? 'bg-teal-500 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                {cat}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3 max-h-[400px] overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <div className="col-span-2 text-center py-8 text-sm text-slate-400">未找到匹配的模块</div>
            ) : (
              filtered.map((mod) => {
                const isSelected = selectedIds.has(mod.id)
                const isAlreadyAdded = alreadyAddedIds.has(mod.id)
                return (
                  <div key={mod.id} className={`p-3 rounded-lg border cursor-pointer transition-all ${isAlreadyAdded ? 'border-slate-100 bg-slate-50 opacity-60 cursor-not-allowed' : isSelected ? 'border-teal-500 bg-teal-50' : 'border-slate-200 hover:border-teal-300 hover:bg-white'}`} onClick={() => { if (!isAlreadyAdded) toggleSelect(mod.id) }}>
                    <div className="flex items-start gap-2.5">
                      <div className="mt-0.5 flex-shrink-0">
                        {isAlreadyAdded ? <div className="w-5 h-5 rounded border border-slate-300 flex items-center justify-center"><Check className="w-3 h-3 text-slate-400" /></div> : isSelected ? <div className="w-5 h-5 rounded bg-teal-500 flex items-center justify-center"><Check className="w-3.5 h-3.5 text-white" /></div> : <div className="w-5 h-5 rounded border-2 border-slate-300" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm text-slate-800">{mod.name}</span>
                          <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{mod.category}</Badge>
                          {mod.isSystem && <Badge variant="outline" className="text-[10px] h-4 px-1 bg-amber-50 text-amber-600 border-amber-200">系统</Badge>}
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{mod.description || '暂无描述'}</p>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {mod.fields.slice(0, 4).map((f) => <Badge key={f.id} variant="outline" className="text-[9px] h-4 px-1 bg-white">{f.label}</Badge>)}
                          {mod.fields.length > 4 && <span className="text-[9px] text-slate-400">+{mod.fields.length - 4}</span>}
                        </div>
                      </div>
                      <div className="text-xs text-slate-400 flex-shrink-0">{mod.fields.length} 字段</div>
                    </div>
                    {isAlreadyAdded && <div className="mt-2 text-[10px] text-slate-400 text-center">已添加到此访视</div>}
                  </div>
                )
              })
            )}
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
            <div className="text-xs text-slate-400">已选择 {selectedIds.size} 个模块</div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={onClose}>取消</Button>
              <Button className="bg-teal-500 hover:bg-teal-600" size="sm" onClick={handleAdd} disabled={selectedIds.size === 0}>
                <Plus className="w-3.5 h-3.5 mr-1" /> 添加到访视
              </Button>
            </div>
          </div>
          <div className="bg-slate-50 rounded-lg p-3 text-center">
            <p className="text-xs text-slate-500 mb-2">没有找到想要的模块？</p>
            <Button variant="outline" size="sm" className="text-xs" asChild>
              <a href="#/module-library" target="_blank" rel="noopener noreferrer"><Package className="w-3 h-3 mr-1" /> 前往模块库新建模块</a>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ==================== 字段编辑弹窗 ====================
function FieldEditDialog({ open, onOpenChange, field, onSave }: {
  open: boolean; onOpenChange: (v: boolean) => void; field: CRFField; onSave: (f: CRFField) => void
}) {
  const [f, setF] = useState<CRFField>(field)
  const needsOptions = f.type === 'select' || f.type === 'radio' || f.type === 'checkbox'
  const isTable = f.type === 'table'

  // 当外部 field 变化时同步内部状态
  useEffect(() => { setF(field) }, [field])

  const addOption = () => setF({ ...f, options: [...(f.options || []), { label: `选项${(f.options?.length || 0) + 1}`, value: `opt${(f.options?.length || 0) + 1}` }] })
  const updateOption = (idx: number, key: 'label' | 'value', val: string) => {
    const opts = [...(f.options || [])]; opts[idx] = { ...opts[idx], [key]: val }; setF({ ...f, options: opts })
  }
  const removeOption = (idx: number) => {
    const opts = [...(f.options || [])]; opts.splice(idx, 1); setF({ ...f, options: opts })
  }

  const addColumn = () => {
    const newCol: CRFField = {
      id: genId(),
      type: 'text',
      label: `列${(f.columns?.length || 0) + 1}`,
      name: `col${(f.columns?.length || 0) + 1}`,
      order: (f.columns?.length || 0),
    }
    setF({ ...f, columns: [...(f.columns || []), newCol] })
  }
  const updateColumn = (idx: number, key: 'label' | 'name' | 'type', val: string) => {
    const cols = [...(f.columns || [])]
    const updates: Partial<CRFField> = { [key]: val as any }
    if (key === 'type' && val === 'select' && (!cols[idx].options || cols[idx].options.length === 0)) {
      updates.options = [
        { label: '是', value: 'yes' },
        { label: '否', value: 'no' },
      ]
    }
    cols[idx] = { ...cols[idx], ...updates }
    setF({ ...f, columns: cols })
  }
  const updateColumnOption = (colIdx: number, optIdx: number, key: 'label' | 'value', val: string) => {
    const cols = [...(f.columns || [])]
    const opts = [...(cols[colIdx].options || [])]
    opts[optIdx] = { ...opts[optIdx], [key]: val }
    cols[colIdx] = { ...cols[colIdx], options: opts }
    setF({ ...f, columns: cols })
  }
  const addColumnOption = (colIdx: number) => {
    const cols = [...(f.columns || [])]
    const opts = cols[colIdx].options || []
    cols[colIdx] = {
      ...cols[colIdx],
      options: [...opts, { label: `选项${opts.length + 1}`, value: `opt${opts.length + 1}` }],
    }
    setF({ ...f, columns: cols })
  }
  const removeColumnOption = (colIdx: number, optIdx: number) => {
    const cols = [...(f.columns || [])]
    const opts = (cols[colIdx].options || []).filter((_, i) => i !== optIdx)
    cols[colIdx] = { ...cols[colIdx], options: opts }
    setF({ ...f, columns: cols })
  }
  const removeColumn = (idx: number) => {
    const cols = [...(f.columns || [])]; cols.splice(idx, 1); setF({ ...f, columns: cols })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>编辑字段</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div><Label className="text-sm">字段标签</Label><Input value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} /></div>
          <div><Label className="text-sm">字段标识 (name)</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
          {!isTable && <div><Label className="text-sm">占位提示</Label><Input value={f.placeholder || ''} onChange={(e) => setF({ ...f, placeholder: e.target.value })} /></div>}
          <div><Label className="text-sm">帮助说明</Label><Input value={f.helpText || ''} onChange={(e) => setF({ ...f, helpText: e.target.value })} /></div>
          {!isTable && (
            <div className="border rounded-md p-3 space-y-2">
              <Label className="text-sm font-semibold">校验规则</Label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={!!f.validation?.required} onChange={(e) => setF({ ...f, validation: { ...f.validation, required: e.target.checked } })} />
                必填
              </label>
            </div>
          )}
          {needsOptions && (
            <div className="border rounded-md p-3 space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">选项列表</Label>
                <Button variant="outline" size="sm" onClick={addOption}><Plus className="w-3 h-3 mr-1" />添加</Button>
              </div>
              <div className="space-y-1">
                {(f.options || []).map((opt, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Input value={opt.label} onChange={(e) => updateOption(idx, 'label', e.target.value)} placeholder="显示文本" className="flex-1" />
                    <Input value={opt.value} onChange={(e) => updateOption(idx, 'value', e.target.value)} placeholder="值" className="w-24" />
                    <Button variant="ghost" size="icon" className="w-7 h-7 text-red-500" onClick={() => removeOption(idx)}><Trash2 className="w-3 h-3" /></Button>
                  </div>
                ))}
              </div>
            </div>
          )}
          {isTable && (
            <div className="border rounded-md p-3 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">表格列配置</Label>
                <Button variant="outline" size="sm" onClick={addColumn}><Plus className="w-3 h-3 mr-1" />添加列</Button>
              </div>
              {(f.columns || []).length === 0 && (
                <p className="text-xs text-slate-400">暂无列配置，点击上方按钮添加</p>
              )}
              <div className="space-y-2">
                {(f.columns || []).map((col, idx) => (
                  <div key={col.id} className="space-y-1">
                    <div className="grid grid-cols-12 gap-2 items-center bg-slate-50 rounded p-2">
                      <div className="col-span-3">
                        <Input
                          value={col.label}
                          onChange={(e) => updateColumn(idx, 'label', e.target.value)}
                          placeholder="列标签"
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="col-span-3">
                        <Input
                          value={col.name}
                          onChange={(e) => updateColumn(idx, 'name', e.target.value)}
                          placeholder="列标识"
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="col-span-4">
                        <select
                          value={col.type}
                          onChange={(e) => updateColumn(idx, 'type', e.target.value)}
                          className="h-8 text-xs w-full rounded border border-slate-200 px-2 bg-white"
                        >
                          <option value="text">单行文本</option>
                          <option value="number">数字</option>
                          <option value="date">日期</option>
                          <option value="select">下拉选择</option>
                          <option value="textarea">多行文本</option>
                        </select>
                      </div>
                      <div className="col-span-2 flex justify-end">
                        <Button variant="ghost" size="icon" className="w-7 h-7 text-red-500" onClick={() => removeColumn(idx)}><Trash2 className="w-3 h-3" /></Button>
                      </div>
                    </div>

                    {/* 下拉选项配置（仅select类型显示） */}
                    {col.type === 'select' && (
                      <div className="ml-4 p-2 rounded-md border border-slate-100 bg-white space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-slate-400">选项配置</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 px-1.5 text-[10px] text-teal-600"
                            onClick={() => addColumnOption(idx)}
                          >
                            <Plus className="w-2.5 h-2.5 mr-0.5" /> 添加选项
                          </Button>
                        </div>
                        <div className="space-y-1">
                          {(col.options || []).map((opt, oidx) => (
                            <div key={oidx} className="flex items-center gap-1.5">
                              <Input
                                placeholder="显示文本"
                                className="h-6 text-[10px] flex-1"
                                value={opt.label}
                                onChange={(e) => updateColumnOption(idx, oidx, 'label', e.target.value)}
                              />
                              <Input
                                placeholder="值"
                                className="h-6 text-[10px] w-16"
                                value={opt.value}
                                onChange={(e) => updateColumnOption(idx, oidx, 'value', e.target.value)}
                              />
                              <Button
                                variant="ghost"
                                size="icon"
                                className="w-5 h-5 text-slate-400 hover:text-red-500"
                                onClick={() => removeColumnOption(idx, oidx)}
                              >
                                <Trash2 className="w-2.5 h-2.5" />
                              </Button>
                            </div>
                          ))}
                          {(col.options || []).length === 0 && (
                            <div className="text-[10px] text-slate-400 text-center py-1">暂无选项</div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button className="bg-teal-500 hover:bg-teal-600" onClick={() => onSave(f)}>保存</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
