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

import { useConfiguration } from "./use-configuration";

export function Configuration() {
  const config = useConfiguration();

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
            Seconds per word
            <Input
              value={config.timePerWord}
              onChange={(e) => {
                config.setConfiguration({
                  timePerWord: Number(e.target.value),
                });
              }}
              type="number"
              placeholder="1s"
              className="w-14 [appearance:textfield] text-center [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
          </div>
          <div className="flex w-full items-center justify-between text-sm font-medium">
            Complete quizzes
            <Switch
              disabled
              className="data-[state=unchecked]:bg-card outline-border data-[state=unchecked]:[&>*]:bg-border outline-1 [&>*]:transition-all"
            />
          </div>
          <div className="flex w-full items-center justify-between text-sm font-medium">
            Complete PDF assignments
            <Switch
              disabled
              className="data-[state=unchecked]:bg-card outline-border data-[state=unchecked]:[&>*]:bg-border outline-1 [&>*]:transition-all"
            />
          </div>
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
