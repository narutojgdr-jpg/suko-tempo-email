import { NextResponse } from "next/server"
import { query } from "@/lib/db"

const SYNC_KEY = "suko-gl-sync-2026"

async function ensureTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS public.gologin_accounts (
      id BIGSERIAL PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL DEFAULT '',
      cookies TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `)
}

function checkKey(req: Request) {
  const url = new URL(req.url)
  const key = url.searchParams.get("key") || req.headers.get("x-sync-key") || ""
  return key === SYNC_KEY
}

function extractCookies(block: string): string {
  const jsonStart = block.indexOf("[")
  if (jsonStart < 0) return ""
  let candidate = block.slice(jsonStart).trim()
  const lastBracket = candidate.lastIndexOf("]")
  if (lastBracket > 0) {
    candidate = candidate.slice(0, lastBracket + 1)
  }
  try {
    const parsed = JSON.parse(candidate)
    if (Array.isArray(parsed)) return JSON.stringify(parsed)
  } catch {}
  return ""
}

export async function GET(req: Request) {
  if (!checkKey(req)) return NextResponse.json({ error: "no" }, { status: 401 })
  try {
    await ensureTable()
    const rows = await query<{
      email: string
      password: string
      cookies: string
    }>(
      `SELECT email, password, cookies FROM public.gologin_accounts ORDER BY created_at DESC`,
    )
    const items = rows.map((r) => ({
      email: r.email,
      pass: r.password,
      cookies: r.cookies,
    }))
    return NextResponse.json({ items, count: items.length })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "fail" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  if (!checkKey(req)) return NextResponse.json({ error: "no" }, { status: 401 })
  try {
    await ensureTable()
    const body = await req.json()

    if (body.raw) {
      const blocks = String(body.raw).split(/===\s*/).map((b: string) => b.trim()).filter(Boolean)
      let added = 0
      for (const block of blocks) {
        const lines = block.split(/\r?\n/)
        const header = (lines[0] || "").replace(/===/g, "").trim()
        if (!header.includes("@")) continue
        let email = ""
        let password = ""
        if (header.includes("|")) {
          const parts = header.split("|").map((p: string) => p.trim())
          email = parts[0].toLowerCase()
          password = parts[1] || ""
        } else {
          email = header.toLowerCase()
        }
        if (!email.includes("@")) continue
        const cookies = extractCookies(block)
        await query(
          `INSERT INTO public.gologin_accounts (email, password, cookies, notes)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (email) DO UPDATE SET
             password = EXCLUDED.password,
             cookies = EXCLUDED.cookies,
             notes = EXCLUDED.notes`,
          [email, password, cookies, ""],
        )
        added++
      }
      return NextResponse.json({ ok: true, added })
    }

    if (body.email) {
      const email = String(body.email).trim().toLowerCase()
      if (!email.includes("@")) return NextResponse.json({ ok: false, error: "email" })
      let cookies = body.cookies || ""
      if (typeof cookies !== "string") {
        try { cookies = JSON.stringify(cookies) } catch { cookies = "" }
      }
      await query(
        `INSERT INTO public.gologin_accounts (email, password, cookies, notes)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (email) DO UPDATE SET
           password = EXCLUDED.password,
           cookies = EXCLUDED.cookies,
           notes = EXCLUDED.notes`,
        [email, body.pass || body.password || "", cookies, body.notes || ""],
      )
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ ok: false })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "fail" }, { status: 500 })
  }
}
