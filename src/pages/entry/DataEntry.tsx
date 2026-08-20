import EntryVisitStatusMatrix from './VisitStatusMatrix'

/**
 * 数据录入（录入端）：患者 × 访视 录入状态矩阵。
 * 点击访视格子直达该患者对应访视的录入页；顶部项目筛选框通过 URL 参数驱动。
 */
export default function EntryDataEntry() {
  return <EntryVisitStatusMatrix />
}
