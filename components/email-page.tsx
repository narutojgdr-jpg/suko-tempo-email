"use client"

import { useState, useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Trash2, RefreshCw, Copy, Mail, Send, FileCode, ExternalLink, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, X, Sparkles } from "lucide-react"
import { SiteHeader } from "@/components/site-header"
import { Inbox, type Email } from "@/components/mail-inbox"
import { GenerateEmailDialog } from "@/components/generate-email-dialog"
import { saveGeneratedEmail, buyGmailFromPool } from "@/app/actions/profile"
import type { EmailProvider } from "@/lib/email-config"
import { usesImap } from "@/lib/inbox-routing"
import { isAddressBlocked } from "@/lib/blocked-client"
import { VipDialog } from "@/components/vip-dialog"
import { CryptoPaymentModal } from "@/components/crypto-payment-modal"
import { LoginDialog } from "@/components/login-dialog"
import type { Dictionary } from "@/lib/i18n"

const STORAGE_KEY = "suko_saved_emails"

// Links
const TELEGRAM_LINK = "https://t.me/sukodeuva"
const GGMAX_LINK = "https://ggmax.com.br/perfil/SuKyNhoul"
const METHODS_LINK = "#" // Placeholder - update when ready

interface SavedEmail {
  address: string
  addedAt: number
}

interface EmailPageProps {
  dict: Dictionary
  lang: string
  userName?: string
  userImage?: string | null
  isLoggedIn?: boolean
  isVip?: boolean
  balanceCents?: number
  gmailPriceCents?: number
}

interface ParsedEmailItem {
  id: string
  from: string
  subject: string
  date: string
  body: string
}

export function EmailPage({ dict, lang, userName, userImage, isLoggedIn = false, isVip = false, balanceCents, gmailPriceCents = 0 }: EmailPageProps) {
  const router = useRouter()
  // Saldo local: espelha a prop do servidor mas atualiza na hora apos depositos
  const [balance, setBalance] = useState<number>(balanceCents ?? 0)
  useEffect(() => {
    setBalance(balanceCents ?? 0)
  }, [balanceCents])
  const [depositOpen, setDepositOpen] = useState(false)
  const [inputEmail, setInputEmail] = useState("")
  const [headerInputEmail, setHeaderInputEmail] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [emails, setEmails] = useState<Email[]>([])
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [selectedEmail, setSelectedEmail] = useState<string | null>(null)
  const [savedEmails, setSavedEmails] = useState<SavedEmail[]>([])
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [leftSidebarCollapsed, setLeftSidebarCollapsed] = useState(false)
  const [rightSidebarCollapsed, setRightSidebarCollapsed] = useState(false)
  const [headerDropdownOpen, setHeaderDropdownOpen] = useState(false)
  const [generateOpen, setGenerateOpen] = useState(false)
  const [vipOpen, setVipOpen] = useState(false)
  const [loginOpen, setLoginOpen] = useState(false)

  // Load saved emails from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        try {
          setSavedEmails(JSON.parse(stored))
        } catch {
          localStorage.removeItem(STORAGE_KEY)
        }
      }
    }
  }, [])

  // Save to localStorage when savedEmails changes
  useEffect(() => {
    if (typeof window !== "undefined" && savedEmails.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(savedEmails))
    }
  }, [savedEmails])

  // Turn a raw From header into a clean, friendly sender name.
  // Handles: display names ("ChatGPT" <x@y>), bounce/VERP addresses
  // (bounces+123-...@em.spotify.com), and derives a brand from the domain.
  const cleanSender = useCallback((raw: string): string => {
    if (!raw) return "Desconhecido"
    let value = raw.trim()

    // 1. Prefer the display name if present: "Name" <email> or Name <email>
    const displayMatch = value.match(/^\s*"?([^"<]+?)"?\s*<[^>]+>/)
    if (displayMatch) {
      const name = displayMatch[1].trim()
      // Ignore display names that are just an email address
      if (name && !/@/.test(name)) return name
    }

    // 2. Extract the email address (inside <> or the whole string)
    const angle = value.match(/<([^>]+)>/)
    const addr = (angle ? angle[1] : value).trim()
    const domainPart = addr.split("@")[1] ?? addr

    if (!domainPart) return addr || "Desconhecido"

    // 3. Derive brand from the domain, stripping mail subdomains
    const labels = domainPart
      .toLowerCase()
      .replace(/[<>]/g, "")
      .split(".")
      .filter(Boolean)
    // Drop generic mail-server / tld labels to find the brand label
    const junk = new Set([
      "com", "net", "org", "io", "co", "email", "mail", "em", "tm",
      "mailer", "smtp", "mx", "send", "sendgrid", "mailgun", "amazonses",
      "info", "br", "us", "app",
    ])
    let brand =
      labels.filter((l) => !junk.has(l) && !/^em\d+$/.test(l) && !/^\d+$/.test(l)).pop() ??
      labels[0] ??
      domainPart
    // Known brands with specific casing
    const knownBrands: Record<string, string> = {
      openai: "OpenAI",
      chatgpt: "ChatGPT",
      spotify: "Spotify",
      paypal: "PayPal",
      github: "GitHub",
      youtube: "YouTube",
      whatsapp: "WhatsApp",
      tiktok: "TikTok",
      linkedin: "LinkedIn",
    }
    if (knownBrands[brand]) return knownBrands[brand]
    // Capitalize first letter
    brand = brand.charAt(0).toUpperCase() + brand.slice(1)
    return brand
  }, [])

  // Deduplicate emails by id
  const dedupeEmails = useCallback((emailList: Email[]): Email[] => {
    const seen = new Set<string>()
    return emailList.filter((e) => {
      if (seen.has(e.id)) return false
      seen.add(e.id)
      return true
    })
  }, [])

  const fetchImapEmails = useCallback(async (fullAddress: string): Promise<Email[]> => {
    const res = await fetch(
      `/api/gmail-inbox?email=${encodeURIComponent(fullAddress)}`,
      { cache: "no-store" }
    )
    const data = await res.json()
    if (!res.ok) throw new Error(data?.error ?? `Erro ao buscar emails Gmail (${res.status})`)
    if (!Array.isArray(data)) return []
    return data.map((item: ParsedEmailItem) => ({
      id: item.id,
      from: cleanSender(item.from ?? ""),
      subject: item.subject ?? "(Sem assunto)",
      date: item.date ?? "",
      body: item.body || `<p style="color:#888;font-size:13px">Sem conteudo.</p>`,
      attachments: [],
    }))
  }, [cleanSender])

  const fetchEmails = useCallback(async (fullAddress: string) => {
    // Caixas bloqueadas (lista fixa + blocklist do admin) nunca podem ser lidas.
    if (await isAddressBlocked(fullAddress)) {
      throw new Error("Esta caixa e protegida e nao pode ser lida.")
    }
    // Two mail sources, queried in PARALLEL so the slow one never blocks the fast one:
    // - Titan/HostGator IMAP: holds Gmail E Outlook/Hotmail forwards. So batemos no
    //   IMAP para esses provedores (a API escolhe a mailbox certa pelo dominio).
    //   (Escanear o IMAP para um dominio proprio e tempo perdido — nunca tem a mensagem.)
    // - Cloudflare KV worker: handles all custom domains; very fast.
    const imapPromise: Promise<Email[]> = usesImap(fullAddress)
      ? fetchImapEmails(fullAddress).catch(() => [] as Email[])
      : Promise.resolve([] as Email[])

    const kvPromise: Promise<unknown> = fetch(
      `https://inbox-api.izukisukinho.workers.dev/inbox/${fullAddress}`,
      { cache: "no-store" }
    )
      .then((res) => (res.ok ? res.json() : []))
      .catch(() => [])

    const [imapResults, kvData] = await Promise.all([imapPromise, kvPromise])
    const data = kvData

    // MIME parser: recursively extracts text/html or text/plain from any MIME structure.
    // Works even when the outer envelope headers are huge (Gmail forwarded via Cloudflare)
    // and the text field has no blank-line header/body separator.
    const parseMime = (rawInput: string): string => {
      // Normalize line endings once
      const raw = rawInput.replace(/\r\n/g, "\n").replace(/\r/g, "\n")

      function decodeB64(s: string) {
        try {
          const bin   = atob(s.replace(/\s/g, ""))
          const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
          return new TextDecoder("utf-8").decode(bytes)
        } catch { return "" }
      }

      function decodeQP(s: string) {
        return s
          .replace(/=\n/g, "")
          .replace(/=([0-9A-Fa-f]{2})/g, (_, h) => {
            try { return decodeURIComponent("%" + h) } catch { return "" }
          })
      }

      function decodePart(body: string, encoding: string) {
        if (encoding.includes("base64"))           return decodeB64(body)
        if (encoding.includes("quoted-printable")) return decodeQP(body)
        return body
      }

      // Robustly extract header value handling folded lines (RFC 2822 folding)
      function getHeader(block: string, name: string): string {
        const re = new RegExp(`^${name}:\\s*([\\s\\S]*?)(?=\\n[^\\t ]|$)`, "im")
        const m  = block.match(re)
        if (!m) return ""
        // unfold: remove newline + whitespace
        return m[1].replace(/\n[\t ]+/g, " ").trim()
      }

      // Split a MIME block into {headerBlock, body} at the FIRST blank line
      function splitBlock(block: string): { headerBlock: string; body: string } {
        const idx = block.indexOf("\n\n")
        if (idx === -1) return { headerBlock: block, body: "" }
        return { headerBlock: block.slice(0, idx), body: block.slice(idx + 2) }
      }

      function getBoundary(headerBlock: string): string | null {
        const ct = getHeader(headerBlock, "content-type")
        const m  = ct.match(/boundary=(?:"([^"]+)"|'([^']+)'|(\S+))/i)
        if (!m) return null
        return (m[1] ?? m[2] ?? m[3]).replace(/^["']|["']$/g, "").trim()
      }

      // Recursively extract html/plain from a single MIME part block
      function extract(block: string): { html: string; plain: string } {
        const { headerBlock, body } = splitBlock(block)
        const ct       = getHeader(headerBlock, "content-type").toLowerCase()
        const encoding = getHeader(headerBlock, "content-transfer-encoding").toLowerCase()
        const boundary = getBoundary(headerBlock)

        if (boundary || ct.includes("multipart/")) {
          // Find boundary — may be in a deeper scan if headers were truncated
          const bnd = boundary ?? raw.match(/boundary=(?:"([^"]+)"|'([^']+)'|(\S+))/i)
            ?.slice(1).find(Boolean)?.replace(/^["']|["']$/g, "").trim()
          if (!bnd) return { html: "", plain: "" }

          const esc   = bnd.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
          const parts = body.split(new RegExp(`--${esc}(?:--)?`))
          let html = "", plain = ""
          for (const part of parts) {
            const t = part.trim()
            if (!t || t === "--") continue
            const r = extract(t)
            if (r.html  && !html)  html  = r.html
            if (r.plain && !plain) plain = r.plain
          }
          return { html, plain }
        }

        const decoded = decodePart(body, encoding).trim()
        if (ct.includes("text/html"))  return { html: decoded, plain: "" }
        if (ct.includes("text/plain")) return { html: "", plain: decoded }
        return { html: "", plain: "" }
      }

      // First try: full structured parse
      const { html, plain } = extract(raw)
      if (html)  return html
      if (plain) return `<pre style="white-space:pre-wrap;font-family:inherit">${plain}</pre>`

      // Fallback: scan the raw for any boundary and try to parse from the first --boundary line
      // This handles emails where outer headers are truncated (Worker 12k char limit)
      const anyBoundary = raw.match(/boundary=(?:"([^"]+)"|'([^']+)'|(\S+))/i)
      if (anyBoundary) {
        const bnd  = (anyBoundary[1] ?? anyBoundary[2] ?? anyBoundary[3]).replace(/^["']|["']$/g, "").trim()
        const esc  = bnd.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
        // Find first occurrence of --boundary in the raw and parse from there
        const startIdx = raw.indexOf(`--${bnd}`)
        if (startIdx !== -1) {
          const mimeBody = raw.slice(startIdx)
          const parts    = mimeBody.split(new RegExp(`--${esc}(?:--)?`))
          let html2 = "", plain2 = ""
          for (const part of parts) {
            const t = part.trim()
            if (!t || t === "--") continue
            const r = extract(t)
            if (r.html  && !html2)  html2  = r.html
            if (r.plain && !plain2) plain2 = r.plain
          }
          if (html2)  return html2
          if (plain2) return `<pre style="white-space:pre-wrap;font-family:inherit">${plain2}</pre>`
        }
      }

      return ""
    }

    // Decode MIME encoded-word subjects, e.g. "140297 =?UTF-8?B?4oCTIFNldQ==?= login"
    const decodeMimeWord = (s: string): string => {
      return s.replace(/=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g, (_, charset, enc, text) => {
        try {
          if (enc.toUpperCase() === "B") {
            const bin = atob(text.replace(/\s/g, ""))
            const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
            return new TextDecoder(charset.toLowerCase().includes("8859") ? "iso-8859-1" : "utf-8").decode(bytes)
          }
          // Q-encoding
          const qp = String(text).replace(/_/g, " ").replace(/=([0-9A-Fa-f]{2})/g, (_m: string, h: string) =>
            String.fromCharCode(parseInt(h, 16)))
          const bytes = Uint8Array.from(qp, (c: string) => c.charCodeAt(0))
          return new TextDecoder(charset.toLowerCase().includes("8859") ? "iso-8859-1" : "utf-8").decode(bytes)
        } catch {
          return text
        }
      })
    }

    const mapped: Email[] = (Array.isArray(data) ? data : []).map(
      (item: { from?: string; subject?: string; date?: string; text?: string }, i: number) => {
        const rawText = item.text ?? ""

        // Decode quoted-printable. Handles both UTF-8 multibyte (e.g. Cyrillic =D0=A0)
        // and Latin-1 single-byte (e.g. =E3 -> ã) charsets by trying strict UTF-8 first.
        const decodeQP = (s: string): string => {
          const unfolded = s.replace(/=\r?\n/g, "")
          return unfolded.replace(/((?:=[0-9A-Fa-f]{2})+)/g, (match) => {
            const bytes = match.match(/=([0-9A-Fa-f]{2})/g)!
              .map(h => parseInt(h.slice(1), 16))
            const arr = new Uint8Array(bytes)
            try {
              // Strict UTF-8: throws on invalid sequences (e.g. lone Latin-1 byte)
              return new TextDecoder("utf-8", { fatal: true }).decode(arr)
            } catch {
              try {
                // Fall back to Latin-1 (ISO-8859-1) — every byte is a valid char
                return new TextDecoder("iso-8859-1").decode(arr)
              } catch {
                return match
              }
            }
          })
        }

        // Render decoded text: if it contains HTML tags render as HTML directly,
        // otherwise convert bare URLs to <a> and newlines to <br>
        const linkStyle = "color:#7c3aed;text-decoration:underline;word-break:break-word"
        // Build a short, clean label for long/tracking URLs (show domain + ellipsis)
        const shortLabel = (url: string): string => {
          if (url.length <= 60) return url
          try {
            const u = new URL(url)
            return `${u.hostname.replace(/^www\./, "")} \u2192`
          } catch {
            return url.slice(0, 50) + "\u2026"
          }
        }
        const renderText = (text: string): string => {
          const isHtml = /<[a-z][\s\S]*>/i.test(text)
          if (isHtml) {
            // Already has HTML tags — linkify bare URLs not already inside <a>, shortening long ones
            return text.replace(
              /(?<!href=["'])(?<![>=])(https?:\/\/[^\s<>"')\]]+)/g,
              (url) =>
                `<a href="${url}" target="_blank" rel="noopener noreferrer" style="${linkStyle}">${shortLabel(url)}</a>`
            )
          }
          // Pure plain text — escape, linkify, and convert newlines
          let html = text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
          // Markdown [label](url)
          html = html.replace(
            /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
            (_, label, url) =>
              `<a href="${url}" target="_blank" rel="noopener noreferrer" style="${linkStyle}">${label}</a>`
          )
          // Bare URLs (shorten long tracking links to keep layout clean)
          html = html.replace(
            /(?<![="'(])(https?:\/\/[^\s<>"')\]]+)/g,
            (url) =>
              `<a href="${url}" target="_blank" rel="noopener noreferrer" style="${linkStyle}">${shortLabel(url)}</a>`
          )
          html = html.replace(/\n{2,}/g, "</p><p style='margin:12px 0'>")
          html = html.replace(/\n/g, "<br>")
          return `<p style='margin:0'>${html}</p>`
        }

        // parseMime handles full MIME; if it returns empty (plain text body with no MIME headers),
        // decode QP first (handles multibyte chars like ã ó ê), then render
        const parsedBody = rawText ? parseMime(rawText) : ""
        const cleanText = decodeQP(rawText.replace(/\r\n/g, "\n").replace(/\r/g, "\n"))
        const bodyText = parsedBody || (cleanText.trim() ? renderText(cleanText) : "")
        return {
          id: `cf-${fullAddress}-${i}-${item.date ?? i}`,
          from: cleanSender(item.from ?? ""),
          subject: decodeMimeWord(item.subject ?? "(Sem assunto)"),
          date: item.date ?? "",
          body: bodyText || `<p style="color:#a0a0a0;font-size:13px;font-style:italic">Sem conteudo.</p>`,
          attachments: [],
        }
      }
    )

    // Merge IMAP + KV results, dedupe, and sort newest first
    const combined = dedupeEmails([...imapResults, ...mapped])
    combined.sort((a, b) => {
      const ta = a.date ? new Date(a.date).getTime() : 0
      const tb = b.date ? new Date(b.date).getTime() : 0
      return tb - ta
    })
    return combined
  }, [dedupeEmails, fetchImapEmails, cleanSender])

  const handleAddEmail = useCallback(async () => {
    const trimmed = inputEmail.trim().toLowerCase()
    if (!trimmed) return

    const atIndex = trimmed.lastIndexOf("@")
    if (atIndex === -1) {
      setError(dict.errors.invalidFormat)
      return
    }

    const user = trimmed.slice(0, atIndex)
    if (!user) {
      setError(dict.errors.noUsername)
      return
    }

    // Gmail addresses are only accessible to logged-in users
    const domain = trimmed.slice(atIndex + 1).toLowerCase()
    if (domain === "gmail.com" && !isLoggedIn) {
      setError(dict.errors.gmailLoginRequired)
      return
    }

    // Check if already saved
    if (savedEmails.some(e => e.address === trimmed)) {
      setSelectedEmail(trimmed)
      setInputEmail("")
      setLoading(true)
      try {
        const result = await fetchEmails(trimmed)
        setEmails(result)
      } catch (err) {
        setError(err instanceof Error ? err.message : dict.errors.genericError)
      } finally {
        setLoading(false)
      }
      return
    }

    setError(null)
    setLoading(true)

    try {
      const result = await fetchEmails(trimmed)
      setSavedEmails(prev => [...prev, { address: trimmed, addedAt: Date.now() }])
      setSelectedEmail(trimmed)
      setEmails(result)
      setInputEmail("")
      setStatusMessage(dict.status.inboxUpdated)
      setTimeout(() => setStatusMessage(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : dict.errors.genericError)
      setEmails([])
    } finally {
      setLoading(false)
    }
  }, [inputEmail, savedEmails, fetchEmails, dict])

  // Called by the Generate dialog with a ready-made address from the pool/domains.
  const handleGenerateEmail = useCallback(async (address: string, provider: EmailProvider) => {
    const trimmed = address.trim().toLowerCase()
    if (!trimmed) return

    setGenerateOpen(false)
    setError(null)

    // Persist to the logged-in user's profile so it shows in their history on any
    // device. Fire-and-forget; logged-out users keep only the browser-local list.
    if (isLoggedIn) {
      void saveGeneratedEmail(trimmed, provider).catch(() => {})
    }

    // If already saved, just select it.
    if (savedEmails.some((e) => e.address === trimmed)) {
      setSelectedEmail(trimmed)
      setLoading(true)
      try {
        const result = await fetchEmails(trimmed)
        setEmails(result)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : dict.errors.genericError)
      } finally {
        setLoading(false)
      }
      return
    }

    setLoading(true)
    try {
      const result = await fetchEmails(trimmed)
      setSavedEmails((prev) => [...prev, { address: trimmed, addedAt: Date.now() }])
      setSelectedEmail(trimmed)
      setEmails(result)
      toast.success(dict.status.inboxUpdated)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : dict.errors.genericError)
      setEmails([])
    } finally {
      setLoading(false)
    }
  }, [savedEmails, fetchEmails, dict, isLoggedIn])

  // Compra um Gmail do pool com o saldo. O endereco so e conhecido apos a compra
  // (o usuario nunca ve qual vai receber antes de pagar). Retorna o resultado
  // para o dialog exibir erro/sucesso.
  const handleBuyGmail = useCallback(async (): Promise<{ ok: boolean; error?: string; address?: string }> => {
    const res = await buyGmailFromPool(savedEmails.map((e) => e.address))
    if (!res.ok) return { ok: false, error: res.error }

    const addr = (res.address ?? "").toLowerCase()
    if (typeof res.balanceCents === "number") setBalance(res.balanceCents)

    setGenerateOpen(false)
    setSavedEmails((prev) =>
      prev.some((e) => e.address === addr) ? prev : [{ address: addr, addedAt: Date.now() }, ...prev],
    )
    setSelectedEmail(addr)
    setLoading(true)
    try {
      const result = await fetchEmails(addr)
      setEmails(result)
      toast.success(dict.status.inboxUpdated)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : dict.errors.genericError)
      setEmails([])
    } finally {
      setLoading(false)
    }
    router.refresh()
    return { ok: true, address: addr }
  }, [savedEmails, fetchEmails, dict, router])

  const handleSelectEmail = useCallback(async (address: string) => {
    if (selectedEmail === address) return
    
    setSelectedEmail(address)
    setLoading(true)
    setEmails([])
    setError(null)

    try {
      const result = await fetchEmails(address)
      setEmails(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : dict.errors.genericError)
    } finally {
      setLoading(false)
    }
  }, [selectedEmail, fetchEmails, dict.errors.genericError])

  const handleRemoveEmail = useCallback((address: string) => {
    setSavedEmails(prev => prev.filter(e => e.address !== address))
    if (selectedEmail === address) {
      setSelectedEmail(null)
      setEmails([])
    }
    const remaining = savedEmails.filter(e => e.address !== address)
    if (remaining.length === 0) {
      localStorage.removeItem(STORAGE_KEY)
    }
  }, [selectedEmail, savedEmails])

  const handleRemoveAllEmails = useCallback(() => {
    setSavedEmails([])
    setSelectedEmail(null)
    setEmails([])
    localStorage.removeItem(STORAGE_KEY)
    toast.success("Todos os emails removidos")
  }, [])

  const handleRefresh = useCallback(async () => {
    if (!selectedEmail) return

    setRefreshing(true)
    setStatusMessage(dict.status.checkingNewEmails)

    try {
      const result = await fetchEmails(selectedEmail)
      setEmails(result)
      setStatusMessage(dict.status.inboxUpdated)
      setTimeout(() => setStatusMessage(null), 3000)
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : dict.errors.updateError)
      setTimeout(() => setStatusMessage(null), 5000)
    } finally {
      setRefreshing(false)
    }
  }, [selectedEmail, fetchEmails, dict])

  const handleCopyEmail = useCallback(async (address: string) => {
    try {
      await navigator.clipboard.writeText(address)
      toast.success(dict.emailInput.copiedToast)
    } catch {
      toast.error(dict.emailInput.copyErrorToast)
    }
  }, [dict])

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setInputEmail(e.target.value)
    if (error) setError(null)
  }, [error])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleAddEmail()
    }
  }, [handleAddEmail])

  const handleHeaderInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setHeaderInputEmail(e.target.value)
  }, [])

  const handleHeaderAddEmail = useCallback(async () => {
    const trimmed = headerInputEmail.trim().toLowerCase()
    if (!trimmed) return

    const atIndex = trimmed.lastIndexOf("@")
    if (atIndex === -1) {
      toast.error(dict.errors.invalidFormat)
      return
    }

    const user = trimmed.slice(0, atIndex)
    if (!user) {
      toast.error(dict.errors.noUsername)
      return
    }

    // Check if already saved
    if (savedEmails.some(e => e.address === trimmed)) {
      setSelectedEmail(trimmed)
      setHeaderInputEmail("")
      setLoading(true)
      try {
        const result = await fetchEmails(trimmed)
        setEmails(result)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : dict.errors.genericError)
      } finally {
        setLoading(false)
      }
      return
    }

    setLoading(true)

    try {
      const result = await fetchEmails(trimmed)
      setSavedEmails(prev => [...prev, { address: trimmed, addedAt: Date.now() }])
      setSelectedEmail(trimmed)
      setEmails(result)
      setHeaderInputEmail("")
      toast.success("Email adicionado")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : dict.errors.genericError)
    } finally {
      setLoading(false)
    }
  }, [headerInputEmail, savedEmails, fetchEmails, dict])

  const handleHeaderKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleHeaderAddEmail()
    }
  }, [handleHeaderAddEmail])

  return (
    <div className="flex min-h-screen flex-col bg-background">
        <SiteHeader
          lang={lang}
          userName={userName}
          userImage={userImage}
          isLoggedIn={isLoggedIn}
          signInLabel={dict.auth.signIn}
          signOutLabel={dict.auth.signOut}
          vipLabel={dict.header.vipButton}
          isVip={isVip}
          onVipClick={() => setVipOpen(true)}
          balanceCents={balance}
          rechargeLabel={dict.profile.rechargeShort}
          onSignInClick={() => setLoginOpen(true)}
          onBalanceClick={() => {
            if (!isLoggedIn) {
              setLoginOpen(true)
              return
            }
            setDepositOpen(true)
          }}
        />

        <GenerateEmailDialog
          open={generateOpen}
          onOpenChange={setGenerateOpen}
          onGenerate={handleGenerateEmail}
          onBuyGmail={handleBuyGmail}
          isLoggedIn={isLoggedIn}
          isVip={isVip}
          balanceCents={balance}
          gmailPriceCents={gmailPriceCents}
          savedAddresses={savedEmails.map((e) => e.address)}
          generating={loading}
          dict={dict}
          onRequestVip={() => setVipOpen(true)}
          onRequestDeposit={() => {
            setGenerateOpen(false)
            if (!isLoggedIn) {
              window.location.href = `/${lang}/sign-in`
              return
            }
            setDepositOpen(true)
          }}
          onRequestLogin={() => {
            setGenerateOpen(false)
            setLoginOpen(true)
          }}
        />

        <VipDialog
          open={vipOpen}
          onOpenChange={setVipOpen}
          dict={dict}
          isVip={isVip}
          balanceCents={balance}
          onRequestDeposit={() => {
            if (!isLoggedIn) {
              window.location.href = `/${lang}/sign-in`
              return
            }
            setDepositOpen(true)
          }}
          onPurchased={() => {
            // Atualiza isVip/saldo vindos do servidor
            router.refresh()
          }}
        />

        <CryptoPaymentModal
          open={depositOpen}
          onOpenChange={setDepositOpen}
          onSuccess={(amountCents) => {
            // Reflete o novo saldo imediatamente e revalida do servidor
            setBalance((prev) => prev + amountCents)
            router.refresh()
          }}
        />

        <LoginDialog
          open={loginOpen}
          onOpenChange={setLoginOpen}
          callbackURL={typeof window !== "undefined" ? `${window.location.origin}/${lang}` : `/${lang}`}
          lang={lang}
          label={dict.auth.googleButton}
          loadingLabel={dict.auth.googleLoading}
          newTabNotice={dict.auth.newTabNotice}
          secureTitle={dict.auth.secureTitle}
          secureDesc={dict.auth.secureDesc}
          securePoint1={dict.auth.securePoint1}
          securePoint2={dict.auth.securePoint2}
          cancelLabel={dict.auth.cancel}
        />

      {/* Header Input - shows when left sidebar is collapsed (md+) */}
      {leftSidebarCollapsed && (
        <div className="hidden md:block border-b border-border bg-card/50 px-4 py-2">
          <div className="mx-auto max-w-lg">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setGenerateOpen(true)}
                disabled={loading}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Sparkles className="h-4 w-4" />
                {loading ? dict.generate.generating : dict.generate.generate}
              </button>
              {savedEmails.length > 0 && (
                <button
                  onClick={() => setHeaderDropdownOpen(!headerDropdownOpen)}
                  className="rounded-lg border border-border bg-background p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  {headerDropdownOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
              )}
            </div>
            
            {/* Dropdown with saved emails */}
            {headerDropdownOpen && savedEmails.length > 0 && (
              <div className="mt-2 rounded-lg border border-border bg-card p-2 shadow-lg">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Emails Salvos</span>
                  <button
                    onClick={handleRemoveAllEmails}
                    className="text-xs text-muted-foreground hover:text-destructive"
                  >
                    Limpar todos
                  </button>
                </div>
                <div className="max-h-48 space-y-1 overflow-y-auto">
                  {savedEmails.map((saved) => (
                    <div
                      key={saved.address}
                      className={`flex items-center justify-between rounded-md px-2 py-1.5 text-xs cursor-pointer transition-colors ${
                        selectedEmail === saved.address
                          ? "bg-primary/10 text-primary"
                          : "hover:bg-muted text-foreground"
                      }`}
                      onClick={() => {
                        handleSelectEmail(saved.address)
                        setHeaderDropdownOpen(false)
                      }}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                        <span className="truncate">{saved.address}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleCopyEmail(saved.address)
                          }}
                          className="rounded p-0.5 hover:bg-muted"
                        >
                          <Copy className="h-3 w-3" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleRemoveEmail(saved.address)
                          }}
                          className="rounded p-0.5 hover:bg-destructive/10 hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <main className="flex flex-1 flex-col md:flex-row relative">
        {/* Left Column - Title, Tutorial, Input, Saved Emails */}
        <div className={`relative border-b md:border-b-0 md:border-r border-border bg-card transition-all duration-300 ${
          leftSidebarCollapsed ? "hidden" : "w-full md:w-80 lg:w-96 shrink-0"
        }`}>
          {/* Collapse button inside sidebar - only on md+ */}
          {!leftSidebarCollapsed && (
            <button
              onClick={() => setLeftSidebarCollapsed(true)}
              className="absolute right-2 top-2 z-10 hidden md:block rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}
          <div className="p-4">
            {/* Title */}
            <div className="mb-4">
              <h1 className="text-xl font-bold tracking-tight text-foreground">
                {dict.hero.title}
              </h1>
              <p className="mt-1 text-xs text-muted-foreground">
                {dict.hero.subtitle}
              </p>
            </div>

            {/* Tutorial Section */}
            <div className="mb-4 rounded-lg border border-border bg-background p-3 text-xs shadow-soft">
              <h3 className="mb-2 font-semibold text-foreground">{dict.hero.tutorialTitle}</h3>
              <p className="mb-2.5 leading-relaxed text-muted-foreground">{dict.hero.tutorialIntro}</p>
              <ul className="space-y-1.5 text-muted-foreground">
                <li className="flex gap-2">
                  <span className="shrink-0 font-medium text-primary">1.</span>
                  <span>{dict.hero.tutorialStep1}</span>
                </li>
                <li className="flex gap-2">
                  <span className="shrink-0 font-medium text-primary">2.</span>
                  <span>{dict.hero.tutorialStep3}</span>
                </li>
                <li className="flex gap-2">
                  <span className="shrink-0 font-medium text-primary">3.</span>
                  <span>{dict.hero.tutorialStep4}</span>
                </li>
              </ul>
            </div>

            {/* Generate Email */}
            <div className="mb-4 space-y-2">
              <button
                onClick={() => setGenerateOpen(true)}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary/50 hover:bg-muted/50"
              >
                <ChevronDown className="h-4 w-4" />
                {dict.generate.openButton}
              </button>
              <button
                onClick={() => setGenerateOpen(true)}
                disabled={loading}
                className="animate-press flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow-primary transition-fluid hover:-translate-y-0.5 hover:bg-primary/90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
              >
                <Sparkles className="h-4 w-4" />
                {loading ? dict.generate.generating : dict.generate.generate}
              </button>
              {error && (
                <p className="mt-1 text-xs text-destructive">{error}</p>
              )}
            </div>

            {/* Saved Emails */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-foreground">
                  {dict.sidebar.title}
                </h2>
                {savedEmails.length > 0 && (
                  <button
                    onClick={handleRemoveAllEmails}
                    className="flex items-center gap-1 rounded px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                    Remover todos
                  </button>
                )}
              </div>
              
              {savedEmails.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-3 text-center">
                  <Mail className="mx-auto h-6 w-6 text-muted-foreground/50" />
                  <p className="mt-1 text-xs text-muted-foreground">
                    {dict.sidebar.noSavedEmails}
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {savedEmails.map((saved) => (
                    <div
                      key={saved.address}
                      className={`group relative rounded-lg border p-2.5 transition-colors cursor-pointer ${
                        selectedEmail === saved.address
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50 hover:bg-muted/50"
                      }`}
                      onClick={() => handleSelectEmail(saved.address)}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium text-foreground">
                            {saved.address}
                          </p>
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-500">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            {dict.sidebar.online}
                          </span>
                        </div>
                        <div className="flex shrink-0 items-center gap-0.5">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleCopyEmail(saved.address)
                            }}
                            className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                          >
                            <Copy className="h-3 w-3" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleSelectEmail(saved.address)
                            }}
                            className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                          >
                            <RefreshCw className="h-3 w-3" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleRemoveEmail(saved.address)
                            }}
                            className="rounded p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Center - Inbox */}
        <div className="flex-1 flex flex-col min-w-0 relative">
          {/* Expand left sidebar button - only on md+ */}
          {leftSidebarCollapsed && (
            <button
              onClick={() => setLeftSidebarCollapsed(false)}
              className="absolute left-2 top-2 z-10 hidden md:block rounded-lg border border-border bg-card p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
          
          {/* Expand right sidebar button - only on xl+ */}
          {rightSidebarCollapsed && (
            <button
              onClick={() => setRightSidebarCollapsed(false)}
              className="absolute right-2 top-2 z-10 hidden xl:block rounded-lg border border-border bg-card p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}
          <div className="flex-1 p-2 sm:p-4 w-full overflow-x-hidden">
            {selectedEmail ? (
              <div className="h-full">
                {/* Selected Email Header */}
                <div className="mb-3 flex items-center justify-between rounded-lg border border-border bg-card p-2.5">
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-semibold">
                      {selectedEmail.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-500">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          {dict.sidebar.online}
                        </span>
                      </div>
                      <p className="truncate text-sm font-medium text-foreground">{selectedEmail}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      onClick={() => handleCopyEmail(selectedEmail)}
                      className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {statusMessage && (
                  <div className="mb-3 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                    {statusMessage}
                  </div>
                )}

                <Inbox
                  emails={emails}
                  activeEmail={selectedEmail.split("@")[0]}
                  activeDomain={"@" + selectedEmail.split("@")[1]}
                  hasSearched={true}
                  isLoading={loading}
                  isRefreshing={refreshing}
                  isPolling={false}
                  statusMessage={statusMessage}
                  countdown={0}
                  fetchError={error}
                  onRefresh={handleRefresh}
                  dict={dict}
                />
              </div>
            ) : (
              <div className="flex h-full items-center justify-center">
                <div className="text-center">
                  <Mail className="mx-auto h-10 w-10 text-muted-foreground/30" />
                  <p className="mt-3 text-sm font-medium text-muted-foreground">
                    {dict.inbox.noEmailSelected}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground/70">
                    {dict.inbox.enterEmailPrompt}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Ads Section */}
          <div className="border-t border-border bg-muted/30 p-4">
            <div className="w-full">
              <div className="rounded-lg border border-dashed border-border bg-background p-6 text-center">
                <p className="text-xs text-muted-foreground">Espaco para Anuncios</p>
                {/* Ad code will go here */}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Links (TG, GGMax, Methods) - only xl+ */}
        <div className={`border-t md:border-t-0 md:border-l border-border bg-card transition-all duration-300 ${
          rightSidebarCollapsed ? "hidden" : "hidden xl:block w-56 shrink-0"
        }`}>
          <div className="relative p-4">
            {/* Collapse button */}
            <button
              onClick={() => setRightSidebarCollapsed(true)}
              className="absolute right-2 top-2 rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            
            <h3 className="mb-3 text-sm font-semibold text-foreground">Links</h3>
          
          {/* Telegram */}
          <a
            href={TELEGRAM_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="mb-3 flex items-center gap-3 rounded-lg border border-border bg-background p-3 shadow-soft transition-fluid hover-lift hover:border-primary/50 hover:bg-muted/50 hover:shadow-soft-lg"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-500/10">
              <Send className="h-5 w-5 text-sky-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Telegram</p>
              <p className="text-xs text-muted-foreground">@sukodeuva</p>
            </div>
            <ExternalLink className="ml-auto h-4 w-4 text-muted-foreground" />
          </a>

          {/* GGMax */}
          <a
            href={GGMAX_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="mb-3 flex items-center gap-3 rounded-lg border border-border bg-background p-3 shadow-soft transition-fluid hover-lift hover:border-primary/50 hover:bg-muted/50 hover:shadow-soft-lg"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
              <span className="text-lg font-bold text-emerald-500">GG</span>
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">GGMax</p>
              <p className="text-xs text-muted-foreground">SuKyNhoul</p>
            </div>
            <ExternalLink className="ml-auto h-4 w-4 text-muted-foreground" />
          </a>

          {/* Methods/HTMLs */}
          <a
            href={METHODS_LINK}
            className={`flex items-center gap-3 rounded-lg border border-border bg-background p-3 shadow-soft transition-fluid ${
              METHODS_LINK === "#"
                ? "opacity-50 cursor-not-allowed"
                : "hover-lift hover:border-primary/50 hover:bg-muted/50 hover:shadow-soft-lg"
            }`}
            onClick={(e) => METHODS_LINK === "#" && e.preventDefault()}
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/10">
              <FileCode className="h-5 w-5 text-violet-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Metodos</p>
              <p className="text-xs text-muted-foreground">
                {METHODS_LINK === "#" ? "Em breve..." : "HTMLs e mais"}
              </p>
            </div>
            {METHODS_LINK !== "#" && (
              <ExternalLink className="ml-auto h-4 w-4 text-muted-foreground" />
            )}
          </a>
          </div>
        </div>
      </main>

      <footer className="border-t border-border py-3 text-center text-xs text-muted-foreground">
        <p>{dict.footer.text}</p>
      </footer>

    </div>
  )
}
