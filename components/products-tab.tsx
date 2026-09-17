"use client"

import { useState, useEffect } from "react"
import { Crown, Lock, ChevronRight, ShieldCheck } from "lucide-react"
import { PRODUCT_SLUGS, PRODUCT_META, type ProductSlug, type ProductAccount } from "@/lib/products"
import { ProductDetail } from "@/components/product-detail"
import type { Dictionary } from "@/lib/i18n"

interface ProductsTabProps {
  dict: Dictionary
  isVip: boolean
  accounts: ProductAccount[]
  templates: Record<string, string>
  initialOpenProduct?: ProductSlug | null
  onRequestVip: () => void
}

export function ProductsTab({ dict, isVip, accounts, templates, initialOpenProduct = null, onRequestVip }: ProductsTabProps) {
  const p = dict.profile
  const [openProduct, setOpenProduct] = useState<ProductSlug | null>(initialOpenProduct)

  // Quando o usuario "move para produto" a partir de um gmail, abre direto o produto.
  useEffect(() => {
    if (initialOpenProduct) setOpenProduct(initialOpenProduct)
  }, [initialOpenProduct])

  const countFor = (slug: ProductSlug) => accounts.filter((a) => a.product === slug).length

  // ---- Non-VIP: locked, "amarelada" (amber) state to draw attention ----
  if (!isVip) {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-amber-400/50 bg-amber-400/10 p-6">
        <div className="pointer-events-none absolute inset-0 opacity-40 blur-sm">
          <div className="grid gap-3 sm:grid-cols-2">
            {PRODUCT_SLUGS.map((slug) => (
              <div key={slug} className="rounded-xl border border-amber-400/30 bg-card/60 p-4">
                <span className="text-sm font-semibold" style={{ color: PRODUCT_META[slug].accent }}>
                  {PRODUCT_META[slug].label}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="relative flex flex-col items-center justify-center gap-3 py-6 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-400 text-amber-950">
            <Lock className="h-6 w-6" />
          </div>
          <h3 className="text-base font-bold text-amber-200">{p.productsVipTitle}</h3>
          <p className="max-w-sm text-sm text-amber-100/80">{p.productsVipDesc}</p>
          <button
            onClick={onRequestVip}
            className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-amber-400 px-4 py-2 text-sm font-bold text-amber-950 transition-colors hover:bg-amber-300"
          >
            <Crown className="h-4 w-4" />
            {p.getVip}
          </button>
        </div>
      </div>
    )
  }

  // ---- VIP: product detail view ----
  if (openProduct) {
    const productAccounts = accounts.filter((a) => a.product === openProduct)
    return (
      <ProductDetail
        // Remonta quando a contagem muda (ex.: card recem-movido apos refresh)
        key={`${openProduct}-${productAccounts.length}`}
        dict={dict}
        slug={openProduct}
        initialAccounts={productAccounts}
        initialTemplate={templates[openProduct] ?? ""}
        onBack={() => setOpenProduct(null)}
      />
    )
  }

  // ---- VIP: product grid (tiles) ----
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-foreground">{p.productsTitle}</h2>
        <p className="text-xs text-muted-foreground">{p.productsDesc}</p>
      </div>

      {/* Aviso de privacidade */}
      <div className="flex items-start gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
        <p className="text-xs leading-relaxed text-emerald-200/90">{p.privacyNotice}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {PRODUCT_SLUGS.map((slug) => {
          const meta = PRODUCT_META[slug]
          const count = countFor(slug)
          return (
            <button
              key={slug}
              onClick={() => setOpenProduct(slug)}
              className="group flex flex-col items-start gap-3 rounded-2xl border border-border bg-card/60 p-4 text-left transition-colors hover:border-primary/50 hover:bg-card"
            >
              <div className="flex w-full items-center justify-between">
                <span
                  className="flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold text-white"
                  style={{ backgroundColor: meta.accent }}
                  aria-hidden
                >
                  {meta.label.slice(0, 2)}
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{meta.label}</p>
                <p className="text-xs text-muted-foreground">
                  {p.savedCount.replace("{count}", String(count))}
                </p>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
