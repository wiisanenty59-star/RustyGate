import { pgTable, serial, text, integer, type AnyPgColumn } from "drizzle-orm/pg-core";

export const categoriesTable = pgTable("categories", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  icon: text("icon"),
  parentId: integer("parent_id").references((): AnyPgColumn => categoriesTable.id, {
    onDelete: "cascade",
  }),
  sortOrder: integer("sort_order").notNull().default(0),
});

export type Category = typeof categoriesTable.$inferSelect;
