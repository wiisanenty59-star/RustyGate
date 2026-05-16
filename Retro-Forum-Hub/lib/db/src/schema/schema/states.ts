import {
  pgTable,
  serial,
  text,
  integer,
  doublePrecision,
} from "drizzle-orm/pg-core";

export const statesTable = pgTable("states", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  abbreviation: text("abbreviation").notNull(),
  centerLat: doublePrecision("center_lat").notNull(),
  centerLng: doublePrecision("center_lng").notNull(),
  zoom: integer("zoom").notNull().default(7),
});

export type State = typeof statesTable.$inferSelect;
