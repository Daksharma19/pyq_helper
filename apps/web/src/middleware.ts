import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { env } from "@/env";

// Refreshes the Supabase session cookie on admin/auth routes. Public pages don't need it.
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const db = createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
      },
    },
  });
  const {
    data: { user },
  } = await db.auth.getUser();
  // Signed-out visitors go to login and come back afterwards. The admin role itself is
  // checked in the admin layout, every server action, and RLS.
  const { pathname, search } = request.nextUrl;
  if (!user && pathname.startsWith("/admin")) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = { matcher: ["/admin/:path*", "/login"] };
