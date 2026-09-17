"use client"

import { useCallback, useEffect, useState, useTransition } from "react"
import { Search, X, Loader2, Bot, Zap, RotateCcw, Check } from "lucide-react"
import { toast } from "sonner"
import {
  listChatAccess,
  setChatAccess,
  resetChatUsage,
  type ChatAccessRow,
} from "@/app/actions/chat-admin"

const MODELS = [
  { id: "openai/gpt-5-mini", label: "GPT-5 mini (rápido e barato)" },
  { id: "openai/gpt-5", label: "GPT-5 (mais potente)" },
  { id: "openai/gpt-5-nano", label: "GPT-5 nano (ultra leve)" },
]

export function ChatTab() {
  const [rows, setRows] = useState<ChatAccessRow[] | null>(null)
  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState<ChatAccessRow | null>(null)
  const [loading, startLoad] = useTransition()

  const load = useCallback(() => {
    startLoad(async () => {
      try {
        setRows(await listChatAccess())
      } catch {
        toast.error("Falha ao carregar acessos")
        setRows([])
      }
    })
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const filtered = (rows ?? []).filter((r) => r.email.toLowerCase().includes(search.toLowerCase()))
  const enabledCount = (rows ?? []).filter((r) => r.enabled).length

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">SuKo AI — Chat</h1>
        <p className="text-sm text-muted-foreground">
          Libere o assistente por usuário e defina a cota de tokens por janela. {enabledCount} com acesso.
        </p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por email..."
          className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Acesso</th>
                <th className="px-4 py-3 font-medium">Uso (janela)</th>
                <th className="px-4 py-3 font-medium text-right">Gerenciar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows === null ? (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                    Nenhuma conta encontrada.
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r.email} className="hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <span className="font-medium">{r.email}</span>
                      {r.name && <span className="ml-2 text-xs text-muted-foreground">{r.name}</span>}
                    </td>
                    <td className="px-4 py-3">
                      {r.enabled ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/15 px-2 py-0.5 text-xs font-medium text-emerald-400">
                          <Check className="h-3 w-3" /> Liberado
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-muted-foreground">
                      {r.configured
                        ? `${r.usedTokens.toLocaleString()} / ${r.tokenLimit.toLocaleString()}`
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setSelected(r)}
                        className="rounded-md border border-border px-3 py-1 text-xs font-medium transition-colors hover:bg-muted"
                      >
                        Gerenciar
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {loading && rows !== null && (
        <p className="text-xs text-muted-foreground">Atualizando...</p>
      )}

      {selected && (
        <ManageChatModal
          row={selected}
          onClose={() => setSelected(null)}
          onSaved={() => {
            setSelected(null)
            load()
          }}
        />
      )}
    </div>
  )
}

function ManageChatModal({
  row,
  onClose,
  onSaved,
}: {
  row: ChatAccessRow
  onClose: () => void
  onSaved: () => void
}) {
  const [enabled, setEnabled] = useState(row.enabled)
  const [limit, setLimit] = useState(String(row.tokenLimit))
  const [hours, setHours] = useState((row.windowSeconds / 3600).toString())
  const [model, setModel] = useState(row.model ?? "openai/gpt-5-mini")
  const [pending, startSave] = useTransition()
  const [resetting, startReset] = useTransition()

  function save() {
    const tokenLimit = Math.max(1, Math.round(Number(limit) || 0))
    const windowSeconds = Math.max(60, Math.round((Number(hours) || 1) * 3600))
    startSave(async () => {
      try {
        await setChatAccess(row.email, { enabled, tokenLimit, windowSeconds, model })
        toast.success("Acesso atualizado")
        onSaved()
      } catch {
        toast.error("Falha ao salvar")
      }
    })
  }

  function reset() {
    startReset(async () => {
      try {
        await resetChatUsage(row.email)
        toast.success("Uso zerado")
      } catch {
        toast.error("Falha ao zerar uso")
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            <div>
              <h2 className="text-lg font-bold">Acesso ao chat</h2>
              <p className="text-sm text-muted-foreground">{row.email}</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Enable toggle */}
          <div className="flex items-center justify-between rounded-lg border border-border bg-background p-3">
            <span className="text-sm font-medium">Liberar acesso ao assistente</span>
            <button
              onClick={() => setEnabled((v) => !v)}
              className={`relative h-6 w-11 rounded-full transition-colors ${
                enabled ? "bg-primary" : "bg-muted"
              }`}
              aria-pressed={enabled}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                  enabled ? "translate-x-5" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>

          {/* Token limit */}
          <div className="rounded-lg border border-border bg-background p-3">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Limite de tokens por janela
            </label>
            <input
              value={limit}
              onChange={(e) => setLimit(e.target.value.replace(/[^0-9]/g, ""))}
              inputMode="numeric"
              className="w-full rounded-md border border-border bg-card px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Window */}
          <div className="rounded-lg border border-border bg-background p-3">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Janela da cota (horas)
            </label>
            <input
              value={hours}
              onChange={(e) => setHours(e.target.value.replace(/[^0-9.]/g, ""))}
              inputMode="decimal"
              className="w-full rounded-md border border-border bg-card px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Ex.: 1 = renova a cada hora. Estilo ChatGPT Go.
            </p>
          </div>

          {/* Model */}
          <div className="rounded-lg border border-border bg-background p-3">
            <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Zap className="h-3.5 w-3.5" /> Modelo
            </label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full rounded-md border border-border bg-card px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-2">
            <button
              onClick={save}
              disabled={pending}
              className="flex-1 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {pending ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Salvar"}
            </button>
            {row.configured && (
              <button
                onClick={reset}
                disabled={resetting}
                className="flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50"
                title="Zerar o uso atual"
              >
                {resetting ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                Zerar uso
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
