import { type NextRequest, NextResponse } from "next/server"
import { checkApiKey } from "@/lib/api-auth"
import { fetchPublicInbox } from "@/lib/public-inbox"
import { extractVerificationCode } from "@/lib/verification-code"
import { isInboxBlocked } from "@/lib/blocklist-store"

export const runtime = "nodejs"
export const maxDuration = 30

/**
 * Retorna o codigo de verificacao/OTP mais recente de uma caixa.
 *
 * GET /api/v1/code?email=<endereco>
 * Header: Authorization: Bearer <chave>   (ou x-api-key: <chave>)
 *
 * Resposta 200 (achou):
 * {
 *   "email": "fulano@gmail.com",
 *   "found": true,
 *   "code": "123456",
 *   "from": "no-reply@google.com",
 *   "subject": "Seu codigo de verificacao",
 *   "date": "2026-06-22T18:00:00.000Z"
 * }
 *
 * Resposta 200 (nada encontrado): { "email", "found": false, "code": null }
 */
export async function GET(req: NextRequest) {
  const auth = checkApiKey(req)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { searchParams } = new URL(req.url)
  // "+" vira espaco em querystring; revertemos para suportar aliases.
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
    const { emails } = await fetchPublicInbox(email)
    // emails ja vem ordenado do mais recente para o mais antigo.
    for (const e of emails) {
      const code = extractVerificationCode(e.subject, e.body)
      if (code) {
        return NextResponse.json({
          email,
          found: true,
          code,
          from: e.from,
          subject: e.subject,
          date: e.date,
        })
      }
    }
    return NextResponse.json({ email, found: false, code: null })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido"
    console.log(`[v0] api/v1/code: falha para ${email}: ${msg}`)
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
