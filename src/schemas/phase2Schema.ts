// src/schemas/phase2Schema.ts
import { z } from 'zod';

export const phase2Schema = z.object({
  customerReply: z.string().min(50).max(2000),
  internalNote:  z.string().min(20).max(1000),
  nextActions:   z.array(z.string()).min(1).max(5),
});

export type Phase2Output = z.infer<typeof phase2Schema>;
