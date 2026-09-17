/** Formats a USD amount stored in integer cents, e.g. 1234 -> "$12.34". */
export function formatUsd(cents: number): string {
  const dollars = (cents ?? 0) / 100
  return dollars.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  })
}

/** Formats a byte count into a human-readable size, e.g. 31883264 -> "30.4 MB". */
export function formatBytes(bytes: number): string {
  if (!bytes || bytes < 1024) return `${bytes || 0} B`
  const units = ["KB", "MB", "GB", "TB"]
  let value = bytes / 1024
  let i = 0
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024
    i++
  }
  return `${value.toFixed(value >= 100 ? 0 : 1)} ${units[i]}`
}

/** Parses a user-typed dollar string (e.g. "12.50") into integer cents. */
export function parseUsdToCents(input: string): number {
  const n = Number.parseFloat(input.replace(/[^0-9.-]/g, ""))
  if (Number.isNaN(n)) return 0
  return Math.round(n * 100)
}
