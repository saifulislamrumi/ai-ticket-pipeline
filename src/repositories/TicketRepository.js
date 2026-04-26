import { pool } from '../db/pool.js';

class TicketRepository {
  async insert({ id, tenantId, subject, body }) {
    const result = await pool.query(
      `INSERT INTO tickets (id, tenant_id, subject, body, status)
       VALUES ($1, $2, $3, $4, 'queued')
       RETURNING id, status, created_at, updated_at`,
      [id, tenantId, subject, body]
    );
    return result.rows[0];
  }

  async findById(id) {
    const result = await pool.query(
      `SELECT id, tenant_id, subject, body, status, created_at, updated_at
       FROM tickets WHERE id = $1`,
      [id]
    );
    return result.rows[0] ?? null;
  }

  async updateStatus(id, status) {
    await pool.query(
      `UPDATE tickets SET status = $1, updated_at = NOW() WHERE id = $2`,
      [status, id]
    );
  }
}

export const ticketRepository = new TicketRepository();
