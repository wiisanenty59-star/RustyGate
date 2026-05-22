import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";

export const recoveryCodesTable = pgTable("recovery_codes", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  code: text("code").notNull().unique(),
  isUsed: boolean("is_used").notNull().default(false),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type RecoveryCode = typeof recoveryCodesTable.$inferSelect;
