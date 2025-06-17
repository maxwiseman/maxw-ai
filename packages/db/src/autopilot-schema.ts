import { relations } from "drizzle-orm";
import {
  index,
  integer,
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
      .references(() => user.id)
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
    .references(() => user.id),
  serviceCredentials: encryptedJSON()("service_credentials", {
    mode: "json",
  }).$type<{
    username: string;
    password: string;
  }>(),
});
