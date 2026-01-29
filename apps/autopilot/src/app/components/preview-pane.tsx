"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { env } from "~/env";
import { cn } from "~/lib/utils";
import { useLiveState } from "./state-store";

// How long to wait without receiving a frame before reloading the stream (ms)
const STREAM_STALL_TIMEOUT = 5000;
// How often to check if the stream has stalled (ms)
const STALL_CHECK_INTERVAL = 1000;

export function PreviewPane() {
  const { status } = useLiveState();
  const [streamKey, setStreamKey] = useState(0);
  const lastFrameTimeRef = useRef<number>(Date.now());

  const open = true;

  // Called when a new MJPEG frame is received
  const handleFrameLoad = useCallback(() => {
    lastFrameTimeRef.current = Date.now();
  }, []);

  // Reload the stream by updating the key (forces img remount)
  const reloadStream = useCallback(() => {
    setStreamKey((prev) => prev + 1);
    lastFrameTimeRef.current = Date.now();
  }, []);

  // Check periodically if the stream has stalled and reload if needed
  useEffect(() => {
    if (status !== "running") return;

    const checkInterval = setInterval(() => {
      const timeSinceLastFrame = Date.now() - lastFrameTimeRef.current;
      if (timeSinceLastFrame > STREAM_STALL_TIMEOUT) {
        console.log(
          `MJPEG stream stalled (no frames for ${timeSinceLastFrame}ms), reloading...`,
        );
        reloadStream();
      }
    }, STALL_CHECK_INTERVAL);

    return () => clearInterval(checkInterval);
  }, [status, reloadStream]);

  // Reset the stream key and last frame time when status changes to running
  useEffect(() => {
    if (status === "running") {
      setStreamKey(0);
      lastFrameTimeRef.current = Date.now();
    }
  }, [status]);

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
            key={streamKey}
            className="rounded-md border shadow-xl/2"
            src={`${env.NEXT_PUBLIC_BACKEND_URL}/mjpeg?_t=${streamKey}`}
            onLoad={handleFrameLoad}
            onError={reloadStream}
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
