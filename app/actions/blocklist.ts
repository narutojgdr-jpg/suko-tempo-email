"use server"

import { revalidatePath } from "next/cache"
import { query } from "@/lib/db"
import { requireAdmin } from "@/lib/admin"
import {
  ensureBlocklistTable,
  bustBlocklistCache,
  getDynamicBlocked,
  type BlockedRow,
} from "@/lib/blocklist-store"
import { BLOCKED_INBOX_ADDRESSES } from "@/lib/inbox-routing"

/** Lista todas as entradas da blocklist dinamica (admin). */
export async function listBlockedInboxes(): Promise<BlockedRow[]> {
  await requireAdmin()
  await ensureBlocklistTable()
  return query<BlockedRow>(
    `SELECT id, value, kind, note, created_at
     FROM public.blocked_inbox ORDER BY created_at DESC`,
  )
}

/**
 * Adiciona uma ou mais entradas (uma por linha). Cada valor com "@" vira
 * bloqueio de endereco exato; sem "@" vira bloqueio de dominio inteiro.
 * Retorna quantas entradas novas foram criadas.
 */
export async function addBlockedInboxes(raw: string, note?: string): Promise<number> {
  await requireAdmin()
  await ensureBlocklistTable()
  const entries = Array.from(
    new Set(
      raw
        .split(/[\n,;]+/)
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean),
    ),
  )
  if (entries.length === 0) return 0
  const cleanNote = note?.trim() || null
  let added = 0
  for (const value of entries) {
    const kind = value.includes("@") ? "address" : "domain"
    const res = await query(
      `INSERT INTO public.blocked_inbox (value, kind, note) VALUES ($1, $2, $3)
       ON CONFLICT (value) DO NOTHING RETURNING id`,
      [value, kind, cleanNote],
    )
    if (res.length > 0) added++
  }
  bustBlocklistCache()
  revalidatePath("/admin")
  return added
}

/** Remove uma entrada da blocklist dinamica. */
export async function removeBlockedInbox(id: number): Promise<void> {
  await requireAdmin()
  await ensureBlocklistTable()
  await query(`DELETE FROM public.blocked_inbox WHERE id = $1`, [id])
  bustBlocklistCache()
  revalidatePath("/admin")
}

/**
 * Lista publica (NAO admin) usada pelo cliente para bloquear leituras feitas
 * direto do navegador (dominios proprios via KV). Inclui a lista fixa + a
 * dinamica. Expor isto e seguro: so revela QUAIS caixas estao bloqueadas.
 */
export async function getBlockedAddresses(): Promise<{ addresses: string[]; domains: string[] }> {
  const { addresses, domains } = await getDynamicBlocked()
  const merged = new Set<string>(addresses)
  for (const a of BLOCKED_INBOX_ADDRESSES) merged.add(a.toLowerCase().trim())
  return { addresses: [...merged], domains }
}
