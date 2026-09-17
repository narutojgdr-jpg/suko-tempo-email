"use client"

import { useState, useTransition } from "react"
import { ArrowLeft, Plus, LayoutGrid, Loader2 } from "lucide-react"
import { toast } from "sonner"
import {
  saveProductAccount,
  deleteProductAccount,
  reorderProductAccounts,
} from "@/app/actions/profile"
import { PRODUCT_META, type ProductSlug, type ProductAccount } from "@/lib/products"
import { AccountCard } from "@/components/account-card"
import { DeliveryModal } from "@/components/delivery-modal"
import { OrganizeModal } from "@/components/organize-modal"
import type { Dictionary } from "@/lib/i18n"

// Conta ainda nao salva (rascunho local antes do primeiro save)
type DraftAccount = ProductAccount & { isNew?: boolean }

interface ProductDetailProps {
  dict: Dictionary
  slug: ProductSlug
  initialAccounts: ProductAccount[]
  initialTemplate: string
  onBack: () => void
}

export function ProductDetail({ dict, slug, initialAccounts, initialTemplate, onBack }: ProductDetailProps) {
  const p = dict.profile
  const meta = PRODUCT_META[slug]
  const [accounts, setAccounts] = useState<DraftAccount[]>(initialAccounts)
  const [template, setTemplate] = useState(initialTemplate)
  const [deliveryFor, setDeliveryFor] = useState<DraftAccount | null>(null)
  const [organizeOpen, setOrganizeOpen] = useState(false)
  const [, startTransition] = useTransition()

  // Adiciona um card novo (rascunho com id temporario negativo)
  const handleAddCard = () => {
    const tempId = -Date.now()
    setAccounts((prev) => [
      ...prev,
      {
        id: tempId,
        product: slug,
        email: "",
        password: "",
        twofa: "",
        recovery: "",
        position: prev.length,
        createdAt: new Date().toISOString(),
        isNew: true,
      },
    ])
  }

  // Salva (cria ou atualiza) um card
  const handleSave = (acc: DraftAccount) => {
    return new Promise<boolean>((resolve) => {
      startTransition(async () => {
        const res = await saveProductAccount({
          id: acc.isNew ? undefined : acc.id,
          product: slug,
          email: acc.email,
          password: acc.password,
          twofa: acc.twofa,
          recovery: acc.recovery,
        })
        if (res.ok && res.id) {
          setAccounts((prev) =>
            prev.map((a) => (a.id === acc.id ? { ...acc, id: res.id!, isNew: false } : a)),
          )
          toast.success(p.cardSaved)
          resolve(true)
        } else {
          toast.error(dict.errors?.genericError ?? "Error")
          resolve(false)
        }
      })
    })
  }

  // Remove um card (no servidor se ja foi salvo)
  const handleDelete = (acc: DraftAccount) => {
    setAccounts((prev) => prev.filter((a) => a.id !== acc.id))
    if (!acc.isNew) {
      startTransition(async () => {
        await deleteProductAccount(acc.id)
        toast.success(p.cardRemoved)
      })
    }
  }

  // Reordena (usado pela ferramenta Organizar)
  const handleReorder = (orderedIds: number[]) => {
    setAccounts((prev) => {
      const map = new Map(prev.map((a) => [a.id, a]))
      return orderedIds.map((id, i) => ({ ...(map.get(id) as DraftAccount), position: i }))
    })
    const persistIds = orderedIds.filter((id) => id > 0)
    if (persistIds.length > 0) {
      startTransition(async () => {
        await reorderProductAccounts(slug, persistIds)
      })
    }
    setOrganizeOpen(false)
    toast.success(p.organized)
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="rounded-lg border border-border bg-card/60 p-2 text-muted-foreground transition-colors hover:text-foreground"
          aria-label={p.back}
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <span
          className="flex h-9 w-9 items-center justify-center rounded-xl text-xs font-bold text-white"
          style={{ backgroundColor: meta.accent }}
          aria-hidden
        >
          {meta.label.slice(0, 2)}
        </span>
        <div className="flex-1">
          <h2 className="text-base font-bold text-foreground">{meta.label}</h2>
          <p className="text-xs text-muted-foreground">
            {p.savedCount.replace("{count}", String(accounts.length))}
          </p>
        </div>
        <button
          onClick={() => setOrganizeOpen(true)}
          disabled={accounts.length === 0}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card/60 px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-card disabled:opacity-40"
        >
          <LayoutGrid className="h-4 w-4" />
          {p.organize}
        </button>
        <button
          onClick={handleAddCard}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          {p.addCard}
        </button>
      </div>

      {/* Cards grid */}
      {accounts.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-card/30 py-12 text-center">
          <p className="text-sm text-muted-foreground">{p.noCards}</p>
          <button
            onClick={handleAddCard}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            {p.addCard}
          </button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((acc, idx) => (
            <AccountCard
              key={acc.id}
              dict={dict}
              accent={meta.accent}
              index={idx + 1}
              account={acc}
              onChange={(updated) =>
                setAccounts((prev) => prev.map((a) => (a.id === acc.id ? { ...a, ...updated } : a)))
              }
              onSave={() => handleSave(acc)}
              onDelete={() => handleDelete(acc)}
              onDeliver={() => setDeliveryFor(acc)}
            />
          ))}
        </div>
      )}

      {/* Delivery modal */}
      {deliveryFor && (
        <DeliveryModal
          dict={dict}
          account={deliveryFor}
          template={template}
          onTemplateSave={(body) => {
            setTemplate(body)
            startTransition(async () => {
              const { saveProductTemplate } = await import("@/app/actions/profile")
              await saveProductTemplate(slug, body)
              toast.success(p.templateSaved)
            })
          }}
          onClose={() => setDeliveryFor(null)}
        />
      )}

      {/* Organize modal */}
      {organizeOpen && (
        <OrganizeModal
          dict={dict}
          accounts={accounts}
          onApplyOrder={handleReorder}
          onClose={() => setOrganizeOpen(false)}
        />
      )}
    </div>
  )
}
