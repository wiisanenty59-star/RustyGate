import express, { type Express } from "express";
import cors from "cors";
import session from "express-session";
import connectPgSimpleFactory from "connect-pg-simple";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { loadUser } from "./lib/auth";
import { pool } from "@workspace/db";

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

app.use("/api", router);

export default app;
