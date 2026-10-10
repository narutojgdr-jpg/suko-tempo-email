import { NextRequest, NextResponse } from "next/server"
import { saveSpotifyToken } from "@/app/actions/spotify"

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || ""
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || ""
const REDIRECT = "https://tempmailsuko.shop/api/spotify/callback"

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code")
  const state = req.nextUrl.searchParams.get("state")
  const error = req.nextUrl.searchParams.get("error")

  if (error || !code || !state) {
    return NextResponse.redirect(new URL("/admin?spotify=erro", req.url))
  }

  const accountId = Number(state)
  if (!accountId) {
    return NextResponse.redirect(new URL("/admin?spotify=erro", req.url))
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
    return NextResponse.redirect(new URL("/admin?spotify=erro", req.url))
  }

  const data = (await tokenRes.json()) as { refresh_token?: string }
  if (!data.refresh_token) {
    return NextResponse.redirect(new URL("/admin?spotify=erro", req.url))
  }

  await saveSpotifyToken(accountId, data.refresh_token)
  return NextResponse.redirect(new URL("/admin?spotify=ok", req.url))
}
