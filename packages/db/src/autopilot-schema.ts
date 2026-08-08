import { relations, sql } from "drizzle-orm";
import {
  index,
  integer,
  real,
  sqliteTableCreator,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

import { user } from "./auth-schema";
import { encryptedJSON } from "./column-types";

const sqliteTable = sqliteTableCreator((name) => `autopilot_${name}`);

export const invite = sqliteTable(
  "invite",
  {
    createdBy: text("created_by")
      .references(() => user.id, { onDelete: "cascade" })
      .$defaultFn(() => crypto.randomUUID().slice(0, 6))
      .primaryKey(),
    code: text("code"),
  },
  (table) => [uniqueIndex("invites_code_index").on(table.code)],
);
export const invitesRelations = relations(invite, ({ one }) => ({
  createdBy: one(user, {
    fields: [invite.createdBy],
    references: [user.id],
  }),
}));

export const configuration = sqliteTable("configuration", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  serviceCredentials: encryptedJSON()("service_credentials", {
    mode: "json",
  }).$type<{
    username: string;
    password: string;
  }>(),
  timePerWord: real("time_per_word").default(0.1),
  completeQuizzes: integer("complete_quizzes", { mode: "boolean" })
    .notNull()
    .default(sql`0`),
  completePdfAssignments: integer("complete_pdf_assignments", {
    mode: "boolean",
  })
    .notNull()
    .default(sql`0`),
  allowExternalResearch: integer("allow_external_research", {
    mode: "boolean",
  })
    .notNull()
    .default(true),
  customInstructions: text("custom_instructions").notNull().default(""),
  agentContext: text("agent_context", { mode: "json" })
    .$type<ActivityMemory[]>()
    .notNull()
    .default([]),
});

export interface ActivityMemory {
  activity: string;
  createdAt: string;
  summary: string;
}

export const autopilotRunStatuses = [
  "provisioning",
  "ready",
  "stopping",
  "stopped",
  "error",
] as const;

export type AutopilotRunStatus = (typeof autopilotRunStatuses)[number];

export const autopilotRunProvisioningStages = [
  "preparing_environment",
  "installing_dependencies",
  "restoring_snapshot",
  "creating_sandbox",
  "starting_worker",
] as const;

export type AutopilotRunProvisioningStage =
  (typeof autopilotRunProvisioningStages)[number];

export const autopilotRunStopReasons = [
  "manual",
  "completed",
  "error",
  "worker_lost",
  "timeout",
] as const;

export type AutopilotRunStopReason = (typeof autopilotRunStopReasons)[number];

export const sandboxBaseSnapshot = sqliteTable("sandbox_base_snapshot", {
  revision: text("revision").primaryKey(),
  snapshotId: text("snapshot_id").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date()),
});

export const autopilotRun = sqliteTable(
  "run",
  {
    id: text("id").notNull().unique(),
    userId: text("user_id")
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),
    sandboxName: text("sandbox_name").notNull().unique(),
    workflowRunId: text("workflow_run_id"),
    workerUrl: text("worker_url"),
    status: text("status", { enum: autopilotRunStatuses })
      .notNull()
      .default("provisioning"),
    provisioningStage: text("provisioning_stage", {
      enum: autopilotRunProvisioningStages,
    }),
    lastError: text("last_error"),
    sandboxLogTail: text("sandbox_log_tail"),
    lastHeartbeatAt: integer("last_heartbeat_at", { mode: "timestamp" }),
    stopReason: text("stop_reason", { enum: autopilotRunStopReasons }),
    notificationSentAt: integer("notification_sent_at", {
      mode: "timestamp",
    }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdateFn(() => new Date()),
  },
  (table) => [
    index("autopilot_run_status_index").on(table.status),
    uniqueIndex("autopilot_run_sandbox_name_index").on(table.sandboxName),
  ],
);

export const pushSubscription = sqliteTable(
  "push_subscription",
  {
    endpoint: text("endpoint").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [index("autopilot_push_subscription_user_index").on(table.userId)],
);

export const autopilotRunRelations = relations(autopilotRun, ({ one }) => ({
  user: one(user, {
    fields: [autopilotRun.userId],
    references: [user.id],
  }),
}));

export const pushSubscriptionRelations = relations(
  pushSubscription,
  ({ one }) => ({
    user: one(user, {
      fields: [pushSubscription.userId],
      references: [user.id],
    }),
  }),
);
