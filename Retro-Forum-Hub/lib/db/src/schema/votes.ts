import { pgTable, serial, integer, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { threadsTable } from "./threads";
import { postsTable } from "./posts";

export const threadVotesTable = pgTable(
  "thread_votes",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    threadId: integer("thread_id")
      .notNull()
      .references(() => threadsTable.id, { onDelete: "cascade" }),
    value: text("value").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    userThreadUnique: uniqueIndex("thread_votes_user_thread_idx").on(
      t.userId,
      t.threadId,
    ),
  }),
);

export const postVotesTable = pgTable(
  "post_votes",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    postId: integer("post_id")
      .notNull()
      .references(() => postsTable.id, { onDelete: "cascade" }),
    value: text("value").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    userPostUnique: uniqueIndex("post_votes_user_post_idx").on(
      t.userId,
      t.postId,
    ),
  }),
);

export type ThreadVote = typeof threadVotesTable.$inferSelect;
export type PostVote = typeof postVotesTable.$inferSelect;
