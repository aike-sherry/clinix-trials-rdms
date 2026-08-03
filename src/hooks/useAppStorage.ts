import { useState, useCallback } from 'react'
import type { AppStorage, Project, Patient, VisitData, ModuleLibraryItem, CRFField, User, ProjectPermission } from '@/types'
import { getDemoSeed, getDemoProjects } from '@/data/demoSeed'

const STORAGE_KEY = 'clini_x_rdms_data'
const VERSION_KEY = 'clini_x_rdms_version'
const DATA_VERSION = '3' // 数据版本号，变更时自动重置缓存


function genId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

function now() {
  return new Date().toISOString()
}

/** 预置标准模块库 */
function getDefaultModules(): ModuleLibraryItem[] {
  return [
    {
      id: genId(),
      name: '人口学特征',
      description: '受试者基本人口学信息',
      category: '基础信息',
      isSystem: true,
      createdAt: now(),
      updatedAt: now(),
      fields: [
        { id: genId(), type: 'text', label: '姓名', name: 'name', order: 1, validation: { required: true } },
        { id: genId(), type: 'select', label: '性别', name: 'gender', order: 2, validation: { required: true }, options: [{ label: '男', value: 'male' }, { label: '女', value: 'female' }] },
        { id: genId(), type: 'date', label: '出生日期', name: 'birthDate', order: 3, validation: { required: true } },
        { id: genId(), type: 'select', label: '民族', name: 'ethnicity', order: 4, options: [{ label: '汉族', value: 'han' }, { label: '满族', value: 'manchu' }, { label: '蒙古族', value: 'mongol' }, { label: '回族', value: 'hui' }, { label: '藏族', value: 'tibetan' }, { label: '维吾尔族', value: 'uyghur' }, { label: '其他', value: 'other' }] },
        { id: genId(), type: 'number', label: '身高(cm)', name: 'height', order: 5, validation: { min: 50, max: 250 } },
        { id: genId(), type: 'number', label: '体重(kg)', name: 'weight', order: 6, validation: { min: 10, max: 300 } },
        { id: genId(), type: 'number', label: 'BMI', name: 'bmi', order: 7, helpText: '自动计算' },
      ],
    },
    {
      id: genId(),
      name: '生命体征',
      description: '常规生命体征测量',
      category: '检查',
      isSystem: true,
      createdAt: now(),
      updatedAt: now(),
      fields: [
        { id: genId(), type: 'number', label: '收缩压(mmHg)', name: 'systolicBP', order: 1, validation: { required: true, min: 50, max: 250 } },
        { id: genId(), type: 'number', label: '舒张压(mmHg)', name: 'diastolicBP', order: 2, validation: { required: true, min: 30, max: 160 } },
        { id: genId(), type: 'number', label: '脉搏(次/分)', name: 'pulse', order: 3, validation: { required: true, min: 30, max: 200 } },
        { id: genId(), type: 'number', label: '呼吸频率(次/分)', name: 'respiratoryRate', order: 4, validation: { required: true, min: 8, max: 60 } },
        { id: genId(), type: 'number', label: '体温(°C)', name: 'temperature', order: 5, validation: { required: true, min: 35, max: 42 } },
      ],
    },
    {
      id: genId(),
      name: '实验室检查',
      description: '常规实验室检验项目',
      category: '检查',
      isSystem: true,
      createdAt: now(),
      updatedAt: now(),
      fields: [
        { id: genId(), type: 'textarea', label: '血常规', name: 'bloodRoutine', order: 1 },
        { id: genId(), type: 'textarea', label: '尿常规', name: 'urineRoutine', order: 2 },
        { id: genId(), type: 'textarea', label: '肝功能', name: 'liverFunction', order: 3 },
        { id: genId(), type: 'textarea', label: '肾功能', name: 'kidneyFunction', order: 4 },
        { id: genId(), type: 'textarea', label: '凝血功能', name: 'coagulation', order: 5 },
      ],
    },
    {
      id: genId(),
      name: '病史采集',
      description: '既往病史及相关信息采集',
      category: '基础信息',
      isSystem: true,
      createdAt: now(),
      updatedAt: now(),
      fields: [
        { id: genId(), type: 'textarea', label: '既往病史', name: 'pastMedicalHistory', order: 1 },
        { id: genId(), type: 'textarea', label: '过敏史', name: 'allergyHistory', order: 2 },
        { id: genId(), type: 'textarea', label: '用药史', name: 'medicationHistory', order: 3 },
        { id: genId(), type: 'textarea', label: '家族史', name: 'familyHistory', order: 4 },
      ],
    },
    {
      id: genId(),
      name: '不良事件',
      description: '不良事件报告信息',
      category: '安全',
      isSystem: true,
      createdAt: now(),
      updatedAt: now(),
      fields: [
        { id: genId(), type: 'text', label: '事件名称', name: 'eventName', order: 1, validation: { required: true } },
        { id: genId(), type: 'date', label: '发生日期', name: 'onsetDate', order: 2, validation: { required: true } },
        { id: genId(), type: 'select', label: '严重程度', name: 'severity', order: 3, options: [{ label: '轻度', value: 'mild' }, { label: '中度', value: 'moderate' }, { label: '重度', value: 'severe' }, { label: '危及生命', value: 'life_threatening' }] },
        { id: genId(), type: 'textarea', label: '处理措施', name: 'actionTaken', order: 4 },
        { id: genId(), type: 'select', label: '转归', name: 'outcome', order: 5, options: [{ label: '恢复', value: 'recovered' }, { label: '恢复伴后遗症', value: 'recovered_with_sequelae' }, { label: '未恢复', value: 'not_recovered' }, { label: '死亡', value: 'fatal' }, { label: '未知', value: 'unknown' }] },
      ],
    },
    {
      id: genId(),
      name: '合并用药',
      description: '合并用药记录',
      category: '用药',
      isSystem: true,
      createdAt: now(),
      updatedAt: now(),
      fields: [
        { id: genId(), type: 'text', label: '药物名称', name: 'drugName', order: 1, validation: { required: true } },
        { id: genId(), type: 'text', label: '剂量', name: 'dose', order: 2 },
        { id: genId(), type: 'text', label: '频次', name: 'frequency', order: 3 },
        { id: genId(), type: 'date', label: '开始日期', name: 'startDate', order: 4 },
        { id: genId(), type: 'date', label: '结束日期', name: 'endDate', order: 5 },
        { id: genId(), type: 'textarea', label: '用药原因', name: 'indication', order: 6 },
      ],
    },
  ]
}

function getInitialData(): AppStorage {
  try {
    // 版本号检查：不匹配则重置缓存（保留登录会话）
    const storedVersion = localStorage.getItem(VERSION_KEY)
    let preservedUser: AppStorage['currentUser']
    if (storedVersion !== DATA_VERSION) {
      try {
        const oldRaw = localStorage.getItem(STORAGE_KEY)
        if (oldRaw) preservedUser = (JSON.parse(oldRaw) as AppStorage).currentUser
      } catch {
        // ignore
      }
      localStorage.removeItem(STORAGE_KEY)
      localStorage.setItem(VERSION_KEY, DATA_VERSION)
    }

    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as AppStorage
      // 向后兼容：旧数据没有 moduleLibrary 时自动初始化
      if (!parsed.moduleLibrary || parsed.moduleLibrary.length === 0) {
        parsed.moduleLibrary = getDefaultModules()
        localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed))
      }
      // 向后兼容：旧数据没有 users / projectPermissions / projects / patients / visitData
      if (!parsed.users) parsed.users = []
      if (!parsed.projectPermissions) parsed.projectPermissions = []
      if (!parsed.projects || parsed.projects.length === 0) parsed.projects = getDemoProjects()
      if (!parsed.patients) parsed.patients = []
      if (!parsed.visitData) parsed.visitData = []
      return parsed
    }
    const demo = getDemoSeed()
    const data: AppStorage = {
      users: demo.users,
      projects: demo.projects,
      patients: demo.patients,
      visitData: demo.visitData,
      moduleLibrary: getDefaultModules(),
      projectPermissions: demo.projectPermissions,
      ...(preservedUser ? { currentUser: preservedUser } : {}),
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    localStorage.setItem(VERSION_KEY, DATA_VERSION)
    return data
  } catch {
    // ignore
  }
  const demo = getDemoSeed()
  const data: AppStorage = {
    users: demo.users,
    projects: demo.projects,
    patients: demo.patients,
    visitData: demo.visitData,
    moduleLibrary: getDefaultModules(),
    projectPermissions: demo.projectPermissions,
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  localStorage.setItem(VERSION_KEY, DATA_VERSION)
  return data
}

function save(data: AppStorage) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

export function useAppStorage() {
  const [data, setData] = useState<AppStorage>(getInitialData)

  const refresh = useCallback(() => {
    setData(getInitialData())
  }, [])

  // ========== Project ==========
  const saveProject = useCallback((project: Project) => {
    setData((prev) => {
      const exists = prev.projects.find((p) => p.id === project.id)
      let next: AppStorage
      if (exists) {
        next = {
          ...prev,
          projects: prev.projects.map((p) => (p.id === project.id ? project : p)),
        }
      } else {
        next = { ...prev, projects: [...prev.projects, project] }
      }
      save(next)
      return next
    })
  }, [])

  const deleteProject = useCallback((id: string) => {
    setData((prev) => {
      const next = {
        ...prev,
        projects: prev.projects.filter((p) => p.id !== id),
        patients: prev.patients.filter((p) => p.projectId !== id),
        visitData: prev.visitData.filter((v) => v.projectId !== id),
      }
      save(next)
      return next
    })
  }, [])

  // ========== Patient ==========
  const savePatient = useCallback((patient: Patient) => {
    setData((prev) => {
      const exists = prev.patients.find((p) => p.id === patient.id)
      let next: AppStorage
      if (exists) {
        next = {
          ...prev,
          patients: prev.patients.map((p) => (p.id === patient.id ? patient : p)),
        }
      } else {
        next = { ...prev, patients: [...prev.patients, patient] }
      }
      save(next)
      return next
    })
  }, [])

  const deletePatient = useCallback((id: string) => {
    setData((prev) => {
      const next = {
        ...prev,
        patients: prev.patients.filter((p) => p.id !== id),
        visitData: prev.visitData.filter((v) => v.patientId !== id),
      }
      save(next)
      return next
    })
  }, [])

  // ========== VisitData ==========
  const saveVisitData = useCallback((vd: VisitData) => {
    setData((prev) => {
      const exists = prev.visitData.find(
        (v) => v.patientId === vd.patientId && v.visitId === vd.visitId && v.moduleId === vd.moduleId
      )
      let next: AppStorage
      if (exists) {
        next = {
          ...prev,
          visitData: prev.visitData.map((v) =>
            v.patientId === vd.patientId && v.visitId === vd.visitId && v.moduleId === vd.moduleId ? vd : v
          ),
        }
      } else {
        next = { ...prev, visitData: [...prev.visitData, vd] }
      }
      save(next)
      return next
    })
  }, [])

  // ========== User ==========
  const saveUser = useCallback((user: User) => {
    setData((prev) => {
      const exists = prev.users.find((u) => u.id === user.id)
      let next: AppStorage
      if (exists) {
        next = {
          ...prev,
          users: prev.users.map((u) => (u.id === user.id ? user : u)),
        }
      } else {
        next = { ...prev, users: [...prev.users, user] }
      }
      save(next)
      return next
    })
  }, [])

  const deleteUser = useCallback((id: string) => {
    setData((prev) => {
      const next = {
        ...prev,
        users: prev.users.filter((u) => u.id !== id),
        projectPermissions: prev.projectPermissions.filter((p) => p.userId !== id),
      }
      save(next)
      return next
    })
  }, [])

  // ========== Project Permission ==========
  const saveProjectPermission = useCallback((perm: ProjectPermission) => {
    setData((prev) => {
      const exists = prev.projectPermissions.find((p) => p.id === perm.id)
      let next: AppStorage
      if (exists) {
        next = {
          ...prev,
          projectPermissions: prev.projectPermissions.map((p) => (p.id === perm.id ? perm : p)),
        }
      } else {
        next = { ...prev, projectPermissions: [...prev.projectPermissions, perm] }
      }
      save(next)
      return next
    })
  }, [])

  const deleteProjectPermission = useCallback((id: string) => {
    setData((prev) => {
      const next = {
        ...prev,
        projectPermissions: prev.projectPermissions.filter((p) => p.id !== id),
      }
      save(next)
      return next
    })
  }, [])

  // ========== Module Library ==========
  const saveModuleLibraryItem = useCallback((item: ModuleLibraryItem) => {
    setData((prev) => {
      const exists = prev.moduleLibrary.find((m) => m.id === item.id)
      let next: AppStorage
      if (exists) {
        next = {
          ...prev,
          moduleLibrary: prev.moduleLibrary.map((m) => (m.id === item.id ? item : m)),
        }
      } else {
        next = { ...prev, moduleLibrary: [...prev.moduleLibrary, item] }
      }
      save(next)
      return next
    })
  }, [])

  const deleteModuleLibraryItem = useCallback((id: string) => {
    setData((prev) => {
      const next = {
        ...prev,
        moduleLibrary: prev.moduleLibrary.filter((m) => m.id !== id),
      }
      save(next)
      return next
    })
  }, [])

  const addModuleLibraryField = useCallback((moduleId: string, field: CRFField) => {
    setData((prev) => {
      const module = prev.moduleLibrary.find((m) => m.id === moduleId)
      if (!module) return prev
      const next = {
        ...prev,
        moduleLibrary: prev.moduleLibrary.map((m) =>
          m.id === moduleId ? { ...m, fields: [...m.fields, field], updatedAt: now() } : m
        ),
      }
      save(next)
      return next
    })
  }, [])

  const updateModuleLibraryField = useCallback((moduleId: string, field: CRFField) => {
    setData((prev) => {
      const module = prev.moduleLibrary.find((m) => m.id === moduleId)
      if (!module) return prev
      const next = {
        ...prev,
        moduleLibrary: prev.moduleLibrary.map((m) =>
          m.id === moduleId
            ? { ...m, fields: m.fields.map((f) => (f.id === field.id ? field : f)), updatedAt: now() }
            : m
        ),
      }
      save(next)
      return next
    })
  }, [])

  const deleteModuleLibraryField = useCallback((moduleId: string, fieldId: string) => {
    setData((prev) => {
      const module = prev.moduleLibrary.find((m) => m.id === moduleId)
      if (!module) return prev
      const next = {
        ...prev,
        moduleLibrary: prev.moduleLibrary.map((m) =>
          m.id === moduleId
            ? { ...m, fields: m.fields.filter((f) => f.id !== fieldId), updatedAt: now() }
            : m
        ),
      }
      save(next)
      return next
    })
  }, [])

  const reorderModuleLibrary = useCallback((newOrder: ModuleLibraryItem[]) => {
    setData((prev) => {
      const next = { ...prev, moduleLibrary: newOrder }
      save(next)
      return next
    })
  }, [])

  const reorderModuleLibraryFields = useCallback((moduleId: string, newFields: CRFField[]) => {
    setData((prev) => {
      const module = prev.moduleLibrary.find((m) => m.id === moduleId)
      if (!module) return prev
      const next = {
        ...prev,
        moduleLibrary: prev.moduleLibrary.map((m) =>
          m.id === moduleId ? { ...m, fields: newFields, updatedAt: now() } : m
        ),
      }
      save(next)
      return next
    })
  }, [])

  return {
    users: data.users,
    projects: data.projects,
    patients: data.patients,
    visitData: data.visitData,
    moduleLibrary: data.moduleLibrary,
    projectPermissions: data.projectPermissions,
    refresh,
    saveProject,
    deleteProject,
    savePatient,
    deletePatient,
    saveVisitData,
    saveUser,
    deleteUser,
    saveProjectPermission,
    deleteProjectPermission,
    saveModuleLibraryItem,
    deleteModuleLibraryItem,
    addModuleLibraryField,
    updateModuleLibraryField,
    deleteModuleLibraryField,
    reorderModuleLibrary,
    reorderModuleLibraryFields,
  }
}
