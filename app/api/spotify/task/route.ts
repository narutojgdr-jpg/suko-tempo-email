import { NextResponse } from "next/server"
import { query } from "@/lib/db"
import { updateSheetStatus } from "@/lib/sheets"

async function ensureTasks() {
  await query(`
    CREATE TABLE IF NOT EXISTS public.spotify_tasks (
      id BIGSERIAL PRIMARY KEY,
      account_id BIGINT NOT NULL,
      cookie TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      result TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `)
}

export async function GET() {
  await ensureTasks()
  const rows = await query<{
    id: string
    account_id: string
    cookie: string
  }>(
    `UPDATE public.spotify_tasks
     SET status = 'running', updated_at = now()
     WHERE id = (
       SELECT id FROM public.spotify_tasks
       WHERE status = 'pending'
       ORDER BY created_at ASC
       LIMIT 1
       FOR UPDATE SKIP LOCKED
     )
     RETURNING id, account_id, cookie`,
  )
  if (!rows[0]) return NextResponse.json({ task: null })
  return NextResponse.json({
    task: {
      id: Number(rows[0].id),
      accountId: Number(rows[0].account_id),
      cookie: rows[0].cookie,
    },
  })
}

export async function POST(req: Request) {
  await ensureTasks()
  const body = await req.json().catch(() => ({}))
  const items = Array.isArray(body) ? body : [body]
  const valid = items.filter((x: any) => x?.accountId && x?.cookie)
  if (valid.length === 0) {
    return NextResponse.json({ ok: false, error: "nada valido" }, { status: 400 })
  }
  for (const item of valid) {
    await query(
      `INSERT INTO public.spotify_tasks (account_id, cookie) VALUES ($1, $2)`,
      [item.accountId, item.cookie],
    )
  }
  return NextResponse.json({ ok: true, created: valid.length })
}

export async function PUT(req: Request) {
  await ensureTasks()
  const body = await req.json().catch(() => ({}))
  const { taskId, result } = body as { taskId?: number; result?: string }
  if (!taskId || !result) {
    return NextResponse.json({ ok: false, error: "faltou taskId ou result" }, { status: 400 })
  }
  await query(
    `UPDATE public.spotify_tasks SET status = 'done', result = $2, updated_at = now() WHERE id = $1`,
    [taskId, result],
  )
  const task = await query<{ account_id: string }>(
    `SELECT account_id FROM public.spotify_tasks WHERE id = $1`,
    [taskId],
  )
  if (task[0]) {
    const accountId = Number(task[0].account_id)
    await query(
      `UPDATE public.spotify_accounts SET status = $2, last_checked = now() WHERE id = $1`,
      [accountId, result],
    )
    const acc = await query<{ gmail: string; email: string }>(
      `SELECT gmail, email FROM public.spotify_accounts WHERE id = $1`,
      [accountId],
    )
    const gmail = acc[0]?.gmail || ""
    const email = acc[0]?.email || ""
    const toMatch = gmail.includes("@") ? gmail : email.includes("@") ? email : ""
    if (toMatch) {
      await updateSheetStatus(toMatch, result)
    } else {
      console.log("[sheets] sem email valido pra conta", accountId)
    }
  }
  return NextResponse.json({ ok: true })
}

export async function DELETE() {
  await ensureTasks()
  const result = await query<{ count: string }>(
    `WITH deleted AS (
       DELETE FROM public.spotify_tasks
       WHERE status IN ('pending', 'running')
       RETURNING id
     )
     SELECT COUNT(*)::text AS count FROM deleted`,
  )
  const deleted = Number(result[0]?.count || 0)
  return NextResponse.json({ ok: true, deleted })
}
