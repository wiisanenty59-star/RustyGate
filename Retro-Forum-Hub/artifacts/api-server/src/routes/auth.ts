import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable, invitesTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import {
  LoginBody,
  LoginResponse,
  RedeemInviteBody,
  GetCurrentUserResponse,
  GetInviteInfoParams,
  GetInviteInfoResponse,
} from "@workspace/api-zod";
import { type AuthedRequest, serializeUser } from "../lib/auth";

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

export default router;
