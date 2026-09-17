/**
 * Shared helpers to turn the raw payloads returned by the Cloudflare KV inbox
 * worker (custom domains) into clean, human-friendly emails — exactly as they
 * arrive in the real inbox.
 *
 * The worker returns `{ from, subject, date, text }` where:
 *  - `from`/`subject` are taken from the envelope/headers and may be raw
 *    (e.g. a `bounces+...` VERP return-path, or a MIME encoded-word subject).
 *  - `text` is the raw MIME message (headers + body), sometimes truncated.
 *
 * These functions decode encoded-words, prefer the real `From:`/`Subject:`
 * headers found inside the raw MIME, clean up the sender, and extract the
 * best body (HTML preferred, falling back to plain text).
 */

/** Decode a base64 string to UTF-8 (or the given charset) text. */
function decodeBase64(s: string, charset = "utf-8"): string {
  try {
    const bin = atob(s.replace(/\s/g, ""))
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
    return new TextDecoder(charset).decode(bytes)
  } catch {
    return ""
  }
}

/** Normalize a charset label to one the TextDecoder understands. */
function normalizeCharset(charset: string): string {
  const c = charset.toLowerCase().trim()
  if (c.includes("8859")) return "iso-8859-1"
  if (c.includes("windows-1252") || c === "cp1252") return "windows-1252"
  if (c.includes("ascii")) return "utf-8"
  return c || "utf-8"
}

/**
 * Decode RFC 2047 "encoded-word" sequences found in headers, e.g.
 * `=?UTF-8?B?4oCTIFNldSBjw7NkaWdv?=` -> "– Seu código".
 * Handles both B (base64) and Q (quoted-printable) encodings and collapses the
 * whitespace that separates two consecutive encoded-words (per the RFC).
 */
export function decodeMimeWord(input: string): string {
  if (!input) return ""
  // Remove whitespace between two adjacent encoded-words (must be ignored).
  const collapsed = input.replace(/\?=\s+=\?/g, "?==?")
  return collapsed.replace(/=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g, (_, charset, enc, text) => {
    const cs = normalizeCharset(charset)
    try {
      if (enc.toUpperCase() === "B") {
        return decodeBase64(text, cs)
      }
      // Q-encoding: "_" means space, "=XX" are hex bytes.
      const qp = String(text)
        .replace(/_/g, " ")
        .replace(/=([0-9A-Fa-f]{2})/g, (_m: string, h: string) => String.fromCharCode(parseInt(h, 16)))
      const bytes = Uint8Array.from(qp, (c: string) => c.charCodeAt(0))
      return new TextDecoder(cs).decode(bytes)
    } catch {
      return text
    }
  })
}

/**
 * Turn a raw `From` value into a clean, friendly sender label.
 * Handles display names ("ChatGPT" <x@y>), bounce/VERP addresses
 * (bounces+123-...@em.spotify.com), encoded-word names, and derives a brand
 * from the domain when no usable display name exists.
 */
export function cleanSender(raw: string): string {
  if (!raw) return "Desconhecido"
  const value = decodeMimeWord(raw.trim())

  // 1. Prefer the display name if present: "Name" <email> or Name <email>
  const displayMatch = value.match(/^\s*"?([^"<]+?)"?\s*<[^>]+>/)
  if (displayMatch) {
    const name = displayMatch[1].trim()
    if (name && !/@/.test(name)) return name
  }

  // 2. Extract the email address (inside <> or the whole string)
  const angle = value.match(/<([^>]+)>/)
  const addr = (angle ? angle[1] : value).trim()
  const domainPart = addr.split("@")[1] ?? addr
  if (!domainPart) return addr || "Desconhecido"

  // 3. Derive a brand from the domain, dropping generic mail-server labels.
  const labels = domainPart.toLowerCase().replace(/[<>]/g, "").split(".").filter(Boolean)
  const junk = new Set([
    "com", "net", "org", "io", "co", "email", "mail", "em", "tm",
    "mailer", "smtp", "mx", "send", "sendgrid", "mailgun", "amazonses",
    "info", "br", "us", "app", "bounce", "bounces", "reply", "noreply", "no-reply",
  ])
  let brand =
    labels.filter((l) => !junk.has(l) && !/^em\d+$/.test(l) && !/^\d+$/.test(l)).pop() ??
    labels[0] ??
    domainPart

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
    instagram: "Instagram",
    facebook: "Facebook",
    netflix: "Netflix",
    discord: "Discord",
    google: "Google",
    microsoft: "Microsoft",
  }
  if (knownBrands[brand]) return knownBrands[brand]
  return brand.charAt(0).toUpperCase() + brand.slice(1)
}

/**
 * Render a plain-text body as safe HTML: escape, turn bare URLs and
 * `[label](url)` into links (shortening long tracking URLs), and preserve
 * line breaks. Used so plain-text emails still read nicely on the site.
 */
export function renderPlainText(text: string): string {
  const linkStyle = "color:#7c3aed;text-decoration:underline;word-break:break-word"
  const shortLabel = (url: string): string => {
    if (url.length <= 60) return url
    try {
      const u = new URL(url)
      return `${u.hostname.replace(/^www\./, "")} \u2192`
    } catch {
      return url.slice(0, 50) + "\u2026"
    }
  }
  let html = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  // Markdown-style [label](url)
  html = html.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    (_, label, url) =>
      `<a href="${url}" target="_blank" rel="noopener noreferrer" style="${linkStyle}">${label}</a>`,
  )
  // Bare URLs
  html = html.replace(
    /(?<![="'(>])(https?:\/\/[^\s<>"')\]]+)/g,
    (url) =>
      `<a href="${url}" target="_blank" rel="noopener noreferrer" style="${linkStyle}">${shortLabel(url)}</a>`,
  )
  html = html.replace(/\n{2,}/g, "</p><p style='margin:12px 0'>").replace(/\n/g, "<br>")
  return `<p style='margin:0'>${html}</p>`
}

/** Read a header value from a raw MIME header block, unfolding folded lines. */
export function getRawHeader(raw: string, name: string): string {
  const normalized = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n")
  // Only look at the header block (before the first blank line) when possible.
  const headerEnd = normalized.indexOf("\n\n")
  const headerBlock = headerEnd === -1 ? normalized : normalized.slice(0, headerEnd)
  const re = new RegExp(`^${name}:\\s*([\\s\\S]*?)(?=\\n[^\\t ]|$)`, "im")
  const m = headerBlock.match(re)
  if (!m) return ""
  return m[1].replace(/\n[\t ]+/g, " ").trim()
}

/**
 * Extract the best body (decoded HTML, or plain text wrapped in <pre>) from a
 * raw MIME message. Recursively walks multipart structures and tolerates
 * truncated outer headers.
 */
export function parseMimeBody(rawInput: string): string {
  const raw = rawInput.replace(/\r\n/g, "\n").replace(/\r/g, "\n")

  const decodeQP = (s: string) =>
    s.replace(/=\n/g, "").replace(/=([0-9A-Fa-f]{2})/g, (_, h) => {
      try {
        return decodeURIComponent("%" + h)
      } catch {
        return ""
      }
    })

  const decodePart = (body: string, encoding: string) => {
    if (encoding.includes("base64")) return decodeBase64(body)
    if (encoding.includes("quoted-printable")) return decodeQP(body)
    return body
  }

  const headerOf = (block: string, name: string): string => {
    const re = new RegExp(`^${name}:\\s*([\\s\\S]*?)(?=\\n[^\\t ]|$)`, "im")
    const m = block.match(re)
    if (!m) return ""
    return m[1].replace(/\n[\t ]+/g, " ").trim()
  }

  const splitBlock = (block: string): { headerBlock: string; body: string } => {
    const idx = block.indexOf("\n\n")
    if (idx === -1) return { headerBlock: block, body: "" }
    return { headerBlock: block.slice(0, idx), body: block.slice(idx + 2) }
  }

  const getBoundary = (headerBlock: string): string | null => {
    const ct = headerOf(headerBlock, "content-type")
    const m = ct.match(/boundary=(?:"([^"]+)"|'([^']+)'|(\S+))/i)
    if (!m) return null
    return (m[1] ?? m[2] ?? m[3]).replace(/^["']|["']$/g, "").trim()
  }

  const extract = (block: string): { html: string; plain: string } => {
    const { headerBlock, body } = splitBlock(block)
    const ct = headerOf(headerBlock, "content-type").toLowerCase()
    const encoding = headerOf(headerBlock, "content-transfer-encoding").toLowerCase()
    const boundary = getBoundary(headerBlock)

    if (boundary || ct.includes("multipart/")) {
      const bnd =
        boundary ??
        raw
          .match(/boundary=(?:"([^"]+)"|'([^']+)'|(\S+))/i)
          ?.slice(1)
          .find(Boolean)
          ?.replace(/^["']|["']$/g, "")
          .trim()
      if (!bnd) return { html: "", plain: "" }
      const esc = bnd.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      const parts = body.split(new RegExp(`--${esc}(?:--)?`))
      let html = ""
      let plain = ""
      for (const part of parts) {
        const t = part.trim()
        if (!t || t === "--") continue
        const r = extract(t)
        if (r.html && !html) html = r.html
        if (r.plain && !plain) plain = r.plain
      }
      return { html, plain }
    }

    const decoded = decodePart(body, encoding).trim()
    if (ct.includes("text/html")) return { html: decoded, plain: "" }
    if (ct.includes("text/plain")) return { html: "", plain: decoded }
    return { html: "", plain: "" }
  }

  const { html, plain } = extract(raw)
  if (html) return html
  if (plain) return renderPlainText(plain)

  // Fallback: scan for any boundary if the outer headers were truncated.
  const anyBoundary = raw.match(/boundary=(?:"([^"]+)"|'([^']+)'|(\S+))/i)
  if (anyBoundary) {
    const bnd = (anyBoundary[1] ?? anyBoundary[2] ?? anyBoundary[3]).replace(/^["']|["']$/g, "").trim()
    const esc = bnd.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    const startIdx = raw.indexOf(`--${bnd}`)
    if (startIdx !== -1) {
      const mimeBody = raw.slice(startIdx)
      const parts = mimeBody.split(new RegExp(`--${esc}(?:--)?`))
      let html2 = ""
      let plain2 = ""
      for (const part of parts) {
        const t = part.trim()
        if (!t || t === "--") continue
        const r = extract(t)
        if (r.html && !html2) html2 = r.html
        if (r.plain && !plain2) plain2 = r.plain
      }
      if (html2) return html2
      if (plain2) return renderPlainText(plain2)
    }
  }

  // Last resort: if the raw text has no MIME structure, treat it as plain text.
  const stripped = raw.replace(/^[\s\S]*?\n\n/, "").trim()
  const candidate = stripped || raw.trim()
  if (candidate) return renderPlainText(candidate)
  return ""
}

export interface RawInboxItem {
  id?: string
  /** Sender. New worker: friendly name or full address. Old: may be a hex id. */
  from?: string
  /** New worker: sender display name, e.g. "Perplexity". */
  fromName?: string
  /** New worker: sender email address, e.g. "team@mail.perplexity.ai". */
  fromAddress?: string
  to?: string
  subject?: string
  date?: string
  /** New worker: ready-to-render HTML body. */
  html?: string
  /** New worker: plain-text body. Old worker: the raw MIME message. */
  text?: string
  /** Optional raw MIME message (kept by the new worker for fallback). */
  raw?: string
}

export interface CleanEmail {
  id: string
  from: string
  subject: string
  date: string
  body: string
  attachments: never[]
}

/** Heuristic: does this string look like a raw MIME message (headers present)? */
function looksLikeMime(s: string): boolean {
  if (!s) return false
  return /(^|\n)(content-type|content-transfer-encoding|mime-version|received|return-path|dkim-signature):/i.test(
    s.slice(0, 4000),
  )
}

/**
 * Heuristic: does this string look like an opaque id (hex / uuid-ish) rather
 * than a real sender? e.g. "0100019ee576d541-251576d3-453f-40c9-9dd2-5c...".
 */
function looksLikeOpaqueId(s: string): boolean {
  if (!s) return false
  const v = s.trim()
  if (v.includes("@") || /\s/.test(v)) return false
  return /^[0-9a-f]{8,}([-][0-9a-f]+)*\.{0,3}$/i.test(v)
}

/**
 * Build a clean email object from a Cloudflare KV worker item.
 *
 * Supports two shapes:
 *  - NEW (recommended): `{ from, fromName, fromAddress, subject, date, html, text }`
 *    where `html`/`text` are already-parsed bodies. Read directly — fast & robust.
 *  - OLD (legacy): `{ from, subject, date, text }` where `text` is the raw MIME.
 *    We then decode headers and walk the MIME tree ourselves.
 */
export function buildCustomDomainEmail(item: RawInboxItem, idPrefix: string, index: number): CleanEmail {
  // Figure out where the raw MIME (if any) lives.
  const rawMime = item.raw ?? (looksLikeMime(item.text ?? "") ? (item.text ?? "") : "")

  // ---- Sender ----
  let from = ""
  if (item.fromName && item.fromName.trim()) {
    from = decodeMimeWord(item.fromName).trim()
  } else if (item.fromAddress && item.fromAddress.trim()) {
    from = cleanSender(item.fromAddress)
  } else if (rawMime && getRawHeader(rawMime, "from")) {
    from = cleanSender(getRawHeader(rawMime, "from"))
  } else if (item.from && !looksLikeOpaqueId(item.from)) {
    from = cleanSender(item.from)
  }
  if (!from) from = "Desconhecido"

  // ---- Subject ----
  const rawSubject =
    (item.subject && item.subject.trim()) || (rawMime && getRawHeader(rawMime, "subject")) || ""
  const subject = decodeMimeWord(rawSubject).trim() || "(Sem assunto)"

  // ---- Body ----
  let body = ""
  if (item.html && item.html.trim()) {
    body = item.html
  } else if (item.text && item.text.trim() && !looksLikeMime(item.text)) {
    body = renderPlainText(item.text)
  } else if (rawMime) {
    body = parseMimeBody(rawMime)
  }

  return {
    id: item.id ?? `${idPrefix}-${index}-${item.date ?? index}`,
    from,
    subject,
    date: item.date ?? "",
    body: body || `<p style="color:#a0a0a0;font-size:13px;font-style:italic">Sem conteudo.</p>`,
    attachments: [],
  }
}
