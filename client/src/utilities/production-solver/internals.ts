import { GameData } from '../../contexts/gameData/types';

// Shared constants used by the solver and the extracted graph/report modules.
export const EPSILON = 1e-8;
// Relative tolerance for treating a near-balanced intermediate's leftover as solver noise rather
// than a real side product. The LP solution balances production against consumption only to ~1e-6
// relative precision, so a residual below this fraction of an item's total production is discarded.
export const RESIDUAL_BALANCE_TOLERANCE = 1e-4;
export const RATE_TARGET_KEY = 'RATE_TARGET_PASS';

// Shared types used across the solver pass, graph assembly, and report building.
export type Inputs = {
  [key: string]: {
    amount: number,
    weight: number,
    type: string,
  }
};

export type RateTargets = {
  [key: string]: {
    value: number,
    recipe: string | null,
    isPoints: boolean,
  }
};

export type MaximizeTargets = { key: string, priority: number };

export type ProductionSolution = { [key: string]: number };

export type ProductionAmount = { recipeKey: string, amount: number };

export type ItemProductionTotals = {
  [key: string]: {
    producedBy: ProductionAmount[],
    usedBy: ProductionAmount[],
  }
};

// Sink points for an item, with Ficsmas (event) items contributing zero.
export function getItemPoints(gameData: GameData, itemKey: string): number {
  const itemInfo = gameData.items[itemKey];
  return itemInfo.isFicsmas ? 0 : itemInfo.sinkPoints;
}

// Solver-derived context needed to assemble the production graph from a solution.
// These are not pure functions of gameData alone, so they are passed alongside it.
export type GraphContext = {
  gameData: GameData,
  inputs: Inputs,
  rateTargets: RateTargets,
  maximizeTargets: MaximizeTargets[],
  hasPointsTarget: boolean,
};

// Solver-derived context needed to build the report from a graph.
export type ReportContext = {
  gameData: GameData,
  inputs: Inputs,
  // Somersloop / power-shard budgets the user made available (0 when unused).
  availableSloops: number,
  availableShards: number,
};
