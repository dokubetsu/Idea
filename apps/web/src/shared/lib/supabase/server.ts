import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
export async function createClient() {
  const store = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll:  () => store.getAll(),
        setAll: (s: any) => {
          try {
            s.forEach(({ name, value, options }: any) => store.set(name, value, options));
          } catch {
            // Safe to ignore in Server Components; middleware will sync cookies on next request.
          }
        },
      },
    },
  );
}
