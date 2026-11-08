import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { listGoLoginAccounts, upsertGoLoginAccount, importGoLoginFromText } from "@/app/actions/gologin"

export async function GET() {
  try {
    await requireAdmin()
    const accounts = await listGoLoginAccounts()
    const items = accounts.map((a) => ({
      id: a.id,
      email: a.email,
      pass: a.password,
      cookies: a.cookies,
      notes: a.notes,
    }))
    return NextResponse.json({ items, count: items.length })
  } catch (err: any) {
    if (err?.message?.includes("admin") || err?.status === 401) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    return NextResponse.json({ error: "Failed to load" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin()
    const body = await request.json()

    if (body.raw) {
      const result = await importGoLoginFromText(body.raw)
      return NextResponse.json(result)
    }

    if (body.email) {
      const result = await upsertGoLoginAccount({
        email: body.email,
        password: body.pass || body.password,
        cookies: body.cookies,
        notes: body.notes,
      })
      return NextResponse.json(result)
    }

    return NextResponse.json({ ok: false, error: "nada pra salvar" })
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
