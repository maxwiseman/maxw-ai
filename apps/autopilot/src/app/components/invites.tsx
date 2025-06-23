"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { REGEXP_ONLY_DIGITS_AND_CHARS } from "input-otp";

import { Button } from "@acme/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@acme/ui/dialog";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@acme/ui/input-otp";
import { toast } from "@acme/ui/toast";

import { cn } from "~/lib/utils";
import { checkCode, getCode } from "./actions";

export function EnterInviteCode({ className }: { className?: string }) {
  const [code, setCode] = useState("");
  const [invalid, setInvalid] = useState(false);
  const router = useRouter();
  const mutation = useMutation({
    mutationFn: checkCode,
    mutationKey: ["checkCode"],
  });

  useEffect(() => {
    if (code.length === 6) {
      (async () => {
        const result = await mutation.mutateAsync(code);
        setInvalid(!result);
        if (result === true) router.refresh();
      })().catch(console.error);
    }
  }, [code]);

  return (
    <div className={cn(className)}>
      <InputOTP
        onChange={(newValue) => {
          setCode(newValue.toUpperCase());
          setInvalid(false);
        }}
        value={code}
        pattern={REGEXP_ONLY_DIGITS_AND_CHARS}
        maxLength={6}
        aria-invalid={invalid}
      >
        <InputOTPGroup>
          <InputOTPSlot index={0} />
          <InputOTPSlot index={1} />
          <InputOTPSlot index={2} />
        </InputOTPGroup>
        <InputOTPSeparator />
        <InputOTPGroup>
          <InputOTPSlot index={3} />
          <InputOTPSlot index={4} />
          <InputOTPSlot index={5} />
        </InputOTPGroup>
      </InputOTP>

      <div
        className={cn("text-destructive mt-2 text-sm", {
          "opacity-0": !invalid,
        })}
      >
        {invalid ? "Invalid code" : "placeholder"}
      </div>
    </div>
  );
}

export function InviteButton() {
  const generateQuery = useQuery({
    queryKey: ["share-code"],
    queryFn: getCode,
  });
  if (!generateQuery.data) return null;
  const formattedCode =
    generateQuery.data === "Unauthorized"
      ? "Loading..."
      : `${generateQuery.data.code.substring(0, 3)}-${generateQuery.data.code.substring(3)}`;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          className={cn("h-auto w-auto px-3 py-1 shadow-sm")}
          variant="outline"
        >
          Invite a friend
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-2xl">Invite a friend</DialogTitle>
          <DialogDescription className="text-md">
            Give your friend this code so they can access Autopilot.
            <br />
            {generateQuery.data !== "Unauthorized" &&
              !generateQuery.isLoading &&
              `${generateQuery.data.remaining + 1} invites remaining`}
          </DialogDescription>
        </DialogHeader>
        <div
          onClick={async () => {
            await navigator.clipboard.writeText(formattedCode);
            toast.success("Copied to clipboard");
          }}
          className="w-full cursor-pointer py-6 text-center font-mono text-4xl font-semibold"
        >
          <div>
            {generateQuery.data !== "Unauthorized" &&
            !generateQuery.isLoading ? (
              formattedCode
            ) : (
              <div>Loading...</div>
            )}
          </div>
          <div className="text-muted-foreground font-sans text-sm font-normal">
            Click to copy
          </div>
        </div>
        {/* <Button */}
        {/*   onClick={async () => { */}
        {/*     if (generateQuery.data) */}
        {/*       await navigator.share({ */}
        {/*         // text: "Try out Autopilot for Edgenuity!", */}
        {/*         // url: "https://edge.maxwiseman.io/signup?inv=abc-123", */}
        {/*         title: generateQuery.data.code, */}
        {/*       }); */}
        {/*   }} */}
        {/* > */}
        {/*   <IconShare2 className="mr-1 size-4" /> */}
        {/*   Share */}
        {/* </Button> */}
      </DialogContent>
    </Dialog>
  );
}
