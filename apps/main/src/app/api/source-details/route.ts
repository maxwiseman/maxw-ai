import type { SourceUrlUIPart } from "ai";
import getMetadata from "open-graph-scraper-lite";

export const runtime = "edge";
export const preferredRegion = "global";

export async function POST(request: Request) {
  const sources = (await request.json()) as SourceUrlUIPart[];

  const sourceDetails = await Promise.all(
    sources.map(async (source) => {
      const metadata = await getMetadata({
        html: await fetch(source.url).then((res) => res.text()),
      });
      return {
        ...source,
        ...metadata,
      };
    }),
  );

  return Response.json(sourceDetails);
}
