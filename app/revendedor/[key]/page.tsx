import { notFound, redirect } from "next/navigation"
import { getResellerPageByKey } from "@/app/actions/reseller"

export const dynamic = "force-dynamic"

// A pagina Infinity agora tem URL propria e curta: /infinity. O link antigo
// continua funcionando, mas redireciona para a nova URL.
const INFINITY_LEGACY_KEY = "infinitysuko-470546623112"

export const metadata = {
  title: "Revendedor — SuKo Shop",
  robots: { index: false, follow: false },
}

export default async function ResellerRoute({
  params,
}: {
  params: Promise<{ key: string }>
}) {
  const { key } = await params
  if (key.toLowerCase() === INFINITY_LEGACY_KEY) {
    redirect("/pt/infinity")
  }
  // Link antigo: resolve a pagina e redireciona para a URL limpa /pt/{slug}.
  const page = await getResellerPageByKey(key)
  if (!page) notFound()
  redirect(`/pt/${page.key}`)
}
