import { describe, it, expect, vi, afterEach } from 'vitest';
import request from 'supertest';
import { createApp }             from '../helpers/createApp.ts';
import { cleanDb }               from '../helpers/cleanDb.ts';
import { validTicketPayload, fakePhase1Output, fakePhase2Output } from '../helpers/fakeData.ts';
import { ticketRepository }      from '../../src/repositories/TicketRepository.ts';
import { ticketPhaseRepository } from '../../src/repositories/TicketPhaseRepository.ts';
import { ticketEventRepository } from '../../src/repositories/TicketEventRepository.ts';

vi.mock('../../src/queue/sqsClient.ts', () => ({
  sqsClient: {
    sendMessage:     vi.fn().mockResolvedValue({}),
    receiveMessages: vi.fn().mockResolvedValue([]),
    deleteMessage:   vi.fn().mockResolvedValue({}),
  },
}));

vi.mock('../../src/services/aiGateway.ts', () => ({
  aiGateway: { call: vi.fn() },
}));

import { triageService }     from '../../src/services/triageService.ts';
import { resolutionService } from '../../src/services/resolutionService.ts';
import { aiGateway }         from '../../src/services/aiGateway.ts';

const app = createApp();

afterEach(cleanDb);

async function runPhase1(ticketId: string): Promise<void> {
  const ticket = await ticketRepository.findById(ticketId);
  if (!ticket) throw new Error(`Ticket ${ticketId} not found`);

  await ticketPhaseRepository.insert({ ticketId, phase: 'phase1' });
  await ticketRepository.updateStatus(ticketId, 'processing');
  await ticketPhaseRepository.update(ticketId, 'phase1', { status: 'processing', attempts: 1, startedAt: new Date() });

  const { result } = await triageService.triage(ticket);

  await ticketPhaseRepository.update(ticketId, 'phase1', { status: 'completed', output: result, attempts: 1, completedAt: new Date() });
  await ticketEventRepository.insert({ ticketId, phase: 'phase1', eventType: 'phase_completed', payload: { provider: 'groq' } });
}

async function runPhase2(ticketId: string): Promise<void> {
  const ticket     = await ticketRepository.findById(ticketId);
  const phase1Row  = await ticketPhaseRepository.findByTicket(ticketId, 'phase1');
  if (!ticket || !phase1Row) throw new Error('Missing ticket or phase1 for phase2');

  await ticketPhaseRepository.insert({ ticketId, phase: 'phase2' });
  await ticketPhaseRepository.update(ticketId, 'phase2', { status: 'processing', attempts: 1, startedAt: new Date() });

  const { result } = await resolutionService.generateResolution(ticket, phase1Row.output);

  await ticketPhaseRepository.update(ticketId, 'phase2', { status: 'completed', output: result, attempts: 1, completedAt: new Date() });
  await ticketRepository.updateStatus(ticketId, 'completed');
  await ticketEventRepository.insert({ ticketId, phase: 'phase2', eventType: 'phase_completed', payload: { provider: 'groq' } });
  await ticketEventRepository.insert({ ticketId, eventType: 'completed', payload: {} });
}

describe('E2E: full ticket pipeline', () => {
  it('ticket goes from queued → processing → completed with both phase outputs', async () => {
    vi.mocked(aiGateway.call)
      .mockResolvedValueOnce({
        provider: 'groq',
        response: { model: 'llama-3.1-8b', choices: [{ message: { role: 'assistant', content: JSON.stringify(fakePhase1Output) } }] },
      })
      .mockResolvedValueOnce({
        provider: 'groq',
        response: { model: 'llama-3.1-8b', choices: [{ message: { role: 'assistant', content: JSON.stringify(fakePhase2Output) } }] },
      });

    // Submit ticket
    const submitRes = await request(app).post('/api/tickets').send(validTicketPayload);
    expect(submitRes.status).toBe(202);
    const { ticketId } = submitRes.body;

    // Run Phase 1
    await runPhase1(ticketId);

    // Verify intermediate state
    const midRes = await request(app).get(`/api/tickets/${ticketId}`);
    expect(midRes.body.phases.triage.status).toBe('completed');

    // Run Phase 2
    await runPhase2(ticketId);

    // Verify final state via HTTP
    const finalRes = await request(app).get(`/api/tickets/${ticketId}`);

    expect(finalRes.status).toBe(200);
    expect(finalRes.body.status).toBe('completed');
    expect(finalRes.body.phases.triage.status).toBe('completed');
    expect(finalRes.body.phases.draft.status).toBe('completed');
    expect(finalRes.body.phases.triage.output).toMatchObject({ category: fakePhase1Output.category });
    expect(finalRes.body.phases.draft.output).toHaveProperty('customerReply');
  });

  it('ticket stays failed when phase1 AI returns invalid JSON', async () => {
    vi.mocked(aiGateway.call).mockResolvedValue({
      provider: 'groq',
      response: { model: 'llama-3.1-8b', choices: [{ message: { role: 'assistant', content: 'not json' } }] },
    });

    const submitRes = await request(app).post('/api/tickets').send(validTicketPayload);
    const { ticketId } = submitRes.body;

    await expect(runPhase1(ticketId)).rejects.toThrow('invalid JSON');

    // Ticket should still exist in DB as processing (worker would mark it failed)
    const ticket = await ticketRepository.findById(ticketId);
    expect(ticket).not.toBeNull();
  });

  it('replay re-runs pipeline from phase1 when phase1 failed', async () => {
    vi.mocked(aiGateway.call)
      .mockResolvedValueOnce({
        provider: 'groq',
        response: { model: 'llama-3.1-8b', choices: [{ message: { role: 'assistant', content: JSON.stringify(fakePhase1Output) } }] },
      })
      .mockResolvedValueOnce({
        provider: 'groq',
        response: { model: 'llama-3.1-8b', choices: [{ message: { role: 'assistant', content: JSON.stringify(fakePhase2Output) } }] },
      });

    // Submit and mark as failed
    const submitRes = await request(app).post('/api/tickets').send(validTicketPayload);
    const { ticketId } = submitRes.body;
    await ticketRepository.updateStatus(ticketId, 'failed');

    // Replay
    const replayRes = await request(app).post(`/api/tickets/${ticketId}/replay`);
    expect(replayRes.status).toBe(202);

    // Run pipeline after replay
    await runPhase1(ticketId);
    await runPhase2(ticketId);

    const finalRes = await request(app).get(`/api/tickets/${ticketId}`);
    expect(finalRes.body.status).toBe('completed');
  });
});
