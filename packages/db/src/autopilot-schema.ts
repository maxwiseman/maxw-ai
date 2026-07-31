import { relations } from "drizzle-orm";
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
});

export const autopilotRunStatuses = [
  "provisioning",
  "ready",
  "stopping",
  "stopped",
  "error",
] as const;

export type AutopilotRunStatus = (typeof autopilotRunStatuses)[number];

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
    lastError: text("last_error"),
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

export const autopilotRunRelations = relations(autopilotRun, ({ one }) => ({
  user: one(user, {
    fields: [autopilotRun.userId],
    references: [user.id],
  }),
}));
