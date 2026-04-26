// src/repositories/TicketEventRepository.ts
import { type Pool } from 'pg';
import { pool } from '../db/pool.js';
import type { EventRow, InsertEventData } from '../types/index.js';

class TicketEventRepository {
  constructor(private readonly pool: Pool) {}

  async insert({ ticketId, phase, eventType, payload }: InsertEventData): Promise<void> {
    await this.pool.query(
      `INSERT INTO ticket_events (ticket_id, phase, event_type, payload)
       VALUES ($1, $2, $3, $4)`,
      [
        ticketId,
        phase   ?? null,
        eventType,
        payload ? JSON.stringify(payload) : null,
      ],
    );
  }

  async findByTicket(ticketId: string, limit = 20): Promise<EventRow[]> {
    const result = await this.pool.query<EventRow>(
      `SELECT id, phase, event_type, payload, created_at
       FROM ticket_events
       WHERE ticket_id = $1
       ORDER BY created_at ASC
       LIMIT $2`,
      [ticketId, limit],
    );
    return result.rows;
  }
}

export const ticketEventRepository = new TicketEventRepository(pool);
