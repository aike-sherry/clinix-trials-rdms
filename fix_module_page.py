import re

with open('src/pages/admin/ModuleLibraryPage.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Make aside sticky
old_aside = '              <aside className="w-44 border-r border-slate-100 bg-slate-50 flex flex-col flex-shrink-0">'
new_aside = '              <aside className="w-44 border-r border-slate-100 bg-slate-50 flex flex-col flex-shrink-0 sticky top-0 self-start h-full">'

if old_aside in content:
    content = content.replace(old_aside, new_aside, 1)
    print('aside sticky updated')
else:
    print('ERROR: aside not found')

# 2. Add unit input to FieldInlineEditor (after placeholder input, only for number type)
# Find the placeholder input block and add unit after it
old_placeholder = """        <div>
          <Label className="text-xs text-slate-500 mb-1 block">占位提示</Label>
          <Input
            className="h-8 text-sm"
            placeholder="输入框提示..."
            value={field.placeholder || ''}
            onChange={(e) => update({ placeholder: e.target.value })}
          />
        </div>
      </div>

      <div>
        <Label className="text-xs text-slate-500 mb-1 block">帮助说明</Label>"""

new_placeholder = """        <div>
          <Label className="text-xs text-slate-500 mb-1 block">占位提示</Label>
          <Input
            className="h-8 text-sm"
            placeholder="输入框提示..."
            value={field.placeholder || ''}
            onChange={(e) => update({ placeholder: e.target.value })}
          />
        </div>
      </div>

      {isNumber && (
        <div>
          <Label className="text-xs text-slate-500 mb-1 block">单位</Label>
          <Input
            className="h-8 text-sm"
            placeholder="如：年、mmHg、kg..."
            value={field.unit || ''}
            onChange={(e) => update({ unit: e.target.value })}
          />
        </div>
      )}

      <div>
        <Label className="text-xs text-slate-500 mb-1 block">帮助说明</Label>"""

if old_placeholder in content:
    content = content.replace(old_placeholder, new_placeholder, 1)
    print('unit input added')
else:
    print('ERROR: placeholder block not found')

with open('src/pages/admin/ModuleLibraryPage.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print('ModuleLibraryPage.tsx saved')
