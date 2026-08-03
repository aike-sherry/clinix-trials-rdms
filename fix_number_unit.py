import re

# Read CRFFormRenderer.tsx
with open('src/components/CRFFormRenderer.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the FIRST occurrence of case 'number': in renderField (not renderCellInput)
# The first one uses `value={value !== undefined...}` and `updateField(field.name, v)`
# The second one uses `cellValue` and `updateCell`

old_block = """      case 'number':
        return (
          <Input
            {...commonProps}
            type="number"
            value={value !== undefined ? String(value) : ''}
            onChange={(e) => {
              const v = e.target.value === '' ? undefined : Number(e.target.value)
              updateField(field.name, v)
            }}
          />
        )"""

new_block = """      case 'number':
        return (
          <div className="flex items-center gap-2">
            <Input
              {...commonProps}
              type="number"
              value={value !== undefined ? String(value) : ''}
              onChange={(e) => {
                const v = e.target.value === '' ? undefined : Number(e.target.value)
                updateField(field.name, v)
              }}
            />
            {field.unit && (
              <span className="text-sm text-slate-500 whitespace-nowrap">{field.unit}</span>
            )}
          </div>
        )"""

if old_block in content:
    content = content.replace(old_block, new_block, 1)
    with open('src/components/CRFFormRenderer.tsx', 'w', encoding='utf-8') as f:
        f.write(content)
    print('CRFFormRenderer.tsx updated successfully')
else:
    print('ERROR: old_block not found')
