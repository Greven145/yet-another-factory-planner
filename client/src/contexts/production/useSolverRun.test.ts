import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useSolverRun } from './useSolverRun';
import { FactoryOptions } from './types';
import { GameData } from '../gameData/types';
import type { WorkerOutput } from '../../utilities/production-solver/solver.worker';

// Stub the global context so the hook's calculate() can call refreshTip()
// without mounting the real GlobalProvider.
const refreshTip = vi.fn();
vi.mock('../global', () => ({
  useGlobalContext: () => ({ ficsitTip: '', engineerId: '', refreshTip }),
}));

// Minimal fixtures — the fake worker never reads these, so empty shells are fine.
const state = {} as FactoryOptions;
const gameData = {} as GameData;

// A fake worker that captures posted messages and lets the test drive onmessage/onerror.
class FakeWorker {
  onmessage: ((event: MessageEvent<WorkerOutput>) => void) | null = null;
  onerror: ((event: { message?: string }) => void) | null = null;
  posted: Array<{ state: FactoryOptions; gameData: GameData; solveId: number }> = [];
  terminated = false;

  postMessage(msg: { state: FactoryOptions; gameData: GameData; solveId: number }) {
    this.posted.push(msg);
  }

  terminate() {
    this.terminated = true;
  }

  // Helpers for the test to simulate the worker replying.
  emitOk(solveId: number) {
    const results = {
      productionGraph: null,
      report: null,
      timestamp: 0,
      computeTime: 0,
      error: null,
    };
    const data = { ok: true, results, solveId } as unknown as WorkerOutput;
    this.onmessage?.({ data } as unknown as MessageEvent<WorkerOutput>);
  }
}

function makeFactory() {
  const worker = new FakeWorker();
  const factory = vi.fn(() => worker as unknown as Worker);
  return { worker, factory };
}

beforeEach(() => {
  vi.useFakeTimers();
  refreshTip.mockClear();
});

afterEach(() => {
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
});

describe('useSolverRun', () => {
  it('posts a solve message to the worker and toggles calculating', () => {
    const { worker, factory } = makeFactory();
    const { result } = renderHook(() => useSolverRun(state, gameData, factory));

    expect(result.current.calculating).toBe(false);

    // calculate() — debounce is leading, so it posts immediately.
    act(() => {
      result.current.calculate();
    });

    expect(refreshTip).toHaveBeenCalledTimes(1);
    expect(worker.posted).toHaveLength(1);
    expect(worker.posted[0].solveId).toBe(1);

    // _setCalculating(true) is debounced (300ms trailing) — flush it.
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(result.current.calculating).toBe(true);

    // Worker replies for solveId 1; calculating should debounce back to false.
    act(() => {
      worker.emitOk(1);
      vi.advanceTimersByTime(300);
    });
    expect(result.current.calculating).toBe(false);
    expect(result.current.solverResults).not.toBeNull();
  });

  it('discards a stale result when a fresher solveId has been issued', () => {
    const { worker, factory } = makeFactory();
    const { result } = renderHook(() => useSolverRun(state, gameData, factory));

    // First solve -> solveId 1.
    act(() => {
      result.current.calculate();
    });
    // Advance past the post-debounce window so the next calculate() posts again.
    act(() => {
      vi.advanceTimersByTime(300);
    });
    // Second solve -> solveId 2.
    act(() => {
      result.current.calculate();
    });
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(worker.posted.map((p) => p.solveId)).toEqual([1, 2]);

    // A stale reply for solveId 1 arrives AFTER 2 was issued — it must be ignored.
    const errorResult = {
      data: { ok: false, message: 'stale!', solveId: 1 },
    } as unknown as MessageEvent<WorkerOutput>;
    act(() => {
      worker.onmessage?.(errorResult);
    });
    expect(result.current.solverResults).toBeNull();

    // The fresh reply for solveId 2 is accepted.
    act(() => {
      worker.emitOk(2);
    });
    expect(result.current.solverResults).not.toBeNull();
  });

  it('terminates the worker and cancels the debounce on unmount', () => {
    const { worker, factory } = makeFactory();
    const { unmount } = renderHook(() => useSolverRun(state, gameData, factory));

    expect(worker.terminated).toBe(false);

    act(() => {
      unmount();
    });

    expect(worker.terminated).toBe(true);
  });
});
