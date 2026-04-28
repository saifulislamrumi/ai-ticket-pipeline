import { describe, it, expect } from 'vitest';
import { phase1Schema } from '../../src/schemas/phase1Schema.ts';
import { fakePhase1Output } from '../helpers/fakeData.ts';

describe('phase1Schema', () => {
  it('accepts a fully valid output', () => {
    expect(phase1Schema.safeParse(fakePhase1Output).success).toBe(true);
  });

  it('rejects when category is missing', () => {
    const { category: _, ...rest } = fakePhase1Output;
    expect(phase1Schema.safeParse(rest).success).toBe(false);
  });

  it('rejects an invalid priority value', () => {
    expect(phase1Schema.safeParse({ ...fakePhase1Output, priority: 'urgent' }).success).toBe(false);
  });

  it('rejects an invalid sentiment value', () => {
    expect(phase1Schema.safeParse({ ...fakePhase1Output, sentiment: 'angry' }).success).toBe(false);
  });

  it('rejects an invalid routingTarget', () => {
    expect(phase1Schema.safeParse({ ...fakePhase1Output, routingTarget: 'unknown_team' }).success).toBe(false);
  });

  it('rejects non-boolean escalation', () => {
    expect(phase1Schema.safeParse({ ...fakePhase1Output, escalation: 'yes' }).success).toBe(false);
  });

  it('rejects summary shorter than 10 chars', () => {
    expect(phase1Schema.safeParse({ ...fakePhase1Output, summary: 'short' }).success).toBe(false);
  });

  it('rejects summary longer than 300 chars', () => {
    expect(phase1Schema.safeParse({ ...fakePhase1Output, summary: 'a'.repeat(301) }).success).toBe(false);
  });

  it('accepts escalation: true', () => {
    expect(phase1Schema.safeParse({ ...fakePhase1Output, escalation: true }).success).toBe(true);
  });
});
