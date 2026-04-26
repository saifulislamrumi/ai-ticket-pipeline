import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { pool } from '../src/db/pool.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const migrations = [
  '001_create_tickets.sql',
  '002_create_ticket_phases.sql',
  '003_create_ticket_events.sql',
];

for (const file of migrations) {
  const sql = readFileSync(join(__dirname, file), 'utf8');
  await pool.query(sql);
  console.log(`✅ Ran: ${file}`);
}

await pool.end();
