import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

const intlMiddleware = createMiddleware(routing);

export default function middleware(request) {
  console.log("middleware running:", request.nextUrl.pathname);
  return intlMiddleware(request);
}

export const config = {
  matcher: [
    "/",
    "/(ja|en)/:path*",
    "/((?!api|admin|login|register|forgot-password|reset-password|_next|_vercel|.*\\..*).*)",
  ],
};