import { getSessionCookie } from "better-auth/cookies"
import { NextRequest, NextResponse } from "next/server"

const AUTH_ROUTES = new Set(["/sign-in", "/sign-up"])
const PROTECTED_ROUTES = new Set(["/profile", "/upload"])

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  const hasSession = Boolean(getSessionCookie(request))

  if (PROTECTED_ROUTES.has(pathname) && !hasSession) {
    const signInUrl = new URL("/sign-in", request.url)
    const redirectTarget = `${pathname}${search}`

    signInUrl.searchParams.set("redirectTo", redirectTarget)
    return NextResponse.redirect(signInUrl)
  }

  if (AUTH_ROUTES.has(pathname) && hasSession) {
    return NextResponse.redirect(new URL("/profile", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/sign-in", "/sign-up", "/profile", "/upload"],
}
