import { Router, type IRouter } from "express";
import { db, adminNoticesTable, usersTable } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { requireAdmin, type AuthedRequest } from "../lib/auth";
import { requireString } from "../utils/http";

const router: IRouter = Router();

router.get("/admin/notices", requireAdmin, async (_req, res): Promise<void> => {
  const notices = await db
    .select({
      id: adminNoticesTable.id,
      title: adminNoticesTable.title,
      body: adminNoticesTable.body,
      authorId: adminNoticesTable.authorId,
      authorUsername: usersTable.username,
      isPinned: adminNoticesTable.isPinned,
      createdAt: adminNoticesTable.createdAt,
    })
    .from(adminNoticesTable)
    .leftJoin(usersTable, eq(usersTable.id, adminNoticesTable.authorId))
    .orderBy(desc(adminNoticesTable.isPinned), desc(adminNoticesTable.createdAt));

  res.json(notices);
});

router.post("/admin/notices", requireAdmin, async (req, res): Promise<void> => {
  const user = (req as AuthedRequest).user;

  const { title, body } = req.body as {
    title?: string;
    body?: string;
  };

  if (!title?.trim()) {
    res.status(400).json({ error: "Title required" });
    return;
  }

  const [created] = await db
    .insert(adminNoticesTable)
    .values({
      title: title.trim(),
      body: body?.trim() ?? "",
      authorId: user.id,
    })
    .returning();

  res.status(201).json(created);
});

router.patch("/admin/notices/:id", requireAdmin, async (req, res): Promise<void> => {
  const idParam = requireString(req.params.id, "id");
  const id = parseInt(idParam, 10);

  if (!id) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const { title, body, isPinned } = req.body as {
    title?: string;
    body?: string;
    isPinned?: boolean;
  };

  const updates: Partial<typeof adminNoticesTable.$inferInsert> = {};

  if (typeof title === "string" && title.trim()) {
    updates.title = title.trim();
  }

  if (typeof body === "string") {
    updates.body = body;
  }

  if (typeof isPinned === "boolean") {
    updates.isPinned = isPinned;
  }

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "Nothing to update" });
    return;
  }

  const [updated] = await db
    .update(adminNoticesTable)
    .set(updates)
    .where(eq(adminNoticesTable.id, id))
    .returning();

  res.json(updated);
});

router.delete("/admin/notices/:id", requireAdmin, async (req, res): Promise<void> => {
  const idParam = requireString(req.params.id, "id");
  const id = parseInt(idParam, 10);

  if (!id) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  await db
    .delete(adminNoticesTable)
    .where(eq(adminNoticesTable.id, id));

  res.sendStatus(204);
});

export default router;