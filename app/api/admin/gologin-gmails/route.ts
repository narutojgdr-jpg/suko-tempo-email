import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { listGmails } from "@/app/actions/admin"

export async function GET(request: Request) {
  try {
    await requireAdmin()

    const gmails = await listGmails()

    const items = gmails.map((g) => ({
      email: g.address,
      pass: g.note || "",
      status: g.status,
      kind: g.kind,
      id: g.id,
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
    return NextResponse.json({ ok: true, received: body })
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
