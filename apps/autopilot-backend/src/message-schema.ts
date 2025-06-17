import { z } from "zod";

export const WSClientMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.enum(["start", "stop"]),
  }),
]);
export const WSServerMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("catchup"),
  }),
  z.object({
    type: z.literal("newState"),
    state: z.object({ status: z.enum(["running", "stopped"]) }),
  }),
]);
