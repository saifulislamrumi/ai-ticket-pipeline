import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fakeTicket, fakePhase1Output, fakePhase2Output } from '../helpers/fakeData.ts';

vi.mock('../../src/services/aiGateway.ts', () => ({
  aiGateway: { call: vi.fn() },
}));

import { resolutionService } from '../../src/services/resolutionService.ts';
import { aiGateway }         from '../../src/services/aiGateway.ts';

const mockAIResponse = (content: string) => ({
  provider: 'groq',
  response: {
    model:   'llama-3.1-8b',
    choices: [{ message: { role: 'assistant', content } }],
  },
});

describe('resolutionService.generateResolution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns Phase2Output on valid AI response', async () => {
    vi.mocked(aiGateway.call).mockResolvedValue(mockAIResponse(JSON.stringify(fakePhase2Output)));

    const { result, provider } = await resolutionService.generateResolution(fakeTicket, fakePhase1Output);

    expect(result).toEqual(fakePhase2Output);
    expect(provider).toBe('groq');
  });

  it('calls aiGateway with phase2 metadata', async () => {
    vi.mocked(aiGateway.call).mockResolvedValue(mockAIResponse(JSON.stringify(fakePhase2Output)));

    await resolutionService.generateResolution(fakeTicket, fakePhase1Output);

    expect(aiGateway.call).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({ phase: 'phase2', ticketId: fakeTicket.id }),
    );
  });

  it('throws ZodValidationError when AI returns invalid JSON', async () => {
    vi.mocked(aiGateway.call).mockResolvedValue(mockAIResponse('not valid json'));

    await expect(resolutionService.generateResolution(fakeTicket, fakePhase1Output)).rejects.toThrow('invalid JSON');
  });

  it('throws ZodValidationError when AI returns JSON with wrong shape', async () => {
    vi.mocked(aiGateway.call).mockResolvedValue(mockAIResponse(JSON.stringify({ unexpected: true })));

    await expect(resolutionService.generateResolution(fakeTicket, fakePhase1Output)).rejects.toThrow('schema validation');
  });

  it('throws ZodValidationError when customerReply is too short', async () => {
    const bad = { ...fakePhase2Output, customerReply: 'too short' };
    vi.mocked(aiGateway.call).mockResolvedValue(mockAIResponse(JSON.stringify(bad)));

    await expect(resolutionService.generateResolution(fakeTicket, fakePhase1Output)).rejects.toThrow('schema validation');
  });
});
