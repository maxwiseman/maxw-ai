"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
  useAnimationFrame,
  useMotionValue,
} from "motion/react";

import { Button } from "@acme/ui/button";
import { AutopilotIcon } from "@acme/ui/custom-icons";

import { cn } from "~/lib/utils";
import { InviteButton } from "./invites";
import { useLiveState } from "./state-store";

export function Navbar() {
  const { wsStatus, status, sendMessage } = useLiveState();

  return (
    <nav className="sticky top-0 flex h-20 w-full items-center justify-between border-b bg-[#FBFBFB] px-8 dark:bg-[#0A0A0A]">
      <div className="flex items-center gap-2">
        {/* <Logo
          className={cn("size-8.5", {
            "animate-[spin_2.5s_linear_infinite]": running,
          })}
        /> */}
        <SpinningLogo spin={status === "running"} />
        <div className="cursor-default text-4xl font-semibold">Autopilot</div>
      </div>
      <div className="flex gap-2">
        <InviteButton />
        <Button
          disabled={wsStatus !== "connected"}
          onClick={() => {
            //   setRunning((prev) => !prev);
            sendMessage({ type: status === "running" ? "stop" : "start" });
          }}
          className={cn(
            "h-auto w-auto overflow-clip border px-3 py-1 shadow-sm",
            { "border-transparent": status !== "running" },
          )}
          variant={status === "running" ? "outline" : "default"}
        >
          <div className="relative h-5 w-8">
            <AnimatePresence initial={false}>
              <motion.div
                key={status === "running" ? "stop" : "start"}
                className="absolute top-1/2 left-1/2 -translate-1/2"
                transition={{
                  type: "spring",
                  bounce: 0,
                  duration: 0.75,
                }}
                initial={{
                  rotateX: status === "running" ? 90 : -90,
                  filter: "blur(1px)",
                  opacity: 0,
                }}
                animate={{ rotateX: 0, filter: "blur(0px)", opacity: 1 }}
                exit={{
                  rotateX: status === "running" ? 90 : -90,
                  filter: "blur(1px)",
                  opacity: 0,
                }}
                style={{
                  transformOrigin: "50% 50% -15px",
                  perspective: 200,
                }}
              >
                {status === "running" ? "Stop" : "Start"}
              </motion.div>
            </AnimatePresence>
          </div>
        </Button>
      </div>
    </nav>
  );
}

export default function SpinningLogo({ spin }: { spin: boolean }) {
  useEffect(() => {
    if (spin && (phase === "idle" || phase === "decel")) {
      start();
    } else if (!spin && (phase === "spinning" || phase === "ramping")) {
      stop();
    }
  }, [spin]);

  const rotate = useMotionValue(0);

  // phase: "idle" | "ramping" | "spinning" | "decel"
  const [phase, setPhase] = useState<"idle" | "ramping" | "spinning" | "decel">(
    "idle",
  );

  const speedRef = useRef(0);

  const TARGET_SPEED = 360 / 2000;

  // how quickly to accelerate / decelerate (per‐frame multiplier)
  const RAMP_FACTOR = 1.02; // >1 accelerates up
  const FRICTION = 0.98; // <1 decelerates down

  useAnimationFrame((_, delta) => {
    // advance rotation if in any moving phase
    if (phase !== "idle") {
      rotate.set(rotate.get() + speedRef.current * delta);
    }

    // handle ramp-up
    if (phase === "ramping") {
      speedRef.current *= RAMP_FACTOR;
      if (speedRef.current >= TARGET_SPEED) {
        speedRef.current = TARGET_SPEED;
        setPhase("spinning");
      }
    }

    // handle deceleration
    if (phase === "decel") {
      speedRef.current *= FRICTION;
      if (speedRef.current <= 0.005) {
        speedRef.current = 0;
        setPhase("idle");
      }
    }
  });

  function start() {
    // kick off from zero
    speedRef.current = Math.max(0.05, speedRef.current); // small initial “nudge”
    setPhase("ramping");
  }

  function stop() {
    setPhase("decel");
  }

  return (
    <motion.div style={{ rotate }} className="size-8">
      <AutopilotIcon />
    </motion.div>
  );
}
