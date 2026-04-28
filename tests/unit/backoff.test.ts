import { describe, it, expect } from 'vitest';
import { calcDelay } from '../../src/utils/backoff.ts';

describe('calcDelay', () => {
  it('returns a number', () => {
    expect(typeof calcDelay(1)).toBe('number');
  });

  it('falls within expected range for attempt 1 (2000–2500ms)', () => {
    const delay = calcDelay(1);
    expect(delay).toBeGreaterThanOrEqual(2000);
    expect(delay).toBeLessThan(2500);
  });

  it('falls within expected range for attempt 2 (4000–4500ms)', () => {
    const delay = calcDelay(2);
    expect(delay).toBeGreaterThanOrEqual(4000);
    expect(delay).toBeLessThan(4500);
  });

  it('falls within expected range for attempt 3 (8000–8500ms)', () => {
    const delay = calcDelay(3);
    expect(delay).toBeGreaterThanOrEqual(8000);
    expect(delay).toBeLessThan(8500);
  });

  it('grows exponentially — attempt 2 base always exceeds attempt 1 max', () => {
    // attempt 1 max = 2500, attempt 2 min = 4000 — no overlap
    expect(calcDelay(2)).toBeGreaterThan(2500);
  });
});
