import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { withBotId } from "botid/next/config";
import createJiti from "jiti";
import { withWorkflow } from "workflow/next";

// Import env files to validate at build time. Use jiti so we can load .ts files in here.
createJiti(fileURLToPath(import.meta.url))("./src/env");
const appDirectory = dirname(fileURLToPath(import.meta.url));

/** @type {import("next").NextConfig} */
const config = {
  reactStrictMode: true,

  // Work around xdg-app-paths reading an undefined webpack entry filename
  // while Next collects Workflow route data. Let Next bundle the Sandbox SDK
  // so it uses the SDK's ESM entry; externalizing it selects the CommonJS entry,
  // which cannot require the ESM-only @workflow/serde dependency.
  webpack(webpackConfig, { isServer }) {
    if (isServer) {
      webpackConfig.resolve.alias["xdg-app-paths"] = resolve(
        appDirectory,
        "src/server/xdg-app-paths.cjs",
      );
    }
    return webpackConfig;
  },

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
};

export default withWorkflow(withBotId(config));
