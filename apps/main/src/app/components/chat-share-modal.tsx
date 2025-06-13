"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Copy } from "lucide-react";

import { Button } from "@acme/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
} from "@acme/ui/dialog";
import { Input } from "@acme/ui/input";

import { createChatShare, deleteChatShare } from "./chat-actions";

export function ChatShareModal({
  chatId,
  children,
}: {
  chatId: string;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children ?? <Button className="rounded-full">Share</Button>}
      </DialogTrigger>
      <DialogContent>
        <ChatShareModalContent chatId={chatId} setOpen={setOpen} />
      </DialogContent>
    </Dialog>
  );
}

export function ChatShareModalContent({
  chatId,
  setOpen,
}: {
  chatId: string;
  setOpen: (open: boolean) => void;
}) {
  const shareQuery = useQuery({
    queryKey: [`share`, `share-${chatId}`],
    queryFn: () => createChatShare(chatId),
  });
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    if (shareQuery.data)
      navigator.clipboard
        .writeText(`https://maxw.ai/share/${shareQuery.data}`)
        .then(() => {
          setIsCopied(true);
        })
        .catch(console.error);
  }, [shareQuery.data]);
  useEffect(() => {
    if (isCopied) {
      const timeout = setTimeout(() => {
        setIsCopied(false);
      }, 2000);
      return () => clearTimeout(timeout);
    }
  }, [isCopied]);

  return (
    <>
      <div className="space-y-2">
        <DialogTitle>Share Chat</DialogTitle>
        <DialogDescription>
          Use this link to share this chat with others.
        </DialogDescription>
      </div>
      <div className="relative">
        <Input
          disabled={!shareQuery.data}
          className="rounded-full p-5 px-4 pr-12 !text-base"
          value={
            shareQuery.data
              ? `https://maxw.ai/share/${shareQuery.data}`
              : "Loading..."
          }
          readOnly
        />
        <Button
          disabled={!shareQuery.data}
          size="icon"
          variant="secondary"
          style={{
            width: isCopied ? "auto" : "2.125rem",
          }}
          className="dark:bg-border absolute top-1 right-1 bottom-1 h-auto overflow-hidden rounded-full border px-4 ease-out"
          onClick={() => {
            setIsCopied(true);
          }}
        >
          {isCopied ? "Copied!" : <Copy />}
        </Button>
      </div>
      <DialogFooter>
        <Button
          onClick={async () => {
            await deleteChatShare(chatId);
            setOpen(false);
          }}
          variant="outline"
        >
          Delete Link
        </Button>
        <Button onClick={() => setOpen(false)}>Close</Button>
      </DialogFooter>
    </>
  );
}
