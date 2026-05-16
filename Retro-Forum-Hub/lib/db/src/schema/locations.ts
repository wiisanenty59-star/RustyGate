import {
  pgTable,
  serial,
  text,
  integer,
  doublePrecision,
  timestamp,
} from "drizzle-orm/pg-core";
import { statesTable } from "./states";
import { usersTable } from "./users";

export const locationsTable = pgTable("locations", {
  id: serial("id").primaryKey(),
  stateId: integer("state_id")
    .notNull()
    .references(() => statesTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  city: text("city"),
  latitude: doublePrecision("latitude").notNull(),
  longitude: doublePrecision("longitude").notNull(),
  status: text("status").notNull().default("active"),
  risk: text("risk").notNull().default("medium"),
  createdById: integer("created_by_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Location = typeof locationsTable.$inferSelect;
