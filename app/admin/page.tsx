import { redirect } from "next/navigation"
import { isAdmin } from "@/lib/admin"
import {
  listAccounts,
  listGmails,
  listWishlist,
  listTransactions,
  getDashboardStats,
  getStorageUsage,
} from "@/app/actions/admin"
import { listResellerPages } from "@/app/actions/reseller"
import { listSpotifyAccounts } from "@/app/actions/spotify"
import { AdminPanel } from "@/components/admin/admin-panel"

export const metadata = {
  title: "Admin — SuKo Shop",
  robots: { index: false, follow: false },
}

export default async function AdminPage() {
  if (!(await isAdmin())) {
    redirect("/")
  }

  const [stats, accounts, gmails, wishlist, transactions, usage, resellerPages, spotifyAccounts] =
    await Promise.all([
      getDashboardStats(),
      listAccounts(),
      listGmails(),
      listWishlist(),
      listTransactions(),
      getStorageUsage(),
      listResellerPages(),
      listSpotifyAccounts(),
    ])

  return (
    <AdminPanel
      stats={stats}
      accounts={accounts}
      gmails={gmails}
      wishlist={wishlist}
      transactions={transactions}
      usage={usage}
      resellerPages={resellerPages}
      spotifyAccounts={spotifyAccounts}
    />
  )
}
