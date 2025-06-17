import { IconBan } from "@tabler/icons-react";

import { EnterInviteCode } from "./invites";

export function NotInvited() {
  return (
    <div className="flex size-full flex-col items-center justify-center">
      <div className="flex max-w-lg flex-col items-center gap-2 text-center">
        {/* <IconBan className="size-18" /> */}
        {/* <EnterInviteCode className="mb-8" /> */}
        <h1 className="text-4xl font-semibold">Not invited!</h1>
        <p className="text-muted-foreground">
          You need an invite code to access Autopilot. Ask a friend who has
          access to generate one for you.
        </p>
        <EnterInviteCode className="mt-10" />
      </div>
    </div>
  );
}
