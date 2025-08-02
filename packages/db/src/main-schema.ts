import type { UIMessage } from "ai";
import { relations } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTableCreator,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

import { user } from "./auth-schema";

const sqliteTable = sqliteTableCreator((name) => `main_${name}`);

export const chat = sqliteTable(
  "chat",
  {
    id: text("id")
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name", { length: 256 }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" }).$onUpdateFn(
      () => new Date(),
    ),
  },
  (table) => [
    index("chat_user_id_index").on(table.userId),
    index("chat_updated_at_index").on(table.updatedAt),
  ],
);
export const chatRelations = relations(chat, ({ many, one }) => ({
  messages: many(message),
  user: one(user, {
    fields: [chat.userId],
    references: [user.id],
  }),
}));

export const message = sqliteTable(
  "message",
  {
    id: text("id")
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    order: integer("order").notNull(),
    parts: text("parts", { mode: "json" })
      .$type<UIMessage["parts"]>()
      .notNull(),
    metadata: text("metadata", { mode: "json" }).$type<UIMessage["metadata"]>(),
    role: text("role", { mode: "json" }).$type<UIMessage["role"]>().notNull(),
    chatId: text("chat_id")
      .notNull()
      .references(() => chat.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" }).$onUpdateFn(
      () => new Date(),
    ),
  },
  (table) => [
    index("message_chat_id_index").on(table.chatId),
    index("message_order_index").on(table.order),
  ],
);
export const messageRelations = relations(message, ({ one }) => ({
  chat: one(chat, {
    fields: [message.chatId],
    references: [chat.id],
  }),
}));

export const chatShare = sqliteTable(
  "chat_share",
  {
    id: text("id")
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    chatId: text("chat_id")
      .notNull()
      .references(() => chat.id, { onDelete: "cascade" }),
  },
  (table) => [
    uniqueIndex("chat_share_chat_id_unique").on(table.chatId),
    index("chat_share_user_id_index").on(table.userId),
  ],
);
export const chatShareRelations = relations(chatShare, ({ one }) => ({
  chat: one(chat, {
    fields: [chatShare.chatId],
    references: [chat.id],
  }),
  user: one(user, {
    fields: [chatShare.userId],
    references: [user.id],
  }),
}));
