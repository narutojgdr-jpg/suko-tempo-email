"use client"

import { useState } from "react"
import { Check, Copy, Loader2 } from "lucide-react"
import { toast } from "sonner"
import type { Dictionary } from "@/lib/i18n"

interface EmailInputProps {
  email: string
  error: string | null
  activeAddress: string | null
  onEmailChange: (value: string) => void
  onSubmit: () => void
  loading: boolean
  dict: Dictionary
}

export function EmailInput({
  email,
  error,
  activeAddress,
  onEmailChange,
  onSubmit,
  loading,
  dict,
}: EmailInputProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    if (!activeAddress) return
    try {
      await navigator.clipboard.writeText(activeAddress)
      setCopied(true)
      toast.success(dict.emailInput.copiedToast)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error(dict.emailInput.copyErrorToast)
    }
  }

  return (
    <div className="animate-fade-in-up rounded-xl border border-border bg-card p-6 shadow-soft-lg">
      <h2 className="mb-1 text-xl font-bold text-card-foreground">{dict.emailInput.heading}</h2>
      <p className="mb-5 text-sm text-muted-foreground">
        {dict.emailInput.description}
      </p>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex flex-1 flex-col gap-1.5">
          <div className="flex gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => onEmailChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && email.trim()) onSubmit()
              }}
              placeholder={dict.emailInput.placeholder}
              className={`w-full rounded-lg border bg-secondary px-4 py-3 text-sm text-foreground transition-fluid placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 ${
                error ? "border-destructive" : "border-border"
              }`}
              aria-label={dict.emailInput.ariaLabel}
              aria-invalid={!!error}
              aria-describedby={error ? "email-error" : undefined}
            />
            {activeAddress && (
              <button
                onClick={handleCopy}
                className="animate-press flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-lg border border-border bg-secondary text-muted-foreground transition-fluid hover:bg-secondary/80 hover:text-foreground active:scale-90"
                aria-label={dict.emailInput.copyAriaLabel}
                title={dict.emailInput.copyAriaLabel}
              >
                {copied ? (
                  <Check className="h-4 w-4 text-accent" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </button>
            )}
          </div>
          {error && (
            <p id="email-error" className="text-xs text-destructive" role="alert">
              {error}
            </p>
          )}
        </div>

        <button
          onClick={onSubmit}
          disabled={!email.trim() || loading}
          className="animate-press flex shrink-0 items-center justify-center gap-2 rounded-lg bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground shadow-soft transition-fluid hover:-translate-y-0.5 hover:shadow-soft-lg hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-soft"
          aria-label={dict.emailInput.accessAriaLabel}
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {dict.emailInput.loading}
            </>
          ) : (
            dict.emailInput.submit
          )}
        </button>
      </div>
    </div>
  )
}
