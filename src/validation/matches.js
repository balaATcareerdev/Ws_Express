import { z } from "zod";

// Match status constants
const MATCH_STATUS = {
  SCHEDULED: "scheduled",
  LIVE: "live",
  FINISHED: "finished",
};

// Schema for list matches query parameters
const listMatchesQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional(),
});

// Schema for match ID parameter
const matchIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

// Schema for creating a match
const createMatchSchema = z
  .object({
    sport: z.string().min(1, "Sport is required and must not be empty"),
    homeTeam: z.string().min(1, "Home team is required and must not be empty"),
    awayTeam: z.string().min(1, "Away team is required and must not be empty"),
    startTime: z.string(),
    endTime: z.string(),
    homeScore: z.coerce.number().int().nonnegative().optional(),
    awayScore: z.coerce.number().int().nonnegative().optional(),
  })
  .refine(
    (data) => {
      // Verify startTime and endTime are valid ISO date strings
      return (
        !isNaN(new Date(data.startTime).getTime()) &&
        !isNaN(new Date(data.endTime).getTime())
      );
    },
    {
      message: "startTime and endTime must be valid ISO date strings",
    },
  )
  .superRefine((data, ctx) => {
    // Ensure endTime is chronologically after startTime
    const startDate = new Date(data.startTime);
    const endDate = new Date(data.endTime);
    if (endDate <= startDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "endTime must be chronologically after startTime",
        path: ["endTime"],
      });
    }
  });

// Schema for updating match score
const updateScoreSchema = z.object({
  homeScore: z.coerce.number().int().nonnegative(),
  awayScore: z.coerce.number().int().nonnegative(),
});

export {
  MATCH_STATUS,
  listMatchesQuerySchema,
  matchIdParamSchema,
  createMatchSchema,
  updateScoreSchema,
};
