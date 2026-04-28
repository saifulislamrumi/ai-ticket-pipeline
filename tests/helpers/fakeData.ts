import type { TicketRow } from '../../src/types/index.ts';
import type { Phase1Output } from '../../src/schemas/phase1Schema.ts';
import type { Phase2Output } from '../../src/schemas/phase2Schema.ts';

export const fakeTicket: TicketRow = {
  id:         'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  tenant_id:  'tenant-1',
  subject:    'Login not working',
  body:       'I cannot login to my account since this morning. It says invalid credentials but my password is correct.',
  status:     'queued',
  created_at: new Date('2026-01-01T00:00:00Z'),
  updated_at: new Date('2026-01-01T00:00:00Z'),
};

export const fakePhase1Output: Phase1Output = {
  category:      'technical',
  priority:      'high',
  sentiment:     'frustrated',
  escalation:    false,
  routingTarget: 'tier2',
  summary:       'User cannot login despite correct credentials, issue persists for hours.',
};

export const fakePhase2Output: Phase2Output = {
  customerReply: 'Dear customer, thank you for reaching out. We understand this is urgent and our team is already investigating your authentication issue. We will provide an update within 1 hour.',
  internalNote:  'P2 authentication issue. Sentiment frustrated. No escalation required. Routed to tier2 for immediate investigation.',
  nextActions:   ['Contact customer within 1 hour', 'Check auth service logs', 'Reset user session tokens'],
};

export const validTicketPayload = {
  tenantId: 'tenant-1',
  subject:  'Login not working',
  body:     'I cannot login to my account since this morning. It says invalid credentials but my password is correct.',
};
