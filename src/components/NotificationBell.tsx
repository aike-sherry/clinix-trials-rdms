import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { useAppStorage } from '@/hooks/useAppStorage'
import { Bell, Megaphone, MessageCircleQuestion, Wrench, Sparkles, CheckCheck } from 'lucide-react'

/**
 * 公告通知铃铛：未读数角标 + 下拉公告面板。
 * 内容 = 系统公告（演示数据，正式环境由后台发布）+ 业务待办（按角色动态统计）。
 * 已读状态持久化到 localStorage。
 */

type NoticeType = 'announcement' | 'update' | 'maintenance' | 'todo'

interface Notice {
  id: string
  type: NoticeType
  title: string
  desc: string
  time: string
  /** 点击跳转地址（可选） */
  link?: string
}

const READ_KEY = 'crf_read_notifications'

// 演示公告（正式环境由后台管理员发布，此处为静态演示数据）
const DEMO_NOTICES: Notice[] = [
  {
    id: 'notice_ae',
    type: 'announcement',
    title: '关于规范不良事件填报的通知',
    desc: '请各中心在不良事件发生后 24 小时内完成录入，并注明与研究药物的相关性判断。',
    time: '2026-08-12 10:30',
  },
  {
    id: 'notice_stats',
    type: 'update',
    title: '统计分析模块功能更新',
    desc: '新增目标字段叠加统计与中心维度对比视图，欢迎试用并向项目组反馈。',
    time: '2026-08-10 15:00',
  },
  {
    id: 'notice_maintain',
    type: 'maintenance',
    title: '系统升级维护预告',
    desc: '平台将于 8 月 16 日（周日）22:00–24:00 升级维护，期间请避免录入数据。',
    time: '2026-08-08 09:00',
  },
]

const TYPE_META: Record<NoticeType, { icon: typeof Bell; gradient: string; label: string }> = {
  announcement: { icon: Megaphone, gradient: 'from-sky-500 to-blue-600', label: '公告' },
  update: { icon: Sparkles, gradient: 'from-teal-500 to-emerald-600', label: '更新' },
  maintenance: { icon: Wrench, gradient: 'from-slate-400 to-slate-500', label: '维护' },
  todo: { icon: MessageCircleQuestion, gradient: 'from-orange-500 to-amber-600', label: '待办' },
}

export default function NotificationBell({ role }: { role: 'manager' | 'admin' | 'data_entry' }) {
  const navigate = useNavigate()
  const { queries } = useAppStorage()
  const [open, setOpen] = useState(false)
  const [readIds, setReadIds] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(READ_KEY) || '[]')
    } catch {
      return []
    }
  })

  // 业务待办（按角色动态统计）
  const todoNotices = useMemo<Notice[]>(() => {
    const items: Notice[] = []
    if (role === 'manager') {
      const answered = queries.filter((q) => q.status === 'answered').length
      if (answered > 0) {
        items.push({
          id: 'todo_answered',
          type: 'todo',
          title: `${answered} 条质疑已回复待关闭`,
          desc: '录入人员已回复，请审核确认后关闭。',
          time: '实时',
          link: '/manager/queries',
        })
      }
    }
    if (role === 'data_entry') {
      const pending = queries.filter((q) => q.status === 'open').length
      if (pending > 0) {
        items.push({
          id: 'todo_open',
          type: 'todo',
          title: `${pending} 条质疑待您回复`,
          desc: '请核对数据并及时回复管理人员。',
          time: '实时',
          link: '/entry/queries',
        })
      }
    }
    return items
  }, [queries, role])

  const notices = [...todoNotices, ...DEMO_NOTICES]
  const unread = notices.filter((n) => !readIds.includes(n.id))

  const persist = (ids: string[]) => {
    setReadIds(ids)
    localStorage.setItem(READ_KEY, JSON.stringify(ids))
  }
  const markRead = (n: Notice) => {
    if (!readIds.includes(n.id)) persist([...readIds, n.id])
    if (n.link) {
      setOpen(false)
      navigate(n.link)
    }
  }
  const markAllRead = () => persist(notices.map((n) => n.id))

  return (
    <div className="relative">
      <button
        type="button"
        title="公告通知"
        onClick={() => setOpen((v) => !v)}
        className={`relative w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
          open ? 'bg-teal-50 text-teal-600' : 'text-slate-500 hover:bg-slate-100 hover:text-teal-600'
        }`}
      >
        <Bell className="w-5 h-5" />
        {unread.length > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center shadow">
            {unread.length}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* 点击外部关闭 */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-11 z-50 w-[380px] rounded-2xl bg-white shadow-xl shadow-slate-900/10 border border-slate-100 overflow-hidden">
            {/* 面板头 */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-gradient-to-r from-teal-50/60 to-sky-50/60">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-800">公告通知</span>
                {unread.length > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-500 font-medium">
                    {unread.length} 条未读
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={markAllRead}
                disabled={unread.length === 0}
                className="inline-flex items-center gap-1 text-xs text-teal-600 hover:text-teal-700 disabled:text-slate-300 transition-colors"
              >
                <CheckCheck className="w-3.5 h-3.5" /> 全部已读
              </button>
            </div>

            {/* 通知列表 */}
            <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-50">
              {notices.map((n) => {
                const meta = TYPE_META[n.type]
                const Icon = meta.icon
                const isUnread = !readIds.includes(n.id)
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => markRead(n)}
                    className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 ${
                      isUnread ? 'bg-teal-50/40' : ''
                    }`}
                  >
                    <span
                      className={`w-9 h-9 rounded-xl bg-gradient-to-br ${meta.gradient} flex items-center justify-center text-white shrink-0 shadow-sm mt-0.5`}
                    >
                      <Icon className="w-4 h-4" />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="flex items-center gap-2">
                        <span className={`text-[13px] truncate ${isUnread ? 'font-semibold text-slate-800' : 'font-medium text-slate-600'}`}>
                          {n.title}
                        </span>
                        {isUnread && <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />}
                      </span>
                      <span className="block text-xs text-slate-400 mt-1 leading-relaxed line-clamp-2">{n.desc}</span>
                      <span className="flex items-center gap-2 mt-1.5">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-400">{meta.label}</span>
                        <span className="text-[10px] text-slate-300">{n.time}</span>
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>

            {/* 面板脚 */}
            <div className="px-4 py-2.5 border-t border-slate-100 text-center">
              <span className="text-[11px] text-slate-300">公告由平台管理员发布 · 点击通知可标记已读</span>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
