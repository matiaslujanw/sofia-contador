import { notFound } from "next/navigation";
import { z } from "zod";
import { Workspace } from "@/components/workspace";
import { requireWorkspaceAccess } from "@/lib/supabase/access";
import { createDemoWorkspace } from "@/lib/workspace/demo";
import { todayIn } from "@/lib/workspace/format";
import { loadWorkspace } from "@/lib/workspace/queries";
import { isSection, sections } from "@/lib/workspace/routes";
import { monthSchema } from "@/lib/workspace/validation";

type Props = {
  params: Promise<{ section: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props) {
  const { section } = await params;
  return { title: isSection(section) ? sections[section] : "Página no disponible" };
}

export default async function WorkspacePage({ params, searchParams }: Props) {
  const [{ section }, query] = await Promise.all([params, searchParams]);
  if (!isSection(section)) notFound();
  const access = await requireWorkspaceAccess();
  const organizationId = z.uuid().safeParse(query.organizacion).data;
  const today = todayIn();
  const state = access.mode === "demo"
    ? createDemoWorkspace(today.slice(0, 7))
    : await loadWorkspace(access.supabase, access.userId, organizationId);
  const currentDate = todayIn(state.organization?.timezone);
  const month = monthSchema.safeParse(query.mes).data ?? currentDate.slice(0, 7);
  const companyId = z.uuid().safeParse(query.empresa).data;
  const purpose = typeof query.tipo === "string" ? query.tipo : undefined;

  return <Workspace initial={state} section={section} mode={access.mode}
    email={access.mode === "auth" ? access.email : null} month={month} today={currentDate} companyId={companyId} purpose={purpose} />;
}
