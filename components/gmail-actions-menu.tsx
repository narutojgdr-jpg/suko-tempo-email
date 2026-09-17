"use client"

import { useState, useRef, useEffect } from "react"
import { MoreVertical, Package, Flag, Check, Loader2, Send } from "lucide-react"
import { toast } from "sonner"
import { PRODUCT_SLUGS, PRODUCT_META, type ProductSlug } from "@/lib/products"
import type { Dictionary } from "@/lib/i18n"

const TELEGRAM_USER = "sukodeuva"

interface GmailActionsMenuProps {
  dict: Dictionary
  address: string
  /** Cria um card para este gmail no produto escolhido. Retorna ok. */
  onMoveToProduct: (product: ProductSlug) => Promise<boolean>
}

export function GmailActionsMenu({ dict, address, onMoveToProduct }: GmailActionsMenuProps) {
  const p = dict.profile
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<"root" | "products">("root")
  const [reportOpen, setReportOpen] = useState(false)
  const [moving, setMoving] = useState<ProductSlug | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  // Fecha o dropdown ao clicar fora
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setView("root")
      }
    }
    document.addEventListener("mousedown", onDoc)
    return () => document.removeEventListener("mousedown", onDoc)
  }, [open])

  const handleMove = async (slug: ProductSlug) => {
    setMoving(slug)
    try {
      const ok = await onMoveToProduct(slug)
      if (ok) {
        toast.success(p.movedToProduct.replace("{product}", PRODUCT_META[slug].label))
        setOpen(false)
        setView("root")
      }
    } finally {
      setMoving(null)
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => {
          setOpen((v) => !v)
          setView("root")
        }}
        title={p.actionsMenu}
        aria-label={p.actionsMenu}
        className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <MoreVertical className="h-4 w-4" />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 w-56 overflow-hidden rounded-xl border border-border bg-popover p-1 shadow-lg">
          {view === "root" ? (
            <>
              <button
                onClick={() => setView("products")}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-popover-foreground transition-colors hover:bg-muted"
              >
                <Package className="h-4 w-4 text-primary" />
                {p.moveToProduct}
              </button>
              <button
                onClick={() => {
                  setReportOpen(true)
                  setOpen(false)
                }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-popover-foreground transition-colors hover:bg-muted"
              >
                <Flag className="h-4 w-4 text-rose-500" />
                {p.reportProblem}
              </button>
            </>
          ) : (
            <>
              <p className="px-3 py-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {p.moveToProduct}
              </p>
              {PRODUCT_SLUGS.map((slug) => (
                <button
                  key={slug}
                  onClick={() => handleMove(slug)}
                  disabled={moving !== null}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-popover-foreground transition-colors hover:bg-muted disabled:opacity-50"
                >
                  <span
                    className="flex h-5 w-5 items-center justify-center rounded text-[9px] font-bold text-white"
                    style={{ backgroundColor: PRODUCT_META[slug].accent }}
                    aria-hidden
                  >
                    {PRODUCT_META[slug].label.slice(0, 2)}
                  </span>
                  <span className="flex-1">{PRODUCT_META[slug].label}</span>
                  {moving === slug && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                </button>
              ))}
            </>
          )}
        </div>
      )}

      {reportOpen && (
        <ReportProblemModal
          dict={dict}
          address={address}
          onClose={() => setReportOpen(false)}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------

const PROBLEM_KEYS = ["reused", "down", "duplicate"] as const
type ProblemKey = (typeof PROBLEM_KEYS)[number]

function ReportProblemModal({
  dict,
  address,
  onClose,
}: {
  dict: Dictionary
  address: string
  onClose: () => void
}) {
  const p = dict.profile
  const [selected, setSelected] = useState<Set<ProblemKey>>(new Set())

  const labels: Record<ProblemKey, string> = {
    reused: p.problemReused,
    down: p.problemDown,
    duplicate: p.problemDuplicate,
  }

  const toggle = (k: ProblemKey) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(k)) next.delete(k)
      else next.add(k)
      return next
    })

  const handleSend = () => {
    if (selected.size === 0) {
      toast.error(p.reportSelectOne)
      return
    }
    const problems = PROBLEM_KEYS.filter((k) => selected.has(k)).map((k) => `- ${labels[k]}`)
    const message = `${p.reportMsgHeader}\n\nGmail: ${address}\n\n${p.reportMsgProblems}\n${problems.join("\n")}`

    // Copia a mensagem e abre o chat do Telegram (chats diretos nao aceitam
    // texto pre-preenchido via URL, entao copiamos para colar no chat).
    navigator.clipboard?.writeText(message).catch(() => {})
    window.open(`https://t.me/${TELEGRAM_USER}`, "_blank", "noopener,noreferrer")
    toast.success(p.reportCopied)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2">
          <Flag className="h-5 w-5 text-rose-500" />
          <h3 className="text-base font-bold text-foreground">{p.reportTitle}</h3>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{p.reportDesc}</p>
        <p className="mt-2 truncate rounded-lg bg-muted px-3 py-2 font-mono text-xs text-foreground">{address}</p>

        <div className="mt-4 space-y-2">
          {PROBLEM_KEYS.map((k) => {
            const checked = selected.has(k)
            return (
              <button
                key={k}
                onClick={() => toggle(k)}
                className={`flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left text-sm transition-colors ${
                  checked
                    ? "border-rose-500/60 bg-rose-500/10 text-foreground"
                    : "border-border bg-background text-muted-foreground hover:border-rose-500/40"
                }`}
              >
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                    checked ? "border-rose-500 bg-rose-500 text-white" : "border-border"
                  }`}
                >
                  {checked && <Check className="h-3.5 w-3.5" />}
                </span>
                {labels[k]}
              </button>
            )
          })}
        </div>

        <div className="mt-5 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            {p.close}
          </button>
          <button
            onClick={handleSend}
            className="flex flex-[2] items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Send className="h-4 w-4" />
            {p.reportSend}
          </button>
        </div>
      </div>
    </div>
  )
}
