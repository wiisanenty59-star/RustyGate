import { Router, type IRouter } from "express";
import { randomBytes } from "node:crypto";
import {
  db,
  usersTable,
  invitesTable,
  categoriesTable,
  statesTable,
  locationsTable,
  threadsTable,
  postsTable,
} from "@workspace/db";
import { desc, eq, sql } from "drizzle-orm";
import {
  AdminListUsersResponse,
  AdminUpdateUserParams,
  AdminUpdateUserBody,
  AdminListInvitesResponse,
  AdminCreateInviteBody,
  AdminRevokeInviteParams,
  AdminCreateCategoryBody,
  AdminUpdateCategoryParams,
  AdminUpdateCategoryBody,
  AdminDeleteCategoryParams,
  AdminCreateStateBody,
  AdminUpdateStateParams,
  AdminUpdateStateBody,
  AdminDeleteStateParams,
  AdminUpdateLocationParams,
  AdminUpdateLocationBody,
  AdminDeleteLocationParams,
  AdminPinThreadParams,
  AdminPinThreadBody,
  AdminDeleteThreadParams,
} from "@workspace/api-zod";
import { type AuthedRequest, requireAdmin } from "../lib/auth";

const router: IRouter = Router();

router.use("/admin", requireAdmin);

// USERS
router.get("/admin/users", async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      id: usersTable.id,
      username: usersTable.username,
      role: usersTable.role,
      isBanned: usersTable.isBanned,
      threadCount:
        sql<number>`(select count(*)::int from ${threadsTable} t where t.author_id = ${usersTable.id})`.as(
          "thread_count",
        ),
      postCount:
        sql<number>`(select count(*)::int from ${postsTable} p where p.author_id = ${usersTable.id})`.as(
          "post_count",
        ),
      createdAt: usersTable.createdAt,
    })
    .from(usersTable)
    .orderBy(desc(usersTable.createdAt));
  res.json(AdminListUsersResponse.parse(rows));
});

router.patch("/admin/users/:id", async (req, res): Promise<void> => {
  const params = AdminUpdateUserParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = AdminUpdateUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updates: Partial<typeof usersTable.$inferInsert> = {};
  if (parsed.data.role !== undefined) updates.role = parsed.data.role;
  if (parsed.data.isBanned !== undefined) updates.isBanned = parsed.data.isBanned;

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "Nothing to update" });
    return;
  }

  await db
    .update(usersTable)
    .set(updates)
    .where(eq(usersTable.id, params.data.id));

  const [row] = await db
    .select({
      id: usersTable.id,
      username: usersTable.username,
      role: usersTable.role,
      isBanned: usersTable.isBanned,
      threadCount:
        sql<number>`(select count(*)::int from ${threadsTable} t where t.author_id = ${usersTable.id})`.as(
          "thread_count",
        ),
      postCount:
        sql<number>`(select count(*)::int from ${postsTable} p where p.author_id = ${usersTable.id})`.as(
          "post_count",
        ),
      createdAt: usersTable.createdAt,
    })
    .from(usersTable)
    .where(eq(usersTable.id, params.data.id));

  res.json(row);
});

// INVITES
router.get("/admin/invites", async (_req, res): Promise<void> => {
  const creator = sql`creator`.as("creator");
  const used = sql`used`.as("used");

  const rows = await db
    .select({
      id: invitesTable.id,
      code: invitesTable.code,
      note: invitesTable.note,
      createdById: invitesTable.createdById,
      createdByUsername: sql<string>`creator.username`.as("created_by_username"),
      usedById: invitesTable.usedById,
      usedByUsername: sql<string | null>`used.username`.as("used_by_username"),
      usedAt: invitesTable.usedAt,
      createdAt: invitesTable.createdAt,
    })
    .from(invitesTable)
    .leftJoin(
      sql`${usersTable} as creator`,
      sql`creator.id = ${invitesTable.createdById}`,
    )
    .leftJoin(
      sql`${usersTable} as used`,
      sql`used.id = ${invitesTable.usedById}`,
    )
    .orderBy(desc(invitesTable.createdAt));

  res.json(AdminListInvitesResponse.parse(rows));
});

router.get("/admin/states", async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      id: statesTable.id,
      slug: statesTable.slug,
      name: statesTable.name,
      abbreviation: statesTable.abbreviation,
      parentId: statesTable.parentId,
      createdAt: statesTable.createdAt,
    })
    .from(statesTable)
    .orderBy(statesTable.name);

  res.json(rows);
});

router.post("/admin/invites", async (req, res): Promise<void> => {
  const parsed = AdminCreateInviteBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const user = (req as AuthedRequest).user;
  const code = randomBytes(8).toString("hex");
  const [invite] = await db
    .insert(invitesTable)
    .values({
      code,
      note: parsed.data.note ?? null,
      createdById: user.id,
    })
    .returning();
  if (!invite) {
    res.status(500).json({ error: "Could not create invite" });
    return;
  }

  res.status(201).json({
    id: invite.id,
    code: invite.code,
    note: invite.note,
    createdById: invite.createdById,
    createdByUsername: user.username,
    usedById: null,
    usedByUsername: null,
    usedAt: null,
    createdAt: invite.createdAt,
  });
});

router.delete("/admin/invites/:id", async (req, res): Promise<void> => {
  const params = AdminRevokeInviteParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [invite] = await db
    .select()
    .from(invitesTable)
    .where(eq(invitesTable.id, params.data.id));
  if (!invite) {
    res.status(404).json({ error: "Invite not found" });
    return;
  }
  if (invite.usedAt) {
    res.status(400).json({ error: "Invite already used" });
    return;
  }
  await db.delete(invitesTable).where(eq(invitesTable.id, params.data.id));
  res.sendStatus(204);
});

// CATEGORIES
router.post("/admin/categories", async (req, res): Promise<void> => {
  const parsed = AdminCreateCategoryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [cat] = await db
    .insert(categoriesTable)
    .values({
      slug: parsed.data.slug,
      name: parsed.data.name,
      description: parsed.data.description,
      icon: parsed.data.icon ?? null,
      sortOrder: parsed.data.sortOrder,
    })
    .returning();
  res.status(201).json(cat);
});

router.patch("/admin/categories/:id", async (req, res): Promise<void> => {
  const params = AdminUpdateCategoryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = AdminUpdateCategoryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [cat] = await db
    .update(categoriesTable)
    .set({
      slug: parsed.data.slug,
      name: parsed.data.name,
      description: parsed.data.description,
      icon: parsed.data.icon ?? null,
      sortOrder: parsed.data.sortOrder,
    })
    .where(eq(categoriesTable.id, params.data.id))
    .returning();
  if (!cat) {
    res.status(404).json({ error: "Category not found" });
    return;
  }
  res.json(cat);
});

router.delete("/admin/categories/:id", async (req, res): Promise<void> => {
  const params = AdminDeleteCategoryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await db.delete(categoriesTable).where(eq(categoriesTable.id, params.data.id));
  res.sendStatus(204);
});

// STATES
router.post("/admin/states", async (req, res): Promise<void> => {
  const parsed = AdminCreateStateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [s] = await db.insert(statesTable).values(parsed.data).returning();
  res.status(201).json(s);
});

router.patch("/admin/states/:id", async (req, res): Promise<void> => {
  const params = AdminUpdateStateParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = AdminUpdateStateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [s] = await db
    .update(statesTable)
    .set(parsed.data)
    .where(eq(statesTable.id, params.data.id))
    .returning();
  if (!s) {
    res.status(404).json({ error: "State not found" });
    return;
  }
  res.json(s);
});

router.delete("/admin/states/:id", async (req, res): Promise<void> => {
  const params = AdminDeleteStateParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await db.delete(statesTable).where(eq(statesTable.id, params.data.id));
  res.sendStatus(204);
});

// LOCATIONS
router.patch("/admin/locations/:id", async (req, res): Promise<void> => {
  const params = AdminUpdateLocationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = AdminUpdateLocationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const updates: Partial<typeof locationsTable.$inferInsert> = {};
  if (parsed.data.name !== undefined) updates.name = parsed.data.name;
  if (parsed.data.description !== undefined)
    updates.description = parsed.data.description;
  if (parsed.data.city !== undefined) updates.city = parsed.data.city;
  if (parsed.data.latitude !== undefined) updates.latitude = parsed.data.latitude;
  if (parsed.data.longitude !== undefined)
    updates.longitude = parsed.data.longitude;
  if (parsed.data.status !== undefined) updates.status = parsed.data.status;
  if (parsed.data.risk !== undefined) updates.risk = parsed.data.risk;

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "Nothing to update" });
    return;
  }

  await db
    .update(locationsTable)
    .set(updates)
    .where(eq(locationsTable.id, params.data.id));

  const [row] = await db
    .select({
      id: locationsTable.id,
      stateId: locationsTable.stateId,
      stateSlug: statesTable.slug,
      stateName: statesTable.name,
      name: locationsTable.name,
      description: locationsTable.description,
      city: locationsTable.city,
      latitude: locationsTable.latitude,
      longitude: locationsTable.longitude,
      status: locationsTable.status,
      risk: locationsTable.risk,
      createdById: locationsTable.createdById,
      createdByUsername: usersTable.username,
      threadCount:
        sql<number>`(select count(*)::int from ${threadsTable} t where t.location_id = ${locationsTable.id})`.as(
          "thread_count",
        ),
      createdAt: locationsTable.createdAt,
    })
    .from(locationsTable)
    .leftJoin(statesTable, eq(statesTable.id, locationsTable.stateId))
    .leftJoin(usersTable, eq(usersTable.id, locationsTable.createdById))
    .where(eq(locationsTable.id, params.data.id));
  res.json(row);
});

router.delete("/admin/locations/:id", async (req, res): Promise<void> => {
  const params = AdminDeleteLocationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await db.delete(locationsTable).where(eq(locationsTable.id, params.data.id));
  res.sendStatus(204);
});

// THREADS
router.post("/admin/threads/:id/pin", async (req, res): Promise<void> => {
  const params = AdminPinThreadParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = AdminPinThreadBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  await db
    .update(threadsTable)
    .set({ isPinned: parsed.data.isPinned })
    .where(eq(threadsTable.id, params.data.id));

  const [t] = await db
    .select({
      id: threadsTable.id,
      title: threadsTable.title,
      body: threadsTable.body,
      categoryId: threadsTable.categoryId,
      categorySlug: categoriesTable.slug,
      categoryName: categoriesTable.name,
      locationId: threadsTable.locationId,
      locationName: locationsTable.name,
      stateId: locationsTable.stateId,
      stateSlug: statesTable.slug,
      authorId: threadsTable.authorId,
      authorUsername: usersTable.username,
      authorAvatarUrl: usersTable.avatarUrl,
      isPinned: threadsTable.isPinned,
      isLocked: threadsTable.isLocked,
      viewCount: threadsTable.viewCount,
      replyCount: threadsTable.replyCount,
      lastActivityAt: threadsTable.lastActivityAt,
      createdAt: threadsTable.createdAt,
    })
    .from(threadsTable)
    .leftJoin(categoriesTable, eq(categoriesTable.id, threadsTable.categoryId))
    .leftJoin(locationsTable, eq(locationsTable.id, threadsTable.locationId))
    .leftJoin(statesTable, eq(statesTable.id, locationsTable.stateId))
    .leftJoin(usersTable, eq(usersTable.id, threadsTable.authorId))
    .where(eq(threadsTable.id, params.data.id));
  res.json(t);
});

router.delete("/admin/threads/:id", async (req, res): Promise<void> => {
  const params = AdminDeleteThreadParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await db.delete(threadsTable).where(eq(threadsTable.id, params.data.id));
  res.sendStatus(204);
});

router.post("/admin/threads/:id/lock", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id ?? "", 10);
  if (!id) { res.status(400).json({ error: "Invalid id" }); return; }
  const { isLocked } = req.body as { isLocked?: boolean };
  await db
    .update(threadsTable)
    .set({ isLocked: !!isLocked })
    .where(eq(threadsTable.id, id));
  res.json({ id, isLocked: !!isLocked });
});

export default router;
