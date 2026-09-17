import { Pool } from "pg"

/**
 * Single shared pg Pool for the whole app. Neon Auth manages its own
 * connection internally; this pool is for our own application tables
 * (user_profile, gmail_pool, email_wishlist, transaction_log, platform_settings).
 */
const globalForDb = globalThis as unknown as { __pgPool?: Pool }

export const pool =
  globalForDb.__pgPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
  })

if (process.env.NODE_ENV !== "production") {
  globalForDb.__pgPool = pool
}

export async function query<T = Record<string, unknown>>(
  text: string,
  params?: unknown[],
): Promise<T[]> {
  const res = await pool.query(text, params)
  return res.rows as T[]
}
