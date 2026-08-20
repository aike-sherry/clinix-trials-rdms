import { useState } from 'react'

export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100]

/**
 * 表格「每页行数」状态，按 storageKey 持久化到 localStorage。
 * 用户调整行数后，从其他模块再次进入页面时保持上次的选择。
 */
export function usePageSize(storageKey: string, defaultSize = 20) {
  const [pageSize, setPageSizeState] = useState(() => {
    const v = Number(localStorage.getItem(storageKey))
    return PAGE_SIZE_OPTIONS.includes(v) ? v : defaultSize
  })
  const setPageSize = (n: number) => {
    localStorage.setItem(storageKey, String(n))
    setPageSizeState(n)
  }
  return [pageSize, setPageSize] as const
}
