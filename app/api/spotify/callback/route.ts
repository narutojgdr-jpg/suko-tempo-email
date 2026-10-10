import { NextRequest, NextResponse } from "next/server"
import { saveSpotifyToken, upsertSpotifyByEmail } from "@/app/actions/spotify"

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || ""
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || ""
const REDIRECT = "https://tempmailsuko.shop/api/spotify/callback"
const APPS = "https://www.spotify.com/br-pt/account/apps/"

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code")
  const state = req.nextUrl.searchParams.get("state")
  const error = req.nextUrl.searchParams.get("error")

  if (error || !code) {
    return NextResponse.redirect(APPS)
  }

  const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT,
    }),
  })

  if (!tokenRes.ok) {
    return NextResponse.redirect(APPS)
  }

  const data = (await tokenRes.json()) as { refresh_token?: string; access_token?: string }
  if (!data.refresh_token || !data.access_token) {
    return NextResponse.redirect(APPS)
  }

  const accountId = state ? Number(state) : 0
  if (accountId) {
    await saveSpotifyToken(accountId, data.refresh_token)
    return NextResponse.redirect(APPS)
  }

  const meRes = await fetch("https://api.spotify.com/v1/me", {
    headers: { Authorization: `Bearer ${data.access_token}` },
  })
  if (!meRes.ok) {
    return NextResponse.redirect(APPS)
  }
  const me = (await meRes.json()) as { email?: string; product?: string }
  if (!me.email) {
    return NextResponse.redirect(APPS)
  }

  await upsertSpotifyByEmail(me.email, data.refresh_token, me.product)
  return NextResponse.redirect(APPS)
}
