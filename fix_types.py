with open('src/types/index.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Find and replace the entire CRFField interface to clean it up
old_interface = """export interface CRFField {
  id: string
  type: FieldType
  label: string
  name: string
  placeholder?: string
  helpText?: string
  options?: FieldOption[]
  validation?: ValidationRule
  /** 条件显示：当满足此条件时字段才显示 */
  showIf?: FieldCondition
  defaultValue?: unknown
  order: number
  /** 数字类型专用：单位（如：mmHg、kg、年） */
  unit?: string
  /** 表格类型专用：表格列定义 */
  columns?: CRFField[]
  unit?: string
  /** 表格类型专用：表格列定义 */
  columns?: CRFField[]
  columns?: CRFField[]
  /** 量表类型专用：量表配置 */
  scaleConfig?: {
    min: number
    max: number
    step: number
    labels?: { value: number; label: string }[]
  }
}"""

new_interface = """export interface CRFField {
  id: string
  type: FieldType
  label: string
  name: string
  placeholder?: string
  helpText?: string
  options?: FieldOption[]
  validation?: ValidationRule
  /** 条件显示：当满足此条件时字段才显示 */
  showIf?: FieldCondition
  defaultValue?: unknown
  order: number
  /** 数字类型专用：单位（如：mmHg、kg、年） */
  unit?: string
  /** 表格类型专用：表格列定义 */
  columns?: CRFField[]
  /** 量表类型专用：量表配置 */
  scaleConfig?: {
    min: number
    max: number
    step: number
    labels?: { value: number; label: string }[]
  }
}"""

if old_interface in content:
    content = content.replace(old_interface, new_interface)
    with open('src/types/index.ts', 'w', encoding='utf-8') as f:
        f.write(content)
    print('Fixed CRFField interface')
else:
    print('ERROR: Could not find the corrupted interface')
    # Print what's around line 82-110 for debugging
    lines = content.split('\n')
    for i, line in enumerate(lines[80:115], start=81):
        print(f'{i}: {line}')
