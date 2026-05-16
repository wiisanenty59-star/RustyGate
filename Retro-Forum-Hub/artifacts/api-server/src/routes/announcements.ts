import { Router, type IRouter } from "express";
import { db, announcementsTable, usersTable } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import {
  CreateAnnouncementBody,
  DeleteAnnouncementParams,
} from "@workspace/api-zod";
import { type AuthedRequest, requireAdmin } from "../lib/auth";

const router: IRouter = Router();

router.get("/announcements", async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      id: announcementsTable.id,
      title: announcementsTable.title,
      body: announcementsTable.body,
      kind: announcementsTable.kind,
      priority: announcementsTable.priority,
      isActive: announcementsTable.isActive,
      createdById: announcementsTable.createdById,
      createdByUsername: usersTable.username,
      createdAt: announcementsTable.createdAt,
    })
    .from(announcementsTable)
    .leftJoin(usersTable, eq(usersTable.id, announcementsTable.createdById))
    .where(eq(announcementsTable.isActive, true))
    .orderBy(desc(announcementsTable.priority), desc(announcementsTable.createdAt));

  res.json(rows);
});

router.post(
  "/announcements",
  requireAdmin,
  async (req, res): Promise<void> => {
    const parsed = CreateAnnouncementBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const user = (req as AuthedRequest).user;

    const [created] = await db
      .insert(announcementsTable)
      .values({
        title: parsed.data.title,
        body: parsed.data.body,
        kind: parsed.data.kind ?? "info",
        priority: parsed.data.priority ?? 0,
        createdById: user.id,
      })
      .returning();

    if (!created) {
      res.status(500).json({ error: "Could not create announcement" });
      return;
    }

    res.status(201).json({
      id: created.id,
      title: created.title,
      body: created.body,
      kind: created.kind,
      priority: created.priority,
      isActive: created.isActive,
      createdById: created.createdById,
      createdByUsername: user.username,
      createdAt: created.createdAt,
    });
  },
);

router.delete(
  "/announcements/:id",
  requireAdmin,
  async (req, res): Promise<void> => {
    const params = DeleteAnnouncementParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    await db
      .delete(announcementsTable)
      .where(eq(announcementsTable.id, params.data.id));
    res.status(204).end();
  },
);

export default router;
