path = r"C:\Users\huawe\Documents\Kimi\Workspaces\CRF设计\crf-designer\src\pages\admin\ProjectCRFView.tsx"

with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. 在 CRFConfigurator 中添加 useEffect 导入和自动清理
# 先修改 import { useState, useMemo } from 'react' 为 import { useState, useMemo, useEffect } from 'react'
content = content.replace(
    "import { useState, useMemo } from 'react'",
    "import { useState, useMemo, useEffect } from 'react'"
)
print("1. Added useEffect import")

# 2. 在 CRFConfigurator state 声明之后、sortedVisits 之前添加自动清理 useEffect
old_block = """  const [showModuleInfoDialog, setShowModuleInfoDialog] = useState(false)
  const [editingModuleInfo, setEditingModuleInfo] = useState<CRFModule | null>(null)

  const sortedVisits = useMemo(() => [...project.visits].sort((a, b) => a.order - b.order), [project.visits])"""

new_block = """  const [showModuleInfoDialog, setShowModuleInfoDialog] = useState(false)
  const [editingModuleInfo, setEditingModuleInfo] = useState<CRFModule | null>(null)

  // 自动清理：移除访视中引用但已不存在的模块ID（修复旧数据损坏）
  useEffect(() => {
    const projectModuleIds = new Set(project.crfModules.map((m) => m.id))
    const hasGhostIds = project.visits.some((v) =>
      v.crfModuleIds.some((mid) => !projectModuleIds.has(mid))
    )
    if (hasGhostIds) {
      onUpdate((p) => ({
        ...p,
        visits: p.visits.map((v) => ({
          ...v,
          crfModuleIds: v.crfModuleIds.filter((mid) => projectModuleIds.has(mid)),
        })),
      }))
    }
  }, [project.crfModules.length, project.visits.length])

  const sortedVisits = useMemo(() => [...project.visits].sort((a, b) => a.order - b.order), [project.visits])"""

if old_block in content:
    content = content.replace(old_block, new_block)
    print("2. Added auto-cleanup useEffect")
else:
    print("2. FAILED: could not find state block")

# 3. 修改 AddModuleDialog 的 props，添加 projectModuleIds
old_props = """function AddModuleDialog({
  open,
  onClose,
  moduleLibrary,
  visit,
  onAdd,
}: {
  open: boolean
  onClose: () => void
  moduleLibrary: ModuleLibraryItem[]
  visit: Visit | undefined
  onAdd: (moduleIds: string[]) => void
}) {"""

new_props = """function AddModuleDialog({
  open,
  onClose,
  moduleLibrary,
  visit,
  projectModuleIds,
  onAdd,
}: {
  open: boolean
  onClose: () => void
  moduleLibrary: ModuleLibraryItem[]
  visit: Visit | undefined
  projectModuleIds: Set<string>
  onAdd: (moduleIds: string[]) => void
}) {"""

if old_props in content:
    content = content.replace(old_props, new_props)
    print("3. Added projectModuleIds prop to AddModuleDialog")
else:
    print("3. FAILED: could not find AddModuleDialog props")

# 4. 修改 alreadyAddedIds 逻辑——只包含确实存在于项目中的ID
old_already = "  const alreadyAddedIds = useMemo(() => new Set(visit?.crfModuleIds || []), [visit])"
new_already = "  // 已添加 = 在访视的crfModuleIds中 AND 确实存在于项目模块中\n  const alreadyAddedIds = useMemo(() => {
    const visitIds = visit?.crfModuleIds || []
    return new Set(visitIds.filter((id) => projectModuleIds.has(id)))
  }, [visit, projectModuleIds])"

if old_already in content:
    content = content.replace(old_already, new_already)
    print("4. Fixed alreadyAddedIds logic")
else:
    print("4. FAILED: could not find alreadyAddedIds")

# 5. 在渲染 AddModuleDialog 的地方传入 projectModuleIds
old_render = """      <AddModuleDialog open={showAddModuleDialog} onClose={() => setShowAddModuleDialog(false)} moduleLibrary={moduleLibrary} visit={activeVisit} onAdd={addModulesToVisit} />"""
new_render = """      <AddModuleDialog open={showAddModuleDialog} onClose={() => setShowAddModuleDialog(false)} moduleLibrary={moduleLibrary} visit={activeVisit} projectModuleIds={new Set(project.crfModules.map((m) => m.id))} onAdd={addModulesToVisit} />"""

if old_render in content:
    content = content.replace(old_render, new_render)
    print("5. Passed projectModuleIds to AddModuleDialog")
else:
    print("5. FAILED: could not find AddModuleDialog render")

with open(path, "w", encoding="utf-8") as f:
    f.write(content)

print("All done!")
