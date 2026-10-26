"use client"

import { useEffect, useState } from "react"
import { DollarSign, RefreshCw } from "lucide-react"

type PriceRow = {
  username: string
  price: number
  out_of_stock: boolean
  last_restock: string | null
  snippet: string | null
  scanned_at: string
}

export function PricesTab() {
  const [keyword, setKeyword] = useState("gemini")
  const [rows, setRows] = useState<PriceRow[]>([])
  const [loading, setLoading] = useState(true)

  const load = async (kw: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/prices?keyword=${encodeURIComponent(kw)}`)
      const data = await res.json()
      setRows(data.results || [])
    } catch {
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load(keyword)
  }, [keyword])

  const inStock = rows.filter((r) => !r.out_of_stock)
  const avg = inStock.length
    ? (inStock.reduce((s, r) => s + Number(r.price), 0) / inStock.length).toFixed(2)
    : null

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <DollarSign className="h-6 w-6 text-emerald-400" />
            Preços
          </h1>
          <p className="text-sm text-muted-foreground">
            {loading ? "Carregando..." : `${inStock.length} em estoque`}
            {avg && ` · média $${avg}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {["gemini", "chatgpt", "claude", "capcut"].map((kw) => (
            <button
              key={kw}
              onClick={() => setKeyword(kw)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                keyword === kw
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {kw}
            </button>
          ))}
          <button
            onClick={() => load(keyword)}
            disabled={loading}
            className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
            title="Atualizar"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center text-muted-foreground py-12">Carregando...</div>
      ) : rows.length === 0 ? (
        <div className="text-center text-muted-foreground py-12">
          Nenhum preço encontrado para "{keyword}".
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <ul className="divide-y divide-border">
            {rows.map((r) => (
              <li
                key={r.username}
                className={`flex items-center justify-between px-4 py-3 ${
                  r.out_of_stock ? "opacity-50" : ""
                }`}
              >
                <div className="min-w-0">
                  <a
                    href={`https://t.me/${r.username.replace("@", "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-emerald-400 hover:underline truncate block"
                  >
                    {r.username}
                  </a>
                  {r.last_restock && (
                    <p className="text-xs text-muted-foreground">
                      Restock: {new Date(r.last_restock).toLocaleString("pt-BR")}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <span className="text-lg font-semibold tabular-nums">
                    ${Number(r.price).toFixed(2)}
                  </span>
                  {r.out_of_stock && (
                    <p className="text-xs text-destructive">Sem estoque</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
