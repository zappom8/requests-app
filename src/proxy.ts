import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Next.js 16 renamed `middleware.ts`/`middleware()` to `proxy.ts`/`proxy()`.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request: { headers: request.headers } });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  // getClaims() verifies the JWT rather than trusting unverified cookie
  // contents — the only auth check that's safe to rely on server-side.
  const { data } = await supabase.auth.getClaims();
  const isAuthenticated = !!data?.claims;

  const { pathname } = request.nextUrl;
  const isLoginPage = pathname === "/dashboard/login";
  const isProtectedPage = pathname.startsWith("/dashboard") && !isLoginPage;
  const isProtectedApi = pathname.startsWith("/api/dashboard");

  if (isProtectedPage && !isAuthenticated) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard/login";
    return NextResponse.redirect(url);
  }

  if (isProtectedApi && !isAuthenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (isLoginPage && isAuthenticated) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard/queue";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/dashboard/:path*", "/api/dashboard/:path*"],
};
