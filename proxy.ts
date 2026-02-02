import { NextRequest, NextResponse } from "next/server"

function isProtectedRoute(pathname: string): boolean {
  const publicPaths = ["/login", "/setup", "/invite", "/forgot-password", "/reset-password"]
  return !publicPaths.some((p) => pathname.startsWith(p))
}

export async function proxy(request: NextRequest) {
  // Better Auth uses __Secure- prefix in production (HTTPS)
  const sessionCookie =
    request.cookies.get("__Secure-better-auth.session_token") ||
    request.cookies.get("better-auth.session_token")

  if (!sessionCookie && isProtectedRoute(request.nextUrl.pathname)) {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    "/((?!api/|_next/static|_next/image|favicon.ico|icons|sw\\.js|manifest\\.webmanifest).*)",
  ],
}
