import type { CRFField, FieldType, ModuleLibraryItem } from '@/types'

/**
 * 模块设计智能体（演示版·规则模拟）：
 * 1) 先在模块库中检索可复用的现有模块，命中则建议复用而不是重复新建；
 * 2) 内置常见临床模块模板（合并用药/不良事件/生命体征/疼痛评估/随访/手术史/过敏史/体格检查）；
 * 3) 未命中模板时按字段名关键词推断类型（日期→日期、是否→单选、剂量→数字……）生成草稿。
 * 接入真实大模型后只需替换 generateModuleDraft 的实现，交互链路不变。
 */

export interface ModuleDraft {
  name: string
  description: string
  category: string
  fields: CRFField[]
}

export interface AgentReply {
  /** 智能体说明文字 */
  text: string
  /** 新生成的模块草稿（与 reuse 二选一） */
  draft?: ModuleDraft
  /** 命中模块库可复用的模块（与 draft 二选一） */
  reuse?: ModuleLibraryItem
}

const genId = () => `fld_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

const col = (type: FieldType, label: string, name: string, order: number, extra?: Partial<CRFField>): CRFField => ({
  id: genId(), type, label, name, order, ...extra,
})

const opt = (label: string, value: string) => ({ label, value })

// ==================== 内置模板 ====================

interface Template {
  keywords: string[]
  build: () => ModuleDraft
}

const TEMPLATES: Template[] = [
  {
    keywords: ['合并用药', '伴随用药', '联合用药', '用药记录', 'conmed'],
    build: () => ({
      name: '合并用药',
      description: '研究期间合并用药记录（动态表格：每种药一行；状态随结束日期自动更新）',
      category: '合并用药',
      fields: [
        {
          id: genId(), type: 'table', label: '合并用药记录', name: 'conmedRecords', order: 1,
          autoRowNumber: true,
          autoStatus: { dateCol: 'endDate', statusCol: 'status', emptyText: '持续中', filledText: '已结束' },
          columns: [
            col('text', '药品名称', 'drugName', 1),
            col('text', '适应症', 'indication', 2),
            col('number', '单次剂量', 'dose', 3),
            col('select', '剂量单位', 'doseUnit', 4, {
              options: ['mg', 'g', 'mL', 'μg', 'IU', '片'].map((v) => opt(v, v)),
            }),
            col('select', '给药频次', 'frequency', 5, {
              options: ['每日一次', '每日两次', '每日三次', '每周一次', '按需'].map((v) => opt(v, v)),
            }),
            col('select', '给药途径', 'route', 6, {
              options: ['口服', '静脉滴注', '皮下注射', '肌肉注射', '外用', '其他'].map((v) => opt(v, v)),
            }),
            col('date', '开始日期', 'startDate', 7),
            col('date', '结束日期', 'endDate', 8),
            col('text', '状态', 'status', 9),
          ],
        },
      ],
    }),
  },
  {
    keywords: ['疼痛', 'vas', '评分'],
    build: () => ({
      name: '疼痛评估',
      description: '疼痛程度评估（VAS 视觉模拟评分）',
      category: '疗效评估',
      fields: [
        {
          id: genId(), type: 'scale', label: '疼痛评分（VAS）', name: 'painScore', order: 1,
          scaleConfig: {
            min: 0, max: 10, step: 1,
            labels: [
              { value: 0, label: '无痛' },
              { value: 3, label: '轻度' },
              { value: 6, label: '中度' },
              { value: 10, label: '剧痛' },
            ],
          },
        },
        col('text', '疼痛部位', 'painSite', 2),
        col('select', '疼痛性质', 'painType', 3, {
          options: ['钝痛', '锐痛', '烧灼痛', '胀痛', '其他'].map((v) => opt(v, v)),
        }),
        col('textarea', '备注', 'painNote', 4),
      ],
    }),
  },
  {
    keywords: ['随访', '访视记录'],
    build: () => ({
      name: '随访记录',
      description: '随访执行情况记录',
      category: '基础模块',
      fields: [
        col('date', '随访日期', 'followupDate', 1),
        col('select', '随访方式', 'followupMode', 2, {
          options: ['门诊', '电话', '视频', '其他'].map((v) => opt(v, v)),
        }),
        col('select', '依从性', 'compliance', 3, {
          options: ['好', '一般', '差'].map((v) => opt(v, v)),
        }),
        col('textarea', '随访内容', 'followupNote', 4),
      ],
    }),
  },
  {
    keywords: ['手术史', '既往手术'],
    build: () => ({
      name: '既往手术史',
      description: '既往手术记录（动态表格：每次手术一行）',
      category: '既往病史',
      fields: [
        {
          id: genId(), type: 'table', label: '手术记录', name: 'surgeryRecords', order: 1,
          autoRowNumber: true,
          columns: [
            col('text', '手术名称', 'surgeryName', 1),
            col('date', '手术日期', 'surgeryDate', 2),
            col('text', '手术医院', 'hospital', 3),
            col('select', '麻醉方式', 'anesthesia', 4, {
              options: ['全麻', '局麻', '腰麻', '其他'].map((v) => opt(v, v)),
            }),
            col('text', '备注', 'surgeryNote', 5),
          ],
        },
      ],
    }),
  },
  {
    keywords: ['过敏'],
    build: () => ({
      name: '过敏史',
      description: '过敏史记录（动态表格：每种过敏原一行）',
      category: '既往病史',
      fields: [
        {
          id: genId(), type: 'table', label: '过敏史记录', name: 'allergyRecords', order: 1,
          autoRowNumber: true,
          columns: [
            col('text', '过敏原', 'allergen', 1),
            col('text', '过敏反应', 'reaction', 2),
            col('select', '严重程度', 'severity', 3, {
              options: ['轻度', '中度', '重度'].map((v) => opt(v, v)),
            }),
            col('date', '发生日期', 'onsetDate', 4),
          ],
        },
      ],
    }),
  },
  {
    keywords: ['体格检查', '查体'],
    build: () => ({
      name: '体格检查',
      description: '常规体格检查',
      category: '体格检查',
      fields: [
        col('number', '身高(cm)', 'height', 1, { decimals: 1 }),
        col('number', '体重(kg)', 'weight', 2, { decimals: 1 }),
        col('select', '一般状况', 'generalStatus', 3, {
          options: ['正常', '异常'].map((v) => opt(v, v)),
        }),
        col('textarea', '异常描述', 'abnormalDesc', 4),
      ],
    }),
  },
  {
    keywords: ['心电图', 'ecg'],
    build: () => ({
      name: '心电图检查',
      description: '12 导联心电图检查',
      category: '检查/检验',
      fields: [
        col('date', '检查日期', 'ecgDate', 1),
        col('number', '心率(次/分)', 'heartRate', 2),
        col('select', '检查结果', 'ecgResult', 3, {
          options: ['正常', '异常无临床意义', '异常有临床意义'].map((v) => opt(v, v)),
        }),
        col('textarea', '异常描述', 'ecgDesc', 4),
      ],
    }),
  },
]

// ==================== 关键词类型推断（兜底） ====================

const toName = (() => {
  let seq = 0
  return (label: string) => {
    const ascii = label.replace(/[^a-zA-Z0-9]/g, '')
    return ascii ? ascii.toLowerCase() : `field_${++seq}_${Date.now().toString(36)}`
  }
})()

function guessField(label: string, order: number): CRFField {
  const name = toName(label)
  if (/日期|时间/.test(label)) return col('date', label, name, order)
  if (/是否|有无/.test(label)) return col('select', label, name, order, { options: [opt('是', 'yes'), opt('否', 'no')] })
  if (/性别/.test(label)) return col('select', label, name, order, { options: [opt('男', 'male'), opt('女', 'female')] })
  if (/严重程度|分级|程度/.test(label))
    return col('select', label, name, order, { options: ['轻度', '中度', '重度'].map((v) => opt(v, v)) })
  if (/年龄|身高|体重|次数|数量|剂量|血压|心率|面积|值/.test(label)) return col('number', label, name, order)
  if (/评分|量表/.test(label))
    return { id: genId(), type: 'scale', label, name, order, scaleConfig: { min: 0, max: 10, step: 1 } }
  if (/照片|附件|报告|文件|化验单/.test(label)) return col('fileUpload', label, name, order)
  if (/签名/.test(label)) return col('signature', label, name, order)
  if (/备注|描述|详情|病史|说明/.test(label)) return col('textarea', label, name, order)
  return col('text', label, name, order)
}

/** 从自由文本中提取字段名清单（支持顿号/逗号/分号/换行/“和”分隔） */
function parseFieldLabels(text: string): string[] {
  const cleaned = text.replace(
    /(我想要|我想|我要|我们想|我们要|帮我|给我|我们|我|请|需要|想要|设计|新建|创建|建|做|生成|一个|一下|模块|包含|包括|字段|如下|[:：])/g,
    '|',
  )
  return cleaned
    .split(/[|、，,；;。\n]|和|以及/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 2 && s.length <= 12 && !/模块|研究/.test(s))
    .slice(0, 20)
}

// ==================== 主入口 ====================

/** 库内复用检索：模块名包含关键词或被描述包含即命中 */
export function findLibraryMatch(text: string, library: ModuleLibraryItem[]): ModuleLibraryItem | null {
  const t = text.replace(/\s/g, '')
  return (
    library.find((m) => t.includes(m.name) || m.name.includes(t.replace(/模块|设计|帮我|建|需要|生成|一个/g, ''))) ??
    null
  )
}

export function generateModuleDraft(text: string, library: ModuleLibraryItem[]): AgentReply {
  // 1) 库内复用优先
  const hit = findLibraryMatch(text, library)
  if (hit) {
    return {
      text: `模块库中已有「${hit.name}」（${hit.category}，${hit.fields.length} 个字段），建议直接复用，避免重复建设。您可以先预览确认是否满足需求；如需在此基础上调整，告诉我具体改动即可。`,
      reuse: hit,
    }
  }

  // 2) 内置模板
  const tpl = TEMPLATES.find((t) => t.keywords.some((k) => text.toLowerCase().includes(k)))
  if (tpl) {
    const draft = tpl.build()
    return {
      text: `已为您生成「${draft.name}」模块草稿（分类：${draft.category}），共 ${draft.fields.length} 个字段，已按临床研究常规配置好选项与联动（如状态随日期自动更新、自动序号）。请在下方预览，确认后我将保存到模块库；如需调整，直接告诉我，例如"把剂量单位改成文本输入"。`,
      draft,
    }
  }

  // 3) 自由文本解析
  const labels = parseFieldLabels(text)
  if (labels.length >= 2) {
    // 双保险：首个候选名过短（如残留的"我"）时向后找第一个像样的名称
    const nameIdx = labels.findIndex((l) => l.length >= 2 && l.length <= 8)
    const name = nameIdx >= 0 ? labels[nameIdx] : '自定义模块'
    const fieldLabels = labels.filter((_, i) => i !== nameIdx)
    const draft: ModuleDraft = {
      name,
      description: `由 AI 助手根据描述生成：${text.slice(0, 50)}${text.length > 50 ? '…' : ''}`,
      category: '其他',
      fields: fieldLabels.map((l, i) => guessField(l, i + 1)),
    }
    return {
      text: `已根据您的描述生成「${draft.name}」草稿（${draft.fields.length} 个字段）。字段类型是我按名称推断的（如"日期"→日期选择器、"是否"→单选），请逐个核对预览效果；不合适的直接告诉我改，确认无误后我会保存到模块库「其他」分类。`,
      draft,
    }
  }

  return {
    text: '我还没完全理解您的需求。可以这样告诉我：\n· 「帮我建一个合并用药模块」\n· 「我需要一个随访记录模块，包含随访日期、随访方式、依从性和备注」\n您也可以直接发纸质 CRF 的照片（图片识别将在接入多模态模型后开放）。',
  }
}
