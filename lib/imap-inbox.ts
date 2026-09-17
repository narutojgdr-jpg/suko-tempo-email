import Imap from "imap"
import { simpleParser } from "mailparser"
import { getInboxKind, GMAIL_DOMAINS } from "@/lib/inbox-routing"
import { isInboxBlocked } from "@/lib/blocklist-store"

/**
 * Leitura de caixas IMAP (Titan / HostGator).
 *
 * Este modulo concentra TODA a logica de IMAP que antes vivia dentro de
 * `app/api/gmail-inbox/route.ts`. Tanto a rota interna do site quanto a API
 * publica (`/api/v1/inbox`) importam daqui, para nunca divergirem.
 */

export interface ParsedEmail {
  id: string
  from: string
  subject: string
  date: string
  body: string
}

interface MailboxCreds {
  user: string
  pass: string
  hosts: string[]
}

/** Erro de IMAP com status HTTP sugerido para a camada de rota. */
export class ImapInboxError extends Error {
  status: number
  constructor(message: string, status = 500) {
    super(message)
    this.name = "ImapInboxError"
    this.status = status
  }
}

function buildHosts(extra?: string): string[] {
  return Array.from(
    new Set(
      [extra, process.env.MAILTITAN_HOST, "imap.titan.email", "imap0101.titan.email"].filter(
        Boolean,
      ) as string[],
    ),
  )
}

const GMAIL_MAILBOX: MailboxCreds = {
  user: process.env.GMAIL_IMAP_USER ?? "abusadordoamin@tskulzinhox.shop",
  pass: "tonyenzo12!",
  hosts: buildHosts(process.env.GMAIL_IMAP_HOST),
}

const OUTLOOK_MAILBOX: MailboxCreds = {
  user: process.env.OUTLOOK_IMAP_USER ?? "sukooutlo@gpkolzinho.shop",
  pass: process.env.OUTLOOK_IMAP_PASS ?? "",
  hosts: buildHosts(process.env.OUTLOOK_IMAP_HOST),
}

/** Escolhe a caixa correta a partir do endereco solicitado. */
function mailboxFor(email: string): MailboxCreds | null {
  const kind = getInboxKind(email)
  if (kind === "gmail") return GMAIL_MAILBOX
  if (kind === "outlook") return OUTLOOK_MAILBOX
  return null // dominios proprios sao lidos via KV, nao por aqui
}

/**
 * Gera uma "chave canonica" de um endereco para casar aliases.
 * O Gmail ignora pontos no local-part e tudo depois do "+".
 */
function addressKey(addr: string): string | null {
  const lower = addr.toLowerCase().trim()
  const at = lower.lastIndexOf("@")
  if (at < 1) return null
  let local = lower.slice(0, at)
  const domain = lower.slice(at + 1)
  let tag = ""
  const plus = local.indexOf("+")
  if (plus >= 0) {
    tag = local.slice(plus + 1)
    local = local.slice(0, plus)
  }
  if (GMAIL_DOMAINS.includes(domain)) {
    local = local.replace(/\./g, "")
    return `gmail:${local}+${tag}`
  }
  return `${local}+${tag}@${domain}`
}

function extractAddresses(raw: Buffer): string[] {
  const text = raw.toString("utf8").slice(0, 200_000)
  return text.match(/[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}/gi) ?? []
}

const MAX_SCAN = 60

function searchImapForAddress(
  targetEmail: string,
  host: string,
  creds: MailboxCreds,
): Promise<ParsedEmail[]> {
  return new Promise((resolve, reject) => {
    const imap = new Imap({
      user: creds.user,
      password: creds.pass,
      host,
      port: 993,
      tls: true,
      tlsOptions: {
        host,
        servername: host,
        rejectUnauthorized: false,
      },
      connTimeout: 20000,
      authTimeout: 15000,
    })

    const results: ParsedEmail[] = []

    imap.once("error", (err: Error) => {
      console.log(`[v0] inbox: IMAP error (host=${host}): ${err.message}`)
      reject(err)
    })

    const targetKey = addressKey(targetEmail)

    imap.once("ready", () => {
      imap.openBox("INBOX", true, (err, box) => {
        if (err) {
          imap.end()
          return reject(err)
        }

        const fetchBodies = (uids: number[]) => {
          if (uids.length === 0) {
            imap.end()
            return resolve([])
          }
          const fetch = imap.fetch(uids, { bodies: "" })
          const parsePromises: Promise<void>[] = []

          fetch.on("message", (msg, seqno) => {
            const parsePromise = new Promise<void>((res) => {
              const buffers: Buffer[] = []
              msg.on("body", (stream) => {
                stream.on("data", (chunk: Buffer) => buffers.push(chunk))
                stream.once("end", async () => {
                  try {
                    const raw = Buffer.concat(buffers)
                    const parsed = await simpleParser(raw)

                    let body = ""
                    if (parsed.html) {
                      body = parsed.html
                    } else if (parsed.text) {
                      body = `<pre style="white-space:pre-wrap;font-family:inherit">${parsed.text}</pre>`
                    }

                    const fromAddr =
                      parsed.from?.text ?? parsed.from?.value?.[0]?.address ?? "Desconhecido"

                    results.push({
                      id: `imap-${seqno}-${parsed.date?.getTime() ?? Date.now()}`,
                      from: fromAddr,
                      subject: parsed.subject ?? "(Sem assunto)",
                      date: parsed.date?.toISOString() ?? new Date().toISOString(),
                      body,
                    })
                  } catch {
                    // Ignora mensagens malformadas
                  }
                  res()
                })
              })
            })
            parsePromises.push(parsePromise)
          })

          fetch.once("error", (fetchErr: Error) => {
            imap.end()
            reject(fetchErr)
          })

          fetch.once("end", async () => {
            await Promise.all(parsePromises)
            imap.end()
            results.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            resolve(results)
          })
        }

        const total = box?.messages?.total ?? 0
        console.log(`[v0] inbox: INBOX total=${total}`)
        if (total === 0) {
          imap.end()
          return resolve([])
        }

        const start = Math.max(1, total - MAX_SCAN + 1)
        const range = `${start}:${total}`
        console.log(`[v0] inbox: alvo=${targetEmail} key=${targetKey} range=${range}`)
        const matchedUids: number[] = []
        const headerFetch = imap.seq.fetch(range, { bodies: "HEADER", struct: false })

        headerFetch.on("message", (msg) => {
          let uid = 0
          const buffers: Buffer[] = []
          msg.once("attributes", (attrs) => {
            uid = attrs.uid
          })
          msg.on("body", (stream) => {
            stream.on("data", (chunk: Buffer) => buffers.push(chunk))
          })
          msg.once("end", () => {
            const keys = new Set(
              extractAddresses(Buffer.concat(buffers))
                .map(addressKey)
                .filter(Boolean) as string[],
            )
            if (targetKey && uid && keys.has(targetKey)) {
              matchedUids.push(uid)
            }
          })
        })

        headerFetch.once("error", (hErr: Error) => {
          imap.end()
          reject(hErr)
        })

        headerFetch.once("end", () => {
          console.log(`[v0] inbox: casaram=${matchedUids.length}`)
          fetchBodies(matchedUids.sort((a, b) => b - a))
        })
      })
    })

    imap.connect()
  })
}

/**
 * Le a caixa IMAP de um endereco gmail/outlook. Tenta cada host candidato.
 * - Retorna [] para dominios proprios (que sao lidos via KV).
 * - Lanca ImapInboxError com status apropriado em caso de falha.
 */
export async function fetchImapInbox(email: string): Promise<ParsedEmail[]> {
  if (await isInboxBlocked(email)) {
    throw new ImapInboxError("Esta caixa e protegida e nao pode ser lida.", 403)
  }
  const creds = mailboxFor(email)
  if (!creds) {
    // Dominio proprio: nao e lido via IMAP.
    return []
  }

  if (!creds.user || !creds.pass) {
    throw new ImapInboxError("Credenciais IMAP nao configuradas para este provedor", 500)
  }

  const errors: string[] = []
  for (const host of creds.hosts) {
    try {
      console.log(`[v0] inbox: tentando host=${host} mailbox=${creds.user}`)
      return await searchImapForAddress(email, host, creds)
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido"
      errors.push(msg)
      console.log(`[v0] inbox: host=${host} falhou: ${msg}`)
    }
  }

  const authErr = errors.find((m) => /auth/i.test(m))
  if (authErr) {
    const which = creds.user.includes("tskulzinhox") ? "GMAIL_IMAP_PASS" : "OUTLOOK_IMAP_PASS"
    throw new ImapInboxError(
      `Falha de login IMAP para ${creds.user}. Verifique a senha (${which}).`,
      500,
    )
  }
  throw new ImapInboxError(errors[0] ?? "Erro desconhecido", 500)
}
