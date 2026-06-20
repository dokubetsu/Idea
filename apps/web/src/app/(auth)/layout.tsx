import { Scale } from "lucide-react";
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12 bg-base-100">
      <div className="fixed top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-brand-gold to-transparent" />
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-20 -right-20 h-96 w-96 rounded-full bg-brand-gold/5 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 h-80 w-80 rounded-full bg-brand-accent/5 blur-3xl" />
      </div>
      <div className="relative w-full max-w-[420px]">
        <div className="mb-8 flex flex-col items-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-blue-dark shadow-lg">
            <Scale className="h-6 w-6 animate-scale-tilt text-brand-gold" />
          </div>
          <h1 className="mt-4 font-serif text-4xl font-bold">Le<span className="font-sans font-medium text-brand-gold">Ad</span></h1>
          <p className="mt-1 text-xs font-medium tracking-wider text-brand-blue-light/40">Legal workflow platform</p>
        </div>
        {children}
      </div>
    </div>
  );
}
