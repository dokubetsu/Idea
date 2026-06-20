import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const ROLE_HOME: Record<string, string> = {
  user: "/user/dashboard", lawyer: "/lawyer/dashboard", admin: "/admin/dashboard",
};

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { pathname } = request.nextUrl;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll:  () => request.cookies.getAll(),
        setAll: (s: any) => s.forEach(({ name, value, options }: any) => {
          request.cookies.set(name, value);
          response.cookies.set(name, value, options);
        }),
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    if (["/user","/lawyer","/admin"].some((p) => pathname.startsWith(p))) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("redirect", pathname);
      return NextResponse.redirect(url);
    }
    return response;
  }

  const role = (user.app_metadata?.role as string) ?? (user.user_metadata?.role as string) ?? "user";

  const home = ROLE_HOME[role] ?? "/user/dashboard";

  if (["/login","/register"].includes(pathname) || pathname === "/")
    return NextResponse.redirect(new URL(home, request.url));

  if (pathname.startsWith("/admin")  && role !== "admin")  return NextResponse.redirect(new URL(home, request.url));
  if (pathname.startsWith("/lawyer") && role !== "lawyer") return NextResponse.redirect(new URL(home, request.url));
  if (pathname.startsWith("/user")   && role !== "user")   return NextResponse.redirect(new URL(home, request.url));

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
