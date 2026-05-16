import { Router, type IRouter } from "express";
import {
  db,
  threadsTable,
  postsTable,
  categoriesTable,
  locationsTable,
  statesTable,
  usersTable,
} from "@workspace/db";
import { and, asc, desc, eq, sql, type SQL } from "drizzle-orm";
import {
  ListThreadsQueryParams,
  ListThreadsResponse,
  CreateThreadBody,
  GetThreadParams,
  GetThreadResponse,
  CreatePostParams,
  CreatePostBody,
} from "@workspace/api-zod";
import { type AuthedRequest, requireAuth } from "../lib/auth";
import { makeExcerpt } from "../lib/excerpt";

const router: IRouter = Router();

router.get("/threads", async (req, res): Promise<void> => {
  const parsed = ListThreadsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const filters: SQL[] = [];
  if (parsed.data.categorySlug) {
    filters.push(eq(categoriesTable.slug, parsed.data.categorySlug));
  }
  if (parsed.data.locationId) {
    filters.push(eq(threadsTable.locationId, parsed.data.locationId));
  }
  if (parsed.data.stateSlug) {
    filters.push(eq(statesTable.slug, parsed.data.stateSlug));
  }
  if (parsed.data.pinnedOnly) {
    filters.push(eq(threadsTable.isPinned, true));
  }

  const rows = await db
    .select({
      id: threadsTable.id,
      title: threadsTable.title,
      body: threadsTable.body,
      categoryId: threadsTable.categoryId,
      categorySlug: categoriesTable.slug,
      categoryName: categoriesTable.name,
      locationId: threadsTable.locationId,
      locationName: locationsTable.name,
      stateSlug: statesTable.slug,
      authorId: threadsTable.authorId,
      authorUsername: usersTable.username,
      authorAvatarUrl: usersTable.avatarUrl,
      isPinned: threadsTable.isPinned,
      isLocked: threadsTable.isLocked,
      replyCount: threadsTable.replyCount,
      lastActivityAt: threadsTable.lastActivityAt,
      createdAt: threadsTable.createdAt,
    })
    .from(threadsTable)
    .leftJoin(categoriesTable, eq(categoriesTable.id, threadsTable.categoryId))
    .leftJoin(locationsTable, eq(locationsTable.id, threadsTable.locationId))
    .leftJoin(statesTable, eq(statesTable.id, locationsTable.stateId))
    .leftJoin(usersTable, eq(usersTable.id, threadsTable.authorId))
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(threadsTable.isPinned), desc(threadsTable.lastActivityAt))
    .limit(100);

  res.json(
    ListThreadsResponse.parse(
      rows.map((t) => ({ ...t, excerpt: makeExcerpt(t.body) })),
    ),
  );
});

router.post("/threads", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateThreadBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const user = (req as AuthedRequest).user;

  const [cat] = await db
    .select()
    .from(categoriesTable)
    .where(eq(categoriesTable.id, parsed.data.categoryId));
  if (!cat) {
    res.status(400).json({ error: "Unknown category" });
    return;
  }
  if (parsed.data.locationId != null) {
    const [loc] = await db
      .select()
      .from(locationsTable)
      .where(eq(locationsTable.id, parsed.data.locationId));
    if (!loc) {
      res.status(400).json({ error: "Unknown location" });
      return;
    }
  }

  const [thread] = await db
    .insert(threadsTable)
    .values({
      title: parsed.data.title,
      body: parsed.data.body,
      categoryId: parsed.data.categoryId,
      locationId: parsed.data.locationId ?? null,
      authorId: user.id,
    })
    .returning();
  if (!thread) {
    res.status(500).json({ error: "Could not create thread" });
    return;
  }

  res.status(201).json(await loadFullThread(thread.id));
});

router.get("/threads/:id", async (req, res): Promise<void> => {
  const params = GetThreadParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  await db
    .update(threadsTable)
    .set({ viewCount: sql`${threadsTable.viewCount} + 1` })
    .where(eq(threadsTable.id, params.data.id));

  const thread = await loadFullThread(params.data.id);
  if (!thread) {
    res.status(404).json({ error: "Thread not found" });
    return;
  }

  const posts = await db
    .select({
      id: postsTable.id,
      threadId: postsTable.threadId,
      body: postsTable.body,
      authorId: postsTable.authorId,
      authorUsername: usersTable.username,
      authorAvatarUrl: usersTable.avatarUrl,
      authorRole: usersTable.role,
      createdAt: postsTable.createdAt,
    })
    .from(postsTable)
    .leftJoin(usersTable, eq(usersTable.id, postsTable.authorId))
    .where(eq(postsTable.threadId, params.data.id))
    .orderBy(asc(postsTable.createdAt));

  res.json(GetThreadResponse.parse({ thread, posts }));
});

// Edit own thread (or admin edits any)
router.patch("/threads/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id ?? "", 10);
  if (!id) {
    res.status(400).json({ error: "Invalid thread id" });
    return;
  }
  const user = (req as AuthedRequest).user;

  const [thread] = await db
    .select()
    .from(threadsTable)
    .where(eq(threadsTable.id, id));
  if (!thread) {
    res.status(404).json({ error: "Thread not found" });
    return;
  }
  if (thread.authorId !== user.id && user.role !== "admin") {
    res.status(403).json({ error: "Not allowed" });
    return;
  }

  const { title, body } = req.body as { title?: string; body?: string };
  const updates: Partial<typeof threadsTable.$inferInsert> = {};
  if (typeof title === "string" && title.trim()) updates.title = title.trim();
  if (typeof body === "string" && body.trim()) updates.body = body.trim();

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "Nothing to update" });
    return;
  }

  await db.update(threadsTable).set(updates).where(eq(threadsTable.id, id));
  const updated = await loadFullThread(id);
  res.json(updated);
});

router.post("/threads/:id/posts", requireAuth, async (req, res): Promise<void> => {
  const params = CreatePostParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = CreatePostBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (!parsed.data.body.trim()) {
    res.status(400).json({ error: "Reply cannot be empty" });
    return;
  }
  const user = (req as AuthedRequest).user;

  const [thread] = await db
    .select()
    .from(threadsTable)
    .where(eq(threadsTable.id, params.data.id));
  if (!thread) {
    res.status(404).json({ error: "Thread not found" });
    return;
  }
  if (thread.isLocked) {
    res.status(400).json({ error: "Thread is locked" });
    return;
  }

  const [post] = await db
    .insert(postsTable)
    .values({
      threadId: params.data.id,
      body: parsed.data.body,
      authorId: user.id,
    })
    .returning();
  if (!post) {
    res.status(500).json({ error: "Could not create reply" });
    return;
  }

  await db
    .update(threadsTable)
    .set({
      replyCount: sql`${threadsTable.replyCount} + 1`,
      lastActivityAt: new Date(),
    })
    .where(eq(threadsTable.id, params.data.id));

  const [full] = await db
    .select({
      id: postsTable.id,
      threadId: postsTable.threadId,
      body: postsTable.body,
      authorId: postsTable.authorId,
      authorUsername: usersTable.username,
      authorAvatarUrl: usersTable.avatarUrl,
      authorRole: usersTable.role,
      createdAt: postsTable.createdAt,
    })
    .from(postsTable)
    .leftJoin(usersTable, eq(usersTable.id, postsTable.authorId))
    .where(eq(postsTable.id, post.id));

  res.status(201).json(full);
});

async function loadFullThread(id: number) {
  const [thread] = await db
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
    .where(eq(threadsTable.id, id));
  return thread;
}

export default router;
