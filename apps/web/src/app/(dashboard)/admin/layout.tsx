import { redirect } from "next/navigation";
import { createClient } from "@/shared/lib/supabase/server";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");
  
  const role = user.app_metadata?.role ?? user.user_metadata?.role;
  if (role !== "admin") {
    redirect("/user/dashboard");
  }

  return <>{children}</>;
}
