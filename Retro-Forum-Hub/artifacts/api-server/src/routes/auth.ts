import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { db, usersTable, invitesTable, recoveryCodesTable } from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";
import {
  LoginBody,
  LoginResponse,
  RedeemInviteBody,
  GetCurrentUserResponse,
  GetInviteInfoParams,
  GetInviteInfoResponse,
} from "@workspace/api-zod";
import { type AuthedRequest, serializeUser, requireAuth } from "../lib/auth";

const router: IRouter = Router();

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { username, password } = parsed.data;
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.username, username));
  if (!user) {
    res.status(401).json({ error: "Invalid username or password" });
    return;
  }
  if (user.isBanned) {
    res.status(401).json({ error: "Account suspended" });
    return;
  }
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    res.status(401).json({ error: "Invalid username or password" });
    return;
  }
  req.session.userId = user.id;
  res.json(LoginResponse.parse(serializeUser(user)));
});

router.post("/auth/logout", async (req, res): Promise<void> => {
  await new Promise<void>((resolve) => {
    req.session.destroy(() => resolve());
  });
  res.clearCookie("hf.sid");
  res.sendStatus(204);
});

router.get("/auth/me", async (req, res): Promise<void> => {
  const user = (req as AuthedRequest).user;
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  res.json(GetCurrentUserResponse.parse(serializeUser(user)));
});

router.get("/auth/invite-info/:code", async (req, res): Promise<void> => {
  const params = GetInviteInfoParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [invite] = await db
    .select({
      code: invitesTable.code,
      note: invitesTable.note,
      usedAt: invitesTable.usedAt,
      invitedBy: usersTable.username,
    })
    .from(invitesTable)
    .leftJoin(usersTable, eq(usersTable.id, invitesTable.createdById))
    .where(eq(invitesTable.code, params.data.code));
  if (!invite || invite.usedAt) {
    res.status(404).json({ error: "Invite not found or already used" });
    return;
  }
  res.json(
    GetInviteInfoResponse.parse({
      code: invite.code,
      note: invite.note,
      invitedBy: invite.invitedBy,
    }),
  );
});

const MIN_INVITE_TRUST_LEVEL = 2;

router.get("/auth/my-invites", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthedRequest).user;
  const rows = await db
    .select({
      id: invitesTable.id,
      code: invitesTable.code,
      note: invitesTable.note,
      usedByUsername: sql<string | null>`used.username`.as("used_by_username"),
      usedAt: invitesTable.usedAt,
      createdAt: invitesTable.createdAt,
    })
    .from(invitesTable)
    .leftJoin(sql`${usersTable} as used`, sql`used.id = ${invitesTable.usedById}`)
    .where(eq(invitesTable.createdById, user.id))
    .orderBy(invitesTable.createdAt.desc());

  res.json(rows);
});

router.post("/auth/invites", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthedRequest).user;
  if (user.role !== "admin" && (user.trustLevel ?? 0) < MIN_INVITE_TRUST_LEVEL) {
    res.status(403).json({ error: "You need higher trust to issue invite codes" });
    return;
  }

  const note = typeof req.body?.note === "string" && req.body.note.trim() !== "" ? req.body.note.trim() : null;
  if (note && note.length > 200) {
    res.status(400).json({ error: "Note must be 200 characters or less" });
    return;
  }

  const code = randomBytes(8).toString("hex");
  const [invite] = await db
    .insert(invitesTable)
    .values({
      code,
      note,
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

router.post("/auth/redeem-invite", async (req, res): Promise<void> => {
  const parsed = RedeemInviteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { code, username, password } = parsed.data;
  if (username.length < 3 || username.length > 32) {
    res.status(400).json({ error: "Username must be 3-32 characters" });
    return;
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    res.status(400).json({
      error: "Username can only contain letters, numbers, dashes and underscores",
    });
    return;
  }
  if (password.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters" });
    return;
  }

  const [invite] = await db
    .select()
    .from(invitesTable)
    .where(eq(invitesTable.code, code));
  if (!invite || invite.usedAt) {
    res.status(400).json({ error: "Invite not found or already used" });
    return;
  }

  const [existing] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(sql`lower(${usersTable.username}) = lower(${username})`);
  if (existing) {
    res.status(400).json({ error: "Username already taken" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const [user] = await db
    .insert(usersTable)
    .values({
      username,
      passwordHash,
      role: "member",
    })
    .returning();
  if (!user) {
    res.status(500).json({ error: "Could not create account" });
    return;
  }

  await db
    .update(invitesTable)
    .set({ usedById: user.id, usedAt: new Date() })
    .where(eq(invitesTable.id, invite.id));

  req.session.userId = user.id;
  res.status(201).json(GetCurrentUserResponse.parse(serializeUser(user)));
});

router.get("/auth/recovery-codes", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthedRequest).user;
  const rows = await db
    .select({
      id: recoveryCodesTable.id,
      code: recoveryCodesTable.code,
      isUsed: recoveryCodesTable.isUsed,
      usedAt: recoveryCodesTable.usedAt,
      createdAt: recoveryCodesTable.createdAt,
    })
    .from(recoveryCodesTable)
    .where(eq(recoveryCodesTable.userId, user.id))
    .orderBy(recoveryCodesTable.createdAt.desc())
    .limit(20);

  res.json(rows);
});

router.post("/auth/recovery-codes", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthedRequest).user;
  const [existing] = await db
    .select({ codeCount: sql<number>`COUNT(*)::int` })
    .from(recoveryCodesTable)
    .where(eq(recoveryCodesTable.userId, user.id));

  if (existing && existing.codeCount >= 5) {
    res.status(429).json({ error: "Too many recovery codes already generated" });
    return;
  }

  const code = randomBytes(10).toString("hex");
  const [recovery] = await db
    .insert(recoveryCodesTable)
    .values({ userId: user.id, code })
    .returning();

  if (!recovery) {
    res.status(500).json({ error: "Could not generate recovery code" });
    return;
  }

  res.status(201).json({ code: recovery.code, createdAt: recovery.createdAt });
});

router.post("/auth/recover", async (req, res): Promise<void> => {
  const username = String(req.body?.username || "").trim();
  const code = String(req.body?.code || "").trim();
  const newPassword = String(req.body?.newPassword || "").trim();

  if (!username || !code || !newPassword) {
    res.status(400).json({ error: "Username, recovery code and new password are required" });
    return;
  }
  if (newPassword.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters" });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(sql`lower(${usersTable.username}) = lower(${username})`);

  if (!user) {
    res.status(404).json({ error: "Account not found" });
    return;
  }

  const [recovery] = await db
    .select()
    .from(recoveryCodesTable)
    .where(
      and(
        eq(recoveryCodesTable.userId, user.id),
        eq(recoveryCodesTable.code, code),
        eq(recoveryCodesTable.isUsed, false),
      ),
    );

  if (!recovery) {
    res.status(400).json({ error: "Invalid or expired recovery code" });
    return;
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await db
    .update(usersTable)
    .set({ passwordHash })
    .where(eq(usersTable.id, user.id));

  await db
    .update(recoveryCodesTable)
    .set({ isUsed: true, usedAt: new Date() })
    .where(eq(recoveryCodesTable.id, recovery.id));

  req.session.userId = user.id;
  res.json(GetCurrentUserResponse.parse(serializeUser(user)));
});

export default router;
