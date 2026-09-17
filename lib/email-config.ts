/**
 * Email generation configuration.
 *
 * Edit the arrays below to control what addresses/domains the generator offers.
 */

/**
 * GOOGLE (gmail.com) — pool of specific Gmail aliases that are available to
 * generate. The generator picks one of these at random. Add the Gmail
 * addresses you want available here (just the part before @gmail.com OR the
 * full address — both work).
 *
 * These are FREE for any logged-in user (Google sign-in required).
 */
export const GMAIL_POOL: string[] = [
  // Add your available gmails here, e.g.:
  // "johnsmith8821",
  // "maria.silva42",
  "sukotemp01",
  "sukotemp02",
  "sukotemp03",
]

/**
 * OTHER — your own custom domains. These are VIP-only.
 * A random username is generated for the chosen domain.
 */
export const OTHER_DOMAINS: string[] = [
  "csukospot.world",
  "nokxs.shop",
  "sekori857.world",
  "skzinho.world",
  "skzz.net",
  "srdkozinho.com.br",
  "sukodocursor.shop",
  "sukohub.com",
  "sukohub.space",
  "sukospot.shop",
  "sukoultra.shop",
  "sukozin.shop",
  "suksalad.shop",
  "sukynhoia.shop",
  "sukynhugp.shop",
  "thesuaky.shop",
  "thesukogpt.shop",
  "tskokozinho.shop",
  "tskulzinho.shop",
  "tszkozinho.com",
]

export type EmailProvider = "google" | "microsoft" | "other"

/** Normalize a pool entry to a full gmail address. */
export function toGmailAddress(entry: string): string {
  const v = entry.trim().toLowerCase()
  return v.includes("@") ? v : `${v}@gmail.com`
}

/** Pick a random gmail from the pool that is not already in `taken`. */
export function pickAvailableGmail(taken: string[]): string | null {
  const takenSet = new Set(taken.map((t) => t.toLowerCase()))
  const available = GMAIL_POOL.map(toGmailAddress).filter((a) => !takenSet.has(a))
  if (available.length === 0) return null
  return available[Math.floor(Math.random() * available.length)]
}

/** Generate a random alphanumeric username (for Other / custom domains). */
export function randomUsername(length = 10): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789"
  let out = ""
  for (let i = 0; i < length; i++) {
    out += chars[Math.floor(Math.random() * chars.length)]
  }
  return out
}

/** Build an Other-domain address. Pass a specific domain or omit for random. */
export function buildOtherAddress(domain?: string): string {
  const d = domain && OTHER_DOMAINS.includes(domain)
    ? domain
    : OTHER_DOMAINS[Math.floor(Math.random() * OTHER_DOMAINS.length)]
  return `${randomUsername()}@${d}`
}
