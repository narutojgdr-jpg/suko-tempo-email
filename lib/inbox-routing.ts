/**
 * Centralized inbox routing.
 *
 * Decide, a partir do dominio do endereco, ONDE o site deve ler a caixa:
 *  - gmail.com / googlemail.com           -> IMAP (mailbox dos gmails)
 *  - outlook.com / hotmail.com / live.com -> IMAP (mailbox dos outlooks)
 *  - qualquer outro (dominios proprios)   -> Cloudflare KV worker
 *
 * Esse modulo e a UNICA fonte de verdade. Componentes (email-page,
 * reseller-page, profile-inbox-modal) e a API route importam daqui para
 * nunca divergirem.
 */

export const GMAIL_DOMAINS = ["gmail.com", "googlemail.com"]

export const OUTLOOK_DOMAINS = [
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

export type InboxKind = "gmail" | "outlook" | "kv"

/**
 * Enderecos "raiz" / catch-all que recebem o email de MUITOS outros enderecos
 * (inclusive os logins das mailboxes IMAP). Ler essas caixas exporia a
 * correspondencia de terceiros, entao sao SEMPRE bloqueadas — tanto no site
 * quanto na API publica. Para proteger uma nova caixa, basta adicionar o
 * endereco aqui (em minusculas).
 */
export const BLOCKED_INBOX_ADDRESSES: string[] = [
  "abusadordoamin@thesuaky.shop",
  "abusadordoamin@tskulzinhox.shop",
  "sukooutlo@gpkolzinho.shop",
]

const BLOCKED_INBOX_SET = new Set(
  BLOCKED_INBOX_ADDRESSES.map((a) => a.toLowerCase().trim()),
)

/**
 * true quando o endereco e uma caixa raiz protegida e NAO pode ser lido.
 * Normaliza para minusculas/sem espacos antes de comparar.
 */
export function isBlockedInboxAddress(address: string): boolean {
  return BLOCKED_INBOX_SET.has(address.toLowerCase().trim())
}

/** Extrai o dominio (parte depois do @) em minusculas. */
export function domainOf(address: string): string {
  const at = address.lastIndexOf("@")
  if (at === -1) return ""
  return address
    .slice(at + 1)
    .toLowerCase()
    .trim()
}

/** Classifica o endereco em gmail | outlook | kv. */
export function getInboxKind(address: string): InboxKind {
  const d = domainOf(address)
  if (GMAIL_DOMAINS.includes(d)) return "gmail"
  if (OUTLOOK_DOMAINS.includes(d)) return "outlook"
  return "kv"
}

/** true quando o endereco deve ser lido via IMAP (gmail ou outlook/hotmail). */
export function usesImap(address: string): boolean {
  const k = getInboxKind(address)
  return k === "gmail" || k === "outlook"
}
