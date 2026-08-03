import { useState, useMemo } from 'react'
import { useAppStorage } from '@/hooks/useAppStorage'
import type { ModuleLibraryItem, CRFField, FieldType } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import CRFFormRenderer from '@/components/CRFFormRenderer'
import {
  Search,
  Plus,
  Package,
  Trash2,
  Edit3,
  GripVertical,
  Copy,
  FileText,
  Shield,
  Layers,
  Type,
  AlignLeft,
  Hash,
  Calendar,
  ListChecks,
  ToggleLeft,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  X,
  Check,
  Settings2,
  ArrowLeft,
  Table, SlidersHorizontal, ArrowLeftRight, Pen,
  Eye,
} from 'lucide-react'

const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: '文本',
  textarea: '多行文本',
  number: '数字',
  date: '日期',
  datetime: '日期时间',
  select: '下拉选择',
  radio: '单选',
  checkbox: '多选',
  toggle: '开关',
  label: '标签',
  table: '表格',
  scale: '量表评分',
  numberRange: '数值范围',
  signature: '电子签名',
}

const FIELD_TYPE_ICONS: Record<FieldType, React.ReactNode> = {
  text: <Type className="w-4 h-4" />,
  textarea: <AlignLeft className="w-4 h-4" />,
  number: <Hash className="w-4 h-4" />,
  date: <Calendar className="w-4 h-4" />,
  datetime: <Calendar className="w-4 h-4" />,
  select: <ListChecks className="w-4 h-4" />,
  radio: <ListChecks className="w-4 h-4" />,
  checkbox: <ListChecks className="w-4 h-4" />,
  toggle: <ToggleLeft className="w-4 h-4" />,
  label: <FileText className="w-4 h-4" />,
  table: <Table className="w-4 h-4" />,
  scale: <SlidersHorizontal className="w-4 h-4" />,
  numberRange: <ArrowLeftRight className="w-4 h-4" />,
  signature: <Pen className="w-4 h-4" />,
}
function genId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

function now() {
  return new Date().toISOString()
}

function toFieldName(label: string) {
  return label
    .trim()
    .replace(/[^\u4e00-\u9fa5a-zA-Z0-9\s]/g, '')
    .replace(/\s+/g, '_')
    .toLowerCase()
    .replace(/^[0-9]/, '_$&')
}

const CATEGORIES = ['全部', '基础信息', '检查', '安全', '用药', '其他']

export default function ModuleLibraryPage() {
  const {
    moduleLibrary,
    saveModuleLibraryItem,
    deleteModuleLibraryItem,
    addModuleLibraryField,
    updateModuleLibraryField,
    deleteModuleLibraryField,
    reorderModuleLibrary,
    reorderModuleLibraryFields,
  } = useAppStorage()

  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('全部')
  const [selectedModule, setSelectedModule] = useState<ModuleLibraryItem | null>(null)
  const [showModuleDialog, setShowModuleDialog] = useState(false)
  const [editingModule, setEditingModule] = useState<Partial<ModuleLibraryItem> | null>(null)

  const [inlineEditingId, setInlineEditingId] = useState<string | null>(null)
  const [inlineData, setInlineData] = useState<CRFField | null>(null)

  const [previewWidth, setPreviewWidth] = useState(420)
  const [previewCollapsed, setPreviewCollapsed] = useState(false)

  const filtered = useMemo(() => {
    return moduleLibrary.filter((m) => {
      const matchSearch =
        m.name.includes(search) ||
        m.description?.includes(search) ||
        m.category.includes(search)
      const matchCategory = activeCategory === '全部' || m.category === activeCategory
      return matchSearch && matchCategory
    })
  }, [moduleLibrary, search, activeCategory])

  const categories = useMemo(() => {
    const set = new Set(moduleLibrary.map((m) => m.category))
    return ['全部', ...Array.from(set)]
  }, [moduleLibrary])

  const handleCreateModule = () => {
    setEditingModule({ name: '', description: '', category: '其他', fields: [] })
    setShowModuleDialog(true)
  }

  const handleEditModule = (module: ModuleLibraryItem) => {
    setEditingModule({ ...module })
    setShowModuleDialog(true)
  }

  const handleSaveModule = () => {
    if (!editingModule?.name) return
    const item: ModuleLibraryItem = {
      id: editingModule.id || genId(),
      name: editingModule.name,
      description: editingModule.description,
      category: editingModule.category || '其他',
      fields: editingModule.fields || [],
      isSystem: false,
      createdAt: editingModule.createdAt || now(),
      updatedAt: now(),
    }
    saveModuleLibraryItem(item)
    setShowModuleDialog(false)
    setEditingModule(null)
    if (selectedModule?.id === item.id) setSelectedModule(item)
  }

  const handleDeleteModule = (id: string) => {
    if (!confirm('确定删除此模块？')) return
    deleteModuleLibraryItem(id)
    if (selectedModule?.id === id) setSelectedModule(null)
  }

  const handleAddFieldByType = (type: FieldType) => {
    if (!selectedModule) return
    const newField: CRFField = {
      id: genId(),
      type,
      label: FIELD_TYPE_LABELS[type],
      name: `field_${type}_${Date.now()}`,
      order: selectedModule.fields.length + 1,
    }
    if (type === 'select' || type === 'radio' || type === 'checkbox') {
      newField.options = [
        { label: '选项1', value: 'opt1' },
        { label: '选项2', value: 'opt2' },
      ]
    }
    addModuleLibraryField(selectedModule.id, newField)
    setSelectedModule((prev) => (prev ? { ...prev, fields: [...prev.fields, newField] } : null))
    setInlineEditingId(newField.id)
    setInlineData({ ...newField })
  }

  const handleStartInlineEdit = (field: CRFField) => {
    setInlineEditingId(field.id)
    setInlineData({ ...field })
  }

  const handleCancelInlineEdit = () => {
    setInlineEditingId(null)
    setInlineData(null)
  }

  const handleSaveInlineEdit = () => {
    if (!selectedModule || !inlineData) return
    if (!inlineData.label || !inlineData.name) return
    updateModuleLibraryField(selectedModule.id, inlineData)
    setSelectedModule((prev) =>
      prev
        ? { ...prev, fields: prev.fields.map((f) => (f.id === inlineData.id ? inlineData : f)) }
        : null
    )
    setInlineEditingId(null)
    setInlineData(null)
  }

  const handleDeleteField = (fieldId: string) => {
    if (!selectedModule) return
    if (!confirm('确定删除此字段？')) return
    deleteModuleLibraryField(selectedModule.id, fieldId)
    setSelectedModule((prev) =>
      prev ? { ...prev, fields: prev.fields.filter((f) => f.id !== fieldId) } : null
    )
    if (inlineEditingId === fieldId) {
      setInlineEditingId(null)
      setInlineData(null)
    }
  }

  const handleMoveField = (index: number, dir: number) => {
    if (!selectedModule) return
    const arr = [...selectedModule.fields].sort((a, b) => a.order - b.order)
    const ni = index + dir
    if (ni < 0 || ni >= arr.length) return
    const newArr = [...arr]
    ;[newArr[index], newArr[ni]] = [newArr[ni], newArr[index]]
    const reordered = newArr.map((f, i) => ({ ...f, order: i + 1 }))
    reordered.forEach((f) => updateModuleLibraryField(selectedModule.id, f))
    setSelectedModule((prev) => (prev ? { ...prev, fields: reordered } : null))
  }

  const handleDuplicateModule = (module: ModuleLibraryItem) => {
    const copy: ModuleLibraryItem = {
      ...module,
      id: genId(),
      name: module.name + ' (副本)',
      isSystem: false,
      fields: module.fields.map((f) => ({ ...f, id: genId() })),
      createdAt: now(),
      updatedAt: now(),
    }
    saveModuleLibraryItem(copy)
  }

  // ========== 模块拖拽排序 ==========
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
    const fromIndex = filtered.findIndex((m) => m.id === dragModuleId)
    const toIndex = filtered.findIndex((m) => m.id === targetId)
    if (fromIndex === -1 || toIndex === -1) {
      setDragModuleId(null)
      setDragOverModuleId(null)
      return
    }
    const newOrder = [...filtered]
    const [moved] = newOrder.splice(fromIndex, 1)
    newOrder.splice(toIndex, 0, moved)
    reorderModuleLibrary(newOrder)
    setDragModuleId(null)
    setDragOverModuleId(null)
  }

  const handleModuleDragEnd = () => {
    setDragModuleId(null)
    setDragOverModuleId(null)
  }

  // ========== 字段拖拽排序 ==========
  const [dragFieldId, setDragFieldId] = useState<string | null>(null)

  const handleFieldDragStart = (e: React.DragEvent, fieldId: string) => {
    setDragFieldId(fieldId)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', fieldId)
  }

  const handleFieldDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleFieldDrop = (e: React.DragEvent, targetFieldId: string) => {
    e.preventDefault()
    if (!dragFieldId || !selectedModule || dragFieldId === targetFieldId) {
      setDragFieldId(null)
      return
    }
    const arr = [...selectedModule.fields].sort((a, b) => a.order - b.order)
    const fromIndex = arr.findIndex((f) => f.id === dragFieldId)
    const toIndex = arr.findIndex((f) => f.id === targetFieldId)
    if (fromIndex === -1 || toIndex === -1) {
      setDragFieldId(null)
      return
    }
    const newArr = [...arr]
    const [moved] = newArr.splice(fromIndex, 1)
    newArr.splice(toIndex, 0, moved)
    const reordered = newArr.map((f, i) => ({ ...f, order: i + 1 }))
    reorderModuleLibraryFields(selectedModule.id, reordered)
    setSelectedModule((prev) => (prev ? { ...prev, fields: reordered } : null))
    setDragFieldId(null)
  }

  const handleFieldDragEnd = () => {
    setDragFieldId(null)
  }

  // ========== 预览面板拖拽调整宽度 ==========
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

  const isInlineEditing = (fieldId: string) => inlineEditingId === fieldId

  return (
    <div className="space-y-5">
      {/* 标题栏 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Package className="w-5 h-5 text-teal-600" />
            模块库
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">管理可复用的 CRF 模块，支持拖拽组合到访视中</p>
        </div>
        <Button className="bg-teal-500 hover:bg-teal-600" onClick={handleCreateModule}>
          <Plus className="w-4 h-4 mr-1" /> 新建模块
        </Button>
      </div>

      {/* 搜索与分类 */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="搜索模块名称/描述/分类..."
            className="pl-9 pr-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              onClick={() => setSearch('')}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                activeCategory === cat
                  ? 'bg-teal-500 text-white'
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* 主体：模块列表 + 详情 */}
      <div className="flex gap-5" style={{ minHeight: 'calc(100vh - 280px)' }}>
        {/* 左侧：模块卡片列表 */}
        <div
          className={
            selectedModule
              ? 'w-[380px] flex-shrink-0 space-y-3'
              : 'w-full grid grid-cols-4 gap-3 content-start'
          }
        >
          {/* 返回全部按钮（当选中模块时显示） */}
          {selectedModule && (
            <button
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-500 hover:text-teal-600 hover:bg-teal-50 transition-colors border border-dashed border-slate-200 hover:border-teal-300"
              onClick={() => setSelectedModule(null)}
            >
              <ArrowLeft className="w-4 h-4" />
              返回全部模块
            </button>
          )}

          {filtered.length === 0 ? (
            <div className={selectedModule ? '' : 'col-span-4'}>
              <div className="text-center py-16 bg-white rounded-lg border border-dashed border-slate-300">
                <Package className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500">暂无模块，点击上方按钮创建</p>
              </div>
            </div>
          ) : (
            filtered.map((module) =>
              selectedModule ? (
                // 选中状态：横向列表卡片
                <Card
                  key={module.id}
                  draggable
                  onDragStart={(e) => handleModuleDragStart(e, module.id)}
                  onDragOver={(e) => handleModuleDragOver(e, module.id)}
                  onDrop={(e) => handleModuleDrop(e, module.id)}
                  onDragEnd={handleModuleDragEnd}
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    selectedModule?.id === module.id
                      ? 'ring-2 ring-teal-500 border-teal-500'
                      : ''
                  } ${dragOverModuleId === module.id ? 'border-teal-400 bg-teal-50/30' : ''} ${dragModuleId === module.id ? 'opacity-50' : ''}`}
                  onClick={() =>
                    setSelectedModule((prev) =>
                      prev?.id === module.id ? null : module
                    )
                  }
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-teal-50 flex items-center justify-center flex-shrink-0">
                          <Layers className="w-4 h-4 text-teal-600" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-slate-800 text-sm">{module.name}</h3>
                            {module.isSystem && (
                              <Badge variant="outline" className="text-[10px] h-4 px-1 bg-amber-50 text-amber-600 border-amber-200">
                                <Shield className="w-2.5 h-2.5 mr-0.5" /> 系统
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">
                            {module.description || '暂无描述'}
                          </p>
                          <div className="flex items-center gap-2 mt-1.5">
                            <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                              {module.category}
                            </Badge>
                            <span className="text-[10px] text-slate-400">
                              {module.fields.length} 个字段
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="w-7 h-7 text-slate-400 hover:text-teal-600"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDuplicateModule(module)
                          }}
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </Button>
                        {!module.isSystem && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="w-7 h-7 text-slate-400 hover:text-red-500"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteModule(module.id)
                            }}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                // 未选中状态：网格卡片（每行2个）
                <Card
                  key={module.id}
                  className="cursor-pointer transition-all hover:shadow-md"
                  onClick={() => setSelectedModule(module)}
                >
                  <CardContent className="p-4 flex flex-col items-center text-center">
                    {/* 大图标 */}
                    <div className="w-12 h-12 rounded-xl bg-teal-50 flex items-center justify-center mb-3">
                      <Layers className="w-6 h-6 text-teal-600" />
                    </div>

                    {/* 模块名称 */}
                    <div className="flex items-center gap-1.5 mb-1">
                      <h3 className="font-semibold text-slate-800 text-sm truncate max-w-[120px]">
                        {module.name}
                      </h3>
                      {module.isSystem && (
                        <Badge variant="outline" className="text-[10px] h-4 px-1 bg-amber-50 text-amber-600 border-amber-200 flex-shrink-0">
                          <Shield className="w-2.5 h-2.5 mr-0.5" /> 系统
                        </Badge>
                      )}
                    </div>

                    {/* 描述 */}
                    <p className="text-xs text-slate-400 line-clamp-1 mb-2.5">
                      {module.description || '暂无描述'}
                    </p>

                    {/* 底部信息 */}
                    <div className="flex items-center gap-2 mt-auto">
                      <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                        {module.category}
                      </Badge>
                      <span className="text-[10px] text-slate-400">
                        {module.fields.length} 个字段
                      </span>
                    </div>

                    {/* 操作按钮 */}
                    <div className="flex items-center gap-1 mt-2 pt-2 border-t border-slate-100 w-full justify-center">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="w-6 h-6 text-slate-400 hover:text-teal-600"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDuplicateModule(module)
                        }}
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                      {!module.isSystem && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="w-6 h-6 text-slate-400 hover:text-red-500"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteModule(module.id)
                          }}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            )
          )}
        </div>

        {/* 右侧：模块设计器 */}
        {selectedModule && (
          <div className="flex-1 bg-white rounded-lg border border-slate-200 flex flex-col overflow-hidden">
            {/* 顶部模块信息 */}
            <div className="px-5 py-4 border-b border-slate-100 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-slate-800">{selectedModule.name}</h2>
                  {selectedModule.isSystem && (
                    <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200">
                      <Shield className="w-3 h-3 mr-1" /> 系统预置
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-slate-400 mt-1">{selectedModule.description || '暂无描述'}</p>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="secondary">{selectedModule.category}</Badge>
                  <span className="text-xs text-slate-400">
                    {selectedModule.fields.length} 个字段
                  </span>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleEditModule(selectedModule)}
              >
                <Edit3 className="w-3.5 h-3.5 mr-1" /> 编辑信息
              </Button>
            </div>

            {/* 字段设计区：左侧组件库 + 中间设计画布 + 右侧实时预览 */}
            <div className="flex-1 flex">
              {/* 左侧：字段类型组件库 */}
              <aside className="w-44 border-r border-slate-100 bg-slate-50 flex flex-col flex-shrink-0 sticky top-0 self-start h-fit max-h-full overflow-y-auto">
                <div className="px-3 py-2.5 border-b border-slate-100">
                  <span className="text-xs font-semibold text-slate-500">字段组件</span>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                  {(Object.keys(FIELD_TYPE_LABELS) as FieldType[]).map((type) => (
                    <button
                      key={type}
                      className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm text-slate-600 hover:bg-white hover:shadow-sm hover:text-teal-600 transition-all border border-transparent hover:border-slate-200"
                      onClick={() => handleAddFieldByType(type)}
                    >
                      <span className="text-slate-400">{FIELD_TYPE_ICONS[type]}</span>
                      <span>{FIELD_TYPE_LABELS[type]}</span>
                    </button>
                  ))}
                </div>
              </aside>

              {/* 中间：字段设计画布 */}
              <main className="flex-1 overflow-y-auto bg-white p-4 min-w-0">
                {selectedModule.fields.length === 0 ? (
                  <div className="text-center py-16">
                    <div className="w-14 h-14 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-3">
                      <FileText className="w-6 h-6 text-slate-300" />
                    </div>
                    <p className="text-sm text-slate-400 mb-1">暂无字段</p>
                    <p className="text-xs text-slate-300">点击左侧字段组件开始设计</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-w-2xl mx-auto">
                    {selectedModule.fields
                      .slice()
                      .sort((a, b) => a.order - b.order)
                      .map((field, idx, arr) => {
                        const isEditing = isInlineEditing(field.id)
                        return (
                          <div
                            key={field.id}
                            draggable={!isEditing}
                            onDragStart={(e) => handleFieldDragStart(e, field.id)}
                            onDragOver={handleFieldDragOver}
                            onDrop={(e) => handleFieldDrop(e, field.id)}
                            onDragEnd={handleFieldDragEnd}
                            className={`group border rounded-lg transition-all bg-white ${
                              isEditing
                                ? 'border-teal-400 shadow-md ring-1 ring-teal-100'
                                : 'border-slate-200 hover:border-teal-300 hover:shadow-sm'
                            } ${dragFieldId === field.id ? 'opacity-50' : ''}`}
                          >
                            {/* 字段头部 */}
                            <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-50 bg-slate-50/50 rounded-t-lg">
                              <div className="flex items-center gap-2.5">
                                <GripVertical className="w-3.5 h-3.5 text-slate-300" />
                                <span className="text-xs text-slate-400 font-mono">#{idx + 1}</span>
                                <span className="text-slate-400">{FIELD_TYPE_ICONS[field.type]}</span>
                                <span className="font-medium text-sm text-slate-700">{field.label}</span>
                                {field.validation?.required && (
                                  <span className="text-red-400 text-xs">*</span>
                                )}
                                <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                                  {FIELD_TYPE_LABELS[field.type]}
                                </Badge>
                                <span className="text-xs text-slate-400 font-mono">{field.name}</span>
                              </div>
                              <div className="flex items-center gap-0.5">
                                {isEditing ? (
                                  <>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="w-6 h-6 text-red-400 hover:text-red-600 hover:bg-red-50"
                                      onClick={handleCancelInlineEdit}
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="w-6 h-6 text-teal-600 hover:text-teal-700 hover:bg-teal-50"
                                      onClick={handleSaveInlineEdit}
                                    >
                                      <Check className="w-3.5 h-3.5" />
                                    </Button>
                                  </>
                                ) : (
                                  <>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="w-6 h-6"
                                      onClick={() => handleMoveField(idx, -1)}
                                      disabled={idx === 0}
                                    >
                                      <ChevronUp className="w-3 h-3" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="w-6 h-6"
                                      onClick={() => handleMoveField(idx, 1)}
                                      disabled={idx === arr.length - 1}
                                    >
                                      <ChevronDown className="w-3 h-3" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="w-6 h-6 text-slate-400 hover:text-teal-600"
                                      onClick={() => handleStartInlineEdit(field)}
                                    >
                                      <Settings2 className="w-3 h-3" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="w-6 h-6 text-slate-400 hover:text-red-500"
                                      onClick={() => handleDeleteField(field.id)}
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </Button>
                                  </>
                                )}
                              </div>
                            </div>

                            {/* 字段内容区：行内编辑（预览移到右侧面板） */}
                            {isEditing && inlineData ? (
                              <FieldInlineEditor
                                field={inlineData}
                                onChange={setInlineData}
                              />
                            ) : (
                              <div className="px-4 py-3 text-xs text-slate-400">
                                {field.type === 'table'
                                  ? `表格字段 · ${field.columns?.length || 0} 列`
                                  : field.type === 'select' || field.type === 'radio' || field.type === 'checkbox'
                                  ? `选项：${field.options?.map((o) => o.label).join('、') || '无'}`
                                  : field.placeholder || '点击设置图标编辑字段'}
                              </div>
                            )}
                          </div>
                        )
                      })}
                  </div>
                )}
              </main>

              {/* 拖拽分割条 */}
              {!previewCollapsed && (
                <div
                  className="w-1.5 cursor-col-resize hover:bg-teal-400/40 active:bg-teal-400 transition-colors flex-shrink-0"
                  onMouseDown={handlePreviewResizeStart}
                  title="拖拽调整预览面板宽度"
                />
              )}

              {/* 右侧：实时预览 */}
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
                            // 预览模式不保存数据，仅展示交互效果
                            console.log('preview data', data)
                          }}
                        />
                      </div>
                    )}
                  </div>
                </aside>
              )}
            </div>
</div>
        )}
      </div>

      {/* 模块信息编辑弹窗 */}
      <Dialog open={showModuleDialog} onOpenChange={setShowModuleDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingModule?.id ? '编辑模块' : '新建模块'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-sm">模块名称 <span className="text-red-500">*</span></Label>
              <Input
                placeholder="如：生命体征"
                value={editingModule?.name || ''}
                onChange={(e) => setEditingModule((prev) => (prev ? { ...prev, name: e.target.value } : null))}
              />
            </div>
            <div>
              <Label className="text-sm">分类 <span className="text-red-500">*</span></Label>
              <Select
                value={editingModule?.category || '其他'}
                onValueChange={(v) =>
                  setEditingModule((prev) => (prev ? { ...prev, category: v } : null))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.filter((c) => c !== '全部').map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm">描述</Label>
              <Textarea
                placeholder="模块用途描述..."
                rows={3}
                value={editingModule?.description || ''}
                onChange={(e) =>
                  setEditingModule((prev) => (prev ? { ...prev, description: e.target.value } : null))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModuleDialog(false)}>
              取消
            </Button>
            <Button
              className="bg-teal-500 hover:bg-teal-600"
              onClick={handleSaveModule}
              disabled={!editingModule?.name}
            >
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ==================== 行内字段编辑器组件 ====================

function FieldInlineEditor({
  field,
  onChange,
}: {
  field: CRFField
  onChange: (f: CRFField) => void
}) {
  const update = (partial: Partial<CRFField>) => {
    onChange({ ...field, ...partial })
  }

  const updateShowIf = (partial: Partial<NonNullable<CRFField['showIf']>>) => {
    onChange({
      ...field,
      showIf: { ...(field.showIf || { fieldName: '', operator: 'equals' }), ...partial },
    })
  }

  const clearShowIf = () => {
    const { showIf: _, ...rest } = field
    onChange(rest as CRFField)
  }

  const updateValidation = (partial: Partial<NonNullable<CRFField['validation']>>) => {
    onChange({
      ...field,
      validation: { ...field.validation, ...partial },
    })
  }

  const hasOptions = field.type === 'select' || field.type === 'radio' || field.type === 'checkbox'
  const isNumber = field.type === 'number'
  const isText = field.type === 'text' || field.type === 'textarea'
  const isTable = field.type === 'table'
  return (
    <div className="p-4 space-y-4 bg-slate-50/50">
      {/* 基础信息 */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs text-slate-500 mb-1 block">字段标签 <span className="text-red-500">*</span></Label>
          <Input
            size-compact
            className="h-8 text-sm"
            placeholder="如：收缩压"
            value={field.label}
            onChange={(e) => {
              const label = e.target.value
              const autoSync = field.name.startsWith('field_')
              update({ label, ...(autoSync ? { name: toFieldName(label) } : {}) })
            }}
          />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <Label className="text-xs text-slate-500">字段名 <span className="text-red-500">*</span></Label>
            <button
              className="text-[10px] text-teal-600 hover:underline"
              onClick={() => update({ name: toFieldName(field.label) })}
            >
              根据标签生成
            </button>
          </div>
          <Input
            className="h-8 text-sm"
            placeholder="如：systolic_bp"
            value={field.name}
            onChange={(e) => update({ name: e.target.value })}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs text-slate-500 mb-1 block">字段类型</Label>
          <Select
            value={field.type}
            onValueChange={(v) => {
              const newType = v as FieldType
              const updates: Partial<CRFField> = { type: newType }
              if (newType === 'select' || newType === 'radio' || newType === 'checkbox') {
                if (!field.options || field.options.length === 0) {
                  updates.options = [
                    { label: '选项1', value: 'opt1' },
                    { label: '选项2', value: 'opt2' },
                  ]
                }
              }
              if (newType === 'table') {
                if (!field.columns || field.columns.length === 0) {
                  updates.columns = [
                    { id: genId(), type: 'text', label: '列1', name: 'col1', order: 0 },
                  ]
                }
              }
              if (newType === 'scale') {
                if (!field.scaleConfig) {
                  updates.scaleConfig = {
                    min: 0,
                    max: 10,
                    step: 1,
                    labels: [
                      { value: 0, label: '无痛' },
                      { value: 10, label: '剧痛' },
                    ],
                  }
                }
              }
              if (newType !== 'number') {
                updates.validation = { ...field.validation, min: undefined, max: undefined }
              }
              if (!['text', 'textarea'].includes(newType)) {
                updates.validation = { ...field.validation, minLength: undefined, maxLength: undefined }
              }
              onChange({ ...field, ...updates })
            }}
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(FIELD_TYPE_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-slate-500 mb-1 block">占位提示</Label>
          <Input
            className="h-8 text-sm"
            placeholder="输入框提示..."
            value={field.placeholder || ''}
            onChange={(e) => update({ placeholder: e.target.value })}
          />
        </div>
      </div>

      {isNumber && (
        <div>
          <Label className="text-xs text-slate-500 mb-1 block">单位</Label>
          <Input
            className="h-8 text-sm"
            placeholder="如：年、mmHg、kg..."
            value={field.unit || ''}
            onChange={(e) => update({ unit: e.target.value })}
          />
        </div>
      )}

      <div>
        <Label className="text-xs text-slate-500 mb-1 block">帮助说明</Label>
        <Input
          className="h-8 text-sm"
          placeholder="字段填写说明，显示在输入框下方..."
          value={field.helpText || ''}
          onChange={(e) => update({ helpText: e.target.value })}
        />
      </div>

      {/* 验证规则 */}
      <div className="border border-slate-200 rounded-md p-3 space-y-3 bg-white">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
          <Shield className="w-3.5 h-3.5" />
          验证规则
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <label className="flex items-center gap-1.5 text-sm text-slate-600">
            <input
              type="checkbox"
              className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
              checked={field.validation?.required || false}
              onChange={(e) => updateValidation({ required: e.target.checked })}
            />
            必填
          </label>

          {isText && (
            <>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-500">最小长度</span>
                <Input
                  type="number"
                  className="w-16 h-7 text-xs px-2"
                  value={field.validation?.minLength ?? ''}
                  onChange={(e) => updateValidation({ minLength: e.target.value ? Number(e.target.value) : undefined })}
                />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-500">最大长度</span>
                <Input
                  type="number"
                  className="w-16 h-7 text-xs px-2"
                  value={field.validation?.maxLength ?? ''}
                  onChange={(e) => updateValidation({ maxLength: e.target.value ? Number(e.target.value) : undefined })}
                />
              </div>
            </>
          )}

          {isNumber && (
            <>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-500">最小值</span>
                <Input
                  type="number"
                  className="w-20 h-7 text-xs px-2"
                  value={field.validation?.min ?? ''}
                  onChange={(e) => updateValidation({ min: e.target.value ? Number(e.target.value) : undefined })}
                />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-500">最大值</span>
                <Input
                  type="number"
                  className="w-20 h-7 text-xs px-2"
                  value={field.validation?.max ?? ''}
                  onChange={(e) => updateValidation({ max: e.target.value ? Number(e.target.value) : undefined })}
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* 量表配置 */}
      {field.type === 'scale' && (
        <div className="border border-slate-200 rounded-md p-3 space-y-3 bg-white">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
            <SlidersHorizontal className="w-3.5 h-3.5" />
            量表配置
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-[10px] text-slate-400 mb-0.5 block">最小值</Label>
              <Input
                type="number"
                className="h-7 text-xs"
                value={field.scaleConfig?.min ?? 0}
                onChange={(e) => {
                  const v = Number(e.target.value)
                  update({
                    scaleConfig: { ...(field.scaleConfig || { min: 0, max: 10, step: 1 }), min: v },
                  })
                }}
              />
            </div>
            <div>
              <Label className="text-[10px] text-slate-400 mb-0.5 block">最大值</Label>
              <Input
                type="number"
                className="h-7 text-xs"
                value={field.scaleConfig?.max ?? 10}
                onChange={(e) => {
                  const v = Number(e.target.value)
                  update({
                    scaleConfig: { ...(field.scaleConfig || { min: 0, max: 10, step: 1 }), max: v },
                  })
                }}
              />
            </div>
            <div>
              <Label className="text-[10px] text-slate-400 mb-0.5 block">步长</Label>
              <Input
                type="number"
                className="h-7 text-xs"
                value={field.scaleConfig?.step ?? 1}
                onChange={(e) => {
                  const v = Number(e.target.value)
                  update({
                    scaleConfig: { ...(field.scaleConfig || { min: 0, max: 10, step: 1 }), step: v },
                  })
                }}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-500">刻度标签（可选）</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-5 px-1.5 text-[10px] text-teal-600"
                onClick={() => {
                  const labels = [...(field.scaleConfig?.labels || [])]
                  labels.push({ value: field.scaleConfig?.min || 0, label: '' })
                  update({
                    scaleConfig: { ...(field.scaleConfig || { min: 0, max: 10, step: 1 }), labels },
                  })
                }}
              >
                <Plus className="w-2.5 h-2.5 mr-0.5" /> 添加标签
              </Button>
            </div>
            {(field.scaleConfig?.labels || []).map((l, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Input
                  type="number"
                  className="h-6 text-[10px] w-16"
                  placeholder="值"
                  value={l.value}
                  onChange={(e) => {
                    const labels = [...(field.scaleConfig?.labels || [])]
                    labels[idx] = { ...labels[idx], value: Number(e.target.value) }
                    update({
                      scaleConfig: { ...(field.scaleConfig || { min: 0, max: 10, step: 1 }), labels },
                    })
                  }}
                />
                <Input
                  className="h-6 text-[10px] flex-1"
                  placeholder="标签文本，如：轻度疼痛"
                  value={l.label}
                  onChange={(e) => {
                    const labels = [...(field.scaleConfig?.labels || [])]
                    labels[idx] = { ...labels[idx], label: e.target.value }
                    update({
                      scaleConfig: { ...(field.scaleConfig || { min: 0, max: 10, step: 1 }), labels },
                    })
                  }}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-5 h-5 text-slate-400 hover:text-red-500"
                  onClick={() => {
                    const labels = (field.scaleConfig?.labels || []).filter((_, i) => i !== idx)
                    update({
                      scaleConfig: { ...(field.scaleConfig || { min: 0, max: 10, step: 1 }), labels },
                    })
                  }}
                >
                  <Trash2 className="w-2.5 h-2.5" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 条件显示 */}
      <div className="border border-slate-200 rounded-md p-3 space-y-3 bg-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
            <Eye className="w-3.5 h-3.5" />
            条件显示
          </div>
          <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer">
            <input
              type="checkbox"
              className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
              checked={!!field.showIf}
              onChange={(e) => {
                if (e.target.checked) {
                  updateShowIf({ fieldName: '', operator: 'equals' })
                } else {
                  clearShowIf()
                }
              }}
            />
            启用条件显示
          </label>
        </div>
        {field.showIf && (
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-[10px] text-slate-400 mb-0.5 block">依赖字段名</Label>
              <Input
                className="h-7 text-xs"
                placeholder="如：smoking_status"
                value={field.showIf.fieldName}
                onChange={(e) => updateShowIf({ fieldName: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-[10px] text-slate-400 mb-0.5 block">条件</Label>
              <select
                value={field.showIf.operator}
                onChange={(e) => updateShowIf({ operator: e.target.value as any })}
                className="h-7 text-xs w-full rounded border border-slate-200 px-2 bg-white"
              >
                <option value="equals">等于</option>
                <option value="notEquals">不等于</option>
                <option value="contains">包含</option>
                <option value="notEmpty">不为空</option>
              </select>
            </div>
            <div>
              <Label className="text-[10px] text-slate-400 mb-0.5 block">目标值</Label>
              <Input
                className="h-7 text-xs"
                placeholder="如：yes"
                value={field.showIf.value || ''}
                onChange={(e) => updateShowIf({ value: e.target.value })}
                disabled={field.showIf.operator === 'notEmpty'}
              />
            </div>
          </div>
        )}
        {!field.showIf && (
          <p className="text-[10px] text-slate-400">
            启用后，此字段仅在满足指定条件时才显示。例如：当「吸烟情况」等于「是」时才显示「吸烟量」字段。
          </p>
        )}
      </div>

      {/* 选项列表（选择类字段） */}
      {hasOptions && (
        <div className="border border-slate-200 rounded-md p-3 space-y-3 bg-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
              <ListChecks className="w-3.5 h-3.5" />
              选项列表
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => {
                const opts = field.options || []
                update({
                  options: [
                    ...opts,
                    { label: `选项${opts.length + 1}`, value: `opt${opts.length + 1}` },
                  ],
                })
              }}
            >
              <Plus className="w-3 h-3 mr-1" /> 添加选项
            </Button>
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {(field.options || []).map((opt, idx, arr) => (
              <div
                key={idx}
                className="p-2 rounded-md border border-slate-100 bg-slate-50/50 space-y-2"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 font-mono w-5 text-center flex-shrink-0">
                    {idx + 1}
                  </span>
                  <Input
                    placeholder="显示文本"
                    className="h-7 text-xs flex-1"
                    value={opt.label}
                    onChange={(e) => {
                      const newOpts = [...(field.options || [])]
                      newOpts[idx] = { ...newOpts[idx], label: e.target.value }
                      update({ options: newOpts })
                    }}
                  />
                  <Input
                    placeholder="值"
                    className="h-7 text-xs w-24"
                    value={opt.value}
                    onChange={(e) => {
                      const newOpts = [...(field.options || [])]
                      newOpts[idx] = { ...newOpts[idx], value: e.target.value }
                      update({ options: newOpts })
                    }}
                  />
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-5 h-5"
                    disabled={idx === 0}
                    onClick={() => {
                      const newOpts = [...(field.options || [])]
                      ;[newOpts[idx - 1], newOpts[idx]] = [newOpts[idx], newOpts[idx - 1]]
                      update({ options: newOpts })
                    }}
                  >
                    <ChevronUp className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-5 h-5"
                    disabled={idx === arr.length - 1}
                    onClick={() => {
                      const newOpts = [...(field.options || [])]
                      ;[newOpts[idx], newOpts[idx + 1]] = [newOpts[idx + 1], newOpts[idx]]
                      update({ options: newOpts })
                    }}
                  >
                    <ChevronDown className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-5 h-5 text-slate-400 hover:text-red-500"
                    onClick={() => {
                      const newOpts = (field.options || []).filter((_, i) => i !== idx)
                      update({ options: newOpts })
                    }}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
                </div>
                {/* 额外输入配置 */}
                <label className="flex items-center gap-1.5 pl-7 text-xs text-slate-500 cursor-pointer">
                  <input
                    type="checkbox"
                    className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                    checked={opt.hasExtraInput || false}
                    onChange={(e) => {
                      const newOpts = [...(field.options || [])]
                      newOpts[idx] = { ...newOpts[idx], hasExtraInput: e.target.checked }
                      update({ options: newOpts })
                    }}
                  />
                  选择此项后需要额外输入补充信息
                </label>
                {opt.hasExtraInput && (
                  <div className="flex items-center gap-2 pl-7">
                    <Input
                      placeholder="额外输入标签，如：吸烟量（支/天）"
                      className="h-7 text-xs flex-1"
                      value={opt.extraInputLabel || ''}
                      onChange={(e) => {
                        const newOpts = [...(field.options || [])]
                        newOpts[idx] = { ...newOpts[idx], extraInputLabel: e.target.value }
                        update({ options: newOpts })
                      }}
                    />
                    <Input
                      placeholder="占位提示"
                      className="h-7 text-xs w-28"
                      value={opt.extraInputPlaceholder || ''}
                      onChange={(e) => {
                        const newOpts = [...(field.options || [])]
                        newOpts[idx] = { ...newOpts[idx], extraInputPlaceholder: e.target.value }
                        update({ options: newOpts })
                      }}
                    />
                  </div>
                )}
              </div>
            ))}
            {(field.options || []).length === 0 && (
              <div className="text-center py-3 text-xs text-slate-400 border border-dashed border-slate-200 rounded-md">
                暂无选项，点击上方按钮添加
              </div>
            )}
          </div>
        </div>
      )}

      {/* 表格列配置 */}
      {isTable && (
        <div className="border border-slate-200 rounded-md p-3 space-y-3 bg-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
              <Table className="w-3.5 h-3.5" />
              表格列配置
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => {
                const cols = field.columns || []
                const newCol: CRFField = {
                  id: genId(),
                  type: 'text',
                  label: `列${cols.length + 1}`,
                  name: `col${cols.length + 1}`,
                  order: cols.length,
                }
                update({ columns: [...cols, newCol] })
              }}
            >
              <Plus className="w-3 h-3 mr-1" /> 添加列
            </Button>
          </div>
          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {(field.columns || []).map((col, idx, arr) => (
              <div key={col.id} className="space-y-1">
                {/* 列基础信息行 */}
                <div className="grid grid-cols-12 gap-2 items-center p-2 rounded-md border border-slate-100 bg-slate-50/50">
                  <span className="text-xs text-slate-400 font-mono w-5 text-center col-span-1">
                    {idx + 1}
                  </span>
                  <Input
                    placeholder="列标签"
                    className="h-7 text-xs col-span-3"
                    value={col.label}
                    onChange={(e) => {
                      const newCols = [...(field.columns || [])]
                      newCols[idx] = { ...newCols[idx], label: e.target.value }
                      update({ columns: newCols })
                    }}
                  />
                  <Input
                    placeholder="列标识"
                    className="h-7 text-xs col-span-3"
                    value={col.name}
                    onChange={(e) => {
                      const newCols = [...(field.columns || [])]
                      newCols[idx] = { ...newCols[idx], name: e.target.value }
                      update({ columns: newCols })
                    }}
                  />
                  <select
                    value={col.type}
                    onChange={(e) => {
                      const newType = e.target.value as FieldType
                      const newCols = [...(field.columns || [])]
                      const updates: Partial<CRFField> = { type: newType }
                      if (newType === 'select' && (!col.options || col.options.length === 0)) {
                        updates.options = [
                          { label: '是', value: 'yes' },
                          { label: '否', value: 'no' },
                        ]
                      }
                      newCols[idx] = { ...newCols[idx], ...updates }
                      update({ columns: newCols })
                    }}
                    className="h-7 text-xs col-span-3 rounded border border-slate-200 px-2 bg-white"
                  >
                    <option value="text">单行文本</option>
                    <option value="number">数字</option>
                    <option value="date">日期</option>
                    <option value="select">下拉选择</option>
                    <option value="textarea">多行文本</option>
                  </select>
                  <div className="col-span-2 flex items-center justify-end gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-5 h-5"
                      disabled={idx === 0}
                      onClick={() => {
                        const newCols = [...(field.columns || [])]
                        ;[newCols[idx - 1], newCols[idx]] = [newCols[idx], newCols[idx - 1]]
                        update({ columns: newCols })
                      }}
                    >
                      <ChevronUp className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-5 h-5"
                      disabled={idx === arr.length - 1}
                      onClick={() => {
                        const newCols = [...(field.columns || [])]
                        ;[newCols[idx], newCols[idx + 1]] = [newCols[idx + 1], newCols[idx]]
                        update({ columns: newCols })
                      }}
                    >
                      <ChevronDown className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-5 h-5 text-slate-400 hover:text-red-500"
                      onClick={() => {
                        const newCols = (field.columns || []).filter((_, i) => i !== idx)
                        update({ columns: newCols })
                      }}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>

                {/* 下拉选项配置（仅select类型显示） */}
                {col.type === 'select' && (
                  <div className="ml-6 p-2 rounded-md border border-slate-100 bg-white space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-slate-400">选项配置</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 px-1.5 text-[10px] text-teal-600"
                        onClick={() => {
                          const newCols = [...(field.columns || [])]
                          const opts = newCols[idx].options || []
                          newCols[idx] = {
                            ...newCols[idx],
                            options: [...opts, { label: `选项${opts.length + 1}`, value: `opt${opts.length + 1}` }],
                          }
                          update({ columns: newCols })
                        }}
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
                            onChange={(e) => {
                              const newCols = [...(field.columns || [])]
                              const opts = [...(newCols[idx].options || [])]
                              opts[oidx] = { ...opts[oidx], label: e.target.value }
                              newCols[idx] = { ...newCols[idx], options: opts }
                              update({ columns: newCols })
                            }}
                          />
                          <Input
                            placeholder="值"
                            className="h-6 text-[10px] w-16"
                            value={opt.value}
                            onChange={(e) => {
                              const newCols = [...(field.columns || [])]
                              const opts = [...(newCols[idx].options || [])]
                              opts[oidx] = { ...opts[oidx], value: e.target.value }
                              newCols[idx] = { ...newCols[idx], options: opts }
                              update({ columns: newCols })
                            }}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="w-5 h-5 text-slate-400 hover:text-red-500"
                            onClick={() => {
                              const newCols = [...(field.columns || [])]
                              const opts = (newCols[idx].options || []).filter((_, i) => i !== oidx)
                              newCols[idx] = { ...newCols[idx], options: opts }
                              update({ columns: newCols })
                            }}
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
            ))}          </div>
        </div>
      )}

      {/* 默认值 */}

      {/* 默认值 */}
      <div className="border border-slate-200 rounded-md p-3 space-y-2 bg-white">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
          <FileText className="w-3.5 h-3.5" />
          默认值
        </div>
        {field.type === 'toggle' ? (
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
              checked={!!field.defaultValue}
              onChange={(e) => update({ defaultValue: e.target.checked })}
            />
            默认开启
          </label>
        ) : field.type === 'checkbox' ? (
          <div className="text-xs text-slate-400">
            多选默认值请在选项中配置（暂不支持）
          </div>
        ) : (
          <Input
            className="h-8 text-sm"
            placeholder="默认值..."
            value={String(field.defaultValue ?? '')}
            onChange={(e) => update({ defaultValue: e.target.value })}
          />
        )}
      </div>
    </div>
  )
}
