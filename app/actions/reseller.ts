"use server"

import { revalidatePath } from "next/cache"
import { query } from "@/lib/db"
import { requireAdmin } from "@/lib/admin"
import { OTHER_DOMAINS } from "@/lib/email-config"

/* ---------------------------------- Types --------------------------------- */

export type ResellerPageRow = {
  id: number
  key: string
  name: string
  created_at: string
  gmail_count: number
}

export type ResellerGmailRow = {
  id: number
  page_id: number
  address: string
  product: string | null
  created_at: string
}

/** Resultado da busca global de gmail no admin. */
export type GmailSearchResult = {
  id: number
  address: string
  product: string | null
  page_id: number
  page_name: string
  page_key: string
}

export type ResellerPageWithGmails = {
  id: number
  key: string
  name: string
  gmails: string[]
}

/* ------------------------------ Schema (idempotent) ----------------------- */

let tablesReady = false

/**
 * Cria as tabelas de revendedores se ainda nao existirem. Seguro chamar varias
 * vezes — usa CREATE TABLE IF NOT EXISTS, mesmo padrao do resto do app.
 */
async function ensureResellerTables() {
  if (tablesReady) return
  await query(`
    CREATE TABLE IF NOT EXISTS public.reseller_page (
      id         bigserial PRIMARY KEY,
      key        text UNIQUE NOT NULL,
      name       text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `)
  await query(`
    CREATE TABLE IF NOT EXISTS public.reseller_gmail (
      id         bigserial PRIMARY KEY,
      page_id    bigint NOT NULL REFERENCES public.reseller_page(id) ON DELETE CASCADE,
      address    text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (page_id, address)
    )
  `)
  await query(
    `CREATE INDEX IF NOT EXISTS idx_reseller_gmail_page ON public.reseller_gmail (page_id)`,
  )
  // Coluna de produto (organizacao). Idempotente.
  await query(`ALTER TABLE public.reseller_gmail ADD COLUMN IF NOT EXISTS product text`)
  await normalizeResellerKeys()
  tablesReady = true
}

/**
 * Migra chaves antigas no formato "slug-123456789012" para apenas "slug",
 * deixando as URLs limpas (/pt/suko). Roda uma vez por processo, dentro de
 * ensureResellerTables. So renomeia quando o destino estiver livre, para nunca
 * causar colisao. Chaves ja limpas sao ignoradas.
 */
async function normalizeResellerKeys() {
  const rows = await query<{ id: number; key: string }>(
    `SELECT id, key FROM public.reseller_page WHERE key ~ '-[0-9]{6,}$'`,
  )
  for (const row of rows) {
    const target = row.key.replace(/-[0-9]{6,}$/, "")
    if (!target || RESERVED_SLUGS.has(target)) continue
    const taken = await query<{ id: number }>(
      `SELECT id FROM public.reseller_page WHERE lower(key) = $1 AND id <> $2 LIMIT 1`,
      [target, row.id],
    )
    if (taken.length > 0) continue
    await query(`UPDATE public.reseller_page SET key = $1 WHERE id = $2`, [target, row.id])
  }
}

/* ------------------------------- Helpers ---------------------------------- */

/**
 * Slugs reservados: rotas que existem sob /[lang] (ou que podem confundir),
 * para nenhum revendedor "roubar" essas URLs.
 */
const RESERVED_SLUGS = new Set([
  "chat",
  "infinity",
  "profile",
  "sign-in",
  "sign-up",
  "admin",
  "api",
  "api-docs",
  "auth",
  "revendedor",
  "2fa",
])

/** "Gabriel Silva" -> "gabriel-silva". Fallback to "revendedor". */
function slugify(name: string): string {
  const slug = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
  return slug || "revendedor"
}

/* ------------------------------ Admin: pages ------------------------------ */

export async function listResellerPages(): Promise<ResellerPageRow[]> {
  await requireAdmin()
  await ensureResellerTables()
  return query<ResellerPageRow>(`
    SELECT p.id, p.key, p.name, p.created_at,
           COALESCE(count(g.id), 0)::int AS gmail_count
    FROM public.reseller_page p
    LEFT JOIN public.reseller_gmail g ON g.page_id = p.id
    GROUP BY p.id
    ORDER BY p.created_at DESC
  `)
}

/**
 * Cria uma pagina de revendedor com URL limpa (a chave e o proprio slug do
 * nome, ex.: "suko"). Em caso de colisao ou slug reservado, adiciona um sufixo
 * numerico curto (suko-2, suko-3, ...). Retorna a chave publica gerada.
 */
export async function createResellerPage(name: string): Promise<string> {
  await requireAdmin()
  await ensureResellerTables()
  const clean = name.trim()
  if (!clean) throw new Error("Digite um nome para o revendedor.")

  const base = slugify(clean)
  for (let attempt = 0; attempt < 50; attempt++) {
    // attempt 0 -> "suko"; demais -> "suko-2", "suko-3"...
    let key = attempt === 0 ? base : `${base}-${attempt + 1}`
    if (RESERVED_SLUGS.has(key)) key = `${base}-${attempt + 1}`
    const res = await query<{ key: string }>(
      `INSERT INTO public.reseller_page (key, name) VALUES ($1, $2)
       ON CONFLICT (key) DO NOTHING RETURNING key`,
      [key, clean],
    )
    if (res.length > 0) {
      revalidatePath("/admin")
      return res[0].key
    }
  }
  throw new Error("Nao foi possivel gerar uma chave unica. Tente novamente.")
}

export async function deleteResellerPage(id: number): Promise<void> {
  await requireAdmin()
  await ensureResellerTables()
  await query(`DELETE FROM public.reseller_page WHERE id = $1`, [id])
  revalidatePath("/admin")
}

/* ------------------------------ Admin: gmails ----------------------------- */

export async function listResellerGmails(pageId: number): Promise<ResellerGmailRow[]> {
  await requireAdmin()
  await ensureResellerTables()
  // Ordena por produto (sem produto por ultimo) e depois por endereco, para a
  // visao agrupada por produto ficar estavel.
  return query<ResellerGmailRow>(
    `SELECT id, page_id, address, product, created_at
     FROM public.reseller_gmail WHERE page_id = $1
     ORDER BY product NULLS LAST, address ASC`,
    [pageId],
  )
}

/**
 * Bulk add gmails to a specific reseller page — one address per line. Quando
 * informado, "product" e aplicado a todos os enderecos adicionados (e tambem
 * atualiza o produto de enderecos que ja existiam na pagina).
 */
export async function addResellerGmails(
  pageId: number,
  raw: string,
  product?: string,
): Promise<number> {
  await requireAdmin()
  await ensureResellerTables()
  const addresses = Array.from(
    new Set(
      raw
        .split(/[\n,;]+/)
        .map((s) => s.trim().toLowerCase())
        .filter((s) => s.includes("@")),
    ),
  )
  if (addresses.length === 0) return 0
  const prod = product?.trim() || null
  let added = 0
  for (const address of addresses) {
    const res = await query(
      `INSERT INTO public.reseller_gmail (page_id, address, product) VALUES ($1, $2, $3)
       ON CONFLICT (page_id, address)
       DO UPDATE SET product = COALESCE(EXCLUDED.product, public.reseller_gmail.product)
       RETURNING (xmax = 0) AS inserted`,
      [pageId, address, prod],
    )
    if (res.length > 0 && (res[0] as { inserted: boolean }).inserted) added++
  }
  revalidatePath("/admin")
  return added
}

/** Define (ou limpa) o produto de um gmail especifico. */
export async function setResellerGmailProduct(id: number, product: string): Promise<void> {
  await requireAdmin()
  await ensureResellerTables()
  await query(`UPDATE public.reseller_gmail SET product = $1 WHERE id = $2`, [
    product.trim() || null,
    id,
  ])
  revalidatePath("/admin")
}

export async function deleteResellerGmail(id: number): Promise<void> {
  await requireAdmin()
  await ensureResellerTables()
  await query(`DELETE FROM public.reseller_gmail WHERE id = $1`, [id])
  revalidatePath("/admin")
}

/**
 * Busca global (admin): dado um trecho de email (ou produto), retorna de qual
 * revendedor o gmail e e qual produto esta associado a ele.
 */
export async function searchResellerGmails(rawQuery: string): Promise<GmailSearchResult[]> {
  await requireAdmin()
  await ensureResellerTables()
  const q = rawQuery.trim().toLowerCase()
  if (!q) return []
  const like = `%${q}%`
  return query<GmailSearchResult>(
    `SELECT g.id, g.address, g.product, g.page_id, p.name AS page_name, p.key AS page_key
     FROM public.reseller_gmail g
     JOIN public.reseller_page p ON p.id = g.page_id
     WHERE lower(g.address) LIKE $1 OR lower(COALESCE(g.product, '')) LIKE $1
     ORDER BY g.address ASC
     LIMIT 50`,
    [like],
  )
}

/* ------------------------------ Public lookups ---------------------------- */

/**
 * Public: returns the reseller page for a given key plus the list of gmails
 * assigned to it. Returns null when the key does not exist. NO admin gate — the
 * key itself is the access token.
 */
export async function getResellerPageByKey(
  key: string,
): Promise<ResellerPageWithGmails | null> {
  await ensureResellerTables()
  const clean = key.trim().toLowerCase()
  // Aceita a chave exata OU a versao sem o sufixo numerico antigo, para que
  // links antigos (suko-083353733676) ainda encontrem a pagina ja normalizada.
  const [page] = await query<{ id: number; key: string; name: string }>(
    `SELECT id, key, name FROM public.reseller_page
     WHERE lower(key) = $1 OR lower(key) = regexp_replace($1, '-[0-9]{6,}$', '')
     LIMIT 1`,
    [clean],
  )
  if (!page) return null
  const gmails = await query<{ address: string }>(
    `SELECT address FROM public.reseller_gmail WHERE page_id = $1 ORDER BY address ASC`,
    [page.id],
  )
  return { id: page.id, key: page.key, name: page.name, gmails: gmails.map((g) => g.address) }
}

/**
 * Public: server-side guard. An address is allowed on a reseller page when it
 * is one of the gmails assigned to that page, OR it belongs to one of our own
 * custom domains (which the user can use freely).
 */
export async function verifyResellerAddress(
  key: string,
  address: string,
): Promise<{ ok: boolean }> {
  await ensureResellerTables()
  const cleanKey = key.trim().toLowerCase()
  const cleanAddr = address.trim().toLowerCase()
  if (!cleanAddr.includes("@")) return { ok: false }

  const domain = cleanAddr.slice(cleanAddr.lastIndexOf("@") + 1)

  // Our own domains are always allowed.
  if (OTHER_DOMAINS.includes(domain)) return { ok: true }

  // Otherwise it must be a gmail explicitly assigned to this page.
  const [page] = await query<{ id: number }>(
    `SELECT id FROM public.reseller_page WHERE lower(key) = $1`,
    [cleanKey],
  )
  if (!page) return { ok: false }
  const rows = await query<{ id: number }>(
    `SELECT id FROM public.reseller_gmail WHERE page_id = $1 AND lower(address) = $2 LIMIT 1`,
    [page.id, cleanAddr],
  )
  return { ok: rows.length > 0 }
}
