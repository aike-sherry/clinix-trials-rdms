import { useEffect, useRef, useState } from 'react'
import { Bot, ImagePlus, Send, User, X, CheckCircle, Eye, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import CRFFormRenderer from '@/components/CRFFormRenderer'
import { generateModuleDraft, type ModuleDraft } from '@/utils/moduleAgent'
import type { ModuleLibraryItem } from '@/types'

const genId = () => `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
const now = () => new Date().toISOString()

interface ChatMsg {
  id: string
  role: 'user' | 'assistant'
  text: string
  /** 用户附带的图片（base64 缩略展示） */
  image?: string
  /** 新生成的草稿卡片 */
  draft?: ModuleDraft
  /** 库内复用建议卡片 */
  reuse?: ModuleLibraryItem
  /** 草稿是否已确认入库 */
  saved?: boolean
}

interface Props {
  open: boolean
  library: ModuleLibraryItem[]
  onClose: () => void
  /** 确认入库：由父组件写入模块库 */
  onSave: (item: ModuleLibraryItem) => void
  /** 打开库中已有模块（复用建议的「打开查看」） */
  onOpenModule: (m: ModuleLibraryItem) => void
}

const QUICK_PROMPTS = ['帮我建一个合并用药模块', '我需要一个疼痛评估模块', '建一个既往手术史模块', '随访记录模块，包含随访日期、随访方式、依从性和备注']

/** 模块草稿预览卡片（模块设计助手 / CRF 组装助手共用） */
export function ModuleDraftCard({ draft, saved, onConfirm }: { draft: ModuleDraft; saved?: boolean; onConfirm: () => void }) {
  return (
    <div className="rounded-xl border border-teal-200 bg-white overflow-hidden text-left">
      <div className="px-3 py-2 bg-teal-50/60 border-b border-teal-100">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-700">{draft.name}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-teal-100 text-teal-600">{draft.category}</span>
        </div>
        <div className="text-[10px] text-slate-400 mt-0.5">{draft.description}</div>
      </div>
      <div className="p-3 max-h-72 overflow-y-auto pointer-events-none">
        <CRFFormRenderer fields={draft.fields} readOnly />
      </div>
      <div className="px-3 py-2 border-t border-slate-100 flex items-center justify-end gap-2">
        {saved ? (
          <span className="inline-flex items-center gap-1 text-xs text-green-600">
            <CheckCircle className="w-3.5 h-3.5" /> 已入库
          </span>
        ) : (
          <Button size="sm" className="h-7 text-xs bg-teal-500 hover:bg-teal-600 text-white" onClick={onConfirm}>
            <CheckCircle className="w-3.5 h-3.5 mr-1" /> 预览通过，保存到模块库
          </Button>
        )}
      </div>
    </div>
  )
}

/**
 * 模块设计助手（Kimi 风格聊天面板，演示版）：
 * 对话描述需求 → 生成可预览的模块草稿 → 确认后写入模块库；
 * 生成逻辑为本地规则模拟，接入真实大模型后替换 generateModuleDraft 即可，交互不变。
 */
export function ModuleAgentChat({ open, library, onClose, onSave, onOpenModule }: Props) {
  const [msgs, setMsgs] = useState<ChatMsg[]>([
    {
      id: genId(), role: 'assistant',
      text: '您好，我是模块设计助手。直接告诉我您要设计的模块（文字描述或发照片都可以），我会自动生成草稿供您预览；确认后保存到模块库，全项目可复用。',
    },
  ])
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [msgs, thinking])

  if (!open) return null

  const push = (m: ChatMsg) => setMsgs((prev) => [...prev, m])

  const ask = (text: string, image?: string) => {
    if (!text.trim() && !image) return
    push({ id: genId(), role: 'user', text: text.trim() || '（图片）', image })
    setInput('')
    setThinking(true)
    // 模拟生成耗时；接入真实模型后为 API 调用
    setTimeout(() => {
      const reply = image
        ? { text: '图片已收到。当前为演示版，图片识别将在接入多模态模型后开放；本次我先按您的文字描述生成（如未填写文字，请补充一句描述，例如"这是一个合并用药表格"）。' }
        : generateModuleDraft(text, library)
      push({ id: genId(), role: 'assistant', text: reply.text, draft: 'draft' in reply ? reply.draft : undefined, reuse: 'reuse' in reply ? reply.reuse : undefined })
      setThinking(false)
    }, 700)
  }

  const handleFile = (f: File) => {
    const reader = new FileReader()
    reader.onload = () => ask(input, String(reader.result || ''))
    reader.readAsDataURL(f)
  }

  const confirmSave = (msg: ChatMsg) => {
    if (!msg.draft || msg.saved) return
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
    onSave(item)
    setMsgs((prev) => prev.map((m) => (m.id === msg.id ? { ...m, saved: true } : m)))
    push({
      id: genId(), role: 'assistant',
      text: `已保存到模块库（分类：${item.category}）✅ 后续设计 CRF 时可直接拖入访视使用；如需微调，在模块库中打开它即可继续编辑。还想设计下一个模块吗？`,
    })
  }

  return (
    <div className="fixed inset-y-0 right-0 w-[440px] bg-white border-l border-slate-200 shadow-2xl z-50 flex flex-col">
      {/* 头部 */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 bg-gradient-to-r from-teal-50 to-white">
        <div className="w-8 h-8 rounded-full bg-teal-500 flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold text-slate-700">模块设计助手</div>
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
            <div className={`max-w-[85%] space-y-2 ${m.role === 'user' ? 'text-right' : ''}`}>
              {m.image && (
                <img src={m.image} alt="附件" className="max-w-[220px] rounded-lg border border-slate-200 ml-auto" />
              )}
              <div className={`inline-block text-left text-xs leading-relaxed rounded-2xl px-3 py-2 whitespace-pre-wrap ${
                m.role === 'user' ? 'bg-teal-500 text-white rounded-tr-sm' : 'bg-white border border-slate-200 text-slate-700 rounded-tl-sm'
              }`}>
                {m.text}
              </div>

              {/* 草稿预览卡片 */}
              {m.draft && (
                <ModuleDraftCard draft={m.draft} saved={m.saved} onConfirm={() => confirmSave(m)} />
              )}

              {/* 复用建议卡片 */}
              {m.reuse && (
                <div className="rounded-xl border border-amber-200 bg-amber-50/40 overflow-hidden text-left">
                  <div className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-700">{m.reuse.name}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-600">{m.reuse.category}</span>
                      {m.reuse.isSystem && <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">系统预置</span>}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{m.reuse.description}</div>
                  </div>
                  <div className="px-3 py-2 border-t border-amber-100 flex justify-end">
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onOpenModule(m.reuse!)}>
                      <Eye className="w-3.5 h-3.5 mr-1" /> 打开查看
                    </Button>
                  </div>
                </div>
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
              正在生成模块草稿…
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
          <button
            className="text-slate-400 hover:text-teal-500 pb-0.5"
            title="发送纸质 CRF 照片（多模态识别，演示版为模拟）"
            onClick={() => fileRef.current?.click()}
          >
            <ImagePlus className="w-5 h-5" />
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) handleFile(f)
              e.target.value = ''
            }}
          />
          <textarea
            rows={1}
            className="flex-1 bg-transparent text-xs resize-none outline-none placeholder:text-slate-300 max-h-24"
            placeholder="描述您需要的模块，如：帮我建一个合并用药模块…"
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
        <div className="text-[10px] text-slate-300 mt-1.5 text-center">AI 起草 · 人工定稿：确认入库前请逐项核对字段</div>
      </div>
    </div>
  )
}
