"use client"

import { useMemo, useState, useTransition } from "react"
import { Music, Trash2, Copy, ChevronDown, ChevronRight, Download, Play, RefreshCw, Save, CheckSquare, Square } from "lucide-react"
import {
  deleteSpotifyAccount,
  importSpotifyAccounts,
  updateSpotifyAccount,
  listSpotifyAccounts,
  type SpotifyAccount,
} from "@/app/actions/spotify"

export function SpotifyTab({ accounts: initial }: { accounts: SpotifyAccount[] }) {
  const [accounts, setAccounts] = useState(initial)
  const [bulk, setBulk] = useState("")
  const [filter, setFilter] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState("")
  const [edits, setEdits] = useState<Record<number, { email: string; password: string; gmail: string; notes: string; cookie: string }>>({})
  const [selected, setSelected] = useState<Set<number>>(new Set())

  const filtered = useMemo(() => {
    if (!statusFilter) return accounts
    if (statusFilter === "sem") return accounts.filter((a) => !a.status)
    return accounts.filter((a) => a.status === statusFilter)
  }, [accounts, statusFilter])

  const grouped = useMemo(() => {
    const map = new Map<string, SpotifyAccount[]>()
    for (const a of filtered) {
      const d = a.domain || "sem-dominio"
      if (!map.has(d)) map.set(d, [])
      map.get(d)!.push(a)
    }
    return Array.from(map.entries()).sort((a, b) => b[1].length - a[1].length)
  }, [filtered])

  const visible = filter ? grouped.filter(([d]) => d === filter) : grouped
  const exportList = filter ? filtered.filter((a) => a.domain === filter) : filtered

  const counts = useMemo(() => ({
    premium: accounts.filter((a) => a.status === "premium").length,
    free: accounts.filter((a) => a.status === "free").length,
    morta: accounts.filter((a) => a.status === "morta").length,
    sem: accounts.filter((a) => !a.status).length,
  }), [accounts])

  function toggleSelect(id: number) {
    setSelected((prev) => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  function selectDomain(list: SpotifyAccount[]) {
    setSelected((prev) => {
      const n = new Set(prev)
      const allSelected = list.every((a) => n.has(a.id))
      if (allSelected) {
        list.forEach((a) => n.delete(a.id))
      } else {
        list.forEach((a) => n.add(a.id))
      }
      return n
    })
  }

  function clearSelection() {
    setSelected(new Set())
  }

  function getEdit(a: SpotifyAccount) {
    return edits[a.id] || { email: a.email, password: a.password, gmail: a.gmail, notes: a.notes, cookie: a.cookie || "" }
  }

  function setEdit(id: number, field: "email" | "password" | "gmail" | "notes" | "cookie", value: string, base: SpotifyAccount) {
    setEdits((prev) => {
      const cur = prev[id] || { email: base.email, password: base.password, gmail: base.gmail, notes: base.notes, cookie: base.cookie || "" }
      return { ...prev, [id]: { ...cur, [field]: value } }
    })
  }

  function refresh() {
    setMsg("")
    start(async () => {
      const list = await listSpotifyAccounts()
      setAccounts(list)
      setEdits({})
      setMsg("Atualizado")
      setTimeout(() => setMsg(""), 1200)
    })
  }

  function importBulk() {
    setMsg("")
    start(async () => {
      const res = await importSpotifyAccounts(bulk)
      if (!res.ok) {
        setMsg(res.error ?? "Erro")
        return
      }
      setBulk("")
      setMsg(`Importadas ${res.added}. Puladas ${res.skipped}.`)
      const list = await listSpotifyAccounts()
      setAccounts(list)
    })
  }

  function remove(id: number) {
    if (!confirm("Apagar essa conta?")) return
    start(async () => {
      await deleteSpotifyAccount(id)
      setAccounts((prev) => prev.filter((a) => a.id !== id))
      setSelected((prev) => {
        const n = new Set(prev)
        n.delete(id)
        return n
      })
    })
  }

  async function removeSelected() {
    if (selected.size === 0) return
    if (!confirm(`Apagar ${selected.size} contas?`)) return
    const ids = Array.from(selected)
    setMsg("")
    start(async () => {
      for (const id of ids) {
        await deleteSpotifyAccount(id)
      }
      setAccounts((prev) => prev.filter((a) => !selected.has(a.id)))
      setSelected(new Set())
      setMsg(`${ids.length} apagadas`)
      setTimeout(() => setMsg(""), 1500)
    })
  }

  function save(id: number) {
    const a = accounts.find((x) => x.id === id)
    if (!a) return
    const e = getEdit(a)
    setMsg("")
    start(async () => {
      const res = await updateSpotifyAccount(id, e)
      if (!res.ok) {
        setMsg(res.error ?? "Erro")
        return
      }
      setAccounts((prev) =>
        prev.map((x) =>
          x.id === id
            ? { ...x, email: e.email, password: e.password, gmail: e.gmail, notes: e.notes, cookie: e.cookie, domain: domainOf(e.email) }
            : x,
        ),
      )
      setEdits((prev) => {
        const n = { ...prev }
        delete n[id]
        return n
      })
      setMsg("Salvo")
      setTimeout(() => setMsg(""), 1200)
    })
  }

  function domainOf(em: string) {
    const at = em.lastIndexOf("@")
    if (at < 1) return ""
    const host = em.slice(at + 1).toLowerCase()
    const parts = host.split(".").filter(Boolean)
    if (parts.length <= 2) return host
    return parts.slice(-2).join(".")
  }

  function copy(text: string, label?: string) {
    if (!text) return
    navigator.clipboard.writeText(text)
    setMsg(label ? `${label} copiado` : "Copiado")
    setTimeout(() => setMsg(""), 1200)
  }

  function exportAll() {
    const lines = exportList.map(
      (a) => `${a.email}|${a.password}|${a.gmail || ""}|${a.notes || ""}|${a.cookie || ""}`,
    )
    copy(lines.join("\n"), "Lote")
  }

  function copySelected() {
    const list = accounts.filter((a) => selected.has(a.id))
    const lines = list.map((a) => {
      const e = getEdit(a)
      return `${e.email}|${e.password}|${e.gmail || ""}|${e.notes || ""}|${e.cookie || ""}`
    })
    copy(lines.join("\n"), `${list.length} contas`)
  }

  async function verificar(id: number, cookie: string) {
    if (!cookie) {
      setMsg("Sem cookie")
      return
    }
    setMsg("")
    const res = await fetch("/api/spotify/task", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountId: id, cookie }),
    })
    const data = await res.json()
    setMsg(data.ok ? "Tarefa criada" : data.error || "Erro")
    setTimeout(() => setMsg(""), 1500)
  }

  async function verificarSelected() {
    const list = accounts.filter((a) => selected.has(a.id))
    const items = list
      .map((a) => {
        const e = getEdit(a)
        return e.cookie ? { accountId: a.id, cookie: e.cookie } : null
      })
      .filter(Boolean)
    if (items.length === 0) {
      setMsg("Nenhuma com cookie")
      return
    }
    setMsg("")
    const res = await fetch("/api/spotify/task", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(items),
    })
    const data = await res.json()
    setMsg(data.ok ? `${data.created} tarefas criadas` : data.error || "Erro")
    setTimeout(() => setMsg(""), 2000)
  }

  async function verificarDominio(list: SpotifyAccount[]) {
    const items = list
      .map((a) => {
        const e = getEdit(a)
        return e.cookie ? { accountId: a.id, cookie: e.cookie } : null
      })
      .filter(Boolean)
    if (items.length === 0) {
      setMsg("Nenhuma com cookie")
      return
    }
    setMsg("")
    const res = await fetch("/api/spotify/task", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(items),
    })
    const data = await res.json()
    setMsg(data.ok ? `${data.created} tarefas criadas` : data.error || "Erro")
    setTimeout(() => setMsg(""), 2000)
  }

  function fmtDate(iso: string | null) {
    if (!iso) return "nunca"
    const d = new Date(iso)
    return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
  }

  function statusColor(status: string) {
    if (status === "premium") return "bg-emerald-500/20 text-emerald-300"
    if (status === "free") return "bg-amber-500/20 text-amber-300"
    if (status === "morta") return "bg-red-500/20 text-red-300"
    return "bg-muted text-muted-foreground"
  }

  async function clearTasks() {
    if (!confirm("Eliminar TODAS as tarefas pendentes e em andamento?")) return
    setMsg("")
    try {
      const res = await fetch("/api/spotify/task", { method: "DELETE" })
      const data = await res.json()
      setMsg(data.ok ? `${data.deleted} tarefas eliminadas` : "Erro ao limpar")
      setTimeout(() => setMsg(""), 2000)
    } catch {
      setMsg("Erro ao limpar tarefas")
      setTimeout(() => setMsg(""), 2000)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Spotify</h1>
          <p className="text-sm text-muted-foreground">Contas e verificacao</p>
        </div>
        <div className="flex gap-2">
          <button onClick={refresh} disabled={pending} className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm">
            <RefreshCw className="h-4 w-4" /> Atualizar
          </button>
          <button onClick={exportAll} className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm">
            <Download className="h-4 w-4" /> Exportar
          </button>
          <button onClick={clearTasks} className="flex items-center gap-1.5 rounded-lg border border-destructive/40 px-3 py-1.5 text-sm text-destructive">
            <Trash2 className="h-4 w-4" /> Limpar fila
          </button>
        </div>
      </div>

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/40 bg-primary/5 px-4 py-3">
          <span className="text-sm font-medium">{selected.size} selecionadas</span>
          <button onClick={verificarSelected} className="flex items-center gap-1 rounded-lg border border-emerald-500/40 px-3 py-1.5 text-sm text-emerald-400">
            <Play className="h-4 w-4" /> Verificar
          </button>
          <button onClick={copySelected} className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-sm">
            <Copy className="h-4 w-4" /> Copiar
          </button>
          <button onClick={removeSelected} disabled={pending} className="flex items-center gap-1 rounded-lg border border-destructive/40 px-3 py-1.5 text-sm text-destructive">
            <Trash2 className="h-4 w-4" /> Apagar
          </button>
          <button onClick={clearSelection} className="ml-auto text-sm text-muted-foreground hover:text-foreground">Limpar</button>
        </div>
      )}

      <div className="rounded-xl border border-border bg-card p-4">
        <h2 className="mb-2 text-sm font-semibold">Colar em lote</h2>
        <textarea
          value={bulk}
          onChange={(e) => setBulk(e.target.value)}
          rows={5}
          placeholder="email|senha|gmail|Nome|cookie"
          className="w-full rounded-lg border border-border bg-background p-3 font-mono text-sm"
        />
        <div className="mt-2 flex items-center gap-3">
          <button onClick={importBulk} disabled={pending || !bulk.trim()} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
            {pending ? "Importando..." : "Importar"}
          </button>
          {msg && <span className="text-sm text-muted-foreground">{msg}</span>}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button onClick={() => setStatusFilter(null)} className={`rounded-lg border px-3 py-2 text-sm ${statusFilter === null ? "border-primary bg-primary/10" : "border-border bg-card"}`}>
          Todos <span className="ml-1 font-bold">{accounts.length}</span>
        </button>
        <button onClick={() => setStatusFilter("sem")} className={`rounded-lg border px-3 py-2 text-sm ${statusFilter === "sem" ? "border-primary bg-primary/10" : "border-border bg-card"}`}>
          Sem verificar <span className="ml-1 font-bold">{counts.sem}</span>
        </button>
        <button onClick={() => setStatusFilter("premium")} className={`rounded-lg border px-3 py-2 text-sm ${statusFilter === "premium" ? "border-emerald-500 bg-emerald-500/10 text-emerald-300" : "border-border bg-card"}`}>
          Premium <span className="ml-1 font-bold">{counts.premium}</span>
        </button>
        <button onClick={() => setStatusFilter("free")} className={`rounded-lg border px-3 py-2 text-sm ${statusFilter === "free" ? "border-amber-500 bg-amber-500/10 text-amber-300" : "border-border bg-card"}`}>
          Free <span className="ml-1 font-bold">{counts.free}</span>
        </button>
        <button onClick={() => setStatusFilter("morta")} className={`rounded-lg border px-3 py-2 text-sm ${statusFilter === "morta" ? "border-red-500 bg-red-500/10 text-red-300" : "border-border bg-card"}`}>
          Morta <span className="ml-1 font-bold">{counts.morta}</span>
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <button onClick={() => setFilter(null)} className={`rounded-lg border px-3 py-2 text-sm ${filter === null ? "border-primary bg-primary/10" : "border-border bg-card"}`}>
          Todos dominios <span className="ml-1 font-bold">{filtered.length}</span>
        </button>
        {grouped.map(([domain, list]) => (
          <button key={domain} onClick={() => setFilter(domain)} className={`rounded-lg border px-3 py-2 text-sm ${filter === domain ? "border-primary bg-primary/10" : "border-border bg-card"}`}>
            {domain} <span className="ml-1 font-bold">{list.length}</span>
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {visible.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma conta.</p>}
        {visible.map(([domain, list]) => {
          const isOpen = open[domain] !== false
          const domainSelected = list.filter((a) => selected.has(a.id)).length
          const allSelected = domainSelected === list.length && list.length > 0
          return (
            <div key={domain} className="rounded-xl border border-border bg-card">
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2">
                  <button onClick={() => selectDomain(list)} className="text-muted-foreground hover:text-foreground">
                    {allSelected ? <CheckSquare className="h-4 w-4 text-primary" /> : <Square className="h-4 w-4" />}
                  </button>
                  <button onClick={() => setOpen((s) => ({ ...s, [domain]: !isOpen }))} className="flex items-center gap-2 text-left">
                    {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    <Music className="h-4 w-4 text-emerald-400" />
                    <span className="font-semibold">{domain}</span>
                    <span className="text-sm text-muted-foreground">{list.length}</span>
                    {domainSelected > 0 && <span className="text-xs text-primary">({domainSelected})</span>}
                  </button>
                </div>
                <button onClick={() => verificarDominio(list)} className="flex items-center gap-1.5 rounded-lg border border-emerald-500/40 px-3 py-1.5 text-sm text-emerald-400">
                  <Play className="h-4 w-4" /> Verificar todos
                </button>
              </div>
              {isOpen && (
                <div className="grid grid-cols-1 gap-3 border-t border-border p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {list.map((a) => {
                    const e = getEdit(a)
                    const isSelected = selected.has(a.id)
                    return (
                      <div key={a.id} className={`flex flex-col gap-2 rounded-lg border p-3 ${isSelected ? "border-primary bg-primary/5" : "border-border bg-background"}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <button onClick={() => toggleSelect(a.id)} className="text-muted-foreground hover:text-foreground">
                              {isSelected ? <CheckSquare className="h-4 w-4 text-primary" /> : <Square className="h-4 w-4" />}
                            </button>
                            <span className={`rounded px-2 py-0.5 text-xs font-semibold uppercase ${statusColor(a.status)}`}>{a.status || "\u2014"}</span>
                          </div>
                          <span className="text-xs text-muted-foreground">{fmtDate(a.lastChecked)}</span>
                        </div>
                        <label className="text-xs text-muted-foreground">Email</label>
                        <input value={e.email} onChange={(ev) => setEdit(a.id, "email", ev.target.value, a)} className="w-full rounded border border-border bg-card px-2 py-1.5 font-mono text-sm" />
                        <label className="text-xs text-muted-foreground">Senha</label>
                        <input value={e.password} onChange={(ev) => setEdit(a.id, "password", ev.target.value, a)} className="w-full rounded border border-border bg-card px-2 py-1.5 font-mono text-sm" />
                        <label className="text-xs text-muted-foreground">Gmail</label>
                        <input value={e.gmail} onChange={(ev) => setEdit(a.id, "gmail", ev.target.value, a)} className="w-full rounded border border-border bg-card px-2 py-1.5 font-mono text-sm" />
                        <label className="text-xs text-muted-foreground">Nome</label>
                        <input value={e.notes} onChange={(ev) => setEdit(a.id, "notes", ev.target.value, a)} className="w-full rounded border border-border bg-card px-2 py-1.5 font-mono text-sm" />
                        <label className="text-xs text-muted-foreground">Cookie</label>
                        <input value={e.cookie} onChange={(ev) => setEdit(a.id, "cookie", ev.target.value, a)} className="w-full rounded border border-border bg-card px-2 py-1.5 font-mono text-sm" />
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          <button onClick={() => save(a.id)} disabled={pending} className="flex items-center gap-1 rounded border border-border px-2 py-1 text-xs"><Save className="h-3.5 w-3.5" /> Salvar</button>
                          <button onClick={() => verificar(a.id, e.cookie)} disabled={!e.cookie} className="flex items-center gap-1 rounded border border-emerald-500/40 px-2 py-1 text-xs text-emerald-400 disabled:opacity-40"><Play className="h-3.5 w-3.5" /> Verificar</button>
                          <button onClick={() => copy(`${e.email}|${e.password}|${e.gmail || ""}|${e.notes || ""}|${e.cookie || ""}`)} className="flex items-center gap-1 rounded border border-border px-2 py-1 text-xs"><Copy className="h-3.5 w-3.5" /> Copiar</button>
                          <button onClick={() => remove(a.id)} className="flex items-center gap-1 rounded border border-destructive/40 px-2 py-1 text-xs text-destructive"><Trash2 className="h-3.5 w-3.5" /> Apagar</button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
