"use client"

import { useMemo, useState, useTransition } from "react"
import { Music, Plus, Trash2, Copy, ChevronDown, ChevronRight } from "lucide-react"
import {
  addSpotifyAccount,
  deleteSpotifyAccount,
  type SpotifyAccount,
} from "@/app/actions/spotify"

export function SpotifyTab({ accounts: initial }: { accounts: SpotifyAccount[] }) {
  const [accounts, setAccounts] = useState(initial)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [notes, setNotes] = useState("")
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

  function add() {
    setMsg("")
    start(async () => {
      const res = await addSpotifyAccount({ email, password, notes })
      if (!res.ok) {
        setMsg(res.error ?? "Erro")
        return
      }
      setEmail("")
      setPassword("")
      setNotes("")
      // reload simples
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

  function copy(text: string) {
    navigator.clipboard.writeText(text)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Spotify</h1>
        <p className="text-sm text-muted-foreground">
          Contas guardadas. O dominio e extraido do email (ex: @india123.tskulzinho.shop → tskulzinho.shop).
        </p>
      </div>

      {/* Add form */}
      <div className="rounded-xl border border-border bg-card p-4">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <Plus className="h-4 w-4" /> Adicionar conta
        </h2>
        <div className="grid gap-2 sm:grid-cols-2">
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@india123.tskulzinho.shop"
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="senha"
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="notas (opcional)"
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm sm:col-span-2"
          />
        </div>
        <div className="mt-3 flex items-center gap-3">
          <button
            onClick={add}
            disabled={pending || !email}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {pending ? "Salvando..." : "Salvar"}
          </button>
          {msg && <span className="text-sm text-destructive">{msg}</span>}
        </div>
      </div>

      {/* Domain summary */}
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

      {/* Lists */}
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
                <ul className="divide-y divide-border border-t border-border">
                  {list.map((a) => (
                    <li key={a.id} className="flex items-center justify-between gap-2 px-4 py-2 text-sm">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{a.email}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {a.password}{a.notes ? ` · ${a.notes}` : ""}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <button
                          onClick={() => copy(`${a.email}:${a.password}`)}
                          className="rounded p-1.5 text-muted-foreground hover:bg-muted"
                          title="Copiar email:senha"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => remove(a.id)}
                          className="rounded p-1.5 text-destructive hover:bg-muted"
                          title="Apagar"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
