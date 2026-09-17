"use server"

import { query } from "@/lib/db"
import { getSessionEmail } from "@/lib/admin"
import { deriveDepositAddress } from "@/lib/wallet"
import { revalidatePath } from "next/cache"
import type { Network } from "@/lib/payment-config"

const VIP_THRESHOLD_USD = 10

// ---------------------------------------------------------------------------
// Contratos de stablecoin por rede (USDT/USDC) + decimais
// ---------------------------------------------------------------------------
const CONTRACTS: Record<string, string> = {
  BEP20:    "0x55d398326f99059fF775485246999027B3197955", // USDT BEP20
  ETH:      "0xdAC17F958D2ee523a2206206994597C13D831ec7", // USDT ERC20
  POLYGON:  "0xc2132D05D31c914a87C6611C10748AEb04B58e8F", // USDT Polygon
  ARBITRUM: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", // USDT Arbitrum
}

const DECIMALS: Record<string, number> = {
  BEP20: 18,
  ETH: 6,
  POLYGON: 6,
  ARBITRUM: 6,
}

const NETWORKS: Network[] = ["BEP20", "ETH", "POLYGON", "ARBITRUM"]

// RPCs publicos (publicnode) — suportam eth_getLogs sem API key
const RPC_URLS: Record<string, string> = {
  ETH:      "https://ethereum-rpc.publicnode.com",
  BEP20:    "https://bsc-rpc.publicnode.com",
  POLYGON:  "https://polygon-bor-rpc.publicnode.com",
  ARBITRUM: "https://arbitrum-one-rpc.publicnode.com",
}

const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"

// Maximo de blocos varridos por consulta (limite dos RPCs publicos)
const MAX_LOOKBACK = 4500

// Confirmacoes minimas antes de creditar (protege contra reorg da chain).
// So contamos transfers em blocos com profundidade >= a margem da rede.
const CONFIRMATIONS: Record<string, number> = {
  BEP20: 8,
  ETH: 4,
  POLYGON: 40, // Polygon tem reorgs mais profundos
  ARBITRUM: 20,
}

// Anti-DoS: intervalo minimo entre verificacoes por usuario (em memoria).
const MIN_CHECK_INTERVAL_MS = 6_000
const lastCheckByUser = new Map<string, number>()

// Helper para chamadas JSON-RPC
async function rpcCall(network: Network, method: string, params: unknown[]): Promise<any> {
  const url = RPC_URLS[network]
  if (!url) return null
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", method, params, id: 1 }),
      cache: "no-store",
    })
    if (!res.ok) return null
    const data = await res.json()
    if (data.error) {
      console.log("[v0] rpcCall error:", network, method, data.error)
      return null
    }
    return data.result
  } catch (e) {
    console.log("[v0] rpcCall exception:", network, method, e)
    return null
  }
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------
let tableEnsured = false
async function ensureTable() {
  if (tableEnsured) return

  // Colunas no perfil para o endereco de deposito unico
  await query(`ALTER TABLE public.user_profile ADD COLUMN IF NOT EXISTS deposit_index INT`)
  await query(`ALTER TABLE public.user_profile ADD COLUMN IF NOT EXISTS deposit_address TEXT`)

  // Sequence global para atribuir um indice unico a cada usuario
  await query(`CREATE SEQUENCE IF NOT EXISTS public.deposit_index_seq START 1`)

  // Depositos ja processados (anti-duplicidade): cada (rede, tx, log) credita 1x
  await query(`
    CREATE TABLE IF NOT EXISTS public.crypto_deposits (
      id           BIGSERIAL PRIMARY KEY,
      user_email   TEXT NOT NULL,
      network      TEXT NOT NULL,
      tx_hash      TEXT NOT NULL,
      log_index    INT  NOT NULL,
      amount_cents INT  NOT NULL,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (network, tx_hash, log_index)
    )
  `)

  // Cursor de varredura por (usuario, rede): ate qual bloco ja olhamos
  await query(`
    CREATE TABLE IF NOT EXISTS public.deposit_cursor (
      user_email TEXT NOT NULL,
      network    TEXT NOT NULL,
      last_block BIGINT NOT NULL DEFAULT 0,
      PRIMARY KEY (user_email, network)
    )
  `)

  // Log geral de transacoes (se ainda nao existir)
  await query(`
    CREATE TABLE IF NOT EXISTS public.transaction_log (
      id           BIGSERIAL PRIMARY KEY,
      user_email   TEXT NOT NULL,
      type         TEXT NOT NULL,
      amount_cents INT NOT NULL DEFAULT 0,
      description  TEXT,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `)

  tableEnsured = true
}

// ---------------------------------------------------------------------------
// Garante perfil + endereco de deposito do usuario logado
// ---------------------------------------------------------------------------
async function ensureProfileRow(email: string) {
  await query(
    `INSERT INTO public.user_profile (user_id, email)
     VALUES (gen_random_uuid(), $1)
     ON CONFLICT (email) DO NOTHING`,
    [email],
  )
}

// ---------------------------------------------------------------------------
// 1. getDepositAddress — retorna (criando se preciso) o endereco unico do user
// ---------------------------------------------------------------------------
export type DepositInfo = {
  ok: boolean
  address?: string
  networks?: { id: Network; label: string; coin: string }[]
  error?: string
}

const NETWORK_META: { id: Network; label: string; coin: string }[] = [
  { id: "BEP20", label: "BNB Smart Chain (BEP20)", coin: "USDT" },
  { id: "ARBITRUM", label: "Arbitrum One", coin: "USDT" },
  { id: "POLYGON", label: "Polygon", coin: "USDT" },
  { id: "ETH", label: "Ethereum (ERC20)", coin: "USDT" },
]

export async function getDepositAddress(): Promise<DepositInfo> {
  const email = await getSessionEmail()
  if (!email) return { ok: false, error: "Not logged in" }

  await ensureTable()
  await ensureProfileRow(email)

  // Ja tem endereco?
  const [existing] = await query<{ deposit_address: string | null; deposit_index: number | null }>(
    `SELECT deposit_address, deposit_index FROM public.user_profile WHERE email = $1`,
    [email],
  )

  let address = existing?.deposit_address ?? null

  if (!address) {
    try {
      // Atribui um indice unico e deriva o endereco
      const [{ idx }] = await query<{ idx: string }>(`SELECT nextval('public.deposit_index_seq') AS idx`)
      const index = Number(idx)
      address = deriveDepositAddress(index)
      await query(
        `UPDATE public.user_profile SET deposit_index = $2, deposit_address = $3, updated_at = now() WHERE email = $1`,
        [email, index, address],
      )
    } catch (e) {
      console.log("[v0] getDepositAddress derive error:", e)
      return { ok: false, error: "Sistema de pagamento indisponivel. Avise o suporte." }
    }
  }

  return { ok: true, address, networks: NETWORK_META }
}

// ---------------------------------------------------------------------------
// 2. checkDeposits — varre as redes em busca de novas transferencias para o
//    endereco unico do usuario e credita as que ainda nao foram processadas.
//    SEGURO: o endereco e exclusivo, entao todo transfer recebido e do usuario.
// ---------------------------------------------------------------------------
export async function checkDeposits(): Promise<{
  ok: boolean
  creditedCents: number
  message: string
}> {
  const email = await getSessionEmail()
  if (!email) return { ok: false, creditedCents: 0, message: "Not logged in" }

  // Anti-DoS: limita a frequencia de verificacao por usuario, protegendo os
  // RPCs publicos de spam (que derrubaria os depositos de todos).
  const now = Date.now()
  const last = lastCheckByUser.get(email) ?? 0
  if (now - last < MIN_CHECK_INTERVAL_MS) {
    return { ok: true, creditedCents: 0, message: "Aguarde um instante..." }
  }
  lastCheckByUser.set(email, now)

  await ensureTable()

  const [profile] = await query<{ deposit_address: string | null }>(
    `SELECT deposit_address FROM public.user_profile WHERE email = $1`,
    [email],
  )
  const address = profile?.deposit_address
  if (!address) return { ok: false, creditedCents: 0, message: "Gere um endereco de deposito primeiro." }

  const addrLower = address.toLowerCase()
  const paddedTo = "0x" + "0".repeat(24) + addrLower.replace(/^0x/, "")

  let totalCreditedCents = 0

  for (const network of NETWORKS) {
    const credited = await scanNetwork(email, network, addrLower, paddedTo)
    totalCreditedCents += credited
  }

  if (totalCreditedCents > 0) {
    // Atualiza VIP se o saldo acumulado passar do limite
    const [{ balance_cents }] = await query<{ balance_cents: string }>(
      `SELECT balance_cents FROM public.user_profile WHERE email = $1`,
      [email],
    )
    if (Number(balance_cents) >= VIP_THRESHOLD_USD * 100) {
      await query(`UPDATE public.user_profile SET is_vip = true, updated_at = now() WHERE email = $1`, [email])
    }
    revalidatePath("/")
    const usd = (totalCreditedCents / 100).toFixed(2)
    return { ok: true, creditedCents: totalCreditedCents, message: `Deposito de $${usd} confirmado!` }
  }

  return { ok: true, creditedCents: 0, message: "Nenhum deposito novo encontrado ainda." }
}

// Varre uma rede e credita transfers novos. Retorna cents creditados.
async function scanNetwork(
  email: string,
  network: Network,
  addrLower: string,
  paddedTo: string,
): Promise<number> {
  const contract = CONTRACTS[network]
  const decimals = DECIMALS[network] ?? 6
  const confirmations = CONFIRMATIONS[network] ?? 12

  // Bloco mais recente
  const latestHex = await rpcCall(network, "eth_blockNumber", [])
  if (!latestHex) return 0
  const latest = parseInt(latestHex, 16)

  // So consideramos blocos com confirmacoes suficientes (anti-reorg)
  const safeTo = latest - confirmations
  if (safeTo <= 0) return 0

  // Cursor: ate onde ja varremos. Se nao existe, comeca um pouco atras do topo.
  const [cursorRow] = await query<{ last_block: string }>(
    `SELECT last_block FROM public.deposit_cursor WHERE user_email = $1 AND network = $2`,
    [email, network],
  )
  let fromBlock: number
  if (cursorRow) {
    fromBlock = Number(cursorRow.last_block) + 1
  } else {
    fromBlock = Math.max(0, safeTo - MAX_LOOKBACK)
  }
  // Nunca varrer alem do limite de blocos do RPC
  if (safeTo - fromBlock > MAX_LOOKBACK) fromBlock = safeTo - MAX_LOOKBACK
  // Nada novo confirmado ainda — NAO mexe no cursor
  if (fromBlock > safeTo) return 0

  const logs = await rpcCall(network, "eth_getLogs", [
    {
      fromBlock: "0x" + fromBlock.toString(16),
      toBlock: "0x" + safeTo.toString(16),
      address: contract,
      topics: [TRANSFER_TOPIC, null, paddedTo],
    },
  ])

  // CRITICO: se o RPC falhou (null), NAO avanca o cursor, senao perderiamos
  // os depositos desses blocos para sempre. Tenta de novo na proxima.
  if (!Array.isArray(logs)) return 0

  let creditedCents = 0

  for (const log of logs as Array<{ data: string; transactionHash: string; logIndex: string }>) {
    // BigInt para precisao exata em valores grandes (USDT BEP20 tem 18 casas)
    let raw: bigint
    try {
      raw = BigInt(log.data)
    } catch {
      continue
    }
    if (raw <= 0n) continue
    // cents = valor * 100 / 10^decimals, com arredondamento
    const cents = Number((raw * 100n) / 10n ** BigInt(decimals))
    if (cents <= 0) continue
    const amount = cents / 100
    const txHash = (log.transactionHash || "").toLowerCase()
    const logIndex = parseInt(log.logIndex || "0x0", 16)

    // Insere o deposito; se ja existe (mesma rede+tx+log), nao credita de novo
    const inserted = await query<{ id: string }>(
      `INSERT INTO public.crypto_deposits (user_email, network, tx_hash, log_index, amount_cents)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (network, tx_hash, log_index) DO NOTHING
       RETURNING id`,
      [email, network, txHash, logIndex, cents],
    )
    if (inserted.length === 0) continue // ja processado

    await query(
      `UPDATE public.user_profile SET balance_cents = balance_cents + $2, updated_at = now() WHERE email = $1`,
      [email, cents],
    )
    await query(
      `INSERT INTO public.transaction_log (user_email, type, amount_cents, description)
       VALUES ($1, 'deposit', $2, $3)`,
      [email, cents, `Deposito ${network} $${amount.toFixed(2)} tx:${txHash.slice(0, 18)}`],
    )
    creditedCents += cents
  }

  // Avanca o cursor ate o ultimo bloco CONFIRMADO que varremos
  await query(
    `INSERT INTO public.deposit_cursor (user_email, network, last_block)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_email, network) DO UPDATE SET last_block = EXCLUDED.last_block`,
    [email, network, safeTo],
  )

  return creditedCents
}
