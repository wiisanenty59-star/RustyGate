import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const privateChatsTable = pgTable(
  "private_chats",
  {
    id: serial("id").primaryKey(),
    userAId: integer("user_a_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    userBId: integer("user_b_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    lastActivityAt: timestamp("last_activity_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    pairUnique: uniqueIndex("private_chats_pair_idx").on(t.userAId, t.userBId),
  }),
);

export const privateChatMessagesTable = pgTable("private_chat_messages", {
  id: serial("id").primaryKey(),
  chatId: integer("chat_id")
    .notNull()
    .references(() => privateChatsTable.id, { onDelete: "cascade" }),
  authorId: integer("author_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type PrivateChat = typeof privateChatsTable.$inferSelect;
export type PrivateChatMessage = typeof privateChatMessagesTable.$inferSelect;
