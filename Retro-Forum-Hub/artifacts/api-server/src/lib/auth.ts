import { type Request, type Response, type NextFunction } from "express";
import { db, usersTable, type User } from "@workspace/db";
import { eq } from "drizzle-orm";

declare module "express-session" {
  interface SessionData {
    userId?: number;
  }
}

export type AuthedRequest = Request & {
  user: User;
};

export async function loadUser(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const userId = req.session?.userId;
  if (typeof userId !== "number") {
    next();
    return;
  }
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId));
  if (user && !user.isBanned) {
    (req as AuthedRequest).user = user;
    // Update lastSeenAt non-blocking (fire and forget)
    db.update(usersTable)
      .set({ lastSeenAt: new Date() })
      .where(eq(usersTable.id, userId))
      .catch(() => undefined);
  }
  next();
}

export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!(req as AuthedRequest).user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  next();
}

export function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const user = (req as AuthedRequest).user;
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  if (user.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  next();
}

export function serializeUser(user: User) {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    trustLevel: user.trustLevel,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt,
  };
}
