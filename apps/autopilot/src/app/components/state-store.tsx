"use client";

import type { ReactNode } from "react";
import type { z } from "zod";
import { createContext, useContext, useEffect } from "react";
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

// Create a context for the WebSocket connection
interface WebSocketContextType {
  sendMessage: (data: z.input<typeof WSClientMessageSchema>) => void;
}

const WebSocketContext = createContext<WebSocketContextType | null>(null);

// WebSocket Provider Component
export function WebSocketProvider({ children }: { children: ReactNode }) {
  const ws = useWebsocket(`${env.NEXT_PUBLIC_BACKEND_URL}/ws`, {
    reconnectAttempts: 3,
    shouldReconnect: () => true,
    onError: (event) => {
      console.error("WebSocket error:", event);
    },
    onClose: (event) => {
      console.log("WebSocket closed:", event);
    },
    onOpen: () => {
      console.log("WebSocket opened");
    },
  });

  useEffect(() => {
    if (
      typeof ws.lastJsonMessage !== "object" ||
      //   @ts-expect-error -- This is ok, we expect it to be undefined
      ws.lastJsonMessage?.type === undefined
    )
      return;

    // Ignore ping messages (heartbeat from server)
    if (
      (ws.lastJsonMessage as { type?: string } | undefined)?.type === "ping"
    ) {
      return;
    }

    try {
      const parsedMessage = WSServerMessageSchema.parse(ws.lastJsonMessage);

      if (parsedMessage.type === "newState") {
        useStateStore.getState().updateState(parsedMessage.state);

        // Clear local statuses when automation starts fresh
        if (
          parsedMessage.state.status === "running" &&
          useStateStore.getState().status === "stopped"
        ) {
          useStateStore.getState().clearStatuses();
        }
      } else if (parsedMessage.type === "statusUpdate") {
        // Check if this status already exists (update) or is new (add)
        const existingStatus = useStateStore
          .getState()
          .statuses.find((s) => s.id === parsedMessage.status.id);
        if (existingStatus) {
          useStateStore.getState().updateStatus(parsedMessage.status);
        } else {
          useStateStore.getState().addStatus(parsedMessage.status);
        }
      } else if (parsedMessage.type === "statusList") {
        useStateStore.getState().setStatuses(parsedMessage.statuses);
      }
    } catch (error) {
      console.warn("Failed to parse websocket message:", error);
    }
  }, [ws.lastJsonMessage]);

  useEffect(() => {
    useStateStore.getState().updateState({
      wsStatus: {
        [ReadyState.CONNECTING]: "connecting" as const,
        [ReadyState.OPEN]: "connected" as const,
        [ReadyState.CLOSING]: "disconnecting" as const,
        [ReadyState.CLOSED]: "disconnected" as const,
        [ReadyState.UNINSTANTIATED]: "disconnected" as const,
      }[ws.readyState],
    });
  }, [ws.readyState]);

  const contextValue: WebSocketContextType = {
    sendMessage: (data: z.input<typeof WSClientMessageSchema>) => {
      ws.sendJsonMessage(data);
    },
  };

  return (
    <WebSocketContext.Provider value={contextValue}>
      {children}
    </WebSocketContext.Provider>
  );
}

// Hook for components to access WebSocket functionality
export function useWebSocketConnection() {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error(
      "useWebSocketConnection must be used within a WebSocketProvider",
    );
  }
  return context;
}

// Simplified hook for accessing state only
export function useLiveState() {
  const stateStore = useStateStore();
  const context = useContext(WebSocketContext);

  // If no WebSocket context, return state-only version
  if (!context) {
    return {
      ...stateStore,
      sendMessage: () => {
        console.warn(
          "WebSocket not available - ensure component is wrapped in WebSocketProvider",
        );
      },
    };
  }

  return {
    ...stateStore,
    sendMessage: context.sendMessage,
  };
}
