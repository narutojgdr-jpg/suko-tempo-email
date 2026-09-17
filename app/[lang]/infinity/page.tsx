import type { Metadata } from "next"
import { getDictionary, isValidLocale, defaultLocale, locales } from "@/lib/i18n"
import { OTHER_DOMAINS } from "@/lib/email-config"
import { ResellerPage } from "@/components/reseller-page"

export const dynamic = "force-dynamic"

export async function generateStaticParams() {
  return locales.map((lang) => ({ lang }))
}

export const metadata: Metadata = {
  title: "Infinity — SuKo Shop",
  robots: { index: false, follow: false },
}

/**
 * Pagina Infinity: acesso livre. Sem lista de emails liberados — qualquer
 * endereco (Gmail, Outlook/Hotmail ou dominio proprio) pode ser consultado.
 * Acessivel diretamente em /infinity (o middleware prefixa o idioma: /en/infinity, /pt/infinity...).
 */
export default async function InfinityRoute({
  params,
}: {
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  const locale = isValidLocale(lang) ? lang : defaultLocale
  const dict = await getDictionary(locale)

  return (
    <ResellerPage
      pageKey="infinity"
      name="Infinity SuKo"
      allowedGmails={[]}
      domains={OTHER_DOMAINS}
      dict={dict}
      unrestricted
    />
  )
}
