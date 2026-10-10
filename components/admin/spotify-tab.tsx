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
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Spotify</h1>
          <p className="text-sm text-muted-foreground">
            Verificar manda tarefa. Verificar todos do dominio cria varias.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={refresh}
            disabled={pending}
            className="flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-xs font-medium"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Atualizar
          </button>
          <button
            onClick={exportAll}
            className="flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-xs font-medium"
          >
            <Download className="h-3.5 w-3.5" /> email|senha|gmail|nome|cookie
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <h2 className="mb-2 text-sm font-semibold">Colar em lote</h2>
        <p className="mb-2 text-xs text-muted-foreground">
          Uma por linha: email|senha|gmail|Nome|cookie. Se faltar algo, grava o que tiver.
        </p>
        <textarea
          value={bulk}
          onChange={(e) => setBulk(e.target.value)}
          rows={10}
          placeholder={"paulo@vipbr968.tskulzinho.shop|1Pd!6IWEoJrP|paulo.real@gmail.com|Fernanda Cardoso|AQCjcciIl0LYF821...\nmanuela@super457.tskulzinho.shop||manuela@gmail.com|Joao Cruz|"}
          className="w-full rounded-lg border border-border bg-background p-3 font-mono text-sm"
        />
        <div className="mt-3 flex items-center gap-3">
          <button
            onClick={importBulk}
            disabled={pending || !bulk.trim()}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {pending ? "Importando..." : "Importar lote"}
          </button>
          {msg && <span className="text-sm text-muted-foreground">{msg}</span>}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <Plus className="h-4 w-4" /> Adicionar uma
        </h2>
        <div className="grid gap-2 sm:grid-cols-2">
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email original"
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="senha (opcional)"
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          <input
            value={gmail}
            onChange={(e) => setGmail(e.target.value)}
            placeholder="gmail atual (opcional)"
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="nome (opcional)"
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          <input
            value={cookie}
            onChange={(e) => setCookie(e.target.value)}
            placeholder="cookie sp_dc (opcional)"
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm sm:col-span-2"
          />
        </div>
        <div className="mt-3">
          <button
            onClick={add}
            disabled={pending || !email}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {pending ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        <button
          onClick={() => setFilter(null)}
          className={`rounded-xl border px-3 py-3 text-left text-sm ${
            filter === null ? "border-primary bg-primary/10" : "border-border bg-card"
          }`}
        >
          <p className="text-xs text-muted-foreground">Todos</p>
          <p className="text-lg font-bold tabular-nums">{accounts.length}</p>
        </button>
        {grouped.map(([domain, list]) => (
          <button
            key={domain}
            onClick={() => setFilter(domain)}
            className={`rounded-xl border px-3 py-3 text-left text-sm ${
              filter === domain ? "border-primary bg-primary/10" : "border-border bg-card"
            }`}
          >
            <p className="truncate text-xs text-muted-foreground">{domain}</p>
            <p className="text-lg font-bold tabular-nums">{list.length}</p>
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {visible.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhuma conta ainda.</p>
        )}
        {visible.map(([domain, list]) => {
          const isOpen = open[domain] !== false
          return (
            <div key={domain} className="rounded-xl border border-border bg-card">
              <div className="flex items-center justify-between px-4 py-3">
                <button
                  onClick={() => setOpen((s) => ({ ...s, [domain]: !isOpen }))}
                  className="flex items-center gap-2 text-left"
                >
                  {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  <Music className="h-4 w-4 text-emerald-400" />
                  <span className="font-semibold">{domain}</span>
                  <span className="text-sm text-muted-foreground">{list.length} conta(s)</span>
                </button>
                <button
                  onClick={() => verificarDominio(list)}
                  className="flex items-center gap-1 rounded-lg border border-emerald-500/40 px-2 py-1 text-xs text-emerald-400"
                >
                  <Play className="h-3.5 w-3.5" /> Verificar todos
                </button>
              </div>
              {isOpen && (
                <div className="grid grid-cols-1 gap-3 border-t border-border p-3 sm:grid-cols-2 xl:grid-cols-3">
                  {list.map((a) => {
                    const e = getEdit(a)
                    return (
                      <div key={a.id} className="flex flex-col gap-2 rounded-xl border border-border bg-muted/20 p-3">
                        <div className="flex items-center justify-between">
                          <span className={`text-xs font-semibold uppercase ${statusColor(a.status)}`}>
                            {a.status || "sem status"}
                          </span>
                          <div className="flex gap-2">
                            {a.hasToken && <span className="text-[10px] text-muted-foreground">token ok</span>}
                            {a.cookie && <span className="text-[10px] text-sky-400">cookie</span>}
                          </div>
                        </div>
                        <p className="text-[10px] text-muted-foreground">Ultima: {fmtDate(a.lastChecked)}</p>
                        <label className="text-[10px] uppercase text-muted-foreground">Email
                          <input
                            value={e.email}
                            onChange={(ev) => setEdit(a.id, "email", ev.target.value, a)}
                            className="mt-0.5 w-full rounded border border-border bg-background px-2 py-1 font-mono text-xs"
                          />
                        </label>
                        <label className="text-[10px] uppercase text-muted-foreground">Senha
                          <input
                            value={e.password}
                            onChange={(ev) => setEdit(a.id, "password", ev.target.value, a)}
                            className="mt-0.5 w-full rounded border border-border bg-background px-2 py-1 font-mono text-xs"
                          />
                        </label>
                        <label className="text-[10px] uppercase text-muted-foreground">Gmail
                          <input
                            value={e.gmail}
                            onChange={(ev) => setEdit(a.id, "gmail", ev.target.value, a)}
                            className="mt-0.5 w-full rounded border border-border bg-background px-2 py-1 font-mono text-xs"
                          />
                        </label>
                        <label className="text-[10px] uppercase text-muted-foreground">Nome
                          <input
                            value={e.notes}
                            onChange={(ev) => setEdit(a.id, "notes", ev.target.value, a)}
                            className="mt-0.5 w-full rounded border border-border bg-background px-2 py-1 font-mono text-xs"
                          />
                        </label>
                        <label className="text-[10px] uppercase text-muted-foreground">Cookie sp_dc
                          <input
                            value={e.cookie}
                            onChange={(ev) => setEdit(a.id, "cookie", ev.target.value, a)}
                            className="mt-0.5 w-full rounded border border-border bg-background px-2 py-1 font-mono text-xs"
                            placeholder="sp_dc"
                          />
                        </label>
                        <div className="mt-1 flex flex-wrap gap-2">
                          <button
                            onClick={() => save(a.id)}
                            disabled={pending}
                            className="flex items-center gap-1 rounded-lg border border-border px-2 py-1.5 text-xs"
                          >
                            <Save className="h-3.5 w-3.5" /> Salvar
                          </button>
                          <button
                            onClick={() => verificar(a.id, e.cookie)}
                            disabled={!e.cookie}
                            className="flex items-center gap-1 rounded-lg border border-emerald-500/40 px-2 py-1.5 text-xs text-emerald-400 disabled:opacity-40"
                          >
                            <Play className="h-3.5 w-3.5" /> Verificar
                          </button>
                          <button
                            onClick={() => authorize(a.id)}
                            disabled={pending}
                            className="flex items-center gap-1 rounded-lg border border-border px-2 py-1.5 text-xs"
                          >
                            <ShieldCheck className="h-3.5 w-3.5" /> {a.hasToken ? "Reautorizar" : "Autorizar"}
                          </button>
                          <button
                            onClick={() => check(a.id)}
                            disabled={pending || !a.hasToken}
                            className="flex items-center gap-1 rounded-lg border border-border px-2 py-1.5 text-xs disabled:opacity-40"
                          >
                            <RefreshCw className="h-3.5 w-3.5" /> Checar
                          </button>
                          <button
                            onClick={() => copy(`${e.email}|${e.password}|${e.gmail || ""}|${e.notes || ""}|${e.cookie || ""}`, "Linha")}
                            className="flex items-center gap-1 rounded-lg border border-border px-2 py-1.5 text-xs"
                          >
                            <Copy className="h-3.5 w-3.5" /> linha
                          </button>
                          <button
                            onClick={() => remove(a.id)}
                            className="rounded-lg border border-destructive/40 px-2 py-1.5 text-destructive"
                            title="Apagar"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
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
