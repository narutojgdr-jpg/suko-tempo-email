"use client"

import { useEffect, useState, useTransition } from "react"
import { ShieldBan, Plus, Trash2, Loader2, Search, Mail, Globe } from "lucide-react"
import {
  listBlockedInboxes,
  addBlockedInboxes,
  removeBlockedInbox,
} from "@/app/actions/blocklist"
import type { BlockedRow } from "@/lib/blocklist-store"

export function BlocklistTab() {
  const [rows, setRows] = useState<BlockedRow[]>([])
  const [loading, setLoading] = useState(true)
  const [raw, setRaw] = useState("")
  const [note, setNote] = useState("")
  const [filter, setFilter] = useState("")
  const [msg, setMsg] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  async function refresh() {
    setLoading(true)
    try {
      setRows(await listBlockedInboxes())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  function handleAdd() {
    if (!raw.trim()) return
    startTransition(async () => {
      const added = await addBlockedInboxes(raw, note)
      setMsg(
        added > 0
          ? `${added} entrada(s) bloqueada(s).`
          : "Nenhuma entrada nova (ja estavam na lista).",
      )
      setRaw("")
      setNote("")
      await refresh()
    })
  }

  function handleRemove(id: number) {
    startTransition(async () => {
      await removeBlockedInbox(id)
      await refresh()
    })
  }

  const filtered = rows.filter(
    (r) =>
      !filter.trim() ||
      r.value.toLowerCase().includes(filter.toLowerCase()) ||
      (r.note ?? "").toLowerCase().includes(filter.toLowerCase()),
  )

  const addresses = filtered.filter((r) => r.kind === "address")
  const domains = filtered.filter((r) => r.kind === "domain")

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <ShieldBan className="h-5 w-5 text-destructive" />
        <div>
          <h1 className="text-2xl font-bold">Caixas bloqueadas</h1>
          <p className="text-sm text-muted-foreground">
            Emails e gmails aqui nunca podem ser lidos — no site nem na API.
          </p>
        </div>
      </div>

      {/* Form de adicao */}
      <div className="rounded-xl border border-border bg-card p-4">
        <label className="text-sm font-semibold">Adicionar bloqueio</label>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Um por linha. Com <code className="text-foreground">@</code> bloqueia o endereco exato
          (ex.: <code className="text-foreground">fulano@gmail.com</code>). Sem{" "}
          <code className="text-foreground">@</code> bloqueia o dominio inteiro (ex.:{" "}
          <code className="text-foreground">gpkolzinho.shop</code>).
        </p>
        <textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          rows={4}
          placeholder={"abusador@gmail.com\noutrodominio.shop"}
          className="mt-3 w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono outline-none focus:border-primary"
        />
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Anotacao opcional (ex.: motivo do bloqueio)"
          className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
        />
        <div className="mt-3 flex items-center gap-3">
          <button
            onClick={handleAdd}
            disabled={pending || !raw.trim()}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Bloquear
          </button>
          {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
        </div>
      </div>

      {/* Busca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filtrar lista bloqueada..."
          className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm outline-none focus:border-primary"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
          {rows.length === 0 ? "Nenhuma caixa bloqueada ainda." : "Nada encontrado no filtro."}
        </p>
      ) : (
        <div className="space-y-6">
          <BlockedGroup
            title="Enderecos"
            icon={Mail}
            rows={addresses}
            pending={pending}
            onRemove={handleRemove}
          />
          <BlockedGroup
            title="Dominios"
            icon={Globe}
            rows={domains}
            pending={pending}
            onRemove={handleRemove}
          />
        </div>
      )}
    </div>
  )
}

function BlockedGroup({
  title,
  icon: Icon,
  rows,
  pending,
  onRemove,
}: {
  title: string
  icon: typeof Mail
  rows: BlockedRow[]
  pending: boolean
  onRemove: (id: number) => void
}) {
  if (rows.length === 0) return null
  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">
          {title} <span className="text-muted-foreground">({rows.length})</span>
        </h2>
      </div>
      <ul className="divide-y divide-border">
        {rows.map((r) => (
          <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate font-mono text-sm">{r.value}</p>
              {r.note && <p className="truncate text-xs text-muted-foreground">{r.note}</p>}
            </div>
            <button
              onClick={() => onRemove(r.id)}
              disabled={pending}
              aria-label={`Remover bloqueio de ${r.value}`}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-destructive hover:text-destructive disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Remover
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
