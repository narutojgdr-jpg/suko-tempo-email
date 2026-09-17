import { streamText, convertToModelMessages, type UIMessage } from "ai"
import { query } from "@/lib/db"
import { getSessionEmail } from "@/lib/admin"
import {
  ensureChatTables,
  getChatAccess,
  getUsedTokens,
  recordUsage,
  DEFAULT_CHAT_MODEL,
} from "@/lib/chat"

export const maxDuration = 60

const SYSTEM_PROMPT =
  "Você é o assistente do SuKo Shop, um assistente de IA útil, direto e amigável. " +
  "Responda no idioma do usuário. Use Markdown quando ajudar a clareza (listas, código, títulos)."

/** Extrai o texto de uma UIMessage (que guarda o conteudo em `parts`). */
function getText(msg: UIMessage): string {
  if (!msg?.parts || !Array.isArray(msg.parts)) return ""
  return msg.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("")
}

export async function POST(req: Request) {
  const email = await getSessionEmail()
  if (!email) {
    return new Response(JSON.stringify({ error: "not_logged_in" }), { status: 401 })
  }

  // 1. Acesso: o usuario precisa ter sido liberado pelo admin.
  const access = await getChatAccess(email)
  if (!access || !access.enabled) {
    return new Response(JSON.stringify({ error: "no_access" }), { status: 403 })
  }

  // 2. Cota: bloqueia se ja estourou o limite de tokens da janela atual.
  const used = await getUsedTokens(email, access.windowSeconds)
  if (used >= access.tokenLimit) {
    return new Response(JSON.stringify({ error: "quota_exceeded" }), { status: 429 })
  }

  const body = await req.json()
  const messages: UIMessage[] = Array.isArray(body?.messages) ? body.messages : []
  let conversationId: number | null = body?.conversationId ? Number(body.conversationId) : null

  await ensureChatTables()

  // Garante uma conversa do usuario para persistir o historico.
  if (conversationId) {
    const [owner] = await query<{ id: string }>(
      `SELECT id FROM public.chat_conversation WHERE id = $1 AND user_email = $2`,
      [conversationId, email],
    )
    if (!owner) conversationId = null
  }
  if (!conversationId) {
    const [row] = await query<{ id: string }>(
      `INSERT INTO public.chat_conversation (user_email) VALUES ($1) RETURNING id`,
      [email],
    )
    conversationId = row ? Number(row.id) : null
  }

  // Persiste a ultima mensagem do usuario e nomeia a conversa se for a primeira.
  const lastUser = [...messages].reverse().find((m) => m.role === "user")
  const lastUserText = lastUser ? getText(lastUser) : ""
  if (conversationId && lastUserText) {
    await query(
      `INSERT INTO public.chat_message (conversation_id, role, content) VALUES ($1, 'user', $2)`,
      [conversationId, lastUserText],
    )
    await query(
      `UPDATE public.chat_conversation
       SET updated_at = now(),
           title = CASE WHEN title = 'Nova conversa' THEN $2 ELSE title END
       WHERE id = $1`,
      [conversationId, lastUserText.slice(0, 80)],
    )
  }

  const cid = conversationId

  const result = streamText({
    model: access.model || DEFAULT_CHAT_MODEL,
    system: SYSTEM_PROMPT,
    messages: await convertToModelMessages(messages),
    onFinish: async ({ text, usage }) => {
      try {
        // Registra o consumo de tokens (entra na janela da cota).
        const total =
          usage?.totalTokens ??
          (Number(usage?.inputTokens ?? 0) + Number(usage?.outputTokens ?? 0))
        await recordUsage(email, total)
        // Persiste a resposta do assistente.
        if (cid && text) {
          await query(
            `INSERT INTO public.chat_message (conversation_id, role, content) VALUES ($1, 'assistant', $2)`,
            [cid, text],
          )
          await query(`UPDATE public.chat_conversation SET updated_at = now() WHERE id = $1`, [cid])
        }
      } catch (err) {
        console.log("[v0] chat onFinish persist error:", err instanceof Error ? err.message : err)
      }
    },
  })

  return result.toUIMessageStreamResponse({
    headers: { "x-conversation-id": String(cid ?? "") },
  })
}
