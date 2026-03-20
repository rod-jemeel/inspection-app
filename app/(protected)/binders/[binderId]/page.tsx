import type { Metadata } from "next";
import { Suspense } from "react";
import { requireBinderAccess } from "@/lib/server/auth-helpers";
import { getBinder, canUserEditBinder } from "@/lib/server/services/binders";
import { listFormTemplates } from "@/lib/server/services/form-templates";
import { supabase } from "@/lib/server/db";
import { LoadingSpinner } from "@/components/loading-spinner";
import { PageBreadcrumbs } from "@/components/page-breadcrumbs";
import { BinderDetail } from "./_components/binder-detail";

export const metadata: Metadata = { title: "Binder" };

async function BinderData({
  loc,
  binderId,
}: {
  loc: string;
  binderId: string;
}) {
  const { profile } = await requireBinderAccess(loc, binderId);
  const [binder, templates, canEdit] = await Promise.all([
    getBinder(loc, binderId),
    listFormTemplates(loc, binderId, { active: true }),
    canUserEditBinder(profile.id, binderId, profile.role, {
      can_manage_binders: profile.can_manage_binders,
      can_manage_forms: profile.can_manage_forms,
    }),
  ]);

  const formIds = templates.map((t) => t.id);
  const { data: pendingInstances } = formIds.length > 0
    ? await supabase
        .from("inspection_instances")
        .select("id, form_template_id, status, due_at")
        .in("form_template_id", formIds)
        .in("status", ["pending", "in_progress"])
        .order("due_at", { ascending: true })
    : { data: [] };

  return (
    <>
      <PageBreadcrumbs
        items={[
          { label: "Binders", href: `/binders?loc=${loc}` },
          { label: binder.name },
        ]}
      />
      <BinderDetail
        binder={binder}
        templates={templates}
        locationId={loc}
        canEdit={canEdit}
        profileId={profile.id}
        pendingInstances={pendingInstances ?? []}
      />
    </>
  );
}

export default async function BinderPage({
  params,
  searchParams,
}: {
  params: Promise<{ binderId: string }>;
  searchParams: Promise<{ loc?: string }>;
}) {
  const { binderId } = await params;
  const { loc } = await searchParams;

  if (!loc) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <p className="text-sm">Select a location to view this binder</p>
      </div>
    );
  }

  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center">
          <LoadingSpinner />
        </div>
      }
    >
      <BinderData loc={loc} binderId={binderId} />
    </Suspense>
  );
}
