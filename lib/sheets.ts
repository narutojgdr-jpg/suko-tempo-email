import { google } from "googleapis"

const SPREADSHEET_ID = "1cjOIGfxHlYdUlPOIldXhdiULaF6sKaVbYt5rg8RLZH4"
const SHEET_NAME = "Sheet1"

function getAuth() {
  const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n")
  if (!key || !process.env.GOOGLE_CLIENT_EMAIL) return null
  return new google.auth.JWT({
    email: process.env.GOOGLE_CLIENT_EMAIL,
    key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  })
}

function gmailKey(email: string) {
  const lower = email.toLowerCase()
  const at = lower.lastIndexOf("@")
  if (at < 1) return lower.replace(/\s+/g, "")
  const local = lower.slice(0, at).replace(/\./g, "").replace(/\s+/g, "")
  const domain = lower.slice(at + 1).replace(/\s+/g, "")
  return local + "@" + domain
}

export async function updateSheetStatus(gmail: string, status: string) {
  const auth = getAuth()
  if (!auth || !gmail) return
  try {
    const sheets = google.sheets({ version: "v4", auth })
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:A`,
    })
    const rows = res.data.values || []
    const needle = gmailKey(gmail)
    const upper = status.toUpperCase()
    for (let i = 0; i < rows.length; i++) {
      const cell = String(rows[i]?.[0] || "")
      const match = cell.match(/[a-z0-9.+]+@[a-z0-9.]+/gi)
      if (!match) continue
      for (const found of match) {
        if (gmailKey(found) === needle) {
          await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEET_NAME}!E${i + 1}`,
            valueInputOption: "RAW",
            requestBody: { values: [[upper]] },
          })
          console.log("[sheets] updated row", i + 1, upper)
          return
        }
      }
    }
    console.log("[sheets] gmail not found", gmail, needle)
  } catch (e) {
    console.error("[sheets] update fail", e)
  }
}
