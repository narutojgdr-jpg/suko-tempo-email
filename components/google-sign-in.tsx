"use client"

import { useState } from "react"
import { ShieldCheck } from "lucide-react"
import { authClient } from "@/lib/auth/client"

interface GoogleSignInProps {
  /** Where to land after a successful sign-in (e.g. "/pt"). */
  callbackURL: string
  label: string
  loadingLabel: string
  /** Shown when running inside the v0 preview iframe. */
  newTabNotice: string
  /** Texto do selo de seguranca (Neon). */
  secureTitle: string
}

export function GoogleSignIn({ callbackURL, label, loadingLabel, newTabNotice, secureTitle }: GoogleSignInProps) {
  const [loading, setLoading] = useState(false)
  const [framed, setFramed] = useState(false)

  const handleClick = async () => {
    setLoading(true)
    try {
      // authClient.signIn.social returns a redirect URL for OAuth.
      // When inside the v0 preview iframe we open that URL in a new top-level
      // tab because Google refuses to load its consent screen inside a
      // cross-site iframe (X-Frame-Options). Outside the iframe we let the
      // SDK handle the navigation normally.
      const inIframe = typeof window !== "undefined" && window.self !== window.top

      if (inIframe) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result: any = await authClient.signIn.social({
          provider: "google",
          callbackURL,
          disableRedirect: true,
        })
        const oauthUrl: string | undefined = result?.data?.url
        setFramed(true)
        window.open(oauthUrl ?? window.location.href, "_blank", "noopener,noreferrer")
        setLoading(false)
        return
      }

      await authClient.signIn.social({ provider: "google", callbackURL })
    } catch {
      setLoading(false)
    }
  }

  return (
    <div className="flex w-full flex-col items-center gap-3">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="flex w-full items-center justify-center gap-3 rounded-lg border border-border bg-card px-4 py-3 text-sm font-medium text-card-foreground transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60"
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"
          />
        </svg>
        <span>{loading ? loadingLabel : label}</span>
      </button>

      {/* Selo de seguranca (Neon) */}
      <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
        <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
        <span>{secureTitle}</span>
      </div>

      {framed && <p className="text-center text-xs text-muted-foreground">{newTabNotice}</p>}
    </div>
  )
}
