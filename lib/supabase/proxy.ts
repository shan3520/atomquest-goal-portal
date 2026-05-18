import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: Do not remove this line.
  // Refreshing the auth token ensures the session stays alive.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // If no user and trying to access protected routes, redirect to login
  const isAuthRoute = request.nextUrl.pathname.startsWith("/login");
  const isPublicRoute =
    request.nextUrl.pathname === "/" ||
    request.nextUrl.pathname.startsWith("/api/");

  if (!user && !isAuthRoute && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Fetch profile ONCE per request (was racing with two .single() calls before)
  // and use maybeSingle so a transient zero-row read doesn't blow up the proxy.
  let role: string | null = null;
  if (user) {
    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileErr) {
      console.error("[proxy] profile fetch failed:", profileErr);
    }
    role = profile?.role ?? null;

    // If the profile row is missing (auth user exists but no `profiles` row),
    // don't enforce role-based route gating — let the request through so the
    // dashboard layout's ensureProfile() recovery flow can run. Otherwise an
    // admin user with a missing profile would get bounced to /dashboard on
    // every admin/* click, which presents as "Shared Goals randomly redirects".
  }

  // If user is logged in and on login page, redirect to dashboard
  if (user && isAuthRoute) {
    const url = request.nextUrl.clone();
    if (role === "admin") {
      url.pathname = "/admin/dashboard";
    } else if (role === "manager") {
      url.pathname = "/manager/dashboard";
    } else {
      url.pathname = "/dashboard";
    }
    return NextResponse.redirect(url);
  }

  // Role-based route protection. Only gate when we actually know the role —
  // if `role` is null (profile read failed or row missing), let the layout
  // handle it rather than redirect-looping the user.
  if (user && role !== null) {
    const pathname = request.nextUrl.pathname;

    if (pathname.startsWith("/admin") && role !== "admin") {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }

    if (
      pathname.startsWith("/manager") &&
      role !== "manager" &&
      role !== "admin"
    ) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
