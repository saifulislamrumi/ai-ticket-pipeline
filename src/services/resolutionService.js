import { callAI, extractProvider } from './aiGateway.js';
import { buildPhase2Prompt } from '../prompts/phase2Prompt.js';
import { phase2Schema } from '../schemas/phase2Schema.js';
import { ZodValidationError } from '../utils/ZodValidationError.js';

export async function generateResolution(ticket, phase1Result) {
  const messages  = buildPhase2Prompt(ticket, phase1Result);
  const response  = await callAI(messages, { ticketId: ticket.id, phase: 'phase2' });

  const raw = response.choices[0].message.content;

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ZodValidationError(`AI returned invalid JSON: ${raw?.slice(0, 200)}`);
  }

  const validation = phase2Schema.safeParse(parsed);
  if (!validation.success) {
    throw new ZodValidationError(`Phase 2 output failed schema validation: ${validation.error.message}`);
  }

  const provider = extractProvider(response);
  return { result: validation.data, provider };
}
