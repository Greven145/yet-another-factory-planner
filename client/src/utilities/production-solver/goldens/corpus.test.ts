import { describe, it, expect } from 'vitest';
import { CORPUS } from './corpus';
import { GOLDEN_GAME_VERSIONS } from './gameData';

// Fast structural checks only — this test never solves a case.

const SEED_NAMES = new Set([
  'packagedoil-rate-fuel-maximize',
  'packagedoil-fuel-complexity-max',
  'packagedoil-fuel-both-rate',
  'eight-targets-iron-capped',
]);

describe('golden corpus', () => {
  it('has unique, non-empty, kebab-case names', () => {
    const names = CORPUS.map((c) => c.name);
    expect(new Set(names).size).toBe(names.length);
    for (const name of names) {
      expect(name).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  it('tags every case with a known game version', () => {
    for (const c of CORPUS) {
      expect(GOLDEN_GAME_VERSIONS).toContain(c.gameVersion);
    }
  });

  it('gives every case a non-empty factory key', () => {
    for (const c of CORPUS) {
      expect(c.input.key).toBeTruthy();
    }
  });

  it('stamps generated cases with deterministic keys (no nanoid ids)', () => {
    for (const c of CORPUS) {
      if (SEED_NAMES.has(c.name)) continue;
      expect(c.input.key).toBe(c.name);
      c.input.productionItems.forEach((p, i) => {
        expect(p.key).toBe(`${c.name}-prod-${i}`);
      });
      c.input.inputItems.forEach((item, i) => {
        expect(item.key).toBe(`${c.name}-input-${i}`);
      });
    }
  });

  it('gives seed cases a deterministic (committed) factory key', () => {
    for (const c of CORPUS) {
      if (!SEED_NAMES.has(c.name)) continue;
      expect(c.input.key).toBeTruthy();
      // Committed seed configs carry their own stable keys and are 1.2.
      expect(c.gameVersion).toBe('1.2');
    }
  });

  it('includes all four committed seed factories', () => {
    const names = new Set(CORPUS.map((c) => c.name));
    for (const seed of SEED_NAMES) {
      expect(names.has(seed)).toBe(true);
    }
  });

  it('marks only intended error cases with expectError', () => {
    const errorCases = CORPUS.filter((c) => c.expectError).map((c) => c.name).sort();
    expect(errorCases).toEqual([
      'error-infeasible-resource-starved',
      'error-no-outputs',
      'error-target-disabled-recipe',
      'error-transport-belt-too-low',
    ]);
  });
});
