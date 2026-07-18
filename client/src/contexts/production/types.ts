import { MaximizeBalanceMode } from './consts';

export type ProductionItemOptions = {
  key: string,
  itemKey: string,
  mode: 'per-minute' | 'maximize' | string,
  value: string,
};

export type WeightingOptions = {
  resources: string,
  power: string,
  complexity: string,
  buildings: string,
};

export type GameModeOptions = {
  recipePartsCost: string,
  powerConsumption: string,
};

export type AmplificationOptions = {
  availableSloops: string,
  availableShards: string,
};

export type InputItemOptions = {
  key: string,
  itemKey: string,
  value: string,
  weight: string,
  unlimited: boolean,
};

export type RecipeSelectionMap = {
  [key: string]: boolean,
};

export type BuildingSelectionMap = {
  [key: string]: boolean,
};

export type NodeInfo = {
  key: string,
  x: number,
  y: number
}

export type TransportOptions = {
  beltCapacity: string | null,
  pipeCapacity: string | null,
};

export type FactoryOptions = {
  key: string,
  productionItems: ProductionItemOptions[],
  inputItems: InputItemOptions[],
  inputResources: InputItemOptions[],
  allowHandGatheredItems: boolean,
  weightingOptions: WeightingOptions,
  gameModeOptions: GameModeOptions,
  amplificationOptions: AmplificationOptions,
  allowedRecipes: RecipeSelectionMap,
  allowedBuildings: BuildingSelectionMap,
  nodesPositions: NodeInfo[],
  maximizeBalanceMode: MaximizeBalanceMode,
  transportOptions: TransportOptions,
};

export type NodeInformation = {
  x: number,
  y: number,
  key: string,
}

export type FactoryGraphChanges = {
  nodes: NodeInformation[],
}
