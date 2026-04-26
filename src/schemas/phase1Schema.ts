// src/schemas/phase1Schema.ts
import { z } from 'zod';

export const phase1Schema = z.object({
  category:      z.enum(['billing', 'technical', 'account', 'feature_request', 'other']),
  priority:      z.enum(['critical', 'high', 'medium', 'low']),
  sentiment:     z.enum(['positive', 'neutral', 'negative', 'frustrated']),
  escalation:    z.boolean(),
  routingTarget: z.enum(['tier1', 'tier2', 'billing_team', 'engineering', 'account_management']),
  summary:       z.string().min(10).max(300),
});

export type Phase1Output = z.infer<typeof phase1Schema>;
