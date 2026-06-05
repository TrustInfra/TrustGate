import { NextResponse } from "next/server";

// Advertise the agent-facing resources (llms.txt and sitemap) via HTTP Link
// headers so crawlers and agents can discover them without parsing HTML.
// Hosts use the canonical www host that is actually served.
const LINK_HEADER =
  '<https://www.trustgated.xyz/llms.txt>; rel="llms", ' +
  '<https://www.trustgated.xyz/sitemap.xml>; rel="sitemap"';

export function middleware() {
  const response = NextResponse.next();
  response.headers.set("Link", LINK_HEADER);
  return response;
}

export const config = {
  // Run on page routes only, skipping Next internals, the API, and static
  // assets so the header is not attached to every chunk and file request.
  matcher: [
    "/((?!_next/static|_next/image|api|favicon.ico|.*\\..*).*)",
  ],
};
