import { pool } from './pool.js';

export async function insertPhase({ ticketId, phase }) {
  const result = await pool.query(
    `INSERT INTO ticket_phases (ticket_id, phase, status)
     VALUES ($1, $2, 'queued')
     RETURNING id`,
    [ticketId, phase]
  );
  return result.rows[0];
}

export async function updatePhase(ticketId, phase, fields) {
  const sets = [];
  const values = [];
  let i = 1;

  if (fields.status !== undefined)        { sets.push(`status = $${i++}`);         values.push(fields.status); }
  if (fields.attemptCount !== undefined)  { sets.push(`attempt_count = $${i++}`);  values.push(fields.attemptCount); }
  if (fields.providerUsed !== undefined)  { sets.push(`provider_used = $${i++}`);  values.push(fields.providerUsed); }
  if (fields.result !== undefined)        { sets.push(`result = $${i++}`);          values.push(JSON.stringify(fields.result)); }
  if (fields.latencyMs !== undefined)     { sets.push(`latency_ms = $${i++}`);     values.push(fields.latencyMs); }
  if (fields.errorMessage !== undefined)  { sets.push(`error_message = $${i++}`);  values.push(fields.errorMessage); }
  if (fields.startedAt !== undefined)     { sets.push(`started_at = $${i++}`);     values.push(fields.startedAt); }
  if (fields.completedAt !== undefined)   { sets.push(`completed_at = $${i++}`);   values.push(fields.completedAt); }

  if (sets.length === 0) return;

  values.push(ticketId, phase);
  await pool.query(
    `UPDATE ticket_phases SET ${sets.join(', ')} WHERE ticket_id = $${i++} AND phase = $${i++}`,
    values
  );
}

export async function findPhaseByTicket(ticketId, phase) {
  const result = await pool.query(
    `SELECT * FROM ticket_phases WHERE ticket_id = $1 AND phase = $2`,
    [ticketId, phase]
  );
  return result.rows[0] ?? null;
}
