"use client";

import type React from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Moon } from "lucide-react";
import { useTheme } from "next-themes";

import { authClient } from "@acme/auth/client";

import { Avatar, AvatarFallback, AvatarImage } from "./avatar";
import { Button } from "./button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./card";
import { GithubIcon, PasskeyIcon } from "./custom-icons";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "./dropdown-menu";
import { Input } from "./input";
import { Separator } from "./separator";
import { Skeleton } from "./skeleton";

export function AuthModal({ children }: { children?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");

  async function handleKeyPress(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      await handleSubmit();
    }
  }
  async function handleSubmit() {
    setIsLoading(true);
    if (mode === "sign-in") {
      const data = await authClient.signIn.email({
        email,
        password,
        rememberMe: true,
      });
      if (data.error) {
        setError(data.error.message);
      }
      if (data.data?.user) {
        setOpen(false);
      }
    } else {
      const data = await authClient.signUp.email({
        name,
        email,
        password,
      });
      if (data.error) {
        setError(data.error.message);
      }
      if (data.data?.user) {
        setOpen(false);
      }
    }
    setIsLoading(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="flex w-md flex-col justify-between gap-0 overflow-clip p-0">
        <div className="flex flex-col gap-4 p-6">
          <DialogHeader>
            <DialogTitle>Sign in</DialogTitle>
            <DialogDescription>Sign in to your account</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            {mode === "sign-up" && (
              <Input
                onKeyDown={handleKeyPress}
                disabled={isLoading}
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                type="text"
                placeholder="Name"
              />
            )}
            <Input
              onKeyDown={handleKeyPress}
              disabled={isLoading}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              type="email"
              placeholder="Email"
            />
            <Input
              onKeyDown={handleKeyPress}
              disabled={isLoading}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={
                mode === "sign-in" ? "current-password" : "new-password"
              }
              type="password"
              placeholder="Password"
            />
            {error && <p className="text-destructive text-sm">{error}</p>}
          </div>
          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            <Separator className="shrink grow" />
            <span className="relative -top-px whitespace-nowrap">or</span>
            <Separator className="shrink grow" />
          </div>
          <Button disabled variant="outline" className="w-full">
            <PasskeyIcon className="size-5" />
            Sign in with Passkey
          </Button>
        </div>
        <DialogFooter className="bg-muted/60 shadow-inset-lg border-t p-6 py-4">
          <Button
            onClick={() => {
              setMode((prev) => (prev === "sign-in" ? "sign-up" : "sign-in"));
            }}
            disabled={isLoading}
            variant="outline"
          >
            Sign {mode === "sign-in" ? "up" : "in"}
          </Button>
          <Button disabled={isLoading} onClick={handleSubmit}>
            Sign {mode === "sign-in" ? "in" : "up"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AuthCard() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const router = useRouter();

  async function handleKeyPress(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      await handleSubmit();
    }
  }
  async function handleSubmit() {
    setIsLoading(true);
    if (mode === "sign-in") {
      const data = await authClient.signIn.email({
        email,
        password,
        rememberMe: true,
      });
      if (data.error) {
        setError(data.error.message);
      }
    } else {
      const data = await authClient.signUp.email({
        name,
        email,
        password,
      });
      if (data.error) {
        setError(data.error.message);
      }
    }
    setIsLoading(false);
    router.push("/");
  }

  return (
    <Card className="w-sm pb-0">
      <CardHeader>
        <CardTitle>{mode === "sign-in" ? "Sign in" : "Sign up"}</CardTitle>
        <CardDescription>
          {mode === "sign-in"
            ? "Sign in to your account"
            : "Sign up for an account"}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {mode === "sign-up" && (
          <Input
            onKeyDown={handleKeyPress}
            disabled={isLoading}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            type="text"
            placeholder="Name"
          />
        )}
        <Input
          onKeyDown={handleKeyPress}
          disabled={isLoading}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          type="email"
          placeholder="Email"
        />
        <Input
          onKeyDown={handleKeyPress}
          disabled={isLoading}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={
            mode === "sign-in" ? "current-password" : "new-password"
          }
          type="password"
          placeholder="Password"
        />
        {error && <p className="text-destructive text-sm">{error}</p>}
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <Separator className="shrink grow" />
          <span className="relative -top-px whitespace-nowrap">or</span>
          <Separator className="shrink grow" />
        </div>
        <Button disabled variant="outline" className="w-full">
          <PasskeyIcon className="size-5" />
          Sign in with Passkey
        </Button>
      </CardContent>
      <CardFooter className="bg-muted/60 shadow-inset-lg flex items-center justify-end gap-2 border-t p-6 py-4 pt-4">
        <Button
          onClick={() => {
            setMode((prev) => (prev === "sign-in" ? "sign-up" : "sign-in"));
          }}
          disabled={isLoading}
          variant="outline"
        >
          Sign {mode === "sign-in" ? "up" : "in"}
        </Button>
        <Button disabled={isLoading} onClick={handleSubmit}>
          Sign {mode === "sign-in" ? "in" : "up"}
        </Button>
      </CardFooter>
    </Card>
  );
}

export function AuthButton() {
  const { theme, setTheme } = useTheme();
  const authData = authClient.useSession();
  if (authData.isPending) {
    return <Skeleton className="h-14 w-full" />;
  }
  if (authData.data?.user) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild className="w-full">
          <Button
            variant="ghost"
            className="flex h-max w-full justify-start gap-2 px-2"
          >
            <Avatar>
              <AvatarImage src={authData.data.user.image ?? ""} />
              <AvatarFallback>
                {authData.data.user.name.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col text-left">
              <div className="text-md line-clamp-1 font-semibold">
                {authData.data.user.name}
              </div>
              <div className="text-muted-foreground line-clamp-1 text-sm">
                {authData.data.user.email}
              </div>
            </div>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-42" align="end" side="right">
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Moon className="text-muted-foreground mr-2 size-4" />
              Theme
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent sideOffset={5}>
              <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
                <DropdownMenuRadioItem value="light">
                  Light
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="dark">Dark</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="system">
                  System
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuItem
            onSelect={async () => {
              await authClient.signOut();
            }}
          >
            <LogOut />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }
  return (
    <AuthModal>
      <Button>Sign in</Button>
    </AuthModal>
  );
}
