import VisitStatusMatrix from '@/components/dataMgmt/VisitStatusMatrix'

/** 数据录入（录入端）：患者 × 访视 录入状态矩阵，格子直达该患者对应访视的录入页 */
export default function EntryVisitStatusMatrix() {
  return (
    <VisitStatusMatrix
      title="访视录入矩阵"
      pageSizeKey="crf_pagesize_entry_dataentry"
      patientLink={(p) => `/entry/patients/${p.id}`}
      cellLink={(p, v) => `/entry/patients/${p.id}?visitId=${v.id}`}
      identityLayout="entry"
    />
  )
}
