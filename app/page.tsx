"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { toast } from "sonner"
import { AlertTriangle, ExternalLink, X } from "lucide-react"
import { SiteHeader } from "@/components/site-header"
import { EmailInput } from "@/components/email-input"
import { Inbox, type Email } from "@/components/mail-inbox"
import { buildCustomDomainEmail } from "@/lib/mime"
import { usesImap } from "@/lib/inbox-routing"
import { isAddressBlocked } from "@/lib/blocked-client"

const NEW_URL = "https://tempmailsuko.shop/"
const CF_INBOX_API = "https://inbox-api.izukisukinho.workers.dev/inbox"

// Hardcoded Portuguese dictionary for standalone page
const dict = {
  auth: {
    title: "Entrar na SuKo Shop",
    subtitle: "Use sua conta Google para acessar sua caixa de entrada. Uma conta por pessoa.",
    googleButton: "Continuar com Google",
    googleLoading: "Redirecionando...",
    newTabNotice: "Abrimos o login em uma nova aba. Conclua o acesso por lá e volte para esta página.",
    signIn: "Entrar",
    signOut: "Sair",
    terms: "Ao entrar, voce concorda em usar o servico de forma responsavel.",
  },
  header: {
    brand: "SuKo Shop",
    selectLanguage: "Selecionar idioma",
    vipButton: "Virar VIP",
  },
  generate: {
    openButton: "Opcoes de geracao",
    title: "Gerar email temporario",
    emailLabel: "Email",
    emailPlaceholder: "Clique em Gerar para criar um email",
    regenerate: "Gerar outro",
    emailType: "Tipo de email",
    freemium: "Freemium",
    comingSoon: "Em breve",
    vip: "VIP",
    vipLocked: "VIP",
    domain: "Dominio",
    randomDomain: "Aleatorio entre todos",
    otherVipNotice: "Os dominios proprios da SuKo sao exclusivos para membros VIP. Vire VIP para liberar.",
    googleLoginNotice: "Voce precisa entrar com o Google para gerar um email @gmail.com.",
    noGmailAvailable: "Nenhum Gmail disponivel no momento. Tente novamente mais tarde.",
    cancel: "Cancelar",
    generate: "Gerar Email",
    generating: "Gerando...",
  },
  vip: {
    title: "SuKo VIP",
    subtitle: "Desbloqueie os dominios proprios da SuKo e recursos exclusivos.",
    price: "$4",
    perMonth: "/ mes",
    benefit1: "Acesso a todos os dominios proprios da SuKo",
    benefit2: "Emails ilimitados em dominios premium",
    benefit3: "Acesso ao historico completo da caixa de entrada",
    benefit4: "Suporte prioritario no Telegram",
    comingSoon: "Em breve",
  },
  hero: {
    title: "Email Temporário SuKo",
    subtitle: "Receba emails instantaneamente nos seus domínios.",
    tutorialTitle: "Como usar",
    tutorialStep1: "Digite o email do produto que voce comprou para receber codigos de verificacao ou fazer alteracoes na conta.",
    tutorialStep2: "Voce pode remover o email da sua conta se quiser, mas isso causara a perda da garantia do produto.",
  },
  emailInput: {
    heading: "Acesse sua Caixa de Entrada",
    description: "Digite seu email completo para verificar sua caixa de entrada",
    placeholder: "Digite seu email (ex: kratos@sub.sukospot.shop)",
    ariaLabel: "Endereço de email completo",
    copyAriaLabel: "Copiar email",
    accessAriaLabel: "Acessar email",
    submit: "Acessar Email",
    loading: "Carregando...",
    copiedToast: "Email copiado para a área de transferência!",
    copyErrorToast: "Não foi possível copiar.",
  },
  inbox: {
    title: "Caixa de Entrada",
    checking: "Verificando...",
    updatesIn: "Atualiza em ",
    seconds: "s",
    refresh: "Atualizar",
    refreshing: "Atualizando...",
    refreshAriaLabel: "Atualizar caixa de entrada",
    warning: "Emails podem levar de 15 a 30 segundos para chegar devido ao processamento do servidor. Se não encontrar, aguarde um momento e clique em Atualizar.",
    searching: "Buscando emails...",
    noEmailsFound: "Nenhum email encontrado",
    noEmailSelected: "Nenhum email selecionado",
    emptyInbox: "Sua caixa de entrada está vazia. Novas mensagens aparecerão aqui automaticamente.",
    enterEmailPrompt: "Digite um email acima e clique em 'Acessar Email' para verificar sua caixa de entrada.",
    attachment: "anexo",
    attachments: "anexos",
  },
  errors: {
    fetchError: "Erro ao buscar emails. Tente novamente.",
    invalidFormat: "Formato de email inválido. Use usuario@dominio.sukospot.shop",
    noUsername: "Digite um nome de usuário antes do @",
    unsupportedDomain: "Domínio não suportado. Use subdomínios de:",
    genericError: "Erro ao buscar emails.",
    updateError: "Erro ao atualizar.",
    gmailLoginRequired: "Para acessar emails @gmail.com voce precisa estar logado com o Google.",
  },
  status: {
    inboxUpdated: "Caixa de entrada atualizada",
    checkingNewEmails: "Verificando novos emails...",
  },
  notifications: {
    newEmailBrowser: "Novo email recebido!",
    from: "De",
    newEmailToastOne: "1 novo email!",
    newEmailToastMany: "{count} novos emails!",
  },
  footer: {
    text: "SuKo Shop · Serviço de email temporário · Todas as mensagens são excluídas automaticamente após 24 horas",
  },
  metadata: {
    title: "SuKo Shop - Email Temporário",
    description: "Acesse sua caixa de entrada temporária nos domínios SuKo",
  },
  profile: {
    title: "Meu Perfil",
    googleAccount: "Conta Google",
    name: "Nome",
    email: "Email",
    unnamed: "Sem nome",
    backToInbox: "Voltar para a Caixa de Entrada",
    signingOut: "Saindo...",
    balance: "Saldo",
    totalSpent: "Total gasto",
    gmailsGenerated: "Gmails gerados",
    totalEmails: "Emails gerados",
    emailHistory: "Historico de emails",
    historyEmpty: "Nenhum email ainda. Gere um para ve-lo aqui.",
    openInbox: "Abrir inbox",
    copy: "Copiar",
    copied: "Copiado!",
    customDomainTitle: "Usar um dominio SuKo",
    customDomainDesc: "Digite um nome de usuario em um dos dominios proprios da SuKo para receber nele.",
    customDomainPlaceholder: "usuario",
    addEmail: "Adicionar",
    vipRequiredMsg: "Este recurso e exclusivo para membros VIP.",
    invalidDomainMsg: "Escolha um dominio SuKo valido.",
    invalidEmailMsg: "Digite um nome de usuario valido.",
    addedMsg: "Email adicionado ao seu perfil.",
    inboxLoading: "Carregando emails...",
    inboxEmpty: "Nenhum email ainda. Envie um e atualize.",
    refresh: "Atualizar",
    close: "Fechar",
    rented: "Alugado",
    generated: "Gerado",
  },
  sidebar: {
    title: "Emails Salvos",
    noSavedEmails: "Nenhum email salvo",
    addEmailPrompt: "Adicione emails usando o campo acima",
    remove: "Remover",
    online: "Online",
    recheck: "Verificar",
  },
}

function playNotificationSound() {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = "sine"
    osc.frequency.setValueAtTime(880, ctx.currentTime)
    osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.08)
    gain.gain.setValueAtTime(0.15, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.3)
  } catch {
    // Audio not supported or blocked
  }
}

function requestNotificationPermission() {
  if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
    Notification.requestPermission()
  }
}

function showBrowserNotification(subject: string, from: string) {
  if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
    new Notification(dict.notifications.newEmailBrowser, {
      body: `${dict.notifications.from}: ${from}\n${subject}`,
      icon: "/favicon.ico",
    })
  }
}

// Migration Modal Component
function MigrationModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-zinc-900 border border-zinc-800 text-white rounded-xl p-6 max-w-md w-full text-center relative">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-zinc-500 hover:text-zinc-300 transition-colors"
          aria-label="Fechar"
        >
          <X className="h-5 w-5" />
        </button>
        
        <div className="flex justify-center mb-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/20">
            <AlertTriangle className="h-8 w-8 text-amber-500" />
          </div>
        </div>
        
        <h2 className="text-xl font-bold mb-2">Mudamos de Endereço!</h2>
        <p className="text-zinc-400 mb-6">
          O painel de E-mail Temporário da SuKoShop mudou para um link oficial mais rápido. Salve o novo link!
        </p>
        
        <a
          href={NEW_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white w-full py-3 rounded-lg font-medium transition-colors mb-3"
        >
          <ExternalLink className="h-4 w-4" />
          Acessar Novo Site
        </a>
        
        <button
          onClick={onClose}
          className="w-full py-3 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors font-medium"
        >
          Continuar no site antigo
        </button>
      </div>
    </div>
  )
}

export default function Page() {
  const [showModal, setShowModal] = useState(true)
  const [email, setEmail] = useState("")
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [emails, setEmails] = useState<Email[]>([])
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [activeUser, setActiveUser] = useState<string | null>(null)
  const [activeDomain, setActiveDomain] = useState<string | null>(null)
  const [hasSearched, setHasSearched] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  useEffect(() => {
    requestNotificationPermission()
  }, [])

  const fetchEmails = useCallback(async (fullAddress: string): Promise<Email[]> => {
    // Caixas bloqueadas (lista fixa + blocklist do admin) nunca podem ser lidas.
    if (await isAddressBlocked(fullAddress)) {
      throw new Error("Esta caixa e protegida e nao pode ser lida.")
    }
    // gmail e outlook/hotmail sao lidos via IMAP (a API escolhe a mailbox certa
    // pelo dominio); dominios proprios vem do Cloudflare KV. Consultamos as duas
    // fontes em PARALELO para a lenta nunca travar a rapida.
    const imapPromise: Promise<Email[]> = usesImap(fullAddress)
      ? fetch(`/api/gmail-inbox?email=${encodeURIComponent(fullAddress)}`, { cache: "no-store" })
          .then((r) => (r.ok ? r.json() : []))
          .then((data: unknown) =>
            (Array.isArray(data) ? data : []).map(
              (
                item: { id?: string; from?: string; subject?: string; date?: string; body?: string },
                i: number,
              ) => ({
                id: item.id ?? `imap-${fullAddress}-${i}`,
                from: item.from ?? "Desconhecido",
                subject: item.subject ?? "(Sem assunto)",
                date: item.date ?? "",
                body: item.body || `<p style="color:#888;font-size:13px">Sem conteudo.</p>`,
                attachments: [],
              }),
            ),
          )
          .catch(() => [] as Email[])
      : Promise.resolve([] as Email[])

    const kvPromise: Promise<Email[]> = fetch(`${CF_INBOX_API}/${fullAddress}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : []))
      .then((data: unknown) =>
        (Array.isArray(data) ? data : []).map((item, i: number) =>
          buildCustomDomainEmail(item, `cf-${fullAddress}`, i),
        ),
      )
      .catch(() => [] as Email[])

    const [imapResults, kvResults] = await Promise.all([imapPromise, kvPromise])
    const merged = [...imapResults, ...kvResults]
    merged.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    return merged
  }, [])

  const checkForNewEmails = useCallback((prev: Email[], next: Email[]) => {
    const prevIds = new Set(prev.map((e) => e.id))
    const newEmails = next.filter((e) => !prevIds.has(e.id))
    if (newEmails.length > 0) {
      playNotificationSound()
      const first = newEmails[0]
      showBrowserNotification(first.subject, first.from)
      const msg =
        newEmails.length === 1
          ? dict.notifications.newEmailToastOne
          : dict.notifications.newEmailToastMany.replace("{count}", String(newEmails.length))
      toast.success(msg, { description: first.subject })
    }
    return newEmails.length > 0
  }, [])

  const handleCheckMail = useCallback(async () => {
    const trimmed = email.trim()
    if (!trimmed) return

    const atIndex = trimmed.lastIndexOf("@")
    if (atIndex === -1) { setFetchError(dict.errors.invalidFormat); return }

    const user = trimmed.slice(0, atIndex)
    const domain = trimmed.slice(atIndex)
    if (!user) { setFetchError(dict.errors.noUsername); return }

    setFetchError(null)
    setLoading(true)
    setStatusMessage(null)

    try {
      const result = await fetchEmails(trimmed)
      setHasSearched(true)
      setEmails(result)
      setActiveUser(user)
      setActiveDomain(domain)
      setStatusMessage(dict.status.inboxUpdated)
      setTimeout(() => setStatusMessage(null), 3000)
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : dict.errors.genericError)
      setEmails([])
    } finally {
      setLoading(false)
    }
  }, [email, fetchEmails])

  const handleManualRefresh = useCallback(async () => {
    if (!activeUser || !activeDomain) return

    setRefreshing(true)
    setStatusMessage(dict.status.checkingNewEmails)

    try {
      const result = await fetchEmails(`${activeUser}${activeDomain}`)
      checkForNewEmails(emails, result)
      setEmails(result)
      setFetchError(null)
      setStatusMessage(dict.status.inboxUpdated)
      setTimeout(() => setStatusMessage(null), 3000)
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : dict.errors.updateError)
      setTimeout(() => setStatusMessage(null), 5000)
    } finally {
      setRefreshing(false)
    }
  }, [activeUser, activeDomain, fetchEmails, emails, checkForNewEmails])

  const handleEmailChange = useCallback((value: string) => {
    setEmail(value)
    if (fetchError) setFetchError(null)
  }, [fetchError])

  const activeAddress = activeUser && activeDomain ? `${activeUser}${activeDomain}` : null

  return (
    <div className="flex min-h-screen flex-col">
      {showModal && <MigrationModal onClose={() => setShowModal(false)} />}
      
      <SiteHeader lang="pt" />

      <main className="flex flex-1 items-start justify-center px-4 py-12 sm:py-20">
        <div className="w-full max-w-2xl space-y-6">
          <div className="text-center">
            <h1 className="text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              {dict.hero.title}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {dict.hero.subtitle}
            </p>
          </div>

          <EmailInput
            email={email}
            error={fetchError}
            activeAddress={activeAddress}
            onEmailChange={handleEmailChange}
            onSubmit={handleCheckMail}
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
            fetchError={fetchError}
            onRefresh={handleManualRefresh}
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
