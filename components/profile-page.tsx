"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { LogOut, Mail, ShieldCheck, Wallet, TrendingDown, Hash, AtSign, Copy, Check, Inbox, Crown, Plus, Loader2, Trash2, LayoutGrid, Package } from "lucide-react"
import { authClient } from "@/lib/auth/client"
import { SiteHeader } from "@/components/site-header"
import { ProfileInboxModal } from "@/components/profile-inbox-modal"
import { addCustomDomainEmail, removeGeneratedEmail, saveProductAccount, type ProfileData } from "@/app/actions/profile"
import { ProductsTab } from "@/components/products-tab"
import { GmailActionsMenu } from "@/components/gmail-actions-menu"
import type { ProductAccount, ProductSlug } from "@/lib/products"
import { CryptoPaymentModal } from "@/components/crypto-payment-modal"
import { formatUsd } from "@/lib/money"
import type { Dictionary } from "@/lib/i18n"

interface ProfilePageProps {
  dict: Dictionary
  lang: string
  user: {
    name: string | null
    email: string | null
    image: string | null
  }
  isAdmin?: boolean
  profile: ProfileData | null
  customDomains: string[]
  productAccounts?: ProductAccount[]
  productTemplates?: Record<string, string>
}

export function ProfilePage({ dict, lang, user, isAdmin = false, profile, customDomains, productAccounts = [], productTemplates = {} }: ProfilePageProps) {
  const p = dict.profile
  const [signingOut, setSigningOut] = useState(false)
  const [activeTab, setActiveTab] = useState<"overview" | "products">("overview")
  const [inboxEmail, setInboxEmail] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [removing, setRemoving] = useState<string | null>(null)
  const [history, setHistory] = useState(profile?.history ?? [])
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [balance, setBalance] = useState(profile?.balanceCents ?? 0)
  const [initialProduct, setInitialProduct] = useState<ProductSlug | null>(null)
  const router = useRouter()

  // Cria um card para o gmail no produto escolhido e leva o usuario ate la.
  const handleMoveToProduct = async (address: string, slug: ProductSlug) => {
    if (!isVip) {
      toast.error(p.vipRequiredMsg)
      return false
    }
    const res = await saveProductAccount({
      product: slug,
      email: address,
      password: "",
      twofa: "",
      recovery: "",
    })
    if (res.ok) {
      setInitialProduct(slug)
      setActiveTab("products")
      router.refresh()
      return true
    }
    toast.error(dict.errors?.genericError ?? "Erro")
    return false
  }

  // Custom domain form
  const [username, setUsername] = useState("")
  const [domain, setDomain] = useState(customDomains[0] ?? "")
  const [adding, setAdding] = useState(false)
  const isVip = profile?.isVip ?? false

  const handleSignOut = async () => {
    setSigningOut(true)
    try {
      await authClient.signOut()
    } finally {
      router.replace(`/${lang}/sign-in`)
      router.refresh()
    }
  }

  const handleCopy = async (address: string) => {
    try {
      await navigator.clipboard.writeText(address)
      setCopied(address)
      setTimeout(() => setCopied(null), 1500)
    } catch {
      toast.error(dict.emailInput.copyErrorToast)
    }
  }

  const handleRemove = async (address: string) => {
    setRemoving(address)
    try {
      await removeGeneratedEmail(address)
      setHistory((prev) => prev.filter((h) => h.address !== address))
      toast.success("Email removido")
    } catch {
      toast.error("Erro ao remover email")
    } finally {
      setRemoving(null)
    }
  }

  const handleAddCustom = async () => {
    const clean = username.trim().toLowerCase()
    if (!clean) {
      toast.error(p.invalidEmailMsg)
      return
    }
    if (!isVip) {
      toast.error(p.vipRequiredMsg)
      return
    }
    const address = `${clean}@${domain}`
    setAdding(true)
    try {
      const res = await addCustomDomainEmail(address)
      if (res.ok) {
        toast.success(p.addedMsg)
        setHistory((prev) =>
          prev.some((h) => h.address === address)
            ? prev
            : [
                { id: Date.now(), address, emailType: "other", source: "custom", priceCents: 0, createdAt: new Date().toISOString() },
                ...prev,
              ],
        )
        setUsername("")
      } else if (res.error === "vip_required") {
        toast.error(p.vipRequiredMsg)
      } else if (res.error === "invalid_domain") {
        toast.error(p.invalidDomainMsg)
      } else {
        toast.error(p.invalidEmailMsg)
      }
    } finally {
      setAdding(false)
    }
  }

  const initials = user.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : (user.email?.[0] ?? "?").toUpperCase()

  const stats = [
    { icon: Wallet, label: p.balance, value: formatUsd(balance), accent: "text-emerald-500", onClick: () => setPaymentOpen(true) },
    { icon: TrendingDown, label: p.totalSpent, value: formatUsd(profile?.totalSpentCents ?? 0), accent: "text-rose-500" },
    { icon: AtSign, label: p.gmailsGenerated, value: String(profile?.gmailsGenerated ?? 0), accent: "text-primary" },
    { icon: Hash, label: p.totalEmails, value: String(profile?.totalGenerated ?? history.length), accent: "text-amber-500" },
  ]

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader
        lang={lang}
        userName={user.name ?? user.email ?? undefined}
        userImage={user.image}
        isLoggedIn={true}
        signOutLabel={dict.auth.signOut}
        balanceCents={balance}
        onBalanceClick={() => setPaymentOpen(true)}
        rechargeLabel={p.rechargeShort}
      />

      <main className="animate-fade-in-up mx-auto w-full max-w-3xl flex-1 px-4 py-10">
        {/* Header row */}
        <div className="flex items-center gap-4">
          {user.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.image}
              alt={user.name ?? ""}
              referrerPolicy="no-referrer"
              className="h-16 w-16 rounded-full border-2 border-border object-cover"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-border bg-secondary text-xl font-bold text-secondary-foreground">
              {initials}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-xl font-bold text-foreground">{user.name ?? p.unnamed}</h1>
              {isVip && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-400 px-2 py-0.5 text-[11px] font-bold text-amber-950">
                  <Crown className="h-3 w-3" />
                  VIP
                </span>
              )}
            </div>
            <p className="truncate text-sm text-muted-foreground">{user.email}</p>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map((s) =>
            s.onClick ? (
              <button
                key={s.label}
                onClick={s.onClick}
                className="animate-press group relative rounded-xl border border-emerald-500/40 bg-emerald-500/5 p-4 text-left shadow-soft transition-fluid hover-lift hover:bg-emerald-500/10 hover:shadow-soft-lg active:scale-[0.98]"
              >
                <s.icon className={`h-5 w-5 ${s.accent}`} />
                <p className="mt-2 text-lg font-bold text-foreground">{s.value}</p>
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  {s.label}
                  <Plus className="h-3 w-3 text-emerald-500 opacity-0 transition-opacity group-hover:opacity-100" />
                </p>
                <span className="absolute right-2 top-2 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-500">
                  {p.rechargeShort}
                </span>
              </button>
            ) : (
              <div key={s.label} className="rounded-xl border border-border bg-card/60 p-4 shadow-soft transition-fluid hover-lift hover:shadow-soft-lg">
                <s.icon className={`h-5 w-5 ${s.accent}`} />
                <p className="mt-2 text-lg font-bold text-foreground">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            ),
          )}
        </div>

        {/* Recarregar saldo */}
        <div className="mt-3 flex justify-end">
          <button
            onClick={() => setPaymentOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-500 transition-colors hover:bg-emerald-500/20"
          >
            <Plus className="h-3.5 w-3.5" />
            Recarregar saldo
          </button>
        </div>

        {/* Tabs */}
        <div className="mt-6 flex gap-1 rounded-xl border border-border bg-card/40 p-1">
          <button
            onClick={() => setActiveTab("overview")}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              activeTab === "overview"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <LayoutGrid className="h-4 w-4" />
            {p.tabOverview}
          </button>
          <button
            onClick={() => setActiveTab("products")}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              activeTab === "products"
                ? "bg-primary text-primary-foreground"
                : !isVip
                  ? "text-amber-500 hover:text-amber-400"
                  : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Package className="h-4 w-4" />
            {p.tabProducts}
            {!isVip && <Crown className="h-3 w-3" />}
          </button>
        </div>

        {activeTab === "products" ? (
          <div className="mt-6">
            <ProductsTab
              dict={dict}
              isVip={isVip}
              accounts={productAccounts}
              templates={productTemplates}
              initialOpenProduct={initialProduct}
              onRequestVip={() => {
                window.location.href = `/${lang}`
              }}
            />
          </div>
        ) : (
        <>
        {/* Custom domain */}
        <div className="mt-6 rounded-2xl border border-border bg-card/60 p-5">
          <div className="flex items-center gap-2">
            <AtSign className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">{p.customDomainTitle}</h2>
            {!isVip && (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/60 px-2 py-0.5 text-[10px] font-semibold text-amber-500">
                <Crown className="h-2.5 w-2.5" />
                VIP
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{p.customDomainDesc}</p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9._-]/g, ""))}
              placeholder={p.customDomainPlaceholder}
              className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <select
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {customDomains.map((d) => (
                <option key={d} value={d}>
                  @{d}
                </option>
              ))}
            </select>
            <button
              onClick={handleAddCustom}
              disabled={adding}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {p.addEmail}
            </button>
          </div>
        </div>

        {/* Email history */}
        <div className="mt-6">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
            <Mail className="h-4 w-4 text-muted-foreground" />
            {p.emailHistory}
          </h2>

          {history.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card/40 px-5 py-10 text-center">
              <Mail className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">{p.historyEmpty}</p>
            </div>
          ) : (
            <div className="divide-y divide-border rounded-2xl border border-border bg-card/60">
              {history.map((item) => {
                const isGmail = item.emailType === "google"
                return (
                  <div
                    key={item.id}
                    className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-3"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                          isGmail ? "bg-rose-500/10 text-rose-500" : "bg-primary/10 text-primary"
                        }`}
                      >
                        <Mail className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">{item.address}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.source === "custom" || item.source === "rented" ? p.rented : p.generated}
                          {" · "}
                          {new Date(item.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center justify-end gap-1">
                      <button
                        onClick={() => handleCopy(item.address)}
                        title={p.copy}
                        className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      >
                        {copied === item.address ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                      </button>
                      <button
                        onClick={() => setInboxEmail(item.address)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-2 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
                      >
                        <Inbox className="h-3.5 w-3.5" />
                        {p.openInbox}
                      </button>
                      <button
                        onClick={() => handleRemove(item.address)}
                        disabled={removing === item.address}
                        title="Remover email"
                        className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                      >
                        {removing === item.address
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : <Trash2 className="h-4 w-4" />}
                      </button>
                      {isGmail && (
                        <GmailActionsMenu
                          dict={dict}
                          address={item.address}
                          onMoveToProduct={(slug) => handleMoveToProduct(item.address, slug)}
                        />
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
        </>
        )}

        {/* Actions */}
        <div className="mt-8 flex flex-col gap-3">
          {isAdmin && (
            <a
              href="/admin"
              className="flex items-center justify-center gap-2 rounded-xl bg-amber-400 px-4 py-3 text-sm font-semibold text-amber-950 transition-colors hover:bg-amber-300"
            >
              <ShieldCheck className="h-4 w-4" />
              Admin Panel
            </a>
          )}
          <a
            href={`/${lang}`}
            className="flex items-center justify-center rounded-xl border border-border bg-card px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
          >
            {p.backToInbox}
          </a>
          <button
            onClick={handleSignOut}
            disabled={signingOut}
            className="flex items-center justify-center gap-2 rounded-xl bg-destructive px-4 py-3 text-sm font-medium text-destructive-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            <LogOut className="h-4 w-4" />
            {signingOut ? p.signingOut : dict.auth.signOut}
          </button>
        </div>
      </main>

      <CryptoPaymentModal
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        onSuccess={(cents) => setBalance((b) => b + cents)}
      />

      {inboxEmail && (
        <ProfileInboxModal
          email={inboxEmail}
          onClose={() => setInboxEmail(null)}
          emptyLabel={p.inboxEmpty}
          loadingLabel={p.inboxLoading}
          refreshLabel={p.refresh}
          closeLabel={p.close}
        />
      )}
    </div>
  )
}
