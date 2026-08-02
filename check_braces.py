import re

path = r'C:/Users/huawe/Documents/Kimi/Workspaces/CRF设计/crf-designer/src/pages/admin/ProjectCRFView.tsx'

with open(path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Simple brace counting ignoring strings and comments
# This won't be perfect for JSX but may help find gross imbalances
open_braces = 0
for i, line in enumerate(lines, 1):
    # Very naive: just count { and } characters
    # Skip obvious comments
    stripped = line.strip()
    if stripped.startswith('//') or stripped.startswith('*') or stripped.startswith('/*'):
        continue
    for ch in line:
        if ch == '{':
            open_braces += 1
        elif ch == '}':
            open_braces -= 1
    print(f'{i}: {open_braces}  {stripped[:60]}')
    if open_braces < 0:
        print(f'  NEGATIVE at line {i}!')
        break

print(f'\nFinal open braces: {open_braces}')
