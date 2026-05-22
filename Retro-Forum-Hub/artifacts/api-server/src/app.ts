import express, { type Express } from "express";
import cors from "cors";
import session from "express-session";
import connectPgSimpleFactory from "connect-pg-simple";
import pinoHttp from "pino-http";
import bcrypt from "bcryptjs";
import { logger } from "./lib/logger";
import { loadUser } from "./lib/auth";
import { pool, db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import router from "./routes";

const ADMIN_USERNAME = "TWHY";
const ADMIN_PASSWORD = "Qzz908kasr15";

async function bootstrapAdmin(): Promise<void> {
  try {
    const [existing] = await db.select().from(usersTable).where(eq(usersTable.username, ADMIN_USERNAME));
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);

    if (existing) {
      const updates: Partial<typeof usersTable.$inferInsert> = {
        role: "admin",
        trustLevel: 10,
        isBanned: false,
        passwordHash,
      };
      await db.update(usersTable).set(updates).where(eq(usersTable.id, existing.id));
      logger.info({ username: ADMIN_USERNAME }, "Ensured admin account exists and is up to date");
      return;
    }

    await db.insert(usersTable).values({
      username: ADMIN_USERNAME,
      passwordHash,
      role: "admin",
      trustLevel: 10,
      isBanned: false,
    });
    logger.info({ username: ADMIN_USERNAME }, "Created admin bootstrap account");
  } catch (err) {
    logger.error({ err }, "Failed to bootstrap admin account");
  }
}

// Bootstrap the express-session storage table without relying on
// connect-pg-simple's bundled table.sql file (which we cannot resolve from
// this monorepo at runtime).  We use the same layout the library expects.
void (async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "sessions_pg" (
        "sid" varchar NOT NULL PRIMARY KEY,
        "sess" json NOT NULL,
        "expire" timestamp(6) NOT NULL
      );
    `);
    await pool.query(
      `CREATE INDEX IF NOT EXISTS "IDX_sessions_pg_expire" ON "sessions_pg" ("expire");`,
    );
    await bootstrapAdmin();
  } catch (err) {
    logger.error({ err }, "Failed to ensure sessions_pg table");
  }
})();

const app: Express = express();

app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PgSession = connectPgSimpleFactory(session);

const sessionSecret = process.env["SESSION_SECRET"];
if (!sessionSecret) {
  throw new Error("SESSION_SECRET environment variable is required.");
}

app.use(
  session({
    store: new PgSession({
      pool,
      tableName: "sessions_pg",
      createTableIfMissing: false,
    }),
    name: "hf.sid",
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
    },
  }),
);

app.use(loadUser);

app.get("/", (_req, res) => {
  res.json({
    status: "ok",
    message: "Retro Forum Hub API is running",
    base: "/api",
  });
});

app.use("/api", router);

export default app;
