"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Loader2,
  ChevronRight,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { getBinderIconOption } from "@/components/binder-icon";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuAction,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Binder {
  id: string;
  name: string;
  color: string | null;
  icon: string | null;
}

interface NavBindersProps {
  binders: Binder[];
  locationId: string | null;
  isAdmin?: boolean;
}

export function NavBinders({ binders, locationId, isAdmin }: NavBindersProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [deletingBinder, setDeletingBinder] = useState<Binder | null>(null);
  const [confirmName, setConfirmName] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!deletingBinder || !locationId) return;
    setIsDeleting(true);
    try {
      const res = await fetch(
        `/api/locations/${locationId}/binders/${deletingBinder.id}`,
        { method: "DELETE" },
      );
      if (!res.ok) throw new Error("Failed to delete binder");
      toast.success(`Binder "${deletingBinder.name}" deleted`);
      setDeletingBinder(null);
      setConfirmName("");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <Collapsible defaultOpen className="group/binders">
        <SidebarGroup>
          <SidebarGroupLabel
            className="flex items-center justify-between"
            asChild
          >
            <div>
              <CollapsibleTrigger className="flex items-center gap-1 [&[data-state=open]>svg]:rotate-90">
                <ChevronRight className="size-3 transition-transform" />
                <span>Binders</span>
              </CollapsibleTrigger>
              {isAdmin && (
                <button
                  onClick={() => router.push(`/binders?loc=${locationId}`)}
                  aria-label="Manage binders"
                  className="flex size-5 items-center justify-center rounded-md text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                >
                  <Plus className="size-3.5" aria-hidden="true" />
                </button>
              )}
            </div>
          </SidebarGroupLabel>
          <CollapsibleContent>
            <SidebarMenu>
              {binders.length === 0 && (
                <SidebarMenuItem>
                  <div className="flex items-center gap-2 px-2 py-2 text-sidebar-foreground/50">
                    <Info className="size-3.5 shrink-0" />
                    <span className="text-xs">
                      {isAdmin ? "No binders yet" : "No binders assigned"}
                    </span>
                  </div>
                </SidebarMenuItem>
              )}
              {binders.map((binder) => {
                const binderIcon = getBinderIconOption(binder.icon);
                const binderPath = `/binders/${binder.id}`;
                const href = locationId
                  ? `${binderPath}?loc=${locationId}`
                  : binderPath;
                const isActive = pathname.startsWith(binderPath);

                return (
                  <SidebarMenuItem key={binder.id}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={binder.name}
                    >
                      <Link href={href}>
                        <span
                          className="flex size-5 shrink-0 items-center justify-center rounded-md ring-1 ring-sidebar-border/60"
                          style={{
                            backgroundColor: binder.color
                              ? `${binder.color}22`
                              : undefined,
                            color: binder.color ?? undefined,
                          }}
                        >
                          <binderIcon.Icon className="size-3.5" />
                        </span>
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
                        <DropdownMenuItem onClick={() => router.push(href)}>
                          <Pencil className="mr-2 size-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => {
                            setDeletingBinder(binder);
                            setConfirmName("");
                          }}
                        >
                          <Trash2 className="mr-2 size-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </CollapsibleContent>
        </SidebarGroup>
      </Collapsible>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deletingBinder}
        onOpenChange={(open) => {
          if (!open) {
            setDeletingBinder(null);
            setConfirmName("");
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
                setDeletingBinder(null);
                setConfirmName("");
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
  );
}
