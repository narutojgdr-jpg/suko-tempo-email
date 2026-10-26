import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"

export async function GET() {
  const rows = await query(
    `SELECT id, keyword, name, icon, color, created_at
     FROM public.price_products
     ORDER BY name ASC`
  )
  return NextResponse.json({ products: rows })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { keyword, name, icon, color } = body

  if (!keyword || !name) {
    return NextResponse.json({ error: "keyword and name required" }, { status: 400 })
  }

  const rows = await query(
    `INSERT INTO public.price_products (keyword, name, icon, color)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (keyword) DO UPDATE SET
       name = EXCLUDED.name,
       icon = EXCLUDED.icon,
       color = EXCLUDED.color
     RETURNING *`,
    [keyword.toLowerCase(), name, icon || "DollarSign", color || "#7c5cbf"]
  )

  return NextResponse.json({ product: rows[0] })
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get("id")

  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 })
  }

  await query(`DELETE FROM public.price_products WHERE id = $1`, [id])
  return NextResponse.json({ ok: true })
}
