path = r'C:/Users/huawe/Documents/Kimi/Workspaces/CRF设计/crf-designer/src/pages/admin/ProjectCRFView.tsx'

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Step 1: Add onReorderModules prop to VisitModulesView definition
old_props = '''function VisitModulesView({
  visit,
  allModules,
  readOnly,
  onAddModule,
  onEditModule,
  onPreviewModule,
  onEditModuleInfo,
  onRemoveModule,
  onDeleteModule,
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
}) {'''

new_props = '''function VisitModulesView({
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
}) {'''

if old_props in content:
    content = content.replace(old_props, new_props)
    print('Step 1: Added onReorderModules prop.')
else:
    print('Step 1: Pattern not found!')

# Step 2: Add drag state and handlers inside VisitModulesView, after the modules const
old_after_modules = '''  const modules: CRFModule[] = visit.crfModuleIds
    .map((mid) => allModules.find((m) => m.id === mid))
    .filter(Boolean) as CRFModule[]'''

new_after_modules = '''  const modules: CRFModule[] = visit.crfModuleIds
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
  }'''

if old_after_modules in content:
    content = content.replace(old_after_modules, new_after_modules)
    print('Step 2: Added drag state and handlers.')
else:
    print('Step 2: Pattern not found!')

# Step 3: Add draggable attributes to module cards
old_card = '''                <div key={mod.id} className="bg-white rounded-lg border border-slate-200 p-5 hover:shadow-md transition-shadow">'''

new_card = '''                <div
                  key={mod.id}
                  draggable={!readOnly}
                  onDragStart={(e) => handleModuleDragStart(e, mod.id)}
                  onDragOver={(e) => handleModuleDragOver(e, mod.id)}
                  onDrop={(e) => handleModuleDrop(e, mod.id)}
                  onDragEnd={handleModuleDragEnd}
                  className={`bg-white rounded-lg border p-5 hover:shadow-md transition-shadow cursor-move ${
                    dragOverModuleId === mod.id ? 'border-teal-400 ring-1 ring-teal-100' : 'border-slate-200'
                  } ${dragModuleId === mod.id ? 'opacity-50' : ''}`}
                >'''

if old_card in content:
    content = content.replace(old_card, new_card)
    print('Step 3: Added draggable attributes to module cards.')
else:
    print('Step 3: Pattern not found!')

# Step 4: Add onReorderModules to the VisitModulesView call site
old_call = '''          <VisitModulesView
            visit={activeVisit}
            allModules={project.crfModules}
            readOnly={readOnly}
            onAddModule={() => setShowAddModuleDialog(true)}
            onEditModule={openModuleEditor}
            onPreviewModule={openModulePreview}
            onEditModuleInfo={(mod) => { setEditingModuleInfo(mod); setShowModuleInfoDialog(true) }}
            onRemoveModule={removeModuleFromVisit}
            onDeleteModule={deleteProjectModule}
          />'''

new_call = '''          <VisitModulesView
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
          />'''

if old_call in content:
    content = content.replace(old_call, new_call)
    print('Step 4: Added onReorderModules to call site.')
else:
    print('Step 4: Pattern not found!')

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print('Done.')
