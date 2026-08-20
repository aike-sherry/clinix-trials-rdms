import { useSearchParams } from 'react-router'
import ProgressOverview from '@/components/dataMgmt/ProgressOverview'
import EntryDataMatrix from './dataMgmt/DataMatrix'

// ==================== 数据管理（进度总览 | 数据矩阵） ====================

export default function EntryDataMgmt() {
  // Tab 切换器已上移至模块定位条（与标题同行），通过 URL 参数驱动
  const [searchParams] = useSearchParams()
  const tab = searchParams.get('tab') === 'matrix' ? 'matrix' : 'progress'

  return (
    <div className="space-y-4">
      {tab === 'progress' ? <ProgressOverview role="entry" /> : <EntryDataMatrix />}
    </div>
  )
}
