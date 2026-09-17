"use client"

import { createAuthClient } from "@neondatabase/auth/next"

/**
 * Client-side auth instance. It talks to our own `/api/auth/[...path]` route,
 * which proxies to the Neon Auth server, so no base URL is required here.
 */
export const authClient = createAuthClient()
