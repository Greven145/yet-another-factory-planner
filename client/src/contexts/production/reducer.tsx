import { nanoid } from 'nanoid';
import { decodeState_v1_U5 } from './legacy-state-decoders/v1_U5';
import { decodeState_v2_U5 } from './legacy-state-decoders/v2_U5';
import { decodeState_v3_U5 } from './legacy-state-decoders/v3_U5';
import { InputItemOptions, WeightingOptions, GameModeOptions, FactoryOptions, NodeInfo, TransportOptions } from './types';
import { GameData } from '../gameData/types';
import { MAX_PRIORITY, MaximizeBalanceMode, DEFAULT_MAXIMIZE_BALANCE_MODE } from './consts';
import { WireFactory } from '../../utilities/shared-factory/codec';
import { hydrateSharedFactory } from '../../utilities/shared-factory/hydrate';
import {
  getInitialState,
  getDefaultProductionItem,
  getDefaultInputItem,
  getInitialInputResources,
  getInitialWeightingOptions,
  getInitialGameModeOptions,
  getInitialTransportOptions,
  getInitialAllowedBuildings,
} from './defaults';

// The initial-state builders live in ./defaults so the shared-factory hydrate utility
// can reuse them without importing the reducer. Re-exported here for the existing
// consumers (production context, legacy decoders, golden corpus) that import it.
export { getInitialState };


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
      // The wire -> FactoryOptions transform lives in hydrateSharedFactory so the
      // receive-side picker can reuse it; this stays a thin delegation. The helper
      // owns the try/catch fallback to a fresh initial state.
      return hydrateSharedFactory(action.config as WireFactory, action.gameData);
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
