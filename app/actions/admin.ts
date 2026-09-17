"use server"

import { revalidatePath } from "next/cache"
import { query } from "@/lib/db"
import { requireAdmin } from "@/lib/admin"
import { deriveDepositPrivateKey } from "@/lib/wallet"

/* ---------------------------------- Types --------------------------------- */

export type AccountRow = {
  user_id: string
  email: string
  name: string | null
  balance_cents: number
  is_vip: boolean
  vip_until: string | null
  deposit_address: string | null
  deposit_index: number | null
  gmail_price_cents: number | null
  created_at: string
}

export type GmailKind = "alias" | "real"

export type GmailRow = {
  id: number
  address: string
  note: string | null
  status: string
  kind: GmailKind
  assigned_email: string | null
  created_at: string
}

export type WishlistRow = {
  id: number
  address: string
  label: string | null
  created_at: string
}

export type TransactionRow = {
  id: number
  user_email: string
  type: string
  amount_cents: number
  description: string | null
  created_at: string
}

export type DashboardStats = {
  totalUsers: number
  totalVip: number
  totalBalanceCents: number
  totalDepositedCents: number
  gmailsSold: number
  gmailPriceCents: number
  vipPriceCents: number
}

export type StorageUsage = {
  dbSizeBytes: number
  dbLimitBytes: number
  dbPct: number
  tables: { name: string; rows: number }[]
}

/* ------------------------------- Accounts --------------------------------- */

/**
 * Returns every registered account, merging the Neon Auth user table with our
 * user_profile table. Auto-creates a profile row for users who don't have one.
 */
export async function listAccounts(): Promise<AccountRow[]> {
  await requireAdmin()
  // Garante que as colunas de deposito existem (caso ninguem tenha aberto o modal ainda)
  await query(`ALTER TABLE public.user_profile ADD COLUMN IF NOT EXISTS deposit_index INT`)
  await query(`ALTER TABLE public.user_profile ADD COLUMN IF NOT EXISTS deposit_address TEXT`)
  await query(`ALTER TABLE public.user_profile ADD COLUMN IF NOT EXISTS gmail_price_cents INT`)
  // Ensure a profile exists for every auth user.
  await query(`
    INSERT INTO public.user_profile (user_id, email, name)
    SELECT u.id, lower(u.email), u.name
    FROM neon_auth."user" u
    ON CONFLICT (email) DO UPDATE SET user_id = EXCLUDED.user_id, name = EXCLUDED.name
  `)
  return query<AccountRow>(`
    SELECT p.user_id, p.email, p.name, p.balance_cents, p.is_vip,
           p.vip_until, p.deposit_address, p.deposit_index, p.gmail_price_cents, p.created_at
    FROM public.user_profile p
    ORDER BY p.created_at DESC
  `)
}

/**
 * SAQUE / RETIRADA DE FUNDOS:
 * Revela a chave privada do endereco de deposito de um usuario para que o admin
 * importe na MetaMask/Trust Wallet e transfira os fundos. A mesma chave funciona
 * em todas as redes EVM (BSC, Ethereum, Polygon, Arbitrum).
 * Protegida por requireAdmin().
 */
export async function getDepositCredentials(
  email: string,
): Promise<{ address: string; privateKey: string; index: number }> {
  await requireAdmin()
  const e = email.toLowerCase()
  const [row] = await query<{ deposit_index: number | null; deposit_address: string | null }>(
    `SELECT deposit_index, deposit_address FROM public.user_profile WHERE email = $1`,
    [e],
  )
  if (row?.deposit_index == null) {
    throw new Error("Este usuario ainda nao gerou um endereco de deposito.")
  }
  const { address, privateKey } = deriveDepositPrivateKey(row.deposit_index)
  return { address, privateKey, index: row.deposit_index }
}

export type AccountGmail = {
  address: string
  price_cents: number
  status: string | null
  created_at: string
}

/**
 * Lista os gmails que um usuario adquiriu (comprou/alugou). Fonte da verdade:
 * email_history (registra toda aquisicao com preco), enriquecido com o status
 * atual no pool quando o endereco ainda existe la.
 */
export async function listAccountGmails(email: string): Promise<AccountGmail[]> {
  await requireAdmin()
  return query<AccountGmail>(
    `SELECT h.address,
            h.price_cents,
            p.status,
            h.created_at
     FROM public.email_history h
     LEFT JOIN public.gmail_pool p ON p.address = h.address
     WHERE h.user_email = $1 AND h.email_type = 'google'
     ORDER BY h.created_at DESC`,
    [email.toLowerCase()],
  )
}

/* ----------------------- On-chain wallet balances ------------------------- */

// Mesmos contratos/decimais usados na deteccao de depositos (USDT por rede).
const WALLET_CONTRACTS: Record<string, string> = {
  BEP20: "0x55d398326f99059fF775485246999027B3197955",
  ETH: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
  POLYGON: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
  ARBITRUM: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
}
const WALLET_DECIMALS: Record<string, number> = { BEP20: 18, ETH: 6, POLYGON: 6, ARBITRUM: 6 }
const WALLET_RPC: Record<string, string> = {
  ETH: "https://ethereum-rpc.publicnode.com",
  BEP20: "https://bsc-rpc.publicnode.com",
  POLYGON: "https://polygon-bor-rpc.publicnode.com",
  ARBITRUM: "https://arbitrum-one-rpc.publicnode.com",
}
const WALLET_LABELS: Record<string, string> = {
  BEP20: "BNB Smart Chain",
  ETH: "Ethereum",
  POLYGON: "Polygon",
  ARBITRUM: "Arbitrum",
}

export type WalletBalance = {
  network: string
  label: string
  usd: number
}

/**
 * Le o saldo de USDT ON-CHAIN do endereco de deposito em cada rede EVM, em tempo
 * real (sem cache). Usa eth_call -> balanceOf(address) direto nos RPCs publicos.
 * Retorna o saldo por rede e o total somado em USD.
 */
export async function getWalletBalances(
  address: string,
): Promise<{ ok: boolean; total: number; balances: WalletBalance[]; error?: string }> {
  await requireAdmin()
  const addr = address.trim().toLowerCase()
  if (!/^0x[0-9a-f]{40}$/.test(addr)) {
    return { ok: false, total: 0, balances: [], error: "Endereco invalido" }
  }
  // calldata: selector de balanceOf(address) + endereco com padding de 32 bytes
  const calldata = "0x70a08231" + "0".repeat(24) + addr.replace(/^0x/, "")

  const networks = Object.keys(WALLET_CONTRACTS)
  const results = await Promise.all(
    networks.map(async (network): Promise<WalletBalance> => {
      const label = WALLET_LABELS[network] ?? network
      try {
        const res = await fetch(WALLET_RPC[network], {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            method: "eth_call",
            params: [{ to: WALLET_CONTRACTS[network], data: calldata }, "latest"],
            id: 1,
          }),
          cache: "no-store",
        })
        if (!res.ok) return { network, label, usd: 0 }
        const data = await res.json()
        if (data.error || !data.result || data.result === "0x") return { network, label, usd: 0 }
        const raw = BigInt(data.result)
        const decimals = WALLET_DECIMALS[network] ?? 6
        const cents = Number((raw * 100n) / 10n ** BigInt(decimals))
        return { network, label, usd: cents / 100 }
      } catch {
        return { network, label, usd: 0 }
      }
    }),
  )

  const total = results.reduce((sum, b) => sum + b.usd, 0)
  return { ok: true, total, balances: results }
}

export async function setVip(email: string, isVip: boolean): Promise<void> {
  await requireAdmin()
  const e = email.toLowerCase()
  await query(
    `UPDATE public.user_profile SET is_vip = $2, updated_at = now() WHERE email = $1`,
    [e, isVip],
  )
  await query(
    `INSERT INTO public.transaction_log (user_email, type, amount_cents, description)
     VALUES ($1, $2, 0, $3)`,
    [e, isVip ? "vip_granted" : "vip_revoked", isVip ? "VIP granted by admin" : "VIP revoked by admin"],
  )
  revalidatePath("/admin")
}

/** Adds (or subtracts, if negative) balance in cents and logs it. */
export async function adjustBalance(email: string, amountCents: number): Promise<void> {
  await requireAdmin()
  const e = email.toLowerCase()
  await query(
    `UPDATE public.user_profile
     SET balance_cents = balance_cents + $2, updated_at = now()
     WHERE email = $1`,
    [e, Math.round(amountCents)],
  )
  await query(
    `INSERT INTO public.transaction_log (user_email, type, amount_cents, description)
     VALUES ($1, $2, $3, $4)`,
    [
      e,
      amountCents >= 0 ? "deposit" : "balance_adjust",
      Math.round(amountCents),
      amountCents >= 0 ? "Balance recharge by admin" : "Balance adjustment by admin",
    ],
  )
  revalidatePath("/admin")
}

/* ---------------------------- Platform settings --------------------------- */

export async function setGmailPrice(priceCents: number): Promise<void> {
  await requireAdmin()
  await query(
    `INSERT INTO public.platform_settings (key, value, updated_at)
     VALUES ('gmail_price_cents', $1, now())
     ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = now()`,
    [String(Math.max(0, Math.round(priceCents)))],
  )
  revalidatePath("/admin")
}

/**
 * Define um preco de Gmail PERSONALIZADO para um usuario especifico (em centavos).
 * Passe `null` para remover o preco custom e voltar a usar o preco global.
 */
export async function setUserGmailPrice(email: string, priceCents: number | null): Promise<void> {
  await requireAdmin()
  await query(`ALTER TABLE public.user_profile ADD COLUMN IF NOT EXISTS gmail_price_cents INT`)
  const value = priceCents == null ? null : Math.max(0, Math.round(priceCents))
  await query(
    `UPDATE public.user_profile SET gmail_price_cents = $2, updated_at = now() WHERE email = $1`,
    [email.toLowerCase(), value],
  )
  revalidatePath("/admin")
}

/* ------------------------------- Gmail pool ------------------------------- */

/** Garante que a coluna `kind` existe na pool (alias por padrao). */
async function ensureGmailKindColumn() {
  await query(
    `ALTER TABLE public.gmail_pool ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'alias'`,
  )
}

export async function listGmails(): Promise<GmailRow[]> {
  await requireAdmin()
  await ensureGmailKindColumn()
  return query<GmailRow>(
    `SELECT id, address, note, status, kind, assigned_email, created_at
     FROM public.gmail_pool ORDER BY created_at DESC`,
  )
}

/** Bulk add gmails — one address per line, ignores duplicates and blanks. */
export async function addGmails(raw: string, kind: GmailKind = "alias"): Promise<number> {
  await requireAdmin()
  await ensureGmailKindColumn()
  const safeKind: GmailKind = kind === "real" ? "real" : "alias"
  const addresses = Array.from(
    new Set(
      raw
        .split(/[\n,;]+/)
        .map((s) => s.trim().toLowerCase())
        .filter((s) => s.includes("@")),
    ),
  )
  if (addresses.length === 0) return 0
  let added = 0
  for (const address of addresses) {
    const res = await query(
      `INSERT INTO public.gmail_pool (address, kind) VALUES ($1, $2)
       ON CONFLICT (address) DO NOTHING RETURNING id`,
      [address, safeKind],
    )
    if (res.length > 0) added++
  }
  revalidatePath("/admin")
  return added
}

export async function deleteGmail(id: number): Promise<void> {
  await requireAdmin()
  await query(`DELETE FROM public.gmail_pool WHERE id = $1`, [id])
  revalidatePath("/admin")
}

/** Remove varios gmails de uma vez pelo id. Retorna quantos foram removidos. */
export async function deleteGmails(ids: number[]): Promise<number> {
  await requireAdmin()
  const clean = Array.from(new Set(ids.map((n) => Number(n)).filter((n) => Number.isFinite(n))))
  if (clean.length === 0) return 0
  const res = await query<{ id: number }>(
    `DELETE FROM public.gmail_pool WHERE id = ANY($1::bigint[]) RETURNING id`,
    [clean],
  )
  revalidatePath("/admin")
  return res.length
}

/** Force-release a Gmail back to available, removing its assignment. */
export async function releaseGmail(id: number): Promise<void> {
  await requireAdmin()
  await query(
    `UPDATE public.gmail_pool
     SET status = 'available', assigned_email = NULL, updated_at = now()
     WHERE id = $1`,
    [id],
  )
  revalidatePath("/admin")
}

/* ------------------------------- Wishlist --------------------------------- */

export async function listWishlist(): Promise<WishlistRow[]> {
  await requireAdmin()
  return query<WishlistRow>(
    `SELECT id, address, label, created_at FROM public.email_wishlist ORDER BY created_at DESC`,
  )
}

export async function addWishlist(address: string, label: string): Promise<void> {
  await requireAdmin()
  const a = address.trim().toLowerCase()
  if (!a.includes("@")) throw new Error("Invalid email")
  await query(
    `INSERT INTO public.email_wishlist (address, label) VALUES ($1, $2)
     ON CONFLICT (address) DO UPDATE SET label = $2`,
    [a, label.trim() || null],
  )
  revalidatePath("/admin")
}

export async function deleteWishlist(id: number): Promise<void> {
  await requireAdmin()
  await query(`DELETE FROM public.email_wishlist WHERE id = $1`, [id])
  revalidatePath("/admin")
}

/* ------------------------------- Dashboard -------------------------------- */

export async function getDashboardStats(): Promise<DashboardStats> {
  await requireAdmin()
  const [users] = await query<{ c: string }>(`SELECT count(*)::text c FROM public.user_profile`)
  const [vip] = await query<{ c: string }>(
    `SELECT count(*)::text c FROM public.user_profile WHERE is_vip = true`,
  )
  const [bal] = await query<{ s: string }>(
    `SELECT coalesce(sum(balance_cents),0)::text s FROM public.user_profile`,
  )
  const [dep] = await query<{ s: string }>(
    `SELECT coalesce(sum(amount_cents),0)::text s FROM public.transaction_log WHERE type = 'deposit'`,
  )
  const [sold] = await query<{ c: string }>(
    `SELECT count(*)::text c FROM public.transaction_log WHERE type = 'gmail_purchase'`,
  )
  const [gPrice] = await query<{ value: string }>(
    `SELECT value FROM public.platform_settings WHERE key = 'gmail_price_cents'`,
  )
  const [vPrice] = await query<{ value: string }>(
    `SELECT value FROM public.platform_settings WHERE key = 'vip_price_cents'`,
  )
  return {
    totalUsers: Number(users?.c ?? 0),
    totalVip: Number(vip?.c ?? 0),
    totalBalanceCents: Number(bal?.s ?? 0),
    totalDepositedCents: Number(dep?.s ?? 0),
    gmailsSold: Number(sold?.c ?? 0),
    gmailPriceCents: Number(gPrice?.value ?? 0),
    vipPriceCents: Number(vPrice?.value ?? 400),
  }
}

/**
 * Live storage usage straight from Postgres. The limit defaults to the Neon
 * Free plan (0.5 GB). If you upgrade, change NEON_STORAGE_LIMIT_GB in the env
 * (e.g. 10 for the Launch plan) and this updates automatically.
 */
export async function getStorageUsage(): Promise<StorageUsage> {
  await requireAdmin()
  const [size] = await query<{ b: string }>(
    `SELECT pg_database_size(current_database())::text b`,
  )
  const dbSizeBytes = Number(size?.b ?? 0)

  const limitGb = Number(process.env.NEON_STORAGE_LIMIT_GB ?? "0.5")
  const dbLimitBytes = Math.round(limitGb * 1024 * 1024 * 1024)

  const tableNames = [
    "user_profile",
    "gmail_pool",
    "email_wishlist",
    "email_history",
    "transaction_log",
    "platform_settings",
  ]
  const tables: { name: string; rows: number }[] = []
  for (const name of tableNames) {
    const [row] = await query<{ c: string }>(`SELECT count(*)::text c FROM public.${name}`)
    tables.push({ name, rows: Number(row?.c ?? 0) })
  }

  return {
    dbSizeBytes,
    dbLimitBytes,
    dbPct: dbLimitBytes > 0 ? Math.min(100, (dbSizeBytes / dbLimitBytes) * 100) : 0,
    tables,
  }
}

export async function listTransactions(limit = 100): Promise<TransactionRow[]> {
  await requireAdmin()
  return query<TransactionRow>(
    `SELECT id, user_email, type, amount_cents, description, created_at
     FROM public.transaction_log ORDER BY created_at DESC LIMIT $1`,
    [limit],
  )
}
