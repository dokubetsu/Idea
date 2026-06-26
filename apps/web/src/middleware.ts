import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const ROLE_HOME: Record<string, string> = {
  user: "/user/dashboard", lawyer: "/lawyer/dashboard", admin: "/admin/dashboard",
};

export async function middleware(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const isDev = process.env.NODE_ENV === "development";
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";
  const supabaseWssUrl = supabaseUrl ? supabaseUrl.replace(/^http/, "ws") : "";

  const cspHeader = `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}'${isDev ? " 'unsafe-eval'" : ""};
    style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
    img-src 'self' data: blob: https://*.supabase.co https://images.unsplash.com;
    font-src 'self' https://fonts.gstatic.com;
    connect-src 'self' https://*.supabase.co wss://*.supabase.co http://localhost:8000 http://127.0.0.1:8000 http://localhost:3000 ${supabaseUrl} ${supabaseWssUrl} ${apiUrl};
    frame-ancestors 'none';
    upgrade-insecure-requests;
  `.replace(/\s{2,}/g, " ").trim();

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", cspHeader);

  let response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
  response.headers.set("Content-Security-Policy", cspHeader);

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

  const role = (user.app_metadata?.role as string) ?? "user";

  const home = ROLE_HOME[role] ?? "/user/dashboard";

  if (["/login","/register"].includes(pathname) || pathname === "/")
    return NextResponse.redirect(new URL(home, request.url));

  if (pathname.startsWith("/admin")  && role !== "admin")  return NextResponse.redirect(new URL(home, request.url));
  if (pathname.startsWith("/lawyer") && role !== "lawyer") return NextResponse.redirect(new URL(home, request.url));
  if (pathname.startsWith("/user")   && role !== "user")   return NextResponse.redirect(new URL(home, request.url));

  // H8: Forward the already-resolved user role and ID as request headers so that
  // dashboard layouts can read them via next/headers without a second Supabase
  // network round-trip. The middleware has already authenticated the user above.
  response.headers.set("x-user-role", role);
  response.headers.set("x-user-id", user.id);

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
