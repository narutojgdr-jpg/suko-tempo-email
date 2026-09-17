import { redirect } from "next/navigation"
import { auth } from "@/lib/auth/server"
import { getDictionary, isValidLocale, defaultLocale } from "@/lib/i18n"
import { ADMIN_EMAIL } from "@/lib/admin"
import { getProfileData, listProductAccounts, listProductTemplates } from "@/app/actions/profile"
import { OTHER_DOMAINS } from "@/lib/email-config"
import { ProfilePage } from "@/components/profile-page"

export const dynamic = "force-dynamic"

export default async function Profile({
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

  const profile = await getProfileData()
  const productAccounts = await listProductAccounts()
  const productTemplates = await listProductTemplates()

  return (
    <ProfilePage
      dict={dict}
      lang={locale}
      user={{
        name: session.user.name ?? null,
        email: session.user.email ?? null,
        image: session.user.image ?? null,
      }}
      isAdmin={session.user.email?.toLowerCase() === ADMIN_EMAIL}
      profile={profile}
      customDomains={OTHER_DOMAINS}
      productAccounts={productAccounts}
      productTemplates={productTemplates}
    />
  )
}
