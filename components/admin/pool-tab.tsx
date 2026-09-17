"use client"

import { useState, useMemo, useTransition } from "react"
import { Plus, Trash2, Loader2, Copy, Unlock, Wand2, Mail } from "lucide-react"
import { toast } from "sonner"
import { addGmails, deleteGmail, deleteGmails, releaseGmail, type GmailRow, type GmailKind } from "@/app/actions/admin"
import { generateGmailAliases } from "@/lib/gmail-alias"

type Filter = "all" | "alias" | "real"

export function PoolTab({ gmails }: { gmails: GmailRow[] }) {
  const [bulk, setBulk] = useState("")
  const [addKind, setAddKind] = useState<GmailKind>("alias")
  const [filter, setFilter] = useState<Filter>("all")
  const [pending, startTransition] = useTransition()

  // Selecao em massa
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())

  // Gerador de aliases (aceita 1 ou varios gmails base, um por linha)
  const [baseGmail, setBaseGmail] = useState("")
  const [aliasCount, setAliasCount] = useState(10)

  const aliasTotal = gmails.filter((g) => (g.kind ?? "alias") === "alias").length
  const realTotal = gmails.filter((g) => g.kind === "real").length
  const available = gmails.filter((g) => g.status === "available").length
  const used = gmails.length - available

  const visible = useMemo(() => {
    if (filter === "all") return gmails
    return gmails.filter((g) => (g.kind ?? "alias") === filter)
  }, [gmails, filter])

  function handleAdd() {
    if (!bulk.trim()) {
      toast.error("Cole pelo menos um gmail")
      return
    }
    startTransition(async () => {
      try {
        const added = await addGmails(bulk, addKind)
        toast.success(`${added} gmail(s) adicionado(s) em ${addKind === "alias" ? "Aliases" : "Reais"}`)
        setBulk("")
      } catch {
        toast.error("Falha ao adicionar gmails")
      }
    })
  }

  function handleGenerate() {
    // Aceita 1 ou varios gmails base (um por linha). Para cada base valido,
    // gera `aliasCount` aliases e empilha os resultados na ordem em que foram
    // digitados (base 1 primeiro, depois base 2, etc.). Sem aliases repetidos.
    const bases = baseGmail
      .split(/[\n,;]+/)
      .map((s) => s.trim().toLowerCase())
      .filter((s) => s.includes("@"))

    if (bases.length === 0) {
      toast.error("Digite pelo menos um gmail completo, ex: nome@gmail.com")
      return
    }

    const seen = new Set<string>()
    const ordered: string[] = []
    for (const base of bases) {
      for (const alias of generateGmailAliases(base, aliasCount)) {
        if (!seen.has(alias)) {
          seen.add(alias)
          ordered.push(alias)
        }
      }
    }

    if (ordered.length === 0) {
      toast.error("Nao foi possivel gerar aliases desses enderecos")
      return
    }

    // Joga os aliases no campo de adicionar e ja seleciona a categoria Aliases
    setAddKind("alias")
    setBulk((prev) => (prev.trim() ? prev.trim() + "\n" : "") + ordered.join("\n"))
    toast.success(
      `${ordered.length} alias(es) gerado(s) de ${bases.length} gmail(s) — revise e clique em Adicionar`,
    )
  }

  function handleDelete(id: number) {
    startTransition(async () => {
      try {
        await deleteGmail(id)
        setSelectedIds((prev) => {
          const next = new Set(prev)
          next.delete(id)
          return next
        })
        toast.success("Removido")
      } catch {
        toast.error("Falha ao remover")
      }
    })
  }

  function toggleSelect(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    setSelectedIds((prev) => {
      const allSelected = visible.length > 0 && visible.every((g) => prev.has(g.id))
      if (allSelected) return new Set()
      return new Set(visible.map((g) => g.id))
    })
  }

  function handleBulkDelete() {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return
    if (!confirm(`Excluir ${ids.length} gmail(s) selecionado(s)? Esta acao nao pode ser desfeita.`)) {
      return
    }
    startTransition(async () => {
      try {
        const removed = await deleteGmails(ids)
        setSelectedIds(new Set())
        toast.success(`${removed} gmail(s) removido(s)`)
      } catch {
        toast.error("Falha ao remover selecionados")
      }
    })
  }

  function handleRelease(id: number) {
    startTransition(async () => {
      try {
        await releaseGmail(id)
        toast.success("Liberado de volta para disponivel")
      } catch {
        toast.error("Falha ao liberar")
      }
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Pool de Gmails</h1>
        <p className="text-sm text-muted-foreground">
          {gmails.length} total · {aliasTotal} aliases · {realTotal} reais · {available} disponiveis · {used} usados.
        </p>
      </div>

      {/* Gerador de aliases */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center gap-2">
          <Wand2 className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Gerador de aliases</h2>
        </div>
        <p className="mb-3 text-xs text-muted-foreground">
          Cole um ou varios gmails completos (um por linha) e gere variacoes com pontos e sufixo{" "}
          <span className="font-mono">{"+numeros"}</span>. Cada gmail base gera seus aliases, na ordem em
          que foram digitados, sem repetir.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Gmail(s) base (um por linha)
            </label>
            <div className="flex items-start rounded-lg border border-border bg-background px-3 focus-within:ring-2 focus-within:ring-primary">
              <Mail className="mt-3 h-4 w-4 shrink-0 text-muted-foreground" />
              <textarea
                value={baseGmail}
                onChange={(e) => setBaseGmail(e.target.value)}
                rows={3}
                placeholder={"gmail342@gmail.com\ngmail8523@gmail.com"}
                className="w-full resize-y bg-transparent px-2 py-2.5 font-mono text-sm outline-none placeholder:text-muted-foreground"
                autoComplete="off"
                spellCheck={false}
              />
            </div>
          </div>
          <div className="w-full sm:w-28">
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Quantidade</label>
            <input
              type="number"
              min={1}
              max={500}
              value={aliasCount}
              onChange={(e) => setAliasCount(Math.max(1, Math.min(500, Number(e.target.value) || 1)))}
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <button
            onClick={handleGenerate}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-primary/40 bg-primary/10 px-4 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary/20"
          >
            <Wand2 className="h-4 w-4" />
            Gerar
          </button>
        </div>
        {baseGmail.trim().includes("@") && (
          <p className="mt-2 text-[11px] text-muted-foreground">
            Exemplo de saida:{" "}
            <span className="font-mono text-foreground">
              {generateGmailAliases(
                baseGmail.split(/[\n,;]+/).map((s) => s.trim()).find((s) => s.includes("@")) ?? "",
                1,
              )[0] ?? "—"}
            </span>
          </p>
        )}
      </div>

      {/* Adicionar (com categoria) */}
      <div className="rounded-xl border border-border bg-card p-4">
        <label className="mb-2 block text-sm font-medium">Adicionar gmails (um por linha)</label>

        {/* Categoria */}
        <div className="mb-3 inline-flex rounded-lg border border-border bg-background p-1">
          <button
            onClick={() => setAddKind("alias")}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              addKind === "alias" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Aliases
          </button>
          <button
            onClick={() => setAddKind("real")}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              addKind === "real" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Gmails reais
          </button>
        </div>

        <textarea
          value={bulk}
          onChange={(e) => setBulk(e.target.value)}
          rows={5}
          placeholder={"conta.um@gmail.com\nconta.dois@gmail.com"}
          className="w-full resize-y rounded-lg border border-border bg-background p-3 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <button
          onClick={handleAdd}
          disabled={pending}
          className="mt-3 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Adicionar em {addKind === "alias" ? "Aliases" : "Gmails reais"}
        </button>
      </div>

      {/* Filtro + acoes em massa */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border border-border bg-card p-1">
          {([
            ["all", `Todos (${gmails.length})`],
            ["alias", `Aliases (${aliasTotal})`],
            ["real", `Reais (${realTotal})`],
          ] as [Filter, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                filter === key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {selectedIds.size > 0 && (
          <button
            onClick={handleBulkDelete}
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-sm font-medium text-destructive transition-colors hover:bg-destructive/20 disabled:opacity-50"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Excluir selecionados ({selectedIds.size})
          </button>
        )}
      </div>

      {/* Lista */}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="w-10 px-4 py-3 font-medium">
                  <input
                    type="checkbox"
                    aria-label="Selecionar todos"
                    checked={visible.length > 0 && visible.every((g) => selectedIds.has(g.id))}
                    onChange={toggleSelectAll}
                    className="h-4 w-4 cursor-pointer accent-primary"
                  />
                </th>
                <th className="px-4 py-3 font-medium">Endereco</th>
                <th className="px-4 py-3 font-medium">Tipo</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Atribuido a</th>
                <th className="px-4 py-3 font-medium text-right">Acoes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visible.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                    Nenhum gmail nesta categoria.
                  </td>
                </tr>
              ) : (
                visible.map((g) => {
                  const kind = g.kind ?? "alias"
                  return (
                    <tr
                      key={g.id}
                      className={`hover:bg-muted/30 ${selectedIds.has(g.id) ? "bg-primary/5" : ""}`}
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          aria-label={`Selecionar ${g.address}`}
                          checked={selectedIds.has(g.id)}
                          onChange={() => toggleSelect(g.id)}
                          className="h-4 w-4 cursor-pointer accent-primary"
                        />
                      </td>
                      <td className="px-4 py-3 font-mono">{g.address}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            kind === "alias"
                              ? "bg-violet-400/15 text-violet-400"
                              : "bg-sky-400/15 text-sky-400"
                          }`}
                        >
                          {kind === "alias" ? "alias" : "real"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            g.status === "available"
                              ? "bg-emerald-400/15 text-emerald-400"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {g.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{g.assigned_email ?? "—"}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(g.address)
                              toast.success("Copiado")
                            }}
                            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                            aria-label="Copiar"
                          >
                            <Copy className="h-4 w-4" />
                          </button>
                          {g.status === "assigned" && (
                            <button
                              onClick={() => handleRelease(g.id)}
                              disabled={pending}
                              className="rounded-md p-1.5 text-amber-500 hover:bg-amber-500/10 disabled:opacity-50"
                              aria-label="Liberar"
                              title="Liberar de volta para disponivel"
                            >
                              <Unlock className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(g.id)}
                            disabled={pending}
                            className="rounded-md p-1.5 text-destructive hover:bg-destructive/10 disabled:opacity-50"
                            aria-label="Excluir"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
