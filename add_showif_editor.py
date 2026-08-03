path = r'C:/Users/huawe/Documents/Kimi/Workspaces/CRF设计/crf-designer/src/pages/admin/ModuleLibraryPage.tsx'

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Insert showIf config between validation rules and options list
old_insert_point = '''        </div>
      </div>

      {/* 选项列表（选择类字段） */}
      {hasOptions && ('''

new_insert_point = '''        </div>
      </div>

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
      {hasOptions && ('''

if old_insert_point in content:
    content = content.replace(old_insert_point, new_insert_point)
    print('Added showIf config section.')
else:
    print('Pattern not found!')

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print('Done.')
