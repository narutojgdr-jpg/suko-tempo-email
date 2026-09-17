"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport, type UIMessage } from "ai"
import {
  Plus,
  MessageSquare,
  Trash2,
  Menu,
  X,
  Sparkles,
  Zap,
  ArrowLeft,
  Lock,
  Loader2,
} from "lucide-react"
import { toast } from "sonner"
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation"
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message"
import {
  PromptInput,
  PromptInputBody,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputTools,
  PromptInputSubmit,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input"
import {
  createConversation,
  getConversationMessages,
  deleteConversation,
  getChatState,
  type ConversationSummary,
} from "@/app/actions/chat"
import type { ChatQuota } from "@/lib/chat"

type Lang = string

const T: Record<string, Record<string, string>> = {
  en: {
    newChat: "New chat",
    placeholder: "Message SuKo AI...",
    history: "Chats",
    noAccessTitle: "No chat access yet",
    noAccessBody: "Your account hasn't been granted access to the assistant. Contact the admin to get access.",
    quotaTitle: "Hourly usage",
    remaining: "remaining",
    resetIn: "Resets in",
    quotaExceeded: "You've reached your usage limit. It resets soon.",
    emptyTitle: "How can I help you today?",
    emptyBody: "Ask anything — write, brainstorm, code, or learn.",
    deleteConfirm: "Delete this conversation?",
    back: "Back to site",
    tokens: "tokens",
    min: "min",
    error: "Something went wrong. Try again.",
  },
  pt: {
    newChat: "Nova conversa",
    placeholder: "Envie uma mensagem para a SuKo AI...",
    history: "Conversas",
    noAccessTitle: "Sem acesso ao chat",
    noAccessBody: "Sua conta ainda não tem acesso ao assistente. Fale com o admin para liberar.",
    quotaTitle: "Uso por janela",
    remaining: "restantes",
    resetIn: "Renova em",
    quotaExceeded: "Você atingiu o limite de uso. Ele renova em breve.",
    emptyTitle: "Como posso te ajudar hoje?",
    emptyBody: "Pergunte qualquer coisa — escrever, ideias, código ou aprender.",
    deleteConfirm: "Apagar esta conversa?",
    back: "Voltar ao site",
    tokens: "tokens",
    min: "min",
    error: "Algo deu errado. Tente de novo.",
  },
  ru: {
    newChat: "Новый чат",
    placeholder: "Сообщение для SuKo AI...",
    history: "Чаты",
    noAccessTitle: "Нет доступа к чату",
    noAccessBody: "Вашему аккаунту ещё не предоставлен доступ к ассистенту. Обратитесь к админу.",
    quotaTitle: "Использование",
    remaining: "осталось",
    resetIn: "Сброс через",
    quotaExceeded: "Вы достигли лимита. Скоро он обновится.",
    emptyTitle: "Чем я могу помочь?",
    emptyBody: "Спросите что угодно — писать, идеи, код или учиться.",
    deleteConfirm: "Удалить этот разговор?",
    back: "На сайт",
    tokens: "токенов",
    min: "мин",
    error: "Что-то пошло не так. Попробуйте снова.",
  },
}

function modelLabel(model: string): string {
  const map: Record<string, string> = {
    "openai/gpt-5-mini": "GPT-5 mini",
    "openai/gpt-5": "GPT-5",
    "openai/gpt-5-nano": "GPT-5 nano",
  }
  return map[model] ?? model.replace(/^openai\//, "").toUpperCase()
}

function getText(msg: UIMessage): string {
  if (!msg?.parts) return ""
  return msg.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("")
}

interface ChatAppProps {
  lang: Lang
  dict: Record<string, unknown>
  user: { name: string | null; email: string | null; image: string | null }
  isAdmin: boolean
  initialQuota: ChatQuota | null
  initialConversations: ConversationSummary[]
}

export function ChatApp({ lang, user, initialQuota, initialConversations }: ChatAppProps) {
  const t = T[lang] ?? T.en
  const [quota, setQuota] = useState<ChatQuota | null>(initialQuota)
  const [conversations, setConversations] = useState<ConversationSummary[]>(initialConversations)
  const [activeId, setActiveId] = useState<number | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [loadingConv, setLoadingConv] = useState(false)
  const activeIdRef = useRef<number | null>(null)
  activeIdRef.current = activeId

  const { messages, sendMessage, status, setMessages, stop } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
    onFinish: () => {
      void refreshState()
    },
    onError: () => {
      toast.error(t.error)
      void refreshState()
    },
  })

  const refreshState = useCallback(async () => {
    try {
      const state = await getChatState()
      setQuota(state.quota)
      setConversations(state.conversations)
    } catch {
      /* ignore */
    }
  }, [])

  const hasAccess = quota?.hasAccess ?? false
  const limitReached = !!quota && quota.usedTokens >= quota.tokenLimit

  const handleSubmit = useCallback(
    async (message: PromptInputMessage) => {
      const text = message.text?.trim()
      if (!text || !hasAccess || limitReached) return
      if (status === "submitted" || status === "streaming") return

      let cid = activeIdRef.current
      if (!cid) {
        const res = await createConversation()
        if (res) {
          cid = res.id
          setActiveId(cid)
          setConversations((prev) => [
            { id: res.id, title: text.slice(0, 80), updatedAt: new Date().toISOString() },
            ...prev,
          ])
        }
      }
      sendMessage({ text }, { body: { conversationId: cid } })
    },
    [hasAccess, limitReached, status, sendMessage],
  )

  const openConversation = useCallback(
    async (id: number) => {
      setActiveId(id)
      setSidebarOpen(false)
      setLoadingConv(true)
      try {
        const rows = await getConversationMessages(id)
        setMessages(
          rows.map((r) => ({
            id: String(r.id),
            role: r.role,
            parts: [{ type: "text", text: r.content }],
          })) as UIMessage[],
        )
      } finally {
        setLoadingConv(false)
      }
    },
    [setMessages],
  )

  const newChat = useCallback(() => {
    setActiveId(null)
    setMessages([])
    setSidebarOpen(false)
  }, [setMessages])

  const removeConversation = useCallback(
    async (id: number, e: React.MouseEvent) => {
      e.stopPropagation()
      if (!confirm(t.deleteConfirm)) return
      await deleteConversation(id)
      setConversations((prev) => prev.filter((c) => c.id !== id))
      if (activeIdRef.current === id) newChat()
    },
    [newChat, t.deleteConfirm],
  )

  const busy = status === "submitted" || status === "streaming"

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-border bg-card transition-transform md:static md:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-3 py-3">
          <div className="flex items-center gap-2 px-1">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Sparkles className="h-4 w-4" />
            </span>
            <span className="text-sm font-semibold">SuKo AI</span>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted md:hidden"
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-3 pb-2">
          <button
            onClick={newChat}
            className="flex w-full items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium transition-colors hover:bg-muted"
          >
            <Plus className="h-4 w-4" />
            {t.newChat}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-2">
          <p className="px-2 py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t.history}
          </p>
          <ul className="mt-1 space-y-0.5">
            {conversations.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => openConversation(c.id)}
                  className={`group flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors ${
                    activeId === c.id
                      ? "bg-primary/10 text-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <MessageSquare className="h-4 w-4 shrink-0" />
                  <span className="flex-1 truncate">{c.title}</span>
                  <span
                    onClick={(e) => removeConversation(c.id, e)}
                    className="shrink-0 rounded p-1 opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                    aria-label="Delete conversation"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </span>
                </button>
              </li>
            ))}
            {conversations.length === 0 && (
              <li className="px-2.5 py-2 text-xs text-muted-foreground">—</li>
            )}
          </ul>
        </div>

        {/* Quota footer */}
        {quota && hasAccess && <QuotaBar quota={quota} t={t} />}

        <a
          href={`/${lang}`}
          className="flex items-center gap-2 border-t border-border px-4 py-3 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {t.back}
        </a>
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden
        />
      )}

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-border px-4 py-3">
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted md:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">SuKo AI</span>
            {quota && (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                <Zap className="h-3 w-3" />
                {modelLabel(quota.model)}
              </span>
            )}
          </div>
        </header>

        {!hasAccess ? (
          <NoAccess t={t} />
        ) : (
          <>
            <Conversation className="flex-1">
              <ConversationContent className="mx-auto w-full max-w-3xl px-4 py-6">
                {messages.length === 0 && !loadingConv ? (
                  <div className="flex h-full min-h-[50vh] flex-col items-center justify-center text-center">
                    <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                      <Sparkles className="h-6 w-6" />
                    </span>
                    <h2 className="text-xl font-semibold text-balance">{t.emptyTitle}</h2>
                    <p className="mt-1 max-w-sm text-sm text-muted-foreground text-pretty">{t.emptyBody}</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {messages.map((m) => (
                      <Message from={m.role} key={m.id}>
                        <MessageContent>
                          {m.role === "assistant" ? (
                            <MessageResponse>{getText(m)}</MessageResponse>
                          ) : (
                            getText(m)
                          )}
                        </MessageContent>
                      </Message>
                    ))}
                    {status === "submitted" && (
                      <Message from="assistant">
                        <MessageContent>
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        </MessageContent>
                      </Message>
                    )}
                  </div>
                )}
              </ConversationContent>
              <ConversationScrollButton />
            </Conversation>

            <div className="border-t border-border bg-background px-4 py-3">
              <div className="mx-auto w-full max-w-3xl">
                {limitReached && (
                  <p className="mb-2 rounded-lg bg-destructive/10 px-3 py-2 text-center text-xs font-medium text-destructive">
                    {t.quotaExceeded}
                  </p>
                )}
                <PromptInput onSubmit={handleSubmit}>
                  <PromptInputBody>
                    <PromptInputTextarea placeholder={t.placeholder} disabled={limitReached} />
                  </PromptInputBody>
                  <PromptInputFooter>
                    <PromptInputTools />
                    <PromptInputSubmit
                      status={status}
                      onStop={stop}
                      disabled={(!busy && limitReached) || undefined}
                    />
                  </PromptInputFooter>
                </PromptInput>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function QuotaBar({ quota, t }: { quota: ChatQuota; t: Record<string, string> }) {
  const pct = Math.min(100, (quota.usedTokens / quota.tokenLimit) * 100)
  const near = pct >= 80
  const barColor = near ? "bg-destructive" : pct >= 50 ? "bg-amber-400" : "bg-primary"

  let resetText = ""
  if (quota.resetAt) {
    const mins = Math.max(1, Math.round((new Date(quota.resetAt).getTime() - Date.now()) / 60000))
    resetText = `${t.resetIn} ${mins} ${t.min}`
  }

  return (
    <div className="border-t border-border px-4 py-3">
      <div className="mb-1.5 flex items-center justify-between text-xs">
        <span className="font-medium">{t.quotaTitle}</span>
        <span className="tabular-nums text-muted-foreground">
          {quota.remainingTokens.toLocaleString()} {t.remaining}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${Math.max(2, pct)}%` }} />
      </div>
      <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
        <span className="tabular-nums">
          {quota.usedTokens.toLocaleString()} / {quota.tokenLimit.toLocaleString()} {t.tokens}
        </span>
        {resetText && <span>{resetText}</span>}
      </div>
    </div>
  )
}

function NoAccess({ t }: { t: Record<string, string> }) {
  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div className="max-w-sm rounded-2xl border border-border bg-card p-8 text-center">
        <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
          <Lock className="h-6 w-6" />
        </span>
        <h2 className="text-lg font-semibold">{t.noAccessTitle}</h2>
        <p className="mt-2 text-sm text-muted-foreground text-pretty">{t.noAccessBody}</p>
      </div>
    </div>
  )
}
