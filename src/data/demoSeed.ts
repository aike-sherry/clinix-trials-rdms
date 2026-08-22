// ============================================================
// 演示数据种子：项目 + CRF 设计 + 患者 + 访视数据 + 用户 + 授权
// 仅在全新初始化（或数据版本升级重置）时写入 localStorage
// ============================================================

import type {
  AppStorage,
  AuditLog,
  CRFModule,
  CRFField,
  DataQuery,
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

const T = '2026-08-05T08:00:00.000Z'
/** 演示数据的「今天」锚点：访视日期不超过该日 */
const TODAY = '2026-08-05'

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
const RELATION_OPTS: [string, string][] = [['有关', 'related'], ['可能有关', 'possibly_related'], ['可能无关', 'possibly_unrelated'], ['无关', 'unrelated']]

// ---------- 模块模板（按项目生成独立 ID） ----------

/** 访视信息：内置系统模块，每次访视记录实际访视日期（超窗统计的数据源） */
function visitInfoModule(projectId: string, id: string): CRFModule {
  return {
    id, projectId, name: '访视信息', description: '访视执行情况记录（内置）', order: 0,
    fields: [
      fDate('实际访视日期', 'visitDate', 1, true),
      fSelect('是否按窗访视', 'inWindow', 2, [['是', 'yes'], ['否', 'no']]),
      fTextarea('访视备注', 'visitNote', 3),
    ],
  }
}

function demoModule(projectId: string, id: string): CRFModule {
  return {
    id, projectId, name: '人口学特征', description: '受试者基本人口学信息', order: 1,
    fieldLayout: 'horizontal',
    fields: [
      fText('姓名', 'name', 1, true),
      { ...fSelect('性别', 'gender', 2, GENDER_OPTS, true), externalFill: { enabled: true, sourceField: 'EMR.DEM.GENDER' } },
      { ...fDate('出生日期', 'birthDate', 3, true), externalFill: { enabled: true, sourceField: 'EMR.DEM.BRTHDT' } },
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

// 生命体征预置行：项目名（含单位）+ 演示值生成器
const VITAL_ROWS: [string, () => number][] = [
  ['收缩压(mmHg)', () => int(112, 148)],
  ['舒张压(mmHg)', () => int(68, 92)],
  ['脉搏(次/分)', () => int(62, 92)],
  ['呼吸频率(次/分)', () => int(14, 19)],
  ['体温(°C)', () => float1(36.2, 37.1)],
]

function vitalModule(projectId: string, id: string, order: number): CRFModule {
  return {
    id, projectId, name: '生命体征', description: '常规生命体征测量（预置行 + 跨访视矩阵：行=测量项目，列=访视，记录日期列头一次填写）', order,
    fields: [
      {
        id: `${id}_fld_table`, type: 'table', label: '生命体征记录', name: 'vitalRecords', order: 1,
        rowPreset: { col: 'item', rows: VITAL_ROWS.map(([n]) => n) },
        matrixView: { valueCol: 'value', showDate: true },
        columns: [
          { id: `${id}_col_item`, type: 'text', label: '项目', name: 'item', order: 1 },
          { id: `${id}_col_value`, type: 'number', label: '测量值', name: 'value', order: 2, decimals: 1 },
        ],
      },
    ],
  }
}

// 实验室检查：设计时只配检验项目清单（项目+单位）；参考范围由执行人员上传（此处预置两套已上传示例）
const LAB_ITEMS = [
  { name: '血红蛋白' },
  { name: '白细胞计数' },
  { name: '血小板计数' },
  { name: 'ALT' },
  { name: '肌酐' },
  { name: '白蛋白' },
]

const LAB_SETS = [
  {
    id: 'labset_2025', name: '2025 版参考范围', effectiveDate: '2025-01-01',
    uploadedBy: '数据录入员', uploadedAt: '2025-01-05T09:00:00.000Z',
    items: [
      { name: '血红蛋白', unit: 'g/L', low: 115, high: 150 },
      { name: '白细胞计数', unit: '×10⁹/L', low: 3.5, high: 9.5 },
      { name: '血小板计数', unit: '×10⁹/L', low: 125, high: 350 },
      { name: 'ALT', unit: 'U/L', low: 7, high: 40 },
      { name: '肌酐', unit: 'μmol/L', low: 41, high: 111 },
      { name: '白蛋白', unit: 'g/L', low: 40, high: 55 },
    ],
  },
  {
    id: 'labset_2026', name: '2026 版参考范围', effectiveDate: '2026-03-01',
    uploadedBy: '数据录入员', uploadedAt: '2026-03-02T09:00:00.000Z',
    items: [
      { name: '血红蛋白', unit: 'g/L', low: 115, high: 150 },
      { name: '白细胞计数', unit: '×10⁹/L', low: 3.5, high: 9.5 },
      { name: '血小板计数', unit: '×10⁹/L', low: 100, high: 300 },
      { name: 'ALT', unit: 'U/L', low: 7, high: 45 },
      { name: '肌酐', unit: 'μmol/L', low: 41, high: 111 },
      { name: '白蛋白', unit: 'g/L', low: 40, high: 55 },
    ],
  },
  {
    id: 'labset_2026h2', name: '2026 年 6 月修订版', effectiveDate: '2026-06-01',
    uploadedBy: '数据录入员', uploadedAt: '2026-06-02T09:00:00.000Z',
    items: [
      { name: '血红蛋白', unit: 'g/L', low: 115, high: 150 },
      { name: '白细胞计数', unit: '×10⁹/L', low: 3.5, high: 9.5 },
      { name: '血小板计数', unit: '×10⁹/L', low: 100, high: 300 },
      { name: 'ALT', unit: 'U/L', low: 5, high: 50 },
      { name: '肌酐', unit: 'μmol/L', low: 41, high: 111 },
      { name: '白蛋白', unit: 'g/L', low: 35, high: 52 },
    ],
  },
]

// 各项目演示值生成：约 1/4 概率偏离参考范围（演示偏高/偏低箭头）
function labDemoValue(low?: number, high?: number): number {
  if (low === undefined || high === undefined) return int(1, 100)
  const span = high - low
  const r = rnd()
  if (r < 0.14) return Math.round((high + span * (0.05 + rnd() * 0.2)) * 10) / 10 // 偏高
  if (r < 0.24) return Math.round((low - span * (0.05 + rnd() * 0.2)) * 10) / 10  // 偏低
  return Math.round((low + span * (0.2 + rnd() * 0.6)) * 10) / 10                // 正常
}

function labModule(projectId: string, id: string, order: number): CRFModule {
  return {
    id, projectId, name: '实验室检查', description: '常规实验室检验（预置项目 + 跨访视矩阵；参考范围按生效日期自动判定偏高/偏低）', order,
    fields: [
      {
        id: `${id}_fld_table`, type: 'table', label: '检验结果', name: 'labRecords', order: 1,
        // 通用配置：预置行=检验项目；跨访视矩阵；范围版本随上传按生效日期生效（不再使用独立实验室模式）
        rowPreset: { col: 'item', rows: LAB_ITEMS.map((it) => it.name) },
        matrixView: { valueCol: 'value', showDate: true },
        rangeSets: LAB_SETS,
        columns: [
          { id: `${id}_col_item`, type: 'text', label: '项目', name: 'item', order: 1 },
          { id: `${id}_col_value`, type: 'number', label: '检测值', name: 'value', order: 2 },
          { id: `${id}_col_unit`, type: 'unit', label: '单位', name: 'unit', order: 3 },
          { id: `${id}_col_range`, type: 'range', label: '正常值范围', name: 'range', order: 4 },
          { id: `${id}_col_flag`, type: 'flag', label: '状态', name: 'flag', order: 5 },
          { id: `${id}_col_date`, type: 'date', label: '检查日期', name: 'testDate', order: 6 },
        ],
      },
    ],
  }
}

function aeModule(projectId: string, id: string, order: number): CRFModule {
  return {
    id, projectId, name: '不良事件', description: '不良事件报告（动态表格：每条不良事件一行；转归随结束日期自动更新）', order,
    fields: [
      {
        id: `${id}_fld_table`, type: 'table', label: '不良事件记录', name: 'aeRecords', order: 1, autoRowNumber: true,
        autoStatus: { dateCol: 'endDate', statusCol: 'outcome' },
        columns: [
          { id: `${id}_col_event`, type: 'text', label: '事件名称', name: 'eventName', order: 1, validation: { required: true } },
          { id: `${id}_col_onset`, type: 'date', label: '发生日期', name: 'onsetDate', order: 2, validation: { required: true } },
          { id: `${id}_col_severity`, type: 'select', label: '严重程度', name: 'severity', order: 3, options: SEVERITY_OPTS.map(([label, value]) => ({ label, value })) },
          { id: `${id}_col_relation`, type: 'select', label: '与试验药物关系', name: 'drugRelation', order: 4, options: RELATION_OPTS.map(([label, value]) => ({ label, value })) },
          { id: `${id}_col_action`, type: 'text', label: '处理措施', name: 'actionTaken', order: 5 },
          { id: `${id}_col_end`, type: 'date', label: '结束日期', name: 'endDate', order: 6 },
          {
            id: `${id}_col_outcome`, type: 'select', label: '转归', name: 'outcome', order: 7,
            options: [{ label: '持续中', value: '持续中' }, { label: '已结束', value: '已结束' }],
          },
        ],
      },
    ],
  }
}

// ---------- 项目 1：软坚清脉法（进行最充分） ----------

const P1 = 'proj_cn101'
const P1_MOD = { visitinfo: 'mod_p1_visitinfo', demo: 'mod_p1_demo', history: 'mod_p1_history', vital: 'mod_p1_vital', lab: 'mod_p1_lab', efficacy: 'mod_p1_efficacy', ae: 'mod_p1_ae' }

function p1Modules(): CRFModule[] {
  return [
    visitInfoModule(P1, P1_MOD.visitinfo),
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
  const mk = (id: string, name: string, code: string, order: number, mods: string[], plannedDay: number, windowDays: number): Visit => ({
    id, projectId: P1, name, code, order, crfModuleIds: mods, plannedDay, windowDays,
  })
  return [
    mk('visit_p1_v0', '筛选访视', 'V0', 0, [P1_MOD.visitinfo, P1_MOD.demo, P1_MOD.history, P1_MOD.vital, P1_MOD.lab], 0, 3),
    mk('visit_p1_v1', '基线访视', 'V1', 1, [P1_MOD.visitinfo, P1_MOD.vital, P1_MOD.lab, P1_MOD.efficacy], 7, 3),
    mk('visit_p1_v2', '治疗 4 周', 'V2', 2, [P1_MOD.visitinfo, P1_MOD.vital, P1_MOD.efficacy], 28, 3),
    mk('visit_p1_v3', '治疗 8 周', 'V3', 3, [P1_MOD.visitinfo, P1_MOD.vital, P1_MOD.lab, P1_MOD.efficacy], 56, 3),
    mk('visit_p1_v4', '治疗 12 周', 'V4', 4, [P1_MOD.visitinfo, P1_MOD.vital, P1_MOD.efficacy, P1_MOD.ae], 84, 5),
    mk('visit_p1_v5', '随访', 'V5', 5, [P1_MOD.visitinfo, P1_MOD.vital, P1_MOD.efficacy], 112, 7),
  ]
}

// ---------- 项目 2：GLP-1 糖尿病 ----------

const P2 = 'proj_cn102'
const P2_MOD = { visitinfo: 'mod_p2_visitinfo', demo: 'mod_p2_demo', vital: 'mod_p2_vital', glucose: 'mod_p2_glucose', med: 'mod_p2_med', ae: 'mod_p2_ae' }

function p2Modules(): CRFModule[] {
  return [
    visitInfoModule(P2, P2_MOD.visitinfo),
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
      id: P2_MOD.med, projectId: P2, name: '合并用药', description: '合并用药记录（动态表格：每条用药一行）', order: 4,
      fields: [
        {
          id: 'fld_p2_med_table', type: 'table', label: '合并用药记录', name: 'medRecords', order: 1, autoRowNumber: true,
          autoStatus: { dateCol: 'endDate', statusCol: 'status' },
          columns: [
            { id: 'col_med_drug', type: 'text', label: '药物名称', name: 'drugName', order: 1, validation: { required: true } },
            { id: 'col_med_dose', type: 'text', label: '剂量', name: 'dose', order: 2 },
            { id: 'col_med_freq', type: 'text', label: '频次', name: 'frequency', order: 3 },
            { id: 'col_med_start', type: 'date', label: '开始日期', name: 'startDate', order: 4 },
            { id: 'col_med_end', type: 'date', label: '结束日期', name: 'endDate', order: 5 },
            {
              id: 'col_med_status', type: 'select', label: '持续状态', name: 'status', order: 6,
              options: [{ label: '持续中', value: '持续中' }, { label: '已结束', value: '已结束' }],
            },
          ],
        },
      ],
    },
    aeModule(P2, P2_MOD.ae, 5),
  ]
}

function p2Visits(): Visit[] {
  const mk = (id: string, name: string, code: string, order: number, mods: string[], plannedDay: number, windowDays: number): Visit => ({
    id, projectId: P2, name, code, order, crfModuleIds: mods, plannedDay, windowDays,
  })
  return [
    mk('visit_p2_v0', '筛选访视', 'V0', 0, [P2_MOD.visitinfo, P2_MOD.demo, P2_MOD.vital, P2_MOD.glucose], 0, 3),
    mk('visit_p2_v1', '基线访视', 'V1', 1, [P2_MOD.visitinfo, P2_MOD.vital, P2_MOD.glucose, P2_MOD.med], 14, 3),
    mk('visit_p2_v2', '治疗 12 周', 'V2', 2, [P2_MOD.visitinfo, P2_MOD.vital, P2_MOD.glucose], 84, 5),
    mk('visit_p2_v3', '治疗 24 周', 'V3', 3, [P2_MOD.visitinfo, P2_MOD.vital, P2_MOD.glucose, P2_MOD.ae], 168, 7),
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
  return [visitInfoModule(P5, 'mod_p5_visitinfo'), demoModule(P5, 'mod_p5_demo'), vitalModule(P5, 'mod_p5_vital', 2)]
}

function p5Visits(): Visit[] {
  return [
    { id: 'visit_p5_v0', projectId: P5, name: '筛选访视', code: 'V0', order: 0, crfModuleIds: ['mod_p5_visitinfo', 'mod_p5_demo', 'mod_p5_vital'], plannedDay: 0, windowDays: 3 },
    { id: 'visit_p5_v1', projectId: P5, name: '末次访视', code: 'V1', order: 1, crfModuleIds: ['mod_p5_visitinfo', 'mod_p5_vital'], plannedDay: 30, windowDays: 5 },
  ]
}

// ---------- 中心 ----------

const P1_CENTERS = [
  { id: 'ctr_p1_rj', name: '上海瑞金医院' },
  { id: 'ctr_p1_zs', name: '上海中山医院' },
  { id: 'ctr_p1_zxy', name: '上海中西医结合医院' },
]
const P2_CENTERS = [
  { id: 'ctr_p2_xh', name: '北京协和医院' },
  { id: 'ctr_p2_hs', name: '上海华山医院' },
  { id: 'ctr_p2_xy', name: '中南大学湘雅医院' },
]
const P3_CENTERS = [
  { id: 'ctr_p3_dj', name: '上海第九人民医院' },
  { id: 'ctr_p3_ch', name: '上海长海医院' },
]
const P4_CENTERS = [
  { id: 'ctr_p4_gam', name: '广安门医院' },
  { id: 'ctr_p4_xy2', name: '西苑医院' },
]
const P5_CENTERS = [
  { id: 'ctr_p5_jdx', name: '江苏大学附属医院' },
]

// ---------- 项目列表 ----------

export function getDemoProjects(): Project[] {
  return [
    {
      id: P1, projectNo: 'CN101CLCT06',
      name: '软坚清脉法治疗下肢动脉硬化闭塞症的多中心临床研究',
      sponsor: '上海瑞金医院 / 海和药物', principalInvestigator: '张慈',
      researchCenter: '上海瑞金医院', centers: P1_CENTERS, department: '内分泌科',
      status: 'study_started', startDate: '2026-03-30', endDate: '2027-06-30',
      targetEnrollment: 120, budget: 500000,
      description: '评估软坚清脉法治疗下肢动脉硬化闭塞症的临床疗效和安全性',
      createdAt: '2026-03-20T09:00:00.000Z', updatedAt: T,
      visits: p1Visits(), crfModules: p1Modules(),
      crfPublished: true, crfPublishedAt: '2026-03-28T10:00:00.000Z',
    },
    {
      id: P2, projectNo: 'CN102CLCT11',
      name: '新型 GLP-1 受体激动剂治疗 2 型糖尿病的 III 期临床研究',
      sponsor: '海和药物', principalInvestigator: '张慈',
      researchCenter: '北京协和医院', centers: P2_CENTERS, department: '内分泌科',
      status: 'study_started', startDate: '2026-02-02', endDate: '2027-02-28',
      targetEnrollment: 200, budget: 800000,
      description: '评估新型 GLP-1 受体激动剂治疗 2 型糖尿病患者的有效性和安全性',
      createdAt: '2026-01-20T09:00:00.000Z', updatedAt: T,
      visits: p2Visits(), crfModules: p2Modules(),
      crfPublished: true, crfPublishedAt: '2026-01-30T10:00:00.000Z',
    },
    {
      id: P3, projectNo: 'CN103CLCT02',
      name: '烧伤创面修复新型敷料的随机对照临床试验',
      sponsor: '上海烧伤研究所', principalInvestigator: '李华',
      researchCenter: '上海第九人民医院', centers: P3_CENTERS, department: '烧伤整形科',
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
      researchCenter: '广安门医院', centers: P4_CENTERS, department: '心血管科',
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
      researchCenter: '江苏大学附属医院', centers: P5_CENTERS, department: '呼吸与危重症医学科',
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

// 筛选失败原因（演示数据）
const FAIL_REASONS = ['不符合纳入标准', '符合排除标准', '受试者撤回知情同意', '实验室检查异常', '其他原因']

interface PatientSpec {
  status: PatientStatus
  visitIdx: number // 当前所在访视下标
  consentOffset: number // 知情日期距项目启动的天数（按访视进度分布，保证演示时效真实）
}

function buildPatients(
  projectId: string,
  projectStart: string,
  randPrefix: string,
  specs: PatientSpec[],
  initialsOffset: number,
  centerIds: string[],
): Patient[] {
  return specs.map((spec, i) => {
    const no = String(i + 1).padStart(2, '0')
    const consentDate = addDays(projectStart, spec.consentOffset)
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
      centerId: centerIds.length > 0 ? centerIds[i % centerIds.length] : undefined,
      screeningNo: no,
      screeningId: String(i + 1).padStart(3, '0'),
      randomizationId: enrolled && spec.status !== 'withdrawn' ? `${randPrefix}${String(i + 1).padStart(3, '0')}` : undefined,
      nameInitials: INITIALS[(initialsOffset + i) % INITIALS.length],
      gender: rnd() > 0.45 ? 'male' : 'female',
      birthDate: `${int(1945, 1982)}-${String(int(1, 12)).padStart(2, '0')}-${String(int(1, 28)).padStart(2, '0')}`,
      consentDate,
      enrollmentDate,
      status: spec.status,
      screeningFailReason: spec.status === 'withdrawn' ? FAIL_REASONS[i % FAIL_REASONS.length] : undefined,
      currentVisit,
      nextVisit,
      createdAt: `${consentDate}T09:00:00.000Z`,
      updatedAt: T,
      createdBy: PROJECT_CREATOR[projectId] ?? 'user_entry_01',
    }
  })
}

const p1VisitCodes = ['V0', 'V1', 'V2', 'V3', 'V4', 'V5']
const p2VisitCodes = ['V0', 'V1', 'V2', 'V3']
const p5VisitCodes = ['V0', 'V1']

// 演示数据：各项目患者的登记录入人员（王芳→P1、刘洋→P2、陈静→P5）
const PROJECT_CREATOR: Record<string, string> = {
  [P1]: 'user_entry_01',
  [P2]: 'user_entry_02',
  [P5]: 'user_entry_03',
}

export function getDemoPatients(): Patient[] {
  // consentOffset 按访视进度分布：走得越远的患者登记越早（以 2026-08-05 为「今天」锚点）
  const p1Specs: PatientSpec[] = [
    // 已完成 4 例（登记最早）
    ...[0, 2, 4, 6].map((o) => ({ status: 'completed' as const, visitIdx: 5, consentOffset: o })),
    // 治疗中-治疗12周（V4，计划 84 天±5）：部分逾期、部分临近
    ...[24, 30].map((o) => ({ status: 'treatment' as const, visitIdx: 4, consentOffset: o })),
    // 治疗中-治疗8周（V3，计划 56 天±3）
    ...[55, 62, 68, 72, 78].map((o) => ({ status: 'treatment' as const, visitIdx: 3, consentOffset: o })),
    // 治疗中-治疗4周（V2，计划 28 天±3）
    ...[85, 90, 95, 100, 88, 93].map((o) => ({ status: 'treatment' as const, visitIdx: 2, consentOffset: o })),
    // 已入组-基线访视（V1，计划 7 天±3）
    ...[105, 110, 113, 116, 120].map((o) => ({ status: 'enrolled' as const, visitIdx: 1, consentOffset: o })),
    // 筛选中 3 例（刚登记）
    ...[123, 125, 127].map((o) => ({ status: 'screening' as const, visitIdx: 0, consentOffset: o })),
    { status: 'withdrawn', visitIdx: 2, consentOffset: 50 },
    { status: 'withdrawn', visitIdx: 3, consentOffset: 70 },
    { status: 'lost', visitIdx: 2, consentOffset: 60 },
  ]
  const p2Specs: PatientSpec[] = [
    // 已完成 2 例
    ...[0, 2].map((o) => ({ status: 'completed' as const, visitIdx: 3, consentOffset: o })),
    // 治疗中-治疗12周（V2，计划 84 天±5）
    ...[75, 82, 88, 95, 100, 105, 108].map((o) => ({ status: 'treatment' as const, visitIdx: 2, consentOffset: o })),
    // 已入组-基线访视（V1，计划 14 天±3）
    ...[150, 158, 163, 168].map((o) => ({ status: 'enrolled' as const, visitIdx: 1, consentOffset: o })),
    // 筛选中 2 例
    ...[178, 181].map((o) => ({ status: 'screening' as const, visitIdx: 0, consentOffset: o })),
    { status: 'withdrawn', visitIdx: 2, consentOffset: 90 },
  ]
  const p5Specs: PatientSpec[] = [0, 7, 14, 21, 28, 35, 42, 49].map((o) => ({ status: 'completed' as const, visitIdx: 1, consentOffset: o }))
  return [
    ...buildPatients(P1, '2026-03-30', 'RJ', p1Specs, 0, P1_CENTERS.map((c) => c.id)),
    ...buildPatients(P2, '2026-02-02', 'GLP', p2Specs, 9, P2_CENTERS.map((c) => c.id)),
    ...buildPatients(P5, '2023-06-01', 'XA', p5Specs, 17, P5_CENTERS.map((c) => c.id)),
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
    // 合并用药动态表格：一行持续中（无结束日期）、一行已结束（有结束日期），演示自动状态列
    case 'medRecords': return [
      { seq: 1, drugName: '苯磺酸氨氯地平片', dose: '5mg', frequency: '每日一次', startDate: visitDate, endDate: '', status: '持续中' },
      { seq: 2, drugName: '阿托伐他汀钙片', dose: '20mg', frequency: '每晚一次', startDate: '2026-01-10', endDate: visitDate, status: '已结束' },
    ]
    // 不良事件动态表格：1~2 行演示数据；约 60% 首行已结束（有结束日期），转归随结束日期自动更新
    case 'aeRecords': {
      const ended = rnd() > 0.4
      const rows: Record<string, unknown>[] = [
        {
          seq: 1,
          eventName: pick(AE_NAMES), onsetDate: visitDate,
          severity: pick(['mild', 'mild', 'moderate', 'severe']),
          drugRelation: pick(['related', 'related', 'possibly_related', 'possibly_unrelated', 'unrelated', 'unrelated']),
          actionTaken: pick(['对症处理', '观察随访', '剂量调整', '无']),
          endDate: ended ? visitDate : '', outcome: ended ? '已结束' : '持续中',
        },
      ]
      if (rnd() > 0.5) {
        rows.push({
          seq: 2,
          eventName: pick(AE_NAMES), onsetDate: visitDate,
          severity: pick(['mild', 'moderate']),
          drugRelation: pick(['possibly_unrelated', 'unrelated']),
          actionTaken: '无', endDate: visitDate, outcome: '已结束',
        })
      }
      return rows
    }
    // 生命体征：预置行矩阵演示数据（行=测量项目，记录日期=访视日期）
    case 'vitalRecords': return VITAL_ROWS.map(([n, gen]) => ({ item: n, value: gen(), testDate: visitDate }))
    // 实验室检查：按最新版参考范围的预置项目生成演示值（约 1/4 偏离，演示偏高/偏低箭头）
    case 'labRecords': return LAB_SETS[LAB_SETS.length - 1].items.map((it) => ({
      item: it.name, value: labDemoValue(it.low, it.high), testDate: visitDate,
    }))
    case 'visitDate': return visitDate
    // 默认值，生成访视数据时会按窗口抖动覆盖为 yes/no
    case 'inWindow': return 'yes'
    case 'visitNote': return ''
    case 'eventName': return pick(AE_NAMES)
    case 'onsetDate': return visitDate
    case 'severity': return pick(['mild', 'mild', 'moderate'])
    case 'drugRelation': return pick(['related', 'related', 'possibly_related', 'possibly_unrelated', 'unrelated', 'unrelated'])
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
      // 访视日期按计划访视日（入组/知情后第 N 天）± 窗口期生成；约 15% 超出窗口（超窗演示）
      const base = patient.enrollmentDate || patient.consentDate || project.startDate || TODAY
      const plannedDay = visit.plannedDay ?? vi * 30
      const windowDays = visit.windowDays ?? 3
      const outOfWindow = rnd() < 0.15
      const jitter = outOfWindow
        ? windowDays + int(2, 12)
        : int(-Math.min(2, windowDays), Math.min(2, windowDays))
      let visitDate = addDays(base, plannedDay + jitter)
      if (visitDate > TODAY) visitDate = TODAY
      for (const moduleId of visit.crfModuleIds) {
        const module = project.crfModules.find((m) => m.id === moduleId)
        if (!module) continue
        const isCurrent = vi === reached
        const status = isCurrent && (patient.status === 'treatment' || patient.status === 'enrolled')
          ? 'in_progress'
          : 'completed'
        // 演示：已完成的数据中约七成已由研究人员签署确认
        const signed = status === 'completed' && rnd() > 0.3
        // 演示：已签署的数据中约七成已经过管理人员数据确认（审核）
        const reviewed = signed && rnd() > 0.3
        const data = genModuleData(module, visitDate)
        // 内置「访视信息」模块的是否按窗访视与日期抖动保持一致
        if ('inWindow' in data) data.inWindow = outOfWindow ? 'no' : 'yes'
        result.push({
          id: `vd_${(++seq).toString().padStart(5, '0')}`,
          patientId: patient.id,
          projectId: project.id,
          visitId: visit.id,
          moduleId,
          data,
          status,
          signedAt: signed ? `${visitDate}T15:00:00.000Z` : undefined,
          signedBy: signed ? 'user_manager_01' : undefined,
          reviewedAt: reviewed ? `${visitDate}T18:00:00.000Z` : undefined,
          reviewedBy: reviewed ? 'user_manager_01' : undefined,
          createdAt: `${visitDate}T10:00:00.000Z`,
          updatedAt: T,
          createdBy: patient.createdBy ?? 'user_entry_01',
        })
      }
    }
  }
  return result
}

// ---------- 全链路演示患者（全部数据已录入、审核、锁定，用于 PDF 下载演示） ----------

/**
 * 基于项目一（CN101CLCT06）生成一名「全部访视 × 全部模块」均已
 * 录入完成、管理人员审核、研究人员签署的演示患者。
 * 传入的 projects 既可以是新种子，也可以是浏览器中已迁移过的存量数据，
 * 记录完全按传入项目的实际访视 / 模块结构生成，保证两端口径一致。
 */
export function getDemoLockedPatient(projects: Project[]): { patient: Patient; records: VisitData[] } | null {
  const project = projects.find((p) => p.id === P1 && p.crfPublished && p.visits.length > 0)
  if (!project) return null
  // 登记较早，保证最后一次访视（V5，计划第 112 天）在「今天」前自然完成
  const consentDate = '2026-02-22'
  const enrollmentDate = '2026-03-01'
  const patient: Patient = {
    id: 'pat_demo_locked_01',
    projectId: project.id,
    centerId: project.centers?.[0]?.id,
    screeningNo: '99',
    screeningId: '999',
    randomizationId: 'RJ999',
    nameInitials: 'DEM',
    gender: 'male',
    birthDate: '1968-05-12',
    consentDate,
    enrollmentDate,
    status: 'completed',
    currentVisit: project.visits[project.visits.length - 1].code,
    createdAt: `${consentDate}T09:00:00.000Z`,
    updatedAt: T,
    createdBy: 'user_entry_01',
  }
  const records: VisitData[] = []
  let seq = 0
  project.visits.forEach((visit, vi) => {
    const plannedDay = visit.plannedDay ?? vi * 30
    let visitDate = addDays(enrollmentDate, plannedDay)
    if (visitDate > TODAY) visitDate = TODAY
    visit.crfModuleIds.forEach((moduleId) => {
      const module = project.crfModules.find((m) => m.id === moduleId)
      if (!module) return
      const data = genModuleData(module, visitDate)
      // 全部按计划窗口内访视，不产生超窗
      if ('inWindow' in data) data.inWindow = 'yes'
      records.push({
        id: `vd_locked_${String(++seq).padStart(3, '0')}`,
        patientId: patient.id,
        projectId: project.id,
        visitId: visit.id,
        moduleId,
        data,
        status: 'completed',
        // 录入 → 审核 → 签署 全链路留痕（录入员王芳 → 管理人员张慈）
        reviewedAt: `${visitDate}T18:00:00.000Z`,
        reviewedBy: 'user_manager_01',
        signedAt: `${visitDate}T19:00:00.000Z`,
        signedBy: 'user_manager_01',
        createdAt: `${visitDate}T10:00:00.000Z`,
        updatedAt: `${visitDate}T18:00:00.000Z`,
        createdBy: 'user_entry_01',
      })
    })
  })
  return { patient, records }
}

// ---------- 演示数据疑问 ----------

export function getDemoQueries(visitData: VisitData[]): DataQuery[] {
  // 取前几条已完成记录生成演示疑问：2 条待回复、1 条已回复、1 条已关闭
  const completed = visitData.filter((v) => v.status === 'completed')
  if (completed.length < 4) return []
  const mk = (
    rec: VisitData,
    idx: number,
    content: string,
    status: DataQuery['status'],
    answer?: string,
  ): DataQuery => ({
    id: `query_demo_${idx}`,
    visitDataId: rec.id,
    patientId: rec.patientId,
    projectId: rec.projectId,
    visitId: rec.visitId,
    moduleId: rec.moduleId,
    content,
    status,
    createdBy: 'user_manager_01',
    createdByName: '张慈',
    createdAt: `${rec.createdAt.slice(0, 11)}14:00:00.000Z`,
    answer,
    answeredBy: answer ? 'user_entry_01' : undefined,
    answeredAt: answer ? `${rec.createdAt.slice(0, 11)}17:30:00.000Z` : undefined,
    closedBy: status === 'closed' ? 'user_manager_01' : undefined,
    closedAt: status === 'closed' ? `${rec.createdAt.slice(0, 11)}18:10:00.000Z` : undefined,
  })
  return [
    mk(completed[0], 1, '身高与上次访视差异较大，请核对原始记录。', 'open'),
    mk(completed[1], 2, '该字段值超出正常参考范围，请确认是否录入有误。', 'open'),
    mk(completed[2], 3, '日期与知情同意书签署日期不一致，请核实。', 'answered', '已核对原始病历，实际日期无误，为知情日期录入笔误，已更正。'),
    mk(completed[3], 4, '检验数值单位请确认是否为本中心标准单位。', 'closed', '已确认单位无误。'),
  ]
}

// ---------- 演示审计留痕（近 30 天，以录入人员王芳为主） ----------

export function getDemoAuditLogs(patients: Patient[]): AuditLog[] {
  const day = (n: number, time = '10:00:00.000Z') => {
    const d = new Date(Date.now() - n * 86400000)
    return `${d.toISOString().slice(0, 11)}${time}`
  }
  const label = (i: number, visit: string, module: string) => {
    const p = patients[i]
    return p ? `受试者 ${p.nameInitials}（${p.screeningId}）· ${visit} · ${module}` : `受试者（${i}）`
  }
  const mk = (
    id: string,
    daysAgo: number,
    time: string,
    action: AuditLog['action'],
    entityType: AuditLog['entityType'],
    entityLabel: string,
    summary: string,
    changes?: AuditLog['changes'],
  ): AuditLog => ({
    id,
    timestamp: day(daysAgo, time),
    userId: 'user_entry_01',
    userName: '王芳',
    role: 'data_entry',
    action,
    entityType,
    entityId: id.replace('audit_demo_', 'rec_'),
    entityLabel,
    summary,
    changes,
  })
  return [
    mk('audit_demo_01', 1, '09:24:00.000Z', 'update', 'visitData', label(4, '治疗 12 周', '生命体征'), '更新字段 收缩压：128 → 130', [
      { field: '收缩压', before: '128', after: '130' },
    ]),
    mk('audit_demo_02', 1, '09:31:00.000Z', 'create', 'visitData', label(4, '治疗 12 周', '疗效评价'), '完成录入'),
    mk('audit_demo_03', 2, '15:12:00.000Z', 'update', 'query', label(0, '筛选访视', '访视信息'), '回复数据疑问'),
    mk('audit_demo_04', 3, '10:05:00.000Z', 'create', 'patient', `受试者 ${patients[9]?.nameInitials ?? 'XUQ'}（${patients[9]?.screeningId ?? '010'}）`, '登记新受试者'),
    mk('audit_demo_05', 4, '14:47:00.000Z', 'update', 'visitData', label(2, '基线访视', '实验室检查'), '更新字段 白蛋白：41.2 → 42.0', [
      { field: '白蛋白', before: '41.2', after: '42.0' },
    ]),
    mk('audit_demo_06', 6, '11:20:00.000Z', 'create', 'visitData', label(6, '治疗 8 周', '不良事件'), '完成录入'),
    mk('audit_demo_07', 8, '16:02:00.000Z', 'update', 'visitData', label(1, '基线访视', '人口学特征'), '更新字段 身高：172 → 171', [
      { field: '身高', before: '172', after: '171' },
    ]),
    mk('audit_demo_08', 11, '09:58:00.000Z', 'create', 'visitData', label(8, '治疗 4 周', '合并用药'), '完成录入'),
    mk('audit_demo_09', 14, '13:40:00.000Z', 'update', 'query', label(3, '筛选访视', '生命体征'), '回复数据疑问'),
    mk('audit_demo_10', 18, '10:26:00.000Z', 'create', 'visitData', label(0, '筛选访视', '病史采集'), '完成录入'),
  ]
}

// ---------- 用户与授权 ----------
// 测试阶段：全部种子账号密码统一为 123456（正式上线前由授权流程生成随机初始密码并强制首登修改）
export function getDemoUsers(): User[] {
  const base = { createdAt: '2026-01-05T00:00:00.000Z', updatedAt: T, isActive: true }
  return [
    // 超级管理员（小乂临研）：授权管理员
    { id: 'user_admin_01', username: 'admin', name: '超级管理员', role: 'super_admin', organization: '小乂临研', email: 'admin@xiaoyi.cn', password: '123456', ...base },
    // 管理员：负责后台管理，授权课题主持人并开通模块
    { id: 'user_admin_02', username: 'admin02', name: '周婷', role: 'admin', organization: '小乂临研', email: 'zhouting@xiaoyi.cn', password: '123456', grantedBy: 'user_admin_01', ...base },
    // 课题主持人：账号与模块权限由管理员授权
    { id: 'user_manager_01', username: 'manager1', name: '张慈', role: 'manager', organization: '上海瑞金医院', department: '内分泌科', email: 'zhangci@hospital.cn', password: '123456', grantedBy: 'user_admin_02', moduleAccess: ['patients', 'visits', 'dataMgmt', 'statistics', 'queries', 'integration', 'smartCheck'], ...base },
    { id: 'user_manager_02', username: 'manager2', name: '李华', role: 'manager', organization: '上海第九人民医院', department: '烧伤整形科', email: 'lihua@hospital.cn', password: '123456', grantedBy: 'user_admin_02', moduleAccess: ['patients', 'visits', 'dataMgmt', 'integration'], ...base },
    // 数据录入人员：权限由课题主持人授权，后台可进一步开通模块
    { id: 'user_entry_01', username: 'entry01', name: '王芳', role: 'data_entry', organization: '上海瑞金医院', department: '内分泌科', email: 'wangfang@hospital.cn', phone: '138****2201', password: '123456', grantedBy: 'user_manager_01', moduleAccess: ['patients', 'visits', 'dataMgmt', 'queries', 'smartCheck'], ...base },
    { id: 'user_entry_02', username: 'entry02', name: '刘洋', role: 'data_entry', organization: '北京协和医院', department: '内分泌科', email: 'liuyang@hospital.cn', phone: '139****3345', password: '123456', grantedBy: 'user_manager_01', moduleAccess: ['patients', 'visits'], ...base },
    { id: 'user_entry_03', username: 'entry03', name: '陈静', role: 'data_entry', organization: '江苏大学附属医院', department: '呼吸与危重症医学科', email: 'chenjing@hospital.cn', phone: '137****8890', password: '123456', grantedBy: 'user_manager_02', moduleAccess: ['patients'], ...base },
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
  const visitData = getDemoVisitData(projects, patients)
  // 全链路演示患者：全部数据已录入 / 审核 / 锁定（PDF 下载演示）
  const locked = getDemoLockedPatient(projects)
  if (locked) {
    patients.push(locked.patient)
    visitData.push(...locked.records)
  }
  return {
    users: getDemoUsers(),
    projects,
    patients,
    visitData,
    queries: getDemoQueries(visitData),
    auditLogs: getDemoAuditLogs(patients),
    projectPermissions: getDemoPermissions(),
  }
}
