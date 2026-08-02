import re

path = r'C:/Users/huawe/Documents/Kimi/Workspaces/CRF设计/crf-designer/src/pages/admin/ProjectCRFView.tsx'

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Find the exact start and end of VisitModulesView
start_marker = 'function VisitModulesView({'
end_marker = '// ==================== 模块预览视图（右侧分栏）===================='

start_idx = content.find(start_marker)
end_idx = content.find(end_marker)

if start_idx == -1 or end_idx == -1:
    print('Could not find markers!')
    print('start_idx:', start_idx, 'end_idx:', end_idx)
else:
    old_component = content[start_idx:end_idx]
    
    new_component = '''function VisitModulesView({
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
}) {
  const [showPreview, setShowPreview] = useState(true)
  const [previewWidth, setPreviewWidth] = useState(460)
  const [isResizing, setIsResizing] = useState(false)
  const modules: CRFModule[] = visit.crfModuleIds
    .map((mid) => allModules.find((m) => m.id === mid))
    .filter(Boolean) as CRFModule[]

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
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {modules.map((mod) => (
                <div key={mod.id} className="bg-white rounded-lg border border-slate-200 p-5 hover:shadow-md transition-shadow">
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

'''

    content = content[:start_idx] + new_component + content[end_idx:]
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print('VisitModulesView replaced successfully!')
