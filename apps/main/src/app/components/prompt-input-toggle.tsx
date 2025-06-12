"use client";

import type { ReactNode } from "react";
import React, { useState } from "react";
import { SelectTrigger } from "@radix-ui/react-select";
import { ChevronDown } from "lucide-react";

import { Button } from "@acme/ui/button";
import { PromptInputAction } from "@acme/ui/prompt-input";
import { Select, SelectContent, SelectItem } from "@acme/ui/select";

import type { ModelFeature, ModelFeatureReturn } from "~/lib/model-utils";
import { cn } from "~/lib/utils";

interface SelectProps {
  value?: ModelFeatureReturn;
  onValueChange?: (value: ModelFeatureReturn) => void;
  children?: ReactNode;
  iconOnly?: boolean;
  feature: ModelFeature;
}
export function PromptInputSelect({
  iconOnly,
  feature,
  onValueChange,
  //   value,
}: SelectProps) {
  const isLocked =
    !feature.option ||
    (feature.option.type === "select" && feature.option.forceEnabled);
  const [internalState, setInternalState] = useState<ModelFeatureReturn>({
    enabled: isLocked
      ? true
      : feature.option?.type === "toggle"
        ? feature.option.defaultValue
        : false,
    value:
      feature.option?.type === "select" ? feature.option.defaultValue : null,
  });

  return (
    <Select
      value={internalState.value ?? ""}
      onValueChange={(val) => {
        setInternalState((prev) => ({ ...prev, value: val }));
        onValueChange?.({ ...internalState, value: val });
      }}
    >
      <div>
        <PromptInputAction tooltip={feature.display.tooltip}>
          <Button
            onClick={() => {
              if (!isLocked)
                setInternalState(() => ({
                  ...internalState,
                  enabled: !internalState.enabled,
                }));
              onValueChange?.({
                ...internalState,
                enabled: !internalState.enabled,
              });
            }}
            variant="outline"
            className={cn(
              "justify-start overflow-hidden rounded-full",
              iconOnly ? "w-9 !px-[9px] hover:w-auto" : "",
              feature.option?.type === "select" ? "rounded-r-none !pr-2.5" : "",
              internalState.enabled === true &&
                "dark:border-500/50 border-blue-500/50 bg-blue-50 text-blue-500 hover:border-blue-600/50 hover:bg-blue-100/70 hover:text-blue-600 dark:border-blue-500/50 dark:bg-blue-500/30 dark:text-blue-400 dark:hover:bg-blue-500/20 dark:hover:text-blue-500",
            )}
          >
            <feature.display.icon />
            {internalState.value && feature.option?.type === "select"
              ? feature.option.values.find(
                  (v) => v.value === internalState.value,
                )?.label
              : feature.display.label}
          </Button>
        </PromptInputAction>
        {feature.option?.type === "select" && (
          <SelectTrigger asChild>
            <Button
              className={cn(
                "w-auto rounded-full rounded-l-none border-l-0 px-2 pl-1.5",
                internalState.enabled === true &&
                  "dark:border-500/50 border-blue-500/50 bg-blue-50 text-blue-500 hover:border-blue-600/50 hover:bg-blue-100/70 hover:text-blue-600 dark:border-blue-500/50 dark:bg-blue-500/30 dark:text-blue-400 dark:hover:bg-blue-500/20 dark:hover:text-blue-500",
              )}
              variant="outline"
              size="icon"
            >
              <ChevronDown />
            </Button>
          </SelectTrigger>
        )}
      </div>
      <SelectContent>
        {feature.option?.type === "select" &&
          feature.option.values.map((value) => (
            <SelectItem key={value.value} value={value.value}>
              {/* eslint-disable-next-line @typescript-eslint/no-unnecessary-condition */}
              {value.icon && <value.icon />}
              {value.label}
            </SelectItem>
          ))}
      </SelectContent>
    </Select>
  );
}
