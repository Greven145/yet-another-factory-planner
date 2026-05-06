/// <reference lib="webworker" />

import { ProductionSolver } from '.';
import type { FactoryOptions } from '../../contexts/production/types';
import type { GameData } from '../../contexts/gameData/types';
import type { SolverResults } from './models';

export type WorkerInput = {
  state: FactoryOptions;
  gameData: GameData;
};

export type WorkerOutput =
  | { ok: true; results: SolverResults }
  | { ok: false; message: string; helpText?: string };

addEventListener('message', async (event: MessageEvent<WorkerInput>) => {
  const { state, gameData } = event.data;
  try {
    const solver = new ProductionSolver(state, gameData);
    // solver.exec runs the GLPK MILP computation off the main thread
    const results = await solver['exec']();
    postMessage({ ok: true, results } satisfies WorkerOutput);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    const helpText = (e as { helpText?: string })?.helpText;
    postMessage({ ok: false, message, helpText } satisfies WorkerOutput);
  }
});
