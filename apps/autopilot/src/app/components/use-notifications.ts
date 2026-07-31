"use client";

import { useCallback, useEffect, useState } from "react";

interface NotificationState {
  configured: boolean;
  publicKey: string | null;
  subscribed: boolean;
}

function decodePublicKey(value: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
}

export function useNotifications() {
  const supported =
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window;
  const [state, setState] = useState<NotificationState>({
    configured: false,
    publicKey: null,
    subscribed: false,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supported) {
      setLoading(false);
      return;
    }
    void fetch("/api/autopilot/notifications", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        setState((await response.json()) as NotificationState);
      })
      .catch((error) =>
        console.warn("Failed to load notification settings", error),
      )
      .finally(() => setLoading(false));
  }, [supported]);

  const setEnabled = useCallback(
    async (enabled: boolean) => {
      if (!supported || !state.configured || !state.publicKey) return;
      setLoading(true);
      try {
        const registration =
          await navigator.serviceWorker.register("/autopilot-sw.js");
        if (enabled) {
          const permission = await Notification.requestPermission();
          if (permission !== "granted") {
            throw new Error("Notification permission was not granted");
          }
          const subscription =
            (await registration.pushManager.getSubscription()) ??
            (await registration.pushManager.subscribe({
              applicationServerKey: decodePublicKey(state.publicKey),
              userVisibleOnly: true,
            }));
          const response = await fetch("/api/autopilot/notifications", {
            body: JSON.stringify(subscription.toJSON()),
            headers: { "Content-Type": "application/json" },
            method: "POST",
          });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          setState((current) => ({ ...current, subscribed: true }));
        } else {
          const subscription = await registration.pushManager.getSubscription();
          if (subscription) {
            await fetch(
              `/api/autopilot/notifications?endpoint=${encodeURIComponent(subscription.endpoint)}`,
              { method: "DELETE" },
            );
            await subscription.unsubscribe();
          } else {
            await fetch("/api/autopilot/notifications", { method: "DELETE" });
          }
          setState((current) => ({ ...current, subscribed: false }));
        }
      } catch (error) {
        console.error("Failed to update notification settings", error);
      } finally {
        setLoading(false);
      }
    },
    [state.configured, state.publicKey, supported],
  );

  return {
    configured: state.configured,
    enabled: state.subscribed,
    loading,
    setEnabled,
    supported,
  };
}
