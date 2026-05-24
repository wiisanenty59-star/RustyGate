import type { PgTableWithColumns } from "drizzle-orm/pg-core";
import {
  pgTable,
  serial,
  text,
  integer,
  doublePrecision,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const statesTable: PgTableWithColumns<any> = pgTable("states", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  abbreviation: text("abbreviation").notNull(),
  parentId: integer("parent_id").references(() => statesTable.id, {
    onDelete: "cascade",
  }).default(sql`NULL`),
  centerLat: doublePrecision("center_lat").notNull(),
  centerLng: doublePrecision("center_lng").notNull(),
  zoom: integer("zoom").notNull().default(7),
}) as unknown as PgTableWithColumns<any>;

export type State = typeof statesTable.$inferSelect;
