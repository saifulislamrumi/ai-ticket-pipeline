import { pool } from './pool.js';

export async function insertTicket({ id, subject, body, customerEmail }) {
  const result = await pool.query(
    `INSERT INTO tickets (id, subject, body, customer_email, status)
     VALUES ($1, $2, $3, $4, 'queued')
     RETURNING id, status, created_at, updated_at`,
    [id, subject, body, customerEmail ?? null]
  );
  return result.rows[0];
}

export async function findTicketById(id) {
  const result = await pool.query(
    `SELECT id, subject, status, phase1_result, phase2_result, created_at, updated_at
     FROM tickets WHERE id = $1`,
    [id]
  );
  return result.rows[0] ?? null;
}

export async function updateTicketStatus(id, status) {
  await pool.query(
    `UPDATE tickets SET status = $1, updated_at = NOW() WHERE id = $2`,
    [status, id]
  );
}

export async function updateTicketPhaseResult(id, phase, result) {
  const column = phase === 1 ? 'phase1_result' : 'phase2_result';
  await pool.query(
    `UPDATE tickets SET ${column} = $1, updated_at = NOW() WHERE id = $2`,
    [JSON.stringify(result), id]
  );
}
