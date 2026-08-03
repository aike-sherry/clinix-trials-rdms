import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { Compass, SlidersHorizontal, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import TopicQuery from './dataMgmt/TopicQuery'
import AdvancedQuery from './dataMgmt/AdvancedQuery'

type Mode = 'topic' | 'advanced'

const MODES: { value: Mode; label: string; desc: string; icon: typeof Compass }[] = [
  { value: 'topic', label: '主题查询', desc: '按数据主题快速问答', icon: Compass },
  { value: 'advanced', label: '高级筛选', desc: '跨模块条件组合', icon: SlidersHorizontal },
]

export interface SearchRequest {
  text: string
  nonce: number
}

export default function DataManagement() {
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = searchParams.get('tab')
  const mode: Mode = tab === 'advanced' ? 'advanced' : 'topic'

  // 顶部文字查询入口：提交时切到主题查询并下发解析请求
  const [queryText, setQueryText] = useState('')
  const [searchRequest, setSearchRequest] = useState<SearchRequest>({ text: '', nonce: 0 })

  const setMode = (m: Mode) => {
    const newParams = new URLSearchParams(searchParams)
    if (m === 'advanced') newParams.set('tab', 'advanced')
    else newParams.delete('tab')
    setSearchParams(newParams)
  }

  const submitSearch = () => {
    const text = queryText.trim()
    if (!text) return
    if (mode !== 'topic') setMode('topic')
    setSearchRequest((prev) => ({ text, nonce: prev.nonce + 1 }))
  }

  return (
    <div className="space-y-4">
      {/* 顶部主入口：搜索框 + 查询方式 */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            value={queryText}
            onChange={(e) => setQueryText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submitSearch()}
            placeholder="用文字描述查询，如：药物相关的不良事件、中山医院 V1 治疗期的患者、RJ003 的实验室检查"
            className="pl-9 pr-16 h-11 bg-white border-slate-200 shadow-sm"
          />
          <button
            onClick={submitSearch}
            disabled={!queryText.trim()}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 px-3 h-8 rounded-lg bg-sky-500 text-white text-sm hover:bg-sky-600 disabled:opacity-40 transition-colors"
          >
            查询
          </button>
        </div>
        {MODES.map((m) => {
          const Icon = m.icon
          const active = mode === m.value
          return (
            <button
              key={m.value}
              onClick={() => setMode(m.value)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm transition-all shrink-0 ${
                active
                  ? 'bg-sky-500 text-white shadow-sm'
                  : 'bg-white text-slate-500 border border-slate-200 hover:border-sky-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="font-medium">{m.label}</span>
              <span className={`text-xs ${active ? 'text-sky-100' : 'text-slate-400'}`}>{m.desc}</span>
            </button>
          )
        })}
      </div>

      {mode === 'topic' ? <TopicQuery searchRequest={searchRequest} /> : <AdvancedQuery />}
    </div>
  )
}
