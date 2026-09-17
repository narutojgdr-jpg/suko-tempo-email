"use client"

import { useState, useEffect, useCallback, useTransition } from "react"
import { Search, Crown, Wallet, X, Loader2, KeyRound, Copy, Check, Eye, AlertTriangle, Mail, RefreshCw, Tag } from "lucide-react"
import { toast } from "sonner"
import { formatUsd, parseUsdToCents } from "@/lib/money"
import {
  setVip,
  adjustBalance,
  setGmailPrice,
  setUserGmailPrice,
  getDepositCredentials,
  listAccountGmails,
  getWalletBalances,
  type AccountRow,
  type AccountGmail,
  type WalletBalance,
} from "@/app/actions/admin"

interface AccountsTabProps {
  accounts: AccountRow[]
  gmailPriceCents: number
}

export function AccountsTab({ accounts, gmailPriceCents }: AccountsTabProps) {
  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState<AccountRow | null>(null)
  const [priceInput, setPriceInput] = useState(
    gmailPriceCents > 0 ? (gmailPriceCents / 100).toFixed(2) : "",
  )
  const [savingPrice, startPrice] = useTransition()

  const filtered = accounts.filter((a) => a.email.toLowerCase().includes(search.toLowerCase()))

  function handleSavePrice() {
    startPrice(async () => {
      try {
        await setGmailPrice(parseUsdToCents(priceInput))
        toast.success("Gmail price updated")
      } catch {
        toast.error("Failed to update price")
      }
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Accounts</h1>
          <p className="text-sm text-muted-foreground">{accounts.length} registered accounts.</p>
        </div>
        {/* Global gmail price */}
        <div className="flex items-end gap-2 rounded-xl border border-border bg-card p-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Gmail price (USD)
            </label>
            <div className="flex items-center gap-1">
              <span className="text-sm text-muted-foreground">$</span>
              <input
                value={priceInput}
                onChange={(e) => setPriceInput(e.target.value)}
                placeholder="0.00"
                inputMode="decimal"
                className="w-24 rounded-md border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
          <button
            onClick={handleSavePrice}
            disabled={savingPrice}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {savingPrice ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by email..."
          className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Balance</th>
                <th className="px-4 py-3 font-medium">VIP</th>
                <th className="px-4 py-3 font-medium text-right">Manage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                    No accounts found.
                  </td>
                </tr>
              ) : (
                filtered.map((a) => (
                  <tr key={a.user_id} className="hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <span className="font-medium">{a.email}</span>
                      {a.name && <span className="ml-2 text-xs text-muted-foreground">{a.name}</span>}
                    </td>
                    <td className="px-4 py-3 tabular-nums">{formatUsd(a.balance_cents)}</td>
                    <td className="px-4 py-3">
                      {a.is_vip ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/15 px-2 py-0.5 text-xs font-medium text-amber-400">
                          <Crown className="h-3 w-3" /> VIP
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setSelected(a)}
                        className="rounded-md border border-border px-3 py-1 text-xs font-medium transition-colors hover:bg-muted"
                      >
                        Manage
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <ManageAccountModal
          account={selected}
          globalPriceCents={gmailPriceCents}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}

function ManageAccountModal({
  account,
  globalPriceCents,
  onClose,
}: {
  account: AccountRow
  globalPriceCents: number
  onClose: () => void
}) {
  const [isVip, setIsVip] = useState(account.is_vip)
  const [amount, setAmount] = useState("")
  const [pending, startTransition] = useTransition()

  // Preco de Gmail personalizado para este usuario (vazio = usa o preco global)
  const [userPrice, setUserPrice] = useState(
    account.gmail_price_cents != null ? (account.gmail_price_cents / 100).toFixed(2) : "",
  )
  const [savingUserPrice, startUserPrice] = useTransition()

  function saveUserPrice() {
    startUserPrice(async () => {
      try {
        const trimmed = userPrice.trim()
        await setUserGmailPrice(account.email, trimmed === "" ? null : parseUsdToCents(trimmed))
        toast.success(trimmed === "" ? "Preco custom removido (usa o global)" : "Preco personalizado salvo")
      } catch {
        toast.error("Falha ao salvar o preco")
      }
    })
  }

  function clearUserPrice() {
    setUserPrice("")
    startUserPrice(async () => {
      try {
        await setUserGmailPrice(account.email, null)
        toast.success("Preco custom removido (usa o global)")
      } catch {
        toast.error("Falha ao remover o preco")
      }
    })
  }

  function toggleVip() {
    const next = !isVip
    startTransition(async () => {
      try {
        await setVip(account.email, next)
        setIsVip(next)
        toast.success(next ? "VIP granted" : "VIP revoked")
      } catch {
        toast.error("Failed to update VIP")
      }
    })
  }

  function recharge(sign: 1 | -1) {
    const cents = parseUsdToCents(amount) * sign
    if (cents === 0) {
      toast.error("Enter an amount")
      return
    }
    startTransition(async () => {
      try {
        await adjustBalance(account.email, cents)
        toast.success(sign > 0 ? "Balance added" : "Balance removed")
        setAmount("")
        onClose()
      } catch {
        toast.error("Failed to adjust balance")
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
          <div>
            <h2 className="text-lg font-bold">Manage account</h2>
            <p className="text-sm text-muted-foreground">{account.email}</p>
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Current balance */}
          <div className="rounded-lg border border-border bg-background p-3">
            <p className="text-xs text-muted-foreground">Current balance</p>
            <p className="text-xl font-bold tabular-nums">{formatUsd(account.balance_cents)}</p>
          </div>

          {/* VIP toggle */}
          <div className="flex items-center justify-between rounded-lg border border-border bg-background p-3">
            <div className="flex items-center gap-2">
              <Crown className="h-4 w-4 text-amber-400" />
              <span className="text-sm font-medium">VIP membership</span>
            </div>
            <button
              onClick={toggleVip}
              disabled={pending}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 ${
                isVip
                  ? "border border-border hover:bg-muted"
                  : "bg-amber-400 text-amber-950 hover:bg-amber-300"
              }`}
            >
              {isVip ? "Revoke VIP" : "Grant VIP"}
            </button>
          </div>

          {/* Balance recharge */}
          <div className="rounded-lg border border-border bg-background p-3">
            <div className="mb-2 flex items-center gap-2">
              <Wallet className="h-4 w-4 text-emerald-400" />
              <span className="text-sm font-medium">Adjust balance</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">$</span>
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                inputMode="decimal"
                className="flex-1 rounded-md border border-border bg-card px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="mt-2 flex gap-2">
              <button
                onClick={() => recharge(1)}
                disabled={pending}
                className="flex-1 rounded-md bg-emerald-500 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-emerald-600 disabled:opacity-50"
              >
                Add
              </button>
              <button
                onClick={() => recharge(-1)}
                disabled={pending}
                className="flex-1 rounded-md border border-border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50"
              >
                Remove
              </button>
            </div>
          </div>

          {/* Preco de Gmail personalizado para este usuario */}
          <div className="rounded-lg border border-border bg-background p-3">
            <div className="mb-2 flex items-center gap-2">
              <Tag className="h-4 w-4 text-violet-400" />
              <span className="text-sm font-medium">Preco do Gmail (so para este usuario)</span>
            </div>
            <p className="mb-2 text-xs text-muted-foreground">
              Deixe vazio para usar o preco global{" "}
              <span className="font-medium text-foreground">
                ({globalPriceCents > 0 ? formatUsd(globalPriceCents) : "nao definido"})
              </span>
              .
            </p>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">$</span>
              <input
                value={userPrice}
                onChange={(e) => setUserPrice(e.target.value)}
                placeholder={globalPriceCents > 0 ? (globalPriceCents / 100).toFixed(2) : "0.00"}
                inputMode="decimal"
                className="flex-1 rounded-md border border-border bg-card px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="mt-2 flex gap-2">
              <button
                onClick={saveUserPrice}
                disabled={savingUserPrice}
                className="flex-1 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                {savingUserPrice ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Salvar preco"}
              </button>
              {account.gmail_price_cents != null && (
                <button
                  onClick={clearUserPrice}
                  disabled={savingUserPrice}
                  className="rounded-md border border-border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50"
                >
                  Usar global
                </button>
              )}
            </div>
          </div>

          {/* Gmails comprados/alugados por este usuario */}
          <AccountGmailsSection account={account} />

          {/* Deposit wallet — withdraw funds + live balance */}
          <DepositWalletSection account={account} />
        </div>
      </div>
    </div>
  )
}

function AccountGmailsSection({ account }: { account: AccountRow }) {
  const [gmails, setGmails] = useState<AccountGmail[] | null>(null)
  const [loading, startLoad] = useTransition()

  const load = useCallback(() => {
    startLoad(async () => {
      try {
        setGmails(await listAccountGmails(account.email))
      } catch {
        toast.error("Falha ao carregar gmails")
        setGmails([])
      }
    })
  }, [account.email])

  // Carrega assim que o modal abre
  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-violet-400" />
          <span className="text-sm font-medium">
            Gmails adquiridos {gmails ? `(${gmails.length})` : ""}
          </span>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
          aria-label="Atualizar lista"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
        </button>
      </div>

      {gmails === null ? (
        <p className="text-xs text-muted-foreground">Carregando...</p>
      ) : gmails.length === 0 ? (
        <p className="text-xs text-muted-foreground">Este usuario ainda nao adquiriu nenhum gmail.</p>
      ) : (
        <div className="max-h-40 space-y-1.5 overflow-y-auto">
          {gmails.map((g) => (
            <div
              key={g.address}
              className="flex items-center gap-2 rounded-md border border-border bg-card px-2 py-1.5"
            >
              <span className="flex-1 truncate font-mono text-xs">{g.address}</span>
              <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                {formatUsd(g.price_cents)}
              </span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(g.address)
                  toast.success("Copiado")
                }}
                className="shrink-0 text-muted-foreground hover:text-foreground"
                aria-label="Copiar gmail"
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function DepositWalletSection({ account }: { account: AccountRow }) {
  const [creds, setCreds] = useState<{ address: string; privateKey: string; index: number } | null>(null)
  const [loading, startLoad] = useTransition()
  const [copiedKey, setCopiedKey] = useState(false)
  const [copiedAddr, setCopiedAddr] = useState(false)

  function reveal() {
    startLoad(async () => {
      try {
        const res = await getDepositCredentials(account.email)
        setCreds(res)
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Falha ao revelar a chave")
      }
    })
  }

  function copy(text: string, which: "key" | "addr") {
    navigator.clipboard.writeText(text)
    if (which === "key") {
      setCopiedKey(true)
      setTimeout(() => setCopiedKey(false), 2000)
    } else {
      setCopiedAddr(true)
      setTimeout(() => setCopiedAddr(false), 2000)
    }
  }

  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <div className="mb-2 flex items-center gap-2">
        <KeyRound className="h-4 w-4 text-sky-400" />
        <span className="text-sm font-medium">Carteira de deposito (saque)</span>
      </div>

      {/* Endereco */}
      {account.deposit_address ? (
        <div className="flex items-center gap-2 rounded-md border border-border bg-card px-2 py-1.5">
          <span className="flex-1 truncate font-mono text-xs">{account.deposit_address}</span>
          <button
            onClick={() => copy(account.deposit_address!, "addr")}
            className="shrink-0 text-muted-foreground hover:text-foreground"
            aria-label="Copiar endereco"
          >
            {copiedAddr ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Usuario ainda nao gerou endereco de deposito.</p>
      )}

      {/* Saldo on-chain ao vivo */}
      {account.deposit_address && <LiveWalletBalance address={account.deposit_address} />}

      {/* Reveal private key */}
      {account.deposit_address && !creds && (
        <button
          onClick={reveal}
          disabled={loading}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-md border border-sky-500/40 bg-sky-500/10 px-3 py-1.5 text-sm font-medium text-sky-400 transition-colors hover:bg-sky-500/20 disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
          Revelar chave privada
        </button>
      )}

      {creds && (
        <div className="mt-2 space-y-2">
          <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-500">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              {"Importe esta chave na MetaMask/Trust Wallet para sacar. Ela controla os fundos em TODAS as redes (BSC, ETH, Polygon, Arbitrum). Nunca compartilhe."}
            </span>
          </div>
          <div className="flex items-center gap-2 rounded-md border border-border bg-card px-2 py-1.5">
            <span className="flex-1 truncate font-mono text-xs">{creds.privateKey}</span>
            <button
              onClick={() => copy(creds.privateKey, "key")}
              className="shrink-0 text-muted-foreground hover:text-foreground"
              aria-label="Copiar chave privada"
            >
              {copiedKey ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground">{`Indice de derivacao: ${creds.index}`}</p>
        </div>
      )}
    </div>
  )
}

/**
 * Mostra o saldo USDT ON-CHAIN do endereco de deposito, somando as 4 redes EVM.
 * Atualiza em tempo real: busca ao montar e re-busca a cada 15s, alem de um
 * botao manual de refresh.
 */
function LiveWalletBalance({ address }: { address: string }) {
  const [data, setData] = useState<{ total: number; balances: WalletBalance[] } | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getWalletBalances(address)
      if (res.ok) setData({ total: res.total, balances: res.balances })
    } catch {
      // silencioso — mantem o ultimo valor conhecido
    } finally {
      setLoading(false)
    }
  }, [address])

  useEffect(() => {
    load()
    const id = setInterval(load, 15_000)
    return () => clearInterval(id)
  }, [load])

  return (
    <div className="mt-2 rounded-md border border-emerald-500/30 bg-emerald-500/5 p-2.5">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-500">
          <Wallet className="h-3.5 w-3.5" />
          Saldo on-chain (USDT)
        </span>
        <div className="flex items-center gap-1.5">
          {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
          <button
            onClick={load}
            disabled={loading}
            className="text-muted-foreground hover:text-foreground disabled:opacity-50"
            aria-label="Atualizar saldo"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {data === null ? (
        <p className="text-xs text-muted-foreground">Consultando redes...</p>
      ) : (
        <>
          <p className="text-xl font-bold tabular-nums text-emerald-400">
            {`$${data.total.toFixed(2)}`}
          </p>
          <div className="mt-1.5 grid grid-cols-2 gap-1">
            {data.balances.map((b) => (
              <div
                key={b.network}
                className="flex items-center justify-between rounded border border-border bg-card px-1.5 py-1 text-[11px]"
              >
                <span className="text-muted-foreground">{b.label}</span>
                <span className="tabular-nums font-medium">{`$${b.usd.toFixed(2)}`}</span>
              </div>
            ))}
          </div>
          <p className="mt-1.5 text-[10px] text-muted-foreground">Atualiza a cada 15s</p>
        </>
      )}
    </div>
  )
}
