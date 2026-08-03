path = r'C:/Users/huawe/Documents/Kimi/Workspaces/CRF设计/crf-designer/src/pages/admin/ModuleLibraryPage.tsx'

with open(path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Fix line 83 (0-indexed: 82)
lines[82] = '  signature: <Pen className=...w-4 h-4... .>,\n'

# Actually the sed replaced " with ... so we need to use actual quotes
lines[82] = '  signature: <Pen className=...w-4 h-4... .>,\n'

# Let me just rewrite properly
lines[82] = '  signature: <Pen className="w-4 h-4" />,\n'

with open(path, 'w', encoding='utf-8') as f:
    f.writelines(lines)

print('Fixed line 83.')
