"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { X, Mail, Loader2, Clock } from "lucide-react"
import { buildCustomDomainEmail } from "@/lib/mime"
import { usesImap } from "@/lib/inbox-routing"
import { isAddressBlocked } from "@/lib/blocked-client"

interface InboxMessage {
  id?: string
  from: string
  subject: string
  date: string
  body: string
}

interface Props {
  email: string
  onClose: () => void
  emptyLabel: string
  loadingLabel: string
  refreshLabel: string
  closeLabel: string
}

const CF_API = "https://inbox-api.izukisukinho.workers.dev/inbox"

export function ProfileInboxModal({
  email,
  onClose,
  emptyLabel,
  loadingLabel,
  closeLabel,
}: Props) {
  const [messages, setMessages] = useState<InboxMessage[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const imapSource = usesImap(email)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // Caixas bloqueadas (lista fixa + blocklist do admin) nunca podem ser lidas.
      if (await isAddressBlocked(email)) {
        throw new Error("Esta caixa e protegida e nao pode ser lida.")
      }
      if (imapSource) {
        const res = await fetch(`/api/gmail-inbox?email=${encodeURIComponent(email)}`, {
          cache: "no-store",
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`)
        setMessages(
          (Array.isArray(data) ? data : []).map((m: Record<string, string>) => ({
            id: m.id,
            from: m.from ?? "",
            subject: m.subject ?? "(sem assunto)",
            date: m.date ?? "",
            body: m.body ?? "",
          })),
        )
      } else {
        const res = await fetch(`${CF_API}/${email}`, { cache: "no-store" })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        setMessages(
          (Array.isArray(data) ? data : []).map((m, i: number) => {
            const e = buildCustomDomainEmail(m, `cf-${email}`, i)
            return { id: e.id, from: e.from, subject: e.subject, date: e.date, body: e.body }
          }),
        )
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error")
    } finally {
      setLoading(false)
    }
  }, [email, imapSource])

  // Carregamento inicial.
  useEffect(() => {
    load()
  }, [load])

  // Atualizacao automatica a cada 5s. Usamos refs para o intervalo nao reiniciar
  // a cada render e para nunca sobrepor uma leitura ainda em andamento. So roda
  // com a aba visivel.
  const loadRef = useRef(load)
  const loadingRef = useRef(loading)
  useEffect(() => {
    loadRef.current = load
  }, [load])
  useEffect(() => {
    loadingRef.current = loading
  }, [loading])
  useEffect(() => {
    const id = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return
      if (loadingRef.current) return
      loadRef.current()
    }, 5000)
    return () => clearInterval(id)
  }, [])

  return (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/80 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <Mail className="h-4 w-4 shrink-0 text-primary" />
            <span className="truncate text-sm font-semibold text-foreground">{email}</span>
          </div>
          <div className="ml-3 flex shrink-0 items-center gap-2">
            <span className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
              {loading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
              )}
              Automatico
            </span>
            <button
              onClick={onClose}
              className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
            >
              <X className="h-3 w-3" />
              {closeLabel}
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Aviso em fluxo normal — nao e overlay, nao cobre nada nem bloqueia clique. */}
          <div className="mb-3 flex items-start gap-2.5 rounded-lg border border-border bg-primary/5 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
            <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
            <p>
              Os emails costumam levar de{" "}
              <span className="font-semibold text-foreground">10 a 15 segundos</span> para chegar — a
              caixa atualiza sozinha. Se nada aparecer em{" "}
              <span className="font-semibold text-foreground">1 minuto</span>, me chame no Telegram{" "}
              <a
                href="https://t.me/KiritoShopS2"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-primary hover:underline"
              >
                @KiritoShopS2
              </a>
              .
            </p>
          </div>

          {loading && !messages && (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="mt-3 text-sm text-muted-foreground">{loadingLabel}</p>
            </div>
          )}

          {error && <p className="py-10 text-center text-sm text-destructive">{error}</p>}

          {!loading && !error && messages !== null && messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Mail className="mb-3 h-8 w-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">{emptyLabel}</p>
            </div>
          )}

          {messages && messages.length > 0 && (
            <div className="space-y-3">
              {messages.map((msg, i) => (
                <MessageCard key={msg.id ?? i} msg={msg} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function MessageCard({ msg }: { msg: InboxMessage }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-background">
      <button
        className="w-full px-4 py-3 text-left transition-colors hover:bg-muted/50"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-0.5">
            <p className="truncate text-xs text-muted-foreground">{msg.from || "—"}</p>
            <p className="truncate text-sm font-semibold text-foreground">{msg.subject}</p>
          </div>
          <span className="shrink-0 text-xs text-muted-foreground">
            {msg.date ? new Date(msg.date).toLocaleString() : ""}
          </span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border px-4 py-3">
          <div
            className="prose prose-sm max-h-96 max-w-none overflow-y-auto text-sm text-foreground [&_a]:text-primary"
            dangerouslySetInnerHTML={{ __html: msg.body || "<p>Sem conteudo.</p>" }}
          />
        </div>
      )}
    </div>
  )
}
