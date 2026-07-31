import { z } from "zod";

export const WSClientMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.enum(["start", "stop"]),
  }),
  z.object({
    type: z.literal("userInput"),
    requestId: z.string().min(1),
    answer: z.string().min(1).max(10_000),
  }),
]);

export const StatusUpdateSchema = z.object({
  id: z.string(),
  type: z.enum(["success", "pending", "error"]),
  message: z.string(),
  description: z.string().optional(),
  timestamp: z.number(),
});

export const WSServerMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("catchup"),
  }),
  z.object({
    type: z.literal("newState"),
    state: z.object({ status: z.enum(["running", "stopped"]) }),
  }),
  z.object({
    type: z.literal("statusUpdate"),
    status: StatusUpdateSchema,
  }),
  z.object({
    type: z.literal("statusList"),
    statuses: z.array(StatusUpdateSchema),
  }),
  z.object({
    type: z.literal("inputRequest"),
    request: z.object({
      id: z.string(),
      question: z.string(),
      options: z.array(z.string()).optional(),
    }),
  }),
]);
