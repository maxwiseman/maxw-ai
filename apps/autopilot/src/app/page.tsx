import { redirect } from "next/navigation";

import { getSession } from "@acme/auth";

import { InfoPane } from "./components/info-pane";
import { Navbar } from "./components/navbar";
import { NotInvited } from "./components/not-invited";
import { PreviewPane } from "./components/preview-pane";

export default async function Page() {
  const session = await getSession();
  if (!session?.user) redirect("/signin");

  if (!session.user.invitedTo.includes("autopilot")) return <NotInvited />;

  return (
    <div className="bg-muted/40 dark:bg-background flex h-full max-h-svh w-full overflow-hidden">
      <div className="size-full overflow-y-scroll">
        <Navbar />
        <InfoPane />
      </div>
      <PreviewPane />
    </div>
  );
}
