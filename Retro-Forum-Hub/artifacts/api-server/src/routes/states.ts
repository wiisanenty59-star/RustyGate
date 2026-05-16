import { Router, type IRouter } from "express";
import {
  db,
  statesTable,
  locationsTable,
  threadsTable,
  categoriesTable,
  usersTable,
} from "@workspace/db";
import { and, desc, eq, sql } from "drizzle-orm";
import {
  ListStatesResponse,
  GetStateBySlugParams,
  GetStateBySlugResponse,
} from "@workspace/api-zod";
import { makeExcerpt } from "../lib/excerpt";

const router: IRouter = Router();

router.get("/states", async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      id: statesTable.id,
      slug: statesTable.slug,
      name: statesTable.name,
      abbreviation: statesTable.abbreviation,
      centerLat: statesTable.centerLat,
      centerLng: statesTable.centerLng,
      zoom: statesTable.zoom,
      locationCount: sql<number>`count(distinct ${locationsTable.id})::int`.as(
        "location_count",
      ),
      threadCount: sql<number>`count(distinct ${threadsTable.id})::int`.as(
        "thread_count",
      ),
    })
    .from(statesTable)
    .leftJoin(locationsTable, eq(locationsTable.stateId, statesTable.id))
    .leftJoin(threadsTable, eq(threadsTable.locationId, locationsTable.id))
    .groupBy(statesTable.id)
    .orderBy(statesTable.name);
  res.json(ListStatesResponse.parse(rows));
});

router.get("/states/:slug", async (req, res): Promise<void> => {
  const params = GetStateBySlugParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [state] = await db
    .select()
    .from(statesTable)
    .where(eq(statesTable.slug, params.data.slug));
  if (!state) {
    res.status(404).json({ error: "State not found" });
    return;
  }

  const locations = await db
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
    .where(eq(locationsTable.stateId, state.id))
    .orderBy(desc(locationsTable.createdAt));

  const pinnedThreads = await db
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
    .where(
      and(
        eq(threadsTable.isPinned, true),
        eq(locationsTable.stateId, state.id),
      ),
    )
    .orderBy(desc(threadsTable.lastActivityAt));

  res.json(
    GetStateBySlugResponse.parse({
      state,
      locations,
      pinnedThreads: pinnedThreads.map((t) => ({
        ...t,
        excerpt: makeExcerpt(t.body),
      })),
    }),
  );
});

export default router;
