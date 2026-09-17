import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth/server"
import {
  locales,
  defaultLocale,
  countryToLocale,
  acceptLanguageToLocale,
} from "@/lib/i18n"

// The query param Neon Auth appends to the callback URL when the OAuth flow
// returns. Its presence means we must run the Neon middleware so it can
// exchange the verifier for a real session cookie (this is the step that was
// missing — without it the session is created server-side but the cookie is
// never set in the browser, so the user always appears logged out).
const NEON_AUTH_VERIFIER_PARAM = "neon_auth_session_verifier"

export async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl

  // 1. OAuth callback completion: let Neon Auth mint the session cookie.
  if (searchParams.has(NEON_AUTH_VERIFIER_PARAM)) {
    const localeForLogin =
      locales.find((l) => pathname.startsWith(`/${l}`)) ?? defaultLocale
    const neonMiddleware = auth.middleware({ loginUrl: `/${localeForLogin}/sign-in` })
    return neonMiddleware(request)
  }

  // 2. Path already has a locale — set a cookie so the layout can read it.
  const pathnameLocale = locales.find(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  )

  if (pathnameLocale) {
    const response = NextResponse.next()
    response.cookies.set("NEXT_LOCALE", pathnameLocale, { path: "/" })
    return response
  }

  // 3. Detect the best locale for this visitor and redirect.
  let detectedLocale = defaultLocale

  const country = request.headers.get("x-vercel-ip-country")
  if (country) {
    detectedLocale = countryToLocale(country)
  } else {
    const acceptLang = request.headers.get("accept-language")
    if (acceptLang) {
      detectedLocale = acceptLanguageToLocale(acceptLang)
    }
  }

  const url = request.nextUrl.clone()
  url.pathname = `/${detectedLocale}${pathname}`
  const response = NextResponse.redirect(url)
  response.cookies.set("NEXT_LOCALE", detectedLocale, { path: "/" })
  return response
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - /api          (API routes including /api/auth/*)
     * - /auth         (Neon Auth OAuth callback lands at /auth/callback)
     * - /admin        (internal admin panel, not localized)
     * - /revendedor   (public reseller pages, not localized)
     * - /_next        (Next.js internals)
     * - Static files  (.png, .jpg, etc.)
     */
    "/((?!api|auth|admin|revendedor|_next/static|_next/image|favicon\\.ico|robots\\.txt|sitemap\\.xml|.*\\..*).*)",
  ],
}
