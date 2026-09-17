import { notFound } from "next/navigation"
import { getResellerPageByKey } from "@/app/actions/reseller"
import { getDictionary, isValidLocale } from "@/lib/i18n"
import { OTHER_DOMAINS } from "@/lib/email-config"
import { ResellerPage } from "@/components/reseller-page"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "Revendedor — SuKo Shop",
  robots: { index: false, follow: false },
}

/**
 * URL limpa do revendedor: /{lang}/{slug} (ex.: /pt/suko).
 * Rotas estaticas sob [lang] (infinity, profile, chat, sign-in) tem prioridade
 * sobre este segmento dinamico, entao nao ha conflito.
 */
export default async function ResellerLangRoute({
  params,
}: {
  params: Promise<{ lang: string; reseller: string }>
}) {
  const { lang, reseller } = await params
  if (!isValidLocale(lang)) notFound()

  const page = await getResellerPageByKey(reseller)
  if (!page) notFound()

  const dict = await getDictionary(lang)

  return (
    <ResellerPage
      pageKey={page.key}
      name={page.name}
      allowedGmails={page.gmails}
      domains={OTHER_DOMAINS}
      dict={dict}
    />
  )
}
