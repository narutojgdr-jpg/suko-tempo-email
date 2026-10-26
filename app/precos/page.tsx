"use client"

import { useEffect, useState } from "react"
import { SiteHeader } from "@/components/site-header"

type PriceRow = {
  username: string
  price: number
  out_of_stock: boolean
  last_restock: string | null
  snippet: string | null
  scanned_at: string
}

export default function PrecosPage() {
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
    <div className="flex min-h-screen flex-col bg-zinc-950 text-white">
      <SiteHeader lang="pt" />

      <main className="flex-1 px-4 py-8 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold">Preços</h1>
              <p className="text-sm text-zinc-400">
                {loading ? "Carregando..." : `${inStock.length} em estoque`}
                {avg && ` · média $${avg}`}
              </p>
            </div>
            <div className="flex gap-2">
              {["gemini", "chatgpt", "claude", "capcut"].map((kw) => (
                <button
                  key={kw}
                  onClick={() => setKeyword(kw)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    keyword === kw
                      ? "bg-emerald-500 text-white"
                      : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                  }`}
                >
                  {kw}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="text-center text-zinc-500 py-12">Carregando...</div>
          ) : rows.length === 0 ? (
            <div className="text-center text-zinc-500 py-12">
              Nenhum preço encontrado para "{keyword}".
            </div>
          ) : (
            <div className="space-y-2">
              {rows.map((r) => (
                <div
                  key={r.username}
                  className={`flex items-center justify-between rounded-lg border px-4 py-3 ${
                    r.out_of_stock
                      ? "border-zinc-800 bg-zinc-900/50 opacity-60"
                      : "border-zinc-800 bg-zinc-900"
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
                      <p className="text-xs text-zinc-500">
                        Restock: {new Date(r.last_restock).toLocaleString("pt-BR")}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-semibold">
                      ${Number(r.price).toFixed(2)}
                    </span>
                    {r.out_of_stock && (
                      <p className="text-xs text-red-400">Sem estoque</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
