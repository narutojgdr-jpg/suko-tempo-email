import { query } from "@/lib/db"

/**
 * SuKo Chat — assistente estilo ChatGPT com acesso liberado por usuario e cota
 * de tokens por janela de tempo (parecido com o limite do ChatGPT Go).
 *
 * Tabelas (criadas sob demanda, no mesmo padrao do resto do projeto):
 *  - chat_access        : quem tem acesso + limite de tokens + janela + modelo
 *  - chat_usage         : log de consumo de tokens (para a janela deslizante)
 *  - chat_conversation  : conversas de cada usuario
 *  - chat_message       : mensagens de cada conversa
 */

/** Modelo padrao usado quando o admin nao define um modelo custom por usuario. */
export const DEFAULT_CHAT_MODEL = "openai/gpt-5-mini"

/** Limite padrao de tokens por janela ao liberar um usuario novo. */
export const DEFAULT_TOKEN_LIMIT = 100_000

/** Janela padrao da cota, em segundos (1 hora). */
export const DEFAULT_WINDOW_SECONDS = 3600

export type ChatAccess = {
  email: string
  enabled: boolean
  tokenLimit: number
  windowSeconds: number
  model: string | null
}

export type ChatQuota = {
  hasAccess: boolean
  enabled: boolean
  tokenLimit: number
  windowSeconds: number
  usedTokens: number
  remainingTokens: number
  /** ISO timestamp em que a cota volta a ter espaco (fim da janela mais antiga). */
  resetAt: string | null
  model: string
}

let tablesReady = false

/** Cria as tabelas do chat caso ainda nao existam. Idempotente. */
export async function ensureChatTables(): Promise<void> {
  if (tablesReady) return
  await query(`
    CREATE TABLE IF NOT EXISTS public.chat_access (
      user_email     text PRIMARY KEY,
      enabled        boolean NOT NULL DEFAULT true,
      token_limit    bigint  NOT NULL DEFAULT 100000,
      window_seconds integer NOT NULL DEFAULT 3600,
      model          text,
      created_at     timestamptz NOT NULL DEFAULT now(),
      updated_at     timestamptz NOT NULL DEFAULT now()
    )
  `)
  await query(`
    CREATE TABLE IF NOT EXISTS public.chat_usage (
      id         bigserial PRIMARY KEY,
      user_email text   NOT NULL,
      tokens     bigint NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `)
  await query(
    `CREATE INDEX IF NOT EXISTS idx_chat_usage_user ON public.chat_usage (user_email, created_at DESC)`,
  )
  await query(`
    CREATE TABLE IF NOT EXISTS public.chat_conversation (
      id         bigserial PRIMARY KEY,
      user_email text NOT NULL,
      title      text NOT NULL DEFAULT 'Nova conversa',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `)
  await query(
    `CREATE INDEX IF NOT EXISTS idx_chat_conversation_user ON public.chat_conversation (user_email, updated_at DESC)`,
  )
  await query(`
    CREATE TABLE IF NOT EXISTS public.chat_message (
      id              bigserial PRIMARY KEY,
      conversation_id bigint NOT NULL REFERENCES public.chat_conversation(id) ON DELETE CASCADE,
      role            text NOT NULL,
      content         text NOT NULL,
      created_at      timestamptz NOT NULL DEFAULT now()
    )
  `)
  await query(
    `CREATE INDEX IF NOT EXISTS idx_chat_message_conv ON public.chat_message (conversation_id, created_at)`,
  )
  tablesReady = true
}

/** Le a config de acesso de um usuario. Retorna null se ele nunca foi liberado. */
export async function getChatAccess(email: string): Promise<ChatAccess | null> {
  await ensureChatTables()
  const [row] = await query<{
    user_email: string
    enabled: boolean
    token_limit: string
    window_seconds: number
    model: string | null
  }>(
    `SELECT user_email, enabled, token_limit, window_seconds, model
     FROM public.chat_access WHERE user_email = $1`,
    [email.toLowerCase()],
  )
  if (!row) return null
  return {
    email: row.user_email,
    enabled: row.enabled,
    tokenLimit: Number(row.token_limit),
    windowSeconds: row.window_seconds,
    model: row.model,
  }
}

/** Soma os tokens consumidos por um usuario dentro da janela atual. */
export async function getUsedTokens(email: string, windowSeconds: number): Promise<number> {
  await ensureChatTables()
  const [row] = await query<{ total: string }>(
    `SELECT COALESCE(SUM(tokens), 0) AS total
     FROM public.chat_usage
     WHERE user_email = $1 AND created_at > now() - ($2 || ' seconds')::interval`,
    [email.toLowerCase(), windowSeconds],
  )
  return Number(row?.total ?? 0)
}

/**
 * Momento em que a cota volta a abrir espaco: fim da janela do consumo mais
 * antigo que ainda conta dentro da janela atual.
 */
async function getResetAt(email: string, windowSeconds: number): Promise<string | null> {
  const [row] = await query<{ oldest: string | null }>(
    `SELECT MIN(created_at) AS oldest
     FROM public.chat_usage
     WHERE user_email = $1 AND created_at > now() - ($2 || ' seconds')::interval`,
    [email.toLowerCase(), windowSeconds],
  )
  if (!row?.oldest) return null
  return new Date(new Date(row.oldest).getTime() + windowSeconds * 1000).toISOString()
}

/** Estado completo da cota de um usuario (acesso + consumo na janela). */
export async function getChatQuota(email: string): Promise<ChatQuota> {
  const access = await getChatAccess(email)
  if (!access) {
    return {
      hasAccess: false,
      enabled: false,
      tokenLimit: DEFAULT_TOKEN_LIMIT,
      windowSeconds: DEFAULT_WINDOW_SECONDS,
      usedTokens: 0,
      remainingTokens: 0,
      resetAt: null,
      model: DEFAULT_CHAT_MODEL,
    }
  }
  const usedTokens = await getUsedTokens(email, access.windowSeconds)
  const resetAt = usedTokens > 0 ? await getResetAt(email, access.windowSeconds) : null
  return {
    hasAccess: access.enabled,
    enabled: access.enabled,
    tokenLimit: access.tokenLimit,
    windowSeconds: access.windowSeconds,
    usedTokens,
    remainingTokens: Math.max(0, access.tokenLimit - usedTokens),
    resetAt,
    model: access.model || DEFAULT_CHAT_MODEL,
  }
}

/** Registra consumo de tokens de um usuario. */
export async function recordUsage(email: string, tokens: number): Promise<void> {
  if (!tokens || tokens <= 0) return
  await ensureChatTables()
  await query(`INSERT INTO public.chat_usage (user_email, tokens) VALUES ($1, $2)`, [
    email.toLowerCase(),
    Math.round(tokens),
  ])
}
