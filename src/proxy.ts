import { NextResponse, type NextRequest } from "next/server";
import { BYPASS_COOKIE, BYPASS_PARAM, readMaintenanceConfig, retryAfterSeconds } from "@/lib/maintenance";

const MAINTENANCE_PATH = "/maintenance";

export function proxy(request: NextRequest) {
  const config = readMaintenanceConfig();
  const { pathname, searchParams } = request.nextUrl;

  if (!config.enabled) {
    // Nothing to wait for, so don't leave anyone on the maintenance page.
    return pathname === MAINTENANCE_PATH ? NextResponse.redirect(new URL("/", request.url)) : NextResponse.next();
  }

  if (config.bypassToken) {
    // ?preview=<token> remembers this browser, then drops the token from the address bar.
    if (searchParams.get(BYPASS_PARAM) === config.bypassToken) {
      const clean = request.nextUrl.clone();
      clean.searchParams.delete(BYPASS_PARAM);
      const response = NextResponse.redirect(clean);
      response.cookies.set(BYPASS_COOKIE, config.bypassToken, {
        httpOnly: true,
        sameSite: "lax",
        secure: request.nextUrl.protocol === "https:",
        path: "/",
        maxAge: 60 * 60 * 12,
      });
      return response;
    }
    if (request.cookies.get(BYPASS_COOKIE)?.value === config.bypassToken) return NextResponse.next();
  }

  // Keep the visitor's URL, so the page can send them back to it once we're done.
  const response =
    pathname === MAINTENANCE_PATH
      ? NextResponse.next()
      : NextResponse.rewrite(new URL(MAINTENANCE_PATH, request.url), { status: 503 });
  response.headers.set("Retry-After", String(retryAfterSeconds(config)));
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export const config = {
  // Pages only: framework assets, icons and other files with an extension still load.
  matcher: ["/((?!_next/static|_next/image|.*\\.[\\w]+$).*)"],
};
