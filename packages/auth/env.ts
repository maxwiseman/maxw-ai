import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    VERCEL_URL: z.string().min(1).optional(),
    VERCEL_PROJECT_PRODUCTION_URL: z.string().min(1).optional(),
    VERCEL_BRANCH_URL: z.string().min(1).optional(),
    AUTH_GITHUB_ID: z.string().min(1),
    BETTER_AUTH_URL: z.string().min(1),
    AUTH_GITHUB_SECRET: z.string().min(1),
    AUTH_SECRET:
      process.env.NODE_ENV === "production"
        ? z.string().min(1)
        : z.string().min(1).optional(),
    NODE_ENV: z.enum(["development", "production"]).optional(),
  },
  client: {},
  experimental__runtimeEnv: {},
  skipValidation:
    !!process.env.CI || process.env.npm_lifecycle_event === "lint",
});
