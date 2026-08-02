path = r'C:/Users/huawe/Documents/Kimi/Workspaces/CRF设计/crf-designer/src/pages/admin/ProjectCRFView.tsx'

with open(path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Extract VisitModulesView lines (593 to 808)
visit_lines = lines[592:808]  # 0-indexed

stack = []
for i, line in enumerate(visit_lines, 593):
    stripped = line.strip()
    # Find <div ...> (but not </div>)
    idx = 0
    while True:
        pos_div = line.find('<div', idx)
        pos_close = line.find('</div>', idx)
        if pos_div == -1 and pos_close == -1:
            break
        if pos_div != -1 and (pos_close == -1 or pos_div < pos_close):
            # Check it's not </div>
            if line[pos_div:pos_div+5] == '<div ' or line[pos_div:pos_div+5] == '<div>':
                stack.append((i, stripped[:40]))
                idx = pos_div + 4
            else:
                idx = pos_div + 1
        elif pos_close != -1:
            if stack:
                opened = stack.pop()
            else:
                print(f'UNMATCHED </div> at line {i}: {stripped[:40]}')
            idx = pos_close + 6
        else:
            break

if stack:
    print(f'UNMATCHED <div> tags (missing </div>):')
    for line_num, content in stack:
        print(f'  Line {line_num}: {content}')
else:
    print('All <div> tags matched!')
