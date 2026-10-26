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

function looksLikeCookie(s: string): boolean {
  return s.length > 40 && !s.includes(" ") && !s.includes("@")
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
    let email = (parts[0] || "").toLowerCase()
    let password = parts[1] || ""
    let gmail = ""
    let notes = ""
    let cookie = ""

    if (parts.length >= 5) {
      gmail = parts[2] || ""
      notes = parts[3] || ""
      cookie = parts[4] || ""
    } else if (parts.length === 4) {
      const p2 = parts[2] || ""
      const p3 = parts[3] || ""
      if (looksLikeCookie(p3)) {
        gmail = p2
        cookie = p3
      } else if (looksLikeCookie(p2)) {
        cookie = p2
        notes = p3
      } else {
        gmail = p2
        notes = p3
      }
    } else if (parts.length === 3) {
      const last = parts[2] || ""
      if (looksLikeCookie(last)) {
        cookie = last
      } else {
        gmail = last
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

export async function getSpotifyAuthorizeUrl(accountId?: number): Promise<string> {
  await requireAdmin()
  const state = accountId ? String(accountId) : ""
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: "code",
    redirect_uri: REDIRECT,
    scope: SCOPE,
    state,
  })
  return `https://accounts.spotify.com/authorize?${params.toString()}`
}

export async function saveSpotifyToken(accountId: number, refreshToken: string) {
  await requireAdmin()
  await ensureTable()
  await query(
    `UPDATE public.spotify_accounts SET refresh_token = $2 WHERE id = $1`,
    [accountId, refreshToken],
  )
  revalidatePath("/admin")
  return { ok: true }
}

export async function upsertSpotifyByEmail(email: string, refreshToken: string, product?: string) {
  await requireAdmin()
  await ensureTable()
  const clean = email.trim().toLowerCase()
  if (!clean.includes("@")) return { ok: false, error: "email invalido" }
  const domain = extractDomain(clean)
  const status = product === "premium" ? "premium" : product === "free" ? "free" : ""
  await query(
    `INSERT INTO public.spotify_accounts (email, password, notes, domain, refresh_token, status)
     VALUES ($1, '', '(auto)', $2, $3, $4)
     ON CONFLICT (email) DO UPDATE SET
       refresh_token = EXCLUDED.refresh_token,
       status = CASE WHEN EXCLUDED.status != '' THEN EXCLUDED.status ELSE public.spotify_accounts.status END,
       domain = EXCLUDED.domain`,
    [clean, domain, refreshToken, status],
  )
  revalidatePath("/admin")
  return { ok: true }
}

export async function checkSpotifyAccount(accountId: number): Promise<{
  ok: boolean
  status?: string
  displayName?: string
  error?: string
}> {
  await requireAdmin()
  await ensureTable()
  const rows = await query<{ refresh_token: string; notes: string }>(
    `SELECT refresh_token, notes FROM public.spotify_accounts WHERE id = $1`,
    [accountId],
  )
  const refresh = rows[0]?.refresh_token
  if (!refresh) return { ok: false, error: "sem token" }

  const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: "Basic " + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64"),
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refresh,
    }),
  })
  const tokenData = (await tokenRes.json()) as { access_token?: string; refresh_token?: string }
  const access = tokenData.access_token
  if (!access) {
    await query(`UPDATE public.spotify_accounts SET status = 'morta', last_checked = now() WHERE id = $1`, [accountId])
    return { ok: true, status: "morta" }
  }

  if (tokenData.refresh_token) {
    await query(`UPDATE public.spotify_accounts SET refresh_token = $2 WHERE id = $1`, [accountId, tokenData.refresh_token])
  }

  const meRes = await fetch("https://api.spotify.com/v1/me", {
    headers: { Authorization: `Bearer ${access}` },
  })

  if (!meRes.ok) {
    await query(`UPDATE public.spotify_accounts SET status = 'morta', last_checked = now() WHERE id = $1`, [accountId])
    return { ok: true, status: "morta" }
  }

  const me = (await meRes.json()) as { product?: string; display_name?: string }
  const product = me.product || "free"
  const status = product === "premium" ? "premium" : "free"
  const displayName = me.display_name || ""

  const currentNotes = rows[0]?.notes || ""
  const notes = currentNotes || displayName

  await query(
    `UPDATE public.spotify_accounts SET status = $2, notes = $3, last_checked = now() WHERE id = $1`,
    [accountId, status, notes],
  )
  return { ok: true, status, displayName }
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
