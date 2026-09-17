import type { Metadata } from "next"
import { headers } from "next/headers"
import { ApiDocs } from "@/components/api-docs"

export const metadata: Metadata = {
  title: "API de E-mails SuKo — Documentação",
  description:
    "Documentação da API REST para ler caixas de Gmail/Outlook, gerar endereços e pegar códigos de verificação.",
}

export default async function ApiDocsPage() {
  const h = await headers()
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000"
  const proto = h.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https")
  const baseUrl = `${proto}://${host}`

  return (
    <div className="min-h-screen bg-background">
      <ApiDocs baseUrl={baseUrl} />
    </div>
  )
}
