"use client"

import { useState, useMemo } from "react"
import { X, Copy, Check, ArrowUp, ArrowDown, GripVertical } from "lucide-react"
import { toast } from "sonner"
import { ORGANIZE_FORMATS, type OrganizeFormat, type ProductAccount } from "@/lib/products"
import type { Dictionary } from "@/lib/i18n"

interface OrganizeModalProps {
  dict: Dictionary
  accounts: (ProductAccount & { isNew?: boolean })[]
  onApplyOrder: (orderedIds: number[]) => void
  onClose: () => void
}

export function OrganizeModal({ dict, accounts, onApplyOrder, onClose }: OrganizeModalProps) {
  const p = dict.profile
  const [order, setOrder] = useState<number[]>(accounts.map((a) => a.id))
  const [format, setFormat] = useState<OrganizeFormat>("linha")
  const [copied, setCopied] = useState(false)

  const byId = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts])

  const move = (idx: number, dir: -1 | 1) => {
    setOrder((prev) => {
      const next = [...prev]
      const target = idx + dir
      if (target < 0 || target >= next.length) return prev
      ;[next[idx], next[target]] = [next[target], next[idx]]
      return next
    })
  }

  // Gera o texto organizado conforme o formato escolhido
  const output = useMemo(() => {
    const accs = order.map((id) => byId.get(id)).filter(Boolean) as ProductAccount[]
    if (format === "linha") {
      // Uma conta por linha: email | senha | 2fa | recuperacao
      return accs
        .map((a) => [a.email, a.password, a.twofa, a.recovery].filter(Boolean).join(" | "))
        .join("\n")
    }
    // Bloco: cada conta em um bloco rotulado, separadas por linha em branco
    return accs
      .map((a) =>
        [
          `${p.fieldEmail}: ${a.email}`,
          `${p.fieldPassword}: ${a.password}`,
          `${p.fieldTwofa}: ${a.twofa}`,
          `${p.fieldRecovery}: ${a.recovery}`,
        ].join("\n"),
      )
      .join("\n\n")
  }, [order, byId, format, p])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(output)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
      toast.success(p.copied)
    } catch {
      toast.error(dict.emailInput.copyErrorToast)
    }
  }

  return (
    <div className="animate-overlay-in fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="animate-scale-in flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-soft-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h3 className="text-base font-bold text-foreground">{p.organizeTitle}</h3>
            <p className="text-xs text-muted-foreground">{p.organizeDesc}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label={p.close}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid flex-1 grid-cols-1 gap-4 overflow-y-auto p-5 md:grid-cols-2">
          {/* Reorder list */}
          <div className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {p.organizeReorder}
            </span>
            <div className="space-y-1.5">
              {order.map((id, idx) => {
                const a = byId.get(id)
                if (!a) return null
                return (
                  <div
                    key={id}
                    className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2"
                  >
                    <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                      {a.email || p.accountLabel + " " + (idx + 1)}
                    </span>
                    <button
                      onClick={() => move(idx, -1)}
                      disabled={idx === 0}
                      className="rounded p-1 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
                      aria-label={p.moveUp}
                    >
                      <ArrowUp className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => move(idx, 1)}
                      disabled={idx === order.length - 1}
                      className="rounded p-1 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
                      aria-label={p.moveDown}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </button>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Format + preview */}
          <div className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {p.organizeFormat}
            </span>
            <div className="flex gap-1 rounded-lg border border-border bg-background p-1">
              {ORGANIZE_FORMATS.map((f) => (
                <button
                  key={f}
                  onClick={() => setFormat(f)}
                  className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors ${
                    format === f ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {f === "linha" ? p.formatLine : p.formatBlock}
                </button>
              ))}
            </div>
            <pre className="max-h-56 overflow-y-auto whitespace-pre-wrap break-words rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs text-foreground">
              {output || p.deliveryEmpty}
            </pre>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 border-t border-border p-4">
          <button
            onClick={() => onApplyOrder(order)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            {p.applyOrder}
          </button>
          <button
            onClick={handleCopy}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent/90"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {p.copyOrganized}
          </button>
        </div>
      </div>
    </div>
  )
}
