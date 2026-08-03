path = r'C:/Users/huawe/Documents/Kimi/Workspaces/CRF设计/crf-designer/src/types/index.ts'

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Add unit property to CRFField
old_field = '''  /** 量表类型专用：量表配置 */
  scaleConfig?: {'''

new_field = '''  /** 单位（用于数字、量表等字段，如：年、kg、mmHg） */
  unit?: string
  /** 量表类型专用：量表配置 */
  scaleConfig?: {'''

if old_field in content:
    content = content.replace(old_field, new_field)
    print('Added unit property to CRFField.')
else:
    print('Pattern not found!')

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
