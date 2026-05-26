import { reducer, getInitialState, FactoryAction } from './reducer';
import { FactoryOptions, WeightingOptions } from './types';
import { GameData } from '../gameData/types';

// Minimal game data fixture for testing
const mockGameData: GameData = {
  buildings: {
    'Build_ConstructorMk1_C': {
      slug: 'constructor',
      name: 'Constructor',
      power: 4,
      area: 100,
      buildCost: [{ itemClass: 'Desc_IronPlate_C', quantity: 2 }],
      isFicsmas: false,
    },
    'Build_SmelterMk1_C': {
      slug: 'smelter',
      name: 'Smelter',
      power: 4,
      area: 54,
      buildCost: [{ itemClass: 'Desc_IronPlate_C', quantity: 5 }],
      isFicsmas: false,
    },
  },
  recipes: {
    'Recipe_IronIngot_C': {
      slug: 'iron_ingot',
      name: 'Iron Ingot',
      isAlternate: false,
      ingredients: [{ itemClass: 'Desc_OreIron_C', perMinute: 30 }],
      products: [{ itemClass: 'Desc_IronIngot_C', perMinute: 30 }],
      producedIn: 'Build_SmelterMk1_C',
      isFicsmas: false,
    },
    'Recipe_IronPlate_C': {
      slug: 'iron_plate',
      name: 'Iron Plate',
      isAlternate: false,
      ingredients: [{ itemClass: 'Desc_IronIngot_C', perMinute: 30 }],
      products: [{ itemClass: 'Desc_IronPlate_C', perMinute: 20 }],
      producedIn: 'Build_ConstructorMk1_C',
      isFicsmas: false,
    },
    'Recipe_AlternateIronPlate_C': {
      slug: 'alternate_iron_plate',
      name: 'Alternate Iron Plate',
      isAlternate: true,
      ingredients: [{ itemClass: 'Desc_IronIngot_C', perMinute: 20 }],
      products: [{ itemClass: 'Desc_IronPlate_C', perMinute: 25 }],
      producedIn: 'Build_ConstructorMk1_C',
      isFicsmas: false,
    },
  },
  resources: {
    'Desc_OreIron_C': {
      itemClass: 'Desc_OreIron_C',
      maxExtraction: 70380,
      relativeValue: 1,
    },
    'Desc_OreCopper_C': {
      itemClass: 'Desc_OreCopper_C',
      maxExtraction: 28860,
      relativeValue: 2,
    },
    'Desc_Water_C': {
      itemClass: 'Desc_Water_C',
      maxExtraction: null,
      relativeValue: 0,
    },
  },
  items: {
    'Desc_OreIron_C': {
      slug: 'iron_ore',
      name: 'Iron Ore',
      sinkPoints: 1,
      usedInRecipes: ['Recipe_IronIngot_C'],
      producedFromRecipes: [],
      isFicsmas: false,
    },
    'Desc_IronIngot_C': {
      slug: 'iron_ingot',
      name: 'Iron Ingot',
      sinkPoints: 2,
      usedInRecipes: ['Recipe_IronPlate_C', 'Recipe_AlternateIronPlate_C'],
      producedFromRecipes: ['Recipe_IronIngot_C'],
      isFicsmas: false,
    },
    'Desc_IronPlate_C': {
      slug: 'iron_plate',
      name: 'Iron Plate',
      sinkPoints: 6,
      usedInRecipes: [],
      producedFromRecipes: ['Recipe_IronPlate_C', 'Recipe_AlternateIronPlate_C'],
      isFicsmas: false,
    },
  },
  handGatheredItems: {},
};

function createInitialState(): FactoryOptions {
  return getInitialState(mockGameData);
}

function createStateWithProductionItem(overrides?: Partial<FactoryOptions>): FactoryOptions {
  const state = createInitialState();
  state.productionItems = [{
    key: 'test-item-1',
    itemKey: 'Desc_IronPlate_C',
    mode: 'per-minute',
    value: '10',
  }];
  return { ...state, ...overrides };
}

describe('getInitialState', () => {
  it('creates initial state with empty production items', () => {
    const state = createInitialState();
    expect(state.productionItems).toEqual([]);
  });

  it('creates initial state with empty input items', () => {
    const state = createInitialState();
    expect(state.inputItems).toEqual([]);
  });

  it('populates input resources from game data', () => {
    const state = createInitialState();
    expect(state.inputResources.length).toBe(3);
    const iron = state.inputResources.find(r => r.itemKey === 'Desc_OreIron_C');
    expect(iron).toBeDefined();
    expect(iron!.value).toBe('70380');
    expect(iron!.unlimited).toBe(false);
  });

  it('sets water as unlimited', () => {
    const state = createInitialState();
    const water = state.inputResources.find(r => r.itemKey === 'Desc_Water_C');
    expect(water).toBeDefined();
    expect(water!.unlimited).toBe(true);
  });

  it('sets default weighting options', () => {
    const state = createInitialState();
    expect(state.weightingOptions).toEqual({
      resources: '1000',
      power: '1',
      complexity: '0',
      buildings: '0',
    });
  });

  it('marks non-alternate recipes as allowed by default', () => {
    const state = createInitialState();
    expect(state.allowedRecipes['Recipe_IronIngot_C']).toBe(true);
    expect(state.allowedRecipes['Recipe_IronPlate_C']).toBe(true);
  });

  it('marks alternate recipes as disallowed by default', () => {
    const state = createInitialState();
    expect(state.allowedRecipes['Recipe_AlternateIronPlate_C']).toBe(false);
  });

  it('has a unique key', () => {
    const state1 = createInitialState();
    const state2 = createInitialState();
    expect(state1.key).not.toBe(state2.key);
  });
});

describe('reducer', () => {
  describe('RESET_FACTORY', () => {
    it('resets to initial state', () => {
      const state = createStateWithProductionItem();
      const result = reducer(state, { type: 'RESET_FACTORY', gameData: mockGameData });
      expect(result.productionItems).toEqual([]);
      expect(result.key).not.toBe(state.key);
    });
  });

  describe('ADD_PRODUCTION_ITEM', () => {
    it('adds a default production item', () => {
      const state = createInitialState();
      const result = reducer(state, { type: 'ADD_PRODUCTION_ITEM' });
      expect(result.productionItems).toHaveLength(1);
      expect(result.productionItems[0].itemKey).toBe('');
      expect(result.productionItems[0].mode).toBe('per-minute');
      expect(result.productionItems[0].value).toBe('10');
    });

    it('appends to existing production items', () => {
      const state = createStateWithProductionItem();
      const result = reducer(state, { type: 'ADD_PRODUCTION_ITEM' });
      expect(result.productionItems).toHaveLength(2);
    });

    it('does not mutate original state', () => {
      const state = createInitialState();
      const result = reducer(state, { type: 'ADD_PRODUCTION_ITEM' });
      expect(state.productionItems).toHaveLength(0);
      expect(result.productionItems).toHaveLength(1);
    });
  });

  describe('DELETE_PRODUCTION_ITEM', () => {
    it('removes item by key', () => {
      const state = createStateWithProductionItem();
      const result = reducer(state, { type: 'DELETE_PRODUCTION_ITEM', key: 'test-item-1' });
      expect(result.productionItems).toHaveLength(0);
    });

    it('does nothing if key not found', () => {
      const state = createStateWithProductionItem();
      const result = reducer(state, { type: 'DELETE_PRODUCTION_ITEM', key: 'nonexistent' });
      expect(result.productionItems).toHaveLength(1);
    });
  });

  describe('SET_PRODUCTION_ITEM', () => {
    it('updates the item key for a production item', () => {
      const state = createStateWithProductionItem();
      const result = reducer(state, {
        type: 'SET_PRODUCTION_ITEM',
        data: { key: 'test-item-1', itemKey: 'Desc_IronIngot_C' },
      });
      expect(result.productionItems[0].itemKey).toBe('Desc_IronIngot_C');
    });

    it('preserves mode when mode is per-minute', () => {
      const state = createStateWithProductionItem();
      state.productionItems[0].mode = 'per-minute';
      const result = reducer(state, {
        type: 'SET_PRODUCTION_ITEM',
        data: { key: 'test-item-1', itemKey: 'Desc_IronIngot_C' },
      });
      expect(result.productionItems[0].mode).toBe('per-minute');
    });

    it('resets to default when mode is a recipe key', () => {
      const state = createStateWithProductionItem();
      state.productionItems[0].mode = 'Recipe_IronPlate_C';
      const result = reducer(state, {
        type: 'SET_PRODUCTION_ITEM',
        data: { key: 'test-item-1', itemKey: 'Desc_IronIngot_C' },
      });
      expect(result.productionItems[0].mode).toBe('per-minute');
      expect(result.productionItems[0].value).toBe('10');
    });
  });

  describe('SET_PRODUCTION_ITEM_AMOUNT', () => {
    it('updates the amount', () => {
      const state = createStateWithProductionItem();
      const result = reducer(state, {
        type: 'SET_PRODUCTION_ITEM_AMOUNT',
        data: { key: 'test-item-1', amount: '50' },
      });
      expect(result.productionItems[0].value).toBe('50');
    });
  });

  describe('SET_PRODUCTION_ITEM_MODE', () => {
    it('sets mode to per-minute with default value of 10', () => {
      const state = createStateWithProductionItem();
      state.productionItems[0].mode = 'maximize';
      state.productionItems[0].value = '5';
      const result = reducer(state, {
        type: 'SET_PRODUCTION_ITEM_MODE',
        data: { key: 'test-item-1', mode: 'per-minute' },
      });
      expect(result.productionItems[0].mode).toBe('per-minute');
      expect(result.productionItems[0].value).toBe('10');
    });

    it('sets mode to maximize with auto-assigned priority', () => {
      const state = createStateWithProductionItem();
      const result = reducer(state, {
        type: 'SET_PRODUCTION_ITEM_MODE',
        data: { key: 'test-item-1', mode: 'maximize' },
      });
      expect(result.productionItems[0].mode).toBe('maximize');
      expect(Number(result.productionItems[0].value)).toBeGreaterThan(0);
    });

    it('sets mode to recipe key with value of 1', () => {
      const state = createStateWithProductionItem();
      const result = reducer(state, {
        type: 'SET_PRODUCTION_ITEM_MODE',
        data: { key: 'test-item-1', mode: 'Recipe_IronPlate_C' },
      });
      expect(result.productionItems[0].mode).toBe('Recipe_IronPlate_C');
      expect(result.productionItems[0].value).toBe('1');
    });

    it('does nothing when mode is unchanged', () => {
      const state = createStateWithProductionItem();
      const result = reducer(state, {
        type: 'SET_PRODUCTION_ITEM_MODE',
        data: { key: 'test-item-1', mode: 'per-minute' },
      });
      expect(result.productionItems[0].value).toBe('10');
    });
  });

  describe('ADD_INPUT_ITEM', () => {
    it('adds a default input item', () => {
      const state = createInitialState();
      const result = reducer(state, { type: 'ADD_INPUT_ITEM' });
      expect(result.inputItems).toHaveLength(1);
      expect(result.inputItems[0].itemKey).toBe('');
      expect(result.inputItems[0].value).toBe('10');
      expect(result.inputItems[0].unlimited).toBe(false);
    });
  });

  describe('DELETE_INPUT_ITEM', () => {
    it('removes input item by key', () => {
      const state = createInitialState();
      state.inputItems = [{ key: 'input-1', itemKey: 'Desc_IronIngot_C', value: '10', weight: '0', unlimited: false }];
      const result = reducer(state, { type: 'DELETE_INPUT_ITEM', key: 'input-1' });
      expect(result.inputItems).toHaveLength(0);
    });
  });

  describe('UPDATE_INPUT_ITEM', () => {
    it('updates the matching input item', () => {
      const state = createInitialState();
      state.inputItems = [
        { key: 'input-1', itemKey: 'Desc_IronIngot_C', value: '10', weight: '0', unlimited: false },
      ];
      const updated = { key: 'input-1', itemKey: 'Desc_IronIngot_C', value: '50', weight: '5', unlimited: true };
      const result = reducer(state, { type: 'UPDATE_INPUT_ITEM', data: updated });
      expect(result.inputItems[0]).toEqual(updated);
    });
  });

  describe('UPDATE_INPUT_RESOURCE', () => {
    it('updates the matching input resource', () => {
      const state = createInitialState();
      const ironResource = state.inputResources.find(r => r.itemKey === 'Desc_OreIron_C')!;
      const updated = { ...ironResource, value: '999', unlimited: true };
      const result = reducer(state, { type: 'UPDATE_INPUT_RESOURCE', data: updated });
      const updatedResource = result.inputResources.find(r => r.itemKey === 'Desc_OreIron_C')!;
      expect(updatedResource.value).toBe('999');
      expect(updatedResource.unlimited).toBe(true);
    });
  });

  describe('SET_RESOURCES_TO_MAP_LIMITS', () => {
    it('resets resources to game data defaults', () => {
      const state = createInitialState();
      state.inputResources = state.inputResources.map(r => ({ ...r, value: '0', unlimited: false }));
      const result = reducer(state, { type: 'SET_RESOURCES_TO_MAP_LIMITS', gameData: mockGameData });
      const iron = result.inputResources.find(r => r.itemKey === 'Desc_OreIron_C')!;
      expect(iron.value).toBe('70380');
      const water = result.inputResources.find(r => r.itemKey === 'Desc_Water_C')!;
      expect(water.unlimited).toBe(true);
    });
  });

  describe('SET_RESOURCES_TO_0', () => {
    it('zeroes all resource values and disables unlimited', () => {
      const state = createInitialState();
      const result = reducer(state, { type: 'SET_RESOURCES_TO_0' });
      result.inputResources.forEach((r) => {
        expect(r.value).toBe('0');
        expect(r.unlimited).toBe(false);
      });
    });
  });

  describe('SET_ALLOW_HAND_GATHERED_ITEMS', () => {
    it('enables hand gathered items', () => {
      const state = createInitialState();
      const result = reducer(state, { type: 'SET_ALLOW_HAND_GATHERED_ITEMS', active: true });
      expect(result.allowHandGatheredItems).toBe(true);
    });

    it('disables hand gathered items', () => {
      const state = createInitialState();
      state.allowHandGatheredItems = true;
      const result = reducer(state, { type: 'SET_ALLOW_HAND_GATHERED_ITEMS', active: false });
      expect(result.allowHandGatheredItems).toBe(false);
    });
  });

  describe('UPDATE_WEIGHTING_OPTIONS', () => {
    it('updates all weighting options', () => {
      const state = createInitialState();
      const newWeights: WeightingOptions = { resources: '500', power: '10', complexity: '5', buildings: '3' };
      const result = reducer(state, { type: 'UPDATE_WEIGHTING_OPTIONS', data: newWeights });
      expect(result.weightingOptions).toEqual(newWeights);
    });
  });

  describe('SET_ALL_WEIGHTS_DEFAULT', () => {
    it('resets weighting options to defaults', () => {
      const state = createInitialState();
      state.weightingOptions = { resources: '500', power: '10', complexity: '5', buildings: '3' };
      const result = reducer(state, { type: 'SET_ALL_WEIGHTS_DEFAULT', gameData: mockGameData });
      expect(result.weightingOptions).toEqual({
        resources: '1000',
        power: '1',
        complexity: '0',
        buildings: '0',
      });
    });

    it('resets resource weights to game data relative values', () => {
      const state = createInitialState();
      state.inputResources = state.inputResources.map(r => ({ ...r, weight: '999' }));
      const result = reducer(state, { type: 'SET_ALL_WEIGHTS_DEFAULT', gameData: mockGameData });
      const iron = result.inputResources.find(r => r.itemKey === 'Desc_OreIron_C')!;
      expect(iron.weight).toBe('1');
    });
  });

  describe('SET_RECIPE_ACTIVE', () => {
    it('enables a recipe', () => {
      const state = createInitialState();
      const result = reducer(state, { type: 'SET_RECIPE_ACTIVE', key: 'Recipe_AlternateIronPlate_C', active: true });
      expect(result.allowedRecipes['Recipe_AlternateIronPlate_C']).toBe(true);
    });

    it('disables a recipe', () => {
      const state = createInitialState();
      const result = reducer(state, { type: 'SET_RECIPE_ACTIVE', key: 'Recipe_IronIngot_C', active: false });
      expect(result.allowedRecipes['Recipe_IronIngot_C']).toBe(false);
    });
  });

  describe('MASS_SET_RECIPES_ACTIVE', () => {
    it('enables multiple recipes at once', () => {
      const state = createInitialState();
      const result = reducer(state, {
        type: 'MASS_SET_RECIPES_ACTIVE',
        recipes: ['Recipe_AlternateIronPlate_C', 'Recipe_IronIngot_C'],
        active: true,
      });
      expect(result.allowedRecipes['Recipe_AlternateIronPlate_C']).toBe(true);
      expect(result.allowedRecipes['Recipe_IronIngot_C']).toBe(true);
    });

    it('disables multiple recipes at once', () => {
      const state = createInitialState();
      const result = reducer(state, {
        type: 'MASS_SET_RECIPES_ACTIVE',
        recipes: ['Recipe_IronIngot_C', 'Recipe_IronPlate_C'],
        active: false,
      });
      expect(result.allowedRecipes['Recipe_IronIngot_C']).toBe(false);
      expect(result.allowedRecipes['Recipe_IronPlate_C']).toBe(false);
    });
  });

  describe('LOAD_FROM_SHARED_FACTORY', () => {
    it('loads a shared factory config', () => {
      const sharedConfig = {
        productionItems: [
          { itemKey: 'Desc_IronPlate_C', mode: 'per-minute', value: 20 },
        ],
        inputItems: [
          { itemKey: 'Desc_IronIngot_C', value: 100, weight: 0, unlimited: false },
        ],
        inputResources: [
          { itemKey: 'Desc_OreIron_C', value: 5000, weight: 1, unlimited: false },
          { itemKey: 'Desc_OreCopper_C', value: 2000, weight: 2, unlimited: false },
          { itemKey: 'Desc_Water_C', value: 0, weight: 0, unlimited: true },
        ],
        allowHandGatheredItems: true,
        weightingOptions: { resources: 500, power: 10, complexity: 5, buildings: 3 },
        allowedRecipes: ['Recipe_IronIngot_C', 'Recipe_IronPlate_C'],
        nodesPositions: [{ key: 'node1', x: 10, y: 20 }],
      };

      const result = reducer(createInitialState(), {
        type: 'LOAD_FROM_SHARED_FACTORY',
        config: sharedConfig,
        gameData: mockGameData,
      });

      expect(result.productionItems).toHaveLength(1);
      expect(result.productionItems[0].itemKey).toBe('Desc_IronPlate_C');
      expect(result.productionItems[0].value).toBe('20');
      expect(result.inputItems).toHaveLength(1);
      expect(result.allowHandGatheredItems).toBe(true);
      expect(result.weightingOptions.resources).toBe('500');
      expect(result.allowedRecipes['Recipe_IronIngot_C']).toBe(true);
      expect(result.allowedRecipes['Recipe_IronPlate_C']).toBe(true);
    });

    it('returns initial state on error', () => {
      const result = reducer(createInitialState(), {
        type: 'LOAD_FROM_SHARED_FACTORY',
        config: null,
        gameData: mockGameData,
      });
      expect(result.productionItems).toEqual([]);
    });
  });

  describe('LOAD_FROM_SESSION_STORAGE', () => {
    it('loads state from session storage', () => {
      const savedState = createStateWithProductionItem();
      const result = reducer(createInitialState(), {
        type: 'LOAD_FROM_SESSION_STORAGE',
        sessionState: savedState,
        gameData: mockGameData,
      });
      expect(result).toBe(savedState);
    });
  });

  describe('UPDATE_NODES_POSTIONS', () => {
    it('updates node positions', () => {
      const state = createInitialState();
      const positions = [
        { key: 'node1', x: 100, y: 200 },
        { key: 'node2', x: 300, y: 400 },
      ];
      const result = reducer(state, { type: 'UPDATE_NODES_POSTIONS', nodesPositions: positions });
      expect(result.nodesPositions).toEqual(positions);
    });

    it('replaces existing positions', () => {
      const state = createInitialState();
      state.nodesPositions = [{ key: 'old', x: 0, y: 0 }];
      const newPositions = [{ key: 'new', x: 1, y: 1 }];
      const result = reducer(state, { type: 'UPDATE_NODES_POSTIONS', nodesPositions: newPositions });
      expect(result.nodesPositions).toEqual(newPositions);
    });
  });

  describe('unknown action', () => {
    it('returns current state for unknown action types', () => {
      const state = createInitialState();
      const result = reducer(state, { type: 'UNKNOWN' } as any);
      expect(result).toBe(state);
    });
  });
});
