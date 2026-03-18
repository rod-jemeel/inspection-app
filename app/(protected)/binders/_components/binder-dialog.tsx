"use client";

import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  BINDER_ICON_OPTIONS,
  getBinderIconOption,
} from "@/components/binder-icon";

interface Binder {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  icon: string | null;
}

interface BinderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  binder: Binder | null;
  locationId: string;
  onSuccess: () => void;
}

const PRESET_COLORS = [
  { name: "Blue", value: "#3B82F6" },
  { name: "Green", value: "#10B981" },
  { name: "Amber", value: "#F59E0B" },
  { name: "Purple", value: "#8B5CF6" },
  { name: "Pink", value: "#EC4899" },
  { name: "Cyan", value: "#06B6D4" },
  { name: "Orange", value: "#F97316" },
  { name: "Red", value: "#EF4444" },
];

export function BinderDialog({
  open,
  onOpenChange,
  binder,
  locationId,
  onSuccess,
}: BinderDialogProps) {
  const isEdit = binder !== null;
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: binder?.name || "",
    description: binder?.description || "",
    color: binder?.color || PRESET_COLORS[0].value,
    icon: binder?.icon || BINDER_ICON_OPTIONS[0].value,
  });

  const selectedIcon = getBinderIconOption(formData.icon);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const url = isEdit
        ? `/api/locations/${locationId}/binders/${binder.id}`
        : `/api/locations/${locationId}/binders`;
      const method = isEdit ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to save binder");
      }

      toast.success(isEdit ? "Binder updated" : "Binder created");
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save binder",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Binder" : "Create Binder"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder="e.g., Safety Inspection"
              required
              className="h-8 text-xs"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="Optional description"
              rows={3}
              className="text-xs"
            />
          </div>

          {/* Color */}
          <div className="space-y-2">
            <Label>Color</Label>
            <div className="grid grid-cols-8 gap-2">
              {PRESET_COLORS.map((color) => (
                <button
                  key={color.value}
                  type="button"
                  aria-label={color.name}
                  aria-pressed={formData.color === color.value}
                  onClick={() =>
                    setFormData({ ...formData, color: color.value })
                  }
                  className={cn(
                    "h-8 w-8 rounded-md border-2 transition-all",
                    formData.color === color.value
                      ? "border-foreground scale-110"
                      : "border-transparent hover:scale-105",
                  )}
                  style={{ backgroundColor: color.value }}
                />
              ))}
            </div>
          </div>

          {/* Icon */}
          <div className="space-y-2">
            <Label>Icon</Label>
            <div className="rounded-md border border-border/80 bg-muted/30 p-3">
              <div className="mb-3 flex items-center gap-3 rounded-md border border-border/70 bg-card px-3 py-2">
                <div
                  className="flex size-10 items-center justify-center rounded-md"
                  style={{ backgroundColor: `${formData.color}20` }}
                >
                  <selectedIcon.Icon
                    className="size-5"
                    aria-hidden="true"
                    style={{ color: formData.color }}
                  />
                </div>
                <div>
                  <p className="text-xs font-medium">{selectedIcon.label}</p>
                  <p className="text-[11px] text-muted-foreground">
                    Current binder icon
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {BINDER_ICON_OPTIONS.map((icon) => (
                  <button
                    key={icon.value}
                    type="button"
                    aria-label={icon.label}
                    aria-pressed={formData.icon === icon.value}
                    onClick={() =>
                      setFormData({ ...formData, icon: icon.value })
                    }
                    className={cn(
                      "relative flex min-h-20 flex-col items-center justify-center gap-2 rounded-md border-2 px-2 py-3 text-center transition-all",
                      formData.icon === icon.value
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-border bg-card hover:bg-muted/50",
                    )}
                  >
                    <div
                      className="flex size-9 items-center justify-center rounded-md"
                      style={{ backgroundColor: `${formData.color}20` }}
                    >
                      <icon.Icon
                        className="size-4"
                        aria-hidden="true"
                        style={{ color: formData.color }}
                      />
                    </div>
                    <span className="text-[11px] font-medium leading-tight">
                      {icon.label}
                    </span>
                    {formData.icon === icon.value ? (
                      <Check className="absolute right-2 top-2 size-3.5 text-primary" aria-hidden="true" />
                    ) : null}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="h-8 text-xs"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="h-8 text-xs">
              {loading && <Loader2 className="mr-2 size-3.5 animate-spin" />}
              {isEdit ? "Save Changes" : "Create Binder"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
