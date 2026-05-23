import { NextResponse, type NextRequest } from "next/server";
import { i18n } from "@/lib/i18n";

// Self-contained i18n middleware. We don't use fumadocs-core's built-in
// because it redirects rather than rewrites for the default locale,
// producing an extra round-trip and a visible `/en/...` URL.
//
// Logic mirrors fumadocs's default-locale flavor: hide `/en` prefix for
// the default language, keep `/zh` prefix for other languages.
//
// The docs app is deployed at its own apex on docs.agenthost.pro — no
// basePath, all paths are root-relative.
export default function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const pathLocale = i18n.languages.find(
    (loc) => pathname === `/${loc}` || pathname.startsWith(`/${loc}/`),
  );

  if (!pathLocale) {
    // No locale in URL → rewrite to the default-language route.
    const target = `/${i18n.defaultLanguage}${pathname === "/" ? "" : pathname}`;
    return NextResponse.rewrite(new URL(target, request.url));
  }

  if (pathLocale === i18n.defaultLanguage) {
    // Explicit default-language prefix → strip it so the canonical URL
    // is prefix-less. Carry the search string through so marketing UTMs /
    // referral params don't disappear on the locale strip.
    const stripped = pathname.slice(`/${pathLocale}`.length);
    const target = stripped || "/";
    const url = new URL(target, request.url);
    url.search = request.nextUrl.search;
    return NextResponse.redirect(url);
  }

  // Non-default locale in URL → let it through; Next matches on the
  // `[lang]` segment directly.
  return NextResponse.next();
}

export const config = {
  // Run on every path except static/api and root metadata routes.
  // `sitemap.xml` and `robots.txt` MUST be excluded — they're not under
  // `[lang]/`, so routing them through the locale rewrite would 404 the
  // sitemap that robots.txt advertises to crawlers.
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
    "/",
  ],
};
