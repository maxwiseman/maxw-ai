"use client";

import { useEffect, useState } from "react";
import { Settings } from "lucide-react";
import { motion } from "motion/react";

import { Button } from "@acme/ui/button";

import type { StatusUpdate } from "./state-store";
import { Configuration } from "./configuration";
import { useLiveState } from "./state-store";

function StatusIcon({ type }: { type: StatusUpdate["type"] }) {
  switch (type) {
    case "success":
      return <div className="size-2 rounded-full bg-green-500" />;
    case "error":
      return <div className="size-2 rounded-full bg-red-500" />;
    case "pending":
      return (
        <div className="size-2 animate-pulse rounded-full bg-yellow-500" />
      );
  }
}

function StatusList({ statuses }: { statuses: StatusUpdate[] }) {
  if (statuses.length === 0) {
    return (
      <div className="text-muted-foreground py-8 text-center">
        No status updates yet...
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {statuses
        .sort((a, b) => b.timestamp - a.timestamp)
        .map((status) => (
          <motion.div
            layout="position"
            key={status.id}
            // initial={{ opacity: 0, y: 10 }}
            // animate={{ opacity: 1, y: 0 }}
            className="bg-card flex items-start gap-3 rounded-lg border p-3"
          >
            <div className="mt-1.5">
              <StatusIcon type={status.type} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">{status.message}</div>
              {status.description && (
                <div className="text-muted-foreground mt-1 text-xs">
                  {status.description}
                </div>
              )}
              <div className="text-muted-foreground mt-1 text-xs">
                {new Date(status.timestamp).toLocaleTimeString()}
              </div>
            </div>
          </motion.div>
        ))}
    </div>
  );
}

export function InfoPane() {
  const state = useLiveState();
  const [showConfig, setShowConfig] = useState(true);

  useEffect(() => {
    if (state.status === "running") setShowConfig(false);
  }, [state.status]);

  return (
    <>
      {showConfig ? (
        <motion.div
          className="flex flex-col gap-4 p-8 py-4"
          key="config"
          initial={{}}
        >
          <div className="my-4 flex items-center justify-between">
            <h2 className="text-3xl font-semibold">Configuration</h2>
            {state.statuses.length >= 1 && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowConfig(false)}
              >
                Back
              </Button>
            )}
          </div>
          <Configuration />
        </motion.div>
      ) : (
        <motion.div
          className="flex flex-col gap-4 p-8 py-4"
          key="status-updates"
        >
          <div className="my-4 flex items-center justify-between">
            <h2 className="text-3xl font-semibold">Agent Progress</h2>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowConfig(true)}
            >
              <Settings className="text-muted-foreground" /> Configure
            </Button>
          </div>
          <StatusList statuses={state.statuses} />
        </motion.div>
      )}
    </>
  );
}
