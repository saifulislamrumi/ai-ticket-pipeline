// src/db/pool.ts
import pg from 'pg';
import { config } from '../config/index.ts';

const { Pool } = pg;

export const pool = new Pool({ connectionString: config.DATABASE_URL });
