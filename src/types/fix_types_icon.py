path = r"C:\Users\huawe\Documents\Kimi\Workspaces\CRF设计\crf-designer\src\types\index.ts"

with open(path, "r", encoding="utf-8") as f:
    content = f.read()

old = """export interface CRFModule {
  id: string
  projectId: string
  name: string
  description?: string
  fields: CRFField[]
  order: number
}"""

new = """export interface CRFModule {
  id: string
  projectId: string
  name: string
  description?: string
  fields: CRFField[]
  order: number
  icon?: string         // lucide 图标名称，如 "Heart", "Activity" 等
  showIcon?: boolean    // 在录入页面是否显示图标，默认 true
}"""

if old in content:
    content = content.replace(old, new)
    print("Types updated")
else:
    print("Pattern not found!")
    exit(1)

with open(path, "w", encoding="utf-8") as f:
    f.write(content)
