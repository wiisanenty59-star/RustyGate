import { pgTable, serial, text, boolean, integer, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const adminNoticesTable = pgTable("admin_notices", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  body: text("body").notNull().default(""),
  authorId: integer("author_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  isPinned: boolean("is_pinned").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AdminNotice = typeof adminNoticesTable.$inferSelect;
