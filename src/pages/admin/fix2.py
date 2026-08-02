import re

path = r"C:\Users\huawe\Documents\Kimi\Workspaces\CRF设计\crf-designer\src\pages\admin\ProjectCRFView.tsx"

with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# The old function after the Python script fix
old_func = """  const addModulesToVisit = (moduleIds: string[]) => {
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
  }"""

new_func = """  const addModulesToVisit = (moduleIds: string[]) => {
    if (!activeVisit || readOnly) return
    // 从模块库导入到项目（保持原ID，确保 crfModuleIds 和 crfModules 一致）
    const newProjectModules: CRFModule[] = []

    moduleIds.forEach((mid) => {
      const exists = project.crfModules.find((m) => m.id === mid)
      if (!exists) {
        const libMod = moduleLibrary.find((m) => m.id === mid)
        if (libMod) {
          newProjectModules.push({
            id: libMod.id,
            projectId: project.id,
            name: libMod.name,
            description: libMod.description,
            fields: libMod.fields.map((f) => ({ ...f, id: genId() })),
            order: project.crfModules.length + newProjectModules.length,
          })
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
  }"""

if old_func in content:
    content = content.replace(old_func, new_func)
    print("Replaced successfully")
else:
    print("Old function not found. Searching for partial match...")
    # Try to find the function by its start and end
    start = content.find("const addModulesToVisit = (moduleIds: string[]) => {")
    if start >= 0:
        # Find the matching closing brace
        brace_count = 0
        end = start
        for i in range(start, len(content)):
            if content[i] == "{":
                brace_count += 1
            elif content[i] == "}":
                brace_count -= 1
                if brace_count == 0:
                    end = i + 1
                    break
        content = content[:start] + new_func.strip() + "\n" + content[end:]
        print("Replaced using brace matching")
    else:
        print("Could not find function!")
        exit(1)

with open(path, "w", encoding="utf-8") as f:
    f.write(content)

print("Done")
