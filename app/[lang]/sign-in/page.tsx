import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { auth } from "@/lib/auth/server"
import { getDictionary, isValidLocale, defaultLocale } from "@/lib/i18n"
import { GoogleSignIn } from "@/components/google-sign-in"
import { EmailPasswordAuth } from "@/components/email-password-auth"

export const dynamic = "force-dynamic"

export default async function SignInPage({
  params,
}: {
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  const locale = isValidLocale(lang) ? lang : defaultLocale
  const dict = await getDictionary(locale)

  const { data: session } = await auth.getSession()
  if (session?.user) {
    redirect(`/${locale}`)
  }

  // Build an absolute callbackURL so Neon Auth knows which domain to redirect
  // back to after the OAuth flow. A relative path like "/pt" would be resolved
  // against the Neon Auth base URL, not our app, leaving the user stranded.
  const headersList = await headers()
  const host = headersList.get("x-forwarded-host") ?? headersList.get("host") ?? "localhost:3000"
  const proto = headersList.get("x-forwarded-proto") ?? "https"
  const callbackURL = `${proto}://${host}/${locale}`

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center px-6 py-3" style={{ backgroundColor: "#6b46c1" }}>
        <span className="text-xl font-bold tracking-tight text-white">{dict.header.brand}</span>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm space-y-6 rounded-2xl border border-border bg-card/40 p-8 text-center">
          <div className="space-y-2">
            <h1 className="text-balance text-2xl font-bold tracking-tight text-foreground">
              {dict.auth.title}
            </h1>
            <p className="text-pretty text-sm text-muted-foreground">{dict.auth.subtitle}</p>
          </div>

          <EmailPasswordAuth callbackURL={callbackURL} lang={locale} />

          <GoogleSignIn
            callbackURL={callbackURL}
            label={dict.auth.googleButton}
            loadingLabel={dict.auth.googleLoading}
            newTabNotice={dict.auth.newTabNotice}
            secureTitle={dict.auth.secureTitle}
          />

          <p className="text-pretty text-xs text-muted-foreground">{dict.auth.terms}</p>
        </div>
      </main>
    </div>
  )
}
