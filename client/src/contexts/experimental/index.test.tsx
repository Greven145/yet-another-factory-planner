import { beforeEach, describe, expect, it } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { ExperimentalProvider, useExperimentalContext, useExperimentalFlag } from './index';
import { EXPERIMENTAL_FLAGS_STORAGE_KEY } from './consts';

// Drive the provider through its public hooks. Read both the context (for
// setEnabled) and the derived flag value from one render.
function setup() {
  return renderHook(
    () => ({
      ctx: useExperimentalContext(),
      balancer: useExperimentalFlag('balancer-view'),
    }),
    { wrapper: ExperimentalProvider },
  );
}

beforeEach(() => {
  window.localStorage.clear();
});

describe('ExperimentalProvider', () => {
  it('reads a flag as false by default', () => {
    const { result } = setup();
    expect(result.current.balancer).toBe(false);
  });

  it('reflects setEnabled(true) in the flag value', () => {
    const { result } = setup();
    act(() => { result.current.ctx.setEnabled('balancer-view', true); });
    expect(result.current.balancer).toBe(true);
  });

  it('persists an enabled flag across a remount', () => {
    const first = setup();
    act(() => { first.result.current.ctx.setEnabled('balancer-view', true); });
    expect(first.result.current.balancer).toBe(true);

    // The value is written to the shared localStorage key...
    expect(window.localStorage.getItem(EXPERIMENTAL_FLAGS_STORAGE_KEY)).toBeTruthy();

    first.unmount();

    // ...and a fresh provider reads it back on mount.
    const second = setup();
    expect(second.result.current.balancer).toBe(true);
  });
});
