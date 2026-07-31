import { createEnv } from "@t3-oss/env-nextjs";
import { vercel } from "@t3-oss/env-nextjs/presets-zod";
import { z } from "zod";

import { env as authEnv } from "@acme/auth/env";

export const env = createEnv({
  extends: [authEnv, vercel()],
  shared: {
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
  },
  /**
   * Specify your server-side environment variables schema here.
   * This way you can ensure the app isn't built with invalid env vars.
   */
  server: {
    DATABASE_URL: z.string().url(),
    DATABASE_AUTH_TOKEN: z.string(),
    OPENAI_API_KEY: z.string().min(1).optional(),
    AUTOPILOT_WORKER_SECRET: z.string().min(32).optional(),
    AUTOPILOT_SANDBOX_REPO_URL: z
      .string()
      .url()
      .default("https://github.com/maxwiseman/maxw-ai.git"),
    AUTOPILOT_SANDBOX_REPO_REF: z.string().min(1).default("master"),
    AUTOPILOT_SANDBOX_REPO_USERNAME: z.string().min(1).optional(),
    AUTOPILOT_SANDBOX_REPO_PASSWORD: z.string().min(1).optional(),
    AUTOPILOT_SANDBOX_VCPUS: z.coerce.number().int().min(1).max(8).default(4),
    VERCEL_GIT_COMMIT_SHA: z.string().min(1).optional(),
    VERCEL_TOKEN: z.string().min(1).optional(),
    VERCEL_TEAM_ID: z.string().min(1).optional(),
    VERCEL_PROJECT_ID: z.string().min(1).optional(),
  },

  /**
   * Specify your client-side environment variables schema here.
   * For them to be exposed to the client, prefix them with `NEXT_PUBLIC_`.
   */
  client: {
    // NEXT_PUBLIC_CLIENTVAR: z.string(),
  },
  /**
   * Destructure all variables from `process.env` to make sure they aren't tree-shaken away.
   */
  experimental__runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    // NEXT_PUBLIC_CLIENTVAR: process.env.NEXT_PUBLIC_CLIENTVAR,
  },
  skipValidation:
    !!process.env.CI || process.env.npm_lifecycle_event === "lint",
});
