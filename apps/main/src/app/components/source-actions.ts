"use server";

import type { SourceUrlUIPart } from "ai";
import getMetadata from "open-graph-scraper";

export async function getSourceDetails(sources: SourceUrlUIPart[]) {
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
  return sourceDetails;
}
