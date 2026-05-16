import { Router, type IRouter } from "express";
import {
  db,
  categoriesTable,
  threadsTable,
  postsTable,
  usersTable,
  locationsTable,
  statesTable,
} from "@workspace/db";
import { asc, desc, eq, sql } from "drizzle-orm";
import {
  ListCategoriesResponse,
  GetCategoryBySlugParams,
  GetCategoryBySlugResponse,
} from "@workspace/api-zod";
import { makeExcerpt } from "../lib/excerpt";

const router: IRouter = Router();

router.get("/categories", async (_req, res): Promise<void> => {
  const cats = await db
    .select({
      id: categoriesTable.id,
      slug: categoriesTable.slug,
      name: categoriesTable.name,
      description: categoriesTable.description,
      icon: categoriesTable.icon,
      sortOrder: categoriesTable.sortOrder,
      threadCount:
        sql<number>`(select count(*)::int from ${threadsTable} t where t.category_id = ${categoriesTable}.id)`.as(
          "thread_count",
        ),
      postCount:
        sql<number>`(select count(*)::int from ${postsTable} p join ${threadsTable} t on t.id = p.thread_id where t.category_id = ${categoriesTable}.id)`.as(
          "post_count",
        ),
    })
    .from(categoriesTable)
    .orderBy(asc(categoriesTable.sortOrder), asc(categoriesTable.name));

  const result = await Promise.all(
    cats.map(async (c) => {
      const [latest] = await db
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
        .leftJoin(
          categoriesTable,
          eq(categoriesTable.id, threadsTable.categoryId),
        )
        .leftJoin(
          locationsTable,
          eq(locationsTable.id, threadsTable.locationId),
        )
        .leftJoin(statesTable, eq(statesTable.id, locationsTable.stateId))
        .leftJoin(usersTable, eq(usersTable.id, threadsTable.authorId))
        .where(eq(threadsTable.categoryId, c.id))
        .orderBy(desc(threadsTable.lastActivityAt))
        .limit(1);

      return {
        ...c,
        latestThread: latest
          ? { ...latest, excerpt: makeExcerpt(latest.body) }
          : null,
      };
    }),
  );

  res.json(ListCategoriesResponse.parse(result));
});

router.get("/categories/:slug", async (req, res): Promise<void> => {
  const params = GetCategoryBySlugParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [category] = await db
    .select()
    .from(categoriesTable)
    .where(eq(categoriesTable.slug, params.data.slug));
  if (!category) {
    res.status(404).json({ error: "Category not found" });
    return;
  }

  const threads = await db
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
    .where(eq(threadsTable.categoryId, category.id))
    .orderBy(desc(threadsTable.isPinned), desc(threadsTable.lastActivityAt));

  res.json(
    GetCategoryBySlugResponse.parse({
      category,
      threads: threads.map((t) => ({ ...t, excerpt: makeExcerpt(t.body) })),
    }),
  );
});

export default router;
