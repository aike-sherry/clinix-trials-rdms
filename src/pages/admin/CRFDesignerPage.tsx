import { useState, useMemo, Component, type ReactNode } from 'react'
import { useAppStorage } from '@/hooks/useAppStorage'
import type { CRFField, CRFModule, Project, Visit } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import CRFFormRenderer from '@/components/CRFFormRenderer'
import {
  Plus, Trash2, Pencil, ChevronDown, ChevronRight, ChevronLeft,
  Hash, Type, Calendar, ListChecks, ToggleLeft, AlignLeft, FileText,
  FlaskConical, Eye, Package, Copy, Check
} from 'lucide-react'

// ==================== 常量 ====================
const FIELD_TYPE_ICONS: Record<string, React.ReactNode> = {
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
}

const FIELD_TYPE_LABELS: Record<string, string> = {
  text: '单行文本', textarea: '多行文本', number: '数字', date: '日期',
  datetime: '日期时间', select: '下拉选择', radio: '单选', checkbox: '多选',
  toggle: '开关', label: '说明文本',
}

function genId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

// ==================== 错误边界 ====================
class ErrorBoundary extends Component<{ children: ReactNode; fallback?: ReactNode }, { hasError: boolean; error?: Error }> {
  constructor(props: { children: ReactNode; fallback?: ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex-1 flex items-center justify-center p-10">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-lg">
            <h3 className="text-red-600 font-semibold mb-2">页面加载出错</h3>
            <p className="text-sm text-red-500 mb-3">{this.state.error?.message}</p>
            <pre className="text-xs bg-white p-3 rounded border border-red-100 overflow-auto max-h-40">
              {this.state.error?.stack}
            </pre>
            <button
              className="mt-3 px-4 py-2 bg-red-500 text-white rounded text-sm hover:bg-red-600"
              onClick={() => window.location.reload()}
            >
              刷新页面
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

// ==================== 主页面 ====================
export default function CRFDesignerPage() {
  const { projects, saveProject } = useAppStorage()
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')

  const project = projects.find((p) => p.id === selectedProjectId)

  return (
    <div className="h-[calc(100vh-64px)] -m-6 flex flex-col">
      {/* 顶部项目选择栏 */}
      <div className="px-6 py-3 bg-white border-b border-slate-200 flex items-center gap-4">
        <div className="flex items-center gap-2 text-slate-500 text-sm">
          <FlaskConical className="w-4 h-4" />
          <span>CRF 设计器</span>
        </div>
        <div className="w-px h-5 bg-slate-200" />
        <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
          <SelectTrigger className="w-80 h-8 text-sm">
            <SelectValue placeholder="选择项目" />
          </SelectTrigger>
          <SelectContent>
            {projects.length === 0 && <SelectItem value="" disabled>暂无项目</SelectItem>}
            {projects.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.projectNo} · {p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {project && (
          <Badge variant="outline" className="bg-teal-50 text-teal-600 border-teal-200 text-xs">
            {project.visits.length} 访视 · {project.crfModules.length} 模块
          </Badge>
        )}
      </div>

      {/* 主体 */}
      {project ? (
        <ErrorBoundary>
          <CRFDesignerCore project={project} onSave={saveProject} />
        </ErrorBoundary>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <FlaskConical className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">请从上方选择项目开始设计 CRF</p>
          </div>
        </div>
      )}
    </div>
  )
}

// ==================== 核心设计器 ====================
function CRFDesignerCore({ project, onSave }: { project: Project; onSave: (p: Project) => void }) {
  const { moduleLibrary } = useAppStorage()
  const [selectedVisitId, setSelectedVisitId] = useState<string>('')
  const [selectedModuleId, setSelectedModuleId] = useState<string>('')
  const [expandedVisits, setExpandedVisits] = useState<Set<string>>(new Set(project.visits.map((v) => v.id)))
  const [showFieldDialog, setShowFieldDialog] = useState(false)
  const [editingField, setEditingField] = useState<CRFField | null>(null)
  const [showVisitDialog, setShowVisitDialog] = useState(false)
  const [editingVisit, setEditingVisit] = useState<Visit | null>(null)
  const [showModuleDialog, setShowModuleDialog] = useState(false)
  const [editingModule, setEditingModule] = useState<CRFModule | null>(null)
  
  // 预览面板
  const [previewWidth, setPreviewWidth] = useState(420)
  const [previewCollapsed, setPreviewCollapsed] = useState(false)
  
  // 模块库导入弹窗
  const [showLibraryDialog, setShowLibraryDialog] = useState(false)
  const [librarySearch, setLibrarySearch] = useState('')
  const [libraryCategory, setLibraryCategory] = useState('全部')
  const [selectedLibraryModuleIds, setSelectedLibraryModuleIds] = useState<Set<string>>(new Set())

  const updateProject = (updater: (p: Project) => Project) => {
    const next = updater({ ...project })
    next.updatedAt = new Date().toISOString()
    onSave(next)
  }

  const sortedVisits = useMemo(() => [...project.visits].sort((a, b) => a.order - b.order), [project.visits])
  const sortedModules = useMemo(() => [...project.crfModules].sort((a, b) => a.order - b.order), [project.crfModules])

  const selectedVisit = sortedVisits.find((v) => v.id === selectedVisitId)
  const selectedModule = sortedModules.find((m) => m.id === selectedModuleId)

  // ---------- 树操作 ----------
  const toggleExpand = (visitId: string) => {
    setExpandedVisits((prev) => {
      const next = new Set(prev)
      if (next.has(visitId)) next.delete(visitId)
      else next.add(visitId)
      return next
    })
  }

  const expandAll = () => setExpandedVisits(new Set(project.visits.map((v) => v.id)))
  const collapseAll = () => setExpandedVisits(new Set())

  // ---------- Visit ----------
  const addVisit = () => {
    const v: Visit = {
      id: genId(), projectId: project.id,
      name: `V${project.visits.length}-新访视`, code: `V${project.visits.length}`,
      order: project.visits.length, crfModuleIds: [],
    }
    updateProject((p) => ({ ...p, visits: [...p.visits, v] }))
    setEditingVisit(v)
    setShowVisitDialog(true)
    setExpandedVisits((prev) => new Set(prev).add(v.id))
  }

  const saveVisit = (visit: Visit) => {
    updateProject((p) => ({ ...p, visits: p.visits.map((v) => (v.id === visit.id ? visit : v)) }))
    setShowVisitDialog(false); setEditingVisit(null)
  }

  const deleteVisit = (id: string) => {
    updateProject((p) => ({ ...p, visits: p.visits.filter((v) => v.id !== id) }))
    if (selectedVisitId === id) { setSelectedVisitId(''); setSelectedModuleId('') }
  }

  const moveVisit = (index: number, dir: number) => {
    const arr = [...sortedVisits]
    const ni = index + dir
    if (ni < 0 || ni >= arr.length) return
    ;[arr[index], arr[ni]] = [arr[ni], arr[index]]
    updateProject((p) => ({ ...p, visits: arr.map((v, i) => ({ ...v, order: i })) }))
  }

  // ---------- Module ----------
  const addModule = () => {
    const m: CRFModule = {
      id: genId(), projectId: project.id,
      name: `模块 ${project.crfModules.length + 1}`, fields: [], order: project.crfModules.length,
    }
    updateProject((p) => ({ ...p, crfModules: [...p.crfModules, m] }))
    setEditingModule(m)
    setShowModuleDialog(true)
  }

  const saveModule = (module: CRFModule) => {
    updateProject((p) => ({ ...p, crfModules: p.crfModules.map((m) => (m.id === module.id ? module : m)) }))
    setShowModuleDialog(false); setEditingModule(null)
  }

  const deleteModule = (id: string) => {
    updateProject((p) => ({
      ...p,
      crfModules: p.crfModules.filter((m) => m.id !== id),
      visits: p.visits.map((v) => ({ ...v, crfModuleIds: v.crfModuleIds.filter((mid) => mid !== id) })),
    }))
    if (selectedModuleId === id) setSelectedModuleId('')
  }

  const moveModule = (index: number, dir: number) => {
    const arr = [...sortedModules]
    const ni = index + dir
    if (ni < 0 || ni >= arr.length) return
    ;[arr[index], arr[ni]] = [arr[ni], arr[index]]
    updateProject((p) => ({ ...p, crfModules: arr.map((m, i) => ({ ...m, order: i })) }))
  }

  // ---------- 模块库导入 ----------
  const openLibraryDialog = () => {
    setLibrarySearch('')
    setLibraryCategory('全部')
    setSelectedLibraryModuleIds(new Set())
    setShowLibraryDialog(true)
  }

  const importFromLibrary = () => {
    if (selectedLibraryModuleIds.size === 0) return
    const modulesToImport = moduleLibrary.filter((m) => selectedLibraryModuleIds.has(m.id))
    
    const newModules: CRFModule[] = modulesToImport.map((libModule) => ({
      id: genId(),
      projectId: project.id,
      name: libModule.name,
      description: libModule.description,
      fields: libModule.fields.map((f) => ({ ...f, id: genId() })),
      order: project.crfModules.length + modulesToImport.indexOf(libModule),
    }))

    updateProject((p) => ({
      ...p,
      crfModules: [...p.crfModules, ...newModules],
    }))
    setShowLibraryDialog(false)
    setSelectedLibraryModuleIds(new Set())
  }

  const toggleLibraryModuleSelect = (id: string) => {
    setSelectedLibraryModuleIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const libraryCategories = useMemo(() => {
    const set = new Set(moduleLibrary.map((m) => m.category))
    return ['全部', ...Array.from(set)]
  }, [moduleLibrary])

  const filteredLibrary = useMemo(() => {
    return moduleLibrary.filter((m) => {
      const matchSearch = m.name.includes(librarySearch) || m.description?.includes(librarySearch)
      const matchCategory = libraryCategory === '全部' || m.category === libraryCategory
      return matchSearch && matchCategory
    })
  }, [moduleLibrary, librarySearch, libraryCategory])

  // ---------- 关联 ----------
  const toggleModuleInVisit = (visitId: string, moduleId: string) => {
    updateProject((p) => ({
      ...p,
      visits: p.visits.map((v) => {
        if (v.id !== visitId) return v
        const has = v.crfModuleIds.includes(moduleId)
        return { ...v, crfModuleIds: has ? v.crfModuleIds.filter((id) => id !== moduleId) : [...v.crfModuleIds, moduleId] }
      }),
    }))
  }

  // ---------- Field ----------
  const addField = (type: string) => {
    if (!selectedModuleId) return
    const f: CRFField = {
      id: genId(), type: type as any,
      label: FIELD_TYPE_LABELS[type] || type,
      name: `field_${Date.now()}`,
      order: selectedModule?.fields.length || 0,
    }
    if (type === 'select' || type === 'radio' || type === 'checkbox') {
      f.options = [{ label: '选项1', value: 'opt1' }, { label: '选项2', value: 'opt2' }]
    }
    updateProject((p) => ({
      ...p,
      crfModules: p.crfModules.map((m) => m.id === selectedModuleId ? { ...m, fields: [...m.fields, f] } : m),
    }))
    setEditingField(f)
    setShowFieldDialog(true)
  }

  const saveField = (field: CRFField) => {
    if (!selectedModuleId) return
    updateProject((p) => ({
      ...p,
      crfModules: p.crfModules.map((m) =>
        m.id === selectedModuleId ? { ...m, fields: m.fields.map((fld) => (fld.id === field.id ? field : fld)) } : m
      ),
    }))
    setShowFieldDialog(false); setEditingField(null)
  }

  const deleteField = (fieldId: string) => {
    if (!selectedModuleId) return
    updateProject((p) => ({
      ...p,
      crfModules: p.crfModules.map((m) =>
        m.id === selectedModuleId ? { ...m, fields: m.fields.filter((f) => f.id !== fieldId) } : m
      ),
    }))
  }

  const moveField = (index: number, dir: number) => {
    if (!selectedModule) return
    const arr = [...selectedModule.fields].sort((a, b) => a.order - b.order)
    const ni = index + dir
    if (ni < 0 || ni >= arr.length) return
    ;[arr[index], arr[ni]] = [arr[ni], arr[index]]
    updateProject((p) => ({
      ...p,
      crfModules: p.crfModules.map((m) =>
        m.id === selectedModuleId ? { ...m, fields: arr.map((f, i) => ({ ...f, order: i })) } : m
      ),
    }))
  }

  // ---------- 预览面板拖拽调整宽度 ----------
  const handlePreviewResizeStart = (e: React.MouseEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startWidth = previewWidth
    const onMove = (e: MouseEvent) => {
      e.preventDefault()
      const delta = startX - e.clientX
      const newWidth = Math.max(280, Math.min(700, startWidth + delta))
      setPreviewWidth(newWidth)
    }
    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* ========== 左侧：三层树 ========== */}
      <aside className="w-72 bg-white border-r border-slate-200 flex flex-col">
        {/* 工具栏 */}
        <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500">访视结构</span>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" className="h-6 text-[10px] px-1.5" onClick={expandAll}>全展开</Button>
            <Button variant="ghost" size="sm" className="h-6 text-[10px] px-1.5" onClick={collapseAll}>全折叠</Button>
          </div>
        </div>

        {/* 树 */}
        <div className="flex-1 overflow-y-auto py-2">
          {sortedVisits.map((visit, vi) => {
            const isExpanded = expandedVisits.has(visit.id)
            const visitModules = visit.crfModuleIds
              .map((mid) => sortedModules.find((m) => m.id === mid))
              .filter(Boolean) as CRFModule[]

            return (
              <div key={visit.id}>
                {/* 第一层：访视 */}
                <div
                  className={`flex items-center gap-1 px-3 py-2 cursor-pointer hover:bg-slate-50 ${
                    selectedVisitId === visit.id && !selectedModuleId ? 'bg-teal-50' : ''
                  }`}
                  onClick={() => setSelectedVisitId(visit.id)}
                >
                  <button
                    className="w-4 h-4 flex items-center justify-center text-slate-400"
                    onClick={(e) => { e.stopPropagation(); toggleExpand(visit.id) }}
                  >
                    {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                  </button>
                  <span className="text-sm font-medium flex-1 truncate">{visit.name}</span>
                  <Badge variant="outline" className="text-[10px] h-4 px-1">{visitModules.length}</Badge>
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
                    <Button variant="ghost" size="icon" className="w-5 h-5" onClick={(e) => { e.stopPropagation(); moveVisit(vi, -1) }} disabled={vi === 0}>
                      <ChevronRight className="w-3 h-3 rotate-180" />
                    </Button>
                    <Button variant="ghost" size="icon" className="w-5 h-5" onClick={(e) => { e.stopPropagation(); moveVisit(vi, 1) }} disabled={vi === sortedVisits.length - 1}>
                      <ChevronRight className="w-3 h-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="w-5 h-5" onClick={(e) => { e.stopPropagation(); setEditingVisit(visit); setShowVisitDialog(true) }}>
                      <Pencil className="w-3 h-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="w-5 h-5 text-red-400" onClick={(e) => { e.stopPropagation(); deleteVisit(visit.id) }}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>

                {/* 第二层：模块（展开时显示） */}
                {isExpanded && (
                  <div className="pl-6 pr-2">
                    {/* 已关联模块列表 */}
                    <div className="py-1">
                      <div className="text-[10px] text-slate-400 mb-1 px-1">已关联模块</div>
                      {visitModules.length === 0 && (
                        <div className="text-[10px] text-slate-300 px-1">点击下方添加模块</div>
                      )}
                      {visitModules.map((mod) => (
                        <div
                          key={mod.id}
                          className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-sm ${
                            selectedModuleId === mod.id ? 'bg-teal-100 text-teal-700' : 'hover:bg-slate-50 text-slate-600'
                          }`}
                          onClick={() => { setSelectedModuleId(mod.id); setSelectedVisitId(visit.id) }}
                        >
                          <span className="truncate flex-1">{mod.name}</span>
                          <Badge variant="outline" className="text-[9px] h-3.5 px-1">{mod.fields.length}</Badge>
                        </div>
                      ))}
                    </div>

                    {/* 关联模块选择 */}
                    <div className="border-t border-slate-50 pt-1 pb-2">
                      <div className="text-[10px] text-slate-400 mb-1 px-1">添加已有模块</div>
                      <div className="flex flex-wrap gap-1 px-1">
                        {sortedModules.map((mod) => {
                          const checked = visit.crfModuleIds.includes(mod.id)
                          return (
                            <label
                              key={mod.id}
                              className={`text-[10px] px-1.5 py-0.5 rounded cursor-pointer border ${
                                checked ? 'bg-teal-50 border-teal-200 text-teal-600' : 'bg-white border-slate-200 text-slate-400 hover:bg-slate-50'
                              }`}
                            >
                              <input
                                type="checkbox"
                                className="sr-only"
                                checked={checked}
                                onChange={() => toggleModuleInVisit(visit.id, mod.id)}
                              />
                              {mod.name}
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          {/* 添加访视 */}
          <div className="px-3 py-2">
            <Button variant="outline" size="sm" className="w-full h-7 text-xs" onClick={addVisit}>
              <Plus className="w-3 h-3 mr-1" /> 添加访视
            </Button>
          </div>
        </div>

        {/* 模块管理 */}
        <div className="border-t border-slate-200 p-3">
          <div className="text-xs font-semibold text-slate-500 mb-2">项目模块</div>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {sortedModules.map((mod, mi) => (
              <div
                key={mod.id}
                className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-sm ${
                  selectedModuleId === mod.id ? 'bg-teal-100 text-teal-700' : 'hover:bg-slate-50 text-slate-600'
                }`}
                onClick={() => setSelectedModuleId(mod.id)}
              >
                <span className="truncate flex-1">{mod.name}</span>
                <Badge variant="outline" className="text-[9px] h-3.5 px-1">{mod.fields.length}</Badge>
                <div className="flex items-center gap-0.5">
                  <Button variant="ghost" size="icon" className="w-5 h-5" onClick={(e) => { e.stopPropagation(); moveModule(mi, -1) }} disabled={mi === 0}>
                    <ChevronRight className="w-3 h-3 rotate-180" />
                  </Button>
                  <Button variant="ghost" size="icon" className="w-5 h-5" onClick={(e) => { e.stopPropagation(); moveModule(mi, 1) }} disabled={mi === sortedModules.length - 1}>
                    <ChevronRight className="w-3 h-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="w-5 h-5" onClick={(e) => { e.stopPropagation(); setEditingModule(mod); setShowModuleDialog(true) }}>
                    <Pencil className="w-3 h-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="w-5 h-5 text-red-400" onClick={(e) => { e.stopPropagation(); deleteModule(mod.id) }}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-2">
            <Button variant="outline" size="sm" className="flex-1 h-7 text-xs" onClick={addModule}>
              <Plus className="w-3 h-3 mr-1" /> 新建模块
            </Button>
            <Button variant="outline" size="sm" className="flex-1 h-7 text-xs border-teal-200 text-teal-600 hover:bg-teal-50" onClick={openLibraryDialog}>
              <Package className="w-3 h-3 mr-1" /> 从库导入
            </Button>
          </div>
        </div>
      </aside>

      {/* ========== 右侧：编辑区 + 预览 ========== */}
      <div className="flex-1 flex overflow-hidden">
        <main className="flex-1 flex flex-col overflow-hidden bg-slate-50">
          {selectedModule ? (
            <>
              {/* 顶部工具栏 */}
              <div className="px-5 py-3 bg-white border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h2 className="font-semibold text-slate-800">{selectedModule.name}</h2>
                  <Badge variant="outline" className="text-xs">{selectedModule.fields.length} 字段</Badge>
                  {selectedVisit && (
                    <span className="text-xs text-slate-400">所属访视: {selectedVisit.name}</span>
                  )}
                </div>
              </div>

              {/* 字段类型快捷添加 */}
              <div className="px-5 py-2 bg-white border-b border-slate-100 flex items-center gap-1 flex-wrap">
                <span className="text-xs text-slate-400 mr-2">添加字段:</span>
                {Object.keys(FIELD_TYPE_LABELS).map((type) => (
                  <Button key={type} variant="outline" size="sm" className="h-7 text-xs" onClick={() => addField(type)}>
                    {FIELD_TYPE_ICONS[type]} <span className="ml-1">{FIELD_TYPE_LABELS[type]}</span>
                  </Button>
                ))}
              </div>

              {/* 字段列表 */}
              <div className="flex-1 overflow-y-auto p-5">
                {[...selectedModule.fields].sort((a, b) => a.order - b.order).map((f, fi) => (
                  <div key={f.id} className="bg-white rounded-lg border border-slate-200 p-4 mb-3 hover:shadow-sm transition-shadow">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400">{FIELD_TYPE_ICONS[f.type]}</span>
                        <span className="font-medium text-sm">{f.label}</span>
                        <span className="text-xs text-slate-400 font-mono">{f.name}</span>
                        {f.validation?.required && <Badge variant="outline" className="text-[10px] h-4 text-red-500 border-red-200">必填</Badge>}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="w-6 h-6" onClick={() => moveField(fi, -1)} disabled={fi === 0}>
                          <ChevronRight className="w-3 h-3 rotate-180" />
                        </Button>
                        <Button variant="ghost" size="icon" className="w-6 h-6" onClick={() => moveField(fi, 1)} disabled={fi === selectedModule.fields.length - 1}>
                          <ChevronRight className="w-3 h-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="w-6 h-6" onClick={() => { setEditingField(f); setShowFieldDialog(true) }}>
                          <Pencil className="w-3 h-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="w-6 h-6 text-red-500" onClick={() => deleteField(f.id)}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>

                    {/* 字段预览 */}
                    <div className="bg-slate-50 rounded-md p-3">
                      <CRFFormRenderer sections={[]} fields={[f]} readOnly />
                    </div>
                  </div>
                ))}

                {selectedModule.fields.length === 0 && (
                  <div className="text-center py-16">
                    <p className="text-slate-400 text-sm">该模块暂无字段，点击上方按钮添加</p>
                  </div>
                )}
              </div>
            </>
          ) : selectedVisit ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <p className="text-slate-500 mb-2">已选择访视: {selectedVisit.name}</p>
                <p className="text-xs text-slate-400">请从左侧展开访视并选择一个模块进行编辑</p>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <p className="text-slate-500">请从左侧选择一个访视或模块</p>
              </div>
            </div>
          )}
        </main>

        {/* ========== 预览侧栏（仅当选中模块时显示） ========== */}
        {selectedModule && (
          <>
            {/* 拖拽分割条 */}
            {!previewCollapsed && (
              <div
                className="w-1.5 cursor-col-resize hover:bg-teal-400/40 active:bg-teal-400 transition-colors flex-shrink-0"
                onMouseDown={handlePreviewResizeStart}
                title="拖拽调整预览面板宽度"
              />
            )}

            {/* 预览面板 */}
            {previewCollapsed ? (
              <div className="w-9 border-l border-slate-100 bg-slate-50 flex flex-col items-center py-2 flex-shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-7 h-7 text-slate-400 hover:text-teal-600"
                  onClick={() => setPreviewCollapsed(false)}
                  title="展开预览"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-[10px] text-slate-400 mt-2" style={{ writingMode: 'vertical-rl' }}>
                  实时预览
                </span>
              </div>
            ) : (
              <aside
                className="border-l border-slate-100 bg-slate-50 flex flex-col flex-shrink-0 transition-all"
                style={{ width: previewWidth }}
              >
                <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500">实时预览</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-slate-400">
                      {selectedModule.fields.length} 个字段
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-5 h-5 text-slate-400 hover:text-teal-600"
                      onClick={() => setPreviewCollapsed(true)}
                      title="收起预览"
                    >
                      <ChevronRight className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-4">
                  {selectedModule.fields.length === 0 ? (
                    <div className="text-center py-12">
                      <Eye className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      <p className="text-xs text-slate-400">添加字段后将在此预览</p>
                    </div>
                  ) : (
                    <div className="bg-white rounded-lg border border-slate-200 p-5">
                      <h4 className="text-sm font-semibold text-slate-700 mb-4">{selectedModule.name}</h4>
                      <CRFFormRenderer
                        sections={[]}
                        fields={selectedModule.fields}
                        onChange={(data) => {
                          console.log('preview data', data)
                        }}
                      />
                    </div>
                  )}
                </div>
              </aside>
            )}
          </>
        )}
      </div>

      {/* ========== 弹窗 ========== */}
      {/* 字段编辑 */}
      {editingField && showFieldDialog && (
        <FieldEditDialog
          open={showFieldDialog}
          onOpenChange={setShowFieldDialog}
          field={editingField}
          onSave={saveField}
        />
      )}

      {/* 访视编辑 */}
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

      {/* 模块编辑 */}
      {editingModule && (
        <Dialog open={showModuleDialog} onOpenChange={setShowModuleDialog}>
          <DialogContent>
            <DialogHeader><DialogTitle>编辑模块</DialogTitle></DialogHeader>
            <div className="space-y-3 py-2">
              <div><Label className="text-sm">模块名称</Label><Input value={editingModule.name} onChange={(e) => setEditingModule({ ...editingModule, name: e.target.value })} /></div>
              <div><Label className="text-sm">描述</Label><Input value={editingModule.description || ''} onChange={(e) => setEditingModule({ ...editingModule, description: e.target.value })} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowModuleDialog(false)}>取消</Button>
              <Button className="bg-teal-500 hover:bg-teal-600" onClick={() => saveModule(editingModule)}>保存</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ========== 模块库导入弹窗 ========== */}
      <Dialog open={showLibraryDialog} onOpenChange={setShowLibraryDialog}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="w-5 h-5 text-teal-600" />
              从模块库导入
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* 搜索 + 分类 */}
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Input
                  placeholder="搜索模块..."
                  value={librarySearch}
                  onChange={(e) => setLibrarySearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="flex items-center gap-1">
                {libraryCategories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setLibraryCategory(cat)}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
                      libraryCategory === cat
                        ? 'bg-teal-500 text-white'
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* 模块列表 */}
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {filteredLibrary.length === 0 ? (
                <div className="text-center py-8 text-sm text-slate-400">
                  未找到匹配的模块
                </div>
              ) : (
                filteredLibrary.map((mod) => {
                  const isSelected = selectedLibraryModuleIds.has(mod.id)
                  return (
                    <div
                      key={mod.id}
                      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                        isSelected
                          ? 'border-teal-500 bg-teal-50'
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                      onClick={() => toggleLibraryModuleSelect(mod.id)}
                    >
                      <div className="mt-0.5">
                        {isSelected ? (
                          <div className="w-5 h-5 rounded bg-teal-500 flex items-center justify-center">
                            <Check className="w-3.5 h-3.5 text-white" />
                          </div>
                        ) : (
                          <div className="w-5 h-5 rounded border-2 border-slate-300" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm text-slate-800">{mod.name}</span>
                          <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{mod.category}</Badge>
                          {mod.isSystem && (
                            <Badge variant="outline" className="text-[10px] h-4 px-1 bg-amber-50 text-amber-600 border-amber-200">系统</Badge>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">{mod.description || '暂无描述'}</p>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {mod.fields.slice(0, 5).map((f) => (
                            <Badge key={f.id} variant="outline" className="text-[9px] h-4 px-1 bg-white">
                              {f.label}
                            </Badge>
                          ))}
                          {mod.fields.length > 5 && (
                            <span className="text-[9px] text-slate-400">+{mod.fields.length - 5} 个字段</span>
                          )}
                        </div>
                      </div>
                      <div className="text-xs text-slate-400 flex-shrink-0">
                        {mod.fields.length} 字段
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
          <DialogFooter className="flex items-center justify-between">
            <span className="text-sm text-slate-500">
              已选择 {selectedLibraryModuleIds.size} 个模块
            </span>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowLibraryDialog(false)}>取消</Button>
              <Button
                className="bg-teal-500 hover:bg-teal-600"
                onClick={importFromLibrary}
                disabled={selectedLibraryModuleIds.size === 0}
              >
                <Copy className="w-3.5 h-3.5 mr-1" />
                导入到项目
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ==================== 字段编辑弹窗 ====================
function FieldEditDialog({ open, onOpenChange, field, onSave }: {
  open: boolean; onOpenChange: (v: boolean) => void; field: CRFField; onSave: (f: CRFField) => void
}) {
  const [f, setF] = useState<CRFField>(field)
  const needsOptions = f.type === 'select' || f.type === 'radio' || f.type === 'checkbox'

  const addOption = () => setF({ ...f, options: [...(f.options || []), { label: `选项${(f.options?.length || 0) + 1}`, value: `opt${(f.options?.length || 0) + 1}` }] })
  const updateOption = (idx: number, key: 'label' | 'value', val: string) => {
    const opts = [...(f.options || [])]; opts[idx] = { ...opts[idx], [key]: val }; setF({ ...f, options: opts })
  }
  const removeOption = (idx: number) => {
    const opts = [...(f.options || [])]; opts.splice(idx, 1); setF({ ...f, options: opts })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>编辑字段</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div><Label className="text-sm">字段标签</Label><Input value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} /></div>
          <div><Label className="text-sm">字段标识 (name)</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
          <div><Label className="text-sm">占位提示</Label><Input value={f.placeholder || ''} onChange={(e) => setF({ ...f, placeholder: e.target.value })} /></div>
          <div><Label className="text-sm">帮助说明</Label><Input value={f.helpText || ''} onChange={(e) => setF({ ...f, helpText: e.target.value })} /></div>
          <div className="border rounded-md p-3 space-y-2">
            <Label className="text-sm font-semibold">校验规则</Label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={!!f.validation?.required} onChange={(e) => setF({ ...f, validation: { ...f.validation, required: e.target.checked } })} />
              必填
            </label>
          </div>
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
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button className="bg-teal-500 hover:bg-teal-600" onClick={() => onSave(f)}>保存</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
