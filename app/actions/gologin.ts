"use server"

import { query } from "@/lib/db"
import { requireAdmin } from "@/lib/admin"
import { revalidatePath } from "next/cache"

export type GoLoginAccount = {
  id: number
  email: string
  password: string
  cookies: string
  notes: string
  createdAt: string
}

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

export async function listGoLoginAccounts(): Promise<GoLoginAccount[]> {
  await requireAdmin()
  await ensureTable()
  const rows = await query<{
    id: string
    email: string
    password: string
    cookies: string
    notes: string
    created_at: string
  }>(
    `SELECT id, email, password, cookies, notes, created_at
     FROM public.gologin_accounts
     ORDER BY created_at DESC`,
  )
  return rows.map((r) => ({
    id: Number(r.id),
    email: r.email,
    password: r.password,
    cookies: r.cookies,
    notes: r.notes,
    createdAt: r.created_at,
  }))
}

export async function upsertGoLoginAccount(input: {
  email: string
  password?: string
  cookies?: string
  notes?: string
}): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin()
  await ensureTable()
  const email = input.email.trim().toLowerCase()
  if (!email.includes("@")) return { ok: false, error: "Email invalido" }

  await query(
    `INSERT INTO public.gologin_accounts (email, password, cookies, notes)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (email) DO UPDATE SET
       password = EXCLUDED.password,
       cookies = EXCLUDED.cookies,
       notes = EXCLUDED.notes`,
    [email, input.password || "", input.cookies || "", input.notes || ""],
  )
  revalidatePath("/admin")
  return { ok: true }
}

export async function deleteGoLoginAccounts(ids: number[]): Promise<{ ok: boolean; deleted: number }> {
  await requireAdmin()
  await ensureTable()
  if (ids.length === 0) return { ok: true, deleted: 0 }
  const res = await query<{ id: string }>(
    `DELETE FROM public.gologin_accounts WHERE id = ANY($1::bigint[]) RETURNING id`,
    [ids],
  )
  revalidatePath("/admin")
  return { ok: true, deleted: res.length }
}

export async function importGoLoginFromText(raw: string): Promise<{
  ok: boolean
  added: number
  skipped: number
  error?: string
}> {
  await requireAdmin()
  await ensureTable()
  // Formato esperado do HTML: === email ===\nSenha: ...\nCookies JSON:\n[...]
  const blocks = raw.split(/===\s*/).map((b) => b.trim()).filter(Boolean)
  let added = 0
  let skipped = 0

  for (const block of blocks) {
    const lines = block.split(/\r?\n/).map((l) => l.trim())
    const emailLine = lines[0] || ""
    const email = emailLine.replace(/===/g, "").trim().toLowerCase()
    if (!email.includes("@")) { skipped++; continue }

    let password = ""
    let cookies = ""
    let notes = ""

    for (const line of lines.slice(1)) {
      if (line.toLowerCase().startsWith("senha:")) {
        password = line.slice(6).trim()
      } else if (line.toLowerCase().startsWith("cookies json:")) {
        // pega o resto como cookies
      }
    }

    const cookieStart = block.toLowerCase().indexOf("cookies json:")
    if (cookieStart >= 0) {
      cookies = block.slice(cookieStart + 13).trim()
    }

    await query(
      `INSERT INTO public.gologin_accounts (email, password, cookies, notes)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO UPDATE SET
         password = EXCLUDED.password,
         cookies = EXCLUDED.cookies,
         notes = EXCLUDED.notes`,
      [email, password, cookies, notes],
    )
    added++
  }

  revalidatePath("/admin")
  return { ok: true, added, skipped }
}
