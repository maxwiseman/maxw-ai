import { Button } from "@acme/ui/button";
import { AutopilotIcon } from "@acme/ui/custom-icons";

import { cn } from "~/lib/utils";
import { InfoPane } from "./components/info-pane";
import { PreviewPane } from "./components/preview-pane";

export default function Loading() {
  return (
    <div className="bg-muted/40 dark:bg-background flex h-full max-h-svh w-full overflow-hidden">
      <div className="size-full overflow-y-scroll">
        <nav className="sticky top-0 flex h-20 w-full items-center justify-between border-b bg-[#FBFBFB] px-8 dark:bg-[#0A0A0A]">
          <div className="flex items-center gap-2">
            <AutopilotIcon className={"size-8"} />
            <div className="cursor-default text-4xl font-semibold">
              Autopilot
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              disabled
              className={cn(
                "h-auto w-auto overflow-clip border px-3 py-1 shadow-sm",
              )}
            >
              <div className="relative h-5 w-8">Start </div>
            </Button>
          </div>
        </nav>

        <InfoPane />
      </div>
      <PreviewPane />
    </div>
  );
}
