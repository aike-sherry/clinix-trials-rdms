path = r'C:/Users/huawe/Documents/Kimi/Workspaces/CRF设计/crf-designer/src/pages/admin/ProjectCRFView.tsx'

with open(path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Check for duplicate function signatures or common patterns
def find_dupes(lines, start_idx, pattern_lines):
    pattern = ''.join(lines[start_idx:start_idx+pattern_lines])
    count = 0
    indices = []
    for i in range(len(lines) - pattern_lines + 1):
        if ''.join(lines[i:i+pattern_lines]) == pattern:
            count += 1
            indices.append(i)
    return count, indices

# Check for some known patterns
patterns = [
    ("function VisitModulesView", 1),
    ("function ModulePreviewView", 1),
    ("function ModuleFieldEditor", 1),
    ("function AddModuleDialog", 1),
    ("function FieldEditDialog", 1),
    ("      {/* 右侧：实时预览 */}", 1),
    ("      {/* 访视头部 */}", 1),
    ("{modules.length > 0 && showPreview && (", 1),
    ("{modules.length > 0 && (", 1),
]

for pat, plen in patterns:
    for i, line in enumerate(lines):
        if pat in line:
            print(f'Found "{pat}" at line {i+1}: {line.strip()[:80]}')

print()

# Check for consecutive duplicate lines
for i in range(len(lines)-1):
    if lines[i].strip() and lines[i] == lines[i+1]:
        print(f'Duplicate line at {i+1}: {lines[i].strip()[:80]}')
