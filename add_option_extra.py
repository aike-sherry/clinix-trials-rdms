path = r'C:/Users/huawe/Documents/Kimi/Workspaces/CRF设计/crf-designer/src/pages/admin/ModuleLibraryPage.tsx'

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add showIf update helper in FieldInlineEditor
old_update = '''  const update = (partial: Partial<CRFField>) => {
    onChange({ ...field, ...partial })
  }'''

new_update = '''  const update = (partial: Partial<CRFField>) => {
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
  }'''

if old_update in content:
    content = content.replace(old_update, new_update)
    print('Step 1: Added showIf helpers.')
else:
    print('Step 1: Pattern not found!')

# 2. Replace the option row to add extra input toggle
old_option_row = '''              <div
                key={idx}
                className="flex items-center gap-2 p-2 rounded-md border border-slate-100 bg-slate-50/50"
              >
                <span className="text-xs text-slate-400 font-mono w-5 text-center">
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
                  className="h-7 text-xs flex-1"
                  value={opt.value}
                  onChange={(e) => {
                    const newOpts = [...(field.options || [])]
                    newOpts[idx] = { ...newOpts[idx], value: e.target.value }
                    update({ options: newOpts })
                  }}
                />
                <div className="flex items-center gap-0.5">'''

new_option_row = '''              <div
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
                  <div className="flex items-center gap-0.5 flex-shrink-0">'''

if old_option_row in content:
    content = content.replace(old_option_row, new_option_row)
    print('Step 2: Updated option row layout.')
else:
    print('Step 2: Pattern not found!')

# 3. After the option row buttons (Trash2), add extra input section and close the inner div
old_option_end = '''                  <Button
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
              </div>'''

new_option_end = '''                  <Button
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
              </div>'''

if old_option_end in content:
    content = content.replace(old_option_end, new_option_end)
    print('Step 3: Added extra input config to options.')
else:
    print('Step 3: Pattern not found!')

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print('Done.')
