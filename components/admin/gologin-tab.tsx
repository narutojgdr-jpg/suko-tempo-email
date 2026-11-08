"use client"

import { useEffect, useState } from "react"
import { Mail, RefreshCw } from "lucide-react"

type Item = {
  email: string
  pass: string
  status: string
  kind: string
  id: number
}

export function GoLoginTab() {
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function load() {
    setLoading(true)
    setError("")
    try {
      const r = await fetch("/api/admin/gologin-gmails")
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const data = await r.json()
      setItems(data.items || [])
    } catch (e: any) {
      setError(e.message || "Falha ao carregar")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Mail className="h-6 w-6 text-violet-400" />
            GoLogin Gmails
          </h1>
          <p className="text-sm text-muted-foreground">
            Lista sincronizada com o app local. {items.length} contas.
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="border-b border-border px-4 py-3 text-sm font-medium">
          Contas
        </div>
        {items.length === 0 && !loading ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">
            Nenhuma conta encontrada.
          </p>
        ) : (
          <div className="divide-y divide-border max-h-[600px] overflow-y-auto">
            {items.map((item) => (
              <div key={item.id} className="px-4 py-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{item.email}</span>
                  <span className="text-xs text-muted-foreground">{item.kind}</span>
                </div>
                {item.pass && (
                  <p className="mt-1 text-xs text-muted-foreground font-mono">
                    {item.pass}
                  </p>
                )}
                <p className="mt-1 text-xs text-muted-foreground">status: {item.status}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
