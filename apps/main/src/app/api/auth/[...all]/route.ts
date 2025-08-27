import { NextResponse } from "next/server";
import { checkBotId } from "botid/server";

import { auth } from "@acme/auth";

const handler = auth.handler;

export async function GET(request: Request) {
  // const verification = await checkBotId();

  // if (verification.isBot) {
  //   return NextResponse.json({ error: "Access denied" }, { status: 403 });
  // }

  return await handler(request);
}

export async function POST(request: Request) {
  // const verification = await checkBotId();

  // if (verification.isBot) {
  //   return NextResponse.json({ error: "Access denied" }, { status: 403 });
  // }

  return await handler(request);
}

// export { handler as GET, handler as POST };
