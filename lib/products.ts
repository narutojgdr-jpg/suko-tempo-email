// Plataformas suportadas na aba de Produtos do perfil.
// Slugs estaveis (usados no banco de dados) — nao renomear sem migracao.

export const PRODUCT_SLUGS = ["chatgpt", "grok", "capcut", "lovable", "claude"] as const
export type ProductSlug = (typeof PRODUCT_SLUGS)[number]

export const PRODUCT_SET = new Set<string>(PRODUCT_SLUGS)

// Uma conta salva dentro de um produto (o "card").
export type ProductAccount = {
  id: number
  product: ProductSlug
  email: string
  password: string
  twofa: string
  recovery: string
  position: number
  createdAt: string
}

// Metadados de exibicao (nome e cor de destaque) de cada produto.
export const PRODUCT_META: Record<ProductSlug, { label: string; accent: string }> = {
  chatgpt: { label: "ChatGPT", accent: "#10a37f" },
  grok: { label: "Grok", accent: "#1d9bf0" },
  capcut: { label: "CapCut", accent: "#f02f68" },
  lovable: { label: "Lovable", accent: "#fb6a3c" },
  claude: { label: "Claude", accent: "#d97757" },
}

// Template padrao da "entrega personalizada". Variaveis suportadas:
// {email} {senha} {2fa} {codigo} {recuperacao}
export const DEFAULT_TEMPLATE = [
  "Email: {email}",
  "Senha: {senha}",
  "2FA (chave): {2fa}",
  "Codigo 2FA: {codigo}",
  "Email de recuperacao: {recuperacao}",
].join("\n")

// Formatos da ferramenta "Organizar".
export const ORGANIZE_FORMATS = ["linha", "bloco"] as const
export type OrganizeFormat = (typeof ORGANIZE_FORMATS)[number]

/** Preenche um template substituindo as variaveis pelos dados da conta. */
export function fillTemplate(
  template: string,
  data: { email: string; password: string; twofa: string; recovery: string; code?: string },
): string {
  return template
    .replace(/\{email\}/g, data.email || "")
    .replace(/\{senha\}/g, data.password || "")
    .replace(/\{2fa\}/g, data.twofa || "")
    .replace(/\{codigo\}/g, data.code || "")
    .replace(/\{recuperacao\}/g, data.recovery || "")
}
