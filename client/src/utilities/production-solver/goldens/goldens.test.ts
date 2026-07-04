/// <reference types="node" />
// ^ tsconfig restricts `types` to vitest/globals, so pull in Node builtins
//   (fs/url/path/process) explicitly for this test-only file.
import { describe, test, expect } from 'vitest';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { ProductionSolver } from '../index';
import { GraphError } from '../../error/GraphError';
import type { SolverResults } from '../models';
import { canonicalize } from './canonicalize';
import { CORPUS, GoldenCase } from './corpus';
import { loadGoldenGameData } from './gameData';
// Side-effect import: registers the `toBeCloseToDeep` matcher on `expect`.
import './toBeCloseToDeep';

const HERE = dirname(fileURLToPath(import.meta.url));
const BASELINE_DIR = join(HERE, 'baselines');
const UPDATE = !!process.env.UPDATE_FIXTURES;

// The solver constructor throws GraphError for some invalid inputs while exec()
// catches others into `error`. Normalize both into a single SolverResults shape.
async function runCase(c: GoldenCase): Promise<SolverResults> {
  try {
    const solver = new ProductionSolver(c.input, loadGoldenGameData(c.gameVersion));
    return await solver.exec();
  } catch (e) {
    return { productionGraph: null, report: null, timestamp: 0, computeTime: 0, error: e as GraphError };
  }
}

type Fixture = { name: string; gameVersion: string; input: unknown; output: unknown };

describe('LP solver golden regression corpus', () => {
  for (const c of CORPUS) {
    test(c.name, { timeout: 30_000 }, async () => {
      const results = await runCase(c);

      // Guard against mode drift when a case DECLARES its intent. Combinatorially
      // generated cases leave `expectError` undefined — their error/success state is
      // whatever the solver produced at capture time and is already frozen inside the
      // canonicalized output (error object vs null graph), so the output diff below
      // catches any error<->success flip without a hardcoded expectation.
      if (c.expectError === true) {
        expect(results.error, `${c.name} was expected to error but did not`).not.toBeNull();
        expect(results.productionGraph).toBeNull();
      } else if (c.expectError === false) {
        expect(results.error, `${c.name} errored unexpectedly: ${results.error?.message}`).toBeNull();
        expect(results.productionGraph).not.toBeNull();
      }

      const output = canonicalize(results);
      const path = join(BASELINE_DIR, `${c.name}.json`);

      if (UPDATE) {
        mkdirSync(BASELINE_DIR, { recursive: true });
        const fixture: Fixture = { name: c.name, gameVersion: c.gameVersion, input: c.input, output };
        writeFileSync(path, JSON.stringify(fixture, null, 2) + '\n');
        return;
      }

      if (!existsSync(path)) {
        throw new Error(
          `Missing golden baseline for "${c.name}" (${path}). ` +
            'Capture baselines with: UPDATE_FIXTURES=1 ./node_modules/.bin/vitest run ' +
            'src/utilities/production-solver/goldens/goldens.test.ts',
        );
      }

      const fixture = JSON.parse(readFileSync(path, 'utf-8')) as Fixture;
      expect(output).toBeCloseToDeep(fixture.output);
    });
  }
});
