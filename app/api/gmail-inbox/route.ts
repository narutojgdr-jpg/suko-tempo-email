import { type NextRequest, NextResponse } from "next/server"
import { fetchImapInbox, ImapInboxError } from "@/lib/imap-inbox"

export const runtime = "nodejs"
export const maxDuration = 30

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const email = searchParams.get("email")?.trim().toLowerCase()

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Email invalido" }, { status: 400 })
  }

  try {
    const emails = await fetchImapInbox(email)
    return NextResponse.json(emails)
  } catch (err) {
    if (err instanceof ImapInboxError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    const msg = err instanceof Error ? err.message : "Erro desconhecido"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
