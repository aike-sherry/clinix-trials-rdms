path = r'C:/Users/huawe/Documents/Kimi/Workspaces/CRF设计/crf-designer/src/components/CRFFormRenderer.tsx'

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Filter fields by showIf in the no-sections branch
old_no_section = '''  // 如果没有 sections，直接渲染所有字段
  if (!sections || sections.length === 0) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {sortedFields.map((field) => (
          <div key={field.id} className={span2Types.has(field.type) ? 'md:col-span-2' : ''}>
            {field.type !== 'label' && (
              <Label htmlFor={field.name} className="mb-1.5 block text-sm font-medium text-slate-700">
                {field.label}
                {field.validation?.required && <span className="text-red-500 ml-0.5">*</span>}
              </Label>
            )}
            {renderField(field)}
            {field.helpText && field.type !== 'label' && (
              <p className="mt-1 text-xs text-slate-400">{field.helpText}</p>
            )}
          </div>
        ))}
      </div>
    )
  }'''

new_no_section = '''  // 如果没有 sections，直接渲染所有字段（过滤条件显示）
  const visibleFields = sortedFields.filter(shouldShowField)

  if (!sections || sections.length === 0) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {visibleFields.map((field) => (
          <div key={field.id} className={span2Types.has(field.type) ? 'md:col-span-2' : ''}>
            {field.type !== 'label' && (
              <Label htmlFor={field.name} className="mb-1.5 block text-sm font-medium text-slate-700">
                {field.label}
                {field.validation?.required && <span className="text-red-500 ml-0.5">*</span>}
              </Label>
            )}
            {renderField(field)}
            {field.helpText && field.type !== 'label' && (
              <p className="mt-1 text-xs text-slate-400">{field.helpText}</p>
            )}
          </div>
        ))}
      </div>
    )
  }'''

if old_no_section in content:
    content = content.replace(old_no_section, new_no_section)
    print('Step 1: Filtered fields in no-sections branch.')
else:
    print('Step 1: Pattern not found!')

# 2. Filter fields in sections branch
old_sections = '''  // 有 sections 时按 section 分组渲染
  const sortedSections = [...sections].sort((a, b) => a.order - b.order)

  // 兼容旧数据中的 sectionId（如果存在）
  const fieldsBySection = sortedSections.map((section) => ({
    section,
    fields: sortedFields.filter((f) => (f as any).sectionId === section.id),
  }))

  const ungrouped = sortedFields.filter((f) => !(f as any).sectionId)'''

new_sections = '''  // 有 sections 时按 section 分组渲染（过滤条件显示）
  const sortedSections = [...sections].sort((a, b) => a.order - b.order)

  // 兼容旧数据中的 sectionId（如果存在）
  const fieldsBySection = sortedSections.map((section) => ({
    section,
    fields: sortedFields.filter((f) => (f as any).sectionId === section.id && shouldShowField(f)),
  }))

  const ungrouped = sortedFields.filter((f) => !(f as any).sectionId && shouldShowField(f))'''

if old_sections in content:
    content = content.replace(old_sections, new_sections)
    print('Step 2: Filtered fields in sections branch.')
else:
    print('Step 2: Pattern not found!')

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print('Done.')
