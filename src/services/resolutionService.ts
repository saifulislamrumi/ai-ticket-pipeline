// src/services/resolutionService.ts
import { aiGateway } from './aiGateway.ts';
import { buildPhase2Prompt } from '../prompts/phase2Prompt.ts';
import { phase2Schema, type Phase2Output } from '../schemas/phase2Schema.ts';
import { ZodValidationError } from '../utils/ZodValidationError.ts';
import type { TicketRow } from '../types/index.ts';

class ResolutionService {
  async generateResolution(ticket: TicketRow, phase1Result: unknown): Promise<{ result: Phase2Output; provider: string }> {
    const messages = buildPhase2Prompt(ticket, phase1Result);
    const response = await aiGateway.call(messages, { ticketId: ticket.id, phase: 'phase2' });

    const raw = response.choices[0].message.content;

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw as string);
    } catch {
      throw new ZodValidationError(`AI returned invalid JSON: ${raw?.slice(0, 200)}`);
    }

    const validation = phase2Schema.safeParse(parsed);
    if (!validation.success) {
      throw new ZodValidationError(`Phase 2 output failed schema validation: ${validation.error.message}`);
    }

    const provider = aiGateway.extractProvider(response);
    return { result: validation.data, provider };
  }
}

export const resolutionService = new ResolutionService();
