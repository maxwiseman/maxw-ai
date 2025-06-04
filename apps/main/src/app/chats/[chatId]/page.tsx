import { Chat } from "../../components/chat";

export const dynamic = "force-static";

export default function Page() {
  return (
    <div className="relative h-full">
      <Chat />
    </div>
  );
}
