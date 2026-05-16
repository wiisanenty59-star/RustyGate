import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  boolean,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { statesTable } from "./states";

export const chatRoomsTable = pgTable("chat_rooms", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  kind: text("kind").notNull().default("public"), // public | location | trusted | crew
  stateId: integer("state_id").references(() => statesTable.id, {
    onDelete: "set null",
  }),
  minTrustLevel: integer("min_trust_level").notNull().default(0),
  isArchived: boolean("is_archived").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const roomMessagesTable = pgTable("room_messages", {
  id: serial("id").primaryKey(),
  roomId: integer("room_id")
    .notNull()
    .references(() => chatRoomsTable.id, { onDelete: "cascade" }),
  authorId: integer("author_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const roomMessageLikesTable = pgTable(
  "room_message_likes",
  {
    id: serial("id").primaryKey(),
    messageId: integer("message_id")
      .notNull()
      .references(() => roomMessagesTable.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    msgUserUnique: uniqueIndex("room_message_likes_msg_user_idx").on(
      t.messageId,
      t.userId,
    ),
  }),
);

export const roomBansTable = pgTable(
  "room_bans",
  {
    id: serial("id").primaryKey(),
    roomId: integer("room_id")
      .notNull()
      .references(() => chatRoomsTable.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    bannedUntil: timestamp("banned_until", { withTimezone: true }),
    bannedBy: integer("banned_by")
      .notNull()
      .references(() => usersTable.id),
    reason: text("reason").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    roomUserUnique: uniqueIndex("room_bans_room_user_idx").on(
      t.roomId,
      t.userId,
    ),
  }),
);

export const crewsTable = pgTable("crews", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  creatorId: integer("creator_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  roomId: integer("room_id")
    .notNull()
    .references(() => chatRoomsTable.id, { onDelete: "cascade" }),
  meetupAt: timestamp("meetup_at", { withTimezone: true }),
  meetupNote: text("meetup_note"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const crewMembersTable = pgTable(
  "crew_members",
  {
    id: serial("id").primaryKey(),
    crewId: integer("crew_id")
      .notNull()
      .references(() => crewsTable.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    crewUserUnique: uniqueIndex("crew_members_crew_user_idx").on(
      t.crewId,
      t.userId,
    ),
  }),
);

export type ChatRoom = typeof chatRoomsTable.$inferSelect;
export type RoomMessage = typeof roomMessagesTable.$inferSelect;
export type Crew = typeof crewsTable.$inferSelect;
export type CrewMember = typeof crewMembersTable.$inferSelect;
export type RoomMessageLike = typeof roomMessageLikesTable.$inferSelect;
export type RoomBan = typeof roomBansTable.$inferSelect;
