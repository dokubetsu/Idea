"use client";
import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, LogIn } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createClient } from "@/shared/lib/supabase/client";

const schema = z.object({
  email:    z.string().email("Valid email required"),
  password: z.string().min(1, "Password required"),
});
type Form = z.infer<typeof schema>;

function LoginForm() {
  const router   = useRouter();
  const params   = useSearchParams();
  const [showPw, setShowPw] = useState(false);
  const [apiErr, setApiErr] = useState<string | null>(null);
  const notice = params.get("notice");

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Form>({ resolver: zodResolver(schema) });

  async function onSubmit(data: Form) {
    setApiErr(null);
    const sb = createClient();
    const { data: result, error } = await sb.auth.signInWithPassword(data);
    if (error || !result.user) { setApiErr(error?.message ?? "Sign in failed"); return; }

    const role = (result.user.app_metadata?.role as string) ?? (result.user.user_metadata?.role as string) ?? "user";
    const token = result.session?.access_token;

    // Create profile if it doesn't exist yet (handles email-confirmation flow
    // where the profile POST was skipped during registration).
    if (token) {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/identity/profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          role,
          full_name: result.user.user_metadata?.full_name ?? result.user.email ?? "User",
        }),
      });
      // Intentionally not blocking on failure — profile may already exist (idempotent endpoint).
    }

    const redirectUrl = params.get("redirect");
    const safeRedirect = redirectUrl && redirectUrl.startsWith("/") && !redirectUrl.startsWith("//")
      ? redirectUrl
      : `/${role}/dashboard`;
    router.replace(safeRedirect);
  }

  return (
    <div className="animate-fade-in-up rounded-2xl border border-brand-gold/15 bg-white p-8 shadow-xl">
      <h2 className="font-serif text-2xl font-bold">Welcome back</h2>
      <p className="mt-1 text-sm text-brand-blue-light/55">Sign in to your workspace.</p>
      {notice === "confirm-email" && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          ✉️ Check your inbox — click the confirmation link, then sign in here.
        </div>
      )}
      <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
        <Field label="Email" error={errors.email?.message}>
          <input {...register("email")} type="email" placeholder="you@example.com" autoComplete="email" className={INPUT} />
        </Field>
        <Field label="Password" error={errors.password?.message}>
          <div className="relative">
            <input {...register("password")} type={showPw ? "text" : "password"} placeholder="••••••••" autoComplete="current-password" className={INPUT} />
            <button type="button" tabIndex={-1} onClick={() => setShowPw(!showPw)}
              className="absolute right-3 top-3 text-brand-blue-light/40 hover:text-brand-blue-dark">
              {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </Field>
        {apiErr && <ErrBox msg={apiErr} />}
        <Btn loading={isSubmitting} icon={<LogIn className="h-4 w-4" />}>Sign in</Btn>
      </form>
      <p className="mt-6 text-center text-sm text-brand-blue-light/55">
        New to LeAd? <Link href="/register" className="font-semibold text-brand-gold hover:underline">Create account</Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="rounded-2xl border border-brand-gold/15 bg-white p-8 shadow-xl flex justify-center items-center min-h-[300px]">
        <span className="h-8 w-8 rounded-full border-2 border-brand-gold/30 border-t-brand-gold animate-spin" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}

const INPUT = "min-h-11 w-full rounded-xl border border-brand-gold/15 bg-base-100 px-3.5 text-[13px] outline-none transition-all placeholder:text-brand-blue-light/30 focus:border-brand-gold focus:bg-white focus:shadow-sm";

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-blue-light/50">{label}</span>
      {children}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </label>
  );
}
function ErrBox({ msg }: { msg: string }) {
  return <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{msg}</p>;
}
function Btn({ loading, icon, children }: { loading: boolean; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button type="submit" disabled={loading}
      className="shimmer-btn mt-1 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-brand-gold/30 bg-brand-blue-dark text-sm font-semibold text-brand-gold transition-all hover:bg-brand-blue-light disabled:opacity-50">
      {loading ? <span className="h-4 w-4 rounded-full border-2 border-brand-gold/30 border-t-brand-gold animate-spin" /> : icon}
      {loading ? "Signing in…" : children}
    </button>
  );
}