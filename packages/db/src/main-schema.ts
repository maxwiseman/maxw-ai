import type { UIMessage } from "ai";
import { relations } from "drizzle-orm";
import { integer, sqliteTableCreator, text } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

import { user } from "./auth-schema";

const sqliteTable = sqliteTableCreator((name) => `main_${name}`);

export const chat = sqliteTable("chat", {
  id: text("id")
    .notNull()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => user.id),
  name: text("name", { length: 256 }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$onUpdateFn(
    () => new Date(),
  ),
});
export const chatRelations = relations(chat, ({ many, one }) => ({
  messages: many(message),
  user: one(user, {
    fields: [chat.userId],
    references: [user.id],
  }),
}));

export const message = sqliteTable("message", {
  id: text("id")
    .notNull()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  order: integer("order").notNull(),
  parts: text("parts", { mode: "json" }).$type<UIMessage["parts"]>().notNull(),
  metadata: text("metadata", { mode: "json" }).$type<UIMessage["metadata"]>(),
  role: text("role", { mode: "json" }).$type<UIMessage["role"]>().notNull(),
  chatId: text("chat_id")
    .notNull()
    .references(() => chat.id),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$onUpdateFn(
    () => new Date(),
  ),
});
export const messageRelations = relations(message, ({ one }) => ({
  chat: one(chat, {
    fields: [message.chatId],
    references: [chat.id],
  }),
}));
