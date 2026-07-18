import { nanoid } from 'nanoid';
import { ProductionItemOptions, InputItemOptions, WeightingOptions, GameModeOptions, AmplificationOptions, RecipeSelectionMap, BuildingSelectionMap, FactoryOptions, TransportOptions } from './types';
import { GameData, RecipeMap, ResourceMap } from '../gameData/types';
import { DEFAULT_MAXIMIZE_BALANCE_MODE } from './consts';

// The FactoryOptions default/initial-state builders. These live in their own module
// (not the reducer) so the shared-factory hydrate utility can build a fresh state
// without importing the reducer — which would form a cycle (reducer imports hydrate).

export function getDefaultProductionItem(): ProductionItemOptions {
  return ({
    key: nanoid(),
    itemKey: '',
    mode: 'per-minute',
    value: '10',
  });
}

export function getDefaultInputItem(): InputItemOptions {
  return ({
    key: nanoid(),
    itemKey: '',
    value: '10',
    weight: '0',
    unlimited: false,
  });
}

const ORDERED_RESOURCES = [
  'Desc_OreIron_C',
  'Desc_OreCopper_C',
  'Desc_Stone_C',
  'Desc_Coal_C',
  'Desc_OreGold_C',
  'Desc_RawQuartz_C',
  'Desc_Sulfur_C',
  'Desc_LiquidOil_C',
  'Desc_OreBauxite_C',
  'Desc_OreUranium_C',
  'Desc_NitrogenGas_C',
  'Desc_Water_C',
];

export function getInitialInputResources(resources: ResourceMap): InputItemOptions[] {
  return Object.entries(resources)
    .map(([key, data]) => {
      let value = '0';
      let unlimited = false;
      if (key === 'Desc_Water_C') {
        unlimited = true;
      } else {
        value = String(data.maxExtraction);
      }
      return {
        key: key,
        itemKey: key,
        value,
        weight: String(data.relativeValue),
        unlimited,
      };
    })
    .sort((a, b) => {
      let aIndex = ORDERED_RESOURCES.findIndex((r) => r === a.itemKey);
      if (aIndex === -1) aIndex = Infinity;
      let bIndex = ORDERED_RESOURCES.findIndex((r) => r === b.itemKey);
      if (bIndex === -1) bIndex = Infinity;
      return aIndex < bIndex ? -1 : 1;
    });
}

export function getInitialWeightingOptions(): WeightingOptions {
  return {
    resources: '1000',
    power: '1',
    complexity: '0',
    buildings: '0',
  };
}

export function getInitialGameModeOptions(): GameModeOptions {
  return {
    recipePartsCost: '1',
    powerConsumption: '1',
  };
}

// Somersloop/power-shard budgets default to 0 -> the solver offers no boost variants
// and behaves exactly as before until the user makes some available.
export function getInitialAmplificationOptions(): AmplificationOptions {
  return {
    availableSloops: '0',
    availableShards: '0',
  };
}

export function getInitialTransportOptions(): TransportOptions {
  return {
    beltCapacity: null,
    pipeCapacity: null,
  };
}

export function getInitialAllowedRecipes(recipes: RecipeMap): RecipeSelectionMap {
  const recipeMap: RecipeSelectionMap = {};
  Object.entries(recipes).forEach(([key, data]) => {
    recipeMap[key] = !data.isAlternate;
  });
  return recipeMap;
}

// Keyed only by buildings that actually produce a recipe (derived from recipes,
// not gameData.buildings, so generators/extractors/foundations don't appear).
// Buildings have no "alternates" concept, so every machine starts enabled.
export function getInitialAllowedBuildings(recipes: RecipeMap): BuildingSelectionMap {
  const buildingMap: BuildingSelectionMap = {};
  Object.values(recipes).forEach((data) => {
    buildingMap[data.producedIn] = true;
  });
  return buildingMap;
}

export function getInitialState(gameData: GameData): FactoryOptions {
  return {
    key: nanoid(),
    productionItems: [],
    inputItems: [],
    inputResources: getInitialInputResources(gameData.resources),
    allowHandGatheredItems: false,
    weightingOptions: getInitialWeightingOptions(),
    gameModeOptions: getInitialGameModeOptions(),
    amplificationOptions: getInitialAmplificationOptions(),
    allowedRecipes: getInitialAllowedRecipes(gameData.recipes),
    allowedBuildings: getInitialAllowedBuildings(gameData.recipes),
    nodesPositions: [],
    maximizeBalanceMode: DEFAULT_MAXIMIZE_BALANCE_MODE,
    transportOptions: getInitialTransportOptions(),
  };
}
