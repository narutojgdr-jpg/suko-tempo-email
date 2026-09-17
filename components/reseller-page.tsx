"use client"

import { useState, useCallback } from "react"
import { toast } from "sonner"
import { Store } from "lucide-react"
import { SiteHeader } from "@/components/site-header"
import { EmailInput } from "@/components/email-input"
import { Inbox, type Email } from "@/components/mail-inbox"
import { verifyResellerAddress } from "@/app/actions/reseller"
import { buildCustomDomainEmail } from "@/lib/mime"
import { usesImap } from "@/lib/inbox-routing"
import { isAddressBlocked } from "@/lib/blocked-client"
import type { Dictionary } from "@/lib/i18n"

const CF_INBOX_API = "https://inbox-api.izukisukinho.workers.dev/inbox"

interface ResellerPageProps {
  pageKey: string
  name: string
  /** Gmails the admin assigned to this page (full addresses). */
  allowedGmails: string[]
  /** Our own custom domains, usable freely. */
  domains: string[]
  dict: Dictionary
  /**
   * Quando true, a pagina NAO tem lista de emails liberados: qualquer endereco
   * (gmail, outlook/hotmail ou dominio proprio) pode ser consultado livremente.
   * Usado pela pagina /infinity.
   */
  unrestricted?: boolean
}

export function ResellerPage({
  pageKey,
  name,
  allowedGmails,
  domains,
  dict,
  unrestricted = false,
}: ResellerPageProps) {
  const [email, setEmail] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [emails, setEmails] = useState<Email[]>([])
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [activeAddress, setActiveAddress] = useState<string | null>(null)
  const [hasSearched, setHasSearched] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  const allowedSet = new Set(allowedGmails.map((g) => g.toLowerCase()))

  const fetchInbox = useCallback(async (address: string): Promise<Email[]> => {
    // Caixas bloqueadas (lista fixa + blocklist do admin) nunca podem ser lidas.
    if (await isAddressBlocked(address)) {
      throw new Error("Esta caixa e protegida e nao pode ser lida.")
    }
    // gmail e outlook/hotmail sao lidos via IMAP (a API escolhe a mailbox certa
    // pelo dominio); dominios proprios continuam vindo do Cloudflare KV.
    if (usesImap(address)) {
      const res = await fetch(`/api/gmail-inbox?email=${encodeURIComponent(address)}`, {
        cache: "no-store",
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? `Erro ao buscar emails (${res.status})`)
      return (Array.isArray(data) ? data : []).map(
        (item: { id?: string; from?: string; subject?: string; date?: string; body?: string }, i: number) => ({
          id: item.id ?? `gm-${address}-${i}`,
          from: item.from ?? "Desconhecido",
          subject: item.subject ?? "(Sem assunto)",
          date: item.date ?? "",
          body: item.body || `<p style="color:#888;font-size:13px">Sem conteudo.</p>`,
          attachments: [],
        }),
      )
    }

    const res = await fetch(`${CF_INBOX_API}/${address}`, { cache: "no-store" })
    if (!res.ok) throw new Error(`Erro ao buscar emails (${res.status})`)
    const data = await res.json()
    return (Array.isArray(data) ? data : []).map((item, i: number) =>
      buildCustomDomainEmail(item, `cf-${address}`, i),
    )
  }, [])

  const isAddressAllowed = useCallback(
    (address: string) => {
      const domain = address.slice(address.lastIndexOf("@") + 1).toLowerCase()
      if (domains.includes(domain)) return true
      return allowedSet.has(address)
    },
    [domains, allowedSet],
  )

  const handleSubmit = useCallback(async () => {
    const trimmed = email.trim().toLowerCase()
    if (!trimmed) return
    if (!trimmed.includes("@") || !trimmed.slice(0, trimmed.lastIndexOf("@"))) {
      setError("Digite um email completo.")
      return
    }

    // Paginas unrestricted (ex.: /infinity) aceitam QUALQUER email — sem lista
    // de liberados e sem checagem no servidor.
    if (!unrestricted) {
      // Client-side gate for instant feedback.
      if (!isAddressAllowed(trimmed)) {
        setError("Este email nao esta liberado nesta pagina. Use um dos emails disponiveis abaixo.")
        return
      }
    }

    setError(null)
    setLoading(true)
    try {
      if (!unrestricted) {
        // Authoritative server-side check (defense in depth).
        const { ok } = await verifyResellerAddress(pageKey, trimmed)
        if (!ok) {
          setError("Este email nao esta liberado nesta pagina.")
          setEmails([])
          return
        }
      }
      const result = await fetchInbox(trimmed)
      setHasSearched(true)
      setEmails(result)
      setActiveAddress(trimmed)
      setStatusMessage(dict.status.inboxUpdated)
      setTimeout(() => setStatusMessage(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : dict.errors.genericError)
      setEmails([])
    } finally {
      setLoading(false)
    }
  }, [email, isAddressAllowed, pageKey, fetchInbox, dict, unrestricted])

  const handleRefresh = useCallback(async () => {
    if (!activeAddress) return
    setRefreshing(true)
    setStatusMessage(dict.status.checkingNewEmails)
    try {
      const result = await fetchInbox(activeAddress)
      setEmails(result)
      setError(null)
      setStatusMessage(dict.status.inboxUpdated)
      setTimeout(() => setStatusMessage(null), 3000)
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : dict.errors.updateError)
      setTimeout(() => setStatusMessage(null), 5000)
    } finally {
      setRefreshing(false)
    }
  }, [activeAddress, fetchInbox, dict])

  const activeUser = activeAddress ? activeAddress.slice(0, activeAddress.lastIndexOf("@")) : null
  const activeDomain = activeAddress ? activeAddress.slice(activeAddress.lastIndexOf("@")) : null

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader lang="pt" />

      <main className="flex flex-1 items-start justify-center px-4 py-10 sm:py-16">
        <div className="w-full max-w-2xl space-y-6">
          <div className="text-center">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
              <Store className="h-3.5 w-3.5 text-primary" />
              Painel do revendedor
            </div>
            <h1 className="text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              {name}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {unrestricted
                ? "Digite qualquer email (Gmail, Outlook, Hotmail ou dominio proprio) e clique em acessar para ver a caixa de entrada."
                : "Digite um dos emails liberados abaixo e clique em acessar para ver a caixa de entrada."}
            </p>
          </div>

          <EmailInput
            email={email}
            error={error}
            activeAddress={activeAddress}
            onEmailChange={(v) => {
              setEmail(v)
              if (error) setError(null)
            }}
            onSubmit={handleSubmit}
            loading={loading}
            dict={dict}
          />


          <Inbox
            emails={emails}
            activeEmail={activeUser}
            activeDomain={activeDomain}
            hasSearched={hasSearched}
            isLoading={loading}
            isRefreshing={refreshing}
            isPolling={false}
            statusMessage={statusMessage}
            countdown={0}
            fetchError={error}
            onRefresh={handleRefresh}
            dict={dict}
          />
        </div>
      </main>

      <footer className="border-t border-border py-4 text-center text-xs text-muted-foreground">
        <p>{dict.footer.text}</p>
      </footer>
    </div>
  )
}
