import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"

const SECRET = process.env.PRICE_SCANNER_SECRET || "suko-scanner-2026"

export async function POST(req: NextRequest) {
  const auth = req.headers.get("x-scanner-secret")
  if (auth !== SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const body = await req.json()
  const { keyword, results } = body

  if (!keyword || !Array.isArray(results)) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 })
  }

  await query(`DELETE FROM public.price_scans WHERE keyword = $1`, [keyword])

  let saved = 0
  for (const r of results) {
    if (!r.username) continue
    const label = r.label || r.username
    try {
      await query(
        `INSERT INTO public.price_scans (keyword, username, label, price, out_of_stock, last_restock, snippet, scanned_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, now())`,
        [
          keyword,
          r.username,
          label,
          r.price ?? null,
          r.out_of_stock ?? false,
          r.last_restock ?? null,
          r.snippet ?? null,
        ]
      )
      saved++
    } catch {
      // ignore individual errors
    }
  }

  return NextResponse.json({ ok: true, saved })
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const keyword = searchParams.get("keyword") || "gemini"

  const rows = await query(
    `SELECT username, label, price, out_of_stock, last_restock, snippet, scanned_at
     FROM public.price_scans
     WHERE keyword = $1 AND price IS NOT NULL
     ORDER BY price ASC`,
    [keyword]
  )

  return NextResponse.json({ keyword, results: rows })
}
