"use client"

import { useEffect, useState } from "react"
import {
  DollarSign,
  RefreshCw,
  Plus,
  Copy,
  Check,
  ExternalLink,
  TrendingUp,
  Package,
  X,
} from "lucide-react"

type Product = {
  id: number
  keyword: string
  name: string
  icon: string
  color: string
}

type PriceRow = {
  username: string
  label: string | null
  price: number
  out_of_stock: boolean
  last_restock: string | null
  scanned_at: string
}

const ICONS: Record<string, typeof DollarSign> = {
  DollarSign,
  Package,
  TrendingUp,
}

export function PricesTab() {
  const [products, setProducts] = useState<Product[]>([])
  const [selected, setSelected] = useState<Product | null>(null)
  const [rows, setRows] = useState<PriceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const [newProduct, setNewProduct] = useState({ keyword: "", name: "", color: "#7c5cbf" })

  const loadProducts = async () => {
    try {
      const res = await fetch("/api/products")
      const data = await res.json()
      setProducts(data.products || [])
      if (data.products?.length && !selected) {
        setSelected(data.products[0])
      }
    } catch {
      setProducts([])
    }
  }

  const loadPrices = async (keyword: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/prices?keyword=${encodeURIComponent(keyword)}`)
      const data = await res.json()
      setRows(data.results || [])
    } catch {
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadProducts()
  }, [])

  useEffect(() => {
    if (selected) loadPrices(selected.keyword)
  }, [selected])

  const addProduct = async () => {
    if (!newProduct.keyword || !newProduct.name) return
    await fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newProduct),
    })
    setNewProduct({ keyword: "", name: "", color: "#7c5cbf" })
    setShowAdd(false)
    loadProducts()
  }

  const copyUsername = (username: string) => {
    navigator.clipboard.writeText(username)
    setCopied(username)
    setTimeout(() => setCopied(null), 1500)
  }

  const inStock = rows.filter((r) => !r.out_of_stock)
  const avg = inStock.length
    ? inStock.reduce((s, r) => s + Number(r.price), 0) / inStock.length
    : 0
  const min = inStock.length ? Math.min(...inStock.map((r) => Number(r.price))) : 0
  const max = inStock.length ? Math.max(...inStock.map((r) => Number(r.price))) : 0

  const grouped = rows.reduce((acc, r) => {
    const key = r.label || r.username
    if (!acc[key]) acc[key] = []
    acc[key].push(r)
    return acc
  }, {} as Record<string, PriceRow[]>)

  return (
    <div className="space-y-4">
      {/* Product selector */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {products.map((p) => (
          <button
            key={p.id}
            onClick={() => setSelected(p)}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
              selected?.id === p.id
                ? "bg-primary text-primary-foreground"
                : "bg-card border border-border text-muted-foreground hover:bg-muted"
            }`}
          >
            <span
              className="h-5 w-5 rounded-full flex items-center justify-center text-xs"
              style={{ backgroundColor: p.color }}
            >
              {p.name[0]}
            </span>
            {p.name}
          </button>
        ))}
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1 rounded-lg border border-dashed border-border px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Plus className="h-4 w-4" />
          Novo
        </button>
        {selected && (
          <button
            onClick={() => loadPrices(selected.keyword)}
            disabled={loading}
            className="ml-auto rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        )}
      </div>

      {/* Add product modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowAdd(false)}>
          <div className="w-full max-w-sm rounded-xl border border-border bg-card p-4" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-semibold">Novo produto</h3>
              <button onClick={() => setShowAdd(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground">Keyword (pra buscar)</label>
                <input
                  value={newProduct.keyword}
                  onChange={(e) => setNewProduct({ ...newProduct, keyword: e.target.value })}
                  placeholder="gemini"
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Nome</label>
                <input
                  value={newProduct.name}
                  onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                  placeholder="Gemini Pro"
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Cor</label>
                <input
                  type="color"
                  value={newProduct.color}
                  onChange={(e) => setNewProduct({ ...newProduct, color: e.target.value })}
                  className="mt-1 h-9 w-full rounded-lg border border-border bg-background"
                />
              </div>
              <button
                onClick={addProduct}
                className="w-full rounded-lg bg-primary py-2 text-sm font-medium text-primary-foreground"
              >
                Criar
              </button>
            </div>
          </div>
        </div>
      )}

      {selected && (
        <>
          {/* Stats bar */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">Media</p>
              <p className="text-2xl font-bold tabular-nums">${avg.toFixed(2)}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">Menor</p>
              <p className="text-2xl font-bold tabular-nums text-emerald-400">${min.toFixed(2)}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">Maior</p>
              <p className="text-2xl font-bold tabular-nums text-rose-400">${max.toFixed(2)}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">Em estoque</p>
              <p className="text-2xl font-bold tabular-nums">{inStock.length}</p>
            </div>
          </div>

          {/* Chart placeholder */}
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Historico de precos</h2>
              <span className="text-xs text-muted-foreground">Ultimas 24h</span>
            </div>
            <div className="flex h-40 items-end gap-1">
              {inStock.slice(0, 20).map((r, i) => {
                const height = max > min ? ((Number(r.price) - min) / (max - min)) * 100 : 50
                return (
                  <div
                    key={i}
                    className="flex-1 rounded-t bg-primary/60 transition-all hover:bg-primary"
                    style={{ height: `${Math.max(10, height)}%` }}
                    title={`${r.label || r.username}: $${Number(r.price).toFixed(2)}`}
                  />
                )
              })}
              {inStock.length === 0 && (
                <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
                  Sem dados
                </div>
              )}
            </div>
          </div>

          {/* Suppliers */}
          <div className="rounded-xl border border-border bg-card">
            <div className="border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold">Fornecedores</h2>
            </div>
            {loading ? (
              <div className="py-12 text-center text-sm text-muted-foreground">Carregando...</div>
            ) : rows.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                Nenhum preco encontrado. Rode o scanner.
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {Object.entries(grouped).map(([label, items]) => (
                  <li key={label} className="px-4 py-3">
                    <p className="mb-2 text-sm font-medium text-muted-foreground">{label}</p>
                    <div className="space-y-2">
                      {items.map((r, i) => (
                        <div
                          key={`${r.username}-${i}`}
                          className={`flex items-center justify-between rounded-lg bg-background px-3 py-2 ${
                            r.out_of_stock ? "opacity-50" : ""
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => copyUsername(r.username)}
                              className="flex items-center gap-1.5 rounded px-2 py-1 text-sm font-medium text-emerald-400 hover:bg-muted"
                              title="Copiar"
                            >
                              {copied === r.username ? (
                                <Check className="h-3.5 w-3.5" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                              {r.username}
                            </button>
                            <a
                              href={`https://t.me/${r.username.replace("@", "")}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-muted-foreground hover:text-foreground"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          </div>
                          <div className="text-right">
                            <span className="text-lg font-semibold tabular-nums">
                              ${Number(r.price).toFixed(2)}
                            </span>
                            {r.out_of_stock && (
                              <p className="text-xs text-destructive">Sem estoque</p>
                            )}
                            {r.last_restock && (
                              <p className="text-xs text-muted-foreground">
                                {new Date(r.last_restock).toLocaleDateString("pt-BR")}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      {!selected && products.length === 0 && (
        <div className="py-12 text-center">
          <p className="text-muted-foreground">Nenhum produto criado.</p>
          <button
            onClick={() => setShowAdd(true)}
            className="mt-3 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Criar primeiro produto
          </button>
        </div>
      )}
    </div>
  )
}
