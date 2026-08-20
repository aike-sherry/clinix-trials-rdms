import type { User } from '@/types'

export type AccountStatus = 'active' | 'frozen' | 'expired'

function today() {
  return new Date().toISOString().slice(0, 10)
}

/** 账号状态：使用中 / 冻结 / 已到期 */
export function accountStatus(u: User): AccountStatus {
  if (!u.isActive) return 'frozen'
  if (u.expiresAt && u.expiresAt < today()) return 'expired'
  return 'active'
}

export const ACCOUNT_STATUS_LABELS: Record<AccountStatus, string> = {
  active: '使用中',
  frozen: '冻结',
  expired: '已到期',
}
