import { timingSafeEqual } from "crypto"

/**
 * Autenticacao da API publica de inbox.
 *
 * As chaves validas ficam na env `INBOX_API_KEYS` (uma ou varias, separadas por
 * virgula). Assim da para entregar uma chave para o site do amigo e revogar
 * depois sem mexer no codigo. A chave deve vir no header:
 *
 *   Authorization: Bearer <chave>
 *   ou
 *   x-api-key: <chave>
 */

function loadKeys(): string[] {
  const raw = process.env.INBOX_API_KEYS ?? ""
  return raw
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean)
}

/** Comparacao em tempo constante para evitar ataques de timing. */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

/** Extrai a chave enviada na requisicao (Bearer ou x-api-key). */
function extractKey(req: Request): string | null {
  const auth = req.headers.get("authorization")
  if (auth?.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7).trim()
  }
  const headerKey = req.headers.get("x-api-key")
  if (headerKey) return headerKey.trim()
  return null
}

export type ApiAuthResult =
  | { ok: true }
  | { ok: false; status: number; error: string }

/** Valida a chave da requisicao contra `INBOX_API_KEYS`. */
export function checkApiKey(req: Request): ApiAuthResult {
  const validKeys = loadKeys()
  if (validKeys.length === 0) {
    return {
      ok: false,
      status: 503,
      error: "API nao configurada: defina INBOX_API_KEYS no ambiente.",
    }
  }

  const provided = extractKey(req)
  if (!provided) {
    return {
      ok: false,
      status: 401,
      error: "Chave de API ausente. Envie no header Authorization: Bearer <chave>.",
    }
  }

  const matches = validKeys.some((k) => safeEqual(k, provided))
  if (!matches) {
    return { ok: false, status: 401, error: "Chave de API invalida." }
  }

  return { ok: true }
}
