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
import { AdminPanel } from "@/components/admin/admin-panel"

export const metadata = {
  title: "Admin — SuKo Shop",
  robots: { index: false, follow: false },
}

export default async function AdminPage() {
  // Hard gate: only the admin Google account gets in. Everyone else is
  // bounced to the home page and never sees any admin data.
  if (!(await isAdmin())) {
    redirect("/")
  }

  const [stats, accounts, gmails, wishlist, transactions, usage, resellerPages] = await Promise.all([
    getDashboardStats(),
    listAccounts(),
    listGmails(),
    listWishlist(),
    listTransactions(),
    getStorageUsage(),
    listResellerPages(),
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
    />
  )
}
