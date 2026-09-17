"use client"

import { useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { ChevronDown, Globe, LogIn, LogOut, Crown, Sparkles } from "lucide-react"
import { authClient } from "@/lib/auth/client"

const languages = [
  { code: "en", label: "English" },
  { code: "pt", label: "Portugu\u00eas" },
  { code: "ru", label: "\u0420\u0443\u0441\u0441\u043a\u0438\u0439" },
]

interface SiteHeaderProps {
  lang: string
  userName?: string
  userImage?: string | null
  signInLabel?: string
  signOutLabel?: string
  isLoggedIn?: boolean
  vipLabel?: string
  isVip?: boolean
  onVipClick?: () => void
  /** Saldo em centavos para exibir badge no header */
  balanceCents?: number
  /** Se fornecido, o botao "Entrar" abre este popup em vez de navegar */
  onSignInClick?: () => void
  /** Se fornecido, clicar no saldo abre a recarga em vez de ir ao perfil */
  onBalanceClick?: () => void
  /** Texto curto para saldo zerado (ex.: "Recarregar") */
  rechargeLabel?: string
}

function formatUsdShort(cents: number) {
  const usd = cents / 100
  return usd.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 })
}

export function SiteHeader({ lang, userName, userImage, signInLabel, signOutLabel, isLoggedIn = false, vipLabel, isVip = false, onVipClick, balanceCents, onSignInClick, onBalanceClick, rechargeLabel }: SiteHeaderProps) {
  const [open, setOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const router = useRouter()
  const pathname = usePathname()

  const selected = languages.find((l) => l.code === lang) ?? languages[0]

  const switchLocale = (code: string) => {
    // Replace the current locale segment in the path
    const newPath = pathname.replace(/^\/(en|pt|ru)/, `/${code}`)
    router.push(newPath)
    setOpen(false)
  }

  const handleSignOut = async () => {
    setSigningOut(true)
    try {
      await authClient.signOut()
    } finally {
      router.replace(`/${lang}/sign-in`)
      router.refresh()
    }
  }

  return (
    <header className="sticky top-0 z-40 flex items-center justify-between px-6 py-3 shadow-soft" style={{ backgroundColor: "#6b46c1" }}>
      <div className="flex items-center gap-2">
        <a
          href={`/${lang}`}
          className="rounded-lg text-xl font-bold tracking-tight text-white transition-opacity hover:opacity-80"
          aria-label="SuKo Shop — ir para a pagina inicial"
        >
          SuKo Shop
        </a>
      </div>

      <div className="flex items-center gap-2">
        {isLoggedIn && (
          <a
            href={`/${lang}/chat`}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-white/90 transition-colors hover:bg-white/10"
            aria-label="SuKo AI"
          >
            <Sparkles className="h-4 w-4" />
            <span className="hidden sm:inline">SuKo AI</span>
          </a>
        )}

        {onVipClick && (
          <button
            onClick={onVipClick}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
              isVip
                ? "bg-amber-400 text-amber-950 hover:bg-amber-300"
                : "border border-amber-400/60 text-amber-300 hover:bg-amber-400/10"
            }`}
          >
            <Crown className="h-4 w-4" />
            <span className="hidden sm:inline">{isVip ? "VIP" : vipLabel ?? "Get VIP"}</span>
          </button>
        )}

        <div className="relative">
          <button
            onClick={() => setOpen(!open)}
            className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-white/90 transition-colors hover:bg-white/10"
            aria-label="Select language"
          >
            <Globe className="h-4 w-4" />
            <span>{selected.label}</span>
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
          </button>

          {open && (
            <div className="animate-dropdown-in absolute right-0 top-full z-50 mt-1 w-40 overflow-hidden rounded-lg border border-border bg-card shadow-soft-lg">
              {languages.map((l) => (
                <button
                  key={l.code}
                  onClick={() => switchLocale(l.code)}
                  className={`flex w-full items-center px-3 py-2 text-sm transition-colors hover:bg-secondary ${
                    selected.code === l.code ? "text-accent" : "text-card-foreground"
                  }`}
                >
                  {l.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {!isLoggedIn &&
          (onSignInClick ? (
            <button
              onClick={onSignInClick}
              className="flex items-center gap-1.5 rounded-lg border border-white/30 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-white/10"
            >
              <LogIn className="h-4 w-4" />
              <span>{signInLabel ?? "Sign in"}</span>
            </button>
          ) : (
            <a
              href={`/${lang}/sign-in`}
              className="flex items-center gap-1.5 rounded-lg border border-white/30 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-white/10"
            >
              <LogIn className="h-4 w-4" />
              <span>{signInLabel ?? "Sign in"}</span>
            </a>
          ))}

        {userName && (
          <div className="flex items-center gap-2 border-l border-white/20 pl-2">
            {/* Badge de saldo — clica para recarregar */}
            {balanceCents !== undefined &&
              (onBalanceClick ? (
                <button
                  onClick={onBalanceClick}
                  className="hidden items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-xs font-semibold text-white transition-colors hover:bg-white/25 sm:flex"
                  title="Seu saldo — clique para recarregar"
                >
                  {balanceCents <= 0 ? (rechargeLabel ?? "Recharge") : formatUsdShort(balanceCents)}
                </button>
              ) : (
                <a
                  href={`/${lang}/profile`}
                  className="hidden items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-xs font-semibold text-white transition-colors hover:bg-white/25 sm:flex"
                  title="Seu saldo — clique para recarregar"
                >
                  {balanceCents <= 0 ? (rechargeLabel ?? "Recharge") : formatUsdShort(balanceCents)}
                </a>
              ))}
            <a
              href={`/${lang}/profile`}
              className="animate-press flex items-center gap-2 rounded-lg px-1.5 py-1 transition-fluid hover:bg-white/10 active:scale-95"
              aria-label="Ver perfil"
            >
              {userImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={userImage || "/placeholder.svg"}
                  alt={userName}
                  className="h-7 w-7 rounded-full border border-white/30 object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-xs font-semibold text-white">
                  {userName.charAt(0).toUpperCase()}
                </span>
              )}
              <span className="hidden max-w-[10rem] truncate text-sm font-medium text-white/90 sm:inline">
                {userName}
              </span>
            </a>
            <button
              onClick={handleSignOut}
              disabled={signingOut}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-white/90 transition-colors hover:bg-white/10 disabled:opacity-60"
              aria-label={signOutLabel ?? "Sign out"}
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">{signOutLabel ?? "Sign out"}</span>
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
