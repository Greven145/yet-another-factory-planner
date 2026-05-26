import { GraphError } from '../error/GraphError';

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
}

export type GraphNode = {
  id: string,
  key: string,
  type: string,
  multiplier: number,
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
