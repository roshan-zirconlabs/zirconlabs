import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(req: NextRequest) {
  const sessionToken =
    req.cookies.get("authjs.session-token")?.value ||
    req.cookies.get("__Secure-authjs.session-token")?.value;

  const protectedPaths = ["/dashboard", "/billing", "/bots"];
  const isProtected = protectedPaths.some((path) =>
    req.nextUrl.pathname.startsWith(path),
  );

  if (isProtected && !sessionToken) {
    const signInUrl = new URL("/auth/sign-in", req.url);
    signInUrl.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|data).*)"],
};
