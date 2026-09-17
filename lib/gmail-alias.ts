/**
 * Gerador de aliases de Gmail.
 *
 * O Gmail ignora pontos (".") no nome de usuario e tudo que vem depois de "+".
 * Entao todos os aliases gerados a partir de um gmail caem na MESMA caixa de
 * entrada do gmail base. Ex.: a partir de "m01067793442@gmail.com" geramos
 * algo como "m0.106.77.93.44.2+347348@gmail.com".
 */

/** Remove pontos e qualquer sufixo "+..." para obter o nome canonico. */
function canonicalLocal(local: string): string {
  const noPlus = local.split("+")[0]
  return noPlus.replace(/\./g, "")
}

/** Insere pontos aleatorios entre os caracteres (nunca no inicio/fim ou duplicados). */
function withRandomDots(base: string): string {
  let out = base[0] ?? ""
  for (let i = 1; i < base.length; i++) {
    // ~45% de chance de inserir um ponto antes do proximo caractere
    if (Math.random() < 0.45) out += "."
    out += base[i]
  }
  return out
}

/** Gera um sufixo "+<digitos>" com 4 a 7 numeros aleatorios. */
function randomPlusTag(): string {
  const len = 4 + Math.floor(Math.random() * 4) // 4..7
  let digits = ""
  for (let i = 0; i < len; i++) digits += Math.floor(Math.random() * 10)
  return `+${digits}`
}

/**
 * Gera `count` aliases unicos a partir de um gmail completo.
 * Retorna um array de enderecos no formato "nome.com.pontos+tag@dominio".
 */
export function generateGmailAliases(fullGmail: string, count: number): string[] {
  const clean = fullGmail.trim().toLowerCase()
  const at = clean.indexOf("@")
  if (at < 1) return []

  const domain = clean.slice(at + 1)
  const base = canonicalLocal(clean.slice(0, at))
  if (!base || !domain.includes(".")) return []

  const target = Math.max(1, Math.min(count, 500))
  const result = new Set<string>()
  let attempts = 0
  const maxAttempts = target * 40

  while (result.size < target && attempts < maxAttempts) {
    attempts++
    const local = withRandomDots(base) + randomPlusTag()
    result.add(`${local}@${domain}`)
  }

  return Array.from(result)
}
