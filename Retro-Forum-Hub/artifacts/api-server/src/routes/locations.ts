import { Router, type IRouter } from "express";
import {
  db,
  locationsTable,
  statesTable,
  threadsTable,
  usersTable,
  categoriesTable,
} from "@workspace/db";
import { and, desc, eq, sql } from "drizzle-orm";
import {
  ListLocationsQueryParams,
  ListLocationsResponse,
  CreateLocationBody,
  GetLocationParams,
  GetLocationResponse,
} from "@workspace/api-zod";
import { type AuthedRequest, requireAuth } from "../lib/auth";
import { makeExcerpt } from "../lib/excerpt";

const router: IRouter = Router();

router.get("/locations", async (req, res): Promise<void> => {
  const parsed = ListLocationsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { stateSlug } = parsed.data;
  const where = stateSlug ? eq(statesTable.slug, stateSlug) : undefined;

  const rows = await db
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
    .where(where)
    .orderBy(desc(locationsTable.createdAt));

  res.json(ListLocationsResponse.parse(rows));
});

router.post("/locations", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateLocationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const user = (req as AuthedRequest).user;

  const [state] = await db
    .select()
    .from(statesTable)
    .where(eq(statesTable.id, parsed.data.stateId));
  if (!state) {
    res.status(400).json({ error: "Unknown state" });
    return;
  }

  const [loc] = await db
    .insert(locationsTable)
    .values({
      ...parsed.data,
      createdById: user.id,
    })
    .returning();
  if (!loc) {
    res.status(500).json({ error: "Could not create location" });
    return;
  }

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
      threadCount: sql<number>`0::int`.as("thread_count"),
      createdAt: locationsTable.createdAt,
    })
    .from(locationsTable)
    .leftJoin(statesTable, eq(statesTable.id, locationsTable.stateId))
    .leftJoin(usersTable, eq(usersTable.id, locationsTable.createdById))
    .where(eq(locationsTable.id, loc.id));

  res.status(201).json(row);
});

router.get("/locations/:id", async (req, res): Promise<void> => {
  const params = GetLocationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [loc] = await db
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
  if (!loc) {
    res.status(404).json({ error: "Location not found" });
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
    .where(eq(threadsTable.locationId, params.data.id))
    .orderBy(desc(threadsTable.isPinned), desc(threadsTable.lastActivityAt));

  res.json(
    GetLocationResponse.parse({
      location: loc,
      threads: threads.map((t) => ({ ...t, excerpt: makeExcerpt(t.body) })),
    }),
  );
});

export default router;
