// import { authMiddleware } from "@acme/auth/middleware";

// export default authMiddleware
export default () => {};

// Read more: https://nextjs.org/docs/app/building-your-application/routing/middleware#matcher
export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
