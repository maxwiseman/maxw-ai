import { initBotId } from "botid/client/core";

initBotId({
  protect: [
    {
      path: "/api/*",
      method: "GET",
      advancedOptions: {
        checkLevel: "basic",
      },
    },
    {
      path: "/api/*",
      method: "POST",
      advancedOptions: {
        checkLevel: "basic",
      },
    },
  ],
});
