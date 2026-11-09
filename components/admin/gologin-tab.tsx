"use client"

import { useEffect, useState, useMemo } from "react"
import { Mail, RefreshCw, Trash2, CheckSquare, Square, Search } from "lucide-react"
import { deleteGoLoginAccounts } from "@/app/actions/gologin"

type Item = {
  id: number
  email: string
  pass: string
  cookies: string
  notes: string
}

export function GoLoginTab() {
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [importText, setImportText] = useState("")
  const [importing, setImporting] = useState(false)
  const [search, setSearch] = useState("")

  async function load() {
    setLoading(true)
    setError("")
    try {
      const r = await fetch("/api/admin/gologin-gmails")
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const data = await r.json()
      setItems(data.items || [])
      setSelected(new Set())
    } catch (e: any) {
      setError(e.message || "Falha ao carregar")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return items
    return items.filter((i) => i.email.toLowerCase().includes(q))
  }, [items, search])

  function toggle(id: number) {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }

  function selectAll() {
    if (selected.size === filtered.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(filtered.map((i) => i.id)))
    }
  }

  async function removeSelected() {
    if (selected.size === 0) return
    if (!confirm(`Excluir ${selected.size} conta(s)?`)) return
    const res = await deleteGoLoginAccounts(Array.from(selected))
    if (res.ok) await load()
  }

  async function doImport() {
    if (!importText.trim()) return
    setImporting(true)
    try {
      const r = await fetch("/api/admin/gologin-gmails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raw: importText }),
      })
      const data = await r.json()
      if (data.ok) {
        setImportText("")
        await load()
        alert(`Importado: ${data.added} | Pulados: ${data.skipped}`)
      } else {
        alert(data.error || "Falha no import")
      }
    } catch {
      alert("Erro ao importar")
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Mail className="h-6 w-6 text-violet-400" />
            GoLogin Gmails
          </h1>
          <p className="text-sm text-muted-foreground">
            {filtered.length}{search ? ` de ${items.length}` : ""} contas. Sincroniza com o app local.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={selectAll}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted"
          >
            {selected.size === filtered.length && filtered.length > 0 ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
            Selecionar
          </button>
          <button
            onClick={removeSelected}
            disabled={selected.size === 0}
            className="flex items-center gap-1.5 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive hover:bg-destructive/20 disabled:opacity-40"
          >
            <Trash2 className="h-4 w-4" />
            Excluir ({selected.size})
          </button>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-border bg-card p-4">
        <h2 className="text-sm font-semibold mb-2">Importar do formato do HTML</h2>
        <textarea
          value={importText}
          onChange={(e) => setImportText(e.target.value)}
          placeholder="Cole aqui o texto exportado do SukoSpot (=== email ===\nSenha: ...\nCookies JSON:\n[...])"
          className="w-full h-32 rounded-lg border border-border bg-background p-3 text-sm font-mono resize-y"
        />
        <button
          onClick={doImport}
          disabled={importing || !importText.trim()}
          className="mt-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {importing ? "Importando..." : "Importar"}
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar gmail..."
          className="w-full rounded-lg border border-border bg-card py-2 pl-9 pr-3 text-sm"
        />
      </div>

      {filtered.length === 0 && !loading ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          {search ? "Nenhum resultado." : "Nenhuma conta ainda. Importa pelo campo acima ou pelo app."}
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((item) => (
            <div
              key={item.id}
              className={`rounded-xl border bg-card p-4 transition-colors ${selected.has(item.id) ? "border-primary" : "border-border"}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium">{item.email}</p>
                  <p className="mt-1 text-xs font-mono text-muted-foreground truncate">
                    {item.pass || "(sem senha)"}
                  </p>
                </div>
                <button
                  onClick={() => toggle(item.id)}
                  className="shrink-0 text-muted-foreground hover:text-foreground"
                >
                  {selected.has(item.id) ? <CheckSquare className="h-5 w-5 text-primary" /> : <Square className="h-5 w-5" />}
                </button>
              </div>
              {item.cookies && (
                <p className="mt-2 text-xs text-muted-foreground line-clamp-2 font-mono">
                  cookies: {item.cookies.slice(0, 80)}...
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
