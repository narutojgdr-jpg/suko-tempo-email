"use client"

import { useState } from "react"
import {
  LayoutDashboard,
  Users,
  Mail,
  Star,
  ReceiptText,
  Crown,
  Wallet,
  ShoppingCart,
  TrendingUp,
  ExternalLink,
  Database,
  Store,
  Bot,
  ShieldBan,
} from "lucide-react"
import { formatUsd, formatBytes } from "@/lib/money"
import type {
  AccountRow,
  GmailRow,
  WishlistRow,
  TransactionRow,
  DashboardStats,
  StorageUsage,
} from "@/app/actions/admin"
import type { ResellerPageRow } from "@/app/actions/reseller"
import { AccountsTab } from "@/components/admin/accounts-tab"
import { PoolTab } from "@/components/admin/pool-tab"
import { WishlistTab } from "@/components/admin/wishlist-tab"
import { TransactionsTab } from "@/components/admin/transactions-tab"
import { ResellersTab } from "@/components/admin/resellers-tab"
import { ChatTab } from "@/components/admin/chat-tab"
import { BlocklistTab } from "@/components/admin/blocklist-tab"

type Tab =
  | "dashboard"
  | "accounts"
  | "pool"
  | "resellers"
  | "chat"
  | "blocklist"
  | "wishlist"
  | "transactions"

interface AdminPanelProps {
  stats: DashboardStats
  accounts: AccountRow[]
  gmails: GmailRow[]
  wishlist: WishlistRow[]
  transactions: TransactionRow[]
  usage: StorageUsage
  resellerPages: ResellerPageRow[]
}

const NAV: { id: Tab; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "accounts", label: "Accounts", icon: Users },
  { id: "pool", label: "Gmail Pool", icon: Mail },
  { id: "resellers", label: "Revendedores", icon: Store },
  { id: "chat", label: "SuKo AI", icon: Bot },
  { id: "blocklist", label: "Bloqueios", icon: ShieldBan },
  { id: "wishlist", label: "Wishlist", icon: Star },
  { id: "transactions", label: "Transactions", icon: ReceiptText },
]

export function AdminPanel({ stats, accounts, gmails, wishlist, transactions, usage, resellerPages }: AdminPanelProps) {
  const [tab, setTab] = useState<Tab>("dashboard")

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground md:flex-row">
      {/* Sidebar */}
      <aside className="flex shrink-0 flex-col border-b border-border bg-card md:w-60 md:border-b-0 md:border-r">
        <div className="flex items-center gap-2 px-5 py-5">
          <Crown className="h-5 w-5 text-amber-400" />
          <span className="text-lg font-bold">SuKo Admin</span>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-2 pb-2 md:flex-col md:gap-0.5 md:overflow-visible md:pb-0">
          {NAV.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-2.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                tab === id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </nav>
        <div className="mt-auto hidden px-2 pb-4 md:block">
          <a
            href="/"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ExternalLink className="h-4 w-4" />
            Back to site
          </a>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 overflow-x-hidden p-4 md:p-8">
        {tab === "dashboard" && <Dashboard stats={stats} transactions={transactions} usage={usage} />}
        {tab === "accounts" && <AccountsTab accounts={accounts} gmailPriceCents={stats.gmailPriceCents} />}
        {tab === "pool" && <PoolTab gmails={gmails} />}
        {tab === "resellers" && <ResellersTab pages={resellerPages} />}
        {tab === "chat" && <ChatTab />}
        {tab === "blocklist" && <BlocklistTab />}
        {tab === "wishlist" && <WishlistTab wishlist={wishlist} />}
        {tab === "transactions" && <TransactionsTab transactions={transactions} />}
      </main>
    </div>
  )
}

function Dashboard({
  stats,
  transactions,
  usage,
}: {
  stats: DashboardStats
  transactions: TransactionRow[]
  usage: StorageUsage
}) {
  const cards = [
    { label: "Total accounts", value: String(stats.totalUsers), icon: Users, accent: "text-sky-400" },
    { label: "VIP subscribers", value: String(stats.totalVip), icon: Crown, accent: "text-amber-400" },
    {
      label: "Balance on platform",
      value: formatUsd(stats.totalBalanceCents),
      icon: Wallet,
      accent: "text-emerald-400",
    },
    {
      label: "Total deposited",
      value: formatUsd(stats.totalDepositedCents),
      icon: TrendingUp,
      accent: "text-emerald-400",
    },
    { label: "Gmails sold", value: String(stats.gmailsSold), icon: ShoppingCart, accent: "text-violet-400" },
    {
      label: "Gmail price",
      value: stats.gmailPriceCents > 0 ? formatUsd(stats.gmailPriceCents) : "Not set",
      icon: Mail,
      accent: "text-foreground",
    },
  ]

  const recent = transactions.slice(0, 8)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Overview of your platform.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">{c.label}</span>
              <c.icon className={`h-4 w-4 ${c.accent}`} />
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums">{c.value}</p>
          </div>
        ))}
      </div>

      <UsagePanel usage={usage} />

      <div className="rounded-xl border border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold">Recent activity</h2>
        </div>
        {recent.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">No transactions yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {recent.map((t) => (
              <li key={t.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">{t.user_email}</p>
                  <p className="text-xs text-muted-foreground">{t.description ?? t.type}</p>
                </div>
                <div className="text-right">
                  <p
                    className={`font-semibold tabular-nums ${
                      t.amount_cents > 0
                        ? "text-emerald-400"
                        : t.amount_cents < 0
                          ? "text-destructive"
                          : "text-muted-foreground"
                    }`}
                  >
                    {t.amount_cents !== 0 ? formatUsd(t.amount_cents) : "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(t.created_at).toLocaleDateString()}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function UsagePanel({ usage }: { usage: StorageUsage }) {
  const pct = usage.dbPct
  const near = pct >= 80
  const warn = pct >= 60 && pct < 80
  const barColor = near ? "bg-destructive" : warn ? "bg-amber-400" : "bg-emerald-400"

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <Database className="h-4 w-4 text-sky-400" />
        <h2 className="text-sm font-semibold">Database usage (Neon)</h2>
      </div>

      <div className="space-y-4 p-4">
        <div>
          <div className="mb-1.5 flex items-baseline justify-between">
            <span className="text-sm font-medium">Storage</span>
            <span className="text-sm tabular-nums text-muted-foreground">
              {formatBytes(usage.dbSizeBytes)} / {formatBytes(usage.dbLimitBytes)}
            </span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full transition-all ${barColor}`}
              style={{ width: `${Math.max(1.5, pct).toFixed(1)}%` }}
            />
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            {pct.toFixed(1)}% used.{" "}
            {near
              ? "Almost full — consider upgrading the Neon plan."
              : warn
                ? "Getting busy — keep an eye on it."
                : "Plenty of room."}
          </p>
        </div>

        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">Rows per table</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {usage.tables.map((t) => (
              <div key={t.name} className="rounded-lg border border-border bg-background px-3 py-2">
                <p className="truncate text-xs text-muted-foreground">{t.name}</p>
                <p className="text-base font-semibold tabular-nums">{t.rows.toLocaleString()}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
