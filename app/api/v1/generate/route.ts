import { type NextRequest, NextResponse } from "next/server"
import { checkApiKey } from "@/lib/api-auth"
import { buildOtherAddress, OTHER_DOMAINS } from "@/lib/email-config"

export const runtime = "nodejs"

/**
 * Gera um endereco aleatorio em um dos dominios proprios.
 *
 * GET /api/v1/generate            -> dominio aleatorio
 * GET /api/v1/generate?domain=x   -> forca um dominio especifico (precisa existir)
 * Header: Authorization: Bearer <chave>   (ou x-api-key: <chave>)
 *
 * Resposta 200: { "email": "abc123xyz@sukohub.com", "domain": "sukohub.com" }
 *
 * Dica: depois de gerar, leia a caixa em /api/v1/inbox?email=<endereco>
 * ou pegue o codigo em /api/v1/code?email=<endereco>.
 */
export async function GET(req: NextRequest) {
  const auth = checkApiKey(req)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { searchParams } = new URL(req.url)
  const domain = searchParams.get("domain")?.trim().toLowerCase()

  if (domain && !OTHER_DOMAINS.includes(domain)) {
    return NextResponse.json(
      {
        error: `Dominio '${domain}' nao disponivel. Use GET /api/v1/domains para ver os validos.`,
      },
      { status: 400 },
    )
  }

  const email = buildOtherAddress(domain)
  return NextResponse.json({ email, domain: email.split("@")[1] })
}
