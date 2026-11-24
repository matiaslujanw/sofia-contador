import { redirect } from "next/navigation";
import { getWorkspaceAccess } from "@/lib/supabase/access";

export default async function Home() {
  redirect(await getWorkspaceAccess() ? "/inicio" : "/ingresar");
}
