import type { BetterAuthOptions } from "better-auth";
import { expo } from "@better-auth/expo";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { oAuthProxy } from "better-auth/plugins";

// import { passkey } from "better-auth/plugins/passkey";

import { db } from "@acme/db/client";

import { env } from "../env";

const origins = [];
if (env.NODE_ENV === "development") origins.push("http://localhost:3000");
if (env.VERCEL_BRANCH_URL) origins.push(`https://${env.VERCEL_BRANCH_URL}`);
if (env.VERCEL_PROJECT_PRODUCTION_URL)
  origins.push(`https://${env.VERCEL_PROJECT_PRODUCTION_URL}`);
if (env.VERCEL_URL) origins.push(`https://${env.VERCEL_URL}`);

export const config = {
  database: drizzleAdapter(db, {
    provider: "sqlite",
  }),
  user: {
    additionalFields: {
      invitedTo: {
        type: "string[]",
        // required: false,
        defaultValue: ["main"],
        input: false,
      },
      invitesRemaining: {
        type: "number",
        defaultValue: 0,
        input: false,
      },
    },
  },
  secret: env.AUTH_SECRET,
  plugins: [
    oAuthProxy(),
    expo(),
    // passkey({
    //   rpID: env.VERCEL_PROJECT_PRODUCTION_URL ?? "localhost",
    //   rpName: "maxw.ai",
    //   origin: env.VERCEL_PROJECT_PRODUCTION_URL
    //     ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`
    //     : "http://localhost:3000",
    //   authenticatorSelection: {
    //     residentKey: "required",
    //     userVerification: "preferred",
    //   },
    // }),
  ],
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
  },
  socialProviders: {
    github: {
      clientId: env.AUTH_GITHUB_ID,
      clientSecret: env.AUTH_GITHUB_SECRET,
      redirectURI:
        env.NODE_ENV === "production"
          ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}/api/auth/callback/github`
          : "http://localhost:3000/api/auth/callback/github",
    },
    google: {
      clientId: env.AUTH_GOOGLE_ID ?? "",
      clientSecret: env.AUTH_GOOGLE_SECRET ?? "",
      redirectURI:
        env.NODE_ENV === "production"
          ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}/api/auth/callback/google`
          : "http://localhost:3000/api/auth/callback/google",
    },
  },
  trustedOrigins: ["exp://", ...origins],
  advanced: {
    crossSubDomainCookies: {
      enabled: true,
      domain: env.NODE_ENV === "production" ? ".maxw.ai" : ".localhost",
    },
  },
} satisfies BetterAuthOptions;

export const auth = betterAuth(config);
export type Session = typeof auth.$Infer.Session;
