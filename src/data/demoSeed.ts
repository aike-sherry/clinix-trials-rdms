// ============================================================
// 演示数据种子：项目 + CRF 设计 + 患者 + 访视数据 + 用户 + 授权
// 仅在全新初始化（或数据版本升级重置）时写入 localStorage
// ============================================================

import type {
  AppStorage,
  CRFModule,
  CRFField,
  Patient,
  PatientStatus,
  Project,
  ProjectPermission,
  User,
  Visit,
  VisitData,
} from '@/types'

// ---------- 基础工具 ----------

/** 确定性伪随机（保证每次初始化生成相同数据） */
function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const rnd = mulberry32(20260803)
const pick = <T,>(arr: T[]): T => arr[Math.floor(rnd() * arr.length)]
const int = (min: number, max: number) => min + Math.floor(rnd() * (max - min + 1))
const float1 = (min: number, max: number) => Math.round((min + rnd() * (max - min)) * 10) / 10

let fieldSeq = 0
const fid = () => `fld_demo_${(++fieldSeq).toString().padStart(3, '0')}`

const T = '2026-08-03T08:00:00.000Z'

function addDays(iso: string, days: number): string {
  const d = new Date(iso)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

// ---------- CRF 字段快捷构造 ----------

const fText = (label: string, name: string, order: number, required = false): CRFField => ({
  id: fid(), type: 'text', label, name, order, validation: required ? { required: true } : undefined,
})
const fTextarea = (label: string, name: string, order: number): CRFField => ({
  id: fid(), type: 'textarea', label, name, order,
})
const fNum = (label: string, name: string, order: number, min?: number, max?: number, required = false): CRFField => ({
  id: fid(), type: 'number', label, name, order, validation: { required, min, max },
})
const fDate = (label: string, name: string, order: number, required = false): CRFField => ({
  id: fid(), type: 'date', label, name, order, validation: required ? { required: true } : undefined,
})
const fSelect = (label: string, name: string, order: number, options: [string, string][], required = false): CRFField => ({
  id: fid(), type: 'select', label, name, order,
  options: options.map(([l, v]) => ({ label: l, value: v })),
  validation: required ? { required: true } : undefined,
})

const GENDER_OPTS: [string, string][] = [['男', 'male'], ['女', 'female']]
const SEVERITY_OPTS: [string, string][] = [['轻度', 'mild'], ['中度', 'moderate'], ['重度', 'severe']]
const OUTCOME_OPTS: [string, string][] = [['恢复', 'recovered'], ['恢复伴后遗症', 'recovered_with_sequelae'], ['未恢复', 'not_recovered']]

// ---------- 模块模板（按项目生成独立 ID） ----------

function demoModule(projectId: string, id: string): CRFModule {
  return {
    id, projectId, name: '人口学特征', description: '受试者基本人口学信息', order: 1,
    fields: [
      fText('姓名', 'name', 1, true),
      fSelect('性别', 'gender', 2, GENDER_OPTS, true),
      fDate('出生日期', 'birthDate', 3, true),
      fNum('身高(cm)', 'height', 4, 140, 200),
      fNum('体重(kg)', 'weight', 5, 35, 120),
    ],
  }
}

function historyModule(projectId: string, id: string): CRFModule {
  return {
    id, projectId, name: '病史采集', description: '既往病史及相关信息', order: 2,
    fields: [
      fTextarea('既往病史', 'pastMedicalHistory', 1),
      fTextarea('过敏史', 'allergyHistory', 2),
      fTextarea('用药史', 'medicationHistory', 3),
      fTextarea('家族史', 'familyHistory', 4),
    ],
  }
}

function vitalModule(projectId: string, id: string, order: number): CRFModule {
  return {
    id, projectId, name: '生命体征', description: '常规生命体征测量', order,
    fields: [
      fNum('收缩压(mmHg)', 'systolicBP', 1, 80, 200, true),
      fNum('舒张压(mmHg)', 'diastolicBP', 2, 50, 130, true),
      fNum('脉搏(次/分)', 'pulse', 3, 50, 120, true),
      fNum('呼吸频率(次/分)', 'respiratoryRate', 4, 10, 30),
      fNum('体温(°C)', 'temperature', 5, 35, 42),
    ],
  }
}

function labModule(projectId: string, id: string, order: number): CRFModule {
  return {
    id, projectId, name: '实验室检查', description: '常规实验室检验', order,
    fields: [
      fNum('血红蛋白(g/L)', 'hemoglobin', 1, 60, 200),
      fNum('白细胞计数(×10⁹/L)', 'wbc', 2, 2, 30),
      fNum('血小板计数(×10⁹/L)', 'platelet', 3, 50, 500),
      fNum('ALT(U/L)', 'alt', 4, 5, 200),
      fNum('肌酐(μmol/L)', 'creatinine', 5, 30, 300),
    ],
  }
}

function aeModule(projectId: string, id: string, order: number): CRFModule {
  return {
    id, projectId, name: '不良事件', description: '不良事件报告', order,
    fields: [
      fText('事件名称', 'eventName', 1, true),
      fDate('发生日期', 'onsetDate', 2, true),
      fSelect('严重程度', 'severity', 3, SEVERITY_OPTS),
      fTextarea('处理措施', 'actionTaken', 4),
      fSelect('转归', 'outcome', 5, OUTCOME_OPTS),
    ],
  }
}

// ---------- 项目 1：软坚清脉法（进行最充分） ----------

const P1 = 'proj_cn101'
const P1_MOD = { demo: 'mod_p1_demo', history: 'mod_p1_history', vital: 'mod_p1_vital', lab: 'mod_p1_lab', efficacy: 'mod_p1_efficacy', ae: 'mod_p1_ae' }

function p1Modules(): CRFModule[] {
  return [
    demoModule(P1, P1_MOD.demo),
    historyModule(P1, P1_MOD.history),
    vitalModule(P1, P1_MOD.vital, 3),
    labModule(P1, P1_MOD.lab, 4),
    {
      id: P1_MOD.efficacy, projectId: P1, name: '疗效评价', description: '下肢动脉硬化闭塞症疗效指标', order: 5,
      fields: [
        fNum('踝肱指数 ABI（左）', 'abiLeft', 1, 0.3, 1.4),
        fNum('踝肱指数 ABI（右）', 'abiRight', 2, 0.3, 1.4),
        fNum('无痛行走距离(m)', 'walkingDistance', 3, 0, 2000),
        fNum('疼痛评分 VAS（0-10）', 'vasScore', 4, 0, 10),
      ],
    },
    aeModule(P1, P1_MOD.ae, 6),
  ]
}

function p1Visits(): Visit[] {
  const mk = (id: string, name: string, code: string, order: number, mods: string[]): Visit => ({
    id, projectId: P1, name, code, order, crfModuleIds: mods,
  })
  return [
    mk('visit_p1_v0', '筛选访视', 'V0', 0, [P1_MOD.demo, P1_MOD.history, P1_MOD.vital, P1_MOD.lab]),
    mk('visit_p1_v1', '基线访视', 'V1', 1, [P1_MOD.vital, P1_MOD.lab, P1_MOD.efficacy]),
    mk('visit_p1_v2', '治疗 4 周', 'V2', 2, [P1_MOD.vital, P1_MOD.efficacy]),
    mk('visit_p1_v3', '治疗 8 周', 'V3', 3, [P1_MOD.vital, P1_MOD.lab, P1_MOD.efficacy]),
    mk('visit_p1_v4', '治疗 12 周', 'V4', 4, [P1_MOD.vital, P1_MOD.efficacy, P1_MOD.ae]),
    mk('visit_p1_v5', '随访', 'V5', 5, [P1_MOD.vital, P1_MOD.efficacy]),
  ]
}

// ---------- 项目 2：GLP-1 糖尿病 ----------

const P2 = 'proj_cn102'
const P2_MOD = { demo: 'mod_p2_demo', vital: 'mod_p2_vital', glucose: 'mod_p2_glucose', med: 'mod_p2_med', ae: 'mod_p2_ae' }

function p2Modules(): CRFModule[] {
  return [
    demoModule(P2, P2_MOD.demo),
    vitalModule(P2, P2_MOD.vital, 2),
    {
      id: P2_MOD.glucose, projectId: P2, name: '血糖监测', description: '血糖相关指标', order: 3,
      fields: [
        fNum('空腹血糖(mmol/L)', 'fastingGlucose', 1, 3, 20, true),
        fNum('餐后 2h 血糖(mmol/L)', 'postprandialGlucose', 2, 3, 30),
        fNum('糖化血红蛋白 HbA1c(%)', 'hba1c', 3, 4, 15, true),
      ],
    },
    {
      id: P2_MOD.med, projectId: P2, name: '合并用药', description: '合并用药记录', order: 4,
      fields: [
        fText('药物名称', 'drugName', 1, true),
        fText('剂量', 'dose', 2),
        fText('频次', 'frequency', 3),
        fDate('开始日期', 'startDate', 4),
      ],
    },
    aeModule(P2, P2_MOD.ae, 5),
  ]
}

function p2Visits(): Visit[] {
  const mk = (id: string, name: string, code: string, order: number, mods: string[]): Visit => ({
    id, projectId: P2, name, code, order, crfModuleIds: mods,
  })
  return [
    mk('visit_p2_v0', '筛选访视', 'V0', 0, [P2_MOD.demo, P2_MOD.vital, P2_MOD.glucose]),
    mk('visit_p2_v1', '基线访视', 'V1', 1, [P2_MOD.vital, P2_MOD.glucose, P2_MOD.med]),
    mk('visit_p2_v2', '治疗 12 周', 'V2', 2, [P2_MOD.vital, P2_MOD.glucose]),
    mk('visit_p2_v3', '治疗 24 周', 'V3', 3, [P2_MOD.vital, P2_MOD.glucose, P2_MOD.ae]),
  ]
}

// ---------- 项目 3：烧伤敷料（伦理审核中，CRF 已设计未发布） ----------

const P3 = 'proj_cn103'

function p3Modules(): CRFModule[] {
  return [
    demoModule(P3, 'mod_p3_demo'),
    vitalModule(P3, 'mod_p3_vital', 2),
    {
      id: 'mod_p3_wound', projectId: P3, name: '创面评估', description: '烧伤创面评估记录', order: 3,
      fields: [
        fNum('创面面积(cm²)', 'woundArea', 1, 1, 500, true),
        fSelect('创面深度', 'woundDepth', 2, [['浅 II 度', 'superficial_2'], ['深 II 度', 'deep_2'], ['III 度', 'third']], true),
        fNum('创面愈合率(%)', 'healingRate', 3, 0, 100),
      ],
    },
  ]
}

function p3Visits(): Visit[] {
  return [
    { id: 'visit_p3_v0', projectId: P3, name: '筛选访视', code: 'V0', order: 0, crfModuleIds: ['mod_p3_demo', 'mod_p3_vital', 'mod_p3_wound'] },
    { id: 'visit_p3_v1', name: '治疗 7 天', code: 'V1', order: 1, projectId: P3, crfModuleIds: ['mod_p3_vital', 'mod_p3_wound'] },
    { id: 'visit_p3_v2', name: '治疗 14 天', code: 'V2', order: 2, projectId: P3, crfModuleIds: ['mod_p3_vital', 'mod_p3_wound'] },
  ]
}

// ---------- 项目 5：已关闭研究 ----------

const P5 = 'proj_cn105'

function p5Modules(): CRFModule[] {
  return [demoModule(P5, 'mod_p5_demo'), vitalModule(P5, 'mod_p5_vital', 2)]
}

function p5Visits(): Visit[] {
  return [
    { id: 'visit_p5_v0', projectId: P5, name: '筛选访视', code: 'V0', order: 0, crfModuleIds: ['mod_p5_demo', 'mod_p5_vital'] },
    { id: 'visit_p5_v1', projectId: P5, name: '末次访视', code: 'V1', order: 1, crfModuleIds: ['mod_p5_vital'] },
  ]
}

// ---------- 项目列表 ----------

export function getDemoProjects(): Project[] {
  return [
    {
      id: P1, projectNo: 'CN101CLCT06',
      name: '软坚清脉法治疗下肢动脉硬化闭塞症的多中心临床研究',
      sponsor: '上海瑞金医院 / 海和药物', principalInvestigator: '张慈',
      researchCenter: '上海瑞金医院', department: '内分泌科',
      status: 'study_started', startDate: '2025-03-01', endDate: '2026-12-31',
      targetEnrollment: 120, budget: 500000,
      description: '评估软坚清脉法治疗下肢动脉硬化闭塞症的临床疗效和安全性',
      createdAt: '2025-02-20T09:00:00.000Z', updatedAt: T,
      visits: p1Visits(), crfModules: p1Modules(),
      crfPublished: true, crfPublishedAt: '2025-02-28T10:00:00.000Z',
    },
    {
      id: P2, projectNo: 'CN102CLCT11',
      name: '新型 GLP-1 受体激动剂治疗 2 型糖尿病的 III 期临床研究',
      sponsor: '海和药物', principalInvestigator: '张慈',
      researchCenter: '北京协和医院', department: '内分泌科',
      status: 'study_started', startDate: '2025-01-15', endDate: '2026-06-30',
      targetEnrollment: 200, budget: 800000,
      description: '评估新型 GLP-1 受体激动剂治疗 2 型糖尿病患者的有效性和安全性',
      createdAt: '2025-01-05T09:00:00.000Z', updatedAt: T,
      visits: p2Visits(), crfModules: p2Modules(),
      crfPublished: true, crfPublishedAt: '2025-01-12T10:00:00.000Z',
    },
    {
      id: P3, projectNo: 'CN103CLCT02',
      name: '烧伤创面修复新型敷料的随机对照临床试验',
      sponsor: '上海烧伤研究所', principalInvestigator: '李华',
      researchCenter: '上海第九人民医院', department: '烧伤整形科',
      status: 'ethics_review', startDate: '2025-06-01', endDate: '2026-12-31',
      targetEnrollment: 80, budget: 350000,
      description: '比较新型生物敷料与传统敷料在烧伤创面修复中的疗效差异',
      createdAt: '2025-05-10T09:00:00.000Z', updatedAt: T,
      visits: p3Visits(), crfModules: p3Modules(),
      crfPublished: false,
    },
    {
      id: 'proj_cn104', projectNo: 'CN104CLCT09',
      name: '中药复方治疗慢性心力衰竭的临床疗效评价研究',
      sponsor: '中国中医科学院', principalInvestigator: '王建国',
      researchCenter: '广安门医院', department: '心血管科',
      status: 'contract_signed', startDate: '2025-09-01', endDate: '2027-03-31',
      targetEnrollment: 150, budget: 600000,
      description: '评价中药复方在慢性心力衰竭患者中的疗效和安全性',
      createdAt: '2025-08-01T09:00:00.000Z', updatedAt: T,
      visits: [], crfModules: [],
    },
    {
      id: P5, projectNo: 'CN105CLCT03',
      name: '穴位贴敷治疗慢性阻塞性肺疾病的临床观察研究',
      sponsor: '江苏大学附属医院', principalInvestigator: '陈明远',
      researchCenter: '江苏大学附属医院', department: '呼吸与危重症医学科',
      status: 'study_closed', startDate: '2023-06-01', endDate: '2025-05-31',
      targetEnrollment: 60, budget: 200000,
      description: '观察穴位贴敷联合常规治疗对慢性阻塞性肺疾病稳定期患者的疗效',
      createdAt: '2023-05-15T09:00:00.000Z', updatedAt: T,
      visits: p5Visits(), crfModules: p5Modules(),
      crfPublished: true, crfPublishedAt: '2023-05-28T10:00:00.000Z',
    },
  ]
}

// ---------- 患者 ----------

const INITIALS = ['ZXM', 'WLQ', 'LYF', 'CHJ', 'ZWT', 'LXM', 'YHQ', 'HWB', 'XUJ', 'SUN', 'ZHL', 'WXY', 'LJB', 'ZQT', 'CFY', 'YMX', 'HLN', 'GJW', 'XQL', 'DYN', 'JWX', 'CXY', 'LSQ', 'ZKX', 'WMY', 'LHT']

interface PatientSpec {
  status: PatientStatus
  visitIdx: number // 当前所在访视下标
}

function buildPatients(
  projectId: string,
  projectStart: string,
  randPrefix: string,
  specs: PatientSpec[],
  initialsOffset: number,
): Patient[] {
  return specs.map((spec, i) => {
    const no = String(i + 1).padStart(2, '0')
    const consentDate = addDays(projectStart, 5 + i * 11)
    const enrolled = spec.status !== 'screening'
    const enrollmentDate = enrolled ? addDays(consentDate, 7) : undefined
    const visits = projectId === P1 ? p1VisitCodes : projectId === P2 ? p2VisitCodes : p5VisitCodes
    const currentVisit = visits[spec.visitIdx]
    const nextVisit = spec.status === 'completed' || spec.status === 'withdrawn' || spec.status === 'lost'
      ? undefined
      : visits[Math.min(spec.visitIdx + 1, visits.length - 1)]
    return {
      id: `pat_${projectId}_${no}`,
      projectId,
      screeningNo: no,
      screeningId: String(i + 1).padStart(3, '0'),
      randomizationId: enrolled && spec.status !== 'withdrawn' ? `${randPrefix}${String(i + 1).padStart(3, '0')}` : undefined,
      nameInitials: INITIALS[(initialsOffset + i) % INITIALS.length],
      gender: rnd() > 0.45 ? 'male' : 'female',
      birthDate: `${int(1945, 1982)}-${String(int(1, 12)).padStart(2, '0')}-${String(int(1, 28)).padStart(2, '0')}`,
      consentDate,
      enrollmentDate,
      status: spec.status,
      currentVisit,
      nextVisit,
      createdAt: `${consentDate}T09:00:00.000Z`,
      updatedAt: T,
      createdBy: 'user_entry_01',
    }
  })
}

const p1VisitCodes = ['V0', 'V1', 'V2', 'V3', 'V4', 'V5']
const p2VisitCodes = ['V0', 'V1', 'V2', 'V3']
const p5VisitCodes = ['V0', 'V1']

export function getDemoPatients(): Patient[] {
  const p1Specs: PatientSpec[] = [
    ...Array.from({ length: 4 }, () => ({ status: 'completed' as const, visitIdx: 5 })),
    ...Array.from({ length: 5 }, (_, i) => ({ status: 'treatment' as const, visitIdx: 4 - (i % 3) })),
    ...Array.from({ length: 6 }, (_, i) => ({ status: 'treatment' as const, visitIdx: 2 + (i % 2) })),
    ...Array.from({ length: 5 }, () => ({ status: 'enrolled' as const, visitIdx: 1 })),
    ...Array.from({ length: 3 }, () => ({ status: 'screening' as const, visitIdx: 0 })),
    { status: 'withdrawn', visitIdx: 2 },
    { status: 'withdrawn', visitIdx: 3 },
    { status: 'lost', visitIdx: 2 },
  ]
  const p2Specs: PatientSpec[] = [
    ...Array.from({ length: 2 }, () => ({ status: 'completed' as const, visitIdx: 3 })),
    ...Array.from({ length: 7 }, () => ({ status: 'treatment' as const, visitIdx: 2 })),
    ...Array.from({ length: 4 }, () => ({ status: 'enrolled' as const, visitIdx: 1 })),
    ...Array.from({ length: 2 }, () => ({ status: 'screening' as const, visitIdx: 0 })),
    { status: 'withdrawn', visitIdx: 2 },
  ]
  const p5Specs: PatientSpec[] = Array.from({ length: 8 }, () => ({ status: 'completed' as const, visitIdx: 1 }))
  return [
    ...buildPatients(P1, '2025-03-01', 'RJ', p1Specs, 0),
    ...buildPatients(P2, '2025-01-15', 'GLP', p2Specs, 9),
    ...buildPatients(P5, '2023-06-01', 'XA', p5Specs, 17),
  ]
}

// ---------- 访视数据 ----------

const AE_NAMES = ['轻度恶心', '头晕', '皮疹', '注射部位疼痛', '腹泻', '乏力']
const MED_NAMES: [string, string, string][] = [
  ['二甲双胍', '0.5g', '每日两次'],
  ['阿司匹林', '100mg', '每日一次'],
  ['阿托伐他汀', '20mg', '每晚一次'],
  ['缬沙坦', '80mg', '每日一次'],
]

function fieldValue(name: string, type: string, options: { value: string }[] | undefined, visitDate: string): unknown {
  switch (name) {
    case 'name': return pick(['张三', '李四', '王五', '赵六', '陈七'])
    case 'gender': return rnd() > 0.45 ? 'male' : 'female'
    case 'birthDate': return `${int(1945, 1982)}-0${int(1, 9)}-1${int(0, 9)}`
    case 'height': return int(152, 184)
    case 'weight': return int(48, 92)
    case 'systolicBP': return int(112, 148)
    case 'diastolicBP': return int(68, 92)
    case 'pulse': return int(62, 92)
    case 'respiratoryRate': return int(14, 19)
    case 'temperature': return float1(36.2, 37.1)
    case 'hemoglobin': return int(105, 158)
    case 'wbc': return float1(3.8, 10.5)
    case 'platelet': return int(110, 320)
    case 'alt': return int(12, 46)
    case 'creatinine': return int(52, 108)
    case 'abiLeft': return float1(0.62, 1.12)
    case 'abiRight': return float1(0.65, 1.15)
    case 'walkingDistance': return int(120, 980)
    case 'vasScore': return int(1, 7)
    case 'fastingGlucose': return float1(5.4, 10.8)
    case 'postprandialGlucose': return float1(7.2, 15.6)
    case 'hba1c': return float1(6.2, 10.4)
    case 'drugName': { const m = pick(MED_NAMES); return m[0] }
    case 'dose': { const m = pick(MED_NAMES); return m[1] }
    case 'frequency': { const m = pick(MED_NAMES); return m[2] }
    case 'startDate': return visitDate
    case 'eventName': return pick(AE_NAMES)
    case 'onsetDate': return visitDate
    case 'severity': return pick(['mild', 'mild', 'moderate'])
    case 'outcome': return 'recovered'
    default:
      if (type === 'select' || type === 'radio') return options?.length ? pick(options).value : ''
      if (type === 'number') return int(1, 100)
      if (type === 'date' || type === 'datetime') return visitDate
      if (type === 'textarea') return pick(['未见明显异常。', '大致正常，随访观察。', '偶有不适，可耐受。', '无特殊。'])
      return ''
  }
}

function genModuleData(module: CRFModule, visitDate: string): Record<string, unknown> {
  const data: Record<string, unknown> = {}
  for (const f of module.fields) {
    data[f.name] = fieldValue(f.name, f.type, f.options, visitDate)
  }
  return data
}

export function getDemoVisitData(projects: Project[], patients: Patient[]): VisitData[] {
  const result: VisitData[] = []
  let seq = 0
  for (const patient of patients) {
    const project = projects.find((p) => p.id === patient.projectId)
    if (!project || project.visits.length === 0) continue
    const visitIdx = project.visits.findIndex((v) => v.code === patient.currentVisit)
    const reached = visitIdx >= 0 ? visitIdx : 0
    for (let vi = 0; vi <= reached; vi++) {
      const visit = project.visits[vi]
      const visitDate = addDays(patient.consentDate || project.startDate || '2025-01-01', vi * 30)
      for (const moduleId of visit.crfModuleIds) {
        const module = project.crfModules.find((m) => m.id === moduleId)
        if (!module) continue
        const isCurrent = vi === reached
        const status = isCurrent && (patient.status === 'treatment' || patient.status === 'enrolled')
          ? 'in_progress'
          : 'completed'
        result.push({
          id: `vd_${(++seq).toString().padStart(5, '0')}`,
          patientId: patient.id,
          projectId: project.id,
          visitId: visit.id,
          moduleId,
          data: genModuleData(module, visitDate),
          status,
          createdAt: `${visitDate}T10:00:00.000Z`,
          updatedAt: T,
          createdBy: 'user_entry_01',
        })
      }
    }
  }
  return result
}

// ---------- 用户与授权 ----------

export function getDemoUsers(): User[] {
  const base = { createdAt: '2025-01-01T00:00:00.000Z', updatedAt: T, isActive: true }
  return [
    { id: 'user_manager_01', username: 'manager1', name: '张慈', role: 'manager', department: '内分泌科', email: 'zhangci@hospital.cn', ...base },
    { id: 'user_manager_02', username: 'manager2', name: '李华', role: 'manager', department: '烧伤整形科', email: 'lihua@hospital.cn', ...base },
    { id: 'user_admin_01', username: 'admin', name: '后台管理员', role: 'admin', department: '信息中心', ...base },
    { id: 'user_entry_01', username: 'entry01', name: '王芳', role: 'data_entry', department: '内分泌科', phone: '138****2201', ...base },
    { id: 'user_entry_02', username: 'entry02', name: '刘洋', role: 'data_entry', department: '内分泌科', phone: '139****3345', ...base },
    { id: 'user_entry_03', username: 'entry03', name: '陈静', role: 'data_entry', department: '呼吸与危重症医学科', phone: '137****8890', ...base },
  ]
}

export function getDemoPermissions(): ProjectPermission[] {
  const grantedAt = '2025-03-02T09:00:00.000Z'
  return [
    { id: 'perm_001', projectId: P1, userId: 'user_entry_01', grantedBy: 'user_manager_01', grantedAt, canCreatePatient: true, canEditData: true, canViewData: true },
    { id: 'perm_002', projectId: P1, userId: 'user_entry_02', grantedBy: 'user_manager_01', grantedAt, canCreatePatient: false, canEditData: true, canViewData: true },
    { id: 'perm_003', projectId: P2, userId: 'user_entry_01', grantedBy: 'user_manager_01', grantedAt, canCreatePatient: true, canEditData: true, canViewData: true },
    { id: 'perm_004', projectId: P2, userId: 'user_entry_02', grantedBy: 'user_manager_01', grantedAt, canCreatePatient: true, canEditData: false, canViewData: true },
    { id: 'perm_005', projectId: P5, userId: 'user_entry_03', grantedBy: 'user_manager_01', grantedAt: '2023-06-01T09:00:00.000Z', canCreatePatient: true, canEditData: true, canViewData: true },
  ]
}

// ---------- 汇总 ----------

export function getDemoSeed(): Omit<AppStorage, 'moduleLibrary' | 'currentUser'> {
  const projects = getDemoProjects()
  const patients = getDemoPatients()
  return {
    users: getDemoUsers(),
    projects,
    patients,
    visitData: getDemoVisitData(projects, patients),
    projectPermissions: getDemoPermissions(),
  }
}
