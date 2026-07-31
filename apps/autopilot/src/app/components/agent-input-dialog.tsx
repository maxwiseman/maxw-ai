"use client";

import { useEffect, useState } from "react";

import { Button } from "@acme/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@acme/ui/dialog";
import { Textarea } from "@acme/ui/textarea";

import { useLiveState, useStateStore } from "./state-store";

export function AgentInputDialog() {
  const { inputRequest, sendMessage } = useLiveState();
  const [answer, setAnswer] = useState("");

  useEffect(() => setAnswer(""), [inputRequest?.id]);

  function respond(value: string) {
    if (!inputRequest || !value.trim()) return;
    sendMessage({
      answer: value.trim(),
      requestId: inputRequest.id,
      type: "userInput",
    });
    useStateStore.getState().updateState({ inputRequest: null });
  }

  return (
    <Dialog open={!!inputRequest}>
      <DialogContent
        className="sm:max-w-lg"
        onEscapeKeyDown={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Autopilot needs your input</DialogTitle>
          <DialogDescription>{inputRequest?.question}</DialogDescription>
        </DialogHeader>
        {inputRequest?.options?.length ? (
          <div className="grid gap-2">
            {inputRequest.options.map((option) => (
              <Button
                key={option}
                onClick={() => respond(option)}
                variant="outline"
              >
                {option}
              </Button>
            ))}
          </div>
        ) : null}
        <Textarea
          autoFocus
          maxLength={10_000}
          onChange={(event) => setAnswer(event.target.value)}
          placeholder="Type your answer or instructions..."
          value={answer}
        />
        <DialogFooter>
          <Button disabled={!answer.trim()} onClick={() => respond(answer)}>
            Send to Autopilot
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
