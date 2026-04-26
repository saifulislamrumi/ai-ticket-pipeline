// src/repositories/TicketRepository.ts
import { type Pool } from 'pg';
import { pool } from '../db/pool.ts';
import type { InsertTicketData, TicketRow, TicketStatus } from '../types/index.ts';

class TicketRepository {
  constructor(private readonly pool: Pool) {}

  async insert({ id, tenantId, subject, body }: InsertTicketData): Promise<TicketRow> {
    const result = await this.pool.query<TicketRow>(
      `INSERT INTO tickets (id, tenant_id, subject, body, status)
       VALUES ($1, $2, $3, $4, 'queued')
       RETURNING id, status, created_at, updated_at`,
      [id, tenantId, subject, body],
    );
    return result.rows[0];
  }

  async findById(id: string): Promise<TicketRow | null> {
    const result = await this.pool.query<TicketRow>(
      `SELECT id, tenant_id, subject, body, status, created_at, updated_at
       FROM tickets WHERE id = $1`,
      [id],
    );
    return result.rows[0] ?? null;
  }

  async updateStatus(id: string, status: TicketStatus): Promise<void> {
    await this.pool.query(
      `UPDATE tickets SET status = $1, updated_at = NOW() WHERE id = $2`,
      [status, id],
    );
  }
}

export const ticketRepository = new TicketRepository(pool);
