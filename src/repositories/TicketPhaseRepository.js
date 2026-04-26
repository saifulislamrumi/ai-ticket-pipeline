import { pool } from '../db/pool.js';

class TicketPhaseRepository {
  async insert({ ticketId, phase }) {
    const result = await pool.query(
      `INSERT INTO ticket_phases (ticket_id, phase) VALUES ($1, $2)
       ON CONFLICT (ticket_id, phase) DO NOTHING
       RETURNING id`,
      [ticketId, phase]
    );
    return result.rows[0];
  }

  async update(ticketId, phase, fields) {
    const sets   = [];
    const values = [];
    let i = 1;

    if (fields.status      !== undefined) { sets.push(`status = $${i++}`);       values.push(fields.status); }
    if (fields.attempts    !== undefined) { sets.push(`attempts = $${i++}`);      values.push(fields.attempts); }
    if (fields.output      !== undefined) { sets.push(`output = $${i++}`);        values.push(JSON.stringify(fields.output)); }
    if (fields.startedAt   !== undefined) { sets.push(`started_at = $${i++}`);   values.push(fields.startedAt); }
    if (fields.completedAt !== undefined) { sets.push(`completed_at = $${i++}`); values.push(fields.completedAt); }

    if (sets.length === 0) return;

    values.push(ticketId, phase);
    await pool.query(
      `UPDATE ticket_phases SET ${sets.join(', ')} WHERE ticket_id = $${i++} AND phase = $${i++}`,
      values
    );
  }

  async findByTicket(ticketId, phase) {
    const result = await pool.query(
      `SELECT * FROM ticket_phases WHERE ticket_id = $1 AND phase = $2`,
      [ticketId, phase]
    );
    return result.rows[0] ?? null;
  }

  async findAllByTicket(ticketId) {
    const result = await pool.query(
      `SELECT * FROM ticket_phases WHERE ticket_id = $1`,
      [ticketId]
    );
    return result.rows;
  }
}

export const ticketPhaseRepository = new TicketPhaseRepository();
