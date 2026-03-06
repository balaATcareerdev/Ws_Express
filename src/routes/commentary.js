import { Router } from "express";
import {
  createCommentarySchema,
  listCommentaryQuerySchema,
} from "../validation/commentary.js";
import { db } from "../db/db.js";
import { commentary } from "../db/schema.js";
import { matchIdParamSchema } from "../validation/matches.js";
import { desc, eq } from "drizzle-orm";

export const commentaryRouter = Router({ mergeParams: true });

const MAX_LIMIT = 100;

commentaryRouter.get("/", async (req, res) => {
  try {
    const parsedParams = matchIdParamSchema.safeParse(req.params);

    if (!parsedParams.success) {
      return res.status(400).json({
        errors: "Invalid Params",
        details: parsedParams.error,
      });
    }

    const parsedQuery = listCommentaryQuerySchema.safeParse(req.query);

    if (!parsedQuery.success) {
      return res.status(400).json({
        errors: "Invalid Query",
        details: parsedQuery.error,
      });
    }

    const limit = Math.min(parsedQuery.data.limit ?? 100, MAX_LIMIT);

    const data = await db
      .select()
      .from(commentary)
      .where(eq(commentary.matchId, parsedParams.data.id))
      .orderBy(desc(commentary.createdAt))
      .limit(limit);

    return res.status(200).json({
      data,
    });
  } catch (error) {
    return res.status(500).json({
      error: "Failed to list commentary",
      details: JSON.stringify(error),
    });
  }
});

commentaryRouter.post("/", async (req, res) => {
  try {
    const parsedParams = matchIdParamSchema.safeParse(req.params);

    if (!parsedParams.success) {
      return res.status(400).json({
        errors: "Invalid Id",
        details: parsedParams.error,
      });
    }

    const parsedBody = createCommentarySchema.safeParse(req.body);

    if (!parsedBody.success) {
      return res.status(400).json({
        errors: "Invalid Payload",
        details: parsedBody.error,
      });
    }

    const [createdCommentary] = await db
      .insert(commentary)
      .values({
        matchId: parsedParams.data.id,
        ...parsedBody.data,
        tags: parsedBody.data.tags?.join(","),
      })
      .returning();

    if (res.app.locals.broadCastCommentary) {
      res.app.locals.broadCastCommentary(
        createdCommentary.matchId,
        createdCommentary,
      );
    }

    return res.status(201).json({
      data: createdCommentary,
    });
  } catch (error) {
    return res.status(500).json({
      error: "Failed to create commentary",
      details: JSON.stringify(error),
    });
  }
});
