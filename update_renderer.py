path = r'C:/Users/huawe/Documents/Kimi/Workspaces/CRF设计/crf-designer/src/components/CRFFormRenderer.tsx'

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add condition evaluation helper after the component definition starts
# Find: const updateField = ... and add after it
old_after_update = '''  const updateField = (name: string, value: unknown) => {
    if (readOnly) return
    const next = { ...data, [name]: value }
    setData(next)
    onChange?.(next)
  }'''

new_after_update = '''  const updateField = (name: string, value: unknown) => {
    if (readOnly) return
    const next = { ...data, [name]: value }
    setData(next)
    onChange?.(next)
  }

  const updateExtraInput = (fieldName: string, optionValue: string, extraValue: string) => {
    if (readOnly) return
    const key = `${fieldName}_extra_${optionValue}`
    const next = { ...data, [key]: extraValue }
    setData(next)
    onChange?.(next)
  }

  const shouldShowField = (field: CRFField): boolean => {
    if (!field.showIf) return true
    const { fieldName, operator, value } = field.showIf
    const dependentValue = data[fieldName]
    switch (operator) {
      case 'equals':
        return String(dependentValue) === value
      case 'notEquals':
        return String(dependentValue) !== value
      case 'contains':
        return String(dependentValue).includes(value || '')
      case 'notEmpty':
        return dependentValue !== undefined && dependentValue !== '' && dependentValue !== null
      default:
        return true
    }
  }'''

if old_after_update in content:
    content = content.replace(old_after_update, new_after_update)
    print('Step 1: Added condition helpers.')
else:
    print('Step 1: Pattern not found!')

# 2. Replace select rendering to support extra input
old_select = '''      case 'select':
        return (
          <Select
            value={(value as string) || ''}
            onValueChange={(v) => updateField(field.name, v)}
            disabled={readOnly}
          >
            <SelectTrigger>
              <SelectValue placeholder={field.placeholder || '请选择'} />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((opt: FieldOption) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )'''

new_select = '''      case 'select': {
        const selectedOpt = field.options?.find((opt) => opt.value === value)
        const extraKey = `${field.name}_extra_${value}`
        const extraValue = (data[extraKey] as string) || ''
        return (
          <div className="space-y-2">
            <Select
              value={(value as string) || ''}
              onValueChange={(v) => updateField(field.name, v)}
              disabled={readOnly}
            >
              <SelectTrigger>
                <SelectValue placeholder={field.placeholder || '请选择'} />
              </SelectTrigger>
              <SelectContent>
                {field.options?.map((opt: FieldOption) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedOpt?.hasExtraInput && (
              <Input
                placeholder={selectedOpt.extraInputPlaceholder || selectedOpt.extraInputLabel || '请补充说明'}
                value={extraValue}
                onChange={(e) => updateExtraInput(field.name, value as string, e.target.value)}
                disabled={readOnly}
                className="text-sm"
              />
            )}
          </div>
        )
      }'''

if old_select in content:
    content = content.replace(old_select, new_select)
    print('Step 2: Updated select with extra input.')
else:
    print('Step 2: Pattern not found!')

# 3. Replace radio rendering to support extra input
old_radio = '''      case 'radio':
        return (
          <RadioGroup
            value={(value as string) || ''}
            onValueChange={(v) => updateField(field.name, v)}
            disabled={readOnly}
            className="flex flex-col gap-2"
          >
            {field.options?.map((opt: FieldOption) => (
              <div key={opt.value} className="flex items-center space-x-2">
                <RadioGroupItem value={opt.value} id={`${field.name}-${opt.value}`} />
                <Label htmlFor={`${field.name}-${opt.value}`} className="font-normal cursor-pointer">
                  {opt.label}
                </Label>
              </div>
            ))}
          </RadioGroup>
        )'''

new_radio = '''      case 'radio': {
        const selectedRadioOpt = field.options?.find((opt) => opt.value === value)
        const radioExtraKey = `${field.name}_extra_${value}`
        const radioExtraValue = (data[radioExtraKey] as string) || ''
        return (
          <div className="space-y-2">
            <RadioGroup
              value={(value as string) || ''}
              onValueChange={(v) => updateField(field.name, v)}
              disabled={readOnly}
              className="flex flex-col gap-2"
            >
              {field.options?.map((opt: FieldOption) => (
                <div key={opt.value} className="flex items-center space-x-2">
                  <RadioGroupItem value={opt.value} id={`${field.name}-${opt.value}`} />
                  <Label htmlFor={`${field.name}-${opt.value}`} className="font-normal cursor-pointer">
                    {opt.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
            {selectedRadioOpt?.hasExtraInput && (
              <Input
                placeholder={selectedRadioOpt.extraInputPlaceholder || selectedRadioOpt.extraInputLabel || '请补充说明'}
                value={radioExtraValue}
                onChange={(e) => updateExtraInput(field.name, value as string, e.target.value)}
                disabled={readOnly}
                className="text-sm mt-1"
              />
            )}
          </div>
        )
      }'''

if old_radio in content:
    content = content.replace(old_radio, new_radio)
    print('Step 3: Updated radio with extra input.')
else:
    print('Step 3: Pattern not found!')

# 4. Replace checkbox rendering to support extra input
old_checkbox = '''      case 'checkbox': {
        const arr = Array.isArray(value) ? (value as string[]) : []
        return (
          <div className="flex flex-col gap-2">
            {field.options?.map((opt: FieldOption) => (
              <div key={opt.value} className="flex items-center space-x-2">
                <Checkbox
                  id={`${field.name}-${opt.value}`}
                  checked={arr.includes(opt.value)}
                  onCheckedChange={(checked) => {
                    const next = checked
                      ? [...arr, opt.value]
                      : arr.filter((v) => v !== opt.value)
                    updateField(field.name, next)
                  }}
                  disabled={readOnly}
                />
                <Label htmlFor={`${field.name}-${opt.value}`} className="font-normal cursor-pointer">
                  {opt.label}
                </Label>
              </div>
            ))}
          </div>
        )
      }'''

new_checkbox = '''      case 'checkbox': {
        const arr = Array.isArray(value) ? (value as string[]) : []
        return (
          <div className="flex flex-col gap-2">
            {field.options?.map((opt: FieldOption) => {
              const isChecked = arr.includes(opt.value)
              const cbExtraKey = `${field.name}_extra_${opt.value}`
              const cbExtraValue = (data[cbExtraKey] as string) || ''
              return (
                <div key={opt.value} className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id={`${field.name}-${opt.value}`}
                      checked={isChecked}
                      onCheckedChange={(checked) => {
                        const next = checked
                          ? [...arr, opt.value]
                          : arr.filter((v) => v !== opt.value)
                        updateField(field.name, next)
                      }}
                      disabled={readOnly}
                    />
                    <Label htmlFor={`${field.name}-${opt.value}`} className="font-normal cursor-pointer">
                      {opt.label}
                    </Label>
                  </div>
                  {isChecked && opt.hasExtraInput && (
                    <Input
                      placeholder={opt.extraInputPlaceholder || opt.extraInputLabel || '请补充说明'}
                      value={cbExtraValue}
                      onChange={(e) => updateExtraInput(field.name, opt.value, e.target.value)}
                      disabled={readOnly}
                      className="text-sm ml-6 w-auto"
                    />
                  )}
                </div>
              )
            })}
          </div>
        )
      }'''

if old_checkbox in content:
    content = content.replace(old_checkbox, new_checkbox)
    print('Step 4: Updated checkbox with extra input.')
else:
    print('Step 4: Pattern not found!')

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print('Done.')
