"use client";

import { env } from "~/env";
import { cn } from "~/lib/utils";
import { useLiveState } from "./state-store";

export function PreviewPane() {
  const { status } = useLiveState();

  const open = true;

  return (
    <div
      className={cn(
        "bg-card flex size-full items-center justify-center rounded-l-3xl border-l p-8 shadow-xl transition-[width,padding]",
        { "w-0 px-0": !open },
      )}
    >
      {status === "running" ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="rounded-md border shadow-xl/2"
            src={`${env.NEXT_PUBLIC_BACKEND_URL}/mjpeg`}
          />
        </>
      ) : (
        <div className="text-muted-foreground cursor-default select-none">
          Start Autopilot to view its progress...
        </div>
      )}
    </div>
  );
}
