// src/types/index.ts

// ── Domain status types ────────────────────────────────────────────────────
export type TicketStatus = 'queued' | 'processing' | 'completed' | 'failed';
export type PhaseStatus  = 'pending' | 'processing' | 'completed' | 'failed';
export type Phase        = 'phase1' | 'phase2';

// ── DB row shapes (snake_case matches PostgreSQL column names) ─────────────
export interface TicketRow {
  id:         string;
  tenant_id:  string;
  subject:    string;
  body:       string;
  status:     TicketStatus;
  created_at: Date;
  updated_at: Date;
}

export interface PhaseRow {
  id:           string;
  ticket_id:    string;
  phase:        Phase;
  status:       PhaseStatus;
  attempts:     number;
  output:       unknown;
  started_at:   Date | null;
  completed_at: Date | null;
}

export interface EventRow {
  id:         string;
  ticket_id:  string;
  phase:      Phase | null;
  event_type: string;
  payload:    unknown;
  created_at: Date;
}

// ── Repository input types ─────────────────────────────────────────────────
export interface InsertTicketData {
  id:       string;
  tenantId: string;
  subject:  string;
  body:     string;
}

export interface InsertPhaseData {
  ticketId: string;
  phase:    Phase;
}

export interface UpdatePhaseFields {
  status?:      PhaseStatus;
  attempts?:    number;
  output?:      unknown;
  startedAt?:   Date;
  completedAt?: Date;
}

export interface InsertEventData {
  ticketId:  string;
  phase?:    Phase;
  eventType: string;
  payload?:  Record<string, unknown>;
}

// ── AI gateway types ──────────────────────────────────────────────────────
export interface AIMetadata {
  ticketId: string;
  phase:    string;
}

export interface ChatMessage {
  role:    'system' | 'user' | 'assistant';
  content: string;
}

export interface AIResponse {
  model?: string;
  choices: Array<{
    message: {
      content: string | null;
      role:    string;
    };
  }>;
}

// ── SQS message body ──────────────────────────────────────────────────────
export interface SQSMessageBody {
  taskId: string;
}

// ── Socket.io event constants ─────────────────────────────────────────────
export const SOCKET_EVENTS = {
  JOIN_TICKET:      'join:ticket',
  TICKET_RECEIVED:  'ticket:received',
  PHASE1_STARTED:   'phase1:started',
  PHASE1_COMPLETE:  'phase1:complete',
  PHASE2_STARTED:   'phase2:started',
  PHASE2_COMPLETE:  'phase2:complete',
  TICKET_COMPLETED: 'ticket:completed',
  TICKET_FAILED:    'ticket:failed',
} as const;

export type SocketEvent = typeof SOCKET_EVENTS[keyof typeof SOCKET_EVENTS];

// ── API response shapes ────────────────────────────────────────────────────
export interface PhaseView {
  status:   PhaseStatus;
  attempts: number;
  output:   unknown;
}

export interface EventView {
  eventType: string;
  phase:     Phase | null;
  payload:   unknown;
  createdAt: Date;
}

export interface StatusResponse {
  ticketId:  string;
  status:    TicketStatus;
  createdAt: Date;
  updatedAt: Date;
  phases:    Partial<Record<string, PhaseView>>;
  events:    EventView[];
}
