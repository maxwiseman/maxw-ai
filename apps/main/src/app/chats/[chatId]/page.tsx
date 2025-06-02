import Chat from "../../chat";

export default async function Page({
  params,
}: {
  params: Promise<{ chatId: string }>;
}) {
  return (
    <div className="relative h-full">
      <Chat chatId={(await params).chatId} />
    </div>
  );
}
