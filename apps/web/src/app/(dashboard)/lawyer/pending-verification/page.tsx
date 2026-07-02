import { createClient } from "@/shared/lib/supabase/server";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Verification Pending | Lead",
  description: "Your lawyer account is awaiting admin verification.",
};

export default async function LawyerPendingVerificationPage() {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) redirect("/login");

  // If somehow already verified, redirect to dashboard
  const { data: profile } = await sb
    .from("lawyer_profiles")
    .select("is_verified")
    .eq("id", user.id)
    .single();

  if (profile?.is_verified) {
    redirect("/lawyer/dashboard");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4">
      <div className="max-w-md w-full">
        {/* Card */}
        <div className="relative rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-8 text-center shadow-2xl">
          {/* Icon */}
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-amber-500/10 border border-amber-500/30">
            <svg
              className="h-10 w-10 text-amber-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
              />
            </svg>
          </div>

          {/* Heading */}
          <h1 className="text-2xl font-bold text-white mb-2">
            Verification Pending
          </h1>
          <p className="text-slate-400 text-sm leading-relaxed mb-6">
            Your lawyer account has been created and is currently under review
            by our admin team. You will receive an email notification once your
            account is approved.
          </p>

          {/* Status badge */}
          <div className="inline-flex items-center gap-2 rounded-full bg-amber-500/10 border border-amber-500/30 px-4 py-2 text-sm text-amber-400 font-medium mb-6">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400"></span>
            </span>
            Awaiting Admin Approval
          </div>

          {/* Info list */}
          <ul className="text-left space-y-3 text-sm text-slate-400 mb-8">
            <li className="flex items-start gap-3">
              <svg className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Account created successfully
            </li>
            <li className="flex items-start gap-3">
              <svg className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Profile under admin review (typically 1–2 business days)
            </li>
            <li className="flex items-start gap-3">
              <svg className="h-4 w-4 text-slate-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Email notification sent on approval
            </li>
          </ul>

          <form action={async () => {
            "use server";
            const sb = await createClient();
            await sb.auth.signOut();
            redirect("/login");
          }}>
            <button
              type="submit"
              className="w-full rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white py-3 text-sm font-medium transition-all duration-200"
            >
              Sign Out
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-slate-600 mt-4">
          Questions? Contact{" "}
          <a href="mailto:support@lead.law" className="text-slate-400 hover:text-white transition-colors">
            support@lead.law
          </a>
        </p>
      </div>
    </div>
  );
}
