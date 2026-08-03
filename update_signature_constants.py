import re

# ========== 1. Update ProjectCRFView.tsx ==========
path1 = r'C:/Users/huawe/Documents/Kimi/Workspaces/CRF设计/crf-designer/src/pages/admin/ProjectCRFView.tsx'
with open(path1, 'r', encoding='utf-8') as f:
    content = f.read()

# Add Pen to imports
if 'Pen' not in content:
    content = content.replace(
        '  Search, X, Layers, Settings2, GripVertical, FlaskConical, Eye, Table,\n  SlidersHorizontal, ArrowLeftRight,\n} from \'lucide-react\'',
        '  Search, X, Layers, Settings2, GripVertical, FlaskConical, Eye, Table,\n  SlidersHorizontal, ArrowLeftRight, Pen,\n} from \'lucide-react\''
    )
    print('ProjectCRFView: Added Pen to imports.')

# Add signature to FIELD_TYPE_ICONS
if 'signature:' not in content:
    content = content.replace(
        '  table: <Table className="w-3.5 h-3.5" />,\n}',
        '  table: <Table className="w-3.5 h-3.5" />,\n  signature: <Pen className="w-3.5 h-3.5" />,\n}'
    )
    print('ProjectCRFView: Added signature to FIELD_TYPE_ICONS.')

# Add signature to FIELD_TYPE_LABELS
if 'signature:' not in content or "'电子签名'" not in content:
    content = content.replace(
        "  scale: '量表评分', numberRange: '数值范围',\n}",
        "  scale: '量表评分', numberRange: '数值范围',\n  signature: '电子签名',\n}"
    )
    print('ProjectCRFView: Added signature to FIELD_TYPE_LABELS.')

with open(path1, 'w', encoding='utf-8') as f:
    f.write(content)

# ========== 2. Update ModuleLibraryPage.tsx ==========
path2 = r'C:/Users/huawe/Documents/Kimi/Workspaces/CRF设计/crf-designer/src/pages/admin/ModuleLibraryPage.tsx'
with open(path2, 'r', encoding='utf-8') as f:
    content = f.read()

# Add Pen to imports
if 'Pen' not in content:
    content = content.replace(
        '  Table, SlidersHorizontal, ArrowLeftRight,\n} from \'lucide-react\'',
        '  Table, SlidersHorizontal, ArrowLeftRight, Pen,\n} from \'lucide-react\''
    )
    print('ModuleLibraryPage: Added Pen to imports.')

# Add signature to FIELD_TYPE_LABELS
if "signature: '量表评分'" not in content and "signature:" not in content:
    content = content.replace(
        "  table: '表格',\n}",
        "  table: '表格',\n  scale: '量表评分',\n  numberRange: '数值范围',\n  signature: '电子签名',\n}"
    )
    print('ModuleLibraryPage: Added signature to FIELD_TYPE_LABELS.')

# Add signature to FIELD_TYPE_ICONS
if 'signature:' not in content:
    content = content.replace(
        '  table: <Table className="w-4 h-4" />,\n}',
        '  table: <Table className="w-4 h-4" />,\n  scale: <SlidersHorizontal className="w-4 h-4" />,\n  numberRange: <ArrowLeftRight className="w-4 h-4" />,\n  signature: <Pen className="w-4 h-4" />,\n}'
    )
    print('ModuleLibraryPage: Added signature to FIELD_TYPE_ICONS.')

with open(path2, 'w', encoding='utf-8') as f:
    f.write(content)

print('All constant updates done.')
