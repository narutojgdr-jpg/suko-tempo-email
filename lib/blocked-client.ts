import { getBlockedAddresses } from "@/app/actions/blocklist"
import { isBlockedInboxAddress, domainOf } from "@/lib/inbox-routing"

/**
 * Checagem de bloqueio no CLIENTE (navegador). Usada antes de ler caixas de
 * dominio proprio direto do Cloudflare KV, que nao passam pelo servidor.
 *
 * Carrega a blocklist (fixa + dinamica) via server action uma vez e mantem em
 * cache por alguns segundos, evitando uma ida ao servidor a cada poll de email.
 * A lista fixa (isBlockedInboxAddress) e checada de forma sincrona, entao os
 * bloqueios criticos valem mesmo antes da lista dinamica carregar.
 */

type ClientCache = { addresses: Set<string>; domains: Set<string>; at: number }
let cache: ClientCache | null = null
let inflight: Promise<void> | null = null
const CACHE_TTL_MS = 30_000

async function ensureLoaded(): Promise<void> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return
  if (!inflight) {
    inflight = getBlockedAddresses()
      .then((d) => {
        cache = {
          addresses: new Set(d.addresses.map((a) => a.toLowerCase().trim())),
          domains: new Set(d.domains.map((a) => a.toLowerCase().trim())),
          at: Date.now(),
        }
      })
      .catch(() => {
        // Falha de rede: mantem o que tiver (ou vazio). A lista fixa ainda vale.
        cache = cache ?? { addresses: new Set(), domains: new Set(), at: Date.now() }
      })
      .finally(() => {
        inflight = null
      })
  }
  await inflight
}

/** true quando a caixa esta bloqueada e nao pode ser lida. */
export async function isAddressBlocked(address: string): Promise<boolean> {
  const a = address.toLowerCase().trim()
  if (isBlockedInboxAddress(a)) return true
  await ensureLoaded()
  if (cache!.addresses.has(a)) return true
  if (cache!.domains.has(domainOf(a))) return true
  return false
}
