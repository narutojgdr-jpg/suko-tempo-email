import { type NextRequest, NextResponse } from "next/server"
import { checkApiKey } from "@/lib/api-auth"
import { OTHER_DOMAINS } from "@/lib/email-config"
import { GMAIL_DOMAINS, OUTLOOK_DOMAINS } from "@/lib/inbox-routing"

export const runtime = "nodejs"

/**
 * Lista os dominios suportados pela API.
 *
 * GET /api/v1/domains
 * Header: Authorization: Bearer <chave>   (ou x-api-key: <chave>)
 *
 * - readable: dominios cuja caixa pode ser LIDA (gmail/outlook via IMAP).
 * - generatable: dominios proprios em que da para GERAR enderecos novos.
 */
export async function GET(req: NextRequest) {
  const auth = checkApiKey(req)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  return NextResponse.json({
    readable: {
      gmail: GMAIL_DOMAINS,
      outlook: OUTLOOK_DOMAINS,
    },
    generatable: OTHER_DOMAINS,
  })
}
