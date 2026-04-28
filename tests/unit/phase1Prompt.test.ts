import { describe, it, expect } from 'vitest';
import { buildPhase1Prompt } from '../../src/prompts/phase1Prompt.ts';
import { fakeTicket } from '../helpers/fakeData.ts';

describe('buildPhase1Prompt', () => {
  it('returns exactly 2 messages', () => {
    expect(buildPhase1Prompt(fakeTicket)).toHaveLength(2);
  });

  it('first message has system role', () => {
    const [system] = buildPhase1Prompt(fakeTicket);
    expect(system.role).toBe('system');
  });

  it('second message has user role', () => {
    const [, user] = buildPhase1Prompt(fakeTicket);
    expect(user.role).toBe('user');
  });

  it('user message contains ticket subject', () => {
    const [, user] = buildPhase1Prompt(fakeTicket);
    expect(user.content).toContain(fakeTicket.subject);
  });

  it('user message contains ticket body', () => {
    const [, user] = buildPhase1Prompt(fakeTicket);
    expect(user.content).toContain(fakeTicket.body);
  });

  it('system message instructs JSON-only output', () => {
    const [system] = buildPhase1Prompt(fakeTicket);
    expect(system.content).toContain('JSON');
  });

  it('system message lists all required fields', () => {
    const [system] = buildPhase1Prompt(fakeTicket);
    expect(system.content).toContain('category');
    expect(system.content).toContain('priority');
    expect(system.content).toContain('sentiment');
    expect(system.content).toContain('escalation');
    expect(system.content).toContain('routingTarget');
    expect(system.content).toContain('summary');
  });
});
