import { z } from "zod";

// Schema for list commentary query parameters
const commentaryQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional(),
});

const listCommentaryQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional(),
});

// Schema for a commentary item
const commentarySchema = z.object({
  minute: z.coerce.number().int().nonnegative(),
  sequence: z.coerce.number().int(),
  period: z.string(),
  eventType: z.string(),
  actor: z.string(),
  team: z.string(),
  message: z.string().min(1, "Message is required and must not be empty"),
  metadata: z.record(z.unknown()).optional(),
  tags: z.array(z.string()).optional(),
});

const createCommentarySchema = z.object({
  minute: z.coerce.number().int().nonnegative().optional(),
  sequence: z.coerce.number().int().optional(),
  period: z.string().optional(),
  eventType: z.string().optional(),
  actor: z.string().optional(),
  team: z.string().optional(),
  message: z.string().min(1, "Message is required and must not be empty"),
  metadata: z.record(z.string(), z.unknown()).optional(),
  tags: z.array(z.string()).optional(),
});

export {
  commentaryQuerySchema,
  commentarySchema,
  createCommentarySchema,
  listCommentaryQuerySchema,
};
