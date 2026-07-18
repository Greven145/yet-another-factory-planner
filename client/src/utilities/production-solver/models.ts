import { GraphError } from '../error/GraphError';
import { VariantSuffix } from './amplification';

export const NODE_TYPE = {
  FINAL_PRODUCT: 'FINAL_PRODUCT',
  SIDE_PRODUCT: 'SIDE_PRODUCT',
  INPUT_ITEM: 'INPUT_ITEM',
  HAND_GATHERED_RESOURCE: 'HAND_GATHERED_RESOURCE',
  RESOURCE: 'RESOURCE',
  RECIPE: 'RECIPE',
};

export const POINTS_ITEM_KEY = 'POINTS_ITEM_KEY';

export type ProducedItemInformation = {
  key: string,
  name: string,
  amount: number,
  step: number,
}

export type Report = {
  pointsProduced: number,
  powerUsageEstimate: {
    production: number,
    extraction: number,
    generators: number,
    total: number,
  },
  resourceEfficiencyScore: number,
  totalBuildArea: number,
  estimatedFoundations: number,
  buildingsUsed: {
    [key: string]: {
      count: number,
      materialCost: {
        [key: string]: number,
      }
    },
  },
  totalMaterialCost: {
    [key: string]: number,
  },
  totalRawResources: {
    [key: string]: number,
  },
  totalItemsRecap: ProducedItemInformation[],
  loopWarning: boolean,
  // Somersloop / power-shard consumption and budgets. usage is a continuous relaxation
  // (fractional buildings use fractional slots) so round up when building in-game.
  amplification: {
    sloopsUsed: number,
    sloopsAvailable: number,
    shardsUsed: number,
    shardsAvailable: number,
  },
}

export type GraphNode = {
  id: string,
  key: string,
  type: string,
  multiplier: number,
  // Boost variant for RECIPE nodes: '' base, 'AMP' amplified, 'OC' overclocked, 'AMPOC' both.
  suffix?: VariantSuffix,
};

export type GraphEdge = {
  key: string,
  from: string,
  to: string,
  productionRate: number,
};

export type ProductionGraph = {
  nodes: { [key: string]: GraphNode },
  edges: GraphEdge[],
};

export type SolverResults = {
  productionGraph: ProductionGraph | null,
  report: Report | null,
  timestamp: number,
  computeTime: number,
  error: GraphError | null,
};
