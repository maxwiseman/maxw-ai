"use client";

import { modelFeatures } from "~/lib/models";
import { ModelPicker } from "../components/model-picker";
import { PromptInputSelect } from "../components/prompt-input-toggle";

export default function TestPage() {
  return (
    <div className="flex size-full flex-col items-center justify-center gap-4">
      <ModelPicker />
      <PromptInputSelect feature={modelFeatures.thinkSelect} iconOnly={false} />
      <PromptInputSelect
        feature={modelFeatures.searchToggle}
        iconOnly={false}
      />
    </div>
  );
}
