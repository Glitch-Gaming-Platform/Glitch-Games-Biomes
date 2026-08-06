import * as z from "zod";

const zStaggerKind = z.enum(["light", "medium", "heavy"]);

export const zDamageReactionComponent = z.object({
  damageReaction: z
    .object({
      lastReactionTime: z.number().optional(),
      lastProcessedDamageTime: z.number().optional(),
      lastPoiseDamageTime: z.number().optional(),
      poise: z.number().nonnegative().optional(),
      poiseMax: z.number().positive().optional(),
      poiseUpdatedAt: z.number().optional(),
      immunityUntil: z.number().optional(),
      sequence: z.number().int().nonnegative().optional(),
      stagger: z
        .object({
          kind: zStaggerKind,
          startTime: z.number(),
          expiryTime: z.number(),
          direction: z.tuple([z.number(), z.number(), z.number()]),
        })
        .optional(),
    })
    .default({ lastReactionTime: undefined }),
});

export type DamageReactionComponent = z.infer<typeof zDamageReactionComponent>;
