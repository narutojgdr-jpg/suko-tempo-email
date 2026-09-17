import type { Metadata } from "next"
import { getDictionary, isValidLocale, defaultLocale, locales } from "@/lib/i18n"
import { auth } from "@/lib/auth/server"
import { EmailPage } from "@/components/email-page"
import { query } from "@/lib/db"

// Session depends on cookies, so this route must render dynamically.
export const dynamic = "force-dynamic"

export async function generateStaticParams() {
  return locales.map((lang) => ({ lang }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>
}): Promise<Metadata> {
  const { lang } = await params
  const locale = isValidLocale(lang) ? lang : defaultLocale
  const dict = await getDictionary(locale)
  return {
    title: dict.metadata.title,
    description: dict.metadata.description,
  }
}

export default async function Page({
  params,
}: {
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  const locale = isValidLocale(lang) ? lang : defaultLocale
  const dict = await getDictionary(locale)

  // Get session if present — users don't need to log in to use the site,
  // but only logged-in users can access @gmail.com addresses.
  let session = null
  try {
    const result = await auth.getSession()
    session = result.data
  } catch {
    // Auth not configured (e.g. missing env vars in preview) — treat as logged out
  }

  // Busca saldo e VIP do usuario logado
  let balanceCents: number | undefined
  let isVip = false
  if (session?.user?.email) {
    try {
      const [profile] = await query<{ balance_cents: number; is_vip: boolean }>(
        `SELECT balance_cents, is_vip FROM public.user_profile WHERE email = $1`,
        [session.user.email],
      )
      balanceCents = profile?.balance_cents ?? 0
      isVip = profile?.is_vip ?? false
    } catch {
      // Ignora erros de db em preview
    }
  }

  // Preco do Gmail usado na compra. Comeca pelo preco global definido no admin.
  let gmailPriceCents = 0
  try {
    const [priceRow] = await query<{ value: string }>(
      `SELECT value FROM public.platform_settings WHERE key = 'gmail_price_cents'`,
    )
    gmailPriceCents = Math.max(0, Number(priceRow?.value ?? 0))
  } catch {
    // Ignora erros de db em preview
  }
  // Se o usuario logado tiver um preco PERSONALIZADO, ele tem prioridade.
  if (session?.user?.email) {
    try {
      const [userRow] = await query<{ gmail_price_cents: number | null }>(
        `SELECT gmail_price_cents FROM public.user_profile WHERE email = $1`,
        [session.user.email],
      )
      if (userRow?.gmail_price_cents != null) {
        gmailPriceCents = Math.max(0, Number(userRow.gmail_price_cents))
      }
    } catch {
      // Coluna pode nao existir ainda — mantem o preco global
    }
  }

  return (
    <EmailPage
      dict={dict}
      lang={locale}
      userName={session?.user?.name || session?.user?.email || undefined}
      userImage={session?.user?.image ?? null}
      isLoggedIn={!!session?.user}
      isVip={isVip}
      balanceCents={balanceCents}
      gmailPriceCents={gmailPriceCents}
    />
  )
}
