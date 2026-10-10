"use client"

import { useMemo, useState, useTransition } from "react"
import { Music, Plus, Trash2, Copy, ChevronDown, ChevronRight, Download } from "lucide-react"
import {
  addSpotifyAccount,
  deleteSpotifyAccount,
  importSpotifyAccounts,
  type SpotifyAccount,
} from "@/app/actions/spotify"

export function SpotifyTab({ accounts: initial }: { accounts: SpotifyAccount[] }) {
  const [accounts, setAccounts] = useState(initial)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [gmail, setGmail] = useState("")
  const [notes, setNotes] = useState("")
  const [bulk, setBulk] = useState("")
  const [filter, setFilter] = useState<string | null>(null)
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState("")

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

  function add() {
    setMsg("")
    start(async () => {
      const res = await addSpotifyAccount({ email, password, gmail, notes })
      if (!res.ok) {
        setMsg(res.error ?? "Erro")
        return
      }
      setEmail("")
      setPassword("")
      setGmail("")
      setNotes("")
      window.location.reload()
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
      window.location.reload()
    })
  }

  function remove(id: number) {
    if (!confirm("Apagar essa conta?")) return
    start(async () => {
      await deleteSpotifyAccount(id)
      setAccounts((prev) => prev.filter((a) => a.id !== id))
    })
  }

  function copy(text: string, label?: string) {
    if (!text) return
    navigator.clipboard.writeText(text)
    setMsg(label ? `${label} copiado` : "Copiado")
    setTimeout(() => setMsg(""), 1200)
  }

  function exportAll() {
    const lines = exportList.map(
      (a) => `${a.email}|${a.password}|${a.gmail || ""}|${a.notes || ""}`,
    )
    copy(lines.join("\n"), "Lote")
  }

  function Field({
    label,
    value,
  }: {
    label: string
    value: string
  }) {
    const empty = !value
    return (
      <button
        type="button"
        onClick={() => copy(value, label)}
        disabled={empty}
        className="flex w-full flex-col rounded-lg border border-border bg-background px-2.5 py-2 text-left disabled:opacity-40"
        title={empty ? "Vazio" : `Copiar ${label}`}
      >
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
        <span className="truncate font-mono text-xs">{empty ? "—" : value}</span>
      </button>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Spotify</h1>
          <p className="text-sm text-muted-foreground">
            Clique em cada campo pra copiar. Dominio extraido do email.
          </p>
        </div>
        <button
          onClick={exportAll}
          className="flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-xs font-medium"
        >
          <Download className="h-3.5 w-3.5" /> email|senha|gmail|nome
        </button>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <h2 className="mb-2 text-sm font-semibold">Colar em lote</h2>
        <p className="mb-2 text-xs text-muted-foreground">
          Uma por linha: email|senha|gmail|Nome. Se faltar senha, gmail ou nome, grava o que tiver.
        </p>
        <textarea
          value={bulk}
          onChange={(e) => setBulk(e.target.value)}
          rows={10}
          placeholder={"paulo@vipbr968.tskulzinho.shop|1Pd!6IWEoJrP|paulo.real@gmail.com|Fernanda Cardoso\nmanuela@super457.tskulzinho.shop||manuela@gmail.com|Joao Cruz"}
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
              <button
                onClick={() => setOpen((s) => ({ ...s, [domain]: !isOpen }))}
                className="flex w-full items-center justify-between px-4 py-3 text-left"
              >
                <div className="flex items-center gap-2">
                  {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  <Music className="h-4 w-4 text-emerald-400" />
                  <span className="font-semibold">{domain}</span>
                </div>
                <span className="text-sm text-muted-foreground">{list.length} conta(s)</span>
              </button>
              {isOpen && (
                <div className="grid grid-cols-1 gap-3 border-t border-border p-3 sm:grid-cols-2 xl:grid-cols-3">
                  {list.map((a) => (
                    <div key={a.id} className="flex flex-col gap-2 rounded-xl border border-border bg-muted/20 p-3">
                      <Field label="Email" value={a.email} />
                      <Field label="Senha" value={a.password} />
                      <Field label="Gmail" value={a.gmail} />
                      <Field label="Nome" value={a.notes} />
                      <div className="mt-1 flex gap-2">
                        <button
                          onClick={() =>
                            copy(
                              `${a.email}|${a.password}|${a.gmail || ""}|${a.notes || ""}`,
                              "Linha",
                            )
                          }
                          className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-border px-2 py-1.5 text-xs"
                        >
                          <Copy className="h-3.5 w-3.5" /> linha inteira
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
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
