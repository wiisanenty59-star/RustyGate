import { pgTable, serial, text, timestamp, boolean, integer } from "drizzle-orm/pg-core";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("member"),
  avatarUrl: text("avatar_url"),
  bio: text("bio"),
  trustLevel: integer("trust_level").notNull().default(0),
  postCount: integer("post_count").notNull().default(0),
  isBanned: boolean("is_banned").notNull().default(false),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type User = typeof usersTable.$inferSelect;
