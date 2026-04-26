import { pool } from './pool.js';

export async function insertEvent({ ticketId, phase, eventType, attempt, delayMs, jitterMs, provider, metadata }) {
  await pool.query(
    `INSERT INTO ticket_events (ticket_id, phase, event_type, attempt, delay_ms, jitter_ms, provider, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      ticketId,
      phase ?? null,
      eventType,
      attempt ?? null,
      delayMs ?? null,
      jitterMs ?? null,
      provider ?? null,
      metadata ? JSON.stringify(metadata) : null,
    ]
  );
}
