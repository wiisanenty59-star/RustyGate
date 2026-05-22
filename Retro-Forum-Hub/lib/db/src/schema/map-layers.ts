import { pgTable, serial, text, integer, boolean, timestamp, doublePrecision } from "drizzle-orm/pg-core";

export const mapLayersTable = pgTable("map_layers", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  layerTag: text("layer_tag").notNull().default("surveillance"),
  color: text("color"),
  latitude: doublePrecision("latitude").notNull(),
  longitude: doublePrecision("longitude").notNull(),
  stateId: integer("state_id"),
  isActive: boolean("is_active").notNull().default(true),
  createdById: integer("created_by_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type MapLayer = typeof mapLayersTable.$inferSelect;
