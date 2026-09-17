import { type NextRequest, NextResponse } from "next/server"
import { checkApiKey } from "@/lib/api-auth"
import { fetchPublicInbox } from "@/lib/public-inbox"
import { isInboxBlocked } from "@/lib/blocklist-store"

export const runtime = "nodejs"
export const maxDuration = 30

/**
 * API publica de leitura de caixas (Gmail, Outlook e dominios proprios).
 *
 * GET /api/v1/inbox?email=<endereco>
 * Header: Authorization: Bearer <chave>  (ou x-api-key: <chave>)
 *
 * Resposta 200:
 * {
 *   "email": "fulano@gmail.com",
 *   "provider": "gmail" | "outlook" | "kv",
 *   "count": 2,
 *   "emails": [{ id, from, subject, date, body }, ...]
 * }
 */
export async function GET(req: NextRequest) {
  const auth = checkApiKey(req)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { searchParams } = new URL(req.url)
  // Em querystrings, "+" e decodificado como espaco. Como espaco nao existe em
  // email, revertemos para "+" e assim aliases (fulano+tag@gmail.com) funcionam
  // mesmo quando o cliente nao fez o percent-encoding (%2B).
  const email = searchParams.get("email")?.replace(/ /g, "+").trim().toLowerCase()

  if (!email || !email.includes("@") || email.length > 254) {
    return NextResponse.json(
      { error: "Parametro 'email' invalido ou ausente." },
      { status: 400 },
    )
  }

  if (await isInboxBlocked(email)) {
    return NextResponse.json(
      { error: "Esta caixa e protegida e nao pode ser lida." },
      { status: 403 },
    )
  }

  try {
    const result = await fetchPublicInbox(email)
    return NextResponse.json(result)
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido"
    console.log(`[v0] api/v1/inbox: falha para ${email}: ${msg}`)
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
