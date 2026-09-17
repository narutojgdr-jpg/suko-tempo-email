"use client"

import { useState, useEffect, useMemo } from "react"
import { X, Copy, Check, Pencil, Save, RotateCcw } from "lucide-react"
import { toast } from "sonner"
import { fillTemplate, DEFAULT_TEMPLATE, type ProductAccount } from "@/lib/products"
import { generateTotp } from "@/lib/totp"
import type { Dictionary } from "@/lib/i18n"

interface DeliveryModalProps {
  dict: Dictionary
  account: ProductAccount
  template: string
  onTemplateSave: (body: string) => void
  onClose: () => void
}

type Mode = "data" | "custom"

export function DeliveryModal({ dict, account, template, onTemplateSave, onClose }: DeliveryModalProps) {
  const p = dict.profile
  const [mode, setMode] = useState<Mode>("data")
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(template || DEFAULT_TEMPLATE)
  const [copied, setCopied] = useState(false)
  const [code, setCode] = useState("")

  // Codigo 2FA ao vivo para preencher {codigo}
  useEffect(() => {
    let active = true
    const tick = async () => {
      if (!account.twofa.trim()) {
        if (active) setCode("")
        return
      }
      const c = await generateTotp(account.twofa.trim())
      if (active) setCode(c ?? "")
    }
    tick()
    const interval = setInterval(tick, 1000)
    return () => {
      active = false
      clearInterval(interval)
    }
  }, [account.twofa])

  // Texto "somente dados"
  const dataText = useMemo(() => {
    const lines = [
      `${p.fieldEmail}: ${account.email}`,
      `${p.fieldPassword}: ${account.password}`,
      `${p.fieldTwofa}: ${account.twofa}`,
    ]
    if (code) lines.push(`${p.code2fa}: ${code}`)
    lines.push(`${p.fieldRecovery}: ${account.recovery}`)
    return lines.join("\n")
  }, [account, code, p])

  // Texto do template personalizado preenchido
  const customText = useMemo(
    () =>
      fillTemplate(template || DEFAULT_TEMPLATE, {
        email: account.email,
        password: account.password,
        twofa: account.twofa,
        recovery: account.recovery,
        code,
      }),
    [template, account, code],
  )

  const output = mode === "data" ? dataText : customText

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

  const handleSaveTemplate = () => {
    onTemplateSave(draft)
    setEditing(false)
  }

  return (
    <div
      className="animate-overlay-in fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="animate-scale-in flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-soft-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h3 className="text-base font-bold text-foreground">{p.deliveryTitle}</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label={p.close}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Mode tabs */}
        <div className="flex gap-1 border-b border-border p-3">
          <button
            onClick={() => {
              setMode("data")
              setEditing(false)
            }}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              mode === "data" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {p.deliveryDataOnly}
          </button>
          <button
            onClick={() => setMode("custom")}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              mode === "custom" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {p.deliveryCustom}
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {mode === "custom" && editing ? (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">{p.templateVarsHint}</p>
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={8}
                className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm text-foreground outline-none focus:border-primary/50"
              />
              <div className="flex flex-wrap gap-1.5">
                {["{email}", "{senha}", "{2fa}", "{codigo}", "{recuperacao}"].map((v) => (
                  <button
                    key={v}
                    onClick={() => setDraft((d) => `${d}${v}`)}
                    className="rounded-md border border-border bg-muted px-2 py-1 font-mono text-xs text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <pre className="whitespace-pre-wrap break-words rounded-lg border border-border bg-background px-3 py-3 font-mono text-sm text-foreground">
              {output || p.deliveryEmpty}
            </pre>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 border-t border-border p-4">
          {mode === "custom" &&
            (editing ? (
              <>
                <button
                  onClick={() => setDraft(DEFAULT_TEMPLATE)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  {p.reset}
                </button>
                <button
                  onClick={handleSaveTemplate}
                  className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  <Save className="h-3.5 w-3.5" />
                  {p.saveTemplate}
                </button>
              </>
            ) : (
              <button
                onClick={() => {
                  setDraft(template || DEFAULT_TEMPLATE)
                  setEditing(true)
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
              >
                <Pencil className="h-3.5 w-3.5" />
                {p.editDelivery}
              </button>
            ))}
          {!editing && (
            <button
              onClick={handleCopy}
              className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent/90"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {p.copyDelivery}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
