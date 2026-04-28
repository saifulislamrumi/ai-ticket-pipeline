import pg from 'pg';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));

export async function setupDb(): Promise<void> {
  const pool      = new Pool({ connectionString: process.env.DATABASE_URL });
  const migrations = [
    '001_create_tickets.sql',
    '002_create_ticket_phases.sql',
    '003_create_ticket_events.sql',
  ];
  for (const file of migrations) {
    const sql = readFileSync(join(__dirname, '../../migrations', file), 'utf8');
    await pool.query(sql);
  }
  await pool.end();
}
