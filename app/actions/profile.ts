"use server"

import { revalidatePath } from "next/cache"
import { query } from "@/lib/db"
import { getSessionEmail } from "@/lib/admin"
import { OTHER_DOMAINS } from "@/lib/email-config"
import { PRODUCT_SET, type ProductSlug, type ProductAccount } from "@/lib/products"

export type EmailHistoryItem = {
  id: number
  address: string
  emailType: string
  source: string
  priceCents: number
  createdAt: string
}

export type ProfileData = {
  email: string
  balanceCents: number
  totalSpentCents: number
  gmailsGenerated: number
  totalGenerated: number
  isVip: boolean
  history: EmailHistoryItem[]
}

/** Preco do VIP em centavos de dolar ($4) e duracao em dias. */
const VIP_PRICE_CENTS = 400
const VIP_DAYS = 30

/** Make sure a user_profile row exists for this email. */
async function ensureProfile(email: string, name?: string | null) {
  await query(
    `INSERT INTO public.user_profile (user_id, email, name)
     VALUES (gen_random_uuid(), $1, $2)
     ON CONFLICT (email) DO NOTHING`,
    [email, name ?? null],
  )
}

/**
 * Compra/renova o VIP usando o saldo do usuario. Deducao atomica: so debita se
 * o saldo for suficiente (evita corrida). Estende vip_until em VIP_DAYS a partir
 * do maior entre agora e o vip_until atual (renovacao acumula).
 */
export async function buyVip(): Promise<{
  ok: boolean
  error?: "not_logged_in" | "insufficient"
  balanceCents?: number
  vipUntil?: string
}> {
  const email = await getSessionEmail()
  if (!email) return { ok: false, error: "not_logged_in" }

  await ensureProfile(email)

  const [row] = await query<{ balance_cents: string; vip_until: string }>(
    `UPDATE public.user_profile
       SET balance_cents = balance_cents - $2,
           is_vip = true,
           vip_until = GREATEST(COALESCE(vip_until, now()), now()) + ($3 || ' days')::interval,
           updated_at = now()
     WHERE email = $1 AND balance_cents >= $2
     RETURNING balance_cents, vip_until`,
    [email, VIP_PRICE_CENTS, VIP_DAYS],
  )

  if (!row) {
    return { ok: false, error: "insufficient" }
  }

  await query(
    `INSERT INTO public.transaction_log (user_email, type, amount_cents, description)
     VALUES ($1, 'vip_purchase', $2, $3)`,
    [email, -VIP_PRICE_CENTS, `Assinatura VIP (${VIP_DAYS} dias)`],
  )

  return { ok: true, balanceCents: Number(row.balance_cents), vipUntil: row.vip_until }
}

/**
 * Save an email that a logged-in user generated/rented so it shows up in their
 * profile history on any device. No-op for logged-out users (they keep only the
 * browser-local list). Scoped strictly to the session email.
 */
export async function saveGeneratedEmail(
  address: string,
  emailType: string,
  source: "generated" | "rented" = "generated",
): Promise<{ ok: boolean }> {
  const email = await getSessionEmail()
  if (!email) return { ok: false }

  const clean = address.trim().toLowerCase()
  if (!clean || !clean.includes("@")) return { ok: false }

  await ensureProfile(email)
  await query(
    `INSERT INTO public.email_history (user_email, address, email_type, source)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_email, address) DO NOTHING`,
    [email, clean, emailType, source],
  )

  // If this is a Gmail from the pool, mark it as assigned so nobody else picks it
  if (emailType === "google") {
    await query(
      `UPDATE public.gmail_pool
       SET status = 'assigned', assigned_email = $1, updated_at = now()
       WHERE address = $2 AND status = 'available'`,
      [email, clean],
    )
  }

  return { ok: true }
}

/** Returns balance, spend, counts and the full email history for the session user. */
export async function getProfileData(): Promise<ProfileData | null> {
  const email = await getSessionEmail()
  if (!email) return null

  await ensureProfile(email)

  const [profileRow] = await query<{
    balance_cents: string
    is_vip: boolean
  }>(
    `SELECT balance_cents, is_vip FROM public.user_profile WHERE email = $1`,
    [email],
  )

  const history = await query<{
    id: string
    address: string
    email_type: string
    source: string
    price_cents: string
    created_at: string
  }>(
    `SELECT id, address, email_type, source, price_cents, created_at
     FROM public.email_history
     WHERE user_email = $1
     ORDER BY created_at DESC`,
    [email],
  )

  const [spendRow] = await query<{ total: string }>(
    `SELECT COALESCE(SUM(amount_cents), 0) AS total
     FROM public.transaction_log
     WHERE user_email = $1 AND type = 'gmail_purchase'`,
    [email],
  )

  const gmailsGenerated = history.filter((h) => h.email_type === "google").length

  return {
    email,
    balanceCents: Number(profileRow?.balance_cents ?? 0),
    totalSpentCents: Math.abs(Number(spendRow?.total ?? 0)),
    gmailsGenerated,
    totalGenerated: history.length,
    isVip: profileRow?.is_vip ?? false,
    history: history.map((h) => ({
      id: Number(h.id),
      address: h.address,
      emailType: h.email_type,
      source: h.source,
      priceCents: Number(h.price_cents),
      createdAt: h.created_at,
    })),
  }
}

/**
 * Remove an email from the user's history. If it was a Gmail from the pool,
 * set it back to 'available' so other users can pick it up.
 */
export async function removeGeneratedEmail(
  address: string,
): Promise<{ ok: boolean }> {
  const email = await getSessionEmail()
  if (!email) return { ok: false }

  const clean = address.trim().toLowerCase()

  // Get the email type before deleting
  const [row] = await query<{ email_type: string }>(
    `DELETE FROM public.email_history
     WHERE user_email = $1 AND address = $2
     RETURNING email_type`,
    [email, clean],
  )

  // If it was a Gmail from the pool, release it back to available
  if (row?.email_type === "google") {
    await query(
      `UPDATE public.gmail_pool
       SET status = 'available', assigned_email = NULL, updated_at = now()
       WHERE address = $1 AND assigned_email = $2`,
      [clean, email],
    )
  }

  return { ok: true }
}

/**
 * Le o preco do Gmail (em centavos). Se um email for informado e esse usuario
 * tiver um preco PERSONALIZADO definido pelo admin, ele tem prioridade sobre o
 * preco global. Caso contrario, cai no preco global de `platform_settings`.
 */
export async function getGmailPriceCents(email?: string): Promise<number> {
  if (email) {
    const [userRow] = await query<{ gmail_price_cents: number | null }>(
      `SELECT gmail_price_cents FROM public.user_profile WHERE email = $1`,
      [email.toLowerCase()],
    ).catch(() => [])
    if (userRow?.gmail_price_cents != null) {
      return Math.max(0, Number(userRow.gmail_price_cents))
    }
  }
  const [row] = await query<{ value: string }>(
    `SELECT value FROM public.platform_settings WHERE key = 'gmail_price_cents'`,
  )
  return Math.max(0, Number(row?.value ?? 0))
}

/**
 * Compra um Gmail do pool usando o SALDO do usuario (vale para VIP e nao-VIP).
 * O endereco so e revelado APOS a compra. Fluxo seguro:
 *  1. Reserva um gmail disponivel de forma atomica (SKIP LOCKED, sem corrida).
 *  2. Debita o saldo atomicamente (so se houver saldo suficiente).
 *  3. Se o saldo falhar, devolve o gmail ao pool.
 *  4. Registra no historico e no log de transacoes.
 */
export async function buyGmailFromPool(
  alreadyUsed: string[] = [],
): Promise<{
  ok: boolean
  error?: "not_logged_in" | "no_stock" | "insufficient"
  address?: string
  balanceCents?: number
  priceCents?: number
}> {
  const email = await getSessionEmail()
  if (!email) return { ok: false, error: "not_logged_in" }

  await ensureProfile(email)
  const priceCents = await getGmailPriceCents(email)

  // Garante colunas que a pool pode nao ter (criada por schema antigo):
  // `kind` (alias/real) e `updated_at` (usada nos UPDATEs de status).
  await query(
    `ALTER TABLE public.gmail_pool
       ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'alias',
       ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now()`,
  )

  // Enderecos que o usuario ja usou (local + historico) para nao repetir
  const usedList = alreadyUsed.map((a) => a.trim().toLowerCase()).filter(Boolean)

  // 1. Reserva atomica de um ALIAS disponivel que o usuario ainda nao tem.
  //    (Gmails "reais" ficam reservados para o futuro — ainda nao sao vendidos.)
  const [claimed] = await query<{ address: string }>(
    `UPDATE public.gmail_pool
       SET status = 'assigned', assigned_email = $1, assigned_at = now(), updated_at = now()
     WHERE id = (
       SELECT id FROM public.gmail_pool
       WHERE status = 'available'
         AND kind = 'alias'
         AND address <> ALL($2::text[])
         AND address NOT IN (
           SELECT address FROM public.email_history
           WHERE user_email = $1 AND email_type = 'google'
         )
       ORDER BY random()
       LIMIT 1
       FOR UPDATE SKIP LOCKED
     )
     RETURNING address`,
    [email, usedList],
  )
  if (!claimed) return { ok: false, error: "no_stock", priceCents }
  const address = claimed.address.toLowerCase()

  // 2. Debita o saldo atomicamente (so se suficiente)
  const [balRow] = await query<{ balance_cents: string }>(
    `UPDATE public.user_profile
       SET balance_cents = balance_cents - $2, updated_at = now()
     WHERE email = $1 AND balance_cents >= $2
     RETURNING balance_cents`,
    [email, priceCents],
  )

  // 3. Sem saldo -> devolve o gmail ao pool e aborta
  if (!balRow) {
    await query(
      `UPDATE public.gmail_pool
         SET status = 'available', assigned_email = NULL, assigned_at = NULL, updated_at = now()
       WHERE address = $1 AND assigned_email = $2`,
      [address, email],
    )
    return { ok: false, error: "insufficient", priceCents }
  }

  // 4. Registra no historico e no log de transacoes
  await query(
    `INSERT INTO public.email_history (user_email, address, email_type, source, price_cents)
     VALUES ($1, $2, 'google', 'generated', $3)
     ON CONFLICT (user_email, address) DO NOTHING`,
    [email, address, priceCents],
  )
  if (priceCents > 0) {
    await query(
      `INSERT INTO public.transaction_log (user_email, type, amount_cents, description)
       VALUES ($1, 'gmail_purchase', $2, $3)`,
      [email, -priceCents, `Compra de Gmail`],
    )
  }

  return { ok: true, address, balanceCents: Number(balRow.balance_cents), priceCents }
}

/**
 * Pick a random available Gmail from the pool that the user hasn't used yet.
 * Returns null if the pool is empty or the user is not logged in.
 */
export async function pickGmailFromPool(
  alreadyUsed: string[] = [],
): Promise<string | null> {
  const email = await getSessionEmail()
  if (!email) return null

  const takenSet = new Set(alreadyUsed.map((a) => a.toLowerCase()))

  // Also exclude gmails this user has previously generated
  const history = await query<{ address: string }>(
    `SELECT address FROM public.email_history
     WHERE user_email = $1 AND email_type = 'google'`,
    [email],
  )
  history.forEach((h) => takenSet.add(h.address.toLowerCase()))

  const available = await query<{ address: string }>(
    `SELECT address FROM public.gmail_pool
     WHERE status = 'available'
     ORDER BY random()
     LIMIT 10`,
  )

  const candidates = available
    .map((r) => r.address.toLowerCase())
    .filter((a) => !takenSet.has(a))

  return candidates[0] ?? null
}

/**
 * Register a custom-domain address (one of SuKo's own domains) to the user's
 * profile so they can open its inbox from there. VIP-gated.
 */
export async function addCustomDomainEmail(
  address: string,
): Promise<{ ok: boolean; error?: string }> {
  const email = await getSessionEmail()
  if (!email) return { ok: false, error: "not_logged_in" }

  const clean = address.trim().toLowerCase()
  const at = clean.indexOf("@")
  if (at <= 0 || at === clean.length - 1) {
    return { ok: false, error: "invalid" }
  }
  const domain = clean.slice(at + 1)
  if (!OTHER_DOMAINS.includes(domain)) {
    return { ok: false, error: "invalid_domain" }
  }

  const [profileRow] = await query<{ is_vip: boolean }>(
    `SELECT is_vip FROM public.user_profile WHERE email = $1`,
    [email],
  )
  if (!profileRow?.is_vip) {
    return { ok: false, error: "vip_required" }
  }

  await query(
    `INSERT INTO public.email_history (user_email, address, email_type, source)
     VALUES ($1, $2, 'other', 'custom')
     ON CONFLICT (user_email, address) DO NOTHING`,
    [email, clean],
  )
  return { ok: true }
}

/* -------------------------------------------------------------------------- */
/*                                  PRODUCTS                                   */
/* -------------------------------------------------------------------------- */

/** Cria as tabelas de contas e templates por produto, caso ainda nao existam. */
async function ensureProductTables() {
  await query(`
    CREATE TABLE IF NOT EXISTS public.product_accounts (
      id BIGSERIAL PRIMARY KEY,
      user_email TEXT NOT NULL,
      product TEXT NOT NULL,
      email TEXT NOT NULL DEFAULT '',
      password TEXT NOT NULL DEFAULT '',
      twofa TEXT NOT NULL DEFAULT '',
      recovery TEXT NOT NULL DEFAULT '',
      position INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `)
  await query(
    `CREATE INDEX IF NOT EXISTS idx_product_accounts_user ON public.product_accounts (user_email, product)`,
  )
  await query(`
    CREATE TABLE IF NOT EXISTS public.product_templates (
      user_email TEXT NOT NULL,
      product TEXT NOT NULL,
      body TEXT NOT NULL DEFAULT '',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (user_email, product)
    )
  `)
}

/** Garante que o usuario logado e VIP; retorna o email da sessao ou null. */
async function requireVip(): Promise<string | null> {
  const email = await getSessionEmail()
  if (!email) return null
  const [row] = await query<{ is_vip: boolean }>(
    `SELECT is_vip FROM public.user_profile WHERE email = $1`,
    [email],
  )
  return row?.is_vip ? email : null
}

/** Lista todas as contas (cards) salvas por produto do usuario logado (VIP). */
export async function listProductAccounts(): Promise<ProductAccount[]> {
  const email = await requireVip()
  if (!email) return []
  await ensureProductTables()
  const rows = await query<{
    id: string
    product: string
    email: string
    password: string
    twofa: string
    recovery: string
    position: number
    created_at: string
  }>(
    `SELECT id, product, email, password, twofa, recovery, position, created_at
     FROM public.product_accounts
     WHERE user_email = $1
     ORDER BY position ASC, id ASC`,
    [email],
  )
  return rows
    .filter((r) => PRODUCT_SET.has(r.product))
    .map((r) => ({
      id: Number(r.id),
      product: r.product as ProductSlug,
      email: r.email,
      password: r.password,
      twofa: r.twofa,
      recovery: r.recovery,
      position: r.position,
      createdAt: r.created_at,
    }))
}

type AccountInput = {
  id?: number
  product: string
  email: string
  password: string
  twofa: string
  recovery: string
}

/** Cria ou atualiza uma conta (card) de um produto (VIP). */
export async function saveProductAccount(
  input: AccountInput,
): Promise<{ ok: boolean; id?: number; error?: "not_vip" | "invalid" }> {
  const email = await requireVip()
  if (!email) return { ok: false, error: "not_vip" }
  if (!PRODUCT_SET.has(input.product)) return { ok: false, error: "invalid" }

  await ensureProductTables()

  const vals = {
    email: input.email.trim(),
    password: input.password,
    twofa: input.twofa.trim(),
    recovery: input.recovery.trim(),
  }

  if (input.id) {
    // Atualiza apenas se a conta pertence ao usuario
    const [row] = await query<{ id: string }>(
      `UPDATE public.product_accounts
         SET email = $3, password = $4, twofa = $5, recovery = $6, updated_at = now()
       WHERE id = $1 AND user_email = $2
       RETURNING id`,
      [input.id, email, vals.email, vals.password, vals.twofa, vals.recovery],
    )
    if (!row) return { ok: false, error: "invalid" }
    revalidatePath("/[lang]/profile", "page")
    return { ok: true, id: Number(row.id) }
  }

  // Cria no fim da lista do produto
  const [posRow] = await query<{ next: number }>(
    `SELECT COALESCE(MAX(position), -1) + 1 AS next
     FROM public.product_accounts WHERE user_email = $1 AND product = $2`,
    [email, input.product],
  )
  const [row] = await query<{ id: string }>(
    `INSERT INTO public.product_accounts (user_email, product, email, password, twofa, recovery, position)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [email, input.product, vals.email, vals.password, vals.twofa, vals.recovery, posRow?.next ?? 0],
  )
  revalidatePath("/[lang]/profile", "page")
  return { ok: true, id: Number(row.id) }
}

/** Remove uma conta (card) (VIP). */
export async function deleteProductAccount(id: number): Promise<{ ok: boolean; error?: "not_vip" }> {
  const email = await requireVip()
  if (!email) return { ok: false, error: "not_vip" }
  await ensureProductTables()
  await query(
    `DELETE FROM public.product_accounts WHERE id = $1 AND user_email = $2`,
    [id, email],
  )
  revalidatePath("/[lang]/profile", "page")
  return { ok: true }
}

/** Reordena as contas de um produto conforme a lista de IDs informada (VIP). */
export async function reorderProductAccounts(
  product: string,
  orderedIds: number[],
): Promise<{ ok: boolean; error?: "not_vip" }> {
  const email = await requireVip()
  if (!email) return { ok: false, error: "not_vip" }
  if (!PRODUCT_SET.has(product)) return { ok: false }
  await ensureProductTables()
  // Atualiza a posicao de cada conta (apenas as do proprio usuario/produto)
  for (let i = 0; i < orderedIds.length; i++) {
    await query(
      `UPDATE public.product_accounts SET position = $4
       WHERE id = $1 AND user_email = $2 AND product = $3`,
      [orderedIds[i], email, product, i],
    )
  }
  revalidatePath("/[lang]/profile", "page")
  return { ok: true }
}

/** Mapa produto -> template de entrega personalizada do usuario (VIP). */
export async function listProductTemplates(): Promise<Record<string, string>> {
  const email = await requireVip()
  if (!email) return {}
  await ensureProductTables()
  const rows = await query<{ product: string; body: string }>(
    `SELECT product, body FROM public.product_templates WHERE user_email = $1`,
    [email],
  )
  const map: Record<string, string> = {}
  for (const r of rows) if (PRODUCT_SET.has(r.product)) map[r.product] = r.body
  return map
}

/** Salva o template de entrega de um produto (vale para todos os cards) (VIP). */
export async function saveProductTemplate(
  product: string,
  body: string,
): Promise<{ ok: boolean; error?: "not_vip" | "invalid" }> {
  const email = await requireVip()
  if (!email) return { ok: false, error: "not_vip" }
  if (!PRODUCT_SET.has(product)) return { ok: false, error: "invalid" }
  await ensureProductTables()
  await query(
    `INSERT INTO public.product_templates (user_email, product, body, updated_at)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (user_email, product) DO UPDATE SET body = EXCLUDED.body, updated_at = now()`,
    [email, product, body],
  )
  revalidatePath("/[lang]/profile", "page")
  return { ok: true }
}
