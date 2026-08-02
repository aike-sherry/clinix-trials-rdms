path = r'C:/Users/huawe/Documents/Kimi/Workspaces/CRF设计/crf-designer/src/pages/admin/ProjectCRFView.tsx'

with open(path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

balance = 0
for i, line in enumerate(lines, 1):
    stripped = line.strip()
    if stripped.startswith('//') or stripped.startswith('*'):
        continue
    # Count braces, but very naively ignore those inside strings
    # A slightly better approach: only count braces not preceded by backslash or inside quotes
    in_single = in_double = False
    for j, ch in enumerate(line):
        if ch == "'" and (j == 0 or line[j-1] != '\\'):
            in_single = not in_single
        elif ch == '"' and (j == 0 or line[j-1] != '\\'):
            in_double = not in_double
        elif not in_single and not in_double:
            if ch == '{':
                balance += 1
            elif ch == '}':
                balance -= 1
    if balance < 0:
        print(f'NEGATIVE balance at line {i}: {balance}  |  {stripped[:80]}')
        break

print(f'Final balance: {balance}')

# Now binary search to find where balance becomes permanently > expected
# We know final balance is 1. Let's find the first line where balance > expected_end_balance_line
# Actually, let's just scan backwards from the end to find where the extra { might be
balance = 0
for i in range(len(lines)-1, -1, -1):
    line = lines[i]
    in_single = in_double = False
    for j, ch in enumerate(line):
        if ch == "'" and (j == 0 or line[j-1] != '\\'):
            in_single = not in_single
        elif ch == '"' and (j == 0 or line[j-1] != '\\'):
            in_double = not in_double
        elif not in_single and not in_double:
            if ch == '{':
                balance -= 1
            elif ch == '}':
                balance += 1
    # At end of each line from bottom, balance should represent how many more } than { we've seen
    # If we find a line where balance drops significantly, that might indicate the problem

# Let's instead just print lines where balance is very high or unusual
balance = 0
for i, line in enumerate(lines, 1):
    stripped = line.strip()
    if stripped.startswith('//') or stripped.startswith('*'):
        continue
    in_single = in_double = False
    for j, ch in enumerate(line):
        if ch == "'" and (j == 0 or line[j-1] != '\\'):
            in_single = not in_single
        elif ch == '"' and (j == 0 or line[j-1] != '\\'):
            in_double = not in_double
        elif not in_single and not in_double:
            if ch == '{':
                balance += 1
            elif ch == '}':
                balance -= 1
    # After line 580 (CRFConfigurator end), balance should be low
    if i > 580 and balance > 5:
        print(f'Line {i}: balance={balance}  {stripped[:70]}')
