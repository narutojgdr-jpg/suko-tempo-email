"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { QRCodeSVG } from "qrcode.react"
import { Copy, Check, Loader2, CheckCircle2, MessageCircle, ShieldCheck, RefreshCw } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { getDepositAddress, checkDeposits, type DepositInfo } from "@/app/actions/payment"
import { toast } from "sonner"

const POLL_INTERVAL_MS = 12_000

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  onSuccess?: (amountCents: number) => void
}

export function CryptoPaymentModal({ open, onOpenChange, onSuccess }: Props) {
  const [loading, setLoading] = useState(true)
  const [address, setAddress] = useState<string | null>(null)
  const [networks, setNetworks] = useState<DepositInfo["networks"]>([])
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [checking, setChecking] = useState(false)
  const [statusMsg, setStatusMsg] = useState("")
  const [confirmedUsd, setConfirmedUsd] = useState<number | null>(null)
  const pollingActive = useRef(false)

  // Carrega o endereco de deposito ao abrir
  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    setError(null)
    setConfirmedUsd(null)
    setStatusMsg("")
    getDepositAddress().then((info) => {
      if (cancelled) return
      if (info.ok && info.address) {
        setAddress(info.address)
        setNetworks(info.networks ?? [])
      } else {
        setError(info.error ?? "Erro ao gerar endereco de deposito.")
      }
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [open])

  // Verifica depositos (manual + automatico)
  const runCheck = useCallback(
    async (silent: boolean) => {
      if (!silent) setChecking(true)
      try {
        const result = await checkDeposits()
        if (result.ok && result.creditedCents > 0) {
          pollingActive.current = false
          setConfirmedUsd(result.creditedCents / 100)
          setStatusMsg(result.message)
          onSuccess?.(result.creditedCents)
        } else if (!silent) {
          setStatusMsg(result.message)
          if (!result.ok) toast.error(result.message)
        }
      } finally {
        if (!silent) setChecking(false)
      }
    },
    [onSuccess],
  )

  // Polling automatico enquanto o modal esta aberto e ainda nao confirmou
  useEffect(() => {
    if (!open || !address || confirmedUsd !== null) return
    pollingActive.current = true
    const interval = setInterval(() => {
      if (pollingActive.current) runCheck(true)
    }, POLL_INTERVAL_MS)
    return () => {
      pollingActive.current = false
      clearInterval(interval)
    }
  }, [open, address, confirmedUsd, runCheck])

  function handleClose() {
    pollingActive.current = false
    onOpenChange(false)
    setTimeout(() => {
      setConfirmedUsd(null)
      setStatusMsg("")
      setChecking(false)
    }, 300)
  }

  function handleCopy() {
    if (!address) return
    navigator.clipboard.writeText(address)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto max-w-md">
        <DialogHeader>
          <DialogTitle>Recarregar saldo</DialogTitle>
        </DialogHeader>

        {/* Carregando */}
        {loading && (
          <div className="flex flex-col items-center gap-3 py-10">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Gerando seu endereco de deposito...</p>
          </div>
        )}

        {/* Erro */}
        {!loading && error && (
          <div className="flex flex-col items-center gap-4 py-6">
            <p className="text-center text-sm text-muted-foreground">{error}</p>
            <a
              href="https://t.me/sukodeuva"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 rounded-lg border border-[#229ED9]/40 bg-[#229ED9]/10 px-4 py-2 text-xs font-medium text-[#229ED9] hover:bg-[#229ED9]/20"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              Falar no Telegram
            </a>
          </div>
        )}

        {/* Confirmado */}
        {!loading && confirmedUsd !== null && (
          <div className="flex flex-col items-center gap-4 py-8">
            <CheckCircle2 className="h-14 w-14 text-emerald-500" />
            <div className="text-center">
              <p className="text-lg font-bold text-emerald-500">Deposito confirmado!</p>
              <p className="mt-1 text-sm text-muted-foreground">
                ${confirmedUsd.toFixed(2)} adicionado ao seu saldo.
              </p>
            </div>
            <button
              onClick={handleClose}
              className="rounded-lg bg-primary px-6 py-2 text-sm font-semibold text-primary-foreground"
            >
              Fechar
            </button>
          </div>
        )}

        {/* Endereco de deposito */}
        {!loading && !error && confirmedUsd === null && address && (
          <div className="space-y-4">
            {/* Aviso de seguranca */}
            <div className="flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
              <p className="text-xs text-muted-foreground">
                Este e o <strong className="text-foreground">seu endereco exclusivo</strong>. Qualquer USDT enviado para
                ele e creditado automaticamente na sua conta — sem precisar de hash.
              </p>
            </div>

            {/* QR */}
            <div className="flex justify-center">
              <div className="rounded-xl border border-border bg-white p-3">
                <QRCodeSVG value={address} size={160} />
              </div>
            </div>

            {/* Endereco */}
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Seu endereco de deposito (USDT)</p>
              <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2">
                <span className="flex-1 truncate text-xs font-mono text-foreground">{address}</span>
                <button onClick={handleCopy} className="shrink-0 text-muted-foreground hover:text-foreground">
                  {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Redes suportadas */}
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Envie USDT por qualquer uma destas redes:</p>
              <div className="grid grid-cols-2 gap-2">
                {networks?.map((n) => (
                  <div
                    key={n.id}
                    className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs"
                  >
                    <span className="block font-semibold text-foreground">{n.coin}</span>
                    <span className="block text-muted-foreground">{n.label}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-amber-500">
                Envie somente USDT por uma dessas redes. Outros tokens ou redes serao perdidos.
              </p>
            </div>

            {/* Status do polling */}
            <div className="flex items-center justify-center gap-2 rounded-lg bg-muted/40 px-3 py-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
              <span className="text-xs text-muted-foreground">
                {statusMsg || "Aguardando seu deposito — verificamos automaticamente..."}
              </span>
            </div>

            {/* Acoes */}
            <div className="space-y-2">
              <button
                onClick={() => runCheck(false)}
                disabled={checking}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Ja enviei — verificar agora
              </button>
              <a
                href="https://t.me/sukodeuva"
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#229ED9]/40 bg-[#229ED9]/10 py-2 text-xs font-medium text-[#229ED9] transition-colors hover:bg-[#229ED9]/20"
              >
                <MessageCircle className="h-3.5 w-3.5" />
                Precisa de ajuda? Fale no Telegram
              </a>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
