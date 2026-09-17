import { query } from "@/lib/db"
import { isBlockedInboxAddress as isStaticBlocked, domainOf } from "@/lib/inbox-routing"

/**
 * Blocklist DINAMICA (gerenciada pelo admin) das caixas que NAO podem ser
 * lidas. Complementa a lista fixa em inbox-routing.ts (BLOCKED_INBOX_ADDRESSES),
 * que continua valendo como fallback de seguranca mesmo sem banco.
 *
 * Dois tipos de entrada:
 *  - "address": bloqueia um endereco exato (ex.: fulano@gmail.com)
 *  - "domain":  bloqueia o dominio inteiro (ex.: gpkolzinho.shop)
 *
 * Este modulo e SERVER-ONLY (usa o pool do Postgres). O cliente nunca o importa
 * diretamente — ele consome a lista via a server action getBlockedAddresses().
 */

export type BlockedRow = {
  id: number
  value: string
  kind: "address" | "domain"
  note: string | null
  created_at: string
}

let tableReady = false

export async function ensureBlocklistTable(): Promise<void> {
  if (tableReady) return
  await query(`
    CREATE TABLE IF NOT EXISTS public.blocked_inbox (
      id         serial PRIMARY KEY,
      value      text NOT NULL UNIQUE,
      kind       text NOT NULL DEFAULT 'address',
      note       text,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `)
  tableReady = true
}

/* ----------------------------- cache em memoria ---------------------------- */

type BlockedCache = { addresses: Set<string>; domains: Set<string>; at: number }
let cache: BlockedCache | null = null
const CACHE_TTL_MS = 20_000

/** Invalida o cache apos qualquer mutacao (add/remove). */
export function bustBlocklistCache(): void {
  cache = null
}

async function loadCache(): Promise<BlockedCache> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache
  await ensureBlocklistTable()
  const rows = await query<{ value: string; kind: string }>(
    `SELECT value, kind FROM public.blocked_inbox`,
  )
  const addresses = new Set<string>()
  const domains = new Set<string>()
  for (const r of rows) {
    const v = r.value.toLowerCase().trim()
    if (!v) continue
    if (r.kind === "domain") domains.add(v)
    else addresses.add(v)
  }
  cache = { addresses, domains, at: Date.now() }
  return cache
}

/**
 * Decide, server-side, se um endereco esta bloqueado. Considera:
 *  1. a lista fixa (inbox-routing) — fallback que nunca depende do banco;
 *  2. enderecos exatos da blocklist dinamica;
 *  3. dominios inteiros bloqueados.
 */
export async function isInboxBlocked(address: string): Promise<boolean> {
  const a = address.toLowerCase().trim()
  if (isStaticBlocked(a)) return true
  const { addresses, domains } = await loadCache()
  if (addresses.has(a)) return true
  if (domains.has(domainOf(a))) return true
  return false
}

/** Snapshot da blocklist dinamica (apenas os valores) para enviar ao cliente. */
export async function getDynamicBlocked(): Promise<{ addresses: string[]; domains: string[] }> {
  const { addresses, domains } = await loadCache()
  return { addresses: [...addresses], domains: [...domains] }
}
