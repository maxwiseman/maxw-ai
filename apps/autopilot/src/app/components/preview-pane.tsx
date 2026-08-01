"use client";

import type { ProvisioningStage } from "./state-store";
import { cn } from "~/lib/utils";
import { useLiveState } from "./state-store";

const startupSteps = [
  "Prepare environment",
  "Create sandbox",
  "Start browser",
  "Connect preview",
] as const;

function activeStep(stage: ProvisioningStage | null): number {
  if (stage === "creating_sandbox") return 1;
  if (stage === "starting_worker") return 2;
  if (stage === "connecting") return 3;
  return 0;
}

function stageDescription(stage: ProvisioningStage | null): string {
  if (stage === "installing_dependencies") {
    return "Installing dependencies and Chrome for this deployment";
  }
  if (stage === "restoring_snapshot") {
    return "Loading the prepared dependency snapshot";
  }
  if (stage === "creating_sandbox") {
    return "Starting an isolated browser session";
  }
  if (stage === "starting_worker") return "Launching the browser worker";
  if (stage === "connecting") return "Opening the live preview stream";
  return "Checking for a prepared environment";
}

function StartupChecklist({ stage }: { stage: ProvisioningStage | null }) {
  const current = activeStep(stage);

  return (
    <div
      aria-live="polite"
      className="bg-background/70 w-full max-w-md rounded-xl border p-5 font-mono shadow-sm backdrop-blur-sm"
    >
      <div className="text-muted-foreground mb-5 flex items-center justify-between text-[11px] tracking-[0.18em] uppercase">
        <span>Autopilot boot</span>
        <span>{String(current + 1).padStart(2, "0")}/04</span>
      </div>
      <ol className="space-y-3">
        {startupSteps.map((label, index) => {
          const complete = index < current;
          const active = index === current;
          return (
            <li
              className={cn("flex items-center gap-3 text-sm", {
                "text-muted-foreground/45": index > current,
                "text-muted-foreground": complete,
                "text-foreground": active,
              })}
              key={label}
            >
              <span
                aria-hidden="true"
                className={cn("text-center text-nowrap", {
                  "text-emerald-500": complete,
                  "animate-pulse": active,
                })}
              >
                {complete ? "[✓]" : active ? "[•]" : "[ ]"}
              </span>
              <span>{label}</span>
            </li>
          );
        })}
      </ol>
      <div className="text-muted-foreground mt-5 border-t pt-4 text-xs leading-relaxed">
        <span className="text-foreground">$</span> {stageDescription(stage)}
        <span className="animate-pulse">_</span>
      </div>
    </div>
  );
}

export function PreviewPane() {
  const { isProvisioning, previewUrl, provisioningStage, status } =
    useLiveState();

  const open = true;

  return (
    <div
      className={cn(
        "bg-card flex size-full items-center justify-center rounded-l-3xl border-l p-8 shadow-xl transition-[width,padding]",
        { "w-0 px-0": !open },
      )}
    >
      {isProvisioning && provisioningStage ? (
        <StartupChecklist stage={provisioningStage} />
      ) : status === "running" && previewUrl ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="rounded-md border shadow-xl/2"
            referrerPolicy="no-referrer"
            src={previewUrl}
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
