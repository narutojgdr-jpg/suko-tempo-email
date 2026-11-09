import { auth } from "@/lib/auth/server"
import { query } from "@/lib/db"

/**
 * The ONLY account that can manage other admins. Hardcoded on purpose.
 * Lowercased compare.
 */
export const ADMIN_EMAIL = "izukisukinho@gmail.com"

export type AdminSessionUser = {
  id: string
  email: string
  name?: string | null
  image?: string | null
}

/** Returns the logged-in user's email (lowercased) or null. */
export async function getSessionEmail(): Promise<string | null> {
  try {
    const { data: session } = await auth.getSession()
    const email = session?.user?.email
    return email ? email.toLowerCase() : null
  } catch {
    return null
  }
}

async function ensureAdminsTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS public.extra_admins (
      email TEXT PRIMARY KEY,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `)
}

/** True when the currently logged-in Google account is the main admin or an extra admin. */
export async function isAdmin(): Promise<boolean> {
  const email = await getSessionEmail()
  if (!email) return false
  if (email === ADMIN_EMAIL) return true
  try {
    await ensureAdminsTable()
    const rows = await query<{ email: string }>(
      `SELECT email FROM public.extra_admins WHERE email = $1`,
      [email],
    )
    return rows.length > 0
  } catch {
    return false
  }
}

/** True only for the main admin (can manage other admins). */
export async function isMainAdmin(): Promise<boolean> {
  const email = await getSessionEmail()
  return email === ADMIN_EMAIL
}

/** Throws unless the caller is an admin. */
export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) {
    throw new Error("Unauthorized")
  }
}

/** Throws unless the caller is the main admin. */
export async function requireMainAdmin(): Promise<void> {
  if (!(await isMainAdmin())) {
    throw new Error("Unauthorized")
  }
}
