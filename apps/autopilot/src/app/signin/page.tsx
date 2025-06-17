import { redirect } from "next/navigation";

import { getSession } from "@acme/auth";
import { AuthCard } from "@acme/ui/auth-modal";

export default async function Page() {
  const session = await getSession();
  if (session?.user) redirect("/");

  return (
    <div className="flex size-full items-center justify-center">
      <AuthCard />
    </div>
  );
}
