import { describe, expect, it } from 'vitest';
import { canonicalize, roundLeaf } from './canonicalize';

// Small helper to build a SolverResults-shaped literal. We cast to any so the
// tests can supply only the fields under test without the real solver.
function results(over: Record<string, unknown>): any {
  return {
    productionGraph: null,
    report: null,
    timestamp: 123456,
    computeTime: 42,
    error: null,
    ...over,
  };
}

describe('roundLeaf', () => {
  it('rounds to 9 significant figures', () => {
    expect(roundLeaf(1.2345678912345)).toBe(1.23456789);
  });

  it('collapses near-zero (1e-12) to 0', () => {
    expect(roundLeaf(1e-12)).toBe(0);
  });

  it('normalizes -0 to 0', () => {
    expect(Object.is(roundLeaf(-0), 0)).toBe(true);
  });
});

describe('canonicalize', () => {
  it('strips timestamp and computeTime', () => {
    const c = canonicalize(results({})) as Record<string, unknown>;
    expect('timestamp' in c).toBe(false);
    expect('computeTime' in c).toBe(false);
    expect(Object.keys(c).sort()).toEqual(['error', 'productionGraph', 'report']);
  });

  it('serializes a null error to null', () => {
    const c = canonicalize(results({ error: null })) as any;
    expect(c.error).toBeNull();
  });

  it('serializes an error to {name, message, helpText}', () => {
    const error = { name: 'Error', message: 'NO OUTPUTS SET', helpText: 'set a target' };
    const c = canonicalize(results({ error })) as any;
    expect(c.error).toEqual({ name: 'Error', message: 'NO OUTPUTS SET', helpText: 'set a target' });
  });

  it('defaults a missing helpText to null', () => {
    const error = { name: 'Error', message: 'BOOM' };
    const c = canonicalize(results({ error })) as any;
    expect(c.error).toEqual({ name: 'Error', message: 'BOOM', helpText: null });
  });

  it('rounds numeric leaves to 9 significant figures', () => {
    const report = { pointsProduced: 1.2345678912345, totalItemsRecap: [] };
    const c = canonicalize(results({ report })) as any;
    expect(c.report.pointsProduced).toBe(1.23456789);
  });

  it('collapses near-zero (1e-12) leaves to 0', () => {
    const report = { pointsProduced: 1e-12, totalItemsRecap: [] };
    const c = canonicalize(results({ report })) as any;
    expect(c.report.pointsProduced).toBe(0);
  });

  it('normalizes -0 to 0', () => {
    const report = { pointsProduced: -0, totalItemsRecap: [] };
    const c = canonicalize(results({ report })) as any;
    expect(Object.is(c.report.pointsProduced, 0)).toBe(true);
  });

  it('sorts object keys recursively', () => {
    const report = {
      zeta: 1,
      alpha: 2,
      nested: { yankee: 3, bravo: 4 },
      totalItemsRecap: [],
    };
    const c = canonicalize(results({ report })) as any;
    // 'nested' sorts before 'totalItemsRecap' before 'zeta' after 'alpha'...
    expect(Object.keys(c.report)).toEqual([...Object.keys(c.report)].sort());
    expect(Object.keys(c.report.nested)).toEqual(['bravo', 'yankee']);
  });

  it('sorts productionGraph.edges by (from, to, key)', () => {
    const productionGraph = {
      nodes: {},
      edges: [
        { key: 'k2', from: 'b', to: 'a', productionRate: 1 },
        { key: 'k1', from: 'a', to: 'c', productionRate: 2 },
        { key: 'k0', from: 'a', to: 'c', productionRate: 3 },
        { key: 'k9', from: 'a', to: 'b', productionRate: 4 },
      ],
    };
    const c = canonicalize(results({ productionGraph })) as any;
    expect(c.productionGraph.edges.map((e: any) => [e.from, e.to, e.key])).toEqual([
      ['a', 'b', 'k9'],
      ['a', 'c', 'k0'],
      ['a', 'c', 'k1'],
      ['b', 'a', 'k2'],
    ]);
  });

  it('sorts report.totalItemsRecap by key', () => {
    const report = {
      totalItemsRecap: [
        { key: 'zed', name: 'Z', amount: 1, step: 0 },
        { key: 'abe', name: 'A', amount: 2, step: 1 },
        { key: 'mid', name: 'M', amount: 3, step: 2 },
      ],
    };
    const c = canonicalize(results({ report })) as any;
    expect(c.report.totalItemsRecap.map((r: any) => r.key)).toEqual(['abe', 'mid', 'zed']);
  });

  it('is idempotent through a JSON roundtrip', () => {
    const productionGraph = {
      nodes: { n1: { id: 'n1', key: 'Recipe_A', type: 'RECIPE', multiplier: 2.500000001 } },
      edges: [
        { key: 'k2', from: 'b', to: 'a', productionRate: 1e-12 },
        { key: 'k1', from: 'a', to: 'c', productionRate: 12.3456789123 },
      ],
    };
    const report = {
      pointsProduced: -0,
      powerUsageEstimate: { production: 1.1, extraction: 2.2, generators: 3.3, total: 6.6 },
      totalItemsRecap: [
        { key: 'zed', name: 'Z', amount: 1.000000001, step: 0 },
        { key: 'abe', name: 'A', amount: 2, step: 1 },
      ],
      loopWarning: false,
    };
    const error = { name: 'Error', message: 'BOOM' };
    const c = canonicalize(results({ productionGraph, report, error }));
    const roundtripped = JSON.parse(JSON.stringify(c));
    expect(c).toEqual(roundtripped);
  });
});
