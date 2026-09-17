// Gerador de codigo TOTP (RFC 6238) no cliente, usando Web Crypto.
// Aceita a chave secreta em Base32 (formato padrao das chaves 2FA).

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"

/** Decodifica uma string Base32 (RFC 4648) para bytes. Ignora espacos e padding. */
function base32Decode(input: string): Uint8Array | null {
  const clean = input.toUpperCase().replace(/=+$/, "").replace(/\s+/g, "")
  if (!clean) return null

  let bits = 0
  let value = 0
  const out: number[] = []

  for (const char of clean) {
    const idx = BASE32_ALPHABET.indexOf(char)
    if (idx === -1) return null // caractere invalido
    value = (value << 5) | idx
    bits += 5
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff)
      bits -= 8
    }
  }
  return new Uint8Array(out)
}

/**
 * Gera o codigo TOTP de 6 digitos para a chave informada.
 * Retorna null se a chave for invalida.
 */
export async function generateTotp(
  secret: string,
  period = 30,
  digits = 6,
  atMs: number = Date.now(),
): Promise<string | null> {
  try {
    const key = base32Decode(secret)
    if (!key || key.length === 0) return null

    const counter = Math.floor(atMs / 1000 / period)

    // Contador em 8 bytes big-endian
    const counterBytes = new Uint8Array(8)
    let temp = counter
    for (let i = 7; i >= 0; i--) {
      counterBytes[i] = temp & 0xff
      temp = Math.floor(temp / 256)
    }

    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      key,
      { name: "HMAC", hash: "SHA-1" },
      false,
      ["sign"],
    )
    const hmac = new Uint8Array(await crypto.subtle.sign("HMAC", cryptoKey, counterBytes))

    const offset = hmac[hmac.length - 1] & 0x0f
    const binary =
      ((hmac[offset] & 0x7f) << 24) |
      ((hmac[offset + 1] & 0xff) << 16) |
      ((hmac[offset + 2] & 0xff) << 8) |
      (hmac[offset + 3] & 0xff)

    const code = (binary % 10 ** digits).toString().padStart(digits, "0")
    return code
  } catch {
    return null
  }
}

/** Segundos restantes ate o codigo TOTP atual expirar. */
export function totpSecondsRemaining(period = 30, atMs: number = Date.now()): number {
  return period - (Math.floor(atMs / 1000) % period)
}
