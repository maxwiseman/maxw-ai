"use client";

import { useQuery } from "@tanstack/react-query";

import { getChats } from "../components/chat-actions";

export default function TestPage() {
  const { data, fetchStatus, status, isFetching } = useQuery({
    queryKey: ["chats"],
    queryFn: getChats,
  });

  return (
    <div className="flex size-full flex-col items-center justify-center gap-4">
      <div>{status}</div>
      <div>{fetchStatus}</div>
      <div>{isFetching ? "fetching" : "not fetching"}</div>
      <div>{JSON.stringify(data)}</div>
    </div>
  );
}
