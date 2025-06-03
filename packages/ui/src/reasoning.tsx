"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { ChevronDownIcon } from "lucide-react";

import type { Mode } from "./response-stream";
import { cn } from ".";
import { Markdown } from "./markdown";
import { useTextStream } from "./response-stream";

interface ReasoningContextType {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  generating?: boolean;
}

const ReasoningContext = createContext<ReasoningContextType | undefined>(
  undefined,
);

function useReasoningContext() {
  const context = useContext(ReasoningContext);
  if (!context) {
    throw new Error(
      "useReasoningContext must be used within a Reasoning provider",
    );
  }
  return context;
}

export interface ReasoningProps {
  children: React.ReactNode;
  className?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultOpen?: boolean;
  generating?: boolean;
}

function Reasoning({
  children,
  className,
  open,
  generating = false,
  onOpenChange,
  defaultOpen = true,
}: ReasoningProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : internalOpen;
  useEffect(() => {
    setInternalOpen(generating);
  }, [generating]);

  const handleOpenChange = (newOpen: boolean) => {
    if (!isControlled) {
      setInternalOpen(newOpen);
    }
    onOpenChange?.(newOpen);
  };

  return (
    <ReasoningContext.Provider
      value={{
        isOpen,
        onOpenChange: handleOpenChange,
        generating,
      }}
    >
      <div className={className}>{children}</div>
    </ReasoningContext.Provider>
  );
}

export type ReasoningTriggerProps = {
  children: React.ReactNode;
  className?: string;
} & React.HTMLAttributes<HTMLButtonElement>;

function ReasoningTrigger({
  children,
  className,
  ...props
}: ReasoningTriggerProps) {
  const { isOpen, onOpenChange, generating } = useReasoningContext();

  return (
    <button
      className={cn(
        "hover:text-primary text-muted-foreground group flex cursor-pointer items-center gap-2 !bg-clip-text transition-[color,font-weight,opacity]",
        // { "font-medium": isOpen },
        {
          "animate-reasoning !bg-[length:200%] text-transparent": generating,
        },
        className,
      )}
      style={{
        background:
          "linear-gradient(90deg, var(--muted-foreground) 25%, var(--foreground)  50%, var(--muted-foreground) 75%)",
      }}
      onClick={() => onOpenChange(!isOpen)}
      {...props}
    >
      <span>{children}</span>
      <div
        className={cn(
          "text-muted-foreground group-hover:text-primary transition-[color,rotate]",
          isOpen ? "rotate-180" : "",
        )}
      >
        <ChevronDownIcon className="size-4" />
      </div>
    </button>
  );
}

export type ReasoningContentProps = {
  children: React.ReactNode;
  className?: string;
} & React.HTMLAttributes<HTMLDivElement>;

function ReasoningContent({
  children,
  className,
  ...props
}: ReasoningContentProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const { isOpen, generating } = useReasoningContext();

  useEffect(() => {
    if (generating) return;
    if (!contentRef.current || !innerRef.current) return;

    const observer = new ResizeObserver(() => {
      if (contentRef.current && innerRef.current && isOpen) {
        contentRef.current.style.maxHeight = `${innerRef.current.scrollHeight}px`;
      }
    });

    observer.observe(innerRef.current);

    if (isOpen) {
      contentRef.current.style.maxHeight = `${innerRef.current.scrollHeight}px`;
    }

    return () => observer.disconnect();
  }, [isOpen, generating]);

  return (
    <div
      ref={generating ? null : contentRef}
      className={cn(
        "overflow-hidden transition-[max-height,margin-top,margin-bottom] duration-300 ease-out",
        // { "pt-2 pb-6": isOpen },
        className,
      )}
      style={{
        maxHeight: isOpen
          ? generating
            ? "auto"
            : contentRef.current?.scrollHeight
          : "0px",
      }}
      {...props}
    >
      <div className="pt-2 pb-6" ref={generating ? null : innerRef}>
        {children}
      </div>
    </div>
  );
}

export interface ReasoningResponseProps {
  text: string | AsyncIterable<string>;
  className?: string;
  speed?: number;
  mode?: Mode;
  onComplete?: () => void;
  fadeDuration?: number;
  segmentDelay?: number;
  characterChunkSize?: number;
}

function ReasoningResponse({
  text,
  className,
  speed = 20,
  mode = "typewriter",
  onComplete,
  fadeDuration,
  segmentDelay,
  characterChunkSize,
}: ReasoningResponseProps) {
  const { isOpen } = useReasoningContext();
  const { displayedText } = useTextStream({
    textStream: text,
    speed,
    mode,
    onComplete,
    fadeDuration,
    segmentDelay,
    characterChunkSize,
  });

  return (
    <div
      className={cn(
        "text-muted-foreground prose prose-sm dark:prose-invert text-sm transition-opacity duration-300 ease-out",
        className,
      )}
      style={{
        opacity: isOpen ? 1 : 0,
      }}
    >
      <Markdown>{displayedText}</Markdown>
    </div>
  );
}

export { Reasoning, ReasoningTrigger, ReasoningContent, ReasoningResponse };
