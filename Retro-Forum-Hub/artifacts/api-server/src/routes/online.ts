import { Router, type IRouter } from "express";
import { db, usersTable } from "@workspace/db";
import { gte, desc } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router: IRouter = Router();

const ONLINE_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

router.get("/online", requireAuth, async (_req, res): Promise<void> => {
  const since = new Date(Date.now() - ONLINE_WINDOW_MS);

  const onlineUsers = await db
    .select({
      id: usersTable.id,
      username: usersTable.username,
      role: usersTable.role,
      trustLevel: usersTable.trustLevel,
      lastSeenAt: usersTable.lastSeenAt,
    })
    .from(usersTable)
    .where(gte(usersTable.lastSeenAt, since))
    .orderBy(desc(usersTable.lastSeenAt))
    .limit(50);

  res.json({ count: onlineUsers.length, users: onlineUsers });
});

export default router;
