"use client"

import { useEffect, useState } from "react"
import {
  RefreshCw,
  Plus,
  Copy,
  Check,
  ExternalLink,
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

  return (
    <div className="flex h-[calc(100vh-3rem)] gap-4">
      {/* Main content */}
      <div className="flex flex-1 flex-col gap-4 overflow-hidden">
        {/* Product selector */}
        <div className="flex items-center gap-2 overflow-x-auto">
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
                className="flex h-5 w-5 items-center justify-center rounded-full text-xs text-white"
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
        </div>

        {selected && (
          <>
            {/* Stats */}
            <div className="grid grid-cols-4 gap-3">
              <div className="rounded-xl border border-border bg-card p-3">
                <p className="text-xs text-muted-foreground">Media</p>
                <p className="text-xl font-bold tabular-nums">${avg.toFixed(2)}</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-3">
                <p className="text-xs text-muted-foreground">Menor</p>
                <p className="text-xl font-bold tabular-nums text-emerald-400">${min.toFixed(2)}</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-3">
                <p className="text-xs text-muted-foreground">Maior</p>
                <p className="text-xl font-bold tabular-nums text-rose-400">${max.toFixed(2)}</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-3">
                <p className="text-xs text-muted-foreground">Em estoque</p>
                <p className="text-xl font-bold tabular-nums">{inStock.length}</p>
              </div>
            </div>

            {/* Chart */}
            <div className="flex-1 rounded-xl border border-border bg-card p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold">Historico de precos</h2>
                <span className="text-xs text-muted-foreground">Ultimas 24h</span>
              </div>
              <div className="flex h-48 items-end gap-1">
                {inStock.slice(0, 30).map((r, i) => {
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
          </>
        )}

        {!selected && products.length === 0 && (
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center">
              <p className="text-muted-foreground">Nenhum produto criado.</p>
              <button
                onClick={() => setShowAdd(true)}
                className="mt-3 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
              >
                Criar primeiro produto
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Suppliers sidebar */}
      <div className="flex w-72 shrink-0 flex-col">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Fornecedores</h2>
          {selected && (
            <button
              onClick={() => loadPrices(selected.keyword)}
              disabled={loading}
              className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          )}
        </div>
        <div className="flex-1 space-y-2 overflow-y-auto pr-1">
          {loading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Carregando...</div>
          ) : rows.length === 0 ? (
            <div className="rounded-xl border border-border bg-card py-12 text-center text-sm text-muted-foreground">
              Nenhum preco. Rode o scanner.
            </div>
          ) : (
            rows.map((r, i) => (
              <div
                key={`${r.username}-${r.label}-${i}`}
                className={`rounded-xl border border-border bg-card p-3 transition-colors hover:border-primary/50 ${
                  r.out_of_stock ? "opacity-50" : ""
                }`}
              >
                <p className="mb-1 truncate text-sm font-medium">{r.label || "-"}</p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => copyUsername(r.username)}
                      className="flex items-center gap-1 text-xs text-emerald-400 hover:underline"
                    >
                      {copied === r.username ? (
                        <Check className="h-3 w-3" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                      {r.username}
                    </button>
                    <a
                      href={`https://t.me/${r.username.replace("@", "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                  <span className="text-lg font-bold tabular-nums">${Number(r.price).toFixed(2)}</span>
                </div>
                {(r.out_of_stock || r.last_restock) && (
                  <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
                    {r.out_of_stock && <span className="text-destructive">Sem estoque</span>}
                    {r.last_restock && (
                      <span>Restock: {new Date(r.last_restock).toLocaleDateString("pt-BR")}</span>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
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
                <label className="text-xs text-muted-foreground">Keyword</label>
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
    </div>
  )
}
