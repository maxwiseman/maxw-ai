import { initBotId } from "botid/client/core";

initBotId({
  protect: [
    {
      path: "/api/*",
      method: "GET",
    },
    {
      path: "/api/*",
      method: "POST",
    },
  ],
});
