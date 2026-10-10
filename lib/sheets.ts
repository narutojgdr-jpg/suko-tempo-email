import { google } from "googleapis"

const SPREADSHEET_ID = "1cjOIGfxHlYdUlPOIldXhdiULaF6sKaVbYt5rg8RLZH4"

function getAuth() {
  const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n")
  if (!key || !process.env.GOOGLE_CLIENT_EMAIL) return null
  return new google.auth.JWT({
    email: process.env.GOOGLE_CLIENT_EMAIL,
    key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  })
}

function clean(s: string) {
  return s.toLowerCase().replace(/\s+/g, "")
}

async function getSheetName(sheets: any): Promise<string> {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID })
  const title = meta.data.sheets?.[0]?.properties?.title
  return title || "Sheet1"
}

export async function updateSheetStatus(gmail: string, status: string) {
  const auth = getAuth()
  if (!auth || !gmail) return
  try {
    const sheets = google.sheets({ version: "v4", auth })
    const sheetName = await getSheetName(sheets)
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${sheetName}'!A:A`,
    })
    const rows = res.data.values || []
    const needle = clean(gmail)
    const upper = status.toUpperCase()
    for (let i = 0; i < rows.length; i++) {
      const cell = String(rows[i]?.[0] || "")
      const emails = cell.match(/[a-z0-9.+_-]+@[a-z0-9.-]+/gi) || []
      for (const found of emails) {
        if (clean(found) === needle) {
          await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `'${sheetName}'!E${i + 1}`,
            valueInputOption: "RAW",
            requestBody: { values: [[upper]] },
          })
          console.log("[sheets] updated row", i + 1, upper, "sheet", sheetName)
          return
        }
      }
    }
    console.log("[sheets] gmail not found", gmail, "sheet", sheetName)
  } catch (e) {
    console.error("[sheets] update fail", e)
  }
}
