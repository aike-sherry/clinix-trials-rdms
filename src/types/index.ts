// ============================================================
// CLINI X TRIALS-RDMS 核心类型定义
// ============================================================

// ==================== 用户与权限 ====================

/**
 * 角色层级（三级授权体系）：
 * super_admin 超级管理员（小乂临研）→ admin 管理员（后台管理）
 * → manager 课题主持人 → data_entry 数据录入人员
 */
export type UserRole = 'super_admin' | 'admin' | 'manager' | 'data_entry'

/** 可授权的功能模块键（integration / smartCheck 为特殊模块，仅后台可配置） */
export type ModuleKey = 'patients' | 'visits' | 'dataMgmt' | 'statistics' | 'queries' | 'integration' | 'smartCheck'

export interface User {
  id: string
  username: string
  name: string
  role: UserRole
  email?: string
  phone?: string
  department?: string
  organization?: string  // 单位（课题主持人所属医院/机构）
  avatar?: string
  password?: string      // 登录密码（演示环境明文存储；生产环境应哈希）
  mustChangePassword?: boolean  // 首次登录强制修改账号与密码
  createdAt: string
  updatedAt: string
  isActive: boolean
  expiresAt?: string     // 账号结束日期（授权到期）
  grantedBy?: string     // 授权人（用户 ID）
  moduleAccess?: ModuleKey[]  // 已开通的功能模块；undefined 表示全部开通（兼容旧数据）
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
  | 'dateRange'
  | 'select'
  | 'radio'
  | 'checkbox'
  | 'treeSelect'
  | 'toggle'
  | 'label'
  | 'table'
  | 'scale'
  | 'numberRange'
  | 'signature'
  | 'richText'
  | 'fileUpload'
  /** 表格列专用：单位（只读，按行项目从已上传参考范围自动带出，随生效日期匹配版本） */
  | 'unit'
  /** 表格列专用：正常值范围（只读，按行项目+检测日期自动匹配生效版本并显示；偏离判定依据） */
  | 'range'
  /** 表格列专用：判定状态（只读，按数值列与该行生效范围自动判定 ↑偏高/↓偏低） */
  | 'flag'

/** 文件上传组件的单个文件记录 */
export interface UploadedFile {
  name: string
  size: number
  type: string
  /** base64 data URL，用于本地存储与下载 */
  dataUrl: string
}

export interface TreeOption {
  label: string
  value: string
  children?: TreeOption[]
}

/** 树形选择默认示例：SOC 系统器官分类（可在字段配置中修改） */
export const DEFAULT_TREE_OPTIONS: TreeOption[] = [
  {
    label: '心脏疾病',
    value: 'soc_cardiac',
    children: [
      { label: '心力衰竭', value: 'cardiac_hf' },
      { label: '心律失常', value: 'cardiac_arr' },
    ],
  },
  {
    label: '胃肠系统疾病',
    value: 'soc_gi',
    children: [
      { label: '恶心', value: 'gi_nausea' },
      { label: '腹泻', value: 'gi_diarrhea' },
    ],
  },
]

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
  /** 数字类型专用：小数位数限制（如 2 表示保留两位小数） */
  decimals?: number
  /** 表格类型专用：表格列定义 */
  columns?: CRFField[]
  /** 表格类型专用：自动序号。开启后录入端表格首列自动显示行号（只读，随增删行自动重排），无需手动配置序号列 */
  autoRowNumber?: boolean
  /**
   * 表格类型专用：状态随日期自动更新（表格级配置）。
   * 某行日期列（dateCol）有值→状态列（statusCol）显示 filledText（默认「已结束」），
   * 为空→显示 emptyText（默认「持续中」）；录入端状态列渲染为只读徽标
   */
  autoStatus?: {
    dateCol: string
    statusCol: string
    emptyText?: string
    filledText?: string
  }
  /**
   * 表格类型专用：预置行（通用，不限实验室）。
   * 首列（col）内容由设计端固定（如 收缩压/舒张压/心率），录入端行不可增删、首列只读；
   * 不配置则为自由行，执行人员自行增删行
   */
  rowPreset?: {
    col: string
    rows: string[]
  }
  /**
   * 表格类型专用：跨访视矩阵展示（需配合预置行；实验室模式自带矩阵选项，二者互斥）。
   * 行=预置行内容，列=该模块所在访视，valueCol 为每个访视要填写的内容列（文本或数字）
   */
  matrixView?: {
    valueCol: string
    /** 列头是否显示记录日期输入（一次填写整列生效），默认 false */
    showDate?: boolean
  }
  /** 表格列专用：自动状态列。绑定同表某列（通常为日期列），源列有值→filledText，为空→emptyText；录入端渲染为只读徽标 */
  autoStatusFrom?: string
  /** 自动状态列：源列为空时显示文本，默认「持续中」 */
  autoStatusEmpty?: string
  /** 自动状态列：源列有值时显示文本，默认「已结束」 */
  autoStatusFilled?: string
  /** 表格列专用：自动编号列。新增行时按行号自动填充（1,2,3…），删除行后自动重排；录入端只读 */
  autoNumber?: boolean
  /** 表格类型专用：实验室检查模式。行=预置检验项目（录入端不可增删），数值偏离参考范围自动提示偏高/偏低 */
  labConfig?: LabConfig
  /**
   * 表格类型专用：参考范围版本（单位/正常值范围列的数据来源，执行人员在录入端上传，可维护多套）。
   * 非实验室模式的普通表格（如生命体征）加了 单位/正常值范围 列后，范围数据存在这里；
   * 实验室模式下数据存在 labConfig.sets（优先）
   */
  rangeSets?: LabRangeSet[]
  /** 树形选择专用：树形选项（如 SOC 系统器官分类） */
  treeOptions?: TreeOption[]
  /** 量表类型专用：量表配置 */
  scaleConfig?: {
    min: number
    max: number
    step: number
    labels?: { value: number; label: string }[]
  }
  /**
   * 外部数据填充（医院系统抓取，如 HIS/EMR）。
   * enabled 开启后，该字段允许由数据集成服务自动填充；
   * sourceField 为外部系统字段编码/路径（如 EMR 字典码），供部署期接口映射使用；
   * 录入端自动填充的值须人工确认后方可生效（审计追踪要求）
   */
  externalFill?: {
    enabled: boolean
    sourceField?: string
  }
}

// ==================== CRF 模块 ====================

// ==================== 实验室检查模式 ====================

/** 检验项目（一条参考范围记录） */
export interface LabRangeItem {
  name: string        // 项目名，如 白蛋白
  unit?: string       // 单位，如 g/L
  low?: number        // 参考下限
  high?: number       // 参考上限
}

/** 参考范围版本（执行人员在录入端上传，可维护多套；判定所用版本会记入数据留痕） */
export interface LabRangeSet {
  id: string
  name: string          // 版本名，如 2026 版试剂盒标准
  effectiveDate?: string // 启用日期
  uploadedBy?: string   // 上传人
  uploadedAt?: string   // 上传时间
  items: LabRangeItem[]
}

/** 表格字段的实验室检查配置 */
export interface LabConfig {
  itemCol: string   // 项目列（text 类型列名）
  valueCol: string  // 检测值列（number 类型列名）
  /** 检测日期列（date 类型列名）：生效日期判定的依据——检测日期当天及以后适用新生效的范围版本；缺省自动取第一个日期列 */
  dateCol?: string
  /** 正常值范围列：录入端只读，自动显示当前生效参考范围（如 115~150 g/L）；新配置建议直接用 range 类型列 */
  rangeCol?: string
  /** 状态列：录入端只读，系统按检测值与范围自动判定 偏高↑/偏低↓ */
  flagCol?: string
  /** 设计时配置的检验项目清单（只需项目名；单位与正常值范围由执行人员运行时上传后自动带出） */
  items?: LabRangeItem[]
  /** 运行时上传的参考范围版本（不在模块设计中配置） */
  sets: LabRangeSet[]
  /**
   * 录入端展示方式：
   * table（默认）= 单访视表格，每次访视录入一页；
   * matrix = 跨访视检验矩阵，行=检验项目、列=访视，检测日期提到列头一次填写整列生效
   */
  displayMode?: 'table' | 'matrix'
}

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
  fieldLayout?: 'vertical' | 'horizontal'  // 字段布局：上下结构（默认）/ 左右结构
}

// ==================== 访视定义 ====================

export interface Visit {
  id: string
  projectId: string
  name: string          // 显示名称，如 "V0-筛选访视"
  code: string          // 编码，如 "V0"
  order: number
  description?: string
  plannedDay?: number   // 计划访视日：入组/知情后第 N 天
  windowDays?: number   // 访视窗口期：±N 天
  crfModuleIds: string[] // 该访视关联的 CRF 模块 ID 列表
}

// ==================== 项目（课题/研究）====================

export interface Center {
  id: string
  name: string              // 中心名称，如 "上海瑞金医院"
  department?: string       // 研究科室
  investigator?: string     // 主持人
  position?: string         // 职位
  email?: string            // 邮箱
  phone?: string            // 联系方式
}

export interface Project {
  id: string
  projectNo: string              // 项目编号，如 ON101CLCT01
  name: string                   // 项目名称
  sponsor?: string               // 申办方
  principalInvestigator: string  // 主要研究者
  researchCenter: string         // 研究中心（牵头中心）
  centers?: Center[]             // 参与中心列表（多中心研究）
  department?: string            // 研究科室
  status: ProjectStatus
  startDate?: string
  endDate?: string
  targetEnrollment?: number      // 目标入组数
  targetScreening?: number       // 目标筛选例数
  description?: string
  budget?: number                // 预算
  createdAt: string
  updatedAt: string
  createdBy?: string             // 创建者（管理人员ID）
  deployEnv?: 'public' | 'intranet'  // 部署环境：公网部署 / 内网部署（默认公网）
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
  centerId?: string               // 所属中心 ID
  screeningNo: string            // 筛选序号，如 01
  screeningId: string            // 筛选编号，如 001
  randomizationId?: string       // 随机编号，如 CP101
  nameInitials: string           // 姓名缩写
  gender: Gender
  birthDate?: string
  consentDate?: string           // 知情同意日期
  enrollmentDate?: string        // 入组日期
  status: PatientStatus
  screeningFailReason?: string    // 筛选失败原因（登记/筛选阶段）
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
  signedAt?: string             // 研究人员签署确认时间（数据完成后签署）
  signedBy?: string             // 签署人
  reviewedAt?: string           // 管理人员数据确认（审核）时间
  reviewedBy?: string           // 审核人
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
  /** 字段布局：vertical=标签在上控件在下（默认）；horizontal=标签在左控件在右（宽控件自动整行） */
  fieldLayout?: 'vertical' | 'horizontal'
  createdAt: string
  updatedAt: string
}

// ==================== 存储 ====================

/** 审计留痕记录：任何数据变动均记录操作人、时间、对象与变更明细 */
export interface AuditLog {
  id: string
  timestamp: string
  userId: string
  userName: string
  role: UserRole
  action: 'create' | 'update' | 'delete'
  entityType: 'patient' | 'visitData' | 'project' | 'user' | 'moduleLibrary' | 'projectPermission' | 'query' | 'configPackage'
  entityId: string
  entityLabel: string   // 对象中文描述，如「受试者 ZS（SCR-001）」
  summary: string       // 操作摘要
  changes?: { field: string; before: string; after: string }[]  // update 时的字段级变更
}

/** 数据疑问（Query）：管理人员对可疑数据发起，录入端回复，管理人员关闭 */
export interface DataQuery {
  id: string
  visitDataId: string       // 关联的 VisitData 记录
  patientId: string
  projectId: string
  visitId: string
  moduleId: string
  fieldName?: string        // 针对具体字段（可选）
  fieldLabel?: string
  content: string           // 疑问内容
  status: 'open' | 'answered' | 'closed'  // 待回复 / 已回复 / 已关闭
  createdBy: string         // 发起人（管理人员）
  createdByName: string
  createdAt: string
  answer?: string           // 录入端回复
  answeredBy?: string
  answeredAt?: string
  closedBy?: string
  closedAt?: string
}

/** CRF 配置包记录（配置中心：导出发布 / 内网导入留痕） */
export interface ConfigPackage {
  id: string
  projectId: string
  projectNo: string
  projectName: string
  version: string            // v1.0 / v1.1 ...
  mode: 'publish' | 'export' | 'import'  // publish=公网一键发布；export=导出配置包（内网交付）；import=内网导入
  checksum: string           // 配置内容校验码
  visitCount: number
  moduleCount: number
  fieldCount: number
  note?: string
  createdBy: string
  createdAt: string
}

export interface AppStorage {
  users: User[]
  projects: Project[]
  patients: Patient[]
  visitData: VisitData[]
  moduleLibrary: ModuleLibraryItem[]
  projectPermissions: ProjectPermission[]
  auditLogs?: AuditLog[]
  queries?: DataQuery[]
  configPackages?: ConfigPackage[]  // CRF 配置包记录（配置发布）
  // 当前登录用户（session级别，不持久化到localStorage）
  currentUser?: User
}
