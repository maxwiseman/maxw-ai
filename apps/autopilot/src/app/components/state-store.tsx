import type { z } from "zod";
import { useEffect } from "react";
import useWebsocket, { ReadyState } from "react-use-websocket";
import { create } from "zustand";

import type { WSClientMessageSchema } from "@acme/autopilot-backend/message-schema";
import { WSServerMessageSchema } from "@acme/autopilot-backend/message-schema";

import { env } from "~/env";

// Define status types directly to avoid import issues
export interface StatusUpdate {
  id: string;
  type: "success" | "pending" | "error";
  message: string;
  description?: string;
  timestamp: number;
}

interface AutopilotState {
  status: "running" | "stopped";
  wsStatus: "connected" | "connecting" | "disconnected" | "disconnecting";
  updates: string[];
  statuses: StatusUpdate[];
  updateState: (newState: Partial<AutopilotState>) => void;
  addStatus: (status: StatusUpdate) => void;
  updateStatus: (status: StatusUpdate) => void;
  setStatuses: (statuses: StatusUpdate[]) => void;
  clearStatuses: () => void;
}

export const useStateStore = create<AutopilotState>()((set, get) => ({
  status: "stopped",
  wsStatus: "disconnected",
  updates: [],
  statuses: [],
  updateState: (newState) => {
    set((state) => {
      const updatedState = { ...state, ...newState };

      // If status is being set to stopped, mark all pending statuses as error
      if (newState.status === "stopped") {
        updatedState.statuses = state.statuses.map((status) =>
          status.type === "pending"
            ? {
                ...status,
                type: "error" as const,
                description: "Automation stopped",
              }
            : status,
        );
      }

      return updatedState;
    });
  },
  addStatus: (status) => {
    set((state) => ({
      statuses: [...state.statuses, status],
    }));
  },
  updateStatus: (status) => {
    set((state) => ({
      statuses: state.statuses.map((s) => (s.id === status.id ? status : s)),
    }));
  },
  setStatuses: (statuses) => {
    set({ statuses });
  },
  clearStatuses: () => {
    set({ statuses: [] });
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

    try {
      const parsedMessage = WSServerMessageSchema.parse(ws.lastJsonMessage);

      if (parsedMessage.type === "newState") {
        stateStore.updateState(parsedMessage.state);
      } else if (parsedMessage.type === "statusUpdate") {
        // Check if this status already exists (update) or is new (add)
        const existingStatus = stateStore.statuses.find(
          (s) => s.id === parsedMessage.status.id,
        );
        if (existingStatus) {
          stateStore.updateStatus(parsedMessage.status);
        } else {
          stateStore.addStatus(parsedMessage.status);
        }
      } else if (parsedMessage.type === "statusList") {
        stateStore.setStatuses(parsedMessage.statuses);
      }
    } catch (error) {
      console.warn("Failed to parse websocket message:", error);
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
