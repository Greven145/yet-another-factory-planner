import { useState, useEffect, useCallback, useRef } from 'react';
import debounce from 'lodash/debounce';
import { GraphError } from '../../utilities/error/GraphError';
import { FactoryOptions } from './types';
import { GameData } from '../gameData/types';
import { useGlobalContext } from '../global';
import { SolverResults } from '../../utilities/production-solver/models';
import type { WorkerOutput } from '../../utilities/production-solver/solver.worker';


const _setCalculating = debounce((value: boolean, setCalculating: React.Dispatch<React.SetStateAction<boolean>>) => {
  setCalculating(value);
}, 300, { leading: false, trailing: true });


// Factory for the solver Worker. Injectable so tests can supply a fake worker
// without spinning up the real GLPK module worker.
export type WorkerFactory = () => Worker;

const defaultWorkerFactory: WorkerFactory = () => new Worker(
  new URL('../../utilities/production-solver/solver.worker.ts', import.meta.url),
  { type: 'module' },
);


export type UseSolverRunResult = {
  solverResults: SolverResults | null,
  calculating: boolean,
  calculate: () => void,
};


// Owns the solver-orchestration concern: Web-Worker lifecycle, debounced auto-calc,
// stale-solveId tracking, and the calculating flag. Returns the latest results plus
// a calculate() trigger for the provider to wire into its context value / effects.
export function useSolverRun(
  state: FactoryOptions,
  gameData: GameData,
  workerFactory: WorkerFactory = defaultWorkerFactory,
): UseSolverRunResult {
  const [solverResults, setSolverResults] = useState<SolverResults | null>(null);
  const [calculating, setCalculating] = useState(false);

  const ctx = useGlobalContext();

  // Debounced post ref: 300ms leading+trailing, matching the previous module-level debounce.
  const debouncedSolveRef = useRef<ReturnType<typeof debounce> | null>(null);
  // Monotonically-increasing ID for each solve request. Used to discard stale results from the worker,
  // since worker and main-thread performance.now() have different origins and can't be compared.
  const solveIdRef = useRef(0);

  useEffect(() => {
    const worker = workerFactory();

    worker.onmessage = (event: MessageEvent<WorkerOutput>) => {
      const data = event.data;
      if (data.solveId < solveIdRef.current) {
        return;
      }
      if (data.ok) {
        setSolverResults(data.results);
      } else {
        setSolverResults({
          productionGraph: null,
          report: null,
          timestamp: performance.now(),
          computeTime: 0,
          error: new GraphError(data.message, data.helpText),
        });
      }
      _setCalculating(false, setCalculating);
    };

    worker.onerror = (e) => {
      setSolverResults({
        productionGraph: null,
        report: null,
        timestamp: performance.now(),
        computeTime: 0,
        error: new GraphError(e.message ?? 'Worker error'),
      });
      _setCalculating(false, setCalculating);
    };

    const debouncedSolve = debounce((state: FactoryOptions, gameData: GameData) => {
      const solveId = ++solveIdRef.current;
      _setCalculating(true, setCalculating);
      worker.postMessage({ state, gameData, solveId });
    }, 300, { leading: true, trailing: true });

    debouncedSolveRef.current = debouncedSolve;

    return () => {
      debouncedSolve.cancel();
      worker.terminate();
      debouncedSolveRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const calculate = useCallback(() => {
    ctx.refreshTip();
    debouncedSolveRef.current?.(state, gameData);
  }, [ctx, gameData, state]);

  return { solverResults, calculating, calculate };
}
