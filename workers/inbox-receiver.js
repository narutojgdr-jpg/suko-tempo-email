/**
 * Cloudflare Email Worker — inbox-receiver
 *
 * O que faz:
 *  1) Encaminha o email para um Proton diferente conforme o DOMINIO DO DESTINATARIO (To):
 *       - gmail.com                 -> abusadordoamin@protonmail.com
 *       - outlook.com / hotmail.com -> outsukoemailfoda@protonmail.com
 *       - qualquer outro (normais)  -> emailsnormaissuko@protonmail.com
 *  2) Faz uma extracao robusta (headers decodificados, multipart, base64,
 *     quoted-printable e charset) e grava no KV num formato LIMPO que o site
 *     ja sabe ler em lib/mime.ts -> buildCustomDomainEmail():
 *       { from, fromName, fromAddress, subject, date, text, html, intendedFor }
 *
 * Binding KV esperado: EMAILS
 */

// ----------------------- forwarding por destinatario -----------------------

const FORWARD_GMAIL = "abusadordoamin@protonmail.com"
const FORWARD_OUTLOOK = "outsukoemailfoda@protonmail.com"
const FORWARD_DEFAULT = "emailsnormaissuko@protonmail.com"

/** Extrai o dominio de "Nome <a@b.com>" ou "a@b.com". */
function extractDomain(addr) {
  if (!addr) return ""
  const m = addr.match(/<([^>]+)>/)
  const email = (m ? m[1] : addr).trim()
  const at = email.lastIndexOf("@")
  if (at === -1) return ""
  return email
    .slice(at + 1)
    .replace(/[>\s]+$/g, "")
    .toLowerCase()
    .trim()
}

const GMAIL_DOMAINS = ["gmail.com", "googlemail.com"]
const OUTLOOK_DOMAINS = [
  "outlook.com",
  "hotmail.com",
  "live.com",
  "msn.com",
  "outlook.com.br",
  "hotmail.com.br",
  "live.com.br",
  "outlook.es",
  "hotmail.es",
  "outlook.fr",
  "hotmail.fr",
]

function classifyDomain(domain) {
  const d = (domain || "").toLowerCase().trim()
  if (GMAIL_DOMAINS.includes(d)) return "gmail"
  if (OUTLOOK_DOMAINS.includes(d)) return "outlook"
  return "other"
}

/** Le um header (com unfolding de linhas dobradas) de um bloco de headers cru. */
function readRawHeader(headerBlock, name) {
  const re = new RegExp(`^${name}:\\s*([\\s\\S]*?)(?=\\n[^\\t ]|$)`, "im")
  const m = headerBlock.match(re)
  if (!m) return ""
  return m[1].replace(/\n[\t ]+/g, " ").trim()
}

/** Extrai TODOS os dominios de email de uma string (To/Cc com varios enderecos). */
function domainsFromHeaderValue(value) {
  if (!value) return []
  const out = []
  const re = /[A-Za-z0-9._%+\-]+@([A-Za-z0-9.\-]+\.[A-Za-z]{2,})/g
  let m
  while ((m = re.exec(value)) !== null) {
    out.push(m[1].toLowerCase().trim())
  }
  return out
}

/**
 * Decide o Proton de destino escaneando TODOS os enderecos de destinatario
 * encontrados nos headers (To, Cc, Delivered-To, X-Original-To, Envelope-To) e,
 * como ultimo recurso, no envelope da Cloudflare. Prioridade: Outlook > Gmail > default.
 * Retorna { forwardTo, matchedDomain, source }.
 */
function detectForwardTarget(headerBlock, envelopeTo) {
  const candidates = []
  for (const h of ["to", "cc", "delivered-to", "x-original-to", "envelope-to", "x-forwarded-to"]) {
    const val = readRawHeader(headerBlock, h)
    for (const d of domainsFromHeaderValue(val)) candidates.push({ domain: d, source: h })
  }
  if (envelopeTo) candidates.push({ domain: extractDomain(envelopeTo), source: "envelope" })

  // Outlook tem prioridade, depois Gmail.
  const outlookHit = candidates.find((c) => classifyDomain(c.domain) === "outlook")
  if (outlookHit) return { forwardTo: FORWARD_OUTLOOK, matchedDomain: outlookHit.domain, source: outlookHit.source }

  const gmailHit = candidates.find((c) => classifyDomain(c.domain) === "gmail")
  if (gmailHit) return { forwardTo: FORWARD_GMAIL, matchedDomain: gmailHit.domain, source: gmailHit.source }

  const first = candidates.find((c) => c.domain)
  return { forwardTo: FORWARD_DEFAULT, matchedDomain: first ? first.domain : "", source: first ? first.source : "none" }
}

// ----------------------- helpers de decodificacao -----------------------

function b64ToBytes(s) {
  const clean = s.replace(/[^A-Za-z0-9+/=]/g, "")
  const bin = atob(clean)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

function qpToBytes(s) {
  const joined = s.replace(/=\r?\n/g, "")
  const out = []
  for (let i = 0; i < joined.length; i++) {
    const c = joined[i]
    if (c === "=" && i + 2 < joined.length + 1) {
      const hex = joined.substr(i + 1, 2)
      if (/^[0-9A-Fa-f]{2}$/.test(hex)) {
        out.push(parseInt(hex, 16))
        i += 2
        continue
      }
    }
    out.push(c.charCodeAt(0) & 0xff)
  }
  return new Uint8Array(out)
}

function decodeBytes(bytes, charset) {
  try {
    return new TextDecoder(charset || "utf-8").decode(bytes)
  } catch {
    try {
      return new TextDecoder("utf-8").decode(bytes)
    } catch {
      return ""
    }
  }
}

/** Decodifica encoded-words RFC 2047: =?UTF-8?B?...?= e =?UTF-8?Q?...?= */
function decodeEncodedWords(str) {
  if (!str) return ""
  // junta encoded-words adjacentes separados por espaco (devem ser colados)
  const joined = str.replace(/\?=\s+=\?/g, "?==?")
  return joined.replace(/=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g, (whole, charset, enc, data) => {
    try {
      if (enc.toUpperCase() === "B") {
        return decodeBytes(b64ToBytes(data), charset)
      }
      // Q-encoding: "_" vira espaco
      const qp = data.replace(/_/g, " ")
      return decodeBytes(qpToBytes(qp), charset)
    } catch {
      return whole
    }
  })
}

/** Separa "Nome <a@b.com>" em { name, address }. */
function parseAddress(headerVal) {
  const v = decodeEncodedWords(headerVal || "").trim()
  const m = v.match(/^(.*?)<([^>]+)>\s*$/)
  if (m) {
    return { name: m[1].replace(/^["']|["']$/g, "").trim(), address: m[2].trim() }
  }
  return { name: "", address: v }
}

// ----------------------- parser MIME -----------------------

function parseMime(rawInput) {
  const raw = rawInput.replace(/\r\n/g, "\n").replace(/\r/g, "\n")

  function getHeader(block, name) {
    const re = new RegExp(`^${name}:\\s*([\\s\\S]*?)(?=\\n[^\\t ]|$)`, "im")
    const m = block.match(re)
    if (!m) return ""
    return m[1].replace(/\n[\t ]+/g, " ").trim()
  }
  function splitBlock(block) {
    const i = block.indexOf("\n\n")
    if (i === -1) return { headerBlock: block, body: "" }
    return { headerBlock: block.slice(0, i), body: block.slice(i + 2) }
  }
  function charsetOf(ct) {
    const m = ct.match(/charset=(?:"([^"]+)"|'([^']+)'|([^;\s]+))/i)
    return m ? (m[1] || m[2] || m[3]).trim() : "utf-8"
  }
  function boundaryOf(headerBlock) {
    const ct = getHeader(headerBlock, "content-type")
    const m = ct.match(/boundary=(?:"([^"]+)"|'([^']+)'|([^;\s]+))/i)
    return m ? (m[1] || m[2] || m[3]).trim() : null
  }
  function decodePart(body, encoding, charset) {
    const enc = (encoding || "").toLowerCase()
    if (enc.includes("base64")) return decodeBytes(b64ToBytes(body), charset)
    if (enc.includes("quoted-printable")) return decodeBytes(qpToBytes(body), charset)
    return body
  }
  function extract(block) {
    const { headerBlock, body } = splitBlock(block)
    const ctRaw = getHeader(headerBlock, "content-type")
    const ct = ctRaw.toLowerCase()
    const encoding = getHeader(headerBlock, "content-transfer-encoding")
    const charset = charsetOf(ctRaw)
    const boundary = boundaryOf(headerBlock)

    if (boundary || ct.includes("multipart/")) {
      const bnd =
        boundary ||
        (raw.match(/boundary=(?:"([^"]+)"|'([^']+)'|([^;\s]+))/i) || [])
          .slice(1)
          .find(Boolean)
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

    const decoded = decodePart(body, encoding, charset).trim()
    if (ct.includes("text/html")) return { html: decoded, plain: "" }
    if (ct.includes("text/plain")) return { html: "", plain: decoded }
    return { html: "", plain: "" }
  }

  return extract(raw)
}

// ----------------------- handler principal -----------------------

export default {
  async email(message, env, ctx) {
    const to = (message.to || "").toLowerCase().trim()
    // O header From: e o remetente que o usuario ve (ex.: noreply@spotify.com).
    // message.from costuma ser o envelope/return-path, entao priorizamos o header.
    const fromHeaderVal = message.headers.get("from") || message.from || ""

    // ====================================================================
    // Le o conteudo bruto UMA vez (precisamos dele pra decidir o roteamento
    // e tambem pra extrair pro site). Ler o raw NAO impede o forward.
    // ====================================================================
    let raw = ""
    try {
      raw = await new Response(message.raw).text()
    } catch (e) {
      console.error("[v0] Falha ao ler raw:", e)
    }
    const normalized = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n")
    const headerEnd = normalized.indexOf("\n\n")
    const headerBlock = headerEnd === -1 ? normalized : normalized.slice(0, headerEnd)

    // ====================================================================
    // PASSO 1 — ENCAMINHAR conforme o destinatario.
    // Escaneia TODOS os headers de destinatario (To, Cc, Delivered-To, etc.)
    // procurando outlook/gmail. Prioridade: Outlook > Gmail > default.
    // Cada destino precisa estar VERIFICADO em
    // Cloudflare > Email > Destination addresses.
    // ====================================================================
    const { forwardTo, matchedDomain, source } = detectForwardTarget(headerBlock, to)
    // Logs de diagnostico — veja em `wrangler tail` / aba Logs do Worker.
    console.log(`[v0] raw.length=${raw.length} | headerTo="${readRawHeader(headerBlock, "to")}"`)
    console.log(
      `[v0] Roteamento -> envelope=${to} | matched=${matchedDomain || "nenhum"} (via ${source}) | forwardTo=${forwardTo}`,
    )
    try {
      await message.forward(forwardTo)
      console.log(`[v0] Forward OK -> ${forwardTo}`)
    } catch (fwdErr) {
      // NAO reenvia pra outro inbox: isso mascarava o erro e mandava pro lugar errado.
      // Quase sempre significa que ${forwardTo} NAO esta verificado em
      // Cloudflare > Email > Destination addresses (ou a verificacao nao propagou).
      console.error(`[v0] FORWARD FALHOU para ${forwardTo}. Verifique se esse endereco esta`,
        `como Destination address VERIFICADO no Cloudflare. Erro:`, fwdErr)
    }

    // ====================================================================
    // PASSO 2 — Extrair e gravar no KV para o site (isolado: se quebrar
    // aqui, o encaminhamento acima ja foi feito).
    // ====================================================================
    try {
      const date = new Date().toISOString()

      // Destinatario real (intendedFor) — mantido do worker original
      let intendedFor = to
      const deliveredTo = message.headers.get("delivered-to")
      const xOriginalTo = message.headers.get("x-original-to")
      if (deliveredTo && deliveredTo.includes("@")) {
        intendedFor = deliveredTo.toLowerCase().trim()
      } else if (xOriginalTo && xOriginalTo.includes("@")) {
        intendedFor = xOriginalTo.toLowerCase().trim()
      } else if (fromHeaderVal.includes("+caf_=")) {
        const match = fromHeaderVal.match(/^(.+?)\+caf_=/)
        if (match) intendedFor = match[1] + "@gmail.com"
      }

      // Extracao limpa para o site
      const fromFull = (function () {
        const re = /^from:\s*([\s\S]*?)(?=\n[^\t ]|$)/im
        const m = raw.replace(/\r\n/g, "\n").match(re)
        return (m ? m[1].replace(/\n[\t ]+/g, " ").trim() : "") || fromHeaderVal
      })()
      const { name: fromName, address: fromAddress } = parseAddress(fromFull)

      const subjectRaw = (function () {
        const re = /^subject:\s*([\s\S]*?)(?=\n[^\t ]|$)/im
        const m = raw.replace(/\r\n/g, "\n").match(re)
        return (m ? m[1].replace(/\n[\t ]+/g, " ").trim() : "") || message.headers.get("subject") || ""
      })()
      const subject = decodeEncodedWords(subjectRaw) || "(sem assunto)"

      const { html, plain } = parseMime(raw)
      let text = plain
      const htmlOut = html
      if (!text && !htmlOut) {
        text = raw.substring(0, 15000)
      }

      const data = {
        from: fromAddress || fromHeaderVal, // endereco real, nunca o message-id
        fromName,
        fromAddress,
        subject,
        date,
        text: text || null,
        html: htmlOut || null,
        intendedFor,
      }

      const key = `${to}:${Date.now()}`
      await env.EMAILS.put(key, JSON.stringify(data), { expirationTtl: 86400 })
    } catch (err) {
      console.error("Erro ao gravar no KV:", err)
    }
  },
}
