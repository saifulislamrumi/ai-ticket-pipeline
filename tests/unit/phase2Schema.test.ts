import { describe, it, expect } from 'vitest';
import { phase2Schema } from '../../src/schemas/phase2Schema.ts';
import { fakePhase2Output } from '../helpers/fakeData.ts';

describe('phase2Schema', () => {
  it('accepts a fully valid output', () => {
    expect(phase2Schema.safeParse(fakePhase2Output).success).toBe(true);
  });

  it('rejects customerReply shorter than 50 chars', () => {
    expect(phase2Schema.safeParse({ ...fakePhase2Output, customerReply: 'too short reply' }).success).toBe(false);
  });

  it('rejects customerReply longer than 2000 chars', () => {
    expect(phase2Schema.safeParse({ ...fakePhase2Output, customerReply: 'a'.repeat(2001) }).success).toBe(false);
  });

  it('rejects internalNote shorter than 20 chars', () => {
    expect(phase2Schema.safeParse({ ...fakePhase2Output, internalNote: 'too short' }).success).toBe(false);
  });

  it('rejects internalNote longer than 1000 chars', () => {
    expect(phase2Schema.safeParse({ ...fakePhase2Output, internalNote: 'a'.repeat(1001) }).success).toBe(false);
  });

  it('rejects empty nextActions array', () => {
    expect(phase2Schema.safeParse({ ...fakePhase2Output, nextActions: [] }).success).toBe(false);
  });

  it('rejects nextActions with more than 5 items', () => {
    expect(phase2Schema.safeParse({ ...fakePhase2Output, nextActions: ['a', 'b', 'c', 'd', 'e', 'f'] }).success).toBe(false);
  });

  it('accepts nextActions with exactly 5 items', () => {
    expect(phase2Schema.safeParse({ ...fakePhase2Output, nextActions: ['a', 'b', 'c', 'd', 'e'] }).success).toBe(true);
  });

  it('rejects missing customerReply', () => {
    const { customerReply: _, ...rest } = fakePhase2Output;
    expect(phase2Schema.safeParse(rest).success).toBe(false);
  });
});
