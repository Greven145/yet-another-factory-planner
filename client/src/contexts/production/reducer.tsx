import { nanoid } from 'nanoid';
import { decodeState_v1_U5 } from './legacy-state-decoders/v1_U5';
import { decodeState_v2_U5 } from './legacy-state-decoders/v2_U5';
import { decodeState_v3_U5 } from './legacy-state-decoders/v3_U5';
import { ProductionItemOptions, InputItemOptions, WeightingOptions, GameModeOptions, RecipeSelectionMap, BuildingSelectionMap, FactoryOptions, NodeInfo, TransportOptions } from './types';
import { GameData, RecipeMap, ResourceMap } from '../gameData/types';
import { MAX_PRIORITY, MaximizeBalanceMode, DEFAULT_MAXIMIZE_BALANCE_MODE } from './consts';
import { decode, WireFactory } from '../../utilities/shared-factory/codec';

// DEFAULTS
function getDefaultProductionItem(): ProductionItemOptions {
  return ({
    key: nanoid(),
    itemKey: '',
    mode: 'per-minute',
    value: '10',
  });
}

function getDefaultInputItem(): InputItemOptions {
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

function getInitialInputResources(resources: ResourceMap): InputItemOptions[] {
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

function getInitialWeightingOptions(): WeightingOptions {
  return {
    resources: '1000',
    power: '1',
    complexity: '0',
    buildings: '0',
  };
}

function getInitialGameModeOptions(): GameModeOptions {
  return {
    recipePartsCost: '1',
    powerConsumption: '1',
  };
}

function getInitialTransportOptions(): TransportOptions {
  return {
    beltCapacity: null,
    pipeCapacity: null,
  };
}

function getInitialAllowedRecipes(recipes: RecipeMap): RecipeSelectionMap {
  const recipeMap: RecipeSelectionMap = {};
  Object.entries(recipes).forEach(([key, data]) => {
    recipeMap[key] = !data.isAlternate;
  });
  return recipeMap;
}

// Keyed only by buildings that actually produce a recipe (derived from recipes,
// not gameData.buildings, so generators/extractors/foundations don't appear).
// Buildings have no "alternates" concept, so every machine starts enabled.
function getInitialAllowedBuildings(recipes: RecipeMap): BuildingSelectionMap {
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
    allowedRecipes: getInitialAllowedRecipes(gameData.recipes),
    allowedBuildings: getInitialAllowedBuildings(gameData.recipes),
    nodesPositions: [],
    maximizeBalanceMode: DEFAULT_MAXIMIZE_BALANCE_MODE,
    transportOptions: getInitialTransportOptions(),
  };
}


// REDUCER
export type FactoryAction =
  | { type: 'RESET_FACTORY', gameData: GameData }
  | { type: 'ADD_PRODUCTION_ITEM' }
  | { type: 'DELETE_PRODUCTION_ITEM', key: string }
  | { type: 'SET_PRODUCTION_ITEM', data: { key: string, itemKey: string } }
  | { type: 'SET_PRODUCTION_ITEM_AMOUNT', data: { key: string, amount: string } }
  | { type: 'SET_PRODUCTION_ITEM_MODE', data: { key: string, mode: string } }
  | { type: 'ADD_INPUT_ITEM' }
  | { type: 'DELETE_INPUT_ITEM', key: string }
  | { type: 'UPDATE_INPUT_ITEM', data: InputItemOptions }
  | { type: 'UPDATE_INPUT_RESOURCE', data: InputItemOptions }
  | { type: 'SET_RESOURCES_TO_MAP_LIMITS', gameData: GameData }
  | { type: 'SET_RESOURCES_TO_0' }
  | { type: 'SET_ALLOW_HAND_GATHERED_ITEMS', active: boolean }
  | { type: 'UPDATE_WEIGHTING_OPTIONS', data: WeightingOptions }
  | { type: 'UPDATE_GAME_MODE_OPTIONS', data: GameModeOptions }
  | { type: 'SET_ALL_WEIGHTS_DEFAULT', gameData: GameData }
  | { type: 'SET_RECIPE_ACTIVE', key: string, active: boolean }
  | { type: 'MASS_SET_RECIPES_ACTIVE', recipes: string[], active: boolean }
  | { type: 'SET_BUILDING_ACTIVE', key: string, active: boolean }
  | { type: 'MASS_SET_BUILDINGS_ACTIVE', buildings: string[], active: boolean }
  | { type: 'LOAD_FROM_SHARED_FACTORY', config: any, gameData: GameData }
  | { type: 'LOAD_FROM_LEGACY_ENCODING', encoding: string, gameData: GameData }
  | { type: 'LOAD_FROM_LIBRARY', config: FactoryOptions, gameData: GameData }
  | { type: 'UPDATE_NODES_POSTIONS', nodesPositions: NodeInfo[] }
  | { type: 'SET_MAXIMIZE_BALANCE_MODE', mode: MaximizeBalanceMode }
  | { type: 'UPDATE_TRANSPORT_OPTIONS', data: TransportOptions };

export function reducer(state: FactoryOptions, action: FactoryAction): FactoryOptions {
  switch (action.type) {
    case 'RESET_FACTORY': {
      return getInitialState(action.gameData);
    }
    case 'ADD_PRODUCTION_ITEM': {
      const newProductionItems = [
        ...state.productionItems,
        getDefaultProductionItem(),
      ];
      return { ...state, productionItems: newProductionItems };
    }
    case 'DELETE_PRODUCTION_ITEM': {
      const newProductionItems = state.productionItems
        .filter((i) => i.key !== action.key);
      return { ...state, productionItems: newProductionItems };
    }
    case 'SET_PRODUCTION_ITEM': {
      const newProductionItems = state.productionItems
        .map((item) => {
          if (item.key === action.data.key) {
            let newItem;
            if (item.mode === 'per-minute' || item.mode === 'maximize') {
              newItem = { ...item };
            } else {
              newItem = getDefaultProductionItem();
            }
            newItem.itemKey = action.data.itemKey;
            return newItem;
          }
          return item;
        });
      return { ...state, productionItems: newProductionItems };
    }
    case 'SET_PRODUCTION_ITEM_AMOUNT': {
      const newProductionItems = state.productionItems
        .map((item) => {
          if (item.key === action.data.key) {
            const newItem = { ...item };
            newItem.value = action.data.amount;
            return newItem;
          }
          return item;
        });
      return { ...state, productionItems: newProductionItems };
    }
    case 'SET_PRODUCTION_ITEM_MODE': {
      const newProductionItems = state.productionItems
        .map((item) => {
          if (item.key === action.data.key) {
            const newItem = { ...item };
            newItem.mode = action.data.mode;
            if (newItem.mode !== item.mode) {
              if (newItem.mode === 'per-minute') {
                newItem.value = '10';
              } else if (newItem.mode === 'maximize') {
                let nextPriority = MAX_PRIORITY;
                while (nextPriority && nextPriority > 0) {
                  const priorityTaken = !!state.productionItems.find((i) => i.mode === 'maximize' && i.value === String(nextPriority));
                  if (!priorityTaken) {
                    break;
                  }
                  nextPriority--;
                }
                if (nextPriority > 0) {
                  newItem.value = String(nextPriority);
                } else {
                  newItem.value = `${MAX_PRIORITY}`;
                }
              } else if (item.mode === 'per-minute' || item.mode === 'maximize') {
                newItem.value = '1';
              }
            }
            return newItem;
          }
          return item;
        });
      return { ...state, productionItems: newProductionItems };
    }
    case 'ADD_INPUT_ITEM': {
      const newInputItems = [
        ...state.inputItems,
        getDefaultInputItem(),
      ];
      return { ...state, inputItems: newInputItems };
    }
    case 'DELETE_INPUT_ITEM': {
      const newInputItems = state.inputItems
        .filter((i) => i.key !== action.key);
      return { ...state, inputItems: newInputItems };
    }
    case 'UPDATE_INPUT_ITEM': {
      const newInputItems = state.inputItems
        .map((i) => i.key === action.data.key ? action.data : i);
      return { ...state, inputItems: newInputItems };
    }
    case 'UPDATE_INPUT_RESOURCE': {
      const newInputResources = state.inputResources
        .map((i) => i.key === action.data.key ? action.data : i);
      return { ...state, inputResources: newInputResources };
    }
    case 'SET_RESOURCES_TO_MAP_LIMITS': {
      const newInputResources = getInitialInputResources(action.gameData.resources);
      return { ...state, inputResources: newInputResources };
    }
    case 'SET_RESOURCES_TO_0': {
      const newInputResources = state.inputResources
        .map((data) => ({ ...data, value: '0', unlimited: false }));
      return { ...state, inputResources: newInputResources };
    }
    case 'SET_ALLOW_HAND_GATHERED_ITEMS': {
      return { ...state, allowHandGatheredItems: action.active };
    }
    case 'UPDATE_WEIGHTING_OPTIONS': {
      const newWeightingOptions = { ...action.data };
      return { ...state, weightingOptions: newWeightingOptions };
    }
    case 'UPDATE_GAME_MODE_OPTIONS': {
      const newGameModeOptions = { ...action.data };
      return { ...state, gameModeOptions: newGameModeOptions };
    }
    case 'SET_ALL_WEIGHTS_DEFAULT': {
      const newWeightingOptions = getInitialWeightingOptions();
      const newInputResources = state.inputResources
        .map((i) => ({ ...i, weight: String(action.gameData.resources[i.itemKey].relativeValue) }));
      return { ...state, weightingOptions: newWeightingOptions, inputResources: newInputResources };
    }
    case 'SET_RECIPE_ACTIVE': {
      const newAllowedRecipes = { ...state.allowedRecipes };
      newAllowedRecipes[action.key] = action.active;
      return { ...state, allowedRecipes: newAllowedRecipes };
    }
    case 'MASS_SET_RECIPES_ACTIVE': {
      const newAllowedRecipes = { ...state.allowedRecipes };
      action.recipes.forEach((recipeKey) => {
        newAllowedRecipes[recipeKey] = action.active;
      });
      return { ...state, allowedRecipes: newAllowedRecipes };
    }
    case 'SET_BUILDING_ACTIVE': {
      const newAllowedBuildings = { ...state.allowedBuildings };
      newAllowedBuildings[action.key] = action.active;
      return { ...state, allowedBuildings: newAllowedBuildings };
    }
    case 'MASS_SET_BUILDINGS_ACTIVE': {
      const newAllowedBuildings = { ...state.allowedBuildings };
      action.buildings.forEach((buildingKey) => {
        newAllowedBuildings[buildingKey] = action.active;
      });
      return { ...state, allowedBuildings: newAllowedBuildings };
    }
    case 'LOAD_FROM_SHARED_FACTORY': {
      try {
        const decoded = decode(action.config as WireFactory);
        const newState: FactoryOptions = getInitialState(action.gameData);
        newState.productionItems = decoded.productionItems.map((i) => ({
          ...getDefaultProductionItem(),
          itemKey: i.itemKey,
          mode: i.mode,
          value: i.value,
        }));
        newState.inputItems = decoded.inputItems.map((i) => ({
          ...getDefaultInputItem(),
          itemKey: i.itemKey,
          value: i.value,
          weight: i.weight,
          unlimited: i.unlimited,
        }));
        newState.inputResources.forEach((r) => {
          const resourceOptions = decoded.inputResources.find((i) => r.itemKey === i.itemKey);
          if (resourceOptions) {
            r.value = resourceOptions.value;
            r.weight = resourceOptions.weight;
            r.unlimited = resourceOptions.unlimited;
          }
        });
        newState.allowHandGatheredItems = decoded.allowHandGatheredItems;
        newState.weightingOptions = decoded.weightingOptions;
        // gameModeOptions added in 1.2; keep the 1x default for pre-1.2 shared factories that lack it.
        if (decoded.gameModeOptions) {
          newState.gameModeOptions = decoded.gameModeOptions;
        }
        decoded.allowedRecipes.forEach((key) => {
          if (newState.allowedRecipes[key] != null) {
            newState.allowedRecipes[key] = true;
          }
        });
        // allowedBuildings stores the ENABLED set and defaults to all-on, so a
        // present list is a full overwrite: each known building is on iff it's in
        // the decoded set. Absent (pre-feature shares) => keep the all-on default.
        if (decoded.allowedBuildings) {
          const enabled = new Set(decoded.allowedBuildings);
          Object.keys(newState.allowedBuildings).forEach((key) => {
            newState.allowedBuildings[key] = enabled.has(key);
          });
        }
        newState.nodesPositions = decoded.nodesPositions;
        // maximizeBalanceMode/transportOptions aren't part of the share wire shape;
        // read them defensively from the raw payload for any client-side persisted config.
        newState.maximizeBalanceMode = (action.config as any).maximizeBalanceMode ?? DEFAULT_MAXIMIZE_BALANCE_MODE;
        newState.transportOptions = (action.config as any).transportOptions ?? getInitialTransportOptions();
        return newState;
      } catch (e) {
        console.error(e);
        return getInitialState(action.gameData);
      }
    }
    case 'LOAD_FROM_LEGACY_ENCODING': {
      try {
        return decodeState_LEGACY(action.encoding, action.gameData);
      } catch (e) {
        console.error(e);
        return getInitialState(action.gameData);
      }
    }
    case 'LOAD_FROM_LIBRARY': {
      try {
        // TODO: some validation
        return {
          ...action.config,
          maximizeBalanceMode: action.config.maximizeBalanceMode ?? DEFAULT_MAXIMIZE_BALANCE_MODE,
          transportOptions: action.config.transportOptions ?? getInitialTransportOptions(),
          gameModeOptions: action.config.gameModeOptions ?? getInitialGameModeOptions(),
          allowedBuildings: action.config.allowedBuildings ?? getInitialAllowedBuildings(action.gameData.recipes),
        };
      } catch (e) {
        console.error(e);
        return getInitialState(action.gameData);
      }
    }
    case 'UPDATE_NODES_POSTIONS': {
      const updatedNodesPositions = [ ...action.nodesPositions ];
      return { ...state, nodesPositions: updatedNodesPositions };
    }
    case 'SET_MAXIMIZE_BALANCE_MODE': {
      return { ...state, maximizeBalanceMode: action.mode };
    }
    case 'UPDATE_TRANSPORT_OPTIONS': {
      return { ...state, transportOptions: { ...action.data } };
    }
    default:
      return state;
  }
}


// ENCODE/DECODE STATE
function decodeState_LEGACY(stateStr: string, gameData: GameData): FactoryOptions {
  const version = stateStr.substring(0, 5);
  if (version === 'v1_U5') {
    return decodeState_v1_U5(stateStr, gameData);
  } else if (version === 'v2_U5') {
    return decodeState_v2_U5(stateStr, gameData);
  } else if (version === 'v3_U5') {
    return decodeState_v3_U5(stateStr, gameData);
  } else {
    throw new Error('INVALID VERSION');
  }
}
