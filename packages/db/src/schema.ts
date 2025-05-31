// import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
// import { createInsertSchema } from "drizzle-zod";
// import { z } from "zod";
//
// export const Post = sqliteTable("post", {
//   id: text("id")
//     .notNull()
//     .primaryKey()
//     .$defaultFn(() => crypto.randomUUID()),
//   title: text("title", { length: 256 }).notNull(),
//   content: text("content").notNull(),
//   createdAt: integer("created_at", { mode: "timestamp" })
//     .notNull()
//     .$defaultFn(() => new Date()),
//   updatedAt: integer("updated_at", { mode: "timestamp" }).$onUpdateFn(
//     () => new Date(),
//   ),
// });
//
// export const CreatePostSchema = createInsertSchema(Post, {
//   title: z.string().max(256),
//   content: z.string().max(256),
// }).omit({
//   id: true,
//   createdAt: true,
//   updatedAt: true,
// });
//
export * from "./auth-schema";
