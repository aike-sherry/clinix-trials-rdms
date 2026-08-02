import sys

path = r'C:/Users/huawe/Documents/Kimi/Workspaces/CRF设计/crf-designer/src/pages/admin/ProjectCRFView.tsx'
with open(path, 'r', encoding='utf-8') as f:
    s = f.read()

print('Open braces:', s.count('{'))
print('Close braces:', s.count('}'))
