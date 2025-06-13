import type { HTMLMotionProps } from "framer-motion";
import { useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";

import { cn } from ".";

const buildTransitions = <T extends string>(
  transitions: Record<
    T,
    HTMLMotionProps<"div"> & { animateMode?: "popLayout" | "wait" | "sync" }
  >,
) => transitions;
export const transitions = buildTransitions({
  scale: {
    initial: { opacity: 0, scale: 0.7, filter: "blur(1px)" },
    animate: { opacity: 1, scale: 1, filter: "blur(0px)" },
    exit: { opacity: 0, scale: 0.7, filter: "blur(1px)" },
    transition: { duration: 0.2, ease: "easeOut" },
  },
  ticker: {
    style: { transformOrigin: "center center 10px" },
    initial: { opacity: 0.5, rotateX: "90deg" },
    animate: { opacity: 1, rotateX: "0deg" },
    exit: {
      opacity: 0.5,
      rotateX: "-90deg",
      transition: { duration: 0.2, ease: "easeIn" },
    },
    transition: { duration: 0.2, ease: "easeOut" },
  },
});

export function MagicIcon({
  children,
  animationKey,
  transition = "scale",
  className,
}: {
  children: React.ReactNode;
  animationKey: string;
  transition?: keyof typeof transitions;
  className?: string;
}) {
  const selectedTransition = transitions[transition];
  const ref = useRef<HTMLDivElement>(null);
  return (
    <AnimatePresence
      initial={false}
      mode={selectedTransition.animateMode ?? "wait"}
    >
      <motion.div
        {...selectedTransition}
        className={cn(selectedTransition.className, className)}
        style={{
          ...selectedTransition.style,
          transformOrigin: `center center ${ref.current?.clientHeight ?? 20 / 2}px`,
        }}
        key={animationKey}
      >
        <div ref={ref}>{children}</div>
      </motion.div>
    </AnimatePresence>
  );
}
