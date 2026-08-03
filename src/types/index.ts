// ============================================================
// CLINI X TRIALS-RDMS 核心类型定义
// ============================================================

// ==================== 用户与权限 ====================

export type UserRole = 'manager' | 'admin' | 'data_entry'

export interface User {
  id: string
  username: string
  name: string
  role: UserRole
  email?: string
  phone?: string
  department?: string
  avatar?: string
  createdAt: string
  updatedAt: string
  isActive: boolean
}

/** 项目授权：管理人员将项目授权给数据录入人员 */
export interface ProjectPermission {
  id: string
  projectId: string
  userId: string        // 被授权的数据录入人员ID
  grantedBy: string     // 授权人（管理人员ID）
  grantedAt: string
  canCreatePatient: boolean
  canEditData: boolean
  canViewData: boolean
}

// ==================== 通用 ====================

export type Gender = 'male' | 'female'

export type ProjectStatus =
  | 'proposal_review'   // 立项审核
  | 'contract_signed'   // 合同签署
  | 'ethics_review'     // 伦理审核
  | 'study_started'     // 研究启动
  | 'study_closed'      // 研究关闭
  | 'suspended'         // 暂停
  // 兼容旧数据
  | 'pending'
  | 'active'
  | 'completed'

export type PatientStatus = 'screening' | 'enrolled' | 'treatment' | 'completed' | 'withdrawn' | 'lost'

export type VisitDataStatus = 'not_started' | 'in_progress' | 'completed' | 'locked'

// ==================== 字段定义（CRF 原子）====================

export type FieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'date'
  | 'datetime'
  | 'select'
  | 'radio'
  | 'checkbox'
  | 'toggle'
  | 'label'
  | 'table'
  | 'scale'
  | 'numberRange'
  | 'signature'

export interface FieldOption {
  label: string
  value: string
  /** 选择此选项后是否需要额外输入补充信息 */
  hasExtraInput?: boolean
  extraInputLabel?: string
  extraInputPlaceholder?: string
}

export interface FieldCondition {
  fieldName: string
  operator: 'equals' | 'notEquals' | 'contains' | 'notEmpty'
  value?: string
}

export interface ValidationRule {
  required?: boolean
  minLength?: number
  maxLength?: number
  min?: number
  max?: number
  pattern?: string
  patternMessage?: string
}

export interface CRFField {
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
}

// ==================== CRF 模块 ====================

/** CRF 模块（如：人口学特征、生命体征、实验室检查） */
export interface CRFModule {
  id: string
  projectId: string
  name: string
  description?: string
  fields: CRFField[]
  order: number
  icon?: string         // lucide 图标名称，如 "Heart", "Activity" 等
  showIcon?: boolean    // 在录入页面是否显示图标，默认 true
}

// ==================== 访视定义 ====================

export interface Visit {
  id: string
  projectId: string
  name: string          // 显示名称，如 "V0-筛选访视"
  code: string          // 编码，如 "V0"
  order: number
  description?: string
  crfModuleIds: string[] // 该访视关联的 CRF 模块 ID 列表
}

// ==================== 项目（课题/研究）====================

export interface Project {
  id: string
  projectNo: string              // 项目编号，如 ON101CLCT01
  name: string                   // 项目名称
  sponsor?: string               // 申办方
  principalInvestigator: string  // 主要研究者
  researchCenter: string         // 研究中心
  department?: string            // 研究科室
  status: ProjectStatus
  startDate?: string
  endDate?: string
  targetEnrollment?: number      // 目标入组数
  description?: string
  budget?: number                // 预算
  createdAt: string
  updatedAt: string
  createdBy?: string             // 创建者（管理人员ID）
  // CRF 设计
  visits: Visit[]
  crfModules: CRFModule[]
  crfPublished?: boolean
  crfPublishedAt?: string
}

// ==================== 患者（受试者）====================

export interface Patient {
  id: string
  projectId: string
  screeningNo: string            // 筛选序号，如 01
  screeningId: string            // 筛选编号，如 001
  randomizationId?: string       // 随机编号，如 CP101
  nameInitials: string           // 姓名缩写
  gender: Gender
  birthDate?: string
  consentDate?: string           // 知情同意日期
  enrollmentDate?: string        // 入组日期
  status: PatientStatus
  currentVisit?: string          // 当前访视编码
  nextVisit?: string             // 下次访视编码
  createdAt: string
  updatedAt: string
  createdBy?: string             // 录入人员ID
}

// ==================== 访视数据 ====================

export interface VisitData {
  id: string
  patientId: string
  projectId: string
  visitId: string
  moduleId: string
  data: Record<string, unknown>
  status: VisitDataStatus
  createdAt: string
  updatedAt: string
  createdBy?: string
}

// ==================== 模块库 ====================

export interface ModuleLibraryItem {
  id: string
  name: string
  description?: string
  category: string      // 分类：人口学、生命体征、实验室、病史、不良事件、合并用药等
  fields: CRFField[]
  isSystem: boolean     // 系统预置，不可删除
  createdAt: string
  updatedAt: string
}

// ==================== 存储 ====================

export interface AppStorage {
  users: User[]
  projects: Project[]
  patients: Patient[]
  visitData: VisitData[]
  moduleLibrary: ModuleLibraryItem[]
  projectPermissions: ProjectPermission[]
  // 当前登录用户（session级别，不持久化到localStorage）
  currentUser?: User
}
