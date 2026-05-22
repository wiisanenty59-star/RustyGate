import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";

export const notificationsTable = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  actorId: integer("actor_id"),
  title: text("title").notNull(),
  body: text("body").notNull(),
  sourceType: text("source_type").notNull().default("system"),
  sourceId: integer("source_id"),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Notification = typeof notificationsTable.$inferSelect;
