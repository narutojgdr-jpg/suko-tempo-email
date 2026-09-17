"use client"

import { useState } from "react"
import { formatUsd } from "@/lib/money"
import type { TransactionRow } from "@/app/actions/admin"

const TYPE_LABELS: Record<string, string> = {
  deposit: "Deposit",
  balance_adjust: "Balance adjustment",
  gmail_purchase: "Gmail purchase",
  vip_granted: "VIP granted",
  vip_revoked: "VIP revoked",
}

const FILTERS = ["all", "deposit", "gmail_purchase", "vip_granted"] as const
type Filter = (typeof FILTERS)[number]

export function TransactionsTab({ transactions }: { transactions: TransactionRow[] }) {
  const [filter, setFilter] = useState<Filter>("all")

  const filtered = filter === "all" ? transactions : transactions.filter((t) => t.type === filter)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Transactions</h1>
        <p className="text-sm text-muted-foreground">{transactions.length} logged events.</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              filter === f
                ? "bg-primary text-primary-foreground"
                : "border border-border text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {f === "all" ? "All" : TYPE_LABELS[f] ?? f}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Account</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Description</th>
                <th className="px-4 py-3 font-medium text-right">Amount</th>
                <th className="px-4 py-3 font-medium text-right">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                    No transactions.
                  </td>
                </tr>
              ) : (
                filtered.map((t) => (
                  <tr key={t.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">{t.user_email}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        {TYPE_LABELS[t.type] ?? t.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{t.description ?? "—"}</td>
                    <td
                      className={`px-4 py-3 text-right font-semibold tabular-nums ${
                        t.amount_cents > 0
                          ? "text-emerald-400"
                          : t.amount_cents < 0
                            ? "text-destructive"
                            : "text-muted-foreground"
                      }`}
                    >
                      {t.amount_cents !== 0 ? formatUsd(t.amount_cents) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">
                      {new Date(t.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
