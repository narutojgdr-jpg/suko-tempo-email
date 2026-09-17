"use server"

import { query } from "@/lib/db"
import { getSessionEmail } from "@/lib/admin"
import { ensureChatTables, getChatQuota, type ChatQuota } from "@/lib/chat"

export type ConversationSummary = {
  id: number
  title: string
  updatedAt: string
}

export type ChatMessageRow = {
  id: number
  role: "user" | "assistant"
  content: string
  createdAt: string
}

/** Estado do chat para o usuario logado: acesso, cota e conversas. */
export async function getChatState(): Promise<{
  email: string | null
  quota: ChatQuota | null
  conversations: ConversationSummary[]
}> {
  const email = await getSessionEmail()
  if (!email) return { email: null, quota: null, conversations: [] }
  const quota = await getChatQuota(email)
  const conversations = quota.hasAccess ? await listConversations() : []
  return { email, quota, conversations }
}

/** Lista as conversas do usuario logado (mais recentes primeiro). */
export async function listConversations(): Promise<ConversationSummary[]> {
  const email = await getSessionEmail()
  if (!email) return []
  await ensureChatTables()
  const rows = await query<{ id: string; title: string; updated_at: string }>(
    `SELECT id, title, updated_at FROM public.chat_conversation
     WHERE user_email = $1 ORDER BY updated_at DESC LIMIT 100`,
    [email],
  )
  return rows.map((r) => ({ id: Number(r.id), title: r.title, updatedAt: r.updated_at }))
}

/** Carrega as mensagens de uma conversa (apenas se pertencer ao usuario). */
export async function getConversationMessages(conversationId: number): Promise<ChatMessageRow[]> {
  const email = await getSessionEmail()
  if (!email) return []
  await ensureChatTables()
  const [owner] = await query<{ id: string }>(
    `SELECT id FROM public.chat_conversation WHERE id = $1 AND user_email = $2`,
    [conversationId, email],
  )
  if (!owner) return []
  const rows = await query<{ id: string; role: string; content: string; created_at: string }>(
    `SELECT id, role, content, created_at FROM public.chat_message
     WHERE conversation_id = $1 ORDER BY created_at ASC, id ASC`,
    [conversationId],
  )
  return rows.map((r) => ({
    id: Number(r.id),
    role: r.role === "assistant" ? "assistant" : "user",
    content: r.content,
    createdAt: r.created_at,
  }))
}

/** Cria uma nova conversa vazia e retorna o id. */
export async function createConversation(): Promise<{ id: number } | null> {
  const email = await getSessionEmail()
  if (!email) return null
  await ensureChatTables()
  const [row] = await query<{ id: string }>(
    `INSERT INTO public.chat_conversation (user_email) VALUES ($1) RETURNING id`,
    [email],
  )
  return row ? { id: Number(row.id) } : null
}

/** Renomeia uma conversa do usuario. */
export async function renameConversation(conversationId: number, title: string): Promise<{ ok: boolean }> {
  const email = await getSessionEmail()
  if (!email) return { ok: false }
  await ensureChatTables()
  const clean = title.trim().slice(0, 120) || "Nova conversa"
  await query(
    `UPDATE public.chat_conversation SET title = $3, updated_at = now()
     WHERE id = $1 AND user_email = $2`,
    [conversationId, email, clean],
  )
  return { ok: true }
}

/** Apaga uma conversa do usuario (e suas mensagens, via ON DELETE CASCADE). */
export async function deleteConversation(conversationId: number): Promise<{ ok: boolean }> {
  const email = await getSessionEmail()
  if (!email) return { ok: false }
  await ensureChatTables()
  await query(`DELETE FROM public.chat_conversation WHERE id = $1 AND user_email = $2`, [
    conversationId,
    email,
  ])
  return { ok: true }
}
