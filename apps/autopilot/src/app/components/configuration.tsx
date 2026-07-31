"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@acme/ui/card";
import { Input } from "@acme/ui/input";
import { Label } from "@acme/ui/label";
import { Switch } from "@acme/ui/switch";
import { Textarea } from "@acme/ui/textarea";

import { useConfiguration } from "./use-configuration";
import { useNotifications } from "./use-notifications";

export function Configuration() {
  const config = useConfiguration();
  const notifications = useNotifications();

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Authentication</CardTitle>
          <CardDescription className="">
            Autopilot needs to log into your Microsoft account in order to
            access Edgenuity
          </CardDescription>
        </CardHeader>
        <CardContent className="flex gap-4">
          <ConfigurationOption title="Email Address">
            <Input
              value={config.serviceCredentials.username}
              onChange={(e) => {
                config.setConfiguration({
                  serviceCredentials: {
                    ...config.serviceCredentials,
                    username: e.target.value,
                  },
                });
              }}
              type="email"
              placeholder="example@email.com"
            />
          </ConfigurationOption>
          <ConfigurationOption title="Password">
            <Input
              value={config.serviceCredentials.password}
              onChange={(e) => {
                config.setConfiguration({
                  serviceCredentials: {
                    ...config.serviceCredentials,
                    password: e.target.value,
                  },
                });
              }}
              type="password"
              placeholder="Type something..."
            />
          </ConfigurationOption>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Automations</CardTitle>
          <CardDescription className="">
            Choose how you would like Autopilot to complete your assignments
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex w-full items-center justify-between text-sm font-medium">
            Complete quizzes
            <Switch
              checked={config.completeQuizzes}
              onCheckedChange={(completeQuizzes) =>
                config.setConfiguration({ completeQuizzes })
              }
              className="data-[state=unchecked]:bg-card outline-border data-[state=unchecked]:[&>*]:bg-border outline-1 [&>*]:transition-all"
            />
          </div>
          <div className="flex w-full items-center justify-between text-sm font-medium">
            Allow external research
            <Switch
              checked={config.allowExternalResearch}
              onCheckedChange={(allowExternalResearch) =>
                config.setConfiguration({ allowExternalResearch })
              }
              className="data-[state=unchecked]:bg-card outline-border data-[state=unchecked]:[&>*]:bg-border outline-1 [&>*]:transition-all"
            />
          </div>
          <div className="flex w-full items-center justify-between text-sm font-medium">
            Desktop notifications
            <Switch
              checked={notifications.enabled}
              disabled={
                notifications.loading ||
                !notifications.supported ||
                !notifications.configured
              }
              onCheckedChange={(enabled) =>
                void notifications.setEnabled(enabled)
              }
              className="data-[state=unchecked]:bg-card outline-border data-[state=unchecked]:[&>*]:bg-border outline-1 [&>*]:transition-all"
            />
          </div>
          <ConfigurationOption title="Custom agent instructions">
            <Textarea
              className="min-h-24 resize-y"
              maxLength={4_000}
              onChange={(event) =>
                config.setConfiguration({
                  customInstructions: event.target.value,
                })
              }
              placeholder="For example: Prefer concise answers, never submit written responses without asking me first..."
              value={config.customInstructions}
            />
          </ConfigurationOption>
        </CardContent>
      </Card>
    </>
  );
}

export function ConfigurationOption({
  children,
  title,
}: {
  children?: React.ReactNode;
  title?: string;
}) {
  return (
    <div className="flex w-full flex-col gap-2">
      <Label>{title}</Label>
      {children}
    </div>
  );
}
