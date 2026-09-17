import { getInboxKind, type InboxKind } from "@/lib/inbox-routing"
import { isInboxBlocked } from "@/lib/blocklist-store"
import { fetchImapInbox } from "@/lib/imap-inbox"
import { buildCustomDomainEmail } from "@/lib/mime"

/**
 * Fonte unica de leitura de caixas para consumo externo (API publica).
 *
 * Roteia pelo dominio, igual o site faz:
 *  - gmail/outlook  -> IMAP (lib/imap-inbox)
 *  - dominios proprios -> Cloudflare KV worker
 *
 * Retorna sempre o MESMO formato de e-mail, independente da fonte.
 */

const CF_INBOX_API = "https://inbox-api.izukisukinho.workers.dev/inbox"

export interface PublicEmail {
  id: string
  from: string
  subject: string
  date: string
  body: string
}

export interface PublicInboxResult {
  email: string
  provider: InboxKind
  count: number
  emails: PublicEmail[]
}

/** Le a caixa de um dominio proprio via Cloudflare KV worker. */
async function fetchKvInbox(address: string): Promise<PublicEmail[]> {
  const res = await fetch(`${CF_INBOX_API}/${address}`, { cache: "no-store" })
  if (!res.ok) {
    throw new Error(`Erro ao buscar emails do dominio proprio (${res.status})`)
  }
  const data = await res.json()
  return (Array.isArray(data) ? data : []).map((item, i: number) => {
    const e = buildCustomDomainEmail(item, `cf-${address}`, i)
    return {
      id: e.id,
      from: e.from,
      subject: e.subject,
      date: e.date,
      body: e.body,
    }
  })
}

/**
 * Le a caixa de QUALQUER endereco suportado e devolve um resultado normalizado.
 * Lanca Error em caso de falha (a rota traduz para HTTP).
 */
export async function fetchPublicInbox(rawEmail: string): Promise<PublicInboxResult> {
  const email = rawEmail.trim().toLowerCase()
  if (await isInboxBlocked(email)) {
    throw new Error("Esta caixa e protegida e nao pode ser lida.")
  }
  const provider = getInboxKind(email)

  const emails =
    provider === "kv" ? await fetchKvInbox(email) : await fetchImapInbox(email)

  // Ordena do mais recente para o mais antigo.
  emails.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  return { email, provider, count: emails.length, emails }
}
