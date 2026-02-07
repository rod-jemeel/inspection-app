"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { FolderOpen, Plus, MoreHorizontal, Pencil, Trash2, Loader2 } from "lucide-react"
import { toast } from "sonner"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuAction,
} from "@/components/ui/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface Binder {
  id: string
  name: string
  color: string | null
}

interface NavBindersProps {
  binders: Binder[]
  locationId: string | null
}

export function NavBinders({ binders, locationId }: NavBindersProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [deletingBinder, setDeletingBinder] = useState<Binder | null>(null)
  const [confirmName, setConfirmName] = useState("")
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    if (!deletingBinder || !locationId) return
    setIsDeleting(true)
    try {
      const res = await fetch(
        `/api/locations/${locationId}/binders/${deletingBinder.id}`,
        { method: "DELETE" }
      )
      if (!res.ok) throw new Error("Failed to delete binder")
      toast.success(`Binder "${deletingBinder.name}" deleted`)
      setDeletingBinder(null)
      setConfirmName("")
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete")
    } finally {
      setIsDeleting(false)
    }
  }

  if (binders.length === 0) return null

  return (
    <>
      <SidebarGroup>
        <SidebarGroupLabel className="flex items-center justify-between">
          <span>Binders</span>
          <button
            onClick={() => router.push(`/binders?loc=${locationId}`)}
            className="flex size-5 items-center justify-center rounded-md text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
            title="Manage binders"
          >
            <Plus className="size-3.5" />
          </button>
        </SidebarGroupLabel>
        <SidebarMenu>
          {binders.map((binder) => {
            const binderPath = `/binders/${binder.id}`
            const href = locationId
              ? `${binderPath}?loc=${locationId}`
              : binderPath
            const isActive = pathname.startsWith(binderPath)

            return (
              <SidebarMenuItem key={binder.id}>
                <SidebarMenuButton
                  asChild
                  isActive={isActive}
                  tooltip={binder.name}
                >
                  <Link href={href}>
                    {binder.color ? (
                      <span
                        className="inline-block size-3 shrink-0 rounded-full"
                        style={{ backgroundColor: binder.color }}
                      />
                    ) : (
                      <FolderOpen className="size-4" />
                    )}
                    <span className="truncate">{binder.name}</span>
                  </Link>
                </SidebarMenuButton>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <SidebarMenuAction>
                      <MoreHorizontal className="size-4" />
                    </SidebarMenuAction>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent side="right" align="start">
                    <DropdownMenuItem
                      onClick={() => router.push(href)}
                    >
                      <Pencil className="mr-2 size-4" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => {
                        setDeletingBinder(binder)
                        setConfirmName("")
                      }}
                    >
                      <Trash2 className="mr-2 size-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarGroup>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deletingBinder}
        onOpenChange={(open) => {
          if (!open) {
            setDeletingBinder(null)
            setConfirmName("")
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Binder</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span>
                This will deactivate the binder and hide it from all users.
              </span>
              <span className="block">
                Type <strong>{deletingBinder?.name}</strong> to confirm.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={confirmName}
            onChange={(e) => setConfirmName(e.target.value)}
            placeholder={`Type "${deletingBinder?.name}" to confirm`}
            className="text-sm"
          />
          <AlertDialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeletingBinder(null)
                setConfirmName("")
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={confirmName !== deletingBinder?.name || isDeleting}
              onClick={handleDelete}
            >
              {isDeleting ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 size-4" />
              )}
              Delete Binder
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
