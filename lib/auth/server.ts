import { createNeonAuth } from "@neondatabase/auth/next/server"

/**
 * Neon Auth (managed Better Auth) server instance.
 *
 * - `baseUrl` points at the Neon-hosted auth server (NEON_AUTH_BASE_URL is
 *   provided automatically by the Neon integration).
 * - `cookies.secret` signs the local session-cache cookie (NEON_AUTH_COOKIE_SECRET,
 *   must be 32+ chars).
 *
 * sameSite "none" is required in ALL environments because the OAuth callback
 * redirect comes from an external domain (Neon / Google). With "lax" or
 * "strict" the browser silently drops the cookie on the cross-site redirect
 * and the user always appears logged out even after a successful OAuth flow.
 * Browsers only accept sameSite=none on HTTPS (Secure flag), which is always
 * the case on Vercel deployments and on localhost via the v0 preview.
 */
// During `next build` the env vars aren't injected yet — provide a placeholder
// so the module can be evaluated. Requests at runtime will always have the real
// values available through the Render / Vercel environment.
export const auth = createNeonAuth({
  baseUrl: process.env.NEON_AUTH_BASE_URL ?? "https://placeholder.neonauth.example.com/auth",
  cookies: {
    secret: process.env.NEON_AUTH_COOKIE_SECRET ?? "build-time-placeholder-secret-32chars!!",
    sameSite: "none" as const,
  },
})
