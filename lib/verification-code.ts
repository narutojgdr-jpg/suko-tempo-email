/**
 * Extracao de codigo de verificacao/OTP a partir do assunto + corpo de um email.
 *
 * Versao server-side (sem DOMParser) do algoritmo usado na UI
 * (components/mail-inbox.tsx). Mantida aqui para a API publica reutilizar sem
 * depender de codigo de componente client.
 */

// Palavras que costumam aparecer perto de um codigo de verificacao/OTP.
const CODE_KEYWORDS =
  /(c[oó]digo|verifica[cç][aã]o|verification|\bcode\b|\botp\b|\bpin\b|senha|password|one[- ]?time|uso [uú]nico|security code|c[oó]d\.)/gi

/** Converte HTML em texto puro (sem DOM, seguro no servidor). */
function htmlToText(html: string): string {
  if (!html) return ""
  return html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
}

/**
 * Detecta um codigo de verificacao no assunto/corpo do email. Usa proximidade
 * de palavras-chave e prioriza codigos de 6 digitos, ignorando anos (ex.: 2026).
 * Retorna o codigo (string de digitos) ou null se nada confiavel for achado.
 */
export function extractVerificationCode(subject: string, body: string): string | null {
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
