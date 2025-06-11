import type { BetterAuthOptions } from "better-auth";
import { expo } from "@better-auth/expo";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { oAuthProxy } from "better-auth/plugins";

import { db } from "@acme/db/client";

import { env } from "../env";

const origins = [];
if (env.NODE_ENV === "development") origins.push("http://localhost:3000");
if (env.VERCEL_PROJECT_PRODUCTION_URL) origins.push("http://localhost:3000");
if (env.VERCEL_PROJECT_PRODUCTION_URL)
  origins.push(`https://${env.VERCEL_PROJECT_PRODUCTION_URL}`);
if (env.VERCEL_URL) origins.push(`https://${env.VERCEL_URL}`);

export const config = {
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
  secret: env.AUTH_SECRET,
  plugins: [oAuthProxy(), expo()],
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
  },
  socialProviders: {
    github: {
      clientId: env.AUTH_GITHUB_ID,
      clientSecret: env.AUTH_GITHUB_SECRET,
      redirectURI: "http://localhost:3000/api/auth/callback/discord",
    },
  },
  trustedOrigins: ["exp://", ...origins],
  advanced: {
    crossSubDomainCookies: {
      enabled: true,
    },
  },
} satisfies BetterAuthOptions;

export const auth = betterAuth(config);
export type Session = typeof auth.$Infer.Session;
