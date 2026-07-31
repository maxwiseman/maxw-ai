import { z } from "zod";

const WorkerTokenPayloadSchema = z.object({
  runId: z.string().min(1),
  userId: z.string().min(1),
  exp: z.number().int().positive(),
});

export type WorkerTokenPayload = z.infer<typeof WorkerTokenPayloadSchema>;

function encode(value: string | Uint8Array): string {
  return Buffer.from(value).toString("base64url");
}

function decode(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

async function getSigningKey(secret: string) {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { hash: "SHA-256", name: "HMAC" },
    false,
    ["sign", "verify"],
  );
}

export async function createWorkerToken(
  payload: Omit<WorkerTokenPayload, "exp"> & { expiresInSeconds: number },
  secret: string,
): Promise<string> {
  const header = encode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = encode(
    JSON.stringify({
      runId: payload.runId,
      userId: payload.userId,
      exp: Math.floor(Date.now() / 1000) + payload.expiresInSeconds,
    } satisfies WorkerTokenPayload),
  );
  const unsigned = `${header}.${body}`;
  const signature = await crypto.subtle.sign(
    "HMAC",
    await getSigningKey(secret),
    new TextEncoder().encode(unsigned),
  );

  return `${unsigned}.${encode(new Uint8Array(signature))}`;
}

export async function verifyWorkerToken(
  token: string,
  secret: string,
): Promise<WorkerTokenPayload | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [header, body, signature] = parts;
  if (!header || !body || !signature) return null;

  try {
    const valid = await crypto.subtle.verify(
      "HMAC",
      await getSigningKey(secret),
      Buffer.from(signature, "base64url"),
      new TextEncoder().encode(`${header}.${body}`),
    );
    if (!valid) return null;

    const payload = WorkerTokenPayloadSchema.parse(JSON.parse(decode(body)));
    if (payload.exp <= Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}
