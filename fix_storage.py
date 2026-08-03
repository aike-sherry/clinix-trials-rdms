with open('src/hooks/useAppStorage.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Find and replace the entire getInitialData function
old_func = '''function getInitialData(): AppStorage {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as AppStorage
      // 向后兼容：旧数据没有 moduleLibrary 时自动初始化
      if (!parsed.moduleLibrary || parsed.moduleLibrary.length === 0) {
        parsed.moduleLibrary = getDefaultModules()
        localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed))
      }
      return parsed
    }
  } catch {
    // ignore
  }
  const data: AppStorage = {
    users: [],
    projects: [],
    patients: [],
    visitData: [],
    moduleLibrary: getDefaultModules(),
    projectPermissions: [],
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  return data
    users: [],
    projects: [],
    patients: [],
    visitData: [],
    moduleLibrary: getDefaultModules(),
    projectPermissions: [],
  }
    projects: [],
    patients: [],
    visitData: [],
    moduleLibrary: getDefaultModules(),
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  return data
}'''

new_func = '''function getInitialData(): AppStorage {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as AppStorage
      // 向后兼容：旧数据没有 moduleLibrary 时自动初始化
      if (!parsed.moduleLibrary || parsed.moduleLibrary.length === 0) {
        parsed.moduleLibrary = getDefaultModules()
        localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed))
      }
      // 向后兼容：旧数据没有 users / projectPermissions
      if (!parsed.users) parsed.users = []
      if (!parsed.projectPermissions) parsed.projectPermissions = []
      return parsed
    }
  } catch {
    // ignore
  }
  const data: AppStorage = {
    users: [],
    projects: [],
    patients: [],
    visitData: [],
    moduleLibrary: getDefaultModules(),
    projectPermissions: [],
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  return data
}'''

if old_func in content:
    content = content.replace(old_func, new_func)
    with open('src/hooks/useAppStorage.ts', 'w', encoding='utf-8') as f:
        f.write(content)
    print('Fixed getInitialData function')
else:
    print('ERROR: Could not find corrupted function')
    # Print lines 118-155 for debugging
    lines = content.split('\n')
    for i, line in enumerate(lines[117:160], start=118):
        print(f'{i}: {line}')
