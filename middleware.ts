import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

const PROTECTED_PREFIXES = ["/dashboard", "/problems", "/interview", "/history", "/admin"];
const ADMIN_PREFIXES = ["/admin", "/api/admin"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const needsAuth = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  const needsAdmin = ADMIN_PREFIXES.some((p) => pathname.startsWith(p));

  if (!needsAuth && !needsAdmin) return NextResponse.next();

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  if (!token) {
    // /api/admin requests should get 401, not a redirect, so clients see a clear error.
    if (pathname.startsWith("/api/admin")) {
      return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    }
    const signInUrl = new URL("/signin", req.url);
    signInUrl.searchParams.set("callbackUrl", pathname + req.nextUrl.search);
    return NextResponse.redirect(signInUrl);
  }

  if (needsAdmin && token.role !== "ADMIN") {
    if (pathname.startsWith("/api/admin")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/problems/:path*",
    "/interview/:path*",
    "/history/:path*",
    "/admin/:path*",
    "/api/admin/:path*",
  ],
};
