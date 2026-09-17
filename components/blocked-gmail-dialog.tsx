"use client"

import { AlertOctagon, X } from "lucide-react"

interface BlockedGmailDialogProps {
  open: boolean
  onClose: () => void
  title: string
  message: string
  buttonLabel: string
}

/**
 * Tela de bloqueio (vermelha) exibida quando o usuario tenta burlar o sistema
 * digitando um dominio do Google (gmail.com) onde nao deveria.
 */
export function BlockedGmailDialog({ open, onClose, title, message, buttonLabel }: BlockedGmailDialogProps) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-red-950/70 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="alertdialog"
      aria-modal="true"
    >
      <div
        className="relative w-full max-w-sm overflow-hidden rounded-2xl border-2 border-red-500 bg-red-600 p-6 text-center shadow-2xl shadow-red-900/50"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-3 top-3 rounded-lg p-1 text-red-100 transition-colors hover:bg-red-500"
          aria-label={buttonLabel}
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-500">
          <AlertOctagon className="h-8 w-8 text-white" />
        </div>

        <h3 className="mt-4 text-lg font-extrabold uppercase tracking-wide text-white text-balance">{title}</h3>
        <p className="mt-2 text-pretty text-sm font-medium leading-relaxed text-red-50">{message}</p>

        <button
          onClick={onClose}
          className="mt-5 w-full rounded-lg bg-white px-4 py-2.5 text-sm font-bold text-red-600 transition-colors hover:bg-red-50"
        >
          {buttonLabel}
        </button>
      </div>
    </div>
  )
}
