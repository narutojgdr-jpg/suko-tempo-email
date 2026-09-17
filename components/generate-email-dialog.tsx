"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Mail, Lock, Sparkles, RefreshCw, Loader2, Wallet, ShoppingCart } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  OTHER_DOMAINS,
  buildOtherAddress,
  type EmailProvider,
} from "@/lib/email-config"
import { formatUsd } from "@/lib/money"
import { BlockedGmailDialog } from "@/components/blocked-gmail-dialog"
import type { Dictionary } from "@/lib/i18n"

// Dominios do Google que NAO podem ser digitados manualmente (anti-burla).
const BLOCKED_DOMAINS = ["gmail.com", "googlemail.com"]

interface GenerateEmailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onGenerate: (address: string, provider: EmailProvider) => void
  onBuyGmail: () => Promise<{ ok: boolean; error?: string; address?: string }>
  isLoggedIn: boolean
  isVip: boolean
  balanceCents: number
  gmailPriceCents: number
  savedAddresses: string[]
  generating: boolean
  dict: Dictionary
  onRequestVip: () => void
  onRequestDeposit: () => void
  onRequestLogin: () => void
}

const RANDOM_DOMAIN = "__random__"

export function GenerateEmailDialog({
  open,
  onOpenChange,
  onGenerate,
  onBuyGmail,
  isLoggedIn,
  isVip,
  balanceCents,
  gmailPriceCents,
  savedAddresses,
  generating,
  dict,
  onRequestVip,
  onRequestDeposit,
  onRequestLogin,
}: GenerateEmailDialogProps) {
  const g = dict.generate
  const [provider, setProvider] = useState<EmailProvider>("google")
  // Subtipo do Google: por enquanto so "alias" funciona; "real" fica "em breve".
  const [googleKind, setGoogleKind] = useState<"alias" | "real">("alias")
  const [otherDomain, setOtherDomain] = useState<string>(RANDOM_DOMAIN)
  const [otherUsername, setOtherUsername] = useState<string>("")
  const [candidate, setCandidate] = useState<string>("")
  const [error, setError] = useState<string | null>(null)
  const [buying, setBuying] = useState(false)
  const [blockedOpen, setBlockedOpen] = useState(false)

  const canAfford = balanceCents >= gmailPriceCents

  // Use a ref so savedAddresses never causes regenerate to be recreated
  const savedAddressesRef = useRef(savedAddresses)
  useEffect(() => { savedAddressesRef.current = savedAddresses }, [savedAddresses])

  // Ref do username digitado, para o regenerate ler o valor atual sem recriar
  const otherUsernameRef = useRef(otherUsername)
  useEffect(() => { otherUsernameRef.current = otherUsername }, [otherUsername])

  // Normaliza o username digitado (so caracteres validos de email)
  const slugify = (val: string) => val.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "")

  const regenerate = useCallback(
    async (prov: EmailProvider, domain: string) => {
      setError(null)
      if (prov === "other") {
        const d = domain === RANDOM_DOMAIN ? undefined : domain
        const slug = slugify(otherUsernameRef.current)
        if (slug) {
          // Username digitado: usa o dominio escolhido (ou um aleatorio se "todos")
          const dom = d ?? OTHER_DOMAINS[Math.floor(Math.random() * OTHER_DOMAINS.length)]
          setCandidate(`${slug}@${dom}`)
        } else {
          setCandidate(buildOtherAddress(d))
        }
      } else {
        // Google: o endereco nunca e exibido antes da compra
        setCandidate("")
      }
    },
    [],
  )

  // Generate a fresh candidate only when the dialog opens or provider/domain changes
  const prevOpenRef = useRef(false)
  useEffect(() => {
    const justOpened = open && !prevOpenRef.current
    prevOpenRef.current = open
    if (justOpened || open) regenerate(provider, otherDomain)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, provider, otherDomain])

  const handleProviderSelect = (prov: EmailProvider) => {
    if (prov === "microsoft") return // disabled (coming soon)
    setProvider(prov)
  }

  // Atualiza o email-alvo em tempo real conforme o usuario digita o username
  const handleUsernameChange = (val: string) => {
    setOtherUsername(val)
    const slug = slugify(val)
    let d = otherDomain === RANDOM_DOMAIN ? undefined : otherDomain
    if (!d) {
      // Mantem o dominio que ja esta no candidato atual, se valido; senao sorteia
      const cur = candidate.split("@")[1]
      d = cur && OTHER_DOMAINS.includes(cur) ? cur : OTHER_DOMAINS[Math.floor(Math.random() * OTHER_DOMAINS.length)]
    }
    setCandidate(slug ? `${slug}@${d}` : buildOtherAddress(otherDomain === RANDOM_DOMAIN ? undefined : otherDomain))
  }

  const handleGenerate = async () => {
    setError(null)
    if (provider === "microsoft") return

    if (provider === "google") {
      if (!isLoggedIn) {
        onOpenChange(false)
        onRequestLogin()
        return
      }
      if (!canAfford) {
        // Sem saldo suficiente -> leva para o deposito
        onRequestDeposit()
        return
      }
      // Compra: o endereco e revelado somente apos o pagamento
      setBuying(true)
      try {
        const res = await onBuyGmail()
        if (!res.ok) {
          if (res.error === "no_stock") setError(g.noGmailAvailable)
          else if (res.error === "insufficient") setError(g.insufficientBalance)
          else setError(g.purchaseError)
        }
      } catch {
        setError(g.purchaseError)
      } finally {
        setBuying(false)
      }
      return
    }

    if (provider === "other") {
      if (!isVip) {
        onOpenChange(false)
        onRequestVip()
        return
      }
      if (!candidate) {
        regenerate("other", otherDomain)
        return
      }
      // Aceita o email digitado pelo usuario, validando o formato basico
      const value = candidate.trim().toLowerCase()
      const at = value.lastIndexOf("@")
      if (at <= 0 || at === value.length - 1 || !value.slice(at + 1).includes(".")) {
        setError(dict.errors.invalidFormat)
        return
      }
      // Anti-burla: ninguem pode digitar um @gmail.com aqui para nao pagar
      const typedDomain = value.slice(at + 1)
      if (BLOCKED_DOMAINS.includes(typedDomain)) {
        setBlockedOpen(true)
        return
      }
      onGenerate(value, "other")
    }
  }

  const providerCards: {
    id: EmailProvider
    label: string
    tag: string
    tagClass: string
    disabled?: boolean
    locked?: boolean
  }[] = [
    {
      id: "google",
      label: "Google",
      tag: gmailPriceCents > 0 ? formatUsd(gmailPriceCents) : g.freemium,
      tagClass: "text-emerald-500",
    },
    { id: "microsoft", label: "Microsoft", tag: g.comingSoon, tagClass: "text-muted-foreground", disabled: true },
    { id: "other", label: "Other", tag: isVip ? g.vip : g.vipLocked, tagClass: "text-primary", locked: !isVip },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Mail className="h-5 w-5 text-primary" />
            {g.title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Email preview field */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">{g.emailLabel}</label>
              {provider === "other" && (
                <button
                  type="button"
                  onClick={() => regenerate(provider, otherDomain)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  <RefreshCw className="h-3 w-3" />
                  {g.regenerate}
                </button>
              )}
            </div>
            {provider === "google" ? (
              // Gmail e oculto ate a compra: o usuario nunca ve qual vai receber
              <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2.5">
                <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate font-mono text-sm tracking-wider text-muted-foreground">
                  {"•••••••••••@gmail.com"}
                </span>
              </div>
            ) : (
              // No "Other" o usuario pode DIGITAR o email completo ou gerar um.
              <div className="flex items-center rounded-lg border border-border bg-background px-3 py-2.5 focus-within:border-primary/50">
                <input
                  type="text"
                  value={candidate}
                  onChange={(e) => {
                    setError(null)
                    const next = e.target.value.trim().toLowerCase()
                    // Bloqueia na hora se tentar digitar um @gmail.com completo
                    const at = next.lastIndexOf("@")
                    if (at > 0 && BLOCKED_DOMAINS.includes(next.slice(at + 1))) {
                      setBlockedOpen(true)
                      return
                    }
                    setCandidate(next)
                  }}
                  placeholder={g.emailPlaceholder}
                  className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
            )}
            {provider === "google" && (
              <p className="mt-1.5 text-[11px] text-muted-foreground">{g.revealedAfterPurchase}</p>
            )}
          </div>

          {/* Email Type */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{g.emailType}</label>
            <div className="grid grid-cols-3 gap-2">
              {providerCards.map((card) => {
                const selected = provider === card.id
                return (
                  <button
                    key={card.id}
                    type="button"
                    onClick={() => handleProviderSelect(card.id)}
                    disabled={card.disabled}
                    className={`relative flex flex-col items-center justify-center gap-0.5 rounded-lg border px-2 py-3 text-center transition-colors ${
                      selected
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50 hover:bg-muted/50"
                    } ${card.disabled ? "cursor-not-allowed opacity-50" : ""}`}
                  >
                    {card.locked && (
                      <Lock className="absolute right-1.5 top-1.5 h-3 w-3 text-muted-foreground" />
                    )}
                    <span className="text-sm font-semibold text-foreground">{card.label}</span>
                    <span className={`text-[10px] font-medium ${card.tagClass}`}>{card.tag}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Google sub-tipo: Aliases (ativo) vs Gmail real (em breve) */}
          {provider === "google" && (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{g.googleKindLabel}</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setGoogleKind("alias")}
                  className={`flex flex-col items-center justify-center gap-0.5 rounded-lg border px-2 py-2.5 text-center transition-colors ${
                    googleKind === "alias"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50 hover:bg-muted/50"
                  }`}
                >
                  <span className="text-sm font-semibold text-foreground">{g.aliases}</span>
                  <span className="text-[10px] font-medium text-emerald-500">
                    {gmailPriceCents > 0 ? formatUsd(gmailPriceCents) : g.freemium}
                  </span>
                </button>
                <button
                  type="button"
                  disabled
                  className="relative flex cursor-not-allowed flex-col items-center justify-center gap-0.5 rounded-lg border border-border px-2 py-2.5 text-center opacity-50"
                >
                  <Lock className="absolute right-1.5 top-1.5 h-3 w-3 text-muted-foreground" />
                  <span className="text-sm font-semibold text-foreground">{g.realGmail}</span>
                  <span className="text-[10px] font-medium text-muted-foreground">{g.comingSoon}</span>
                </button>
              </div>
            </div>
          )}

          {/* Domain (Google = gmail.com fixed; Other = dropdown) */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{g.domain}</label>
            {provider === "google" ? (
              <div className="flex items-center rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-sm text-foreground">
                gmail.com
              </div>
            ) : provider === "other" ? (
              <Select value={otherDomain} onValueChange={setOtherDomain}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  <SelectItem value={RANDOM_DOMAIN}>
                    {g.randomDomain} ({OTHER_DOMAINS.length})
                  </SelectItem>
                  {OTHER_DOMAINS.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="flex items-center rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-sm text-muted-foreground">
                {g.comingSoon}
              </div>
            )}
          </div>

          {/* Username (only for Other / VIP — lets the user type a custom name) */}
          {provider === "other" && isVip && (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                {g.usernameLabel}
              </label>
              <div className="flex items-center rounded-lg border border-border bg-background focus-within:border-primary/50">
                <input
                  type="text"
                  value={otherUsername}
                  onChange={(e) => handleUsernameChange(e.target.value)}
                  placeholder={g.usernamePlaceholder}
                  className="w-full bg-transparent px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground"
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
            </div>
          )}

          {/* Price + balance summary (Google purchase) */}
          {provider === "google" && isLoggedIn && (
            <div className="space-y-2 rounded-lg border border-border bg-muted/30 px-3 py-2.5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{g.price}</span>
                <span className="font-semibold text-foreground">
                  {gmailPriceCents > 0 ? formatUsd(gmailPriceCents) : g.freemium}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{g.yourBalance}</span>
                <span className={`font-semibold ${canAfford ? "text-emerald-500" : "text-rose-500"}`}>
                  {formatUsd(balanceCents)}
                </span>
              </div>
              {!canAfford && (
                <p className="text-xs text-rose-500">{g.insufficientBalance}</p>
              )}
            </div>
          )}

          {/* Inline notices */}
          {provider === "other" && !isVip && (
            <div className="flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-foreground">
              <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
              <span>{g.otherVipNotice}</span>
            </div>
          )}
          {provider === "google" && !isLoggedIn && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-foreground">
              <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
              <span>{g.googleLoginNotice}</span>
            </div>
          )}
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            {g.cancel}
          </button>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating || buying || provider === "microsoft"}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {generating || buying ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {buying ? g.purchasing : g.generating}
              </>
            ) : provider === "google" && isLoggedIn && !canAfford ? (
              <>
                <Wallet className="h-4 w-4" />
                {g.addBalance}
              </>
            ) : provider === "google" && gmailPriceCents > 0 ? (
              <>
                <ShoppingCart className="h-4 w-4" />
                {g.buyGmail}
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                {g.generate}
              </>
            )}
          </button>
        </DialogFooter>
      </DialogContent>

      <BlockedGmailDialog
        open={blockedOpen}
        onClose={() => setBlockedOpen(false)}
        title={g.blockedTitle}
        message={g.blockedMessage}
        buttonLabel={g.blockedButton}
      />
    </Dialog>
  )
}
