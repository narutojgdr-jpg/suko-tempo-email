"use client"

import { useMemo, useState, useTransition } from "react"
import { Music, Plus, Trash2, Copy, ChevronDown, ChevronRight, Download, ShieldCheck, RefreshCw, Save, Play } from "lucide-react"
import {
  addSpotifyAccount,
  deleteSpotifyAccount,
  importSpotifyAccounts,
  getSpotifyAuthorizeUrl,
  checkSpotifyAccount,
  updateSpotifyAccount,
  listSpotifyAccounts,
  type SpotifyAccount,
} from "@/app/actions/spotify"

export function SpotifyTab({ accounts: initial }: { accounts: SpotifyAccount[] }) {
  const [accounts, setAccounts] = useState(initial)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [gmail, setGmail] = useState("")
  const [notes, setNotes] = useState("")
  const [cookie, setCookie] = useState("")
  const [bulk, setBulk] = useState("")
  const [filter, setFilter] = useState<string | null>(null)
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState("")
  const [edits, setEdits] = useState<Record<number, { email: string; password: string; gmail: string; notes: string; cookie: string }>>({})

  const grouped = useMemo(() => {
    const map = new Map<string, SpotifyAccount[]>()
    for (const a of accounts) {
      const d = a.domain || "sem-dominio"
      if (!map.has(d)) map.set(d, [])
      map.get(d)!.push(a)
    }
    return Array.from(map.entries()).sort((a, b) => b[1].length - a[1].length)
  }, [accounts])

  const visible = filter
    ? grouped.filter(([d]) => d === filter)
    : grouped

  const exportList = filter
    ? accounts.filter((a) => a.domain === filter)
    : accounts

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

  function add() {
    setMsg("")
    start(async () => {
      const res = await addSpotifyAccount({ email, password, gmail, notes, cookie })
      if (!res.ok) {
        setMsg(res.error ?? "Erro")
        return
      }
      setEmail("")
      setPassword("")
      setGmail("")
      setNotes("")
      setCookie("")
      const list = await listSpotifyAccounts()
      setAccounts(list)
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

  function authorize(id: number) {
    setMsg("")
    start(async () => {
      const url = await getSpotifyAuthorizeUrl(id)
      if (!url) {
        setMsg("App Spotify nao configurado")
        return
      }
      window.location.href = url
    })
  }

  function check(id: number) {
    setMsg("")
    start(async () => {
      const res = await checkSpotifyAccount(id)
      if (!res.ok) {
        setMsg(res.error ?? "Erro")
        return
      }
      setAccounts((prev) =>
        prev.map((x) =>
          x.id === id
            ? { ...x, status: res.status || x.status, notes: x.notes || res.displayName || x.notes }
            : x,
        ),
      )
      setMsg(`Status: ${res.status}`)
      setTimeout(() => setMsg(""), 1500)
    })
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
    if (data.ok) {
      setMsg("Tarefa criada")
    } else {
      setMsg(data.error || "Erro")
    }
    setTimeout(() => setMsg(""), 1500)
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
    if (data.ok) {
      setMsg(`${data.created} tarefas criadas`)
    } else {
      setMsg(data.error || "Erro")
    }
    setTimeout(() => setMsg(""), 2000)
  }

  function fmtDate(iso: string | null) {
    if (!iso) return "nunca"
    const d = new Date(iso)
    return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
  }

  function statusColor(status: string) {
    if (status === "premium") return "text-emerald-400"
    if (status === "free") return "text-amber-400"
    if (status === "morta") return "text-destructive"
    if (status === "autorizada") return "text-sky-400"
    return "text-muted-foreground"
  }

  return (
    <div className="space-y-3 max-w-full">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold">Spotify</h1>
          <p className="text-xs text-muted-foreground">Verificar manda tarefa. Verificar todos cria varias.</p>
        </div>
        <div className="flex gap-1.5">
          <button onClick={refresh} disabled={pending} className="flex items-center gap-1 rounded border border-border px-2 py-1 text-[11px]">
            <RefreshCw className="h-3 w-3" /> Atualizar
          </button>
          <button onClick={exportAll} className="flex items-center gap-1 rounded border border-border px-2 py-1 text-[11px]">
            <Download className="h-3 w-3" /> Exportar
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-2.5">
        <h2 className="mb-1 text-xs font-semibold">Colar em lote</h2>
        <textarea
          value={bulk}
          onChange={(e) => setBulk(e.target.value)}
          rows={6}
          placeholder="email|senha|gmail|Nome|cookie"
          className="w-full rounded border border-border bg-background p-2 font-mono text-xs"
        />
        <div className="mt-1.5 flex items-center gap-2">
          <button onClick={importBulk} disabled={pending || !bulk.trim()} className="rounded bg-primary px-3 py-1 text-xs font-medium text-primary-foreground disabled:opacity-50">
            {pending ? "..." : "Importar"}
          </button>
          {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-2.5">
        <h2 className="mb-1.5 flex items-center gap-1 text-xs font-semibold"><Plus className="h-3 w-3" /> Adicionar</h2>
        <div className="grid gap-1.5 grid-cols-2 lg:grid-cols-5">
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email" className="rounded border border-border bg-background px-2 py-1 text-xs" />
          <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="senha" className="rounded border border-border bg-background px-2 py-1 text-xs" />
          <input value={gmail} onChange={(e) => setGmail(e.target.value)} placeholder="gmail" className="rounded border border-border bg-background px-2 py-1 text-xs" />
          <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="nome" className="rounded border border-border bg-background px-2 py-1 text-xs" />
          <input value={cookie} onChange={(e) => setCookie(e.target.value)} placeholder="sp_dc" className="rounded border border-border bg-background px-2 py-1 text-xs col-span-2 lg:col-span-1" />
        </div>
        <button onClick={add} disabled={pending || !email} className="mt-1.5 rounded bg-primary px-3 py-1 text-xs font-medium text-primary-foreground disabled:opacity-50">
          {pending ? "..." : "Salvar"}
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <button onClick={() => setFilter(null)} className={`rounded border px-2 py-1.5 text-xs ${filter === null ? "border-primary bg-primary/10" : "border-border bg-card"}`}>
          Todos <span className="font-bold">{accounts.length}</span>
        </button>
        {grouped.map(([domain, list]) => (
          <button key={domain} onClick={() => setFilter(domain)} className={`rounded border px-2 py-1.5 text-xs ${filter === domain ? "border-primary bg-primary/10" : "border-border bg-card"}`}>
            <span className="truncate max-w-[120px] inline-block align-bottom">{domain}</span> <span className="font-bold">{list.length}</span>
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {visible.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma conta.</p>}
        {visible.map(([domain, list]) => {
          const isOpen = open[domain] !== false
          return (
            <div key={domain} className="rounded-lg border border-border bg-card">
              <div className="flex items-center justify-between px-2.5 py-1.5">
                <button onClick={() => setOpen((s) => ({ ...s, [domain]: !isOpen }))} className="flex items-center gap-1.5 text-left text-sm">
                  {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                  <Music className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="font-medium">{domain}</span>
                  <span className="text-xs text-muted-foreground">{list.length}</span>
                </button>
                <button onClick={() => verificarDominio(list)} className="flex items-center gap-1 rounded border border-emerald-500/40 px-1.5 py-0.5 text-[11px] text-emerald-400">
                  <Play className="h-3 w-3" /> Verificar todos
                </button>
              </div>
              {isOpen && (
                <div className="grid grid-cols-1 gap-2 border-t border-border p-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                  {list.map((a) => {
                    const e = getEdit(a)
                    return (
                      <div key={a.id} className="flex flex-col gap-1 rounded border border-border bg-muted/10 p-2">
                        <div className="flex items-center justify-between">
                          <span className={`text-[10px] font-semibold uppercase ${statusColor(a.status)}`}>{a.status || "—"}</span>
                          <span className="text-[9px] text-muted-foreground">{fmtDate(a.lastChecked)}</span>
                        </div>
                        <input value={e.email} onChange={(ev) => setEdit(a.id, "email", ev.target.value, a)} className="w-full rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[11px]" placeholder="email" />
                        <input value={e.password} onChange={(ev) => setEdit(a.id, "password", ev.target.value, a)} className="w-full rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[11px]" placeholder="senha" />
                        <input value={e.gmail} onChange={(ev) => setEdit(a.id, "gmail", ev.target.value, a)} className="w-full rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[11px]" placeholder="gmail" />
                        <input value={e.notes} onChange={(ev) => setEdit(a.id, "notes", ev.target.value, a)} className="w-full rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[11px]" placeholder="nome" />
                        <input value={e.cookie} onChange={(ev) => setEdit(a.id, "cookie", ev.target.value, a)} className="w-full rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[11px]" placeholder="sp_dc" />
                        <div className="mt-0.5 flex flex-wrap gap-1">
                          <button onClick={() => save(a.id)} disabled={pending} className="rounded border border-border px-1.5 py-0.5 text-[10px]"><Save className="h-3 w-3 inline" /></button>
                          <button onClick={() => verificar(a.id, e.cookie)} disabled={!e.cookie} className="rounded border border-emerald-500/40 px-1.5 py-0.5 text-[10px] text-emerald-400 disabled:opacity-40"><Play className="h-3 w-3 inline" /></button>
                          <button onClick={() => authorize(a.id)} disabled={pending} className="rounded border border-border px-1.5 py-0.5 text-[10px]"><ShieldCheck className="h-3 w-3 inline" /></button>
                          <button onClick={() => check(a.id)} disabled={pending || !a.hasToken} className="rounded border border-border px-1.5 py-0.5 text-[10px] disabled:opacity-40"><RefreshCw className="h-3 w-3 inline" /></button>
                          <button onClick={() => copy(`${e.email}|${e.password}|${e.gmail || ""}|${e.notes || ""}|${e.cookie || ""}`)} className="rounded border border-border px-1.5 py-0.5 text-[10px]"><Copy className="h-3 w-3 inline" /></button>
                          <button onClick={() => remove(a.id)} className="rounded border border-destructive/40 px-1.5 py-0.5 text-destructive text-[10px]"><Trash2 className="h-3 w-3 inline" /></button>
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
