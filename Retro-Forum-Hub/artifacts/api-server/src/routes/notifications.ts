import { Router, type IRouter } from "express";
import { db, notificationsTable } from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router: IRouter = Router();

router.use(requireAuth);

router.get("/notifications", async (req, res): Promise<void> => {
  const user = (req as any).user;
  const rows = await db
    .select({
      id: notificationsTable.id,
      title: notificationsTable.title,
      body: notificationsTable.body,
      sourceType: notificationsTable.sourceType,
      sourceId: notificationsTable.sourceId,
      isRead: notificationsTable.isRead,
      createdAt: notificationsTable.createdAt,
    })
    .from(notificationsTable)
    .where(eq(notificationsTable.userId, user.id))
    .orderBy(notificationsTable.createdAt.desc())
    .limit(20);

  const [countRow] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(notificationsTable)
    .where(eq(notificationsTable.userId, user.id))
    .where(eq(notificationsTable.isRead, false));

  res.json({
    unreadCount: countRow?.count ?? 0,
    notifications: rows,
  });
});

router.patch("/notifications/read-all", async (req, res): Promise<void> => {
  const user = (req as any).user;
  await db
    .update(notificationsTable)
    .set({ isRead: true })
    .where(eq(notificationsTable.userId, user.id));
  res.json({ ok: true });
});

router.patch("/notifications/:id/read", async (req, res): Promise<void> => {
  const user = (req as any).user;
  const id = Number.parseInt(req.params.id, 10);
  if (!id) {
    res.status(400).json({ error: "Invalid notification id" });
    return;
  }
  await db
    .update(notificationsTable)
    .set({ isRead: true })
    .where(eq(notificationsTable.id, id))
    .where(eq(notificationsTable.userId, user.id));
  res.json({ ok: true });
});

export default router;
