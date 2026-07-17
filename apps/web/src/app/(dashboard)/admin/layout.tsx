import { redirect } from "next/navigation";
import { createClient } from "@/shared/lib/supabase/server";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await sb
    .from("profiles")
    .select("role, is_active, dsr_erased_at")
    .eq("id", user.id)
    .maybeSingle();

  if (profile && (profile.is_active === false || profile.dsr_erased_at)) {
    await sb.auth.signOut();
    redirect("/login?notice=suspended");
  }

  const role = profile?.role ?? user.app_metadata?.role;
  if (role !== "admin") {
    redirect("/user/dashboard");
  }

  return <>{children}</>;
}
