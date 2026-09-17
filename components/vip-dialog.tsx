"use client"

import { useState, useTransition } from "react"
import { Crown, Check, Loader2, Wallet } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { buyVip } from "@/app/actions/profile"
import { formatUsd } from "@/lib/money"
import { toast } from "sonner"
import type { Dictionary } from "@/lib/i18n"

interface VipDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  dict: Dictionary
  isVip?: boolean
  balanceCents?: number
  /** Chamado quando o saldo e insuficiente — deve abrir o modal de deposito. */
  onRequestDeposit?: () => void
  /** Chamado apos a compra do VIP ser concluida com sucesso. */
  onPurchased?: () => void
}

const VIP_PRICE_CENTS = 400

export function VipDialog({
  open,
  onOpenChange,
  dict,
  isVip = false,
  balanceCents = 0,
  onRequestDeposit,
  onPurchased,
}: VipDialogProps) {
  const v = dict.vip
  const benefits = [v.benefit1, v.benefit2, v.benefit3, v.benefit4]
  const [pending, startTransition] = useTransition()

  const hasEnough = balanceCents >= VIP_PRICE_CENTS

  function handleBuy() {
    if (!hasEnough) {
      // Saldo insuficiente — fecha o VIP e abre o deposito
      onOpenChange(false)
      onRequestDeposit?.()
      return
    }
    startTransition(async () => {
      const res = await buyVip()
      if (res.ok) {
        toast.success(v.purchasedToast)
        onOpenChange(false)
        onPurchased?.()
      } else if (res.error === "insufficient") {
        onOpenChange(false)
        onRequestDeposit?.()
      } else {
        toast.error(v.purchaseError)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10">
            <Crown className="h-6 w-6 text-amber-500" />
          </div>
          <DialogTitle className="text-center text-xl">{v.title}</DialogTitle>
          <DialogDescription className="text-center text-pretty">{v.subtitle}</DialogDescription>
        </DialogHeader>

        <div className="my-2 text-center">
          <span className="text-3xl font-bold text-foreground">{v.price}</span>
          <span className="text-sm text-muted-foreground"> {v.perMonth}</span>
        </div>

        <ul className="space-y-2">
          {benefits.map((b, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-foreground">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
              <span>{b}</span>
            </li>
          ))}
        </ul>

        {/* Saldo atual */}
        {!isVip && (
          <div className="mt-3 flex items-center justify-between rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Wallet className="h-4 w-4" />
              {v.yourBalance}
            </span>
            <span className={`font-semibold ${hasEnough ? "text-foreground" : "text-destructive"}`}>
              {formatUsd(balanceCents)}
            </span>
          </div>
        )}

        {/* Aviso de saldo insuficiente */}
        {!isVip && !hasEnough && (
          <p className="mt-2 text-center text-xs text-muted-foreground text-pretty">
            {v.insufficientDesc.replace("{price}", v.price)}
          </p>
        )}

        <DialogFooter className="mt-3">
          {isVip ? (
            <button
              type="button"
              disabled
              className="flex w-full cursor-default items-center justify-center gap-2 rounded-lg bg-amber-500/15 px-4 py-2.5 text-sm font-semibold text-amber-500"
            >
              <Crown className="h-4 w-4" />
              {v.alreadyVip}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleBuy}
              disabled={pending}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-amber-950 transition-colors hover:bg-amber-400 disabled:opacity-60"
            >
              {pending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {v.purchasing}
                </>
              ) : hasEnough ? (
                <>
                  <Crown className="h-4 w-4" />
                  {v.buyWithBalance}
                </>
              ) : (
                <>
                  <Wallet className="h-4 w-4" />
                  {v.depositToBuy}
                </>
              )}
            </button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
