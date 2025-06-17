"use client";

import { motion } from "motion/react";

import { Configuration } from "./configuration";
import { useLiveState } from "./state-store";

export function InfoPane() {
  const state = useLiveState();

  return (
    <>
      {state.status === "stopped" ? (
        <motion.div
          className="flex flex-col gap-8 p-8"
          key="config"
          initial={{}}
        >
          <Configuration />
        </motion.div>
      ) : (
        <motion.div className="flex flex-col gap-8 p-8" key="status-updates">
          {}
        </motion.div>
      )}
    </>
  );
}
