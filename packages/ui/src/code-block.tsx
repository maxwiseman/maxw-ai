"use client";

import React, { useEffect, useState } from "react";
import { IconCheck, IconCopy } from "@tabler/icons-react";
import { codeToHtml } from "shiki";

import { cn } from ".";
import { Button } from "./button";

export type CodeBlockProps = {
  children?: React.ReactNode;
  className?: string;
} & React.HTMLProps<HTMLDivElement>;

function CodeBlock({ children, className, ...props }: CodeBlockProps) {
  return (
    <div
      className={cn(
        "not-prose flex w-full flex-col overflow-clip border",
        "border-border bg-card text-card-foreground rounded-xl",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export type CodeBlockCodeProps = {
  code: string;
  language?: string;
  theme?: string;
  className?: string;
} & React.HTMLProps<HTMLDivElement>;

function CodeBlockCode({
  code,
  language = "tsx",
  theme = "github-light",
  className,
  ...props
}: CodeBlockCodeProps) {
  const [highlightedHtml, setHighlightedHtml] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function highlight() {
      if (!code) {
        setHighlightedHtml("<pre><code></code></pre>");
        return;
      }

      const html = await codeToHtml(code, { lang: language, theme });
      setHighlightedHtml(html);
    }
    highlight().catch(console.error);
  }, [code, language, theme]);

  const classNames = cn(
    "w-full overflow-x-auto text-[13px] [&>pre]:px-4 [&>pre]:py-4",
    className,
  );

  // SSR fallback: render plain code if not hydrated yet
  return highlightedHtml ? (
    <div className="bg-secondary rounded-xl">
      <div className="text-foreground/50 flex items-center justify-between p-0.5 font-mono text-sm">
        <div className="relative top-0.5 p-1 px-3">{language}</div>
        <Button
          className="hover:bg-foreground/3 aspect-square size-7 rounded-sm rounded-tr-xl"
          size="icon"
          variant="ghost"
          onClick={() => {
            navigator.clipboard
              .write([
                new ClipboardItem({
                  "text/plain": code,
                  "text/html": new Blob([highlightedHtml], {
                    type: "text/html",
                  }),
                }),
              ])
              .catch(console.error);
            setCopied(true);
            setTimeout(() => {
              setCopied(false);
            }, 1000);
          }}
        >
          {copied ? (
            <IconCheck className="size-4" />
          ) : (
            <IconCopy className="size-4" />
          )}
        </Button>
      </div>
      <div
        className={cn(
          "not-prose flex w-full flex-col overflow-clip border",
          "border-border bg-card text-card-foreground rounded-xl",
          className,
        )}
        {...props}
      >
        <div
          className={classNames}
          dangerouslySetInnerHTML={{ __html: highlightedHtml }}
          {...props}
        />
      </div>
    </div>
  ) : (
    <div>
      {language}
      <div
        className={cn(
          "not-prose flex w-full flex-col overflow-clip border",
          "border-border bg-card text-card-foreground rounded-xl",
          className,
        )}
        {...props}
      >
        <pre>
          <code>{code}</code>
        </pre>
      </div>
    </div>
  );
}

export type CodeBlockGroupProps = React.HTMLAttributes<HTMLDivElement>;

function CodeBlockGroup({
  children,
  className,
  ...props
}: CodeBlockGroupProps) {
  return (
    <div
      className={cn("flex items-center justify-between", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export { CodeBlockGroup, CodeBlockCode, CodeBlock };
