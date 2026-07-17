import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const ROLE_HOME: Record<string, string> = {
  user: "/user/dashboard",
  lawyer: "/lawyer/dashboard",
  admin: "/admin/dashboard",
};

export async function middleware(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const isDev = process.env.NODE_ENV === "development";
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";
  const supabaseWssUrl = supabaseUrl ? supabaseUrl.replace(/^http/, "ws") : "";
  const sentryHost = process.env.NEXT_PUBLIC_SENTRY_DSN
    ? " https://*.ingest.sentry.io https://*.sentry.io"
    : "";

  const localhostConnectSources = isDev
    ? " http://localhost:8000 http://127.0.0.1:8000 http://localhost:3000"
    : "";
  let validatedApiUrl = apiUrl;
  if (!isDev && apiUrl && apiUrl.startsWith("http://")) {
    validatedApiUrl = apiUrl.replace(/^http:/, "https:");
  }

  const cspHeader = `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://checkout.razorpay.com${isDev ? " 'unsafe-eval'" : ""};
    style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
    img-src 'self' data: blob: https://*.supabase.co https://images.unsplash.com;
    font-src 'self' https://fonts.gstatic.com;
    connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.razorpay.com https://lumberjack.razorpay.com${sentryHost}${localhostConnectSources} ${supabaseUrl} ${supabaseWssUrl} ${validatedApiUrl};
    frame-src 'self' https://api.razorpay.com https://checkout.razorpay.com;
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
  `
    .replace(/\s{2,}/g, " ")
    .trim();

  const { pathname } = request.nextUrl;

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("x-pathname", pathname);

  let response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
  response.headers.set("Content-Security-Policy", cspHeader);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (s: { name: string; value: string; options?: Record<string, unknown> }[]) =>
          s.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          }),
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    if (["/user", "/lawyer", "/admin"].some((p) => pathname.startsWith(p))) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("redirect", pathname);
      return NextResponse.redirect(url);
    }
    return response;
  }

  // Prefer DB profile (authoritative) over JWT app_metadata for role + is_active
  let role = (user.app_metadata?.role as string) ?? "user";
  let isActive = true;
  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, is_active, dsr_erased_at")
      .eq("id", user.id)
      .maybeSingle();

    if (profile) {
      if (profile.is_active === false || profile.dsr_erased_at) {
        isActive = false;
      }
      if (profile.role) {
        role = profile.role as string;
      }
    }
  } catch {
    // Fall back to JWT claims if profile read fails
  }

  if (!isActive || role === "suspended") {
    // Clear session and force re-login
    await supabase.auth.signOut();
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("notice", "suspended");
    const redirect = NextResponse.redirect(url);
    // Preserve CSP on redirect response
    redirect.headers.set("Content-Security-Policy", cspHeader);
    return redirect;
  }

  const home = ROLE_HOME[role] ?? "/user/dashboard";

  if (["/login", "/register"].includes(pathname) || pathname === "/")
    return NextResponse.redirect(new URL(home, request.url));

  if (pathname.startsWith("/admin") && role !== "admin")
    return NextResponse.redirect(new URL(home, request.url));
  if (pathname.startsWith("/lawyer") && role !== "lawyer")
    return NextResponse.redirect(new URL(home, request.url));
  if (pathname.startsWith("/user") && role !== "user")
    return NextResponse.redirect(new URL(home, request.url));

  response.headers.set("x-user-role", role);
  response.headers.set("x-user-id", user.id);

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
