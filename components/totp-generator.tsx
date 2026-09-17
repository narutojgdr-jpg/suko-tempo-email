"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { KeyRound, Copy, Check, Trash2, ShieldCheck, Inbox as InboxIcon, Plus } from "lucide-react"
import { SiteHeader } from "@/components/site-header"
import { generateTotp, totpSecondsRemaining } from "@/lib/totp"

const PERIOD = 30

interface TotpEntry {
  id: string
  secret: string
  code: string | null
  valid: boolean
}

/** Normaliza a chave: remove espacos, deixa maiuscula. Aceita o formato com grupos. */
function normalizeSecret(raw: string): string {
  return raw.toUpperCase().replace(/\s+/g, "")
}

function TotpCard({
  entry,
  secondsLeft,
  onRemove,
}: {
  entry: TotpEntry
  secondsLeft: number
  onRemove: (id: string) => void
}) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    if (!entry.code) return
    try {
      await navigator.clipboard.writeText(entry.code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard pode falhar em contextos sem permissao; ignora silenciosamente
    }
  }, [entry.code])

  const progress = (secondsLeft / PERIOD) * 100
  const display = entry.code ? `${entry.code.slice(0, 3)} ${entry.code.slice(3)}` : "••• •••"

  return (
    <div className="animate-pop-in rounded-xl border border-border bg-card p-4 shadow-soft transition-fluid hover:shadow-soft-lg sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <KeyRound className="h-4 w-4 shrink-0 text-primary" />
          <span className="truncate font-mono text-xs text-muted-foreground" title={entry.secret}>
            {entry.secret}
          </span>
        </div>
        <button
          type="button"
          onClick={() => onRemove(entry.id)}
          className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
          aria-label="Remover chave"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {entry.valid ? (
        <>
          <button
            type="button"
            onClick={handleCopy}
            className="animate-press group mt-3 flex w-full items-center justify-between gap-3 rounded-lg border border-border bg-background px-4 py-3 transition-fluid hover:border-primary hover:shadow-glow-primary active:scale-[0.99]"
            aria-label="Copiar codigo"
          >
            <span className="font-mono text-3xl font-bold tracking-widest text-foreground tabular-nums sm:text-4xl">
              {display}
            </span>
            <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground group-hover:text-primary">
              {copied ? (
                <>
                  <Check className="h-4 w-4 text-primary" />
                  Copiado
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  Copiar
                </>
              )}
            </span>
          </button>

          <div className="mt-3 flex items-center gap-3">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-1000 ease-linear"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="w-10 text-right font-mono text-xs tabular-nums text-muted-foreground">
              {secondsLeft}s
            </span>
          </div>
        </>
      ) : (
        <p className="mt-3 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          Chave invalida. Verifique se ela esta no formato Base32 (ex.: QL3FN4WMR2EHFJ3JALFYFKDREY5PZ6ZJ).
        </p>
      )}
    </div>
  )
}

export function TotpGenerator({ lang }: { lang: string }) {
  const [input, setInput] = useState("")
  const [entries, setEntries] = useState<TotpEntry[]>([])
  const [secondsLeft, setSecondsLeft] = useState(totpSecondsRemaining(PERIOD))
  // Guarda o counter atual para so regenerar os codigos quando a janela muda.
  const lastWindowRef = useRef<number>(-1)
  // Diferenca (ms) entre o relogio do servidor (NTP) e o do navegador. O
  // relogio do PC pode estar adiantado/atrasado, o que faria os codigos serem
  // recusados; por isso sincronizamos com o servidor. now() = horario corrigido.
  const timeOffsetRef = useRef<number>(0)
  const now = useCallback(() => Date.now() + timeOffsetRef.current, [])

  const inboxHref = useMemo(() => `/${lang}/infinity`, [lang])

  // Sincroniza com o horario do servidor uma vez ao montar.
  useEffect(() => {
    let cancelled = false
    const sync = async () => {
      try {
        const t0 = Date.now()
        const res = await fetch("/api/server-time", { cache: "no-store" })
        if (!res.ok) return
        const { now: serverNow } = (await res.json()) as { now: number }
        const t1 = Date.now()
        // Compensa metade do round-trip da rede para estimar melhor o "agora".
        const estimatedClientNow = t0 + (t1 - t0) / 2
        if (!cancelled) {
          timeOffsetRef.current = serverNow - estimatedClientNow
          // Recalcula imediatamente o contador com o horario corrigido.
          setSecondsLeft(totpSecondsRemaining(PERIOD, Date.now() + timeOffsetRef.current))
          lastWindowRef.current = -1
        }
      } catch {
        // Sem rede: cai no relogio local (melhor esforco).
      }
    }
    void sync()
    return () => {
      cancelled = true
    }
  }, [])

  const addKey = useCallback(async () => {
    const secret = normalizeSecret(input)
    if (!secret) return
    if (entries.some((e) => e.secret === secret)) {
      setInput("")
      return
    }
    const code = await generateTotp(secret, PERIOD, 6, now())
    setEntries((prev) => [
      { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, secret, code, valid: code !== null },
      ...prev,
    ])
    setInput("")
  }, [input, entries, now])

  const removeKey = useCallback((id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id))
  }, [])

  // Tick a cada segundo: atualiza o contador e regenera os codigos quando a
  // janela de 30s expira.
  useEffect(() => {
    let cancelled = false

    const tick = async () => {
      const nowMs = now()
      const remaining = totpSecondsRemaining(PERIOD, nowMs)
      if (!cancelled) setSecondsLeft(remaining)

      const currentWindow = Math.floor(nowMs / 1000 / PERIOD)
      if (currentWindow !== lastWindowRef.current) {
        lastWindowRef.current = currentWindow
        setEntries((prev) => {
          if (prev.length === 0) return prev
          // Regenera de forma assincrona e aplica via novo setState.
          Promise.all(
            prev.map(async (e) => {
              const code = await generateTotp(e.secret, PERIOD, 6, now())
              return { ...e, code, valid: code !== null }
            }),
          ).then((updated) => {
            if (!cancelled) setEntries(updated)
          })
          return prev
        })
      }
    }

    tick()
    const interval = setInterval(tick, 1000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [now])

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader lang="pt" />

      <main className="flex flex-1 items-start justify-center px-4 py-10 sm:py-16">
        <div className="w-full max-w-2xl space-y-6">
          <div className="text-center">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" />
              Gerador 2FA
            </div>
            <h1 className="text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Coletor de codigos 2FA
            </h1>
            <p className="mt-2 text-pretty text-sm text-muted-foreground">
              Cole a chave secreta da conta e os codigos serao gerados automaticamente. Clique no codigo
              para copiar.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-4 shadow-soft sm:p-5">
            <label htmlFor="totp-secret" className="mb-2 block text-sm font-medium text-foreground">
              Chave secreta (2FA)
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                id="totp-secret"
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    void addKey()
                  }
                }}
                placeholder="QL3FN4WMR2EHFJ3JALFYFKDREY5PZ6ZJ"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                className="flex-1 rounded-lg border border-border bg-background px-4 py-3 font-mono text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
              />
              <button
                type="button"
                onClick={() => void addKey()}
                className="animate-press inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-glow-primary transition-fluid hover:opacity-90 active:scale-95"
              >
                <Plus className="h-4 w-4" />
                Gerar codigos
              </button>
            </div>
          </div>

          {entries.length > 0 && (
            <div className="space-y-3">
              {entries.map((entry) => (
                <TotpCard key={entry.id} entry={entry} secondsLeft={secondsLeft} onRemove={removeKey} />
              ))}
            </div>
          )}

          <Link
            href={inboxHref}
            className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-4 shadow-soft transition-fluid hover-lift hover:border-primary hover:shadow-soft-lg"
          >
            <span className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <InboxIcon className="h-5 w-5" />
              </span>
              <span className="flex flex-col">
                <span className="text-sm font-semibold text-foreground">
                  Caso queira coletar codigos de email, use a inbox
                </span>
                <span className="text-xs text-muted-foreground">
                  Acesse a caixa de entrada Infinity para ler emails de Gmail, Outlook e dominios proprios.
                </span>
              </span>
            </span>
            <span className="shrink-0 text-sm font-medium text-primary">Abrir inbox →</span>
          </Link>
        </div>
      </main>

      <footer className="border-t border-border py-4 text-center text-xs text-muted-foreground">
        <p>SuKo Shop — Infinity</p>
      </footer>
    </div>
  )
}
