import { describe, it, expect } from 'vitest';
import { buildPhase2Prompt } from '../../src/prompts/phase2Prompt.ts';
import { fakeTicket, fakePhase1Output } from '../helpers/fakeData.ts';

describe('buildPhase2Prompt', () => {
  it('returns exactly 2 messages', () => {
    expect(buildPhase2Prompt(fakeTicket, fakePhase1Output)).toHaveLength(2);
  });

  it('first message has system role', () => {
    const [system] = buildPhase2Prompt(fakeTicket, fakePhase1Output);
    expect(system.role).toBe('system');
  });

  it('second message has user role', () => {
    const [, user] = buildPhase2Prompt(fakeTicket, fakePhase1Output);
    expect(user.role).toBe('user');
  });

  it('user message contains ticket subject', () => {
    const [, user] = buildPhase2Prompt(fakeTicket, fakePhase1Output);
    expect(user.content).toContain(fakeTicket.subject);
  });

  it('user message contains ticket body', () => {
    const [, user] = buildPhase2Prompt(fakeTicket, fakePhase1Output);
    expect(user.content).toContain(fakeTicket.body);
  });

  it('user message contains serialized phase1 result', () => {
    const [, user] = buildPhase2Prompt(fakeTicket, fakePhase1Output);
    expect(user.content).toContain(fakePhase1Output.category);
    expect(user.content).toContain(fakePhase1Output.routingTarget);
  });

  it('system message lists all required output fields', () => {
    const [system] = buildPhase2Prompt(fakeTicket, fakePhase1Output);
    expect(system.content).toContain('customerReply');
    expect(system.content).toContain('internalNote');
    expect(system.content).toContain('nextActions');
  });
});
