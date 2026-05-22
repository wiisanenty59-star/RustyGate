import { Router, type IRouter } from "express";
import {
  db,
  mapLayersTable,
  statesTable,
  usersTable,
} from "@workspace/db";
import { and, eq, ilike, sql } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../lib/auth";
import { requireString } from "../utils/http";

const router: IRouter = Router();

router.get("/map-layers", requireAuth, async (req, res): Promise<void> => {
  const stateSlug = req.query.stateSlug ? String(req.query.stateSlug) : undefined;
  const layerTag = req.query.layerTag ? String(req.query.layerTag) : undefined;

  const filters: Array<unknown> = [eq(mapLayersTable.isActive, true)];
  if (stateSlug) {
    filters.push(eq(statesTable.slug, stateSlug));
  }
  if (layerTag) {
    filters.push(ilike(mapLayersTable.layerTag, `%${layerTag}%`));
  }

  const rows = await db
    .select({
      id: mapLayersTable.id,
      title: mapLayersTable.title,
      description: mapLayersTable.description,
      layerTag: mapLayersTable.layerTag,
      color: mapLayersTable.color,
      latitude: mapLayersTable.latitude,
      longitude: mapLayersTable.longitude,
      stateSlug: statesTable.slug,
      stateName: statesTable.name,
      createdBy: usersTable.username,
      createdAt: mapLayersTable.createdAt,
    })
    .from(mapLayersTable)
    .leftJoin(statesTable, eq(statesTable.id, mapLayersTable.stateId))
    .leftJoin(usersTable, eq(usersTable.id, mapLayersTable.createdById))
    .where(and(...filters))
    .orderBy(mapLayersTable.createdAt.desc());

  res.json(rows);
});

router.use("/admin", requireAdmin);

router.get("/admin/map-layers", async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      id: mapLayersTable.id,
      title: mapLayersTable.title,
      description: mapLayersTable.description,
      layerTag: mapLayersTable.layerTag,
      color: mapLayersTable.color,
      latitude: mapLayersTable.latitude,
      longitude: mapLayersTable.longitude,
      stateId: mapLayersTable.stateId,
      stateSlug: statesTable.slug,
      stateName: statesTable.name,
      isActive: mapLayersTable.isActive,
      createdByUsername: usersTable.username,
      createdAt: mapLayersTable.createdAt,
    })
    .from(mapLayersTable)
    .leftJoin(statesTable, eq(statesTable.id, mapLayersTable.stateId))
    .leftJoin(usersTable, eq(usersTable.id, mapLayersTable.createdById))
    .orderBy(mapLayersTable.createdAt.desc());
  res.json(rows);
});

router.post("/admin/map-layers", async (req, res): Promise<void> => {
  try {
    const title = requireString(req.body?.title, "title");
    const description = req.body?.description ? String(req.body.description) : null;
    const layerTag = req.body?.layerTag ? String(req.body.layerTag) : "surveillance";
    const color = req.body?.color ? String(req.body.color) : null;
    const latitude = Number(req.body?.latitude);
    const longitude = Number(req.body?.longitude);
    const stateId = req.body?.stateId ? Number(req.body.stateId) : null;
    const isActive = req.body?.isActive !== undefined ? Boolean(req.body.isActive) : true;

    if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
      res.status(400).json({ error: "Invalid location coordinates" });
      return;
    }

    const user = (req as any).user;
    const [layer] = await db
      .insert(mapLayersTable)
      .values({
        title,
        description,
        layerTag,
        color,
        latitude,
        longitude,
        stateId,
        isActive,
        createdById: user.id,
      })
      .returning();

    res.status(201).json(layer);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

router.patch("/admin/map-layers/:id", async (req, res): Promise<void> => {
  const id = Number.parseInt(requireString(req.params.id, "id"), 10);
  if (!id) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const updates: Record<string, unknown> = {};
  if (req.body?.title !== undefined) updates.title = String(req.body.title);
  if (req.body?.description !== undefined) updates.description = String(req.body.description);
  if (req.body?.layerTag !== undefined) updates.layerTag = String(req.body.layerTag);
  if (req.body?.color !== undefined) updates.color = String(req.body.color);
  if (req.body?.latitude !== undefined) updates.latitude = Number(req.body.latitude);
  if (req.body?.longitude !== undefined) updates.longitude = Number(req.body.longitude);
  if (req.body?.stateId !== undefined) updates.stateId = req.body.stateId ? Number(req.body.stateId) : null;
  if (req.body?.isActive !== undefined) updates.isActive = Boolean(req.body.isActive);

  const [layer] = await db
    .update(mapLayersTable)
    .set(updates)
    .where(eq(mapLayersTable.id, id))
    .returning();

  if (!layer) {
    res.status(404).json({ error: "Layer not found" });
    return;
  }

  res.json(layer);
});

router.delete("/admin/map-layers/:id", async (req, res): Promise<void> => {
  const id = Number.parseInt(requireString(req.params.id, "id"), 10);
  if (!id) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  await db.delete(mapLayersTable).where(eq(mapLayersTable.id, id));
  res.sendStatus(204);
});

export default router;
