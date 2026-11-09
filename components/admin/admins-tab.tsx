"use client"

import { useEffect, useState } from "react"
import { Shield, Plus, Trash2 } from "lucide-react"
import { listExtraAdmins, addExtraAdmin, removeExtraAdmin, type ExtraAdmin } from "@/app/actions/admins"

export function AdminsTab() {
  const [admins, setAdmins] = useState<ExtraAdmin[]>([])
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function load() {
    setLoading(true)
    setError("")
    try {
      const list = await listExtraAdmins()
      setAdmins(list)
    } catch (e: any) {
      setError(e.message || "Falha")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function handleAdd() {
    if (!email.trim()) return
    const res = await addExtraAdmin(email)
    if (res.ok) {
      setEmail("")
      await load()
    } else {
      setError(res.error || "Falha")
    }
  }

  async function handleRemove(em: string) {
    if (!confirm(`Remover ${em}?`)) return
    await removeExtraAdmin(em)
    await load()
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Shield className="h-6 w-6 text-amber-400" />
          Admins
        </h1>
        <p className="text-sm text-muted-foreground">
          Só você pode ver essa aba. Admins extras têm acesso ao painel, mas não podem gerenciar outros admins.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="flex gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email@gmail.com"
          className="flex-1 rounded-lg border border-border bg-card px-3 py-2 text-sm"
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
        />
        <button
          onClick={handleAdd}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Adicionar
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : admins.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Nenhum admin extra.</p>
      ) : (
        <div className="space-y-2">
          {admins.map((a) => (
            <div key={a.email} className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3">
              <div>
                <p className="font-medium">{a.email}</p>
                <p className="text-xs text-muted-foreground">{new Date(a.createdAt).toLocaleDateString()}</p>
              </div>
              <button
                onClick={() => handleRemove(a.email)}
                className="text-destructive hover:text-destructive/80"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
