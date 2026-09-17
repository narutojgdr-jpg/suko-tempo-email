import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

// Retorna o horario do servidor (NTP-sincronizado na Vercel) para que o
// gerador 2FA no cliente nao dependa do relogio do PC do usuario, que pode
// estar adiantado/atrasado e fazer os codigos TOTP serem recusados.
export async function GET() {
  return NextResponse.json(
    { now: Date.now() },
    { headers: { "cache-control": "no-store, max-age=0" } },
  )
}
