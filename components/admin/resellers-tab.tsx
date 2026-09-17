"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  Plus,
  Trash2,
  Loader2,
  Copy,
  ChevronDown,
  ChevronUp,
  Store,
  Mail,
  ExternalLink,
  Search,
  Tag,
  Package,
  Check,
  X,
} from "lucide-react"
import { toast } from "sonner"
import {
  createResellerPage,
  deleteResellerPage,
  listResellerGmails,
  addResellerGmails,
  deleteResellerGmail,
  setResellerGmailProduct,
  searchResellerGmails,
  type ResellerPageRow,
  type ResellerGmailRow,
  type GmailSearchResult,
} from "@/app/actions/reseller"

/** Idioma usado nos links publicos exibidos no admin. */
const LINK_LANG = "pt"

export function ResellersTab({ pages }: { pages: ResellerPageRow[] }) {
  const router = useRouter()
  const [name, setName] = useState("")
  const [pending, startTransition] = useTransition()
  const [expanded, setExpanded] = useState<number | null>(null)
  const [gmailsByPage, setGmailsByPage] = useState<Record<number, ResellerGmailRow[]>>({})
  const [loadingGmails, setLoadingGmails] = useState<number | null>(null)
  const [bulk, setBulk] = useState("")
  const [bulkProduct, setBulkProduct] = useState("")

  // Edicao inline do produto de um gmail.
  const [editing, setEditing] = useState<{ id: number; value: string } | null>(null)

  // Busca global de gmail.
  const [search, setSearch] = useState("")
  const [results, setResults] = useState<GmailSearchResult[] | null>(null)
  const [searching, setSearching] = useState(false)

  function pageLink(key: string) {
    const origin = typeof window !== "undefined" ? window.location.origin : ""
    return `${origin}/${LINK_LANG}/${key}`
  }

  function handleCreate() {
    if (!name.trim()) {
      toast.error("Digite um nome para o revendedor")
      return
    }
    startTransition(async () => {
      try {
        const key = await createResellerPage(name)
        toast.success(`Pagina criada: ${key}`)
        setName("")
        router.refresh()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Falha ao criar pagina")
      }
    })
  }

  function handleDeletePage(id: number) {
    startTransition(async () => {
      try {
        await deleteResellerPage(id)
        toast.success("Pagina removida")
        if (expanded === id) setExpanded(null)
        router.refresh()
      } catch {
        toast.error("Falha ao remover")
      }
    })
  }

  function toggleExpand(pageId: number) {
    if (expanded === pageId) {
      setExpanded(null)
      return
    }
    setExpanded(pageId)
    setBulk("")
    setBulkProduct("")
    setEditing(null)
    setLoadingGmails(pageId)
    startTransition(async () => {
      try {
        const rows = await listResellerGmails(pageId)
        setGmailsByPage((prev) => ({ ...prev, [pageId]: rows }))
      } catch {
        toast.error("Falha ao carregar gmails")
      } finally {
        setLoadingGmails(null)
      }
    })
  }

  function refreshGmails(pageId: number) {
    startTransition(async () => {
      try {
        const rows = await listResellerGmails(pageId)
        setGmailsByPage((prev) => ({ ...prev, [pageId]: rows }))
      } catch {
        toast.error("Falha ao carregar gmails")
      }
    })
  }

  function handleAddGmails(pageId: number) {
    if (!bulk.trim()) {
      toast.error("Cole pelo menos um email")
      return
    }
    startTransition(async () => {
      try {
        const added = await addResellerGmails(pageId, bulk, bulkProduct)
        const label = bulkProduct.trim() ? ` em "${bulkProduct.trim()}"` : ""
        toast.success(`${added} email(s) adicionado(s)${label}`)
        setBulk("")
        refreshGmails(pageId)
        router.refresh()
      } catch {
        toast.error("Falha ao adicionar")
      }
    })
  }

  function handleDeleteGmail(pageId: number, id: number) {
    startTransition(async () => {
      try {
        await deleteResellerGmail(id)
        toast.success("Removido")
        refreshGmails(pageId)
        router.refresh()
      } catch {
        toast.error("Falha ao remover")
      }
    })
  }

  function handleSaveProduct(pageId: number) {
    if (!editing) return
    const { id, value } = editing
    startTransition(async () => {
      try {
        await setResellerGmailProduct(id, value)
        toast.success("Produto atualizado")
        setEditing(null)
        refreshGmails(pageId)
      } catch {
        toast.error("Falha ao atualizar produto")
      }
    })
  }

  function handleSearch() {
    const q = search.trim()
    if (!q) {
      setResults(null)
      return
    }
    setSearching(true)
    startTransition(async () => {
      try {
        const rows = await searchResellerGmails(q)
        setResults(rows)
      } catch {
        toast.error("Falha na busca")
      } finally {
        setSearching(false)
      }
    })
  }

  /** Agrupa os gmails de uma pagina por produto ("" = sem produto). */
  function groupByProduct(rows: ResellerGmailRow[]) {
    const groups = new Map<string, ResellerGmailRow[]>()
    for (const r of rows) {
      const key = (r.product ?? "").trim()
      const arr = groups.get(key) ?? []
      arr.push(r)
      groups.set(key, arr)
    }
    // Produtos nomeados primeiro (ordem alfabetica), "sem produto" por ultimo.
    return Array.from(groups.entries()).sort(([a], [b]) => {
      if (a === "") return 1
      if (b === "") return -1
      return a.localeCompare(b)
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Revendedores</h1>
        <p className="text-sm text-muted-foreground">
          {pages.length} pagina(s). Cada revendedor recebe um link unico para acessar e ler as
          caixas de entrada dos gmails que voce liberar.
        </p>
      </div>

      {/* Busca global de gmail */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center gap-2">
          <Search className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Buscar gmail</h2>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSearch()
            }}
            placeholder="Digite um email ou produto para descobrir de quem e..."
            className="w-full flex-1 rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
            autoComplete="off"
            spellCheck={false}
          />
          <button
            onClick={handleSearch}
            disabled={pending}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Buscar
          </button>
          {results !== null && (
            <button
              onClick={() => {
                setSearch("")
                setResults(null)
              }}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted"
            >
              Limpar
            </button>
          )}
        </div>

        {results !== null && (
          <div className="mt-4">
            {results.length === 0 ? (
              <p className="py-3 text-sm text-muted-foreground">
                Nenhum gmail encontrado para essa busca.
              </p>
            ) : (
              <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
                {results.map((r) => (
                  <li
                    key={r.id}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 text-sm hover:bg-muted/30"
                  >
                    <span className="flex min-w-0 items-center gap-2 font-mono">
                      <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="truncate">{r.address}</span>
                    </span>
                    {r.product ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                        <Package className="h-3 w-3" />
                        {r.product}
                      </span>
                    ) : (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        sem produto
                      </span>
                    )}
                    <span className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
                      <Store className="h-3.5 w-3.5" />
                      <span className="font-medium text-foreground">{r.page_name}</span>
                    </span>
                    <a
                      href={`/${LINK_LANG}/${r.page_key}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                      aria-label="Abrir pagina do revendedor"
                      title="Abrir pagina do revendedor"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Criar pagina */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center gap-2">
          <Store className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Nova pagina de revendedor</h2>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Nome do revendedor
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate()
              }}
              placeholder="Ex: Gabriel"
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          <button
            onClick={handleCreate}
            disabled={pending}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Criar pagina
          </button>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          A URL e gerada a partir do nome (ex:{" "}
          <span className="font-mono text-foreground">/pt/gabriel</span>).
        </p>
      </div>

      {/* Lista de paginas */}
      <div className="space-y-3">
        {pages.length === 0 ? (
          <div className="rounded-xl border border-border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
            Nenhuma pagina criada ainda.
          </div>
        ) : (
          pages.map((p) => {
            const isOpen = expanded === p.id
            const gmails = gmailsByPage[p.id] ?? []
            const grouped = groupByProduct(gmails)
            return (
              <div key={p.id} className="overflow-hidden rounded-xl border border-border bg-card">
                {/* Header da pagina */}
                <div className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{p.name}</p>
                    <p className="truncate font-mono text-xs text-muted-foreground">
                      /{LINK_LANG}/{p.key}
                    </p>
                  </div>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    {p.gmail_count} gmail(s)
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(pageLink(p.key))
                        toast.success("Link copiado")
                      }}
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                      aria-label="Copiar link"
                      title="Copiar link"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                    <a
                      href={`/${LINK_LANG}/${p.key}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                      aria-label="Abrir pagina"
                      title="Abrir pagina"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                    <button
                      onClick={() => handleDeletePage(p.id)}
                      disabled={pending}
                      className="rounded-md p-1.5 text-destructive hover:bg-destructive/10 disabled:opacity-50"
                      aria-label="Excluir pagina"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => toggleExpand(p.id)}
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                      aria-label="Gerenciar produtos e gmails"
                      title="Gerenciar produtos e gmails"
                    >
                      {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Painel de produtos / gmails */}
                {isOpen && (
                  <div className="border-t border-border bg-background/50 p-4">
                    {/* Form: adicionar gmail(s) a um produto */}
                    <div className="rounded-lg border border-border bg-card p-3">
                      <div className="mb-2 flex items-center gap-2">
                        <Package className="h-4 w-4 text-primary" />
                        <h3 className="text-sm font-semibold">Adicionar a um produto</h3>
                      </div>
                      <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                        Nome do produto (opcional — organize por categoria)
                      </label>
                      <input
                        value={bulkProduct}
                        onChange={(e) => setBulkProduct(e.target.value)}
                        placeholder="Ex: Netflix, Spotify, Steam..."
                        className="mb-3 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                        autoComplete="off"
                        spellCheck={false}
                      />
                      <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                        Gmails (um por linha)
                      </label>
                      <textarea
                        value={bulk}
                        onChange={(e) => setBulk(e.target.value)}
                        rows={3}
                        placeholder={"conta.um@gmail.com\nconta.dois@gmail.com"}
                        className="w-full resize-y rounded-lg border border-border bg-background p-3 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                      <button
                        onClick={() => handleAddGmails(p.id)}
                        disabled={pending}
                        className="mt-3 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                      >
                        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                        Adicionar
                      </button>
                    </div>

                    {/* Lista agrupada por produto */}
                    <div className="mt-4">
                      {loadingGmails === p.id ? (
                        <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
                        </div>
                      ) : gmails.length === 0 ? (
                        <p className="py-4 text-sm text-muted-foreground">
                          Nenhum gmail nesta pagina ainda.
                        </p>
                      ) : (
                        <div className="space-y-4">
                          {grouped.map(([product, rows]) => (
                            <div key={product || "__none__"}>
                              <div className="mb-1.5 flex items-center gap-2">
                                {product ? (
                                  <>
                                    <Package className="h-4 w-4 text-primary" />
                                    <span className="text-sm font-semibold">{product}</span>
                                  </>
                                ) : (
                                  <>
                                    <Tag className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-sm font-medium text-muted-foreground">
                                      Sem produto
                                    </span>
                                  </>
                                )}
                                <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                                  {rows.length}
                                </span>
                              </div>
                              <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
                                {rows.map((g) => (
                                  <li
                                    key={g.id}
                                    className="flex items-center justify-between gap-3 px-3 py-2 text-sm hover:bg-muted/30"
                                  >
                                    {editing?.id === g.id ? (
                                      <div className="flex flex-1 items-center gap-2">
                                        <input
                                          value={editing.value}
                                          onChange={(e) =>
                                            setEditing({ id: g.id, value: e.target.value })
                                          }
                                          onKeyDown={(e) => {
                                            if (e.key === "Enter") handleSaveProduct(p.id)
                                            if (e.key === "Escape") setEditing(null)
                                          }}
                                          placeholder="Nome do produto (vazio = remover)"
                                          autoFocus
                                          className="flex-1 rounded-md border border-border bg-background px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-primary"
                                        />
                                        <button
                                          onClick={() => handleSaveProduct(p.id)}
                                          disabled={pending}
                                          className="rounded-md p-1.5 text-primary hover:bg-primary/10 disabled:opacity-50"
                                          aria-label="Salvar produto"
                                        >
                                          <Check className="h-4 w-4" />
                                        </button>
                                        <button
                                          onClick={() => setEditing(null)}
                                          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"
                                          aria-label="Cancelar"
                                        >
                                          <X className="h-4 w-4" />
                                        </button>
                                      </div>
                                    ) : (
                                      <>
                                        <span className="flex min-w-0 items-center gap-2 font-mono">
                                          <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                          <span className="truncate">{g.address}</span>
                                        </span>
                                        <div className="flex shrink-0 items-center gap-1">
                                          <button
                                            onClick={() =>
                                              setEditing({ id: g.id, value: g.product ?? "" })
                                            }
                                            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                                            aria-label="Definir produto"
                                            title="Definir produto"
                                          >
                                            <Tag className="h-4 w-4" />
                                          </button>
                                          <button
                                            onClick={() => handleDeleteGmail(p.id, g.id)}
                                            disabled={pending}
                                            className="rounded-md p-1.5 text-destructive hover:bg-destructive/10 disabled:opacity-50"
                                            aria-label="Remover gmail"
                                          >
                                            <Trash2 className="h-4 w-4" />
                                          </button>
                                        </div>
                                      </>
                                    )}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
