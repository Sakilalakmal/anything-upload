import { getSessionCookie } from "better-auth/cookies"
import { NextRequest, NextResponse } from "next/server"

const AUTH_ROUTES = new Set(["/sign-in", "/sign-up"])

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const hasSession = Boolean(getSessionCookie(request))

  if (AUTH_ROUTES.has(pathname) && hasSession) {
    return NextResponse.redirect(new URL("/profile", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/sign-in", "/sign-up"],
}
