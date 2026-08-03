path = r'C:/Users/huawe/Documents/Kimi/Workspaces/CRF设计/crf-designer/src/pages/admin/ModuleLibraryPage.tsx'

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update type switch handler to init scale and numberRange
old_type_handler = '''              if (newType === 'table') {
                if (!field.columns || field.columns.length === 0) {
                  updates.columns = [
                    { id: genId(), type: 'text', label: '列1', name: 'col1', order: 0 },
                  ]
                }
              }'''

new_type_handler = '''              if (newType === 'table') {
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
              }'''

if old_type_handler in content:
    content = content.replace(old_type_handler, new_type_handler)
    print('Step 1: Updated type switch handler.')
else:
    print('Step 1: Pattern not found!')

# 2. Add scale config editor after validation rules section
old_after_validation = '''      {/* 条件显示 */}
      <div className="border border-slate-200 rounded-md p-3 space-y-3 bg-white">'''

new_after_validation = '''      {/* 量表配置 */}
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
      <div className="border border-slate-200 rounded-md p-3 space-y-3 bg-white">'''

if old_after_validation in content:
    content = content.replace(old_after_validation, new_after_validation)
    print('Step 2: Added scale config editor.')
else:
    print('Step 2: Pattern not found!')

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print('Done.')
