import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import statesRouter from "./states";
import categoriesRouter from "./categories";
import locationsRouter from "./locations";
import threadsRouter from "./threads";
import feedRouter from "./feed";
import adminRouter from "./admin";
import announcementsRouter from "./announcements";
import votesRouter from "./votes";
import chatRouter from "./chat";
import mapLayersRouter from "./map-layers";
import notificationsRouter from "./notifications";
import crewsRouter from "./crews";
import messagesRouter from "./messages";
import settingsRouter from "./settings";
import onlineRouter from "./online";
import adminNoticesRouter from "./admin-notices";

const router: IRouter = Router();

router.get("/", (_req, res) => {
  res.json({
    status: "ok",
    message: "Retro Forum Hub API",
    availableRoutes: [
      "/api/health",
      "/api/auth/me",
      "/api/states",
      "/api/categories",
      "/api/locations",
      "/api/threads",
    ],
  });
});

router.use(healthRouter);
router.use(authRouter);
router.use(statesRouter);
router.use(categoriesRouter);
router.use(locationsRouter);
router.use(threadsRouter);
router.use(feedRouter);
router.use(adminRouter);
router.use(announcementsRouter);
router.use(votesRouter);
router.use(chatRouter);
router.use(mapLayersRouter);
router.use(notificationsRouter);
router.use(crewsRouter);
router.use(messagesRouter);
router.use(settingsRouter);
router.use(onlineRouter);
router.use(adminNoticesRouter);

export default router;
