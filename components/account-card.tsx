"use client"

import { useState, useEffect } from "react"
import { Eye, EyeOff, Copy, Check, Trash2, Send, Save, Loader2, KeyRound } from "lucide-react"
import { toast } from "sonner"
import { generateTotp, totpSecondsRemaining } from "@/lib/totp"
import type { ProductAccount } from "@/lib/products"
import type { Dictionary } from "@/lib/i18n"

type Editable = Pick<ProductAccount, "email" | "password" | "twofa" | "recovery">

interface AccountCardProps {
  dict: Dictionary
  accent: string
  index: number
  account: ProductAccount & { isNew?: boolean }
  onChange: (updated: Partial<Editable>) => void
  onSave: () => Promise<boolean>
  onDelete: () => void
  onDeliver: () => void
}

export function AccountCard({ dict, accent, index, account, onChange, onSave, onDelete, onDeliver }: AccountCardProps) {
  const p = dict.profile
  const [showPassword, setShowPassword] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  // Codigo 2FA ao vivo, derivado da chave
  const [code, setCode] = useState<string | null>(null)
  const [remaining, setRemaining] = useState(30)

  useEffect(() => {
    let active = true
    const tick = async () => {
      if (!account.twofa.trim()) {
        if (active) setCode(null)
        return
      }
      const c = await generateTotp(account.twofa.trim())
      if (active) {
        setCode(c)
        setRemaining(totpSecondsRemaining())
      }
    }
    tick()
    const interval = setInterval(tick, 1000)
    return () => {
      active = false
      clearInterval(interval)
    }
  }, [account.twofa])

  const update = (patch: Partial<Editable>) => {
    onChange(patch)
    setDirty(true)
  }

  const handleSave = async () => {
    setSaving(true)
    const ok = await onSave()
    setSaving(false)
    if (ok) setDirty(false)
  }

  const copy = async (value: string, key: string) => {
    if (!value) return
    try {
      await navigator.clipboard.writeText(value)
      setCopied(key)
      setTimeout(() => setCopied(null), 1500)
    } catch {
      toast.error(dict.emailInput.copyErrorToast)
    }
  }

  return (
    <div className="flex flex-col gap-3 overflow-hidden rounded-2xl border border-border bg-card/60 p-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <span
          className="flex h-6 w-6 items-center justify-center rounded-md text-xs font-bold text-white"
          style={{ backgroundColor: accent }}
        >
          {index}
        </span>
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {p.accountLabel}
        </span>
        {dirty && <span className="ml-auto h-2 w-2 rounded-full bg-amber-400" title={p.unsaved} />}
      </div>

      {/* Email */}
      <Field label={p.fieldEmail}>
        <input
          type="text"
          value={account.email}
          onChange={(e) => update({ email: e.target.value })}
          placeholder={p.fieldEmailPlaceholder}
          className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          autoComplete="off"
          spellCheck={false}
        />
        <CopyBtn active={copied === "email"} onClick={() => copy(account.email, "email")} />
      </Field>

      {/* Senha */}
      <Field label={p.fieldPassword}>
        <input
          type={showPassword ? "text" : "password"}
          value={account.password}
          onChange={(e) => update({ password: e.target.value })}
          placeholder={p.fieldPasswordPlaceholder}
          className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          autoComplete="off"
          spellCheck={false}
        />
        <button
          type="button"
          onClick={() => setShowPassword((s) => !s)}
          className="rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
          aria-label={showPassword ? p.hide : p.show}
        >
          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
        <CopyBtn active={copied === "password"} onClick={() => copy(account.password, "password")} />
      </Field>

      {/* 2FA key + live code */}
      <Field label={p.fieldTwofa}>
        <input
          type="text"
          value={account.twofa}
          onChange={(e) => update({ twofa: e.target.value })}
          placeholder={p.fieldTwofaPlaceholder}
          className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          autoComplete="off"
          spellCheck={false}
        />
        <CopyBtn active={copied === "twofa"} onClick={() => copy(account.twofa, "twofa")} />
      </Field>
      {code && (
        <button
          type="button"
          onClick={() => copy(code, "code")}
          className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-left transition-colors hover:bg-muted"
        >
          <KeyRound className="h-4 w-4 shrink-0 text-accent" />
          <span className="font-mono text-base font-bold tracking-[0.2em] text-foreground">{code}</span>
          <span className="ml-auto text-xs tabular-nums text-muted-foreground">{remaining}s</span>
          {copied === "code" ? (
            <Check className="h-4 w-4 text-emerald-500" />
          ) : (
            <Copy className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
      )}

      {/* Recovery */}
      <Field label={p.fieldRecovery}>
        <input
          type="text"
          value={account.recovery}
          onChange={(e) => update({ recovery: e.target.value })}
          placeholder={p.fieldRecoveryPlaceholder}
          className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          autoComplete="off"
          spellCheck={false}
        />
        <CopyBtn active={copied === "recovery"} onClick={() => copy(account.recovery, "recovery")} />
      </Field>

      {/* Actions */}
      <div className="mt-1 flex items-center gap-2">
        <button
          onClick={onDeliver}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent/90"
        >
          <Send className="h-3.5 w-3.5" />
          {p.delivery}
        </button>
        <button
          onClick={handleSave}
          disabled={saving || !dirty}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-40"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          {p.save}
        </button>
        <button
          onClick={onDelete}
          className="rounded-lg border border-border bg-card p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          aria-label={p.cardRemoved}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-muted-foreground">{label}</label>
      <div className="flex items-center gap-1 rounded-lg border border-border bg-background px-3 py-2 focus-within:border-primary/50">
        {children}
      </div>
    </div>
  )
}

function CopyBtn({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
      aria-label="Copiar"
    >
      {active ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
    </button>
  )
}
