import { Router, type IRouter } from "express";
import {
  db,
  crewsTable,
  crewMembersTable,
  chatRoomsTable,
  roomMessagesTable,
  roomMessageLikesTable,
  usersTable,
} from "@workspace/db";
import { and, asc, desc, eq, gt, inArray, sql } from "drizzle-orm";
import {
  CreateCrewBody,
  ListCrewMessagesParams,
  SendCrewMessageParams,
  SendCrewMessageBody,
} from "@workspace/api-zod";
import { type AuthedRequest, requireAuth } from "../lib/auth";

const router: IRouter = Router();

async function loadCrewWithMembers(crewId: number) {
  const [crew] = await db
    .select({
      id: crewsTable.id,
      name: crewsTable.name,
      description: crewsTable.description,
      creatorId: crewsTable.creatorId,
      creatorUsername: usersTable.username,
      channelSignal: crewsTable.channelSignal,
      roomId: crewsTable.roomId,
      meetupAt: crewsTable.meetupAt,
      meetupNote: crewsTable.meetupNote,
      createdAt: crewsTable.createdAt,
    })
    .from(crewsTable)
    .leftJoin(usersTable, eq(usersTable.id, crewsTable.creatorId))
    .where(eq(crewsTable.id, crewId));

  if (!crew) return null;

  const members = await db
    .select({
      userId: crewMembersTable.userId,
      username: usersTable.username,
      trustLevel: usersTable.trustLevel,
      joinedAt: crewMembersTable.joinedAt,
    })
    .from(crewMembersTable)
    .leftJoin(usersTable, eq(usersTable.id, crewMembersTable.userId))
    .where(eq(crewMembersTable.crewId, crewId));

  const checkinRows = await db
    .select({
      userId: roomMessagesTable.authorId,
      lastCheckinAt: sql<Date | null>`MAX(${roomMessagesTable.createdAt})`.as(
        "last_checkin_at",
      ),
    })
    .from(roomMessagesTable)
    .where(
      and(
        eq(roomMessagesTable.roomId, crew.roomId),
        sql`room_messages.body LIKE '[checkin]%'`,
      ),
    )
    .groupBy(roomMessagesTable.authorId);

  const checkinMap = new Map(
    checkinRows.map((row) => [row.userId, row.lastCheckinAt?.toISOString()]),
  );

  return {
    ...crew,
    memberCount: members.length,
    members: members.map((member) => ({
      ...member,
      lastCheckinAt: checkinMap.get(member.userId),
    })),
  };
}

// Allow crew creators or crew-level admins to change member roles
router.post(
  "/crews/:id/members/:userId/role",
  requireAuth,
  async (req, res): Promise<void> => {
    const id = Number.parseInt(req.params.id ?? "", 10);
    const userId = Number.parseInt(req.params.userId ?? "", 10);
    if (!id || !userId) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const user = (req as AuthedRequest).user;

    const [crew] = await db.select().from(crewsTable).where(eq(crewsTable.id, id));
    if (!crew) {
      res.status(404).json({ error: "Crew not found" });
      return;
    }

    const [callerMembership] = await db
      .select()
      .from(crewMembersTable)
      .where(and(eq(crewMembersTable.crewId, id), eq(crewMembersTable.userId, user.id)));

    const allowed = crew.creatorId === user.id || user.role === "admin" || (callerMembership && ["founder", "co_leader", "moderator"].includes(callerMembership.role));
    if (!allowed) {
      res.status(403).json({ error: "Not allowed" });
      return;
    }

    const { role } = req.body as { role?: string };
    if (!role || typeof role !== "string") {
      res.status(400).json({ error: "role required" });
      return;
    }

    await db
      .update(crewMembersTable)
      .set({ role })
      .where(and(eq(crewMembersTable.crewId, id), eq(crewMembersTable.userId, userId)));

    const [member] = await db
      .select({ userId: crewMembersTable.userId, username: usersTable.username, trustLevel: usersTable.trustLevel, joinedAt: crewMembersTable.joinedAt, role: crewMembersTable.role })
      .from(crewMembersTable)
      .leftJoin(usersTable, eq(usersTable.id, crewMembersTable.userId))
      .where(and(eq(crewMembersTable.crewId, id), eq(crewMembersTable.userId, userId)));

    res.json(member);
  },
);

// Set or update a crew's walkie-talkie channel signal
router.post("/crews/:id/channel", requireAuth, async (req, res): Promise<void> => {
  const id = Number.parseInt(req.params.id ?? "", 10);
  if (!id) {
    res.status(400).json({ error: "Invalid crew id" });
    return;
  }
  const user = (req as AuthedRequest).user;

  const [crew] = await db.select().from(crewsTable).where(eq(crewsTable.id, id));
  if (!crew) {
    res.status(404).json({ error: "Crew not found" });
    return;
  }

  const [callerMembership] = await db
    .select()
    .from(crewMembersTable)
    .where(and(eq(crewMembersTable.crewId, id), eq(crewMembersTable.userId, user.id)));

  const allowed = crew.creatorId === user.id || user.role === "admin" || (callerMembership && ["founder", "co_leader"].includes(callerMembership.role));
  if (!allowed) {
    res.status(403).json({ error: "Not allowed" });
    return;
  }

  const { channelSignal } = req.body as { channelSignal?: number | null };
  await db.update(crewsTable).set({ channelSignal: channelSignal ?? null }).where(eq(crewsTable.id, id));

  const full = await loadCrewWithMembers(id);
  res.json(full);
});

router.get("/crews", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthedRequest).user;

  const myCrewRows = await db
    .select({ crewId: crewMembersTable.crewId })
    .from(crewMembersTable)
    .where(eq(crewMembersTable.userId, user.id));

  if (myCrewRows.length === 0) {
    res.json([]);
    return;
  }

  const ids = myCrewRows.map((c) => c.crewId);
  const crews = await Promise.all(ids.map(loadCrewWithMembers));
  res.json(crews.filter(Boolean));
});

router.post("/crews", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateCrewBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const user = (req as AuthedRequest).user;

  const memberUsernames = (parsed.data.memberUsernames ?? []).filter(
    (u) => u && u !== user.username,
  );
  let extraMembers: { id: number }[] = [];
  if (memberUsernames.length > 0) {
    extraMembers = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(inArray(usersTable.username, memberUsernames));
  }

  const slug = `crew-${Date.now().toString(36)}-${Math.floor(Math.random() * 10000).toString(36)}`;
  const [room] = await db
    .insert(chatRoomsTable)
    .values({
      slug,
      name: parsed.data.name,
      description: parsed.data.description ?? "",
      kind: "crew",
    })
    .returning();
  if (!room) {
    res.status(500).json({ error: "Could not create crew room" });
    return;
  }

  const [crew] = await db
    .insert(crewsTable)
    .values({
      name: parsed.data.name,
      description: parsed.data.description ?? "",
      creatorId: user.id,
      roomId: room.id,
    })
    .returning();
  if (!crew) {
    res.status(500).json({ error: "Could not create crew" });
    return;
  }

  const allMemberIds = Array.from(
    new Set([user.id, ...extraMembers.map((m) => m.id)]),
  );
  await db.insert(crewMembersTable).values(
    allMemberIds.map((uid) => ({
      crewId: crew.id,
      userId: uid,
    })),
  );

  const full = await loadCrewWithMembers(crew.id);
  res.status(201).json(full);
});

// Edit crew (creator only) - name, description, meetupAt, meetupNote
router.patch("/crews/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id ?? "", 10);
  if (!id) {
    res.status(400).json({ error: "Invalid crew id" });
    return;
  }
  const user = (req as AuthedRequest).user;

  const [crew] = await db
    .select()
    .from(crewsTable)
    .where(eq(crewsTable.id, id));
  if (!crew) {
    res.status(404).json({ error: "Crew not found" });
    return;
  }
  if (crew.creatorId !== user.id && user.role !== "admin") {
    res.status(403).json({ error: "Only the crew creator can edit this crew" });
    return;
  }

  const body = req.body as {
    name?: string;
    description?: string;
    meetupAt?: string | null;
    meetupNote?: string | null;
  };

  const updates: Partial<typeof crewsTable.$inferInsert> = {};
  if (typeof body.name === "string" && body.name.trim()) updates.name = body.name.trim();
  if (typeof body.description === "string") updates.description = body.description;
  if ("meetupAt" in body) {
    updates.meetupAt = body.meetupAt ? new Date(body.meetupAt) : null;
  }
  if ("meetupNote" in body) {
    updates.meetupNote = body.meetupNote ?? null;
  }

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "Nothing to update" });
    return;
  }

  await db.update(crewsTable).set(updates).where(eq(crewsTable.id, id));

  // Also sync name to the backing chat room
  if (updates.name) {
    await db
      .update(chatRoomsTable)
      .set({ name: updates.name })
      .where(eq(chatRoomsTable.id, crew.roomId));
  }

  const full = await loadCrewWithMembers(id);
  res.json(full);
});

// Add member to crew (creator only)
router.post("/crews/:id/members", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id ?? "", 10);
  if (!id) {
    res.status(400).json({ error: "Invalid crew id" });
    return;
  }
  const user = (req as AuthedRequest).user;

  const [crew] = await db.select().from(crewsTable).where(eq(crewsTable.id, id));
  if (!crew) {
    res.status(404).json({ error: "Crew not found" });
    return;
  }
  if (crew.creatorId !== user.id && user.role !== "admin") {
    res.status(403).json({ error: "Only the crew creator can add members" });
    return;
  }

  const { username } = req.body as { username?: string };
  if (!username?.trim()) {
    res.status(400).json({ error: "Username required" });
    return;
  }

  const [newUser] = await db.select().from(usersTable).where(eq(usersTable.username, username.trim()));
  if (!newUser) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  try {
    await db.insert(crewMembersTable).values({ crewId: id, userId: newUser.id });
  } catch {
    // Already a member
  }

  const full = await loadCrewWithMembers(id);
  res.json(full);
});

router.post("/crews/:id/checkin", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id ?? "", 10);
  if (!id) {
    res.status(400).json({ error: "Invalid crew id" });
    return;
  }
  const user = (req as AuthedRequest).user;

  const [crew] = await db
    .select({ roomId: crewsTable.roomId })
    .from(crewsTable)
    .where(eq(crewsTable.id, id));
  if (!crew) {
    res.status(404).json({ error: "Crew not found" });
    return;
  }

  const [membership] = await db
    .select()
    .from(crewMembersTable)
    .where(
      and(
        eq(crewMembersTable.crewId, id),
        eq(crewMembersTable.userId, user.id),
      ),
    );
  if (!membership) {
    res.status(403).json({ error: "Not a crew member" });
    return;
  }

  const { latitude, longitude } = req.body as {
    latitude?: number;
    longitude?: number;
  };
  const locationSuffix =
    typeof latitude === "number" && typeof longitude === "number"
      ? ` @ ${latitude.toFixed(5)},${longitude.toFixed(5)}`
      : "";

  const [created] = await db
    .insert(roomMessagesTable)
    .values({
      roomId: crew.roomId,
      authorId: user.id,
      body: `[checkin]${locationSuffix}`,
    })
    .returning();
  if (!created) {
    res.status(500).json({ error: "Could not check in" });
    return;
  }

  res.status(201).json({
    checkedInAt: created.createdAt.toISOString(),
    location: locationSuffix.trim(),
  });
});

router.post("/crews/:id/emergency", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id ?? "", 10);
  if (!id) {
    res.status(400).json({ error: "Invalid crew id" });
    return;
  }
  const user = (req as AuthedRequest).user;

  const [crew] = await db
    .select({ roomId: crewsTable.roomId })
    .from(crewsTable)
    .where(eq(crewsTable.id, id));
  if (!crew) {
    res.status(404).json({ error: "Crew not found" });
    return;
  }

  const [membership] = await db
    .select()
    .from(crewMembersTable)
    .where(
      and(
        eq(crewMembersTable.crewId, id),
        eq(crewMembersTable.userId, user.id),
      ),
    );
  if (!membership) {
    res.status(403).json({ error: "Not a crew member" });
    return;
  }

  const { message } = req.body as { message?: string };
  const body = message?.trim()
    ? `[emergency] ${message.trim()}`
    : `[emergency]`;

  const [created] = await db
    .insert(roomMessagesTable)
    .values({ roomId: crew.roomId, authorId: user.id, body })
    .returning();
  if (!created) {
    res.status(500).json({ error: "Could not send emergency alert" });
    return;
  }

  res.status(201).json({
    emergencyAt: created.createdAt.toISOString(),
  });
});

router.get(
  "/crews/:id/messages",
  requireAuth,
  async (req, res): Promise<void> => {
    const params = ListCrewMessagesParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const user = (req as AuthedRequest).user;

    const [membership] = await db
      .select()
      .from(crewMembersTable)
      .where(
        and(
          eq(crewMembersTable.crewId, params.data.id),
          eq(crewMembersTable.userId, user.id),
        ),
      );
    if (!membership) {
      res.status(403).json({ error: "Not a crew member" });
      return;
    }

    const [crew] = await db
      .select({ roomId: crewsTable.roomId })
      .from(crewsTable)
      .where(eq(crewsTable.id, params.data.id));
    if (!crew) {
      res.status(404).json({ error: "Crew not found" });
      return;
    }

    const sinceParam = req.query.sinceId;
    const sinceId =
      typeof sinceParam === "string"
        ? Number.parseInt(sinceParam, 10)
        : undefined;

    const filters = [eq(roomMessagesTable.roomId, crew.roomId)];
    if (sinceId && Number.isFinite(sinceId)) {
      filters.push(gt(roomMessagesTable.id, sinceId));
    }

    const rows = await db
      .select({
        id: roomMessagesTable.id,
        body: roomMessagesTable.body,
        authorId: roomMessagesTable.authorId,
        authorUsername: usersTable.username,
        authorTrustLevel: usersTable.trustLevel,
        createdAt: roomMessagesTable.createdAt,
        likeCount: sql<number>`(
          SELECT COUNT(*)::int FROM room_message_likes
          WHERE room_message_likes.message_id = ${roomMessagesTable.id}
        )`,
        likedByMe: sql<boolean>`EXISTS(
          SELECT 1 FROM room_message_likes
          WHERE room_message_likes.message_id = ${roomMessagesTable.id}
            AND room_message_likes.user_id = ${user.id}
        )`,
      })
      .from(roomMessagesTable)
      .leftJoin(usersTable, eq(usersTable.id, roomMessagesTable.authorId))
      .where(and(...filters))
      .orderBy(desc(roomMessagesTable.id))
      .limit(sinceId ? 200 : 100);

    res.json({ messages: rows.reverse() });
  },
);

router.post(
  "/crews/:id/messages",
  requireAuth,
  async (req, res): Promise<void> => {
    const params = SendCrewMessageParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const parsed = SendCrewMessageBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    if (!parsed.data.body.trim()) {
      res.status(400).json({ error: "Message cannot be empty" });
      return;
    }
    const user = (req as AuthedRequest).user;

    const [membership] = await db
      .select()
      .from(crewMembersTable)
      .where(
        and(
          eq(crewMembersTable.crewId, params.data.id),
          eq(crewMembersTable.userId, user.id),
        ),
      );
    if (!membership) {
      res.status(403).json({ error: "Not a crew member" });
      return;
    }

    const [crew] = await db
      .select({ roomId: crewsTable.roomId })
      .from(crewsTable)
      .where(eq(crewsTable.id, params.data.id));
    if (!crew) {
      res.status(404).json({ error: "Crew not found" });
      return;
    }

    const [created] = await db
      .insert(roomMessagesTable)
      .values({
        roomId: crew.roomId,
        authorId: user.id,
        body: parsed.data.body,
      })
      .returning();
    if (!created) {
      res.status(500).json({ error: "Could not send" });
      return;
    }

    res.status(201).json({
      id: created.id,
      body: created.body,
      authorId: created.authorId,
      authorUsername: user.username,
      authorTrustLevel: user.trustLevel ?? 0,
      createdAt: created.createdAt,
      likeCount: 0,
      likedByMe: false,
    });
  },
);

// ─── Toggle like on a crew message ───────────────────────────────────────────

router.post(
  "/crews/:id/messages/:msgId/like",
  requireAuth,
  async (req, res): Promise<void> => {
    const user = (req as AuthedRequest).user;
    const crewId = Number.parseInt(req.params.id, 10);
    const msgId = Number.parseInt(req.params.msgId, 10);

    if (!Number.isFinite(crewId) || !Number.isFinite(msgId)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }

    const [membership] = await db
      .select()
      .from(crewMembersTable)
      .where(and(eq(crewMembersTable.crewId, crewId), eq(crewMembersTable.userId, user.id)));
    if (!membership) {
      res.status(403).json({ error: "Not a crew member" });
      return;
    }

    const [existing] = await db
      .select()
      .from(roomMessageLikesTable)
      .where(and(eq(roomMessageLikesTable.messageId, msgId), eq(roomMessageLikesTable.userId, user.id)));

    let liked: boolean;
    if (existing) {
      await db.delete(roomMessageLikesTable).where(eq(roomMessageLikesTable.id, existing.id));
      liked = false;
    } else {
      await db.insert(roomMessageLikesTable).values({ messageId: msgId, userId: user.id });
      liked = true;
    }

    const [{ count }] = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(roomMessageLikesTable)
      .where(eq(roomMessageLikesTable.messageId, msgId));

    res.json({ liked, count });
  },
);

export default router;

void asc;
void sql;
