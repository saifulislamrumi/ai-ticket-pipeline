// src/services/triageService.ts
import { aiGateway } from './aiGateway.ts';
import { buildPhase1Prompt } from '../prompts/phase1Prompt.ts';
import { phase1Schema, type Phase1Output } from '../schemas/phase1Schema.ts';
import { ZodValidationError } from '../utils/ZodValidationError.ts';
import type { TicketRow } from '../types/index.ts';

class TriageService {
  async triage(ticket: TicketRow): Promise<{ result: Phase1Output; provider: string }> {
    const messages = buildPhase1Prompt(ticket);
    const { response, provider } = await aiGateway.call(messages, { ticketId: ticket.id, phase: 'phase1' });

    const raw = response.choices[0].message.content;

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw as string);
    } catch {
      throw new ZodValidationError(`AI returned invalid JSON: ${raw?.slice(0, 200)}`);
    }

    const validation = phase1Schema.safeParse(parsed);
    if (!validation.success) {
      throw new ZodValidationError(`Phase 1 output failed schema validation: ${validation.error.message}`);
    }

    return { result: validation.data, provider };
  }
}

export const triageService = new TriageService();
