import re

path = 'src/pages/admin/ModuleLibraryPage.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. 修改 import：添加 ChevronLeft, ChevronRight
old_import = """  ChevronUp,
  ChevronDown,
  X,"""
new_import = """  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  X,"""
if old_import in content:
    content = content.replace(old_import, new_import, 1)
    print('import updated')
else:
    print('ERROR: import not found')

# 2. 添加 preview 状态变量
old_state = """  const [inlineEditingId, setInlineEditingId] = useState<string | null>(null)
  const [inlineData, setInlineData] = useState<CRFField | null>(null)"""
new_state = """  const [inlineEditingId, setInlineEditingId] = useState<string | null>(null)
  const [inlineData, setInlineData] = useState<CRFField | null>(null)

  const [previewWidth, setPreviewWidth] = useState(420)
  const [previewCollapsed, setPreviewCollapsed] = useState(false)"""
if old_state in content:
    content = content.replace(old_state, new_state, 1)
    print('state added')
else:
    print('ERROR: state not found')

# 3. 添加拖拽调整宽度函数
old_dragend = """  const handleFieldDragEnd = () => {
    setDragFieldId(null)
  }

  const isInlineEditing"""
new_dragend = """  const handleFieldDragEnd = () => {
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

  const isInlineEditing"""
if old_dragend in content:
    content = content.replace(old_dragend, new_dragend, 1)
    print('resize handler added')
else:
    print('ERROR: dragend not found')

# 4. 移除左侧 aside 的 sticky（在 flex overflow-hidden 父容器内无效，保持 flex-col 即可）
old_aside = '              <aside className="w-44 border-r border-slate-100 bg-slate-50 flex flex-col flex-shrink-0 sticky top-0 self-start h-full">'
new_aside = '              <aside className="w-44 border-r border-slate-100 bg-slate-50 flex flex-col flex-shrink-0">'
if old_aside in content:
    content = content.replace(old_aside, new_aside, 1)
    print('aside sticky removed')
else:
    print('ERROR: aside not found')

# 5. 替换右侧预览区域为可折叠+拖拽版本
old_preview = """              {/* 右侧：实时预览 */}
              <aside className="w-[420px] border-l border-slate-100 bg-slate-50 flex flex-col flex-shrink-0">
                <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500">实时预览</span>
                  <span className="text-[10px] text-slate-400">
                    {selectedModule.fields.length} 个字段
                  </span>
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
              </aside>"""

new_preview = """              {/* 拖拽分割条 */}
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
              )}"""

if old_preview in content:
    content = content.replace(old_preview, new_preview, 1)
    print('preview panel updated')
else:
    print('ERROR: preview panel not found')

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print('done')
