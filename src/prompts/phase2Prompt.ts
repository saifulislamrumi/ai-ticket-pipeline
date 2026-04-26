// src/prompts/phase2Prompt.ts
import type { ChatMessage, TicketRow } from '../types/index.js';

export function buildPhase2Prompt(ticket: TicketRow, phase1Result: unknown): ChatMessage[] {
  return [
    {
      role: 'system',
      content: `You are a support resolution assistant. Using the original ticket and the Phase 1 triage result, generate a resolution draft.

Return ONLY a valid JSON object with exactly these 3 fields. No markdown, no explanation, no code blocks.

Required fields (exact names):
- customerReply: a professional, empathetic customer-facing response (min 50 chars, max 2000 chars)
- internalNote: a concise internal note for the support team (min 20 chars, max 1000 chars)
- nextActions: an array of 1–5 action strings for the support agent

Example output:
{
  "customerReply": "Dear customer, thank you for reaching out. We understand this is urgent and our team is already investigating your authentication issue. We will provide an update within 1 hour and work to resolve this as quickly as possible.",
  "internalNote": "P2 authentication issue. Sentiment frustrated. No escalation required. Routed to tier2 for immediate investigation.",
  "nextActions": ["Contact customer within 1 hour", "Check auth service logs", "Reset user session tokens", "Follow up if unresolved after 2 hours"]
}`,
    },
    {
      role: 'user',
      content: `Subject: ${ticket.subject}
Body: ${ticket.body}

Phase 1 Triage Result:
${JSON.stringify(phase1Result, null, 2)}`,
    },
  ];
}
