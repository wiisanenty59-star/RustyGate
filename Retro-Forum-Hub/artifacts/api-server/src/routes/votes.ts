import { Router, type IRouter } from "express";
import {
  db,
  threadVotesTable,
  postVotesTable,
  threadsTable,
  postsTable,
  notificationsTable,
} from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";
import {
  VoteOnThreadParams,
  VoteOnThreadBody,
  VoteOnPostParams,
  VoteOnPostBody,
} from "@workspace/api-zod";
import { type AuthedRequest, requireAuth } from "../lib/auth";

const router: IRouter = Router();

async function loadThreadTotals(threadId: number, userId: number) {
  const [counts] = await db
    .select({
      upvotes: sql<number>`COALESCE(SUM(CASE WHEN ${threadVotesTable.value} = 'up' THEN 1 ELSE 0 END), 0)::int`,
      downvotes: sql<number>`COALESCE(SUM(CASE WHEN ${threadVotesTable.value} = 'down' THEN 1 ELSE 0 END), 0)::int`,
    })
    .from(threadVotesTable)
    .where(eq(threadVotesTable.threadId, threadId));

  const [mine] = await db
    .select({ value: threadVotesTable.value })
    .from(threadVotesTable)
    .where(
      and(
        eq(threadVotesTable.threadId, threadId),
        eq(threadVotesTable.userId, userId),
      ),
    );

  const upvotes = counts?.upvotes ?? 0;
  const downvotes = counts?.downvotes ?? 0;
  return {
    upvotes,
    downvotes,
    score: upvotes - downvotes,
    myVote: (mine?.value as "up" | "down" | undefined) ?? "none",
  };
}

async function loadPostTotals(postId: number, userId: number) {
  const [counts] = await db
    .select({
      upvotes: sql<number>`COALESCE(SUM(CASE WHEN ${postVotesTable.value} = 'up' THEN 1 ELSE 0 END), 0)::int`,
      downvotes: sql<number>`COALESCE(SUM(CASE WHEN ${postVotesTable.value} = 'down' THEN 1 ELSE 0 END), 0)::int`,
    })
    .from(postVotesTable)
    .where(eq(postVotesTable.postId, postId));

  const [mine] = await db
    .select({ value: postVotesTable.value })
    .from(postVotesTable)
    .where(
      and(eq(postVotesTable.postId, postId), eq(postVotesTable.userId, userId)),
    );

  const upvotes = counts?.upvotes ?? 0;
  const downvotes = counts?.downvotes ?? 0;
  return {
    upvotes,
    downvotes,
    score: upvotes - downvotes,
    myVote: (mine?.value as "up" | "down" | undefined) ?? "none",
  };
}

router.post(
  "/threads/:id/vote",
  requireAuth,
  async (req, res): Promise<void> => {
    const params = VoteOnThreadParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const parsed = VoteOnThreadBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const user = (req as AuthedRequest).user;

    const [thread] = await db
      .select({
        id: threadsTable.id,
        title: threadsTable.title,
        authorId: threadsTable.authorId,
      })
      .from(threadsTable)
      .where(eq(threadsTable.id, params.data.id));
    if (!thread) {
      res.status(404).json({ error: "Thread not found" });
      return;
    }

    const [existingVote] = await db
      .select({ value: threadVotesTable.value })
      .from(threadVotesTable)
      .where(
        and(
          eq(threadVotesTable.threadId, params.data.id),
          eq(threadVotesTable.userId, user.id),
        ),
      );

    if (parsed.data.value === "none") {
      await db
        .delete(threadVotesTable)
        .where(
          and(
            eq(threadVotesTable.threadId, params.data.id),
            eq(threadVotesTable.userId, user.id),
          ),
        );
    } else {
      await db
        .insert(threadVotesTable)
        .values({
          threadId: params.data.id,
          userId: user.id,
          value: parsed.data.value,
        })
        .onConflictDoUpdate({
          target: [threadVotesTable.userId, threadVotesTable.threadId],
          set: { value: parsed.data.value },
        });

      if (
        parsed.data.value === "up" &&
        thread.authorId !== user.id &&
        existingVote?.value !== "up"
      ) {
        await db.insert(notificationsTable).values({
          userId: thread.authorId,
          actorId: user.id,
          title: "Thread liked",
          body: `${user.username} liked your thread: ${thread.title}`,
          sourceType: "thread",
          sourceId: thread.id,
          isRead: false,
        });
      }
    }

    res.json(await loadThreadTotals(params.data.id, user.id));
  },
);

router.post(
  "/posts/:id/vote",
  requireAuth,
  async (req, res): Promise<void> => {
    const params = VoteOnPostParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const parsed = VoteOnPostBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const user = (req as AuthedRequest).user;

    const [post] = await db
      .select({
        id: postsTable.id,
        authorId: postsTable.authorId,
        body: postsTable.body,
      })
      .from(postsTable)
      .where(eq(postsTable.id, params.data.id));
    if (!post) {
      res.status(404).json({ error: "Post not found" });
      return;
    }

    const [existingVote] = await db
      .select({ value: postVotesTable.value })
      .from(postVotesTable)
      .where(
        and(
          eq(postVotesTable.postId, params.data.id),
          eq(postVotesTable.userId, user.id),
        ),
      );

    if (parsed.data.value === "none") {
      await db
        .delete(postVotesTable)
        .where(
          and(
            eq(postVotesTable.postId, params.data.id),
            eq(postVotesTable.userId, user.id),
          ),
        );
    } else {
      await db
        .insert(postVotesTable)
        .values({
          postId: params.data.id,
          userId: user.id,
          value: parsed.data.value,
        })
        .onConflictDoUpdate({
          target: [postVotesTable.userId, postVotesTable.postId],
          set: { value: parsed.data.value },
        });

      if (
        parsed.data.value === "up" &&
        post.authorId !== user.id &&
        existingVote?.value !== "up"
      ) {
        await db.insert(notificationsTable).values({
          userId: post.authorId,
          actorId: user.id,
          title: "Post liked",
          body: `${user.username} liked your post: ${String(post.body).slice(0, 120)}`,
          sourceType: "post",
          sourceId: post.id,
          isRead: false,
        });
      }
    }

    res.json(await loadPostTotals(params.data.id, user.id));
  },
);

export default router;
