import { redirect } from "next/navigation"
import type { Metadata } from "next"
import { auth } from "@/lib/auth/server"
import { getDictionary, isValidLocale, defaultLocale } from "@/lib/i18n"
import { ADMIN_EMAIL } from "@/lib/admin"
import { getChatState } from "@/app/actions/chat"
import { ChatApp } from "@/components/chat/chat-app"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "SuKo AI — Chat",
  description: "Assistente de IA do SuKo Shop.",
}

export default async function ChatPage({
  params,
}: {
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  const locale = isValidLocale(lang) ? lang : defaultLocale
  const dict = await getDictionary(locale)

  const { data: session } = await auth.getSession()
  if (!session?.user) {
    redirect(`/${locale}/sign-in`)
  }

  const state = await getChatState()

  return (
    <ChatApp
      lang={locale}
      dict={dict}
      user={{
        name: session.user.name ?? null,
        email: session.user.email ?? null,
        image: session.user.image ?? null,
      }}
      isAdmin={session.user.email?.toLowerCase() === ADMIN_EMAIL}
      initialQuota={state.quota}
      initialConversations={state.conversations}
    />
  )
}
