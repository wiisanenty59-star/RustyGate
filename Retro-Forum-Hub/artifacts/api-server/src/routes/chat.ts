import { Router, type IRouter } from "express";
import {
  db,
  chatRoomsTable,
  roomMessagesTable,
  roomMessageLikesTable,
  roomBansTable,
  statesTable,
  usersTable,
  crewsTable,
  locationsTable,
} from "@workspace/db";
import {
  and,
  asc,
  desc,
  eq,
  gt,
  ilike,
  isNull,
  or,
  sql,
} from "drizzle-orm";
import {
  CreateChatRoomBody,
  ListRoomMessagesParams,
  SendRoomMessageParams,
  SendRoomMessageBody,
} from "@workspace/api-zod";
import {
  type AuthedRequest,
  requireAuth,
  requireAdmin,
} from "../lib/auth";
import { requireString } from "../utils/http";

const router: IRouter = Router();

const first = (v: string | string[] | undefined): string | undefined =>
  Array.isArray(v) ? v[0] : v;

// ─── List public rooms ────────────────────────────────────────────────────────

router.get("/chat/rooms", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthedRequest).user;

  const crewRoomIds = await db
    .select({ id: crewsTable.roomId })
    .from(crewsTable);

  const excluded = new Set(crewRoomIds.map((r) => r.id));

  const rows = await db
    .select({
      id: chatRoomsTable.id,
      slug: chatRoomsTable.slug,
      name: chatRoomsTable.name,
      description: chatRoomsTable.description,
      kind: chatRoomsTable.kind,
      stateId: chatRoomsTable.stateId,
      stateSlug: statesTable.slug,
      minTrustLevel: chatRoomsTable.minTrustLevel,
      isArchived: chatRoomsTable.isArchived,
      memberCount: sql<number>`(
        SELECT COUNT(DISTINCT author_id)::int FROM room_messages
        WHERE room_messages.room_id = ${chatRoomsTable.id}
      )`,
      lastMessageAt: sql<Date | null>`(
        SELECT MAX(created_at) FROM room_messages
        WHERE room_messages.room_id = ${chatRoomsTable.id}
      )`,
    })
    .from(chatRoomsTable)
    .leftJoin(statesTable, eq(statesTable.id, chatRoomsTable.stateId))
    .where(eq(chatRoomsTable.isArchived, false))
    .orderBy(asc(chatRoomsTable.name));

  const visible = rows.filter(
    (r) =>
      !excluded.has(r.id) &&
      (user.trustLevel ?? 0) >= r.minTrustLevel,
  );

  res.json(visible);
});

// ─── Create room ──────────────────────────────────────────────────────────────

router.post("/chat/rooms", requireAdmin, async (req, res): Promise<void> => {
  const parsed = CreateChatRoomBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [created] = await db
    .insert(chatRoomsTable)
    .values({
      slug: parsed.data.slug,
      name: parsed.data.name,
      description: parsed.data.description,
      kind: parsed.data.kind,
      stateId: parsed.data.stateId ?? null,
      minTrustLevel: parsed.data.minTrustLevel ?? 0,
    })
    .returning();

  if (!created) {
    res.status(500).json({ error: "Could not create room" });
    return;
  }

  res.status(201).json(created);
});

// ─── Edit room ────────────────────────────────────────────────────────────────

router.patch("/chat/rooms/:slug", requireAdmin, async (req, res): Promise<void> => {
  const slug = requireString(req.params.slug, "slug");

  const [room] = await db
    .select()
    .from(chatRoomsTable)
    .where(eq(chatRoomsTable.slug, slug));

  if (!room) {
    res.status(404).json({ error: "Room not found" });
    return;
  }

  const { name, description, minTrustLevel, isArchived, kind } = req.body as any;

  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name;
  if (description !== undefined) updates.description = description;
  if (minTrustLevel !== undefined) updates.minTrustLevel = minTrustLevel;
  if (isArchived !== undefined) updates.isArchived = isArchived;
  if (kind !== undefined) updates.kind = kind;

  const [updated] = await db
    .update(chatRoomsTable)
    .set(updates)
    .where(eq(chatRoomsTable.id, room.id))
    .returning();

  res.json(updated);
});

// ─── Admin rooms ──────────────────────────────────────────────────────────────

router.get("/admin/chat/rooms", requireAdmin, async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      id: chatRoomsTable.id,
      slug: chatRoomsTable.slug,
      name: chatRoomsTable.name,
      description: chatRoomsTable.description,
      kind: chatRoomsTable.kind,
      minTrustLevel: chatRoomsTable.minTrustLevel,
      isArchived: chatRoomsTable.isArchived,
      createdAt: chatRoomsTable.createdAt,
    })
    .from(chatRoomsTable)
    .orderBy(asc(chatRoomsTable.name));

  res.json(rows);
});

// ─── Bans ─────────────────────────────────────────────────────────────────────

router.get("/admin/chat/bans", requireAdmin, async (_req, res): Promise<void> => {
  const now = new Date();

  const rows = await db
    .select({
      id: roomBansTable.id,
      roomSlug: chatRoomsTable.slug,
      roomName: chatRoomsTable.name,
      userId: roomBansTable.userId,
      username: usersTable.username,
      bannedUntil: roomBansTable.bannedUntil,
      reason: roomBansTable.reason,
      createdAt: roomBansTable.createdAt,
    })
    .from(roomBansTable)
    .leftJoin(chatRoomsTable, eq(chatRoomsTable.id, roomBansTable.roomId))
    .leftJoin(usersTable, eq(usersTable.id, roomBansTable.userId))
    .where(
      or(
        isNull(roomBansTable.bannedUntil),
        gt(roomBansTable.bannedUntil, now),
      ),
    )
    .orderBy(desc(roomBansTable.createdAt));

  res.json(rows);
});

// ─── Unban ────────────────────────────────────────────────────────────────────

router.delete("/admin/chat/bans/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = Number.parseInt(requireString(req.params.id, "id"), 10);

  await db.delete(roomBansTable).where(eq(roomBansTable.id, id));

  res.json({ ok: true });
});

// ─── Messages query fix (IMPORTANT FIX) ───────────────────────────────────────

router.get("/chat/rooms/:slug/messages", requireAuth, async (req, res): Promise<void> => {
  const params = ListRoomMessagesParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const user = (req as AuthedRequest).user;

  const [room] = await db
    .select()
    .from(chatRoomsTable)
    .where(eq(chatRoomsTable.slug, params.data.slug));

  if (!room) {
    res.status(404).json({ error: "Room not found" });
    return;
  }

  const sinceId = Number.parseInt(first(req.query.sinceId), 10);

  const filters = [eq(roomMessagesTable.roomId, room.id)];
  if (!Number.isNaN(sinceId)) {
    filters.push(gt(roomMessagesTable.id, sinceId));
  }

  const rows = await db
    .select({
      id: roomMessagesTable.id,
      body: roomMessagesTable.body,
      authorId: roomMessagesTable.authorId,
      authorUsername: usersTable.username,
      createdAt: roomMessagesTable.createdAt,
    })
    .from(roomMessagesTable)
    .leftJoin(usersTable, eq(usersTable.id, roomMessagesTable.authorId))
    .where(and(...filters))
    .orderBy(desc(roomMessagesTable.id));

  res.json({ messages: rows });
});

export default router;