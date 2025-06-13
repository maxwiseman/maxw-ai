"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

import { Button } from "@acme/ui/button";
import { MagicIcon } from "@acme/ui/magic-icon";

import { modelFeatures } from "~/lib/models";
import { ChatShareModal } from "../components/chat-share-modal";
import { ModelPicker } from "../components/model-picker";
import { PromptInputSelect } from "../components/prompt-input-toggle";

export default function TestPage() {
  const [enabled, setEnabled] = useState(false);

  return (
    <div className="flex size-full flex-col items-center justify-center gap-4">
      <ModelPicker />
      <PromptInputSelect feature={modelFeatures.thinkSelect} iconOnly={false} />
      <PromptInputSelect
        feature={modelFeatures.searchToggle}
        iconOnly={false}
      />
      <ChatShareModal chatId="846521a0-d823-4c41-bd6e-fc0c23d97c05" />
      <Button
        size="icon"
        variant="outline"
        onClick={() => setEnabled(!enabled)}
        className="overflow-hidden"
      >
        {/* <AnimatePresence mode="wait"> */}
        <MagicIcon
          transition="ticker"
          animationKey={enabled ? "enabled" : "disabled"}
        >
          {enabled ? <Check /> : <X />}
        </MagicIcon>
        {/* <motion.div
            key={enabled ? "enabled" : "disabled"}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0, transition: { duration: 1 } }}
            transition={{ duration: 1, ease: "easeInOut" }}
          >
            {enabled ? <Check /> : <X />}
          </motion.div> */}
        {/* </AnimatePresence> */}
      </Button>
    </div>
  );
}
