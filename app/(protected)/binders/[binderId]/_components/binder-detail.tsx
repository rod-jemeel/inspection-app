"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { parseAsString, useQueryState } from "nuqs";
import {
  Plus,
  Search,
  FileText,
  Settings,
  ClipboardCheck,
  Calendar,
  User,
  Pencil,
  Trash2,
  Users2,
  ListChecks,
} from "lucide-react";
import { getBinderIconOption } from "@/components/binder-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ResponseList } from "./response-list";
import { FormTemplateDialog } from "./form-template-dialog";
import { BinderDialog } from "../../_components/binder-dialog";
import { BinderAssignmentsTab } from "./binder-assignments-tab";
import { toast } from "sonner";

interface FormTemplate {
  id: string;
  binder_id: string;
  name: string;
  description: string | null;
  instructions: string | null;
  frequency: string | null;
  sort_order: number;
  active: boolean;
  google_sheet_id: string | null;
  google_sheet_tab: string | null;
}

interface Binder {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  icon: string | null;
}

interface BinderDetailProps {
  binder: Binder;
  templates: FormTemplate[];
  locationId: string;
  canEdit: boolean;
  profileId: string;
}

const frequencyColors: Record<string, string> = {
  daily: "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400",
  weekly: "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400",
  monthly:
    "bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-400",
  quarterly:
    "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400",
  annual:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400",
  yearly:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400",
  every_3_years:
    "bg-teal-100 text-teal-700 dark:bg-teal-950/50 dark:text-teal-400",
  as_needed: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
};

const frequencyLabels: Record<string, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  annual: "Annual",
  yearly: "Yearly",
  every_3_years: "Every 3 Years",
  as_needed: "As Needed",
  other: "Other",
};

const statusColors: Record<string, string> = {
  pending: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
  in_progress:
    "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400",
  failed: "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400",
  passed:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400",
};

const statusLabels: Record<string, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  failed: "Failed",
  passed: "Passed",
};

interface InspectionInstance {
  id: string;
  template_id: string;
  location_id: string;
  due_at: string;
  status: string;
  template_frequency?: string | null;
  assigned_to_profile_id: string | null;
  template_task?: string;
  assignee_name?: string | null;
}


function InspectionsTab({
  binderId,
  locationId,
}: {
  binderId: string;
  locationId: string;
}) {
  const router = useRouter();
  const [instances, setInstances] = useState<InspectionInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [freqFilter, setFreqFilter] = useState<string>("all");

  useEffect(() => {
    const fetchInstances = async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/locations/${locationId}/instances?binder_id=${binderId}`,
        );
        if (res.ok) {
          const result = await res.json();
          setInstances(result.data || []);
        }
      } catch (error) {
        console.error("Failed to fetch instances:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchInstances();
  }, [binderId, locationId]);

  // Derive the set of frequencies that actually appear in the data
  const availableFreqs = useMemo(() => {
    const freqs = new Set<string>();
    instances.forEach((i) => { if (i.template_frequency) freqs.add(i.template_frequency); });
    return Array.from(freqs).sort();
  }, [instances]);

  const grouped = useMemo(() => {
    const toGroup = freqFilter === "all"
      ? instances
      : instances.filter((i) => i.template_frequency === freqFilter);

    if (freqFilter !== "all") return [{ freq: freqFilter, items: toGroup }];

    const map = new Map<string, InspectionInstance[]>();
    for (const i of toGroup) {
      const key = i.template_frequency || "other";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(i);
    }
    return Array.from(map.entries()).map(([freq, items]) => ({ freq, items }));
  }, [instances, freqFilter]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-xs text-muted-foreground">Loading inspections…</p>
      </div>
    );
  }

  const totalFiltered = grouped.reduce((sum, g) => sum + g.items.length, 0);

  return (
    <div className="space-y-4">
      {/* Frequency filter pills */}
      {availableFreqs.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setFreqFilter("all")}
            className={cn(
              "h-6 rounded-md border px-2.5 text-[10px] font-medium transition-colors",
              freqFilter === "all"
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-transparent text-muted-foreground hover:border-foreground/50 hover:text-foreground",
            )}
          >
            All
          </button>
          {availableFreqs.map((freq) => (
            <button
              key={freq}
              type="button"
              onClick={() => setFreqFilter(freq)}
              className={cn(
                "h-6 rounded-md border px-2.5 text-[10px] font-medium transition-colors",
                freqFilter === freq
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-transparent text-muted-foreground hover:border-foreground/50 hover:text-foreground",
              )}
            >
              {frequencyLabels[freq] || freq}
            </button>
          ))}
        </div>
      )}

      {totalFiltered > 0 ? (
        <div className="space-y-6">
          {grouped.map(({ freq, items }) => (
            <div key={freq} className="space-y-2">
              {/* Section divider with label */}
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-semibold text-foreground">
                  {frequencyLabels[freq] || freq}
                </h4>
                <span className="text-[10px] text-muted-foreground">
                  {items.length} {items.length === 1 ? "inspection" : "inspections"}
                </span>
                <div className="h-px flex-1 bg-border" />
              </div>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                {items.map((instance) => (
                  <button
                    key={instance.id}
                    type="button"
                    onClick={() =>
                      router.push(`/inspections/${instance.id}?loc=${locationId}`)
                    }
                    className="group relative flex w-full cursor-pointer flex-col gap-2 rounded-md border bg-card p-3 text-left shadow-sm transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <div className="flex items-start gap-2">
                      <ClipboardCheck className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                      <h3 className="flex-1 text-xs font-medium leading-tight">
                        {instance.template_task}
                      </h3>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant={
                          instance.status === "pending"
                            ? "outline"
                            : instance.status === "in_progress"
                              ? "secondary"
                              : instance.status === "failed"
                                ? "destructive"
                                : "default"
                        }
                        className={cn(
                          "text-[10px] font-medium",
                          statusColors[instance.status] || "bg-gray-100 text-gray-700",
                        )}
                      >
                        {statusLabels[instance.status] || instance.status}
                      </Badge>
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Calendar className="size-3" aria-hidden="true" />
                        <span>{new Intl.DateTimeFormat("en-US", { month: "numeric", day: "numeric", year: "numeric" }).format(new Date(instance.due_at))}</span>
                      </div>
                    </div>

                    {instance.assignee_name && (
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <User className="size-3" aria-hidden="true" />
                        <span>{instance.assignee_name}</span>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-md border border-dashed bg-muted/20 py-16">
          <ClipboardCheck className="mb-3 size-8 text-muted-foreground/60" aria-hidden="true" />
          <p className="mb-1 text-xs font-medium text-muted-foreground">
            {freqFilter === "all" ? "No inspections for this binder yet" : `No ${frequencyLabels[freqFilter] || freqFilter} inspections`}
          </p>
        </div>
      )}

      {instances.length > 0 && (
        <p className="text-center text-xs text-muted-foreground">
          Showing {totalFiltered} of {instances.length}{" "}
          {instances.length === 1 ? "inspection" : "inspections"}
        </p>
      )}
    </div>
  );
}

export function BinderDetail({
  binder,
  templates,
  locationId,
  canEdit,
}: BinderDetailProps) {
  const router = useRouter();
  const binderIcon = getBinderIconOption(binder.icon);
  const [activeTab, setActiveTab] = useQueryState(
    "tab",
    parseAsString.withDefault("forms"),
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<FormTemplate | null>(
    null,
  );
  const [binderDialogOpen, setBinderDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const filteredTemplates = useMemo(() => {
    if (!searchQuery.trim()) return templates;

    const query = searchQuery.toLowerCase();
    return templates.filter(
      (t) =>
        t.name.toLowerCase().includes(query) ||
        t.description?.toLowerCase().includes(query),
    );
  }, [templates, searchQuery]);

  const handleFormClick = (formId: string) => {
    router.push(`/binders/${binder.id}/forms/${formId}?loc=${locationId}`);
  };

  const handleDeleteBinder = async () => {
    setIsDeleting(true);
    try {
      const res = await fetch(
        `/api/locations/${locationId}/binders/${binder.id}`,
        {
          method: "DELETE",
        },
      );
      if (!res.ok) throw new Error("Failed to delete binder");
      toast.success("Binder deleted");
      router.push(`/binders?loc=${locationId}`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete binder",
      );
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  return (
    <div className="space-y-4">
      <header className="pb-2">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <div
              className="flex size-12 shrink-0 items-center justify-center rounded-md ring-1 ring-border/60"
              style={{
                backgroundColor: binder.color ? `${binder.color}22` : undefined,
                color: binder.color ?? undefined,
              }}
            >
              <binderIcon.Icon className="size-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg font-semibold tracking-tight">
                  {binder.name}
                </h1>
                <Badge variant="outline" className="text-[10px]">
                  Binder
                </Badge>
              </div>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
                {binder.description || "General templates and master forms"}
              </p>
            </div>
          </div>
          {canEdit && (
            <div className="flex items-center gap-2 self-start">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => setBinderDialogOpen(true)}
              >
                <Pencil className="size-3.5" />
                Edit Binder
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-destructive hover:bg-destructive/10"
                onClick={() => setDeleteDialogOpen(true)}
              >
                <Trash2 className="size-3.5" />
                Delete
              </Button>
            </div>
          )}
        </div>
      </header>

      {/* Tabs */}
      <Tabs
        value={activeTab ?? "forms"}
        onValueChange={(v) => { setActiveTab(v); setSearchQuery(""); }}
        className="space-y-4"
      >
        {/* Tab bar: tabs on left, search + action on right */}
        <div className="flex items-center gap-2">
          <div className="border-b">
            <TabsList className="h-8 shrink-0 gap-0 rounded-none bg-transparent p-0">
            {(["forms", "inspections", "responses"] as const).map((tab) => (
              <TabsTrigger
                key={tab}
                value={tab}
                className="h-8 rounded-none border-0 border-b-2 border-transparent bg-transparent px-3 text-xs font-medium text-muted-foreground shadow-none data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </TabsTrigger>
            ))}
            {canEdit && (
              <TabsTrigger
                value="assignments"
                className="h-8 rounded-none border-0 border-b-2 border-transparent bg-transparent px-3 text-xs font-medium text-muted-foreground shadow-none data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
              >
                <Users2 className="mr-1 size-3.5" aria-hidden="true" />
                Assignments
              </TabsTrigger>
            )}
          </TabsList>
          </div>

          {/* Search — only shown on searchable tabs */}
          {(activeTab === "forms" || activeTab === null) && (
            <div className="relative ml-auto w-40 sm:w-52">
              <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                aria-label="Search forms"
                placeholder="Search forms…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-8 text-xs"
              />
            </div>
          )}

          {/* New Form button */}
          {canEdit && (activeTab === "forms" || activeTab === null) && (
            <Button
              size="sm"
              className="h-8 shrink-0 gap-1.5"
              onClick={() => {
                setEditingTemplate(null);
                setDialogOpen(true);
              }}
            >
              <Plus className="size-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">New Form</span>
            </Button>
          )}

        </div>

        {/* Forms Tab Content */}
        <TabsContent value="forms" className="mt-0 space-y-4">
          {filteredTemplates.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredTemplates.map((template) => (
                <div
                  key={template.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleFormClick(template.id)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleFormClick(template.id); } }}
                  className="group relative flex cursor-pointer flex-col gap-2 rounded-md border bg-card p-3 shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  {/* Form Name */}
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="flex-1 text-xs font-medium leading-tight">
                      {template.name}
                    </h3>
                    {canEdit && (
                      <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          aria-label="Edit fields"
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(
                              `/binders/${binder.id}/forms/${template.id}/edit?loc=${locationId}`,
                            );
                          }}
                        >
                          <ListChecks className="size-3" aria-hidden="true" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          aria-label="Form settings"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingTemplate(template);
                            setDialogOpen(true);
                          }}
                        >
                          <Settings className="size-3" aria-hidden="true" />
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Description */}
                  {template.description && (
                    <p className="line-clamp-2 text-xs text-muted-foreground">
                      {template.description}
                    </p>
                  )}

                  {/* Frequency Badge */}
                  {template.frequency && (
                    <div className="mt-auto">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] font-medium",
                          frequencyColors[template.frequency] ||
                            "bg-gray-100 text-gray-700",
                        )}
                      >
                        {frequencyLabels[template.frequency] ||
                          template.frequency}
                      </Badge>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-md border border-dashed bg-muted/20 py-16">
              <FileText className="mb-3 size-8 text-muted-foreground/60" aria-hidden="true" />
              <p className="mb-1 text-xs font-medium text-muted-foreground">
                {searchQuery ? "No forms found" : "No forms in this binder yet"}
              </p>
              {!searchQuery && canEdit && (
                <p className="text-xs text-muted-foreground">
                  Create your first form to get started
                </p>
              )}
            </div>
          )}

          {/* Results count */}
          {templates.length > 0 && (
            <p className="text-center text-xs text-muted-foreground">
              Showing {filteredTemplates.length} of {templates.length}{" "}
              {templates.length === 1 ? "form" : "forms"}
            </p>
          )}
        </TabsContent>

        {/* Inspections Tab Content */}
        <TabsContent value="inspections" className="mt-0">
          <InspectionsTab binderId={binder.id} locationId={locationId} />
        </TabsContent>

        {/* Responses Tab Content */}
        <TabsContent value="responses" className="mt-0">
          <ResponseList binderId={binder.id} locationId={locationId} />
        </TabsContent>

        {/* Assignments Tab Content */}
        <TabsContent value="assignments" className="mt-0">
          {canEdit && (
            <BinderAssignmentsTab
              binderId={binder.id}
              locationId={locationId}
              canEdit={canEdit}
            />
          )}
        </TabsContent>
      </Tabs>

      {/* Form Template Dialog */}
      {canEdit && (
        <FormTemplateDialog
          key={editingTemplate?.id ?? "new"}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onSuccess={() => router.refresh()}
          locationId={locationId}
          binderId={binder.id}
          template={editingTemplate}
        />
      )}

      {/* Binder Edit Dialog */}
      {canEdit && (
        <BinderDialog
          open={binderDialogOpen}
          onOpenChange={setBinderDialogOpen}
          binder={binder}
          locationId={locationId}
          onSuccess={() => router.refresh()}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Binder</AlertDialogTitle>
            <AlertDialogDescription>
              This will deactivate the binder &quot;{binder.name}&quot; and hide
              it from all users. This action can be reversed by an
              administrator.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteBinder}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete Binder"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
