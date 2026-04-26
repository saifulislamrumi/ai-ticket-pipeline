import { callAI, extractProvider } from './aiGateway.js';
import { buildPhase1Prompt } from '../prompts/phase1Prompt.js';
import { phase1Schema } from '../schemas/phase1Schema.js';
import { ZodValidationError } from '../utils/ZodValidationError.js';

export async function triage(ticket) {
  const messages  = buildPhase1Prompt(ticket);
  const response  = await callAI(messages, { ticketId: ticket.id, phase: 'phase1' });

  const raw = response.choices[0].message.content;

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ZodValidationError(`AI returned invalid JSON: ${raw?.slice(0, 200)}`);
  }

  const validation = phase1Schema.safeParse(parsed);
  if (!validation.success) {
    throw new ZodValidationError(`Phase 1 output failed schema validation: ${validation.error.message}`);
  }

  const provider = extractProvider(response);
  return { result: validation.data, provider };
}
