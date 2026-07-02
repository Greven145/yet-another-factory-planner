import { describe, it, expect } from 'vitest';
import { describeTransport, formatTransport } from './transport';

const NO_CAPS = { beltCapacity: null, pipeCapacity: null };

describe('describeTransport', () => {
  it('counts belts against the selected tier', () => {
    // 1400/min on Mk.6 (1200) belts → 2 lines.
    const info = describeTransport(1400, false, { beltCapacity: 1200, pipeCapacity: null });
    expect(info).toMatchObject({ medium: 'belt', tierLabel: 'Mk.6', tierRate: 1200, lineCount: 2, autoTier: false });
  });

  it('needs a single belt when the rate fits the selected tier exactly', () => {
    const info = describeTransport(480, false, { beltCapacity: 480, pipeCapacity: null });
    expect(info).toMatchObject({ lineCount: 1, tierLabel: 'Mk.4', autoTier: false });
  });

  it('auto-picks the smallest tier that carries the flow on one line when disabled', () => {
    // 300/min, no belt tier selected → Mk.4 (480) is the smallest single-line tier.
    const info = describeTransport(300, false, NO_CAPS);
    expect(info).toMatchObject({ tierLabel: 'Mk.4', tierRate: 480, lineCount: 1, autoTier: true });
  });

  it('auto mode falls back to the top tier with multiple lines when the flow exceeds Mk.6', () => {
    const info = describeTransport(2500, false, NO_CAPS);
    expect(info).toMatchObject({ tierLabel: 'Mk.6', tierRate: 1200, lineCount: 3, autoTier: true });
  });

  it('routes fluids through pipe tiers', () => {
    // 700 m³/min on Mk.2 (600) pipes → 2 lines.
    const info = describeTransport(700, true, { beltCapacity: null, pipeCapacity: 600 });
    expect(info).toMatchObject({ medium: 'pipe', tierLabel: 'Mk.2', lineCount: 2, autoTier: false });
  });

  it('auto-picks pipe tiers for fluids when disabled', () => {
    const info = describeTransport(250, true, NO_CAPS);
    expect(info).toMatchObject({ medium: 'pipe', tierLabel: 'Mk.1', tierRate: 300, lineCount: 1, autoTier: true });
  });

  it('returns null for a non-positive rate', () => {
    expect(describeTransport(0, false, NO_CAPS)).toBeNull();
    expect(describeTransport(-5, false, NO_CAPS)).toBeNull();
  });

  it('formats a compact line count and tier label', () => {
    const info = describeTransport(1400, false, { beltCapacity: 1200, pipeCapacity: null })!;
    expect(formatTransport(info)).toBe('2× Mk.6');
  });
});
