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
    domain: string
    created_at: string
    status: string
    refresh_token: string
    last_checked: string | null
  }>(
    `SELECT id, email, password, gmail, notes, domain, created_at, status, refresh_token, last_checked
     FROM public.spotify_accounts
     ORDER BY domain ASC, created_at DESC`,
  )
  return rows.map((r) => ({
    id: Number(r.id),
    email: r.email,
    password: r.password,
    gmail: r.gmail || "",
    notes: r.notes,
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
}): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin()
  const email = input.email.trim().toLowerCase()
  if (!email.includes("@") || email.length < 5) {
    return { ok: false, error: "Email invalido" }
  }
  await ensureTable()
  const domain = extractDomain(email)
  await query(
    `INSERT INTO public.spotify_accounts (email, password, gmail, notes, domain)
     VALUES ($1, $2, $3, $4, $5)`,
    [email, input.password || "", (input.gmail ?? "").trim(), (input.notes ?? "").trim(), domain],
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
    const notes = parts.slice(3).join(" | ") || ""
    if (!email.includes("@") || have.has(email)) {
      skipped++
      continue
    }
    const domain = extractDomain(email)
    await query(
      `INSERT INTO public.spotify_accounts (email, password, gmail, notes, domain)
       VALUES ($1, $2, $3, $4, $5)`,
      [email, password, gmail, notes, domain],
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

/** URL fixa pra autorizar. Cria a conta pelo email atual do Spotify. */
export async function getSpotifyAuthorizeUrl(accountId?: number): Promise<string> {
  await requireAdmin()
  if (!CLIENT_ID) return ""
  const params = new URLSearchParams({
    response_type: "code",
    client_id: CLIENT_ID,
    scope: SCOPE,
    redirect_uri: REDIRECT,
    show_dialog: "true",
  })
  if (accountId) params.set("state", String(accountId))
  return `https://accounts.spotify.com/authorize?${params.toString()}`
}

/** Salva token numa conta que ja existe. */
export async function saveSpotifyToken(accountId: number, refreshToken: string) {
  await ensureTable()
  await query(
    `UPDATE public.spotify_accounts SET refresh_token = $2, status = 'autorizada', last_checked = now() WHERE id = $1`,
    [accountId, refreshToken],
  )
  revalidatePath("/admin")
}

/** Cria ou atualiza conta pelo email atual + token. Usado no callback sem state. */
export async function upsertSpotifyByEmail(email: string, refreshToken: string, product?: string) {
  await ensureTable()
  const clean = email.trim().toLowerCase()
  if (!clean.includes("@")) return
  const domain = extractDomain(clean)
  const status = product === "premium" ? "premium" : product ? "free" : "autorizada"
  const existing = await query<{ id: string }>(
    `SELECT id FROM public.spotify_accounts WHERE lower(email) = $1 LIMIT 1`,
    [clean],
  )
  if (existing[0]) {
    await query(
      `UPDATE public.spotify_accounts SET refresh_token = $2, status = $3, last_checked = now() WHERE id = $1`,
      [Number(existing[0].id), refreshToken, status],
    )
  } else {
    await query(
      `INSERT INTO public.spotify_accounts (email, password, gmail, notes, domain, refresh_token, status, last_checked)
       VALUES ($1, '', $1, '', $2, $3, $4, now())`,
      [clean, domain, refreshToken, status],
    )
  }
  revalidatePath("/admin")
}

/** Checa uma conta usando o refresh token. */
export async function checkSpotifyAccount(accountId: number): Promise<{
  ok: boolean
  status?: string
  error?: string
}> {
  await requireAdmin()
  await ensureTable()
  if (!CLIENT_ID || !CLIENT_SECRET) return { ok: false, error: "App Spotify nao configurado" }

  const rows = await query<{ refresh_token: string }>(
    `SELECT refresh_token FROM public.spotify_accounts WHERE id = $1`,
    [accountId],
  )
  const token = rows[0]?.refresh_token
  if (!token) return { ok: false, error: "Conta nao autorizada" }

  const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: token,
    }),
  })

  if (!tokenRes.ok) {
    await query(`UPDATE public.spotify_accounts SET status = 'morta', last_checked = now() WHERE id = $1`, [accountId])
    revalidatePath("/admin")
    return { ok: true, status: "morta" }
  }

  const tokenData = (await tokenRes.json()) as { access_token?: string; refresh_token?: string }
  const access = tokenData.access_token
  if (!access) {
    await query(`UPDATE public.spotify_accounts SET status = 'morta', last_checked = now() WHERE id = $1`, [accountId])
    revalidatePath("/admin")
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
    revalidatePath("/admin")
    return { ok: true, status: "morta" }
  }

  const me = (await meRes.json()) as { product?: string }
  const product = me.product || "free"
  const status = product === "premium" ? "premium" : "free"

  await query(
    `UPDATE public.spotify_accounts SET status = $2, last_checked = now() WHERE id = $1`,
    [accountId, status],
  )
  revalidatePath("/admin")
  return { ok: true, status }
}
