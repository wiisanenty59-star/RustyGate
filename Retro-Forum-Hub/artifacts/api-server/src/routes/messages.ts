import { Router, type IRouter } from "express";
import {
  db,
  privateChatsTable,
  privateChatMessagesTable,
  usersTable,
} from "@workspace/db";
import { and, desc, eq, gt, or, sql } from "drizzle-orm";
import {
  OpenPrivateChatBody,
  ListPrivateChatMessagesParams,
  SendPrivateChatMessageParams,
  SendPrivateChatMessageBody,
} from "@workspace/api-zod";
import { type AuthedRequest, requireAuth } from "../lib/auth";

const router: IRouter = Router();

router.get("/messages", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthedRequest).user;

  const rows = await db.execute(sql`
    SELECT
      pc.id AS id,
      pc.last_activity_at AS "lastActivityAt",
      CASE WHEN pc.user_a_id = ${user.id} THEN pc.user_b_id ELSE pc.user_a_id END AS "otherUserId",
      u.username AS "otherUsername",
      u.trust_level AS "otherTrustLevel",
      (SELECT body FROM private_chat_messages
        WHERE chat_id = pc.id ORDER BY id DESC LIMIT 1) AS "lastMessageBody"
    FROM private_chats pc
    JOIN users u ON u.id = CASE WHEN pc.user_a_id = ${user.id} THEN pc.user_b_id ELSE pc.user_a_id END
    WHERE pc.user_a_id = ${user.id} OR pc.user_b_id = ${user.id}
    ORDER BY pc.last_activity_at DESC
  `);

  res.json(rows.rows);
});

router.post("/messages", requireAuth, async (req, res): Promise<void> => {
  const parsed = OpenPrivateChatBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const user = (req as AuthedRequest).user;
  const target = parsed.data.username.trim();
  if (!target || target === user.username) {
    res.status(400).json({ error: "Choose a different user" });
    return;
  }

  const [other] = await db
    .select({ id: usersTable.id, username: usersTable.username, trustLevel: usersTable.trustLevel })
    .from(usersTable)
    .where(eq(usersTable.username, target));
  if (!other) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  // Canonicalize ordered pair
  const a = Math.min(user.id, other.id);
  const b = Math.max(user.id, other.id);

  const [existing] = await db
    .select()
    .from(privateChatsTable)
    .where(
      and(eq(privateChatsTable.userAId, a), eq(privateChatsTable.userBId, b)),
    );

  let chatId: number;
  let lastActivity: Date;
  let isNew = false;
  if (existing) {
    chatId = existing.id;
    lastActivity = existing.lastActivityAt;
  } else {
    const [created] = await db
      .insert(privateChatsTable)
      .values({ userAId: a, userBId: b })
      .returning();
    if (!created) {
      res.status(500).json({ error: "Could not open chat" });
      return;
    }
    chatId = created.id;
    lastActivity = created.lastActivityAt;
    isNew = true;
  }

  res.status(isNew ? 201 : 200).json({
    id: chatId,
    otherUserId: other.id,
    otherUsername: other.username,
    otherTrustLevel: other.trustLevel ?? 0,
    lastMessageBody: null,
    lastActivityAt: lastActivity,
  });
});

router.get(
  "/messages/:id",
  requireAuth,
  async (req, res): Promise<void> => {
    const params = ListPrivateChatMessagesParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const user = (req as AuthedRequest).user;

    const [chat] = await db
      .select()
      .from(privateChatsTable)
      .where(
        and(
          eq(privateChatsTable.id, params.data.id),
          or(
            eq(privateChatsTable.userAId, user.id),
            eq(privateChatsTable.userBId, user.id),
          ),
        ),
      );
    if (!chat) {
      res.status(403).json({ error: "Not a participant" });
      return;
    }

    const sinceParam = req.query.sinceId;
    const sinceId =
      typeof sinceParam === "string"
        ? Number.parseInt(sinceParam, 10)
        : undefined;

    const filters = [eq(privateChatMessagesTable.chatId, chat.id)];
    if (sinceId && Number.isFinite(sinceId)) {
      filters.push(gt(privateChatMessagesTable.id, sinceId));
    }

    const rows = await db
      .select({
        id: privateChatMessagesTable.id,
        body: privateChatMessagesTable.body,
        authorId: privateChatMessagesTable.authorId,
        authorUsername: usersTable.username,
        authorTrustLevel: usersTable.trustLevel,
        createdAt: privateChatMessagesTable.createdAt,
      })
      .from(privateChatMessagesTable)
      .leftJoin(
        usersTable,
        eq(usersTable.id, privateChatMessagesTable.authorId),
      )
      .where(and(...filters))
      .orderBy(desc(privateChatMessagesTable.id))
      .limit(sinceId ? 200 : 100);

    res.json({ messages: rows.reverse() });
  },
);

router.post(
  "/messages/:id",
  requireAuth,
  async (req, res): Promise<void> => {
    const params = SendPrivateChatMessageParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const parsed = SendPrivateChatMessageBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    if (!parsed.data.body.trim()) {
      res.status(400).json({ error: "Message cannot be empty" });
      return;
    }
    const user = (req as AuthedRequest).user;

    const [chat] = await db
      .select()
      .from(privateChatsTable)
      .where(
        and(
          eq(privateChatsTable.id, params.data.id),
          or(
            eq(privateChatsTable.userAId, user.id),
            eq(privateChatsTable.userBId, user.id),
          ),
        ),
      );
    if (!chat) {
      res.status(403).json({ error: "Not a participant" });
      return;
    }

    const [created] = await db
      .insert(privateChatMessagesTable)
      .values({
        chatId: chat.id,
        authorId: user.id,
        body: parsed.data.body,
      })
      .returning();
    if (!created) {
      res.status(500).json({ error: "Could not send" });
      return;
    }

    await db
      .update(privateChatsTable)
      .set({ lastActivityAt: new Date() })
      .where(eq(privateChatsTable.id, chat.id));

    res.status(201).json({
      id: created.id,
      body: created.body,
      authorId: created.authorId,
      authorUsername: user.username,
      authorTrustLevel: user.trustLevel ?? 0,
      createdAt: created.createdAt,
    });
  },
);

export default router;
