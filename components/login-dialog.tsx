"use client"

import { useState } from "react"
import { ShieldCheck, Lock, X } from "lucide-react"
import { authClient } from "@/lib/auth/client"
import { EmailPasswordAuth } from "@/components/email-password-auth"

export interface LoginTexts {
  /** Onde cair apos login (ex.: "/pt"). */
  callbackURL: string
  /** Idioma da UI para os textos do formulario de email/senha. */
  lang: string
  label: string
  loadingLabel: string
  newTabNotice: string
  secureTitle: string
  secureDesc: string
  securePoint1: string
  securePoint2: string
  cancelLabel: string
}

interface LoginDialogProps extends LoginTexts {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function GoogleIcon() {
  return (
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
  )
}

/**
 * Popup de login com Google (negociado pela Neon). Acionado a partir do botao
 * "Entrar" no header — nao e um popup dentro da pagina de login.
 */
export function LoginDialog({
  open,
  onOpenChange,
  callbackURL,
  lang,
  label,
  loadingLabel,
  newTabNotice,
  secureTitle,
  secureDesc,
  securePoint1,
  securePoint2,
  cancelLabel,
}: LoginDialogProps) {
  const [loading, setLoading] = useState(false)
  const [framed, setFramed] = useState(false)

  const startSignIn = async () => {
    setLoading(true)
    try {
      // Dentro do iframe de preview, o Google recusa carregar o consentimento
      // (X-Frame-Options), entao abrimos a URL de OAuth numa nova aba.
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

  if (!open) return null

  return (
    <div
      className="animate-overlay-in fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={() => !loading && onOpenChange(false)}
    >
      <div
        className="animate-scale-in relative w-full max-w-sm rounded-2xl border border-border bg-card p-6 text-center shadow-soft-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => !loading && onOpenChange(false)}
          className="absolute right-3 top-3 rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label={cancelLabel}
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10">
          <ShieldCheck className="h-6 w-6 text-emerald-500" />
        </div>
        <h3 className="mt-3 text-base font-bold text-foreground">{secureTitle}</h3>
        <p className="mt-1 text-pretty text-sm text-muted-foreground">{secureDesc}</p>

        <div className="mt-4 space-y-2 text-left">
          <div className="flex items-start gap-2 rounded-lg border border-border bg-background p-2.5">
            <Lock className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
            <span className="text-xs text-muted-foreground">{securePoint1}</span>
          </div>
          <div className="flex items-start gap-2 rounded-lg border border-border bg-background p-2.5">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
            <span className="text-xs text-muted-foreground">{securePoint2}</span>
          </div>
        </div>

        {/* Login por email e senha (inclui o divisor "ou" ao final) */}
        <div className="mt-5">
          <EmailPasswordAuth callbackURL={callbackURL} lang={lang} />
        </div>

        <button
          type="button"
          onClick={startSignIn}
          disabled={loading}
          className="flex w-full items-center justify-center gap-3 rounded-lg border border-border bg-background px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60"
        >
          <GoogleIcon />
          <span>{loading ? loadingLabel : label}</span>
        </button>

        {framed && <p className="mt-3 text-xs text-muted-foreground">{newTabNotice}</p>}

        <p className="mt-3 flex items-center justify-center gap-1 text-[11px] text-muted-foreground">
          <span>Powered by</span>
          <span className="font-semibold text-foreground">Neon Auth</span>
        </p>
      </div>
    </div>
  )
}
