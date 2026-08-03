import re

with open('src/pages/admin/ModuleLibraryPage.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

old = '<div className="flex-1 flex overflow-hidden">'
new = '<div className="flex-1 flex">'
content = content.replace(old, new)

old2 = '<aside className="w-44 border-r border-slate-100 bg-slate-50 flex flex-col flex-shrink-0">'
new2 = '<aside className="w-44 border-r border-slate-100 bg-slate-50 flex flex-col flex-shrink-0 sticky top-0 self-start h-fit max-h-full overflow-y-auto">'
content = content.replace(old2, new2)

with open('src/pages/admin/ModuleLibraryPage.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print('done')
