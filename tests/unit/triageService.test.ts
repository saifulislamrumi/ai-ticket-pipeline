import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fakeTicket, fakePhase1Output } from '../helpers/fakeData.ts';

vi.mock('../../src/services/aiGateway.ts', () => ({
  aiGateway: { call: vi.fn() },
}));

import { triageService } from '../../src/services/triageService.ts';
import { aiGateway }     from '../../src/services/aiGateway.ts';

const mockAIResponse = (content: string) => ({
  provider: 'groq',
  response: {
    model:   'llama-3.1-8b',
    choices: [{ message: { role: 'assistant', content } }],
  },
});

describe('triageService.triage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns Phase1Output on valid AI response', async () => {
    vi.mocked(aiGateway.call).mockResolvedValue(mockAIResponse(JSON.stringify(fakePhase1Output)));

    const { result, provider } = await triageService.triage(fakeTicket);

    expect(result).toEqual(fakePhase1Output);
    expect(provider).toBe('groq');
  });

  it('calls aiGateway with phase1 metadata', async () => {
    vi.mocked(aiGateway.call).mockResolvedValue(mockAIResponse(JSON.stringify(fakePhase1Output)));

    await triageService.triage(fakeTicket);

    expect(aiGateway.call).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({ phase: 'phase1', ticketId: fakeTicket.id }),
    );
  });

  it('throws ZodValidationError when AI returns invalid JSON', async () => {
    vi.mocked(aiGateway.call).mockResolvedValue(mockAIResponse('not json at all'));

    await expect(triageService.triage(fakeTicket)).rejects.toThrow('invalid JSON');
  });

  it('throws ZodValidationError when AI returns JSON with wrong shape', async () => {
    vi.mocked(aiGateway.call).mockResolvedValue(mockAIResponse(JSON.stringify({ wrong: 'fields' })));

    await expect(triageService.triage(fakeTicket)).rejects.toThrow('schema validation');
  });

  it('throws ZodValidationError when AI returns invalid enum value', async () => {
    const bad = { ...fakePhase1Output, priority: 'urgent' };
    vi.mocked(aiGateway.call).mockResolvedValue(mockAIResponse(JSON.stringify(bad)));

    await expect(triageService.triage(fakeTicket)).rejects.toThrow('schema validation');
  });
});
