import type { Metadata } from "next"
import { isValidLocale, defaultLocale, locales } from "@/lib/i18n"
import { TotpGenerator } from "@/components/totp-generator"

export const dynamic = "force-dynamic"

export async function generateStaticParams() {
  return locales.map((lang) => ({ lang }))
}

export const metadata: Metadata = {
  title: "2FA — Infinity SuKo Shop",
  robots: { index: false, follow: false },
}

/**
 * Pagina 2FA: gerador de codigos TOTP no cliente (inspirado no 2fa.live).
 * O usuario cola a chave secreta Base32 e os codigos sao gerados/renovados
 * automaticamente. Acessivel em /infinity/2fa (middleware prefixa o idioma).
 */
export default async function Infinity2faRoute({
  params,
}: {
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  const locale = isValidLocale(lang) ? lang : defaultLocale

  return <TotpGenerator lang={locale} />
}
