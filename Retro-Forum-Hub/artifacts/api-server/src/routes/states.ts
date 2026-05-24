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

/**
 * GET /states
 */
router.get("/states", async (_req, res): Promise<void> => {
  try {
    const rows = await db
      .select({
        id: statesTable.id,
        slug: statesTable.slug,
        name: statesTable.name,
        abbreviation: statesTable.abbreviation,
        centerLat: statesTable.centerLat,
        centerLng: statesTable.centerLng,
        zoom: statesTable.zoom,

        locationCount: sql<number>`
          COALESCE(count(distinct ${locationsTable.id}), 0)::int
        `.as("location_count"),

        threadCount: sql<number>`
          COALESCE(count(distinct ${threadsTable.id}), 0)::int
        `.as("thread_count"),
      })
      .from(statesTable)
      .leftJoin(locationsTable, eq(locationsTable.stateId, statesTable.id))
      .leftJoin(threadsTable, eq(threadsTable.locationId, locationsTable.id))
      .groupBy(
        statesTable.id,
        statesTable.slug,
        statesTable.name,
        statesTable.abbreviation,
        statesTable.centerLat,
        statesTable.centerLng,
        statesTable.zoom
      )
      .orderBy(statesTable.name);

    res.json(ListStatesResponse.parse(rows));
  } catch (err) {
    res.status(500).json({ error: "Failed to load states" });
  }
});

/**
 * GET /states/:slug
 */
router.get("/states/:slug", async (req, res): Promise<void> => {
  const parsed = GetStateBySlugParams.safeParse(req.params);

  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { slug } = parsed.data;

  const [state] = await db
    .select()
    .from(statesTable)
    .where(eq(statesTable.slug, slug))
    .limit(1);

  if (!state) {
    res.status(404).json({ error: "State not found" });
    return;
  }

  /**
   * LOCATIONS (safe + optimized)
   */
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

      spotType: locationsTable.spotType,
      status: locationsTable.status,
      risk: locationsTable.risk,

      createdById: locationsTable.createdById,
      createdByUsername: usersTable.username,

      threadCount: sql<number>`
        (
          select count(*)::int
          from ${threadsTable} t
          where t.location_id = ${locationsTable.id}
        )
      `.as("thread_count"),

      createdAt: locationsTable.createdAt,
    })
    .from(locationsTable)
    .leftJoin(statesTable, eq(statesTable.id, locationsTable.stateId))
    .leftJoin(usersTable, eq(usersTable.id, locationsTable.createdById))
    .where(eq(locationsTable.stateId, state.id))
    .orderBy(desc(locationsTable.createdAt));

  /**
   * PINNED THREADS (safe joins)
   */
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
        eq(locationsTable.stateId, state.id)
      )
    )
    .orderBy(desc(threadsTable.lastActivityAt));

  /**
   * RESPONSE
   */
  res.json(
    GetStateBySlugResponse.parse({
      state,
      locations,
      pinnedThreads: pinnedThreads.map((t) => ({
        ...t,
        excerpt: makeExcerpt(t.body),
      })),
    })
  );
});

export default router;