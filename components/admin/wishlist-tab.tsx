"use client"

import { useState, useTransition } from "react"
import { Plus, Trash2, Loader2, Star } from "lucide-react"
import { toast } from "sonner"
import { addWishlist, deleteWishlist, type WishlistRow } from "@/app/actions/admin"

export function WishlistTab({ wishlist }: { wishlist: WishlistRow[] }) {
  const [address, setAddress] = useState("")
  const [label, setLabel] = useState("")
  const [pending, startTransition] = useTransition()

  function handleAdd() {
    if (!address.includes("@")) {
      toast.error("Enter a valid email")
      return
    }
    startTransition(async () => {
      try {
        await addWishlist(address, label)
        toast.success("Added to wishlist")
        setAddress("")
        setLabel("")
      } catch {
        toast.error("Failed to add")
      }
    })
  }

  function handleDelete(id: number) {
    startTransition(async () => {
      try {
        await deleteWishlist(id)
        toast.success("Removed")
      } catch {
        toast.error("Failed to remove")
      }
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Wishlist</h1>
        <p className="text-sm text-muted-foreground">
          Emails unlocked for everyone (e.g. product emails clients can access). {wishlist.length} entries.
        </p>
      </div>

      {/* Add */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="grid gap-3 sm:grid-cols-[2fr_1fr_auto] sm:items-end">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Email address</label>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="product@gmail.com"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Label (optional)</label>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Product XYZ"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <button
            onClick={handleAdd}
            disabled={pending}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Add
          </button>
        </div>
      </div>

      {/* List */}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Address</th>
                <th className="px-4 py-3 font-medium">Label</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {wishlist.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-10 text-center text-muted-foreground">
                    No unlocked emails yet.
                  </td>
                </tr>
              ) : (
                wishlist.map((w) => (
                  <tr key={w.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-2 font-medium">
                        <Star className="h-3.5 w-3.5 text-amber-400" />
                        {w.address}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{w.label ?? "—"}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleDelete(w.id)}
                        disabled={pending}
                        className="rounded-md p-1.5 text-destructive hover:bg-destructive/10 disabled:opacity-50"
                        aria-label="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
