path = r"C:\Users\huawe\Documents\Kimi\Workspaces\CRF设计\crf-designer\src\pages\admin\ProjectCRFView.tsx"

with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. 添加 Eye 到 lucide-react 导入
old_import = "  Search, X, Layers, Settings2, GripVertical, FlaskConical,\n} from 'lucide-react'"
new_import = "  Search, X, Layers, Settings2, GripVertical, FlaskConical, Eye,\n} from 'lucide-react'"

if old_import in content:
    content = content.replace(old_import, new_import)
    print("1. Added Eye to imports")
else:
    print("1. FAILED: import block not found")

# 2. 在 CRFConfigurator state 中添加 preview 状态
old_state = "  const [showModuleInfoDialog, setShowModuleInfoDialog] = useState(false)\n  const [editingModuleInfo, setEditingModuleInfo] = useState<CRFModule | null>(null)"
new_state = "  const [showModuleInfoDialog, setShowModuleInfoDialog] = useState(false)\n  const [editingModuleInfo, setEditingModuleInfo] = useState<CRFModule | null>(null)\n  const [previewModule, setPreviewModule] = useState<CRFModule | null>(null)"

if old_state in content:
    content = content.replace(old_state, new_state)
    print("2. Added previewModule state")
else:
    print("2. FAILED: state block not found")

# 3. 修改 VisitModulesView props，添加 onPreviewModule
old_props = """function VisitModulesView({
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

new_props = """function VisitModulesView({
  visit,
  modules,
  readOnly,
  onAddModule,
  onEditModule,
  onEditModuleInfo,
  onPreviewModule,
  onRemoveModule,
  onDeleteModule,
}: {
  visit: Visit
  modules: CRFModule[]
  readOnly: boolean
  onAddModule: () => void
  onEditModule: (moduleId: string) => void
  onEditModuleInfo: (module: CRFModule) => void
  onPreviewModule: (module: CRFModule) => void
  onRemoveModule: (moduleId: string) => void
  onDeleteModule: (moduleId: string) => void
}) {"""

if old_props in content:
    content = content.replace(old_props, new_props)
    print("3. Added onPreviewModule prop")
else:
    print("3. FAILED: props block not found")

# 4. 在模块卡片按钮区域添加"预览"按钮
old_buttons = """                <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
                  <Button variant="outline" size="sm" className="flex-1 h-8 text-xs" onClick={() => onEditModule(mod.id)}>
                    <Settings2 className="w-3 h-3 mr-1" /> 设计字段
                  </Button>"""

new_buttons = """                <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
                  <Button variant="outline" size="sm" className="flex-1 h-8 text-xs" onClick={() => onEditModule(mod.id)}>
                    <Settings2 className="w-3 h-3 mr-1" /> 设计字段
                  </Button>
                  <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => onPreviewModule(mod)}>
                    <Eye className="w-3 h-3 mr-1" /> 预览
                  </Button>"""

if old_buttons in content:
    content = content.replace(old_buttons, new_buttons)
    print("4. Added preview button to module card")
else:
    print("4. FAILED: button block not found")

# 5. 在 VisitModulesView 渲染处传入 onPreviewModule
old_render = """      <VisitModulesView
            visit={activeVisit}
            modules={getVisitModules(activeVisit)}
            readOnly={readOnly}
            onAddModule={() => setShowAddModuleDialog(true)}
            onEditModule={openModuleEditor}
            onEditModuleInfo={(mod) => { setEditingModuleInfo(mod); setShowModuleInfoDialog(true) }}
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
            onPreviewModule={(mod) => setPreviewModule(mod)}
            onRemoveModule={removeModuleFromVisit}
            onDeleteModule={deleteProjectModule}
          />"""

if old_render in content:
    content = content.replace(old_render, new_render)
    print("5. Passed onPreviewModule to VisitModulesView")
else:
    print("5. FAILED: render block not found")

# 6. 在弹窗区域添加预览弹窗
old_dialogs = """      {/* 编辑模块信息 */}
      {editingModuleInfo && (
        <ModuleInfoDialog
          open={showModuleInfoDialog}
          onOpenChange={setShowModuleInfoDialog}
          module={editingModuleInfo}
          onSave={saveModuleInfo}
        />
      )}

      {/* 编辑字段 */}"""

new_dialogs = """      {/* 预览模块 */}
      {previewModule && (
        <Dialog open={!!previewModule} onOpenChange={(v) => { if (!v) setPreviewModule(null) }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ModuleIcon name={previewModule.icon} />
                预览: {previewModule.name}
              </DialogTitle>
            </DialogHeader>
            <div className="py-4 space-y-4">
              <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                <CRFFormRenderer sections={[]} fields={previewModule.fields} />
              </div>
              <p className="text-xs text-slate-400 text-center">以上为数据录入人员看到的模块样式</p>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* 编辑模块信息 */}
      {editingModuleInfo && (
        <ModuleInfoDialog
          open={showModuleInfoDialog}
          onOpenChange={setShowModuleInfoDialog}
          module={editingModuleInfo}
          onSave={saveModuleInfo}
        />
      )}

      {/* 编辑字段 */}"""

if old_dialogs in content:
    content = content.replace(old_dialogs, new_dialogs)
    print("6. Added preview dialog")
else:
    print("6. FAILED: dialogs block not found")

with open(path, "w", encoding="utf-8") as f:
    f.write(content)

print("All done!")
