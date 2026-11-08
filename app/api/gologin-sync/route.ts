import { NextResponse } from "next/server"
import { listGoLoginAccounts, upsertGoLoginAccount, importGoLoginFromText } from "@/app/actions/gologin"

// Chave fixa pra o app local poder sincronizar sem login
const SYNC_KEY = "suko-gl-sync-2026"

function checkKey(req: Request) {
  const url = new URL(req.url)
  const key = url.searchParams.get("key") || req.headers.get("x-sync-key") || ""
  return key === SYNC_KEY
}

export async function GET(req: Request) {
  if (!checkKey(req)) return NextResponse.json({ error: "no" }, { status: 401 })
  try {
    const accounts = await listGoLoginAccounts()
    const items = accounts.map((a) => ({
      email: a.email,
      pass: a.password,
      cookies: a.cookies,
    }))
    return NextResponse.json({ items, count: items.length })
  } catch {
    return NextResponse.json({ error: "fail" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  if (!checkKey(req)) return NextResponse.json({ error: "no" }, { status: 401 })
  try {
    const body = await req.json()
    if (body.raw) {
      const result = await importGoLoginFromText(body.raw)
      return NextResponse.json(result)
    }
    if (body.email) {
      const result = await upsertGoLoginAccount({
        email: body.email,
        password: body.pass || body.password,
        cookies: body.cookies,
      })
      return NextResponse.json(result)
    }
    return NextResponse.json({ ok: false })
  } catch {
    return NextResponse.json({ error: "fail" }, { status: 500 })
  }
}
