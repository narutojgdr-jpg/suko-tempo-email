"use server"

import { revalidatePath } from "next/cache"
import { query } from "@/lib/db"
import { requireAdmin } from "@/lib/admin"
import {
  ensureChatTables,
  getUsedTokens,
  DEFAULT_TOKEN_LIMIT,
  DEFAULT_WINDOW_SECONDS,
} from "@/lib/chat"

export type ChatAccessRow = {
  email: string
  name: string | null
  enabled: boolean
  /** Se ja existe configuracao de chat para este usuario. */
  configured: boolean
  tokenLimit: number
  windowSeconds: number
  model: string | null
  usedTokens: number
}

/**
 * Lista todas as contas com o estado do acesso ao chat. Faz LEFT JOIN entre
 * user_profile e chat_access para que o admin possa liberar qualquer conta.
 */
export async function listChatAccess(): Promise<ChatAccessRow[]> {
  await requireAdmin()
  await ensureChatTables()
  const rows = await query<{
    email: string
    name: string | null
    enabled: boolean | null
    token_limit: string | null
    window_seconds: number | null
    model: string | null
    configured: boolean
  }>(`
    SELECT p.email,
           p.name,
           a.enabled,
           a.token_limit,
           a.window_seconds,
           a.model,
           (a.user_email IS NOT NULL) AS configured
    FROM public.user_profile p
    LEFT JOIN public.chat_access a ON a.user_email = p.email
    ORDER BY (a.user_email IS NOT NULL) DESC, p.email ASC
  `)

  const out: ChatAccessRow[] = []
  for (const r of rows) {
    const windowSeconds = r.window_seconds ?? DEFAULT_WINDOW_SECONDS
    const used = r.configured ? await getUsedTokens(r.email, windowSeconds) : 0
    out.push({
      email: r.email,
      name: r.name,
      enabled: r.enabled ?? false,
      configured: r.configured,
      tokenLimit: r.token_limit != null ? Number(r.token_limit) : DEFAULT_TOKEN_LIMIT,
      windowSeconds,
      model: r.model,
      usedTokens: used,
    })
  }
  return out
}

/** Cria/atualiza a configuracao de acesso ao chat de um usuario. */
export async function setChatAccess(
  email: string,
  opts: {
    enabled: boolean
    tokenLimit?: number
    windowSeconds?: number
    model?: string | null
  },
): Promise<{ ok: boolean }> {
  await requireAdmin()
  await ensureChatTables()
  const e = email.toLowerCase()
  const tokenLimit = Math.max(1, Math.round(opts.tokenLimit ?? DEFAULT_TOKEN_LIMIT))
  const windowSeconds = Math.max(60, Math.round(opts.windowSeconds ?? DEFAULT_WINDOW_SECONDS))
  const model = opts.model?.trim() || null
  await query(
    `INSERT INTO public.chat_access (user_email, enabled, token_limit, window_seconds, model, updated_at)
     VALUES ($1, $2, $3, $4, $5, now())
     ON CONFLICT (user_email) DO UPDATE
       SET enabled = EXCLUDED.enabled,
           token_limit = EXCLUDED.token_limit,
           window_seconds = EXCLUDED.window_seconds,
           model = EXCLUDED.model,
           updated_at = now()`,
    [e, opts.enabled, tokenLimit, windowSeconds, model],
  )
  revalidatePath("/admin")
  return { ok: true }
}

/** Zera o consumo de tokens de um usuario (libera a cota imediatamente). */
export async function resetChatUsage(email: string): Promise<{ ok: boolean }> {
  await requireAdmin()
  await ensureChatTables()
  await query(`DELETE FROM public.chat_usage WHERE user_email = $1`, [email.toLowerCase()])
  revalidatePath("/admin")
  return { ok: true }
}
