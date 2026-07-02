import { describe, expect, it } from 'vitest';
import { EXPERIMENTAL_FLAGS, defaultFlagState, mergeFlagState } from './consts';

describe('defaultFlagState', () => {
  it('returns all-false for every manifest key', () => {
    const state = defaultFlagState();
    expect(Object.keys(state).sort()).toEqual(EXPERIMENTAL_FLAGS.map((f) => f.key).sort());
    for (const f of EXPERIMENTAL_FLAGS) {
      expect(state[f.key]).toBe(false);
    }
  });
});

describe('mergeFlagState', () => {
  it('overlays known booleans', () => {
    const state = mergeFlagState({ 'balancer-view': true });
    expect(state['balancer-view']).toBe(true);
  });

  it('drops unknown keys and defaults known ones to false', () => {
    const state = mergeFlagState({ nope: true });
    expect(state['balancer-view']).toBe(false);
    expect((state as Record<string, unknown>).nope).toBeUndefined();
  });

  it('ignores non-boolean values for known keys', () => {
    const state = mergeFlagState({ 'balancer-view': 'yes' });
    expect(state['balancer-view']).toBe(false);
  });

  it('tolerates null / undefined / arrays / strings without throwing', () => {
    expect(mergeFlagState(null)['balancer-view']).toBe(false);
    expect(mergeFlagState(undefined)['balancer-view']).toBe(false);
    expect(mergeFlagState([])['balancer-view']).toBe(false);
    expect(mergeFlagState('nope')['balancer-view']).toBe(false);
  });
});
