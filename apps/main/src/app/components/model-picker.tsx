"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

// import { AnimatePresence, motion } from "motion/react";

import { Button } from "@acme/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@acme/ui/dropdown-menu";

import type { ModelId } from "~/lib/model-utils";
import { models } from "~/lib/models";
import { getAvailableModels } from "./chat-actions";

// const MotionButton = motion(Button);

export function ModelPicker({
  value,
  onValueChange,
}: {
  value?: ModelId;
  onValueChange?: (value: ModelId) => void;
}) {
  const availableModelQuery = useQuery({
    queryKey: ["available-models"],
    queryFn: getAvailableModels,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
    refetchInterval: 48 * 60 * 60 * 1000,
  });
  const [internalValue, setInternalValue] = useState(value);
  const model = value ?? internalValue;
  const setModel = onValueChange ?? setInternalValue;

  const [isOpen, setIsOpen] = useState(false);
  const selectedModel = model ? models[model] : undefined;

  const availableModels = availableModelQuery.data
    ? Object.fromEntries(
        Object.entries(models).filter(([modelId]) =>
          availableModelQuery.data.includes(modelId as ModelId),
        ),
      )
    : models;

  //   const MotionIcon = selectedModel?.brand.icon
  //     ? motion(selectedModel.brand.icon)
  //     : () => null;

  const Icon = selectedModel?.brand.icon ?? (() => null);

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger className="transition-colors" asChild>
        <Button
          //   layout
          //   key="model-picker-button-icon"
          variant="outline"
          className="flex items-center justify-center overflow-y-hidden rounded-full"
          style={{
            borderRadius: 1000000,
          }}
        >
          {selectedModel ? (
            <>
              <Icon
                // layout
                // key={`${selectedModel.brand.name}-icon`}
                className="!size-4"
              />
              {/* <motion.div layout key={`${model}-text`}> */}
              <span className="line-clamp-1">{selectedModel.name}</span>
              {/* </motion.div> */}
            </>
          ) : (
            "Select a model"
          )}
          {/* <ChevronDown
                className={cn(
                  "!size-4 transition-transform",
                  isOpen && "rotate-180",
                )}
              /> */}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="mt-8 grid max-h-96 grid-cols-3 gap-2 p-4"
        side="top"
        align="end"
      >
        {Object.entries(availableModels).map(([modelId, model]) => (
          <ModelButton
            onClick={() => {
              setModel(modelId as ModelId);
              setIsOpen(false);
            }}
            key={modelId}
            model={model}
          />
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ModelButton({
  model,
  onClick,
}: {
  model: (typeof models)[ModelId];
  onClick: () => void;
}) {
  const Icon = model?.brand.icon ?? (() => null);
  return (
    <Button
      className="h-full min-h-max max-w-36 flex-col"
      variant="outline"
      onClick={onClick}
    >
      <Icon className="!size-8" />
      <div>
        <div className="text-lg text-wrap">{model.name}</div>
        <div className="text-muted-foreground text-sm">{model.brand.name}</div>
      </div>
    </Button>
  );
}
