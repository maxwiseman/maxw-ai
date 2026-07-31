"use client";

import type { ReactNode } from "react";
import type { z } from "zod";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import useWebsocket, { ReadyState } from "react-use-websocket";
import { create } from "zustand";

import type { WSClientMessageSchema } from "@acme/autopilot-backend/message-schema";
import { WSServerMessageSchema } from "@acme/autopilot-backend/message-schema";

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
  isProvisioning: boolean;
  previewUrl: string | null;
  updates: string[];
  statuses: StatusUpdate[];
  updateState: (newState: Partial<AutopilotState>) => void;
  addStatus: (status: StatusUpdate) => void;
  updateStatus: (status: StatusUpdate) => void;
  setStatuses: (statuses: StatusUpdate[]) => void;
  clearStatuses: () => void;
}

export const useStateStore = create<AutopilotState>()((set) => ({
  status: "stopped",
  wsStatus: "disconnected",
  isProvisioning: true,
  previewUrl: null,
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

interface RunConnection {
  runId: string;
  status: "ready";
  token: string;
  workerUrl: string;
}

type RunState =
  | RunConnection
  | {
      lastError?: string | null;
      runId: string;
      status: "provisioning" | "stopping" | "stopped" | "error";
    }
  | null;

function workerUrl(connection: RunConnection, path: string): string {
  const url = new URL(path, connection.workerUrl);
  url.searchParams.set("token", connection.token);
  return url.toString();
}

function websocketUrl(connection: RunConnection): string {
  const url = new URL(workerUrl(connection, "/ws"));
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
}

async function fetchRun(method: "GET" | "POST" | "DELETE" = "GET") {
  const response = await fetch("/api/autopilot/run", {
    cache: "no-store",
    method,
  });
  if (method === "DELETE") return null;
  if (!response.ok) throw new Error(`Run request failed (${response.status})`);
  return (await response.json()) as { run: RunState };
}

async function waitForConnection(): Promise<RunConnection> {
  for (let attempt = 0; attempt < 300; attempt += 1) {
    const result = await fetchRun();
    if (result?.run?.status === "ready") return result.run;
    if (result?.run?.status === "error") {
      throw new Error(result.run.lastError ?? "Sandbox provisioning failed");
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error("Sandbox provisioning timed out");
}

// WebSocket Provider Component
export function WebSocketProvider({ children }: { children: ReactNode }) {
  const [connection, setConnection] = useState<RunConnection | null>(null);
  const pendingStartRef = useRef(false);
  const provisioningRef = useRef<Promise<void> | null>(null);

  const endRun = useCallback(async () => {
    try {
      await fetchRun("DELETE");
    } catch (error) {
      console.warn("Failed to request sandbox shutdown", error);
    } finally {
      setConnection(null);
      useStateStore.getState().updateState({
        isProvisioning: false,
        previewUrl: null,
      });
    }
  }, []);

  const provision = useCallback(async () => {
    if (provisioningRef.current) return provisioningRef.current;
    const request = (async () => {
      useStateStore.getState().updateState({ isProvisioning: true });
      try {
        const started = await fetchRun("POST");
        const ready =
          started?.run?.status === "ready"
            ? started.run
            : await waitForConnection();
        setConnection(ready);
        useStateStore.getState().updateState({
          previewUrl: workerUrl(ready, "/mjpeg"),
        });
      } catch (error) {
        console.error("Failed to provision Autopilot sandbox", error);
        pendingStartRef.current = false;
        useStateStore.getState().updateState({ isProvisioning: false });
      } finally {
        provisioningRef.current = null;
      }
    })();
    provisioningRef.current = request;
    return request;
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const current = await fetchRun();
        if (!current) {
          useStateStore.getState().updateState({ isProvisioning: false });
          return;
        }
        const run = current.run;
        if (!run) {
          useStateStore.getState().updateState({ isProvisioning: false });
          return;
        }
        if (run.status === "ready") {
          setConnection(run);
          useStateStore.getState().updateState({
            previewUrl: workerUrl(run, "/mjpeg"),
          });
        } else if (run.status === "provisioning") {
          await provision();
        } else {
          useStateStore.getState().updateState({ isProvisioning: false });
        }
      } catch (error) {
        console.warn("Failed to restore Autopilot run", error);
        useStateStore.getState().updateState({ isProvisioning: false });
      }
    })();
  }, [provision]);

  const ws = useWebsocket(connection ? websocketUrl(connection) : null, {
    reconnectAttempts: 10,
    reconnectInterval: 1_000,
    shouldReconnect: () => connection !== null,
    onError: (event) => {
      console.error("WebSocket error:", event);
    },
    onClose: (event) => {
      console.log("WebSocket closed:", event);
    },
    onOpen: () => {
      console.log("WebSocket opened");
      if (pendingStartRef.current) {
        pendingStartRef.current = false;
        ws.sendJsonMessage({ type: "start" });
      }
      useStateStore.getState().updateState({ isProvisioning: false });
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
        const previousStatus = useStateStore.getState().status;
        useStateStore.getState().updateState(parsedMessage.state);

        // Clear local statuses when automation starts fresh
        if (
          parsedMessage.state.status === "running" &&
          previousStatus === "stopped"
        ) {
          useStateStore.getState().clearStatuses();
        }
        if (
          previousStatus === "running" &&
          parsedMessage.state.status === "stopped"
        ) {
          void endRun();
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
  }, [endRun, ws.lastJsonMessage]);

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
      if (data.type === "start" && ws.readyState !== ReadyState.OPEN) {
        pendingStartRef.current = true;
        void provision();
        return;
      }
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
