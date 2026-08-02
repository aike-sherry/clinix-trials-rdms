path = r'C:/Users/huawe/Documents/Kimi/Workspaces/CRF设计/crf-designer/src/pages/admin/ModuleLibraryPage.tsx'

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add reorder methods to destructuring
old_destructure = '''  const {
    moduleLibrary,
    saveModuleLibraryItem,
    deleteModuleLibraryItem,
    addModuleLibraryField,
    updateModuleLibraryField,
    deleteModuleLibraryField,
  } = useAppStorage()'''

new_destructure = '''  const {
    moduleLibrary,
    saveModuleLibraryItem,
    deleteModuleLibraryItem,
    addModuleLibraryField,
    updateModuleLibraryField,
    deleteModuleLibraryField,
    reorderModuleLibrary,
    reorderModuleLibraryFields,
  } = useAppStorage()'''

if old_destructure in content:
    content = content.replace(old_destructure, new_destructure)
    print('Step 1: Added reorder methods to destructuring.')
else:
    print('Step 1: Pattern not found!')

# 2. Add drag state and handlers after handleDuplicateModule
old_after_dup = '''  const handleDuplicateModule = (module: ModuleLibraryItem) => {
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

  const isInlineEditing = (fieldId: string) => inlineEditingId === fieldId'''

new_after_dup = '''  const handleDuplicateModule = (module: ModuleLibraryItem) => {
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

  const isInlineEditing = (fieldId: string) => inlineEditingId === fieldId'''

if old_after_dup in content:
    content = content.replace(old_after_dup, new_after_dup)
    print('Step 2: Added drag handlers.')
else:
    print('Step 2: Pattern not found!')

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print('Done.')
