"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Briefcase, Scale, UserPlus } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createClient } from "@/shared/lib/supabase/client";
import { apiClient } from "@/shared/lib/api/client";
import type { UserRole } from "@/entities/types";
import { Field } from "@/shared/components/ui";

const schema = z.object({
  full_name: z.string().min(2, "Name required"),
  email:     z.string().email("Valid email required"),
  password:  z.string().min(8, "Min 8 characters"),
  city:      z.string().optional(),
  state:     z.string().optional(),
});
type Form = z.infer<typeof schema>;

const ROLES: { value: UserRole; label: string; desc: string; icon: React.ElementType }[] = [
  { value: "user",   label: "Petitioner / Consumer", desc: "I need legal help",          icon: Scale },
  { value: "lawyer", label: "Advocate / Lawyer",     desc: "I represent clients",        icon: Briefcase },
];
const INPUT = "min-h-11 w-full rounded-xl border border-brand-gold/15 bg-base-100 px-3.5 text-[13px] outline-none transition-all placeholder:text-brand-blue-light/30 focus:border-brand-gold focus:bg-white focus:shadow-sm";

export default function RegisterPage() {
  const router  = useRouter();
  const [role, setRole]   = useState<UserRole>("user");
  const [apiErr, setApiErr] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Form>({ resolver: zodResolver(schema) });

  async function onSubmit(data: Form) {
    setApiErr(null);
    const sb = createClient();
    const { data: authData, error: authErr } = await sb.auth.signUp({
      email: data.email, password: data.password,
      options: { data: { role, full_name: data.full_name } },
    });
    if (authErr || !authData.user) { setApiErr(authErr?.message ?? "Signup failed"); return; }

    // When email confirmation is enabled Supabase returns session=null until
    // the user clicks the confirmation link. In that case we skip profile
    // creation here — the profile will be created on first login via the
    // same endpoint. Redirect to a "check your email" page instead.
    const token = authData.session?.access_token;
    if (!token) {
      router.replace(`/login?notice=confirm-email`);
      return;
    }

    try {
      await apiClient.post("/identity/profile", {
        role,
        full_name: data.full_name,
        city: data.city,
        state: data.state,
      }, {
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (err: any) {
      await sb.auth.signOut();
      setApiErr(err.detail ?? "Profile setup failed. Please try signing in.");
      return;
    }
    if (role === "lawyer") {
      router.replace("/user/dashboard?notice=lawyer-pending");
    } else {
      router.replace("/user/dashboard");
    }
  }

  return (
    <div className="animate-fade-in-up rounded-2xl border border-brand-gold/15 bg-white p-8 shadow-xl">
      <h2 className="font-serif text-2xl font-bold">Create account</h2>
      <p className="mt-1 text-sm text-brand-blue-light/55">Get started free.</p>

      <div className="mt-5 grid grid-cols-2 gap-2">
        {ROLES.map(({ value, label, desc, icon: Icon }) => (
          <button key={value} type="button" onClick={() => setRole(value)}
            className={`flex flex-col items-start gap-1.5 rounded-xl border p-3.5 text-left transition-all ${role === value ? "border-brand-gold/40 bg-brand-gold/8 shadow-sm" : "border-brand-gold/12 hover:border-brand-gold/25"}`}>
            <Icon className={`h-5 w-5 ${role === value ? "text-brand-gold" : "text-brand-blue-light/35"}`} />
            <span className="text-[12px] font-semibold leading-4">{label}</span>
            <span className="text-[10px] leading-4 text-brand-blue-light/45">{desc}</span>
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-5 space-y-3.5">
        <Field label="Full name" error={errors.full_name?.message} htmlFor="full_name">
          <input {...register("full_name")} id="full_name" placeholder="Amit Verma" className={INPUT} />
        </Field>
        <Field label="Email" error={errors.email?.message} htmlFor="email">
          <input {...register("email")} id="email" type="email" placeholder="you@example.com" className={INPUT} />
        </Field>
        <Field label="Password (min 8 chars)" error={errors.password?.message} htmlFor="password">
          <input {...register("password")} id="password" type="password" placeholder="••••••••" className={INPUT} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="City" htmlFor="city">
            <input {...register("city")} id="city" placeholder="Delhi" className={INPUT} />
          </Field>
          <Field label="State" htmlFor="state">
            <input {...register("state")} id="state" placeholder="Delhi" className={INPUT} />
          </Field>
        </div>
        {apiErr && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{apiErr}</p>}
        <button type="submit" disabled={isSubmitting}
          className="shimmer-btn mt-1 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-gold text-sm font-semibold text-brand-blue-dark transition-all hover:bg-brand-gold-light disabled:opacity-50">
          {isSubmitting ? <span className="h-4 w-4 rounded-full border-2 border-brand-blue-dark/30 border-t-brand-blue-dark animate-spin" /> : <UserPlus className="h-4 w-4" />}
          {isSubmitting ? "Creating account…" : "Create account"}
        </button>
      </form>
      <p className="mt-5 text-center text-sm text-brand-blue-light/55">
        Have an account? <Link href="/login" className="font-semibold text-brand-gold hover:underline">Sign in</Link>
      </p>
    </div>
  );
}