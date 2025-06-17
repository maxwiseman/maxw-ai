import type { z } from "zod";
import { useEffect } from "react";
import useWebsocket, { ReadyState } from "react-use-websocket";
import { create } from "zustand";

import type { WSClientMessageSchema } from "@acme/autopilot-backend/message-schema";
import { WSServerMessageSchema } from "@acme/autopilot-backend/message-schema";

import { env } from "~/env";

interface AutopilotState {
  status: "running" | "stopped";
  wsStatus: "connected" | "connecting" | "disconnected" | "disconnecting";
  updates: string[];
  updateState: (newState: Partial<AutopilotState>) => void;
}

export const useStateStore = create<AutopilotState>()((set) => ({
  status: "stopped",
  wsStatus: "disconnected",
  updates: [],
  updateState: (newState) => {
    set(newState);
  },
}));

export function useLiveState() {
  const ws = useWebsocket(`${env.NEXT_PUBLIC_BACKEND_URL}/ws`, {
    reconnectAttempts: 3,
    shouldReconnect: () => true,
  });
  const stateStore = useStateStore();

  useEffect(() => {
    if (
      typeof ws.lastJsonMessage !== "object" ||
      //   @ts-expect-error -- This is ok, we expect it to be undefined
      ws.lastJsonMessage?.type === undefined
    )
      return;

    const parsedMessage = WSServerMessageSchema.parse(ws.lastJsonMessage);

    if (parsedMessage.type === "newState") {
      stateStore.updateState(parsedMessage.state);
    }
  }, [ws.lastJsonMessage]);

  useEffect(() => {
    stateStore.updateState({
      wsStatus: {
        [ReadyState.CONNECTING]: "connecting" as const,
        [ReadyState.OPEN]: "connected" as const,
        [ReadyState.CLOSING]: "disconnecting" as const,
        [ReadyState.CLOSED]: "disconnected" as const,
        [ReadyState.UNINSTANTIATED]: "disconnected" as const,
      }[ws.readyState],
    });
  }, [ws.readyState]);

  return {
    ...stateStore,
    sendMessage: (data: z.input<typeof WSClientMessageSchema>) => {
      ws.sendJsonMessage(data);
    },
  };
}
