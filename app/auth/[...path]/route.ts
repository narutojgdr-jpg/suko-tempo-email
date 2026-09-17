/**
 * OAuth callback handler at /auth/[...path]
 *
 * The Neon Auth SDK processes the Google OAuth callback at /auth/callback —
 * NOT /api/auth/callback. This route delegates directly to the same
 * auth.handler() so the callback reaches the right place.
 */
import { auth } from "@/lib/auth/server"

const handlers = auth.handler()

export const { GET, POST, PUT, DELETE, PATCH } = handlers
