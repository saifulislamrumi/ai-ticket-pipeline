import { pool } from '../../src/db/pool.ts';

export async function cleanDb(): Promise<void> {
  await pool.query('TRUNCATE tickets, ticket_phases, ticket_events CASCADE');
}
