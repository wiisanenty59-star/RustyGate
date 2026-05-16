import { Router, type IRouter } from "express";
import { db, siteSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAdmin } from "../lib/auth";

const router: IRouter = Router();

const SETTINGS_KEYS = ["guidelines", "rules", "welcome_message"] as const;

router.get("/settings", async (_req, res): Promise<void> => {
  const rows = await db.select().from(siteSettingsTable);
  const result: Record<string, string> = {};
  for (const key of SETTINGS_KEYS) {
    result[key] = rows.find((r) => r.key === key)?.value ?? "";
  }
  res.json(result);
});

router.patch("/settings", requireAdmin, async (req, res): Promise<void> => {
  const body = req.body as Record<string, unknown>;
  const updates: { key: string; value: string }[] = [];

  for (const key of SETTINGS_KEYS) {
    if (typeof body[key] === "string") {
      updates.push({ key, value: body[key] as string });
    }
  }

  if (updates.length === 0) {
    res.status(400).json({ error: "Nothing to update" });
    return;
  }

  for (const { key, value } of updates) {
    await db
      .insert(siteSettingsTable)
      .values({ key, value, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: siteSettingsTable.key,
        set: { value, updatedAt: new Date() },
      });
  }

  const rows = await db.select().from(siteSettingsTable);
  const result: Record<string, string> = {};
  for (const k of SETTINGS_KEYS) {
    result[k] = rows.find((r) => r.key === k)?.value ?? "";
  }
  res.json(result);
});

export default router;
