import { Router, type IRouter } from "express";
import {
  db,
  threadsTable,
  postsTable,
  categoriesTable,
  usersTable,
  locationsTable,
  statesTable,
} from "@workspace/db";
import { desc, eq, sql } from "drizzle-orm";
import {
  GetRecentActivityResponse,
  GetForumStatsResponse,
} from "@workspace/api-zod";
import { makeExcerpt } from "../lib/excerpt";

const router: IRouter = Router();

router.get("/feed/recent", async (_req, res): Promise<void> => {
  const recentThreads = await db
    .select({
      threadId: threadsTable.id,
      threadTitle: threadsTable.title,
      categorySlug: categoriesTable.slug,
      categoryName: categoriesTable.name,
      actorUsername: usersTable.username,
      actorAvatarUrl: usersTable.avatarUrl,
      excerpt: threadsTable.body,
      at: threadsTable.createdAt,
    })
    .from(threadsTable)
    .leftJoin(categoriesTable, eq(categoriesTable.id, threadsTable.categoryId))
    .leftJoin(usersTable, eq(usersTable.id, threadsTable.authorId))
    .orderBy(desc(threadsTable.createdAt))
    .limit(15);

  const recentPosts = await db
    .select({
      threadId: postsTable.threadId,
      threadTitle: threadsTable.title,
      categorySlug: categoriesTable.slug,
      categoryName: categoriesTable.name,
      actorUsername: usersTable.username,
      actorAvatarUrl: usersTable.avatarUrl,
      excerpt: postsTable.body,
      at: postsTable.createdAt,
    })
    .from(postsTable)
    .leftJoin(threadsTable, eq(threadsTable.id, postsTable.threadId))
    .leftJoin(categoriesTable, eq(categoriesTable.id, threadsTable.categoryId))
    .leftJoin(usersTable, eq(usersTable.id, postsTable.authorId))
    .orderBy(desc(postsTable.createdAt))
    .limit(15);

  const items = [
    ...recentThreads.map((r) => ({
      ...r,
      kind: "thread" as const,
      excerpt: makeExcerpt(r.excerpt, 160),
    })),
    ...recentPosts.map((r) => ({
      ...r,
      kind: "reply" as const,
      excerpt: makeExcerpt(r.excerpt, 160),
    })),
  ]
    .sort((a, b) => (a.at < b.at ? 1 : -1))
    .slice(0, 20);

  res.json(GetRecentActivityResponse.parse(items));
});

router.get("/feed/stats", async (_req, res): Promise<void> => {
  const [counts] = await db
    .select({
      memberCount: sql<number>`(select count(*)::int from ${usersTable})`,
      threadCount: sql<number>`(select count(*)::int from ${threadsTable})`,
      postCount: sql<number>`(select count(*)::int from ${postsTable})`,
      locationCount: sql<number>`(select count(*)::int from ${locationsTable})`,
      stateCount: sql<number>`(select count(*)::int from ${statesTable})`,
    })
    .from(sql`(select 1) dummy`);

  const [newest] = await db
    .select({ username: usersTable.username })
    .from(usersTable)
    .orderBy(desc(usersTable.createdAt))
    .limit(1);

  res.json(
    GetForumStatsResponse.parse({
      ...counts,
      newestMember: newest?.username ?? null,
    }),
  );
});

export default router;
