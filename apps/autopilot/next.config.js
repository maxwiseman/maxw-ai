import { fileURLToPath } from "url";
import createJiti from "jiti";

// Import env files to validate at build time. Use jiti so we can load .ts files in here.
createJiti(fileURLToPath(import.meta.url))("./src/env");

/** @type {import("next").NextConfig} */
const config = {
  reactStrictMode: true,

  /** Enables hot reloading for local packages without a build step */
  transpilePackages: [
    "@acme/api",
    "@acme/auth",
    "@acme/db",
    "@acme/ui",
    "@acme/validators",
  ],

  /** We already do linting and typechecking as separate tasks in CI */
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  rewrites: async () => {
    return [
      {
        source: "/backend/:path*",
        destination:
          process.env.NODE_ENV === "production" && process.env.BACKEND_URL
            ? `https://${process.env.BACKEND_DOMAIN}/:path*`
            : "http://localhost:8080/:path*",
      },
    ];
  },
};

export default config;
