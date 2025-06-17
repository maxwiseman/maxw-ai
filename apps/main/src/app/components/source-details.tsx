import type { SourceUrlUIPart } from "ai";
import { useQuery } from "@tanstack/react-query";

import { Avatar, AvatarImage } from "@acme/ui/avatar";
import { Button } from "@acme/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@acme/ui/popover";

import { getSourceDetails } from "./source-actions";

export function SourceDetails({
  children,
  sources,
}: {
  children: React.ReactNode;
  sources: SourceUrlUIPart[];
}) {
  const { data, isLoading } = useQuery({
    staleTime: Infinity,
    gcTime: Infinity,
    queryKey: ["source-details", ...sources.map((source) => source.url)],
    queryFn: () => getSourceDetails(sources),
  });
  console.log("source details", data);

  return (
    <Popover>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-96 p-2">
        {isLoading ? (
          <div className="text-muted-foreground flex size-full items-center justify-center text-sm">
            Loading...
          </div>
        ) : (
          <div className="flex max-w-full flex-col gap-2">
            {data?.map((source) => (
              <Button
                key={source.sourceId}
                asChild
                variant="ghost"
                className="flex h-auto w-full items-start justify-start gap-2 px-2 py-2 text-left whitespace-normal"
              >
                <a target="_blank" href={source.url}>
                  <Avatar className="relative top-1 size-6 rounded-sm">
                    <AvatarImage
                      className="object-contain"
                      src={`https://www.google.com/s2/favicons?domain=${new URL(source.url).hostname}&sz=64`}
                    />
                  </Avatar>
                  <div>
                    <div className="line-clamp-2 text-sm">
                      {source.result.ogTitle}
                    </div>
                    <div className="text-muted-foreground line-clamp-1 text-sm">
                      {source.result.ogDescription}
                    </div>
                  </div>
                </a>
              </Button>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
