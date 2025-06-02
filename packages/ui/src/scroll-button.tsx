"use client";

import type { VariantProps } from "class-variance-authority";
import { ChevronDownIcon } from "@radix-ui/react-icons";
import { useStickToBottomContext } from "use-stick-to-bottom";

import type { buttonVariants } from "./button";
import { cn } from ".";
import { Button } from "./button";

export type ScrollButtonProps = {
  className?: string;
  variant?: VariantProps<typeof buttonVariants>["variant"];
  size?: VariantProps<typeof buttonVariants>["size"];
} & React.ButtonHTMLAttributes<HTMLButtonElement>;

function ScrollButton({
  className,
  variant = "outline",
  size = "sm",
  ...props
}: ScrollButtonProps) {
  const { isAtBottom, scrollToBottom } = useStickToBottomContext();

  return (
    <div className="bg-background rounded-full">
      <Button
        variant={variant}
        size={size}
        className={cn(
          "h-10 w-10 rounded-full p-0 transition-all duration-150 ease-out",
          !isAtBottom
            ? "translate-y-0 scale-100 opacity-100"
            : "!pointer-events-none translate-y-4 scale-95 opacity-0",
          className,
        )}
        onClick={() => scrollToBottom()}
        {...props}
      >
        <ChevronDownIcon className="!size-5" />
      </Button>
    </div>
  );
}

export { ScrollButton };
