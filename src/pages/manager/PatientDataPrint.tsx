import { useEffect, useMemo } from 'react'
import { useParams } from 'react-router'
import { useAppStorage } from '@/hooks/useAppStorage'
import type { CRFField, Project, VisitData } from '@/types'
import { Button } from '@/components/ui/button'
import { Printer, FileDown } from 'lucide-react'

// ==================== 字段值格式化 ====================

function optionLabel(field: CRFField, raw: unknown): string {
  const v = String(raw)
  const opt = field.options?.find((o) => String(o.value) === v)
  return opt ? String(opt.label) : v
}

/** 表格字段的行数据（数组对象） */
function asTableRows(value: unknown): Record<string, unknown>[] | null {
  if (!Array.isArray(value) || value.length === 0) return null
  return value.every((r) => r && typeof r === 'object' && !Array.isArray(r))
    ? (value as Record<string, unknown>[])
    : null
}

function fmtScalar(field: CRFField, value: unknown): string {
  if (value === undefined || value === null || value === '') return '—'
  if (typeof value === 'boolean') return value ? '是' : '否'
  if (typeof value === 'number') return field.unit ? `${value} ${field.unit}` : String(value)
  if (Array.isArray(value)) {
    if (value.length === 0) return '—'
    return value.map((v) => optionLabel(field, v)).join('、')
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>
    // 时间段
    const from = obj.from ?? obj.start ?? obj.startDate
    const to = obj.to ?? obj.end ?? obj.endDate
    if (from !== undefined || to !== undefined) return `${from || '—'} ~ ${to || '—'}`
    if (obj.signedBy || obj.signedAt) return `${obj.signedBy || ''} ${String(obj.signedAt || '').slice(0, 10)}`.trim() || '—'
    return JSON.stringify(value)
  }
  const s = String(value)
  if (field.type === 'select' || field.type === 'radio') return optionLabel(field, s)
  return s
}

function fmtTime(iso?: string): string {
  if (!iso) return '—'
  return iso.slice(0, 16).replace('T', ' ')
}

// ==================== 打印页 ====================

export default function PatientDataPrint() {
  const { patientId } = useParams<{ patientId: string }>()
  const { projects, patients, visitData, users } = useAppStorage()

  const patient = patients.find((p) => p.id === patientId)
  const project: Project | undefined = patient ? projects.find((p) => p.id === patient.projectId) : undefined
  const records = useMemo(
    () => visitData.filter((v) => v.patientId === patientId),
    [visitData, patientId]
  )

  const userName = (id?: string) => users.find((u) => u.id === id)?.name || id || '—'
  const centerName = project?.centers?.find((c) => c.id === patient?.centerId)?.name || project?.researchCenter || '—'

  const sortedVisits = useMemo(
    () => (project ? [...project.visits].sort((a, b) => a.order - b.order) : []),
    [project]
  )

  const recordOf = (visitId: string, moduleId: string): VisitData | undefined =>
    records.find((r) => r.visitId === visitId && r.moduleId === moduleId)

  // 汇总
  const completedRecords = records.filter((r) => r.status === 'completed')
  const allSigned = completedRecords.length > 0 && completedRecords.every((r) => r.signedAt)

  // 打开后自动唤起打印（可另存为 PDF）
  useEffect(() => {
    if (!patient || !project) return
    const t = setTimeout(() => window.print(), 800)
    return () => clearTimeout(t)
  }, [patient, project])

  if (!patient || !project) {
    return <div className="text-center py-20 text-slate-500">患者或项目不存在</div>
  }

  return (
    <div className="min-h-screen bg-slate-100 py-6 print:bg-white print:py-0">
      <style>{`
        @page { size: A4; margin: 12mm; }
        @media print {
          body { background: white !important; }
          .sheet { box-shadow: none !important; margin: 0 !important; max-width: none !important; padding: 0 !important; }
          .avoid-break { break-inside: avoid; }
        }
      `}</style>

      {/* 工具栏（打印时隐藏） */}
      <div className="print:hidden max-w-[210mm] mx-auto mb-4 flex items-center justify-between px-2">
        <div>
          <p className="text-sm font-semibold text-slate-700">患者数据档案 · 打印预览</p>
          <p className="text-xs text-slate-400">在打印对话框中选择「另存为 PDF」即可下载 PDF 文件</p>
        </div>
        <Button className="bg-sky-500 hover:bg-sky-600" onClick={() => window.print()}>
          <Printer className="w-4 h-4 mr-1.5" /> 打印 / 保存为 PDF
        </Button>
      </div>

      {/* A4 纸张 */}
      <div className="sheet max-w-[210mm] mx-auto bg-white shadow-md px-[14mm] py-[12mm] text-slate-800">
        {/* ============ 封面头 ============ */}
        <div className="border-b-2 border-slate-800 pb-4">
          <div className="flex items-center justify-between">
            <p className="text-[10px] tracking-[0.2em] text-slate-400">CLINI X TRIALS · 科研数据管理平台</p>
            <p className="text-[10px] text-slate-400 flex items-center gap-1">
              <FileDown className="w-3 h-3" /> 患者数据档案
            </p>
          </div>
          <h1 className="text-lg font-bold text-center mt-3">{project.name}</h1>
          <p className="text-center text-xs text-slate-500 mt-1 font-mono">{project.projectNo}</p>
        </div>

        {/* ============ 患者信息 ============ */}
        <div className="mt-4 avoid-break">
          <h2 className="text-sm font-bold border-l-4 border-sky-600 pl-2 mb-2">患者信息</h2>
          <table className="w-full text-xs border-collapse">
            <tbody>
              <tr>
                <td className="border border-slate-300 bg-slate-50 px-2 py-1.5 w-[14%] text-slate-500">筛选编号</td>
                <td className="border border-slate-300 px-2 py-1.5 w-[19%] font-medium">{patient.screeningId || '—'}</td>
                <td className="border border-slate-300 bg-slate-50 px-2 py-1.5 w-[14%] text-slate-500">随机编号</td>
                <td className="border border-slate-300 px-2 py-1.5 w-[19%] font-medium">{patient.randomizationId || '—'}</td>
                <td className="border border-slate-300 bg-slate-50 px-2 py-1.5 w-[14%] text-slate-500">姓名缩写</td>
                <td className="border border-slate-300 px-2 py-1.5 font-medium">{patient.nameInitials || '—'}</td>
              </tr>
              <tr>
                <td className="border border-slate-300 bg-slate-50 px-2 py-1.5 text-slate-500">性别</td>
                <td className="border border-slate-300 px-2 py-1.5">{patient.gender === 'male' ? '男' : patient.gender === 'female' ? '女' : '—'}</td>
                <td className="border border-slate-300 bg-slate-50 px-2 py-1.5 text-slate-500">出生日期</td>
                <td className="border border-slate-300 px-2 py-1.5">{patient.birthDate || '—'}</td>
                <td className="border border-slate-300 bg-slate-50 px-2 py-1.5 text-slate-500">所属中心</td>
                <td className="border border-slate-300 px-2 py-1.5">{centerName}</td>
              </tr>
              <tr>
                <td className="border border-slate-300 bg-slate-50 px-2 py-1.5 text-slate-500">知情日期</td>
                <td className="border border-slate-300 px-2 py-1.5">{patient.consentDate || '—'}</td>
                <td className="border border-slate-300 bg-slate-50 px-2 py-1.5 text-slate-500">入组日期</td>
                <td className="border border-slate-300 px-2 py-1.5">{patient.enrollmentDate || '—'}</td>
                <td className="border border-slate-300 bg-slate-50 px-2 py-1.5 text-slate-500">主要研究者</td>
                <td className="border border-slate-300 px-2 py-1.5">{project.principalInvestigator || '—'}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* ============ 访视数据 ============ */}
        {sortedVisits.map((visit) => {
          const modules = visit.crfModuleIds
            .map((mid) => project.crfModules.find((m) => m.id === mid))
            .filter(Boolean) as Project['crfModules']
          if (modules.length === 0) return null
          return (
            <div key={visit.id} className="mt-5">
              <div className="bg-slate-800 text-white text-xs font-bold px-3 py-1.5 rounded-t flex items-center justify-between">
                <span>{visit.code} · {visit.name}</span>
                <span className="font-normal text-slate-300">共 {modules.length} 个模块</span>
              </div>
              <div className="border border-slate-300 border-t-0 rounded-b divide-y divide-slate-200">
                {modules.map((mod) => {
                  const rec = recordOf(visit.id, mod.id)
                  const fields = [...mod.fields].sort((a, b) => a.order - b.order).filter((f) => f.type !== 'label')
                  return (
                    <div key={mod.id} className="avoid-break">
                      <div className="bg-slate-100 px-3 py-1.5 flex items-center justify-between">
                        <span className="text-xs font-bold">{mod.name}</span>
                        <span className="text-[10px] text-slate-500">
                          录入：{rec ? fmtTime(rec.updatedAt) : '未录入'} ｜ 审核：{rec?.reviewedBy ? `${rec.reviewedBy} ${fmtTime(rec.reviewedAt)}` : '未审核'} ｜ 签署：{rec?.signedBy ? `${rec.signedBy} ${fmtTime(rec.signedAt)}` : '未签署'}
                        </span>
                      </div>
                      <table className="w-full text-xs border-collapse">
                        <tbody>
                          {fields.map((f, fi) => {
                            const value = rec?.data?.[f.name]
                            const rows = asTableRows(value)
                            if (rows && f.columns) {
                              return (
                                <tr key={f.id}>
                                  <td colSpan={2} className="border border-slate-200 px-2 py-1.5">
                                    <p className="text-slate-500 mb-1">{f.label}</p>
                                    <table className="w-full text-[11px] border-collapse">
                                      <thead>
                                        <tr>
                                          {f.autoRowNumber && (
                                            <th className="border border-slate-200 bg-slate-50 px-1.5 py-1 w-8 text-center font-medium">#</th>
                                          )}
                                          {f.columns.map((c) => (
                                            <th key={c.id} className="border border-slate-200 bg-slate-50 px-1.5 py-1 text-left font-medium">{c.label}</th>
                                          ))}
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {rows.map((r, ri) => (
                                          <tr key={ri}>
                                            {f.autoRowNumber && (
                                              <td className="border border-slate-200 px-1.5 py-1 text-center text-slate-400">{ri + 1}</td>
                                            )}
                                            {f.columns!.map((c) => (
                                              <td key={c.id} className="border border-slate-200 px-1.5 py-1">{fmtScalar(c, r[c.name])}</td>
                                            ))}
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </td>
                                </tr>
                              )
                            }
                            return (
                              <tr key={f.id}>
                                <td className="border border-slate-200 bg-slate-50/60 px-2 py-1.5 w-[38%] text-slate-500">
                                  {fi + 1}. {f.label}
                                </td>
                                <td className="border border-slate-200 px-2 py-1.5">{fmtScalar(f, value)}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}

        {/* ============ 签署汇总 ============ */}
        <div className="mt-6 avoid-break">
          <h2 className="text-sm font-bold border-l-4 border-sky-600 pl-2 mb-2">数据确认与签署</h2>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr>
                <th className="border border-slate-300 bg-slate-50 px-2 py-1.5 text-left font-medium">环节</th>
                <th className="border border-slate-300 bg-slate-50 px-2 py-1.5 text-left font-medium">人员</th>
                <th className="border border-slate-300 bg-slate-50 px-2 py-1.5 text-left font-medium">时间</th>
                <th className="border border-slate-300 bg-slate-50 px-2 py-1.5 text-left font-medium">签名</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-slate-300 px-2 py-1.5">数据录入</td>
                <td className="border border-slate-300 px-2 py-1.5">{userName(records[0]?.createdBy)}</td>
                <td className="border border-slate-300 px-2 py-1.5">{fmtTime(records.map((r) => r.updatedAt).sort().pop())}</td>
                <td className="border border-slate-300 px-2 py-2.5"></td>
              </tr>
              <tr>
                <td className="border border-slate-300 px-2 py-1.5">数据审核（管理人员确认）</td>
                <td className="border border-slate-300 px-2 py-1.5">{userName(completedRecords.find((r) => r.reviewedBy)?.reviewedBy)}</td>
                <td className="border border-slate-300 px-2 py-1.5">{fmtTime(completedRecords.map((r) => r.reviewedAt).filter(Boolean).sort().pop())}</td>
                <td className="border border-slate-300 px-2 py-2.5"></td>
              </tr>
              <tr>
                <td className="border border-slate-300 px-2 py-1.5">数据签署（研究人员签署确认）</td>
                <td className="border border-slate-300 px-2 py-1.5">{userName(completedRecords.find((r) => r.signedBy)?.signedBy)}</td>
                <td className="border border-slate-300 px-2 py-1.5">{fmtTime(completedRecords.map((r) => r.signedAt).filter(Boolean).sort().pop())}</td>
                <td className="border border-slate-300 px-2 py-2.5"></td>
              </tr>
            </tbody>
          </table>
          {!allSigned && (
            <p className="text-[10px] text-amber-600 mt-2">提示：该患者尚有数据未完成录入 / 审核 / 签署，本档案为当前进度版本。</p>
          )}
        </div>

        {/* ============ 页脚 ============ */}
        <div className="mt-6 pt-3 border-t border-slate-300 flex items-center justify-between text-[10px] text-slate-400">
          <span>本档案由科研数据管理平台自动生成，数据以系统留痕记录为准</span>
          <span>生成时间：{new Date().toLocaleString('zh-CN', { hour12: false })}</span>
        </div>
      </div>
    </div>
  )
}
