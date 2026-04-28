import { describe, it, expect, vi, afterEach } from 'vitest';
import request from 'supertest';
import { v4 as uuidv4 } from 'uuid';
import { createApp } from '../helpers/createApp.ts';
import { cleanDb }   from '../helpers/cleanDb.ts';
import { validTicketPayload } from '../helpers/fakeData.ts';
import { ticketRepository }      from '../../src/repositories/TicketRepository.ts';
import { ticketPhaseRepository } from '../../src/repositories/TicketPhaseRepository.ts';

vi.mock('../../src/queue/sqsClient.ts', () => ({
  sqsClient: {
    sendMessage:     vi.fn().mockResolvedValue({}),
    receiveMessages: vi.fn().mockResolvedValue([]),
    deleteMessage:   vi.fn().mockResolvedValue({}),
  },
}));

const app = createApp();

afterEach(cleanDb);

describe('POST /api/tickets', () => {
  it('returns 202 with ticketId and queued status', async () => {
    const res = await request(app).post('/api/tickets').send(validTicketPayload);

    expect(res.status).toBe(202);
    expect(res.body.status).toBe('queued');
    expect(typeof res.body.ticketId).toBe('string');
  });

  it('inserts ticket into DB with queued status', async () => {
    const res = await request(app).post('/api/tickets').send(validTicketPayload);
    const ticket = await ticketRepository.findById(res.body.ticketId);

    expect(ticket).not.toBeNull();
    expect(ticket!.status).toBe('queued');
    expect(ticket!.tenant_id).toBe(validTicketPayload.tenantId);
  });

  it('returns 400 when tenantId is missing', async () => {
    const res = await request(app).post('/api/tickets').send({ subject: 'test', body: 'body content here' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
  });

  it('returns 400 when body is too short', async () => {
    const res = await request(app).post('/api/tickets').send({ ...validTicketPayload, body: 'short' });

    expect(res.status).toBe(400);
    expect(res.body.fields[0].field).toBe('body');
  });

  it('returns 400 when subject is missing', async () => {
    const res = await request(app).post('/api/tickets').send({ tenantId: 'tenant-1', body: 'long enough body content here' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
  });
});

describe('GET /api/tickets/:taskId', () => {
  it('returns 404 for unknown ticketId', async () => {
    const res = await request(app).get(`/api/tickets/${uuidv4()}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('NOT_FOUND');
  });

  it('returns ticket status and empty phases for a fresh ticket', async () => {
    const submit = await request(app).post('/api/tickets').send(validTicketPayload);
    const { ticketId } = submit.body;

    const res = await request(app).get(`/api/tickets/${ticketId}`);

    expect(res.status).toBe(200);
    expect(res.body.ticketId).toBe(ticketId);
    expect(res.body.status).toBe('queued');
    expect(res.body.phases).toEqual({});
  });

  it('returns phase info once phase1 is inserted', async () => {
    const submit = await request(app).post('/api/tickets').send(validTicketPayload);
    const { ticketId } = submit.body;

    await ticketPhaseRepository.insert({ ticketId, phase: 'phase1' });
    await ticketPhaseRepository.update(ticketId, 'phase1', { status: 'processing', attempts: 1 });

    const res = await request(app).get(`/api/tickets/${ticketId}`);

    expect(res.status).toBe(200);
    expect(res.body.phases.triage.status).toBe('processing');
  });

  it('includes events in response', async () => {
    const submit = await request(app).post('/api/tickets').send(validTicketPayload);
    const { ticketId } = submit.body;

    const res = await request(app).get(`/api/tickets/${ticketId}`);

    expect(Array.isArray(res.body.events)).toBe(true);
    expect(res.body.events[0].eventType).toBe('queued');
  });
});

describe('GET /api/tickets', () => {
  it('returns empty list when no tickets exist', async () => {
    const res = await request(app).get('/api/tickets');

    expect(res.status).toBe(200);
    expect(res.body.tickets).toEqual([]);
  });

  it('returns all submitted tickets', async () => {
    await request(app).post('/api/tickets').send(validTicketPayload);
    await request(app).post('/api/tickets').send({ ...validTicketPayload, tenantId: 'tenant-2' });

    const res = await request(app).get('/api/tickets');

    expect(res.status).toBe(200);
    expect(res.body.tickets).toHaveLength(2);
  });

  it('each ticket entry has id, status, created_at', async () => {
    await request(app).post('/api/tickets').send(validTicketPayload);

    const res = await request(app).get('/api/tickets');
    const [ticket] = res.body.tickets;

    expect(ticket).toHaveProperty('id');
    expect(ticket).toHaveProperty('status');
    expect(ticket).toHaveProperty('created_at');
  });
});

describe('POST /api/tickets/:taskId/replay', () => {
  it('returns 404 for unknown ticketId', async () => {
    const res = await request(app).post(`/api/tickets/${uuidv4()}/replay`);

    expect(res.status).toBe(404);
  });

  it('returns 409 when ticket is not failed', async () => {
    const submit = await request(app).post('/api/tickets').send(validTicketPayload);
    const { ticketId } = submit.body;

    const res = await request(app).post(`/api/tickets/${ticketId}/replay`);

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('CONFLICT');
  });

  it('returns 202 and re-queues a failed ticket', async () => {
    const submit = await request(app).post('/api/tickets').send(validTicketPayload);
    const { ticketId } = submit.body;

    await ticketRepository.updateStatus(ticketId, 'failed');

    const res = await request(app).post(`/api/tickets/${ticketId}/replay`);

    expect(res.status).toBe(202);
    expect(res.body.status).toBe('queued');
  });

  it('re-queues to phase1 when phase1 has not completed', async () => {
    const { sqsClient } = await import('../../src/queue/sqsClient.ts');
    vi.clearAllMocks();

    const submit = await request(app).post('/api/tickets').send(validTicketPayload);
    const { ticketId } = submit.body;

    await ticketRepository.updateStatus(ticketId, 'failed');
    await ticketPhaseRepository.insert({ ticketId, phase: 'phase1' });
    await ticketPhaseRepository.update(ticketId, 'phase1', { status: 'failed' });

    await request(app).post(`/api/tickets/${ticketId}/replay`);

    expect(sqsClient.sendMessage).toHaveBeenCalledWith(
      expect.stringContaining('phase1Queue'),
      expect.objectContaining({ taskId: ticketId }),
    );
  });
});

describe('GET /health', () => {
  it('returns 200 with status ok', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(typeof res.body.timestamp).toBe('string');
  });
});
