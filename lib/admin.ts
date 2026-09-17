import { auth } from "@/lib/auth/server"

/**
 * The ONLY account allowed into the admin panel. Hardcoded on purpose so the
 * gate cannot be flipped from the database or the client. Lowercased compare.
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

/** True only when the currently logged-in Google account is the admin. */
export async function isAdmin(): Promise<boolean> {
  const email = await getSessionEmail()
  return email === ADMIN_EMAIL
}

/** Throws unless the caller is the admin. Use at the top of every admin action. */
export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) {
    throw new Error("Unauthorized")
  }
}
