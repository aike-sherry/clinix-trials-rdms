path = r'C:/Users/huawe/Documents/Kimi/Workspaces/CRF设计/crf-designer/src/pages/admin/ProjectCRFView.tsx'

with open(path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Find exact line numbers of key sections
for i, line in enumerate(lines, 1):
    if 'function VisitModulesView' in line:
        print(f'VisitModulesView starts at line {i}')
    if 'function ModulePreviewView' in line:
        print(f'ModulePreviewView starts at line {i}')
    if 'function ModuleFieldEditor' in line:
        print(f'ModuleFieldEditor starts at line {i}')
    if 'function AddModuleDialog' in line:
        print(f'AddModuleDialog starts at line {i}')
    if 'function FieldEditDialog' in line:
        print(f'FieldEditDialog starts at line {i}')

# Check line 631 content
print(f'\nLine 631: {repr(lines[630])}')

# Check if there are any unclosed <div> tags in VisitModulesView by naive counting
count_div_open = 0
count_div_close = 0
in_visit = False
for i, line in enumerate(lines, 1):
    if 'function VisitModulesView' in line:
        in_visit = True
    if in_visit and 'function ModulePreviewView' in line:
        in_visit = False
    if in_visit:
        count_div_open += line.count('<div')
        count_div_close += line.count('</div>')

print(f'\nIn VisitModulesView: <div opens={count_div_open}, </div> closes={count_div_close}')
print(f'Difference: {count_div_open - count_div_close}')
