// @ts-nocheck -- This file runs in a ServiceWorkerGlobalScope, not the DOM
self.addEventListener("push", (event) => {
  const data = event.data?.json() ?? {
    title: "Autopilot",
    body: "Autopilot has an update.",
  };
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icon.svg",
      badge: "/icon.svg",
      tag: data.tag,
      data: { url: data.url ?? "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(
      (windows) => {
        const existing = windows.find((client) =>
          client.url.startsWith(self.location.origin),
        );
        if (existing) {
          existing.navigate(event.notification.data.url);
          return existing.focus();
        }
        return clients.openWindow(event.notification.data.url);
      },
    ),
  );
});
