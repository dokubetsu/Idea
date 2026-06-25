import { redirect } from "next/navigation";
import { createClient } from "@/shared/lib/supabase/server";

export default async function UserLayout({ children }: { children: React.ReactNode }) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");
  
  const role = user.app_metadata?.role ?? "user";
  if (role !== "user") {
    if (role === "admin") redirect("/admin/dashboard");
    if (role === "lawyer") redirect("/lawyer/dashboard");
    redirect("/login");
  }

  return <>{children}</>;
}
