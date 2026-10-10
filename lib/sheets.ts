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
    const needle = gmail.toLowerCase()
    for (let i = 0; i < rows.length; i++) {
      const cell = String(rows[i]?.[0] || "").toLowerCase()
      if (cell.includes(needle)) {
        await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SHEET_NAME}!E${i + 1}`,
          valueInputOption: "RAW",
          requestBody: { values: [[status]] },
        })
        return
      }
    }
  } catch (e) {
    console.error("[sheets] update fail", e)
  }
}
