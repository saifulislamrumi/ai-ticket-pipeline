import { pool } from '../db/pool.js';

class TicketEventRepository {
  async insert({ ticketId, phase, eventType, payload }) {
    await pool.query(
      `INSERT INTO ticket_events (ticket_id, phase, event_type, payload)
       VALUES ($1, $2, $3, $4)`,
      [
        ticketId,
        phase   ?? null,
        eventType,
        payload ? JSON.stringify(payload) : null,
      ]
    );
  }

  async findByTicket(ticketId, limit = 20) {
    const result = await pool.query(
      `SELECT id, phase, event_type, payload, created_at
       FROM ticket_events
       WHERE ticket_id = $1
       ORDER BY created_at ASC
       LIMIT $2`,
      [ticketId, limit]
    );
    return result.rows;
  }
}

export const ticketEventRepository = new TicketEventRepository();
