import re

path = r"C:\Users\huawe\Documents\Kimi\Workspaces\CRF设计\crf-designer\src\pages\admin\ProjectCRFView.tsx"

with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. 添加模块信息编辑 state
old_state = """  const [showFieldDialog, setShowFieldDialog] = useState(false)
  const [editingField, setEditingField] = useState<CRFField | null>(null)"""

new_state = """  const [showFieldDialog, setShowFieldDialog] = useState(false)
  const [editingField, setEditingField] = useState<CRFField | null>(null)
  const [showModuleInfoDialog, setShowModuleInfoDialog] = useState(false)
  const [editingModuleInfo, setEditingModuleInfo] = useState<CRFModule | null>(null)"""

if old_state in content:
    content = content.replace(old_state, new_state)
    print("1. Added module info dialog state")
else:
    print("1. FAILED: could not find state block")

# 2. 添加 saveModuleInfo handler（在 deleteProjectModule 之后）
old_handler = """  const deleteProjectModule = (moduleId: string) => {
    if (readOnly) return
    if (!confirm('确定删除此模块？该模块将从所有访视中移除，且字段数据将丢失。')) return
    onUpdate((p) => ({
      ...p,
      crfModules: p.crfModules.filter((m) => m.id !== moduleId),
      visits: p.visits.map((v) => ({
        ...v,
        crfModuleIds: v.crfModuleIds.filter((id) => id !== moduleId),
      })),
    }))
    if (editingModuleId === moduleId) {
      setMode('visit')
      setEditingModuleId('')
    }
  }"""

new_handler = """  const deleteProjectModule = (moduleId: string) => {
    if (readOnly) return
    if (!confirm('确定删除此模块？该模块将从所有访视中移除，且字段数据将丢失。')) return
    onUpdate((p) => ({
      ...p,
      crfModules: p.crfModules.filter((m) => m.id !== moduleId),
      visits: p.visits.map((v) => ({
        ...v,
        crfModuleIds: v.crfModuleIds.filter((id) => id !== moduleId),
      })),
    }))
    if (editingModuleId === moduleId) {
      setMode('visit')
      setEditingModuleId('')
    }
  }

  const saveModuleInfo = (module: CRFModule) => {
    onUpdate((p) => ({
      ...p,
      crfModules: p.crfModules.map((m) => (m.id === module.id ? module : m)),
    }))
    setShowModuleInfoDialog(false)
    setEditingModuleInfo(null)
  }"""

if old_handler in content:
    content = content.replace(old_handler, new_handler)
    print("2. Added saveModuleInfo handler")
else:
    print("2. FAILED: could not find deleteProjectModule handler")

# 3. 修改 VisitModulesView 组件的 props，添加 onEditModuleInfo
old_props = """function VisitModulesView({
  visit,
  modules,
  readOnly,
  onAddModule,
  onEditModule,
  onRemoveModule,
  onDeleteModule,
}: {
  visit: Visit
  modules: CRFModule[]
  readOnly: boolean
  onAddModule: () => void
  onEditModule: (moduleId: string) => void
  onRemoveModule: (moduleId: string) => void
  onDeleteModule: (moduleId: string) => void
}) {"""

new_props = """function VisitModulesView({
  visit,
  modules,
  readOnly,
  onAddModule,
  onEditModule,
  onEditModuleInfo,
  onRemoveModule,
  onDeleteModule,
}: {
  visit: Visit
  modules: CRFModule[]
  readOnly: boolean
  onAddModule: () => void
  onEditModule: (moduleId: string) => void
  onEditModuleInfo: (module: CRFModule) => void
  onRemoveModule: (moduleId: string) => void
  onDeleteModule: (moduleId: string) => void
}) {"""

if old_props in content:
    content = content.replace(old_props, new_props)
    print("3. Added onEditModuleInfo prop")
else:
    print("3. FAILED: could not find VisitModulesView props")

# 4. 修改模块卡片中的图标显示和添加编辑信息按钮
# 先找到模块卡片的图标区域
old_card_icon = """                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center flex-shrink-0">
                      <Layers className="w-5 h-5 text-teal-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-800 text-sm">{mod.name}</h3>
                      <p className="text-xs text-slate-400 line-clamp-1">{mod.description || '暂无描述'}</p>
                    </div>
                  </div>
                </div>"""

new_card_icon = """                <div className="flex items-start justify-between mb-3">
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
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-7 h-7 text-slate-400 hover:text-teal-600"
                      onClick={() => onEditModuleInfo(mod)}
                    >
                      <Pencil className="w-3 h-3" />
                    </Button>
                  )}
                </div>"""

if old_card_icon in content:
    content = content.replace(old_card_icon, new_card_icon)
    print("4. Updated module card icon and added edit button")
else:
    print("4. FAILED: could not find module card icon block")

# 5. 在 CRFConfigurator 渲染 VisitModulesView 的地方传入 onEditModuleInfo
old_render = """      <VisitModulesView
            visit={activeVisit}
            modules={getVisitModules(activeVisit)}
            readOnly={readOnly}
            onAddModule={() => setShowAddModuleDialog(true)}
            onEditModule={openModuleEditor}
            onRemoveModule={removeModuleFromVisit}
            onDeleteModule={deleteProjectModule}
          />"""

new_render = """      <VisitModulesView
            visit={activeVisit}
            modules={getVisitModules(activeVisit)}
            readOnly={readOnly}
            onAddModule={() => setShowAddModuleDialog(true)}
            onEditModule={openModuleEditor}
            onEditModuleInfo={(mod) => { setEditingModuleInfo(mod); setShowModuleInfoDialog(true) }}
            onRemoveModule={removeModuleFromVisit}
            onDeleteModule={deleteProjectModule}
          />"""

if old_render in content:
    content = content.replace(old_render, new_render)
    print("5. Passed onEditModuleInfo to VisitModulesView")
else:
    print("5. FAILED: could not find VisitModulesView render block")

# 6. 在弹窗区添加模块信息编辑弹窗
old_dialogs = """      {/* 编辑字段 */}
      {editingField && showFieldDialog && (
        <FieldEditDialog
          open={showFieldDialog}
          onOpenChange={setShowFieldDialog}
          field={editingField}
          onSave={saveField}
        />
      )}
    </div>"""

new_dialogs = """      {/* 编辑模块信息 */}
      {editingModuleInfo && (
        <ModuleInfoDialog
          open={showModuleInfoDialog}
          onOpenChange={setShowModuleInfoDialog}
          module={editingModuleInfo}
          onSave={saveModuleInfo}
        />
      )}

      {/* 编辑字段 */}
      {editingField && showFieldDialog && (
        <FieldEditDialog
          open={showFieldDialog}
          onOpenChange={setShowFieldDialog}
          field={editingField}
          onSave={saveField}
        />
      )}
    </div>"""

if old_dialogs in content:
    content = content.replace(old_dialogs, new_dialogs)
    print("6. Added ModuleInfoDialog to dialogs section")
else:
    print("6. FAILED: could not find dialogs block")

# 7. 在文件末尾添加 ModuleIcon 和 ModuleInfoDialog 组件
# 先找到 FieldEditDialog 之前的位置，或者文件末尾

module_icon_component = '''
// ==================== 模块图标组件 ====================
const AVAILABLE_ICONS = [
  'Layers', 'Heart', 'Activity', 'FileText', 'Stethoscope', 'Pill',
  'Syringe', 'Clipboard', 'FlaskConical', 'Microscope', 'Scan',
  'Thermometer', 'Weight', 'Ruler', 'Clock', 'Calendar', 'User',
  'Users', 'Baby', 'Brain', 'Bone', 'Eye', 'Ear', 'Dna',
]

function ModuleIcon({ name }: { name?: string }) {
  // 动态渲染图标，默认使用 Layers
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

          {/* 图标选择 */}
          <div>
            <Label className="text-sm mb-2 block">模块图标</Label>
            <div className="grid grid-cols-8 gap-2">
              {AVAILABLE_ICONS.map((iconName) => (
                <button
                  key={iconName}
                  onClick={() => setM({ ...m, icon: iconName })}
                  className={`w-10 h-10 rounded-lg flex items-center justify-center border transition-colors ${
                    m.icon === iconName
                      ? 'border-teal-500 bg-teal-50'
                      : 'border-slate-200 hover:border-teal-300 hover:bg-slate-50'
                  }`}
                  title={iconName}
                >
                  <ModuleIcon name={iconName} />
                </button>
              ))}
            </div>
          </div>

          {/* 显示开关 */}
          <div className="flex items-center justify-between border rounded-md p-3">
            <div>
              <div className="text-sm font-medium">在录入页面显示图标</div>
              <div className="text-xs text-slate-400">开启后，数据录入人员可在录入页面看到此模块图标</div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={m.showIcon !== false}
                onChange={(e) => setM({ ...m, showIcon: e.target.checked })}
              />
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
'''

# 追加到文件末尾（在最后一个 export 之后或最后）
# 找到文件末尾，看看是否已经有闭合了
if "export default" in content:
    # 在 export default 之前插入组件
    idx = content.rfind("export default")
    content = content[:idx] + module_icon_component + "\n" + content[idx:]
    print("7. Added ModuleIcon and ModuleInfoDialog components")
else:
    content = content + module_icon_component
    print("7. Added ModuleIcon and ModuleInfoDialog at end")

with open(path, "w", encoding="utf-8") as f:
    f.write(content)

print("All done!")
