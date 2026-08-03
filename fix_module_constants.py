path = r'C:/Users/huawe/Documents/Kimi/Workspaces/CRF设计/crf-designer/src/pages/admin/ModuleLibraryPage.tsx'

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix imports - add Pen
content = content.replace(
    '  Table, SlidersHorizontal, ArrowLeftRight,\n  Eye,',
    '  Table, SlidersHorizontal, ArrowLeftRight, Pen,\n  Eye,'
)

# Fix FIELD_TYPE_LABELS - add signature
content = content.replace(
    "  scale: '量表评分',\n  numberRange: '数值范围',\n}",
    "  scale: '量表评分',\n  numberRange: '数值范围',\n  signature: '电子签名',\n}"
)

# Fix FIELD_TYPE_ICONS - add signature
content = content.replace(
    '  table: <Table className="w-4 h-4" />,\n}',
    '  table: <Table className="w-4 h-4" />,\n  signature: <Pen className="w-4 h-4" />,\n}'
)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print('Fixed ModuleLibraryPage constants.')
