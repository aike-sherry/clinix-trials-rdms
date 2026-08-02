path = r'C:/Users/huawe/Documents/Kimi/Workspaces/CRF设计/crf-designer/src/pages/admin/ProjectCRFView.tsx'

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

old = '            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">'
new = '            <div className={"grid gap-4 " + (showPreview ? "grid-cols-1" : "grid-cols-2")}>'

if old in content:
    content = content.replace(old, new)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print('Fixed grid columns based on showPreview state.')
else:
    print('Pattern not found!')
