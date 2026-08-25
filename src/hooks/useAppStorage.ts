import { useState, useCallback } from 'react'
import type { AppStorage, Project, Patient, VisitData, ModuleLibraryItem, CRFField, User, ProjectPermission, AuditLog, DataQuery, ModuleKey } from '@/types'
import { getDemoSeed, getDemoProjects, getDemoQueries, getDemoAuditLogs, getDemoLockedPatient } from '@/data/demoSeed'

const STORAGE_KEY = 'clini_x_rdms_data'
const VERSION_KEY = 'clini_x_rdms_version'
const MIG_REVIEW_KEY = 'clini_x_rdms_mig_review' // 一次性迁移：补充演示审核标记
const MIG_QUERY_KEY = 'clini_x_rdms_mig_query'   // 一次性迁移：补充演示疑问数据
const MIG_VISITINFO_KEY = 'clini_x_rdms_mig_visitinfo' // 一次性迁移：内置「访视信息」模块
const MIG_AUDIT_KEY = 'clini_x_rdms_mig_audit' // 一次性迁移：补充演示审计留痕
const MIG_LOCKED_KEY = 'clini_x_rdms_mig_locked' // 一次性迁移：补充全链路演示患者（PDF 下载演示）
const MIG_CHECKDEMO_KEY = 'clini_x_rdms_mig_checkdemo' // 一次性迁移：注入智能核查演示用「问题数据」
const MIG_EXTFILL_KEY = 'clini_x_rdms_mig_extfill' // 一次性迁移：人口学特征字段开启外部数据填充（HIS 抓取演示）
const MIG_INTEG_KEY = 'clini_x_rdms_mig_integration' // 一次性迁移：存量主持人账号补充「数据集成」模块权限
const MIG_SMARTCHECK_KEY = 'clini_x_rdms_mig_smartcheck' // 一次性迁移：存量账号默认开通「智能核查」（后台可再单独关闭）
const DATA_VERSION = '27' // 数据版本号，变更时自动重置缓存


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
      category: '基础模块',
      isSystem: true,
      fieldLayout: 'horizontal',
      createdAt: now(),
      updatedAt: now(),
      fields: [
        { id: genId(), type: 'text', label: '姓名', name: 'name', order: 1, validation: { required: true } },
        { id: genId(), type: 'select', label: '性别', name: 'gender', order: 2, validation: { required: true }, options: [{ label: '男', value: 'male' }, { label: '女', value: 'female' }], externalFill: { enabled: true, sourceField: 'EMR.DEM.GENDER' } },
        { id: genId(), type: 'date', label: '出生日期', name: 'birthDate', order: 3, validation: { required: true }, externalFill: { enabled: true, sourceField: 'EMR.DEM.BRTHDT' } },
        { id: genId(), type: 'select', label: '民族', name: 'ethnicity', order: 4, options: [{ label: '汉族', value: 'han' }, { label: '满族', value: 'manchu' }, { label: '蒙古族', value: 'mongol' }, { label: '回族', value: 'hui' }, { label: '藏族', value: 'tibetan' }, { label: '维吾尔族', value: 'uyghur' }, { label: '其他', value: 'other' }] },
        { id: genId(), type: 'number', label: '身高(cm)', name: 'height', order: 5, validation: { min: 50, max: 250 } },
        { id: genId(), type: 'number', label: '体重(kg)', name: 'weight', order: 6, validation: { min: 10, max: 300 } },
        { id: genId(), type: 'number', label: 'BMI', name: 'bmi', order: 7, helpText: '自动计算' },
      ],
    },
    {
      id: genId(),
      name: '知情同意',
      description: '知情同意书签署记录（GCP 必备）',
      category: '基础模块',
      isSystem: true,
      createdAt: now(),
      updatedAt: now(),
      fields: [
        { id: genId(), type: 'text', label: '知情同意书版本号', name: 'icfVersion', order: 1, validation: { required: true } },
        { id: genId(), type: 'date', label: '知情同意书版本日期', name: 'icfVersionDate', order: 2, validation: { required: true } },
        { id: genId(), type: 'radio', label: '是否同意参加本研究', name: 'consentGiven', order: 3, validation: { required: true }, options: [{ label: '同意', value: 'yes' }, { label: '不同意', value: 'no' }] },
        { id: genId(), type: 'date', label: '受试者签署日期', name: 'signDate', order: 4, validation: { required: true } },
        { id: genId(), type: 'radio', label: '是否同意接受随访联系', name: 'followupContact', order: 5, options: [{ label: '同意', value: 'yes' }, { label: '不同意', value: 'no' }] },
        { id: genId(), type: 'signature', label: '研究者签名', name: 'investigatorSign', order: 6 },
        { id: genId(), type: 'textarea', label: '备注', name: 'icfNote', order: 7, helpText: '如：法定代理人签署情况、再知情同意记录等' },
      ],
    },
    {
      id: genId(),
      name: '生命体征',
      description: '常规生命体征测量',
      category: '体格检查',
      isSystem: true,
      fieldLayout: 'horizontal',
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
      description: '常规实验室检验（预置检验项目；参考范围由执行人员上传，按生效日期自动判定偏高/偏低）',
      category: '实验室检查',
      isSystem: true,
      createdAt: now(),
      updatedAt: now(),
      fields: [
        {
          id: genId(), type: 'table', label: '检验结果', name: 'labRecords', order: 1,
          // 通用配置：预置行=检验项目；列类型 单位/正常值范围/判定状态 自动只读；范围版本由执行人员上传
          rowPreset: {
            col: 'item',
            rows: ['血红蛋白', '白细胞计数', '血小板计数', 'ALT', '肌酐', '白蛋白'],
          },
          columns: [
            { id: genId(), type: 'text', label: '项目', name: 'item', order: 1 },
            { id: genId(), type: 'number', label: '检测值', name: 'value', order: 2 },
            { id: genId(), type: 'unit', label: '单位', name: 'unit', order: 3 },
            { id: genId(), type: 'range', label: '正常值范围', name: 'range', order: 4 },
            { id: genId(), type: 'flag', label: '状态', name: 'flag', order: 5 },
            { id: genId(), type: 'date', label: '检查日期', name: 'testDate', order: 6 },
          ],
        },
      ],
    },
    {
      id: genId(),
      name: '病史采集',
      description: '既往病史及相关信息采集',
      category: '既往病史',
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
      description: '不良事件报告（动态表格：每条不良事件一行；转归随结束日期自动更新）',
      category: '安全性评估',
      isSystem: true,
      createdAt: now(),
      updatedAt: now(),
      fields: [
        {
          id: genId(), type: 'table', label: '不良事件记录', name: 'aeRecords', order: 1, autoRowNumber: true,
          autoStatus: { dateCol: 'endDate', statusCol: 'outcome' },
          columns: [
            { id: genId(), type: 'text', label: '事件名称', name: 'eventName', order: 1, validation: { required: true } },
            { id: genId(), type: 'date', label: '发生日期', name: 'onsetDate', order: 2, validation: { required: true } },
            { id: genId(), type: 'select', label: '严重程度', name: 'severity', order: 3, options: [{ label: '轻度', value: 'mild' }, { label: '中度', value: 'moderate' }, { label: '重度', value: 'severe' }, { label: '危及生命', value: 'life_threatening' }] },
            { id: genId(), type: 'select', label: '与试验药物关系', name: 'drugRelation', order: 4, options: [{ label: '有关', value: 'related' }, { label: '可能有关', value: 'possibly_related' }, { label: '可能无关', value: 'possibly_unrelated' }, { label: '无关', value: 'unrelated' }] },
            { id: genId(), type: 'text', label: '处理措施', name: 'actionTaken', order: 5 },
            { id: genId(), type: 'date', label: '结束日期', name: 'endDate', order: 6 },
            {
              id: genId(), type: 'select', label: '转归', name: 'outcome', order: 7,
              options: [{ label: '持续中', value: '持续中' }, { label: '已结束', value: '已结束' }],
            },
          ],
        },
      ],
    },
    {
      id: genId(),
      name: '合并用药',
      description: '合并用药记录（动态表格：每条用药一行；持续状态随结束日期自动更新）',
      category: '合并用药',
      isSystem: true,
      createdAt: now(),
      updatedAt: now(),
      fields: [
        {
          id: genId(), type: 'table', label: '合并用药记录', name: 'medRecords', order: 1, autoRowNumber: true,
          autoStatus: { dateCol: 'endDate', statusCol: 'status' },
          columns: [
            { id: genId(), type: 'text', label: '药物名称', name: 'drugName', order: 1, validation: { required: true } },
            { id: genId(), type: 'text', label: '剂量', name: 'dose', order: 2 },
            { id: genId(), type: 'text', label: '频次', name: 'frequency', order: 3 },
            { id: genId(), type: 'date', label: '开始日期', name: 'startDate', order: 4 },
            { id: genId(), type: 'date', label: '结束日期', name: 'endDate', order: 5 },
            {
              id: genId(), type: 'select', label: '持续状态', name: 'status', order: 6,
              options: [{ label: '持续中', value: '持续中' }, { label: '已结束', value: '已结束' }],
            },
          ],
        },
      ],
    },
    {
      id: genId(),
      name: '心电图检查',
      description: '十二导联心电图检查记录',
      category: '检查/检验',
      isSystem: true,
      createdAt: now(),
      updatedAt: now(),
      fields: [
        { id: genId(), type: 'date', label: '检查日期', name: 'examDate', order: 1, validation: { required: true } },
        { id: genId(), type: 'number', label: '心率(次/分)', name: 'heartRate', order: 2, validation: { min: 20, max: 250 } },
        { id: genId(), type: 'radio', label: '检查结果', name: 'result', order: 3, validation: { required: true }, options: [{ label: '正常', value: 'normal' }, { label: '异常无临床意义', value: 'abnormal_ncs' }, { label: '异常有临床意义', value: 'abnormal_cs' }] },
        { id: genId(), type: 'textarea', label: '异常描述', name: 'abnormalDesc', order: 4, helpText: '检查结果为异常时填写' },
        { id: genId(), type: 'fileUpload', label: '检查报告', name: 'report', order: 5 },
      ],
    },
    {
      id: genId(),
      name: '影像学检查',
      description: 'CT / MRI / 超声 / X线等影像学检查记录',
      category: '检查/检验',
      isSystem: true,
      createdAt: now(),
      updatedAt: now(),
      fields: [
        { id: genId(), type: 'select', label: '检查类型', name: 'examType', order: 1, validation: { required: true }, options: [{ label: 'CT', value: 'ct' }, { label: 'MRI', value: 'mri' }, { label: '超声', value: 'ultrasound' }, { label: 'X线', value: 'xray' }, { label: '其他', value: 'other' }] },
        { id: genId(), type: 'text', label: '检查部位', name: 'examSite', order: 2, validation: { required: true } },
        { id: genId(), type: 'date', label: '检查日期', name: 'examDate', order: 3, validation: { required: true } },
        { id: genId(), type: 'radio', label: '检查结果', name: 'result', order: 4, validation: { required: true }, options: [{ label: '正常', value: 'normal' }, { label: '异常无临床意义', value: 'abnormal_ncs' }, { label: '异常有临床意义', value: 'abnormal_cs' }] },
        { id: genId(), type: 'textarea', label: '影像所见', name: 'findings', order: 5 },
        { id: genId(), type: 'fileUpload', label: '检查报告', name: 'report', order: 6 },
      ],
    },
    {
      id: genId(),
      name: '疗效评价记录',
      description: '研究终点疗效评估记录',
      category: '疗效评估',
      isSystem: true,
      createdAt: now(),
      updatedAt: now(),
      fields: [
        { id: genId(), type: 'date', label: '评估日期', name: 'evalDate', order: 1, validation: { required: true } },
        { id: genId(), type: 'select', label: '疗效评价', name: 'response', order: 2, validation: { required: true }, options: [{ label: '完全缓解(CR)', value: 'cr' }, { label: '部分缓解(PR)', value: 'pr' }, { label: '疾病稳定(SD)', value: 'sd' }, { label: '疾病进展(PD)', value: 'pd' }, { label: '无法评估(NE)', value: 'ne' }] },
        { id: genId(), type: 'radio', label: '总体疗效', name: 'overallEfficacy', order: 3, options: [{ label: '显效', value: 'marked' }, { label: '有效', value: 'effective' }, { label: '无效', value: 'ineffective' }] },
        { id: genId(), type: 'text', label: '评估人', name: 'evaluator', order: 4 },
        { id: genId(), type: 'textarea', label: '评估备注', name: 'evalNote', order: 5 },
      ],
    },
  ]
}

// ---------- 智能核查演示：向记录数最多的 1-2 位患者注入少量「问题数据」 ----------
// 覆盖规则：L01-L08 各一条、R01 一条（范围/统计类规则由真实分布自然触发）
function injectCheckDemoFlaws(data: AppStorage): boolean {
  const countBy = new Map<string, number>()
  data.visitData.forEach((v) => countBy.set(v.patientId, (countBy.get(v.patientId) ?? 0) + 1))
  const candidates = data.patients
    .filter((p) => (countBy.get(p.id) ?? 0) >= 5)
    .sort((a, b) => (countBy.get(b.id) ?? 0) - (countBy.get(a.id) ?? 0))
  const t1 = candidates[0]
  const t2 = candidates[1]
  if (!t1) return false
  let changed = false
  const patch = (patientId: string, has: string, fn: (d: Record<string, unknown>) => Record<string, unknown>) => {
    const rec = data.visitData.find((v) => v.patientId === patientId && v.data && has in v.data)
    if (!rec) return
    rec.data = fn(rec.data as Record<string, unknown>)
    changed = true
  }
  // 患者甲：血压矛盾 / AE 日期倒置+转归矛盾 / 知情书版本日期晚于签署 / BMI 不符
  patch(t1.id, 'systolicBP', (d) => ({ ...d, systolicBP: 95, diastolicBP: 105 }))
  patch(t1.id, 'aeRecords', (d) => {
    const rows = Array.isArray(d.aeRecords) ? [...(d.aeRecords as Record<string, unknown>[])] : []
    if (rows[0]) rows[0] = { ...rows[0], onsetDate: '2026-03-10', endDate: '2026-03-05', outcome: '已结束' }
    if (rows[1]) rows[1] = { ...rows[1], endDate: '2026-03-08', outcome: '持续中' }
    else rows.push({ seq: 2, eventName: '头晕', onsetDate: '2026-03-01', severity: 'mild', drugRelation: 'possibly_related', actionTaken: '观察随访', endDate: '2026-03-08', outcome: '持续中' })
    return { ...d, aeRecords: rows }
  })
  patch(t1.id, 'signDate', (d) => ({ ...d, icfVersionDate: '2026-02-10', signDate: '2026-01-20' }))
  patch(t1.id, 'height', (d) => ({ ...d, height: 170, weight: 70, bmi: 30.5 }))
  if (t2) {
    // 患者乙：体温超生理极限 / 合并用药日期倒置 / 疗效评估早于入组 / 知情晚于入组
    patch(t2.id, 'temperature', (d) => ({ ...d, temperature: 43.6 }))
    patch(t2.id, 'medRecords', (d) => {
      const rows = Array.isArray(d.medRecords) ? [...(d.medRecords as Record<string, unknown>[])] : []
      if (rows[0]) rows[0] = { ...rows[0], startDate: '2026-03-10', endDate: '2026-03-01', status: '已结束' }
      return { ...d, medRecords: rows }
    })
    const enroll = t2.enrollmentDate
    if (enroll && /^\d{4}-\d{2}-\d{2}/.test(enroll)) {
      const day = 24 * 3600 * 1000
      const minus10 = new Date(new Date(enroll).getTime() - 10 * day).toISOString().slice(0, 10)
      const plus5 = new Date(new Date(enroll).getTime() + 5 * day).toISOString().slice(0, 10)
      patch(t2.id, 'evalDate', (d) => ({ ...d, evalDate: minus10 }))
      t2.consentDate = plus5
      changed = true
    }
  }
  return changed
}

function getInitialData(): AppStorage {
  try {
    // 版本号检查：不匹配则重置缓存（保留登录会话 + 用户配置的模块库）
    const storedVersion = localStorage.getItem(VERSION_KEY)
    let preservedUser: AppStorage['currentUser']
    let preservedModules: AppStorage['moduleLibrary'] | undefined
    if (storedVersion !== DATA_VERSION) {
      try {
        const oldRaw = localStorage.getItem(STORAGE_KEY)
        if (oldRaw) {
          const oldParsed = JSON.parse(oldRaw) as AppStorage
          preservedUser = oldParsed.currentUser
          // 约定保护：版本升级重置演示数据时，用户配置的模块库完整保留，不被种子覆盖
          if (oldParsed.moduleLibrary && oldParsed.moduleLibrary.length > 0) {
            preservedModules = oldParsed.moduleLibrary
          }
        }
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
      if (!parsed.auditLogs) parsed.auditLogs = []
      if (!parsed.queries) parsed.queries = []
      // 一次性迁移：为已签署但未审核的存量演示数据补充审核标记（约 70%，按记录 id 稳定判定）
      if (!localStorage.getItem(MIG_REVIEW_KEY)) {
        let changed = false
        parsed.visitData = parsed.visitData.map((v) => {
          if (v.status === 'completed' && v.signedAt && !v.reviewedAt) {
            const h = [...v.id].reduce((s, c) => s + c.charCodeAt(0), 0)
            if (h % 10 < 7) {
              changed = true
              return { ...v, reviewedAt: `${v.signedAt.slice(0, 11)}18:00:00.000Z`, reviewedBy: 'user_manager_01' }
            }
          }
          return v
        })
        localStorage.setItem(MIG_REVIEW_KEY, '1')
        if (changed) localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed))
      }
      // 一次性迁移：为存量数据补充演示疑问（仅当尚无疑问数据时）
      if (!localStorage.getItem(MIG_QUERY_KEY)) {
        if (parsed.queries.length === 0 && parsed.visitData.length > 0) {
          parsed.queries = getDemoQueries(parsed.visitData)
          localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed))
        }
        localStorage.setItem(MIG_QUERY_KEY, '1')
      }
      // 一次性迁移：为存量数据补充演示审计留痕（仅当尚无任何留痕时）
      if (!localStorage.getItem(MIG_AUDIT_KEY)) {
        if (parsed.auditLogs.length === 0 && parsed.patients.length > 0) {
          parsed.auditLogs = getDemoAuditLogs(parsed.patients)
          localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed))
        }
        localStorage.setItem(MIG_AUDIT_KEY, '1')
      }
      // 一次性迁移：为已发布项目补建内置「访视信息」模块（实际访视日期），并生成对应记录
      if (!localStorage.getItem(MIG_VISITINFO_KEY)) {
        let changed = false
        const newRecords: VisitData[] = []
        parsed.projects = parsed.projects.map((proj) => {
          if (!proj.crfPublished || proj.visits.length === 0) return proj
          if (proj.crfModules.some((m) => m.name === '访视信息')) return proj
          changed = true
          const modId = `mod_${proj.id}_visitinfo`
          const visitInfoMod = {
            id: modId, projectId: proj.id, name: '访视信息', description: '访视执行情况记录（内置）', order: 0,
            createdAt: now(), updatedAt: now(),
            fields: [
              { id: genId(), type: 'date' as const, label: '实际访视日期', name: 'visitDate', order: 1, validation: { required: true } },
              { id: genId(), type: 'select' as const, label: '是否按窗访视', name: 'inWindow', order: 2, options: [{ label: '是', value: 'yes' }, { label: '否', value: 'no' }] },
              { id: genId(), type: 'textarea' as const, label: '访视备注', name: 'visitNote', order: 3 },
            ],
          }
          const visits = proj.visits.map((v) => ({ ...v, crfModuleIds: [modId, ...v.crfModuleIds] }))
          // 为已有该访视记录的患者补建访视信息记录，实际访视日期取该访视最早录入日期
          const patientsOf = parsed.patients.filter((p) => p.projectId === proj.id)
          patientsOf.forEach((pt) => {
            visits.forEach((v) => {
              const recs = parsed.visitData.filter((r) => r.patientId === pt.id && r.visitId === v.id && r.moduleId !== modId)
              if (recs.length === 0) return
              const earliest = recs.map((r) => r.createdAt).sort()[0]
              const allCompleted = recs.every((r) => r.status === 'completed')
              newRecords.push({
                id: genId(),
                patientId: pt.id,
                projectId: proj.id,
                visitId: v.id,
                moduleId: modId,
                data: { visitDate: earliest.slice(0, 10), inWindow: 'no', visitNote: '' },
                status: allCompleted ? 'completed' : 'in_progress',
                createdAt: earliest,
                updatedAt: earliest,
                createdBy: recs[0].createdBy,
              })
            })
          })
          return { ...proj, crfModules: [visitInfoMod, ...proj.crfModules], visits }
        })
        if (changed) {
          parsed.visitData = [...parsed.visitData, ...newRecords]
          localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed))
        }
        localStorage.setItem(MIG_VISITINFO_KEY, '1')
      }
      // 一次性迁移：补充全链路演示患者（全部数据已录入/审核/锁定，用于 PDF 下载演示）
      if (!localStorage.getItem(MIG_LOCKED_KEY)) {
        const locked = getDemoLockedPatient(parsed.projects)
        if (locked && !parsed.patients.some((p) => p.id === locked.patient.id)) {
          parsed.patients = [...parsed.patients, locked.patient]
          parsed.visitData = [...parsed.visitData, ...locked.records]
          localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed))
        }
        localStorage.setItem(MIG_LOCKED_KEY, '1')
      }
      // 一次性迁移：人口学特征模块的 性别/出生日期 开启外部数据填充（HIS 抓取演示）
      if (!localStorage.getItem(MIG_EXTFILL_KEY)) {
        const EXT_MAP: Record<string, string> = { gender: 'EMR.DEM.GENDER', birthDate: 'EMR.DEM.BRTHDT' }
        const patchFields = (fields: CRFField[]) =>
          fields.map((f) =>
            EXT_MAP[f.name] && !f.externalFill?.enabled
              ? { ...f, externalFill: { enabled: true, sourceField: EXT_MAP[f.name] } }
              : f
          )
        let changed = false
        parsed.projects = parsed.projects.map((proj) => ({
          ...proj,
          crfModules: proj.crfModules.map((m) => {
            if (m.name !== '人口学特征') return m
            const next = patchFields(m.fields)
            if (next.some((f, i) => f !== m.fields[i])) changed = true
            return { ...m, fields: next }
          }),
        }))
        parsed.moduleLibrary = parsed.moduleLibrary.map((m) => {
          if (m.name !== '人口学特征') return m
          const next = patchFields(m.fields)
          if (next.some((f, i) => f !== m.fields[i])) changed = true
          return { ...m, fields: next }
        })
        if (changed) localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed))
        localStorage.setItem(MIG_EXTFILL_KEY, '1')
      }
      // 持续校正：课题主持人账号须含「数据集成」模块权限（兼容旧种子与版本重置导致的丢失）
      {
        let changed = false
        parsed.users = parsed.users.map((u) => {
          if (u.role !== 'manager' || !u.moduleAccess) return u
          if (u.moduleAccess.includes('integration')) return u
          changed = true
          return { ...u, moduleAccess: [...u.moduleAccess, 'integration'] }
        })
        // currentUser 同步刷新，避免当前会话仍用旧权限
        if (parsed.currentUser?.role === 'manager' && parsed.currentUser.moduleAccess && !parsed.currentUser.moduleAccess.includes('integration')) {
          parsed.currentUser = { ...parsed.currentUser, moduleAccess: [...parsed.currentUser.moduleAccess, 'integration'] }
          changed = true
        }
        if (changed) localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed))
        localStorage.setItem(MIG_INTEG_KEY, '1')
      }
      // 一次性迁移：注入智能核查演示用「问题数据」
      if (!localStorage.getItem(MIG_CHECKDEMO_KEY)) {
        if (injectCheckDemoFlaws(parsed)) localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed))
        localStorage.setItem(MIG_CHECKDEMO_KEY, '1')
      }
      // 一次性迁移：存量主持人/录入账号默认开通「智能核查」模块权限
      // 注意：必须为一次性（非持续校正），否则后台无法对客户关闭该功能
      if (!localStorage.getItem(MIG_SMARTCHECK_KEY)) {
        let changed = false
        const grant = <T extends { role: string; moduleAccess?: ModuleKey[] }>(u: T): T => {
          if ((u.role !== 'manager' && u.role !== 'data_entry') || !u.moduleAccess) return u
          if (u.moduleAccess.includes('smartCheck')) return u
          changed = true
          return { ...u, moduleAccess: [...u.moduleAccess, 'smartCheck'] }
        }
        parsed.users = parsed.users.map(grant)
        if (parsed.currentUser) parsed.currentUser = grant(parsed.currentUser)
        if (changed) localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed))
        localStorage.setItem(MIG_SMARTCHECK_KEY, '1')
      }
      return parsed
    }
    const demo = getDemoSeed()
    const data: AppStorage = {
      users: demo.users,
      projects: demo.projects,
      patients: demo.patients,
      visitData: demo.visitData,
      queries: demo.queries,
      auditLogs: demo.auditLogs,
      moduleLibrary: preservedModules ?? getDefaultModules(),
      projectPermissions: demo.projectPermissions,
      ...(preservedUser ? { currentUser: preservedUser } : {}),
    }
    injectCheckDemoFlaws(data)
    localStorage.setItem(MIG_CHECKDEMO_KEY, '1')
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
    queries: demo.queries,
    auditLogs: demo.auditLogs,
    moduleLibrary: getDefaultModules(),
    projectPermissions: demo.projectPermissions,
  }
  injectCheckDemoFlaws(data)
  localStorage.setItem(MIG_CHECKDEMO_KEY, '1')
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  localStorage.setItem(VERSION_KEY, DATA_VERSION)
  return data
}

function save(data: AppStorage) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

// ========== 审计留痕辅助 ==========
const AUDIT_MAX = 500 // 最多保留最近 500 条留痕

function fmtVal(v: unknown): string {
  if (v === undefined || v === null || v === '') return '（空）'
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

/** 对比两个对象的顶层字段，生成字段级变更明细（忽略 updatedAt） */
function diffObjects(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  skipKeys: string[] = []
): { field: string; before: string; after: string }[] {
  const skip = new Set(['updatedAt', ...skipKeys])
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])
  const changes: { field: string; before: string; after: string }[] = []
  keys.forEach((k) => {
    if (skip.has(k)) return
    const b = (before ?? {})[k]
    const a = (after ?? {})[k]
    if (JSON.stringify(b) !== JSON.stringify(a)) {
      changes.push({ field: k, before: fmtVal(b), after: fmtVal(a) })
    }
  })
  return changes
}

/** 生成一条审计记录并追加（保留最近 AUDIT_MAX 条） */
function withAudit(
  prev: AppStorage,
  entry: Omit<AuditLog, 'id' | 'timestamp' | 'userId' | 'userName' | 'role'>
): Pick<AppStorage, 'auditLogs'> {
  const log: AuditLog = {
    id: genId(),
    timestamp: now(),
    userId: prev.currentUser?.id ?? 'system',
    userName: prev.currentUser?.name ?? '系统',
    role: prev.currentUser?.role ?? 'admin',
    ...entry,
  }
  return { auditLogs: [...(prev.auditLogs ?? []), log].slice(-AUDIT_MAX) }
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
      const label = `研究项目「${project.projectNo} ${project.name}」`
      const audit = withAudit(prev, {
        action: exists ? 'update' : 'create',
        entityType: 'project',
        entityId: project.id,
        entityLabel: label,
        summary: exists ? `更新了${label}` : `新建了${label}`,
        changes: exists
          ? diffObjects(
              exists as unknown as Record<string, unknown>,
              project as unknown as Record<string, unknown>,
              ['visits', 'modules']
            )
          : undefined,
      })
      let next: AppStorage
      if (exists) {
        next = {
          ...prev,
          ...audit,
          projects: prev.projects.map((p) => (p.id === project.id ? project : p)),
        }
      } else {
        next = { ...prev, ...audit, projects: [...prev.projects, project] }
      }
      save(next)
      return next
    })
  }, [])

  const deleteProject = useCallback((id: string) => {
    setData((prev) => {
      const proj = prev.projects.find((p) => p.id === id)
      const label = proj ? `研究项目「${proj.projectNo} ${proj.name}」` : `研究项目（${id}）`
      const next = {
        ...prev,
        ...withAudit(prev, {
          action: 'delete',
          entityType: 'project',
          entityId: id,
          entityLabel: label,
          summary: `删除了${label}及其关联患者与录入数据`,
        }),
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
      const label = `受试者 ${patient.nameInitials}（${patient.screeningId || patient.screeningNo}）`
      const audit = withAudit(prev, {
        action: exists ? 'update' : 'create',
        entityType: 'patient',
        entityId: patient.id,
        entityLabel: label,
        summary: exists ? `更新了${label}的登记信息` : `登记了${label}`,
        changes: exists
          ? diffObjects(
              exists as unknown as Record<string, unknown>,
              patient as unknown as Record<string, unknown>
            )
          : undefined,
      })
      let next: AppStorage
      if (exists) {
        next = {
          ...prev,
          ...audit,
          patients: prev.patients.map((p) => (p.id === patient.id ? patient : p)),
        }
      } else {
        next = { ...prev, ...audit, patients: [...prev.patients, patient] }
      }
      save(next)
      return next
    })
  }, [])

  const deletePatient = useCallback((id: string) => {
    setData((prev) => {
      const pt = prev.patients.find((p) => p.id === id)
      const label = pt ? `受试者 ${pt.nameInitials}（${pt.screeningId || pt.screeningNo}）` : `受试者（${id}）`
      const next = {
        ...prev,
        ...withAudit(prev, {
          action: 'delete',
          entityType: 'patient',
          entityId: id,
          entityLabel: label,
          summary: `删除了${label}及其录入数据`,
        }),
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
      // 生成可读的对象描述：患者 + 访视 + 模块
      const pt = prev.patients.find((p) => p.id === vd.patientId)
      const proj = prev.projects.find((p) => p.id === vd.projectId)
      const visitName = proj?.visits.find((v) => v.id === vd.visitId)?.name ?? vd.visitId
      const moduleName =
        prev.moduleLibrary.find((m) => m.id === vd.moduleId)?.name
        ?? proj?.crfModules.find((m) => m.id === vd.moduleId)?.name
        ?? vd.moduleId
      const label = `访视数据「${pt?.nameInitials ?? vd.patientId} · ${visitName} · ${moduleName}」`
      // 变更明细：数据字段 + 状态/签署
      const changes = exists
        ? [
            ...diffObjects(
              exists as unknown as Record<string, unknown>,
              vd as unknown as Record<string, unknown>,
              ['data', 'id', 'patientId', 'projectId', 'visitId', 'moduleId', 'createdAt']
            ),
            ...diffObjects(
              (exists.data ?? {}) as Record<string, unknown>,
              (vd.data ?? {}) as Record<string, unknown>
            ),
          ]
        : undefined
      const audit = withAudit(prev, {
        action: exists ? 'update' : 'create',
        entityType: 'visitData',
        entityId: `${vd.patientId}|${vd.visitId}|${vd.moduleId}`,
        entityLabel: label,
        summary: exists ? `更新了${label}` : `录入了${label}`,
        changes: changes && changes.length > 0 ? changes : undefined,
      })
      let next: AppStorage
      if (exists) {
        next = {
          ...prev,
          ...audit,
          visitData: prev.visitData.map((v) =>
            v.patientId === vd.patientId && v.visitId === vd.visitId && v.moduleId === vd.moduleId ? vd : v
          ),
        }
      } else {
        next = { ...prev, ...audit, visitData: [...prev.visitData, vd] }
      }
      save(next)
      return next
    })
  }, [])

  // ========== Data Query（数据疑问） ==========
  const saveQuery = useCallback((query: DataQuery) => {
    setData((prev) => {
      const exists = prev.queries?.find((q) => q.id === query.id)
      const pt = prev.patients.find((p) => p.id === query.patientId)
      const proj = prev.projects.find((p) => p.id === query.projectId)
      const visitName = proj?.visits.find((v) => v.id === query.visitId)?.name ?? query.visitId
      const moduleName = prev.moduleLibrary.find((m) => m.id === query.moduleId)?.name ?? query.moduleId
      const target = `${pt?.nameInitials ?? query.patientId} · ${visitName} · ${moduleName}${query.fieldLabel ? ` · ${query.fieldLabel}` : ''}`
      // 摘要按状态流转区分：发起 / 回复 / 关闭 / 更新
      let summary: string
      if (!exists) {
        summary = `对「${target}」发起了数据疑问`
      } else if (exists.status !== 'closed' && query.status === 'closed') {
        summary = `关闭了「${target}」的数据疑问`
      } else if (exists.status === 'open' && query.status === 'answered') {
        summary = `回复了「${target}」的数据疑问`
      } else {
        summary = `更新了「${target}」的数据疑问`
      }
      const audit = withAudit(prev, {
        action: exists ? 'update' : 'create',
        entityType: 'query',
        entityId: query.id,
        entityLabel: `数据疑问「${target}」`,
        summary,
        changes: exists
          ? diffObjects(
              exists as unknown as Record<string, unknown>,
              query as unknown as Record<string, unknown>
            )
          : undefined,
      })
      const next: AppStorage = exists
        ? {
            ...prev,
            ...audit,
            queries: (prev.queries ?? []).map((q) => (q.id === query.id ? query : q)),
          }
        : { ...prev, ...audit, queries: [...(prev.queries ?? []), query] }
      save(next)
      return next
    })
  }, [])

  // ========== User ==========
  const saveUser = useCallback((user: User) => {
    setData((prev) => {
      const exists = prev.users.find((u) => u.id === user.id)
      const label = `账号 ${user.name}（${user.username}）`
      const audit = withAudit(prev, {
        action: exists ? 'update' : 'create',
        entityType: 'user',
        entityId: user.id,
        entityLabel: label,
        summary: exists ? `更新了${label}` : `新建了${label}`,
        changes: exists
          ? diffObjects(
              exists as unknown as Record<string, unknown>,
              user as unknown as Record<string, unknown>
            )
          : undefined,
      })
      let next: AppStorage
      if (exists) {
        next = {
          ...prev,
          ...audit,
          users: prev.users.map((u) => (u.id === user.id ? user : u)),
        }
      } else {
        next = { ...prev, ...audit, users: [...prev.users, user] }
      }
      save(next)
      return next
    })
  }, [])

  const deleteUser = useCallback((id: string) => {
    setData((prev) => {
      const u = prev.users.find((x) => x.id === id)
      const label = u ? `账号 ${u.name}（${u.username}）` : `账号（${id}）`
      const next = {
        ...prev,
        ...withAudit(prev, {
          action: 'delete',
          entityType: 'user',
          entityId: id,
          entityLabel: label,
          summary: `删除了${label}及其项目授权`,
        }),
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
      const proj = prev.projects.find((p) => p.id === perm.projectId)
      const u = prev.users.find((x) => x.id === perm.userId)
      const label = `项目授权「${proj?.projectNo ?? perm.projectId} → ${u?.name ?? perm.userId}」`
      const audit = withAudit(prev, {
        action: exists ? 'update' : 'create',
        entityType: 'projectPermission',
        entityId: perm.id,
        entityLabel: label,
        summary: exists ? `更新了${label}` : `新建了${label}`,
        changes: exists
          ? diffObjects(
              exists as unknown as Record<string, unknown>,
              perm as unknown as Record<string, unknown>
            )
          : undefined,
      })
      let next: AppStorage
      if (exists) {
        next = {
          ...prev,
          ...audit,
          projectPermissions: prev.projectPermissions.map((p) => (p.id === perm.id ? perm : p)),
        }
      } else {
        next = { ...prev, ...audit, projectPermissions: [...prev.projectPermissions, perm] }
      }
      save(next)
      return next
    })
  }, [])

  const deleteProjectPermission = useCallback((id: string) => {
    setData((prev) => {
      const perm = prev.projectPermissions.find((p) => p.id === id)
      const proj = perm ? prev.projects.find((p) => p.id === perm.projectId) : undefined
      const u = perm ? prev.users.find((x) => x.id === perm.userId) : undefined
      const label = perm
        ? `项目授权「${proj?.projectNo ?? perm.projectId} → ${u?.name ?? perm.userId}」`
        : `项目授权（${id}）`
      const next = {
        ...prev,
        ...withAudit(prev, {
          action: 'delete',
          entityType: 'projectPermission',
          entityId: id,
          entityLabel: label,
          summary: `撤销了${label}`,
        }),
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
      const label = `模块库模块「${item.name}」`
      const audit = withAudit(prev, {
        action: exists ? 'update' : 'create',
        entityType: 'moduleLibrary',
        entityId: item.id,
        entityLabel: label,
        summary: exists ? `更新了${label}` : `新建了${label}`,
        changes: exists
          ? diffObjects(
              exists as unknown as Record<string, unknown>,
              item as unknown as Record<string, unknown>,
              ['fields']
            )
          : undefined,
      })
      let next: AppStorage
      if (exists) {
        next = {
          ...prev,
          ...audit,
          moduleLibrary: prev.moduleLibrary.map((m) => (m.id === item.id ? item : m)),
        }
      } else {
        next = { ...prev, ...audit, moduleLibrary: [...prev.moduleLibrary, item] }
      }
      save(next)
      return next
    })
  }, [])

  const deleteModuleLibraryItem = useCallback((id: string) => {
    setData((prev) => {
      const m = prev.moduleLibrary.find((x) => x.id === id)
      const label = m ? `模块库模块「${m.name}」` : `模块库模块（${id}）`
      const next = {
        ...prev,
        ...withAudit(prev, {
          action: 'delete',
          entityType: 'moduleLibrary',
          entityId: id,
          entityLabel: label,
          summary: `删除了${label}`,
        }),
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
        ...withAudit(prev, {
          action: 'create',
          entityType: 'moduleLibrary',
          entityId: moduleId,
          entityLabel: `模块库模块「${module.name}」`,
          summary: `在模块「${module.name}」中新增了字段「${field.label}」`,
        }),
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
      const oldField = module.fields.find((f) => f.id === field.id)
      const next = {
        ...prev,
        ...withAudit(prev, {
          action: 'update',
          entityType: 'moduleLibrary',
          entityId: moduleId,
          entityLabel: `模块库模块「${module.name}」`,
          summary: `更新了模块「${module.name}」的字段「${field.label}」`,
          changes: oldField
            ? diffObjects(
                oldField as unknown as Record<string, unknown>,
                field as unknown as Record<string, unknown>
              )
            : undefined,
        }),
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
      const oldField = module.fields.find((f) => f.id === fieldId)
      const next = {
        ...prev,
        ...withAudit(prev, {
          action: 'delete',
          entityType: 'moduleLibrary',
          entityId: moduleId,
          entityLabel: `模块库模块「${module.name}」`,
          summary: `删除了模块「${module.name}」的字段「${oldField?.label ?? fieldId}」`,
        }),
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
      const next = {
        ...prev,
        ...withAudit(prev, {
          action: 'update',
          entityType: 'moduleLibrary',
          entityId: 'order',
          entityLabel: '模块库排序',
          summary: '调整了模块库模块的排列顺序',
        }),
        moduleLibrary: newOrder,
      }
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
        ...withAudit(prev, {
          action: 'update',
          entityType: 'moduleLibrary',
          entityId: moduleId,
          entityLabel: `模块库模块「${module.name}」`,
          summary: `调整了模块「${module.name}」内字段的排列顺序`,
        }),
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
    auditLogs: data.auditLogs ?? [],
    queries: data.queries ?? [],
    currentUser: data.currentUser,
    refresh,
    saveProject,
    deleteProject,
    savePatient,
    deletePatient,
    saveVisitData,
    saveQuery,
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
