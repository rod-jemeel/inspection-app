import { NextRequest, NextResponse } from "next/server"

function isProtectedRoute(pathname: string): boolean {
  const publicPaths = ["/login", "/setup", "/invite", "/forgot-password", "/reset-password"]
  return !publicPaths.some((p) => pathname.startsWith(p))
}

export async function proxy(request: NextRequest) {
  const sessionCookie = request.cookies.get("better-auth.session_token")

  if (!sessionCookie && isProtectedRoute(request.nextUrl.pathname)) {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon.ico|icons|sw\\.js|manifest\\.webmanifest).*)",
  ],
}
