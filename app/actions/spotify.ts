"use server"

import { query } from "@/lib/db"
import { requireAdmin } from "@/lib/admin"
import { revalidatePath } from "next/cache"

export type SpotifyAccount = {
  id: number
  email: string
  password: string
  notes: string
  domain: string
  createdAt: string
}

/** Extrai o dominio registravel. Ex: user@india123.tskulzinho.shop -> tskulzinho.shop */
function extractDomain(email: string): string {
  const at = email.lastIndexOf("@")
  if (at < 1) return ""
  const host = email.slice(at + 1).toLowerCase().trim()
  const parts = host.split(".").filter(Boolean)
  if (parts.length <= 2) return host
  return parts.slice(-2).join(".")
}

async function ensureTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS public.spotify_accounts (
      id BIGSERIAL PRIMARY KEY,
      email TEXT NOT NULL,
      password TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      domain TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `)
  await query(
    `CREATE INDEX IF NOT EXISTS idx_spotify_accounts_domain ON public.spotify_accounts (domain)`,
  )
}

export async function listSpotifyAccounts(): Promise<SpotifyAccount[]> {
  await requireAdmin()
  await ensureTable()
  const rows = await query<{
    id: string
    email: string
    password: string
    notes: string
    domain: string
    created_at: string
  }>(
    `SELECT id, email, password, notes, domain, created_at
     FROM public.spotify_accounts
     ORDER BY domain ASC, created_at DESC`,
  )
  return rows.map((r) => ({
    id: Number(r.id),
    email: r.email,
    password: r.password,
    notes: r.notes,
    domain: r.domain || extractDomain(r.email),
    createdAt: r.created_at,
  }))
}

export async function addSpotifyAccount(input: {
  email: string
  password: string
  notes?: string
}): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin()
  const email = input.email.trim().toLowerCase()
  if (!email.includes("@") || email.length < 5) {
    return { ok: false, error: "Email invalido" }
  }
  await ensureTable()
  const domain = extractDomain(email)
  await query(
    `INSERT INTO public.spotify_accounts (email, password, notes, domain)
     VALUES ($1, $2, $3, $4)`,
    [email, input.password, (input.notes ?? "").trim(), domain],
  )
  revalidatePath("/admin")
  return { ok: true }
}

/** Importa linhas no formato email:senha:nome ou email|senha|nome */
export async function importSpotifyAccounts(raw: string): Promise<{
  ok: boolean
  added: number
  skipped: number
  error?: string
}> {
  await requireAdmin()
  await ensureTable()
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  if (lines.length === 0) return { ok: false, added: 0, skipped: 0, error: "Nada pra importar" }

  const existing = await query<{ email: string }>(
    `SELECT lower(email) AS email FROM public.spotify_accounts`,
  )
  const have = new Set(existing.map((r) => r.email))

  let added = 0
  let skipped = 0
  for (const line of lines) {
    const sep = line.includes("|") && !line.includes(":") ? "|" : ":"
    const parts = line.split(sep)
    if (parts.length < 2) {
      skipped++
      continue
    }
    const email = parts[0].trim().toLowerCase()
    const password = parts[1].trim()
    const notes = parts.slice(2).join(sep).trim()
    if (!email.includes("@") || !password || have.has(email)) {
      skipped++
      continue
    }
    const domain = extractDomain(email)
    await query(
      `INSERT INTO public.spotify_accounts (email, password, notes, domain)
       VALUES ($1, $2, $3, $4)`,
      [email, password, notes, domain],
    )
    have.add(email)
    added++
  }
  revalidatePath("/admin")
  return { ok: true, added, skipped }
}

export async function deleteSpotifyAccount(id: number): Promise<{ ok: boolean }> {
  await requireAdmin()
  await ensureTable()
  await query(`DELETE FROM public.spotify_accounts WHERE id = $1`, [id])
  revalidatePath("/admin")
  return { ok: true }
}
