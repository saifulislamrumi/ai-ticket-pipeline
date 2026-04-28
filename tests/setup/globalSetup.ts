import pg from 'pg';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

config({ path: '.env.test', override: true });

const { Pool } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));

export async function setup(): Promise<void> {
  const testUrl = process.env.DATABASE_URL!;

  // Assumes ticket_pipeline_test already exists.
  // If not, run once: sudo -u postgres createdb -O rumi ticket_pipeline_test
  const testPool   = new Pool({ connectionString: testUrl });
  const migrations = [
    '001_create_tickets.sql',
    '002_create_ticket_phases.sql',
    '003_create_ticket_events.sql',
  ];
  for (const file of migrations) {
    const sql = readFileSync(join(__dirname, '../../migrations', file), 'utf8');
    await testPool.query(sql);
  }
  await testPool.end();
}

export async function teardown(): Promise<void> {}
