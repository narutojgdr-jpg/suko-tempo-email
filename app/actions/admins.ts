"use server"

import { query } from "@/lib/db"
import { requireMainAdmin } from "@/lib/admin"
import { revalidatePath } from "next/cache"

export type ExtraAdmin = {
  email: string
  createdAt: string
}

async function ensureTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS public.extra_admins (
      email TEXT PRIMARY KEY,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `)
}

export async function listExtraAdmins(): Promise<ExtraAdmin[]> {
  await requireMainAdmin()
  await ensureTable()
  const rows = await query<{ email: string; created_at: string }>(
    `SELECT email, created_at FROM public.extra_admins ORDER BY created_at DESC`,
  )
  return rows.map((r) => ({ email: r.email, createdAt: r.created_at }))
}

export async function addExtraAdmin(email: string): Promise<{ ok: boolean; error?: string }> {
  await requireMainAdmin()
  await ensureTable()
  const clean = email.trim().toLowerCase()
  if (!clean.includes("@")) return { ok: false, error: "Email invalido" }
  await query(
    `INSERT INTO public.extra_admins (email) VALUES ($1) ON CONFLICT (email) DO NOTHING`,
    [clean],
  )
  revalidatePath("/admin")
  return { ok: true }
}

export async function removeExtraAdmin(email: string): Promise<{ ok: boolean }> {
  await requireMainAdmin()
  await ensureTable()
  await query(`DELETE FROM public.extra_admins WHERE email = $1`, [email.toLowerCase()])
  revalidatePath("/admin")
  return { ok: true }
}
