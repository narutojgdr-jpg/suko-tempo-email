"use server"

import { query } from "@/lib/db"
import { requireAdmin } from "@/lib/admin"
import { revalidatePath } from "next/cache"

export type SpotifyAccount = {
  id: number
  email: string
  password: string
  gmail: string
  notes: string
  cookie: string
  domain: string
  createdAt: string
  status: string
  hasToken: boolean
  lastChecked: string | null
}

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
  await query(`ALTER TABLE public.spotify_accounts ADD COLUMN IF NOT EXISTS gmail TEXT NOT NULL DEFAULT ''`)
  await query(`ALTER TABLE public.spotify_accounts ADD COLUMN IF NOT EXISTS refresh_token TEXT NOT NULL DEFAULT ''`)
  await query(`ALTER TABLE public.spotify_accounts ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT ''`)
  await query(`ALTER TABLE public.spotify_accounts ADD COLUMN IF NOT EXISTS last_checked TIMESTAMPTZ`)
  await query(`ALTER TABLE public.spotify_accounts ADD COLUMN IF NOT EXISTS cookie TEXT NOT NULL DEFAULT ''`)
  await query(`CREATE INDEX IF NOT EXISTS idx_spotify_accounts_domain ON public.spotify_accounts (domain)`)
}

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || ""
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || ""
const REDIRECT = "https://tempmailsuko.shop/api/spotify/callback"
const SCOPE = "user-read-email user-read-private"

export async function listSpotifyAccounts(): Promise<SpotifyAccount[]> {
  await requireAdmin()
  await ensureTable()
  const rows = await query<{
    id: string
    email: string
    password: string
    gmail: string
    notes: string
    cookie: string
    domain: string
    created_at: string
    status: string
    refresh_token: string
    last_checked: string | null
  }>(
    `SELECT id, email, password, gmail, notes, cookie, domain, created_at, status, refresh_token, last_checked
     FROM public.spotify_accounts
     ORDER BY domain ASC, created_at DESC`,
  )
  return rows.map((r) => ({
    id: Number(r.id),
    email: r.email,
    password: r.password,
    gmail: r.gmail || "",
    notes: r.notes,
    cookie: r.cookie || "",
    domain: r.domain || extractDomain(r.email),
    createdAt: r.created_at,
    status: r.status || "",
    hasToken: !!r.refresh_token,
    lastChecked: r.last_checked,
  }))
}

export async function addSpotifyAccount(input: {
  email: string
  password: string
  gmail?: string
  notes?: string
  cookie?: string
}): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin()
  const email = input.email.trim().toLowerCase()
  if (!email.includes("@") || email.length < 5) {
    return { ok: false, error: "Email invalido" }
  }
  await ensureTable()
  const domain = extractDomain(email)
  await query(
    `INSERT INTO public.spotify_accounts (email, password, gmail, notes, cookie, domain)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT DO NOTHING`,
    [email, input.password || "", input.gmail || "", input.notes || "", input.cookie || "", domain],
  )
  revalidatePath("/admin")
  return { ok: true }
}

export async function updateSpotifyAccount(
  id: number,
  input: { email: string; password: string; gmail: string; notes: string; cookie: string },
): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin()
  await ensureTable()
  const email = input.email.trim().toLowerCase()
  if (!email.includes("@")) return { ok: false, error: "Email invalido" }
  const domain = extractDomain(email)
  await query(
    `UPDATE public.spotify_accounts SET email = $2, password = $3, gmail = $4, notes = $5, cookie = $6, domain = $7 WHERE id = $1`,
    [id, email, input.password || "", input.gmail || "", input.notes || "", input.cookie || "", domain],
  )
  revalidatePath("/admin")
  return { ok: true }
}

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

  const existing = await query<{ email: string }>(`SELECT lower(email) AS email FROM public.spotify_accounts`)
  const have = new Set(existing.map((r) => r.email))

  let added = 0
  let skipped = 0
  for (const line of lines) {
    const parts = line.split("|").map((p) => p.trim())
    const email = (parts[0] || "").toLowerCase()
    const password = parts[1] || ""
    const gmail = parts[2] || ""
    let notes = ""
    let cookie = ""
    if (parts.length >= 5) {
      notes = parts[3] || ""
      cookie = parts[4] || ""
    } else if (parts.length === 4) {
      const last = parts[3] || ""
      if (last.length > 40 && !last.includes(" ")) {
        cookie = last
      } else {
        notes = last
      }
    }
    if (!email.includes("@")) { skipped++; continue }
    if (have.has(email)) { skipped++; continue }
    const domain = extractDomain(email)
    await query(
      `INSERT INTO public.spotify_accounts (email, password, gmail, notes, cookie, domain)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [email, password, gmail, notes || "(sem nome)", cookie, domain],
    )
    have.add(email)
    added++
  }
  revalidatePath("/admin")
  return { ok: true, added, skipped }
}

export async function deleteSpotifyAccount(id: number): Promise<{ ok: boolean }> {
  await requireAdmin()
  await query(`DELETE FROM public.spotify_accounts WHERE id = $1`, [id])
  revalidatePath("/admin")
  return { ok: true }
}

export async function setSpotifyStatus(ids: number[], status: string): Promise<{ ok: boolean; updated: number }> {
  await requireAdmin()
  await ensureTable()
  if (ids.length === 0) return { ok: true, updated: 0 }
  const placeholders = ids.map((_, i) => `$${i + 2}`).join(", ")
  const result = await query<{ count: string }>(
    `UPDATE public.spotify_accounts SET status = $1 WHERE id IN (${placeholders}) RETURNING id`,
    [status, ...ids],
  )
  revalidatePath("/admin")
  return { ok: true, updated: result.length }
}
