import re

path = r"C:\Users\huawe\Documents\Kimi\Workspaces\CRF设计\crf-designer\src\pages\admin\ProjectCRFView.tsx"

with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# Find and replace the addModulesToVisit function
old_func = '''  const addModulesToVisit = (moduleIds: string[]) => {
    if (!activeVisit || readOnly) return
    // 确保这些模块存在于项目中（从库导入的需要先复制到项目）
    const newProjectModules: CRFModule[] = []
    moduleIds.forEach((mid) => {
      const exists = project.crfModules.find((m) => m.id === mid)
      if (!exists) {
        const libMod = moduleLibrary.find((m) => m.id === mid)
        if (libMod) {
          const newMod: CRFModule = {
            id: genId(),
            projectId: project.id,
            name: libMod.name,
            description: libMod.description,
            fields: libMod.fields.map((f) => ({ ...f, id: genId() })),
            order: project.crfModules.length + newProjectModules.length,
          }
          newProjectModules.push(newMod)
        }
      }
    })

    onUpdate((p) => ({
      ...p,
      crfModules: [...p.crfModules, ...newProjectModules],
      visits: p.visits.map((v) =>
        v.id === activeVisit.id
          ? { ...v, crfModuleIds: [...new Set([...v.crfModuleIds, ...moduleIds])] }
          : v
      ),
    }))
  }'''

new_func = '''  const addModulesToVisit = (moduleIds: string[]) => {
    if (!activeVisit || readOnly) return
    // 确保这些模块存在于项目中（从库导入的需要先复制到项目）
    const newProjectModules: CRFModule[] = []
    const idMap = new Map<string, string>() // 原始ID -> 新项目模块ID

    moduleIds.forEach((mid) => {
      const exists = project.crfModules.find((m) => m.id === mid)
      if (exists) {
        // 项目中已存在，直接用原ID
        idMap.set(mid, mid)
      } else {
        const libMod = moduleLibrary.find((m) => m.id === mid)
        if (libMod) {
          const newMod: CRFModule = {
            id: genId(),
            projectId: project.id,
            name: libMod.name,
            description: libMod.description,
            fields: libMod.fields.map((f) => ({ ...f, id: genId() })),
            order: project.crfModules.length + newProjectModules.length,
          }
          newProjectModules.push(newMod)
          idMap.set(mid, newMod.id)
        }
      }
    })

    // 转换 moduleIds 为项目中实际使用的模块ID
    const finalModuleIds = moduleIds.map((mid) => idMap.get(mid) || mid).filter(Boolean) as string[]

    onUpdate((p) => ({
      ...p,
      crfModules: [...p.crfModules, ...newProjectModules],
      visits: p.visits.map((v) =>
        v.id === activeVisit.id
          ? { ...v, crfModuleIds: [...new Set([...v.crfModuleIds, ...finalModuleIds])] }
          : v
      ),
    }))
  }'''

if old_func in content:
    content = content.replace(old_func, new_func)
    print("Fixed addModulesToVisit function")
else:
    print("Could not find exact match, trying regex...")
    # Fallback: search for the problematic line
    if 'crfModuleIds: [...new Set([...v.crfModuleIds, ...moduleIds])]' in content:
        content = content.replace(
            'crfModuleIds: [...new Set([...v.crfModuleIds, ...moduleIds])]',
            'crfModuleIds: [...new Set([...v.crfModuleIds, ...finalModuleIds])]'
        )
        print("Fixed crfModuleIds line")
    else:
        print("Pattern not found!")
        exit(1)

with open(path, "w", encoding="utf-8") as f:
    f.write(content)

print("Done")
