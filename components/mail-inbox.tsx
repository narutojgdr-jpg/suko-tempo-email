"use client"

import { useState, useRef, useEffect, useMemo } from "react"
import {
  Check,
  ChevronDown,
  Clock,
  Copy,
  Download,
  FileText,
  Image as ImageIcon,
  KeyRound,
  Loader2,
  Mail,
  MailOpen,
  Paperclip,
  User,
} from "lucide-react"
import type { Dictionary } from "@/lib/i18n"

export interface Attachment {
  filename: string
  contentType: string
  size: number
  content: string
}

export interface Email {
  id: string
  from: string
  subject: string
  date: string
  body: string
  attachments?: Attachment[]
  account?: string // "cursor" or "ultra" - identifies which mailbox the email came from
}

interface InboxProps {
  emails: Email[]
  activeEmail: string | null
  activeDomain: string | null
  hasSearched: boolean
  isLoading: boolean
  isRefreshing: boolean
  isPolling: boolean
  statusMessage: string | null
  countdown: number
  fetchError: string | null
  onRefresh: () => void
  dict: Dictionary
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

// Formata a data do email de forma legivel (em vez do ISO cru tipo
// "2026-06-22T01:45:36.000Z"). Mostra so a hora se for hoje, "Ontem" se for
// ontem, e dia/mes (+ ano se for outro ano) caso contrario.
function formatEmailDate(iso: string): { label: string; title: string } {
  if (!iso) return { label: "", title: "" }
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return { label: iso, title: iso }

  const now = new Date()
  const time = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
  const sameDay = d.toDateString() === now.toDateString()
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  const isYesterday = d.toDateString() === yesterday.toDateString()

  let label: string
  if (sameDay) {
    label = time
  } else if (isYesterday) {
    label = `Ontem ${time}`
  } else if (d.getFullYear() === now.getFullYear()) {
    label = `${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} ${time}`
  } else {
    label = `${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })} ${time}`
  }

  return { label, title: d.toLocaleString("pt-BR") }
}

function getFileIcon(contentType: string) {
  if (contentType.startsWith("image/")) return ImageIcon
  return FileText
}

function downloadAttachment(att: Attachment) {
  const byteChars = atob(att.content)
  const byteNumbers = new Array(byteChars.length)
  for (let i = 0; i < byteChars.length; i++) {
    byteNumbers[i] = byteChars.charCodeAt(i)
  }
  const byteArray = new Uint8Array(byteNumbers)
  const blob = new Blob([byteArray], { type: att.contentType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = att.filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function SafeHtmlContent({ html }: { html: string }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ref.current || !html) return

    // Use DOMParser to safely parse and extract body content
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, "text/html")

    // Remove dangerous elements
    doc.querySelectorAll("script, object, embed, form").forEach((el) => el.remove())

    // Remove event handlers
    doc.querySelectorAll("*").forEach((el) => {
      Array.from(el.attributes).forEach((attr) => {
        if (attr.name.startsWith("on")) el.removeAttribute(attr.name)
        if (attr.value.toLowerCase().startsWith("javascript:")) el.removeAttribute(attr.name)
      })
    })

    // Open links in new tab
    doc.querySelectorAll("a[href]").forEach((a) => {
      a.setAttribute("target", "_blank")
      a.setAttribute("rel", "noopener noreferrer")
    })

    const bodyContent = doc.body?.innerHTML ?? doc.documentElement.innerHTML
    ref.current.innerHTML = bodyContent
  }, [html])

  if (!html) {
    return (
      <div className="overflow-hidden rounded-lg bg-muted p-4">
        <p className="text-sm text-muted-foreground">(Sem conteudo)</p>
      </div>
    )
  }

  // Plain text fallback — no HTML tags at all
  const isHtml = /<[a-z][\s\S]*>/i.test(html)
  if (!isHtml) {
    return (
      <div className="overflow-hidden rounded-lg bg-muted p-4">
        <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground">
          {html}
        </pre>
      </div>
    )
  }

  return (
    <div
      ref={ref}
      className="overflow-auto rounded-lg bg-white p-4 text-sm leading-relaxed text-neutral-900 [&_*]:max-w-full [&_img]:h-auto"
      style={{ maxHeight: "600px" }}
    />
  )
}

function AttachmentList({ attachments, dict }: { attachments: Attachment[]; dict: Dictionary }) {
  if (!attachments.length) return null
  return (
    <div className="mt-3 border-t border-border pt-3">
      <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Paperclip className="h-3 w-3" />
        {attachments.length}{" "}
        {attachments.length > 1 ? dict.inbox.attachments : dict.inbox.attachment}
      </div>
      <div className="flex flex-col gap-2">
        {attachments.map((att, i) => {
          const Icon = getFileIcon(att.contentType)
          return (
            <button
              key={i}
              onClick={() => downloadAttachment(att)}
              className="flex items-center gap-3 rounded-lg border border-border bg-secondary/50 px-3 py-2 text-left transition-colors hover:bg-secondary"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/20">
                <Icon className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-card-foreground">
                  {att.filename}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {formatBytes(att.size)}
                </p>
              </div>
              <Download className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            </button>
          )
        })}
      </div>
    </div>
  )
}

function EmptyState({ hasSearched }: { hasSearched: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-muted">
        <Mail className="h-10 w-10 text-muted-foreground" />
      </div>
      <h3 className="mb-2 text-base font-bold text-foreground">
        {hasSearched ? "Nenhum email ainda" : "Nenhum email selecionado"}
      </h3>
      <p className="max-w-xs text-sm text-muted-foreground">
        {hasSearched
          ? "A caixa atualiza sozinha a cada poucos segundos. Assim que um email chegar, ele aparece aqui."
          : "Digite um email e clique em Acessar Email para ver a inbox."}
      </p>
    </div>
  )
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10">
        <Mail className="h-10 w-10 text-destructive" />
      </div>
      <h3 className="mb-2 text-base font-bold text-foreground">
        Erro ao carregar emails
      </h3>
      <p className="mb-4 max-w-xs text-sm text-muted-foreground">{message}</p>
      <button
        onClick={onRetry}
        className="rounded-md border border-border px-4 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-secondary"
      >
        Tentar novamente
      </button>
    </div>
  )
}

// Palavras que costumam aparecer perto de um codigo de verificacao/OTP.
const CODE_KEYWORDS =
  /(c[oó]digo|verifica[cç][aã]o|verification|\bcode\b|\botp\b|\bpin\b|senha|password|one[- ]?time|uso [uú]nico|security code|c[oó]d\.)/gi

// Converte o HTML do email em texto puro para procurar o codigo.
function htmlToText(html: string): string {
  if (!html) return ""
  if (typeof window === "undefined") return html.replace(/<[^>]+>/g, " ")
  try {
    const doc = new DOMParser().parseFromString(html, "text/html")
    doc.querySelectorAll("script, style").forEach((el) => el.remove())
    return doc.body?.textContent ?? ""
  } catch {
    return html.replace(/<[^>]+>/g, " ")
  }
}

// Detecta um codigo de verificacao no assunto/corpo do email. Usa proximidade
// de palavras-chave e prioriza codigos de 6 digitos, ignorando anos (ex.: 2026).
function extractVerificationCode(subject: string, body: string): string | null {
  const text = `${subject}\n${htmlToText(body)}`.replace(/\s+/g, " ").trim()
  if (!text) return null

  const keywordIdx: number[] = []
  const kw = new RegExp(CODE_KEYWORDS.source, "gi")
  let km: RegExpExecArray | null
  while ((km = kw.exec(text))) keywordIdx.push(km.index)
  const nearestKeyword = (i: number) =>
    keywordIdx.length === 0 ? Infinity : Math.min(...keywordIdx.map((k) => Math.abs(k - i)))

  const candidates: { code: string; index: number; score: number }[] = []
  const push = (code: string, index: number) => candidates.push({ code, index, score: 0 })

  let m: RegExpExecArray | null
  // Google: "G-123456"
  const gRe = /\bG-(\d{6})\b/g
  while ((m = gRe.exec(text))) candidates.push({ code: m[1], index: m.index, score: 30 })
  // Codigos separados: "123 456" ou "123-456"
  const sRe = /\b(\d{3})[ -](\d{3})\b/g
  while ((m = sRe.exec(text))) push(m[1] + m[2], m.index)
  // Grupos de 4 a 8 digitos
  const dRe = /\b(\d{4,8})\b/g
  while ((m = dRe.exec(text))) {
    const code = m[1]
    if (code.length === 4 && /^(19|20)\d{2}$/.test(code)) continue // ignora anos
    push(code, m.index)
  }

  if (candidates.length === 0) return null

  for (const c of candidates) {
    const dist = nearestKeyword(c.index)
    c.score += dist === Infinity ? -50 : Math.max(0, 60 - dist / 4)
    if (c.code.length === 6) c.score += 15
    else if (c.code.length >= 5) c.score += 5
  }
  candidates.sort((a, b) => b.score - a.score)

  const best = candidates[0]
  // Sem nenhuma palavra-chave, so confia em codigo de 6 digitos (padrao OTP).
  if (keywordIdx.length === 0 && best.code.length !== 6) return null
  return best.code
}

function CodeBanner({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard indisponivel — ignora
    }
  }
  return (
    <button
      onClick={copy}
      className="animate-pop-in mb-3 flex w-full items-center gap-3 rounded-lg border border-primary/40 bg-primary/10 px-4 py-3 text-left transition-fluid hover-lift hover:bg-primary/20 hover:shadow-glow-primary"
      aria-label={`Copiar codigo ${code}`}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/20">
        <KeyRound className="h-4 w-4 text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Codigo detectado
        </p>
        <p className="font-mono text-xl font-bold tabular-nums tracking-[0.2em] text-foreground">
          {code}
        </p>
      </div>
      <span className="flex shrink-0 items-center gap-1.5 text-xs font-semibold text-primary">
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        {copied ? "Copiado" : "Copiar"}
      </span>
    </button>
  )
}

function EmailItem({ email, dict, index = 0 }: { email: Email; dict: Dictionary; index?: number }) {
  const [expanded, setExpanded] = useState(false)
  // "closing" mantem o corpo montado durante a animacao de fechamento.
  const [closing, setClosing] = useState(false)
  const hasAttachments = email.attachments && email.attachments.length > 0
  const { label: dateLabel, title: dateTitle } = formatEmailDate(email.date)
  const code = useMemo(() => extractVerificationCode(email.subject, email.body), [email.subject, email.body])

  const toggle = () => {
    if (expanded) {
      // Fecha com animacao: roda o collapse e so desmonta no fim.
      setClosing(true)
      setExpanded(false)
      setTimeout(() => setClosing(false), 260)
    } else {
      setExpanded(true)
    }
  }
  const open = expanded || closing

  return (
    <div
      className="animate-fade-in-up border-b border-border last:border-b-0"
      style={{ animationDelay: `${Math.min(index, 8) * 50}ms` }}
    >
      <button
        onClick={toggle}
        className="flex w-full items-center gap-4 px-5 py-4 text-left transition-fluid hover:bg-secondary/60"
        aria-expanded={expanded}
      >
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/20 transition-fluid ${
            open ? "scale-110 shadow-glow-primary" : ""
          }`}
        >
          {open ? (
            <MailOpen className="h-4 w-4 text-primary" />
          ) : (
            <User className="h-4 w-4 text-primary" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-sm font-semibold text-card-foreground">
              {email.from}
            </span>
            <div
              className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground"
              title={dateTitle}
            >
              {hasAttachments && <Paperclip className="h-3 w-3" />}
              <Clock className="h-3 w-3" />
              <span className="tabular-nums">{dateLabel}</span>
            </div>
          </div>
          <p className="mt-0.5 truncate text-sm text-muted-foreground">
            {email.subject}
          </p>
        </div>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-muted-foreground transition-fluid ${open ? "rotate-180 text-primary" : ""}`}
        />
      </button>
      {open && (
        <div
          className={`border-t border-border bg-secondary/30 px-5 py-4 shadow-soft ${
            closing ? "animate-collapse" : "animate-expand"
          }`}
        >
          {code && <CodeBanner code={code} />}
          <SafeHtmlContent html={email.body} />
          {hasAttachments && <AttachmentList attachments={email.attachments!} dict={dict} />}
        </div>
      )}
    </div>
  )
}

// Aviso fixo (em fluxo normal, sem overlay) exibido ao lado do topo da inbox
// assim que um email e acessado. Orienta o tempo de chegada e o suporte.
function WaitNotice() {
  return (
    <div className="flex items-start gap-2.5 border-b border-border bg-primary/5 px-5 py-3 text-xs leading-relaxed text-muted-foreground">
      <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
      <p>
        Os emails costumam levar de{" "}
        <span className="font-semibold text-foreground">10 a 15 segundos</span> para chegar — a
        caixa atualiza sozinha, nao precisa fazer nada. Se nada aparecer em{" "}
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
  )
}

// Intervalo da atualizacao automatica da inbox (ms).
const AUTO_REFRESH_MS = 5_000

export function Inbox({
  emails,
  activeEmail,
  activeDomain,
  hasSearched,
  isLoading,
  isRefreshing,
  statusMessage,
  fetchError,
  onRefresh,
  dict,
}: InboxProps) {
  // Refs para a atualizacao automatica nao reiniciar o intervalo a cada render
  // e para nunca disparar uma nova leitura enquanto outra ainda esta em curso
  // (evita "bugar" a inbox com chamadas sobrepostas).
  const onRefreshRef = useRef(onRefresh)
  const busyRef = useRef(false)
  useEffect(() => {
    onRefreshRef.current = onRefresh
  }, [onRefresh])
  useEffect(() => {
    busyRef.current = isLoading || isRefreshing
  }, [isLoading, isRefreshing])

  useEffect(() => {
    if (!activeEmail) return
    const interval = setInterval(() => {
      // So atualiza com a aba visivel e quando nao ha leitura em andamento.
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return
      if (busyRef.current) return
      onRefreshRef.current()
    }, AUTO_REFRESH_MS)
    return () => clearInterval(interval)
  }, [activeEmail])

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-soft-lg">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border px-5 py-3">
        <h3 className="text-sm font-bold tracking-wide text-foreground">
          {dict.inbox.title}
        </h3>
        {activeEmail && activeDomain && (
          <span className="rounded-full border border-border bg-muted px-3 py-0.5 font-mono text-xs text-muted-foreground">
            {activeEmail}{activeDomain}
          </span>
        )}
        {emails.length > 0 && (
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
            {emails.length}
          </span>
        )}
        {activeEmail && (
          <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
            {statusMessage ? (
              <span>{statusMessage}</span>
            ) : (
              <span className="flex items-center gap-1.5">
                <span
                  className={`h-1.5 w-1.5 rounded-full bg-emerald-500 ${isRefreshing ? "animate-ping" : "animate-pulse"}`}
                />
                <span className="hidden sm:inline">Atualizacao automatica</span>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Aviso de tempo de chegada / suporte — fica em fluxo normal (nao e
          overlay), entao nunca cobre o conteudo nem atrapalha o clique. */}
      {activeEmail && <WaitNotice />}

      {/* Body */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Loader2 className="mb-4 h-10 w-10 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">{dict.inbox.searching}</p>
        </div>
      ) : fetchError ? (
        <ErrorState message={fetchError} onRetry={onRefresh} />
      ) : emails.length === 0 ? (
        <EmptyState hasSearched={hasSearched} />
      ) : (
        <div className="divide-y divide-border">
          {emails.map((email, index) => (
            // Chave estavel baseada no conteudo (e nao no indice do array) para
            // que a atualizacao automatica nao remonte os itens nem feche um
            // email que o usuario abriu. O index so alimenta o atraso da
            // animacao de entrada (stagger).
            <EmailItem
              key={`${email.date}|${email.from}|${email.subject}`}
              email={email}
              dict={dict}
              index={index}
            />
          ))}
        </div>
      )}
    </div>
  )
}
