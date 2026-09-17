import { auth } from "@/lib/auth/server"

const handlers = auth.handler()

/**
 * Google-only enforcement.
 *
 * The product requires social login (Google) exclusively to prevent users from
 * spinning up unlimited accounts with arbitrary typed emails. Even though the UI
 * never exposes an email/password form, we also block the underlying Better Auth
 * credential endpoints at the API layer so they can't be hit directly.
 */
const BLOCKED_ENDPOINTS = [
  "sign-in/email",
  "sign-up/email",
  "forget-password",
  "reset-password",
  "change-password",
  "change-email",
]

function isBlocked(req: Request): boolean {
  const path = new URL(req.url).pathname.replace(/^\/api\/auth\//, "").replace(/\/$/, "")
  return BLOCKED_ENDPOINTS.includes(path)
}

function blockedResponse(): Response {
  return new Response(
    JSON.stringify({ error: "Email/password authentication is disabled. Use Google sign-in." }),
    { status: 403, headers: { "content-type": "application/json" } },
  )
}

export async function POST(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  if (isBlocked(req)) return blockedResponse()
  return handlers.POST(req, ctx)
}

export const { GET, PUT, DELETE, PATCH } = handlers
