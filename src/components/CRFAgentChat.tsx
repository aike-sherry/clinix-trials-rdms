import { useEffect, useRef, useState } from 'react'
import { Bot, Send, User, X, CheckCircle, Sparkles, CalendarRange, AlertTriangle, Wand2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { generateCRFPlan, type CRFPlan } from '@/utils/crfAgent'
import { generateModuleDraft, type ModuleDraft } from '@/utils/moduleAgent'
import { ModuleDraftCard } from '@/components/ModuleAgentChat'
import type { CRFField, ModuleLibraryItem, Project } from '@/types'

const genId = () => `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
const now = () => new Date().toISOString()

interface ChatMsg {
  id: string
  role: 'user' | 'assistant'
  text: string
  plan?: CRFPlan
  applied?: boolean
  /** 内嵌模块设计：草稿卡片 */
  draft?: ModuleDraft
  draftSaved?: boolean
  /** 产生该计划/草稿的原始用户描述（用于保存模块后自动刷新计划） */
  sourceText?: string
}

interface Props {
  open: boolean
  project: Project
  library: ModuleLibraryItem[]
  onClose: () => void
  /** 确认应用挂载计划：由父组件写入项目（导入库模块 + 更新访视挂载） */
  onApply: (plan: CRFPlan) => void
  /** 内嵌设计缺失模块：确认后写入模块库 */
  onSaveModule: (item: ModuleLibraryItem) => void
}

const QUICK_PROMPTS = [
  '筛选期挂知情同意、人口学特征',
  '每次访视都挂生命体征',
  'V1 挂实验室检查、心电图检查',
]

/**
 * CRF 组装助手（Kimi 风格聊天面板，演示版）：
 * 对话描述「哪次访视挂哪些模块」→ 生成挂载计划预览 → 确认后一键应用（库模块自动导入）。
 * 解析逻辑为本地规则模拟，接入真实大模型后替换 generateCRFPlan 即可，交互不变。
 */
export function CRFAgentChat({ open, project, library, onClose, onApply, onSaveModule }: Props) {
  const [msgs, setMsgs] = useState<ChatMsg[]>([
    {
      id: genId(), role: 'assistant',
      text: `您好，我是 CRF 组装助手。当前研究「${project.name}」共 ${project.visits.length} 次访视。直接告诉我每次访视要挂哪些模块，例如"筛选期挂知情同意、人口学特征"，我会自动生成挂载计划；确认后一键应用，模块库里的模块会自动导入本研究。遇到库里没有的模块，我可以当场为您设计。`,
    },
  ])
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [msgs, thinking])

  if (!open) return null

  const push = (m: ChatMsg) => setMsgs((prev) => [...prev, m])

  const ask = (text: string) => {
    if (!text.trim()) return
    push({ id: genId(), role: 'user', text: text.trim() })
    setInput('')
    setThinking(true)
    setTimeout(() => {
      const reply = generateCRFPlan(text, project, library)
      push({ id: genId(), role: 'assistant', text: reply.text, plan: reply.plan, sourceText: text })
      setThinking(false)
    }, 700)
  }

  const confirmApply = (msg: ChatMsg) => {
    if (!msg.plan || msg.applied) return
    onApply(msg.plan)
    setMsgs((prev) => prev.map((m) => (m.id === msg.id ? { ...m, applied: true } : m)))
    const isRemove = msg.plan.mode === 'remove'
    const n = isRemove
      ? msg.plan.items.reduce((s, i) => s + i.modules.filter((x) => !x.notMounted && x.source !== 'missing').length, 0)
      : msg.plan.items.reduce((s, i) => s + i.modules.filter((x) => !x.already).length, 0)
    push({
      id: genId(), role: 'assistant',
      text: isRemove
        ? `已移除 ✅ 共从 ${msg.plan.items.length} 次访视移除 ${n} 个模块（模块仍保留在研究中）。访视列表已同步更新；如需恢复，直接告诉我重新挂载即可。`
        : `已应用 ✅ 共为 ${msg.plan.items.length} 次访视挂载 ${n} 个模块。左侧访视树已同步更新，您可以逐个访视核对；还需要调整的话直接告诉我，例如"V2 去掉心电图检查"。`,
    })
  }

  /** 内嵌设计缺失模块：先走模块设计引擎（命中模板则生成完整草稿），否则生成基础骨架 */
  const designMissing = (name: string, planMsg: ChatMsg) => {
    push({ id: genId(), role: 'user', text: `帮我设计一个「${name}」模块` })
    setThinking(true)
    setTimeout(() => {
      const reply = generateModuleDraft(`我需要一个${name}模块`, library)
      if (reply.draft) {
        push({ id: genId(), role: 'assistant', text: reply.text, draft: reply.draft, sourceText: planMsg.sourceText })
      } else {
        // 未命中模板：生成基础骨架，字段后续可在模块库中完善
        const fields: CRFField[] = [
          { id: genId(), type: 'date', label: '检查日期', name: 'examDate', order: 1 },
          { id: genId(), type: 'textarea', label: '备注', name: 'note', order: 2 },
        ]
        push({
          id: genId(), role: 'assistant',
          text: `已为您起草「${name}」模块骨架（预置检查日期、备注两个基础字段）。确认保存到模块库后，我会自动更新上方的挂载计划；字段随时可以在模块库中继续完善，或直接告诉我补充，例如"包含检测部位、检测值"。`,
          draft: { name, description: '由 CRF 组装助手发起创建', category: '其他', fields },
          sourceText: planMsg.sourceText,
        })
      }
      setThinking(false)
    }, 700)
  }

  /** 保存内嵌设计的模块：入库后自动按最新模块库刷新原挂载计划 */
  const confirmSaveModule = (msg: ChatMsg) => {
    if (!msg.draft || msg.draftSaved) return
    const item: ModuleLibraryItem = {
      id: genId(),
      name: msg.draft.name,
      description: msg.draft.description,
      category: msg.draft.category,
      fields: msg.draft.fields,
      isSystem: false,
      createdAt: now(),
      updatedAt: now(),
    }
    onSaveModule(item)
    setMsgs((prev) => prev.map((m) => (m.id === msg.id ? { ...m, draftSaved: true } : m)))
    push({ id: genId(), role: 'assistant', text: `「${item.name}」已保存到模块库 ✅` })
    if (msg.sourceText) {
      const reply = generateCRFPlan(msg.sourceText, project, [...library, item])
      if (reply.plan && reply.plan.items.length > 0) {
        push({
          id: genId(), role: 'assistant',
          text: '已按最新模块库自动更新挂载计划（新模块标记为"从库导入"），请核对后应用：',
          plan: reply.plan, sourceText: msg.sourceText,
        })
      }
    }
  }

  return (
    <div className="fixed inset-y-0 right-0 w-[460px] bg-white border-l border-slate-200 shadow-2xl z-50 flex flex-col">
      {/* 头部 */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 bg-gradient-to-r from-teal-50 to-white">
        <div className="w-8 h-8 rounded-full bg-teal-500 flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold text-slate-700">CRF 组装助手</div>
          <div className="text-[10px] text-slate-400">演示版 · 接入大模型后自动升级为真实生成</div>
        </div>
        <Button variant="ghost" size="icon" className="text-slate-400" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* 消息区 */}
      <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-4 bg-slate-50/50">
        {msgs.map((m) => (
          <div key={m.id} className={`flex gap-2 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`w-7 h-7 rounded-full shrink-0 flex items-center justify-center ${m.role === 'user' ? 'bg-slate-200' : 'bg-teal-100'}`}>
              {m.role === 'user' ? <User className="w-4 h-4 text-slate-500" /> : <Bot className="w-4 h-4 text-teal-600" />}
            </div>
            <div className={`max-w-[88%] space-y-2 ${m.role === 'user' ? 'text-right' : ''}`}>
              <div className={`inline-block text-left text-xs leading-relaxed rounded-2xl px-3 py-2 whitespace-pre-wrap ${
                m.role === 'user' ? 'bg-teal-500 text-white rounded-tr-sm' : 'bg-white border border-slate-200 text-slate-700 rounded-tl-sm'
              }`}>
                {m.text}
              </div>

              {/* 挂载/移除计划卡片 */}
              {m.plan && m.plan.items.length > 0 && (() => {
                const isRemove = m.plan!.mode === 'remove'
                return (
                <div className={`rounded-xl border bg-white overflow-hidden text-left ${isRemove ? 'border-red-200' : 'border-teal-200'}`}>
                  <div className={`px-3 py-2 border-b flex items-center gap-2 ${isRemove ? 'bg-red-50/60 border-red-100' : 'bg-teal-50/60 border-teal-100'}`}>
                    {isRemove ? <Trash2 className="w-3.5 h-3.5 text-red-500" /> : <CalendarRange className="w-3.5 h-3.5 text-teal-600" />}
                    <span className="text-sm font-semibold text-slate-700">{isRemove ? '移除计划' : '挂载计划'}</span>
                    <span className="text-[10px] text-slate-400">{m.plan!.items.length} 次访视</span>
                  </div>
                  <div className="p-3 max-h-72 overflow-y-auto space-y-2.5">
                    {m.plan!.items.map((item) => (
                      <div key={item.visitId}>
                        <div className="text-xs font-medium text-slate-600 mb-1">{item.visitName}</div>
                        <div className="flex flex-wrap gap-1">
                          {item.modules.map((mod, i) => (
                            <span
                              key={i}
                              className={`text-[10px] px-1.5 py-0.5 rounded border ${
                                isRemove
                                  ? mod.notMounted || mod.source === 'missing'
                                    ? 'bg-slate-50 text-slate-400 border-slate-200 line-through'
                                    : 'bg-red-50 text-red-500 border-red-200'
                                  : mod.already
                                    ? 'bg-slate-50 text-slate-400 border-slate-200 line-through'
                                    : mod.source === 'library'
                                      ? 'bg-amber-50 text-amber-600 border-amber-200'
                                      : 'bg-teal-50 text-teal-600 border-teal-200'
                              }`}
                              title={
                                isRemove
                                  ? mod.notMounted || mod.source === 'missing' ? '该访视未挂载，跳过' : '将从该访视移除'
                                  : mod.already ? '已挂载，将跳过' : mod.source === 'library' ? '模块库导入' : '项目内已有'
                              }
                            >
                              {mod.name}
                              {!isRemove && mod.source === 'library' && !mod.already && ' ⤓'}
                              {isRemove && !mod.notMounted && mod.source !== 'missing' && ' ✕'}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                    <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-100">
                      {isRemove
                        ? '图例：红✕=将从该访视移除（模块保留在研究中） · 灰划线=未挂载将跳过'
                        : '图例：绿=项目内已有 · 黄⤓=从模块库自动导入 · 灰划线=已挂载将跳过'}
                    </div>
                    {!isRemove && m.plan!.missingModules.length > 0 && (
                      <div className="text-[10px] text-red-500 bg-red-50 rounded-lg px-2 py-1.5 space-y-1.5">
                        <div className="flex items-start gap-1.5">
                          <AlertTriangle className="w-3 h-3 mt-px shrink-0" />
                          <span>模块库中不存在以下模块，可以点击当场设计（保存后自动更新本计划）：</span>
                        </div>
                        <div className="flex flex-wrap gap-1 pl-4">
                          {m.plan!.missingModules.map((name) => (
                            <button
                              key={name}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-red-200 bg-white text-red-500 hover:bg-red-100 transition-colors"
                              onClick={() => designMissing(name, m)}
                            >
                              <Wand2 className="w-2.5 h-2.5" /> {name} · 立即设计
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {m.plan!.missingVisits.length > 0 && (
                      <div className="flex items-start gap-1.5 text-[10px] text-amber-600 bg-amber-50 rounded-lg px-2 py-1.5">
                        <AlertTriangle className="w-3 h-3 mt-px shrink-0" />
                        <span>未匹配到的访视：{m.plan!.missingVisits.join('、')}（已跳过）</span>
                      </div>
                    )}
                  </div>
                  <div className="px-3 py-2 border-t border-slate-100 flex items-center justify-end gap-2">
                    {m.applied ? (
                      <span className="inline-flex items-center gap-1 text-xs text-green-600">
                        <CheckCircle className="w-3.5 h-3.5" /> {isRemove ? '已移除' : '已应用'}
                      </span>
                    ) : (
                      <Button
                        size="sm"
                        className={`h-7 text-xs text-white ${isRemove ? 'bg-red-500 hover:bg-red-600' : 'bg-teal-500 hover:bg-teal-600'}`}
                        onClick={() => confirmApply(m)}
                      >
                        <CheckCircle className="w-3.5 h-3.5 mr-1" /> {isRemove ? '确认移除' : '确认应用'}
                      </Button>
                    )}
                  </div>
                </div>
                )
              })()}

              {/* 内嵌模块设计：草稿预览卡片 */}
              {m.draft && (
                <ModuleDraftCard draft={m.draft} saved={m.draftSaved} onConfirm={() => confirmSaveModule(m)} />
              )}
            </div>
          </div>
        ))}

        {thinking && (
          <div className="flex gap-2">
            <div className="w-7 h-7 rounded-full bg-teal-100 flex items-center justify-center">
              <Bot className="w-4 h-4 text-teal-600" />
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-sm px-3 py-2 text-xs text-slate-400">
              正在解析挂载计划…
            </div>
          </div>
        )}

        {/* 空状态快捷提问 */}
        {msgs.length === 1 && (
          <div className="space-y-1.5 pt-1">
            {QUICK_PROMPTS.map((q) => (
              <button
                key={q}
                className="block w-full text-left text-xs text-teal-600 bg-teal-50 hover:bg-teal-100 rounded-lg px-3 py-2 transition-colors"
                onClick={() => ask(q)}
              >
                {q}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 输入区 */}
      <div className="border-t border-slate-100 p-3 bg-white">
        <div className="flex items-end gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 focus-within:border-teal-300">
          <textarea
            rows={1}
            className="flex-1 bg-transparent text-xs resize-none outline-none placeholder:text-slate-300 max-h-24"
            placeholder="如：筛选期挂知情同意、人口学特征；每次访视都挂生命体征…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                ask(input)
              }
            }}
          />
          <Button
            size="icon"
            className="w-7 h-7 rounded-full bg-teal-500 hover:bg-teal-600 text-white shrink-0"
            disabled={!input.trim() || thinking}
            onClick={() => ask(input)}
          >
            <Send className="w-3.5 h-3.5" />
          </Button>
        </div>
        <div className="text-[10px] text-slate-300 mt-1.5 text-center">AI 组装 · 人工定稿：应用前请逐条核对挂载计划</div>
      </div>
    </div>
  )
}
