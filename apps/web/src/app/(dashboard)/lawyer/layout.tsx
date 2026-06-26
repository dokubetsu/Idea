import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/shared/lib/supabase/server";

export default async function LawyerLayout({ children }: { children: React.ReactNode }) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");

  const role = user.app_metadata?.role;
  if (role !== "lawyer") {
    if (role === "admin") redirect("/admin/dashboard");
    redirect("/user/dashboard");
  }

  // C3: Check is_verified. Unverified lawyers are redirected to a holding page
  // so they cannot access client matter data before admin approval.
  // x-pathname is injected by middleware.ts on every request.
  // Skip the verified check on the pending-verification route to prevent loops.
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") ?? "";
  const onPendingPage = pathname === "/lawyer/pending-verification";

  if (!onPendingPage) {
    const { data: profile } = await sb
      .from("lawyer_profiles")
      .select("is_verified")
      .eq("id", user.id)
      .single();

    if (!profile?.is_verified) {
      redirect("/lawyer/pending-verification");
    }
  }

  return <>{children}</>;
}

