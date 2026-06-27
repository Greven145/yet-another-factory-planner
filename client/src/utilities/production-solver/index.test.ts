import { ProductionSolver, NODE_TYPE, POINTS_ITEM_KEY } from './index';
import { GraphError } from '../error/GraphError';
import { FactoryOptions } from '../../contexts/production/types';
import { GameData } from '../../contexts/gameData/types';

// Minimal game data for testing the solver constructor
const mockGameData: GameData = {
  buildings: {
    'Build_SmelterMk1_C': {
      slug: 'smelter',
      name: 'Smelter',
      power: 4,
      area: 54,
      buildCost: [],
      isFicsmas: false,
    },
    'Build_ConstructorMk1_C': {
      slug: 'constructor',
      name: 'Constructor',
      power: 4,
      area: 100,
      buildCost: [],
      isFicsmas: false,
    },
    'Desc_MinerMk3_C': {
      slug: 'miner_mk3',
      name: 'Miner Mk.3',
      power: 110,
      area: 100,
      buildCost: [],
      isFicsmas: false,
    },
    'Desc_WaterPump_C': {
      slug: 'water_extractor',
      name: 'Water Extractor',
      power: 20,
      area: 100,
      buildCost: [],
      isFicsmas: false,
    },
    'Desc_OilPump_C': {
      slug: 'oil_extractor',
      name: 'Oil Extractor',
      power: 40,
      area: 100,
      buildCost: [],
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
  },
  resources: {
    'Desc_OreIron_C': {
      itemClass: 'Desc_OreIron_C',
      maxExtraction: 70380,
      relativeValue: 1,
    },
  },
  items: {
    'Desc_OreIron_C': {
      slug: 'iron_ore',
      name: 'Iron Ore',
      sinkPoints: 1,
      isFluid: false,
      usedInRecipes: ['Recipe_IronIngot_C'],
      producedFromRecipes: [],
      isFicsmas: false,
    },
    'Desc_IronIngot_C': {
      slug: 'iron_ingot',
      name: 'Iron Ingot',
      sinkPoints: 2,
      isFluid: false,
      usedInRecipes: ['Recipe_IronPlate_C'],
      producedFromRecipes: ['Recipe_IronIngot_C'],
      isFicsmas: false,
    },
    'Desc_IronPlate_C': {
      slug: 'iron_plate',
      name: 'Iron Plate',
      sinkPoints: 6,
      isFluid: false,
      usedInRecipes: [],
      producedFromRecipes: ['Recipe_IronPlate_C'],
      isFicsmas: false,
    },
  },
  handGatheredItems: {},
};

function createValidOptions(overrides?: Partial<FactoryOptions>): FactoryOptions {
  return {
    key: 'test',
    productionItems: [{
      key: 'prod-1',
      itemKey: 'Desc_IronPlate_C',
      mode: 'per-minute',
      value: '10',
    }],
    inputItems: [],
    inputResources: [{
      key: 'Desc_OreIron_C',
      itemKey: 'Desc_OreIron_C',
      value: '70380',
      weight: '1',
      unlimited: false,
    }],
    allowHandGatheredItems: false,
    weightingOptions: {
      resources: '1000',
      power: '1',
      complexity: '0',
      buildings: '0',
    },
    gameModeOptions: {
      recipePartsCost: '1',
      powerConsumption: '1',
    },
    allowedRecipes: {
      'Recipe_IronIngot_C': true,
      'Recipe_IronPlate_C': true,
    },
    allowedBuildings: {
      'Build_SmelterMk1_C': true,
      'Build_ConstructorMk1_C': true,
    },
    nodesPositions: [],
    maximizeBalanceMode: 'proportional',
    transportOptions: { beltCapacity: null, pipeCapacity: null },
    ...overrides,
  };
}

describe('ProductionSolver constructor', () => {
  it('creates solver with valid options', () => {
    expect(() => new ProductionSolver(createValidOptions(), mockGameData)).not.toThrow();
  });

  it('throws GraphError for NaN in weighting options', () => {
    const options = createValidOptions({
      weightingOptions: { resources: 'abc', power: '1', complexity: '0', buildings: '0' },
    });
    expect(() => new ProductionSolver(options, mockGameData)).toThrow(GraphError);
  });

  it('throws GraphError for negative weighting values', () => {
    const options = createValidOptions({
      weightingOptions: { resources: '-1', power: '1', complexity: '0', buildings: '0' },
    });
    expect(() => new ProductionSolver(options, mockGameData)).toThrow(GraphError);
  });

  it('throws GraphError when same item is input and output', () => {
    const options = createValidOptions({
      inputItems: [{
        key: 'input-1',
        itemKey: 'Desc_IronPlate_C',
        value: '50',
        weight: '0',
        unlimited: false,
      }],
    });
    expect(() => new ProductionSolver(options, mockGameData)).toThrow(GraphError);
  });

  it('throws GraphError when no outputs set', () => {
    const options = createValidOptions({
      productionItems: [],
    });
    expect(() => new ProductionSolver(options, mockGameData)).toThrow(GraphError);
  });

  it('handles maximize mode production items', () => {
    const options = createValidOptions({
      productionItems: [{
        key: 'prod-1',
        itemKey: 'Desc_IronPlate_C',
        mode: 'maximize',
        value: '1',
      }],
    });
    expect(() => new ProductionSolver(options, mockGameData)).not.toThrow();
  });

  it('handles recipe-specific mode production items', () => {
    const options = createValidOptions({
      productionItems: [{
        key: 'prod-1',
        itemKey: 'Desc_IronPlate_C',
        mode: 'Recipe_IronPlate_C',
        value: '2',
      }],
    });
    expect(() => new ProductionSolver(options, mockGameData)).not.toThrow();
  });

  it('throws when targeting a disabled recipe', () => {
    const options = createValidOptions({
      productionItems: [{
        key: 'prod-1',
        itemKey: 'Desc_IronPlate_C',
        mode: 'Recipe_IronPlate_C',
        value: '2',
      }],
      allowedRecipes: {
        'Recipe_IronIngot_C': true,
        'Recipe_IronPlate_C': false,
      },
    });
    expect(() => new ProductionSolver(options, mockGameData)).toThrow(GraphError);
  });

  it('throws when targeting a recipe whose building is disabled', () => {
    const options = createValidOptions({
      productionItems: [{
        key: 'prod-1',
        itemKey: 'Desc_IronPlate_C',
        mode: 'Recipe_IronPlate_C',
        value: '2',
      }],
      // Recipe is allowed, but the Constructor that makes it is disabled.
      allowedBuildings: {
        'Build_SmelterMk1_C': true,
        'Build_ConstructorMk1_C': false,
      },
    });
    expect(() => new ProductionSolver(options, mockGameData)).toThrow(GraphError);
  });

  it('treats a missing allowedBuildings entry as enabled', () => {
    const options = createValidOptions({ allowedBuildings: {} });
    expect(() => new ProductionSolver(options, mockGameData)).not.toThrow();
  });

  it('allows duplicate maximization priority', () => {
    const options = createValidOptions({
      productionItems: [
        { key: 'prod-1', itemKey: 'Desc_IronPlate_C', mode: 'maximize', value: '1' },
        { key: 'prod-2', itemKey: 'Desc_IronIngot_C', mode: 'maximize', value: '1' },
      ],
    });
    expect(() => new ProductionSolver(options, mockGameData)).not.toThrow();
  });

  it('handles unlimited resource inputs', () => {
    const options = createValidOptions({
      inputResources: [{
        key: 'Desc_OreIron_C',
        itemKey: 'Desc_OreIron_C',
        value: '0',
        weight: '1',
        unlimited: true,
      }],
    });
    expect(() => new ProductionSolver(options, mockGameData)).not.toThrow();
  });

  it('skips resources with zero amount', () => {
    const options = createValidOptions({
      inputResources: [{
        key: 'Desc_OreIron_C',
        itemKey: 'Desc_OreIron_C',
        value: '0',
        weight: '1',
        unlimited: false,
      }],
    });
    // Should not throw - zero resource just gets skipped
    expect(() => new ProductionSolver(options, mockGameData)).not.toThrow();
  });

  it('handles hand gathered items when enabled', () => {
    const gameDataWithHandGathered = {
      ...mockGameData,
      handGatheredItems: { 'Desc_Mycelia_C': 'Desc_Mycelia_C' },
    };
    const options = createValidOptions({ allowHandGatheredItems: true });
    expect(() => new ProductionSolver(options, gameDataWithHandGathered)).not.toThrow();
  });

  it('aggregates per-minute targets for same item', () => {
    const options = createValidOptions({
      productionItems: [
        { key: 'prod-1', itemKey: 'Desc_IronPlate_C', mode: 'per-minute', value: '5' },
        { key: 'prod-2', itemKey: 'Desc_IronPlate_C', mode: 'per-minute', value: '10' },
      ],
    });
    // Should not throw - aggregated to 15/min
    expect(() => new ProductionSolver(options, mockGameData)).not.toThrow();
  });
});

describe('ProductionSolver.exec', () => {
  it('solves a simple iron plate production chain', async () => {
    const options = createValidOptions();
    const solver = new ProductionSolver(options, mockGameData);
    const results = await solver.exec();

    expect(results.error).toBeNull();
    expect(results.productionGraph).not.toBeNull();
    expect(results.report).not.toBeNull();
    expect(results.computeTime).toBeGreaterThan(0);

    // Should have recipe nodes for smelting and constructing
    const recipeNodes = Object.values(results.productionGraph!.nodes)
      .filter(n => n.type === NODE_TYPE.RECIPE);
    expect(recipeNodes.length).toBeGreaterThanOrEqual(2);

    // Should have edges connecting recipes
    expect(results.productionGraph!.edges.length).toBeGreaterThan(0);
  });

  it('generates a valid report', async () => {
    const options = createValidOptions();
    const solver = new ProductionSolver(options, mockGameData);
    const results = await solver.exec();

    expect(results.report).not.toBeNull();
    const report = results.report!;
    expect(report.powerUsageEstimate).toBeDefined();
    expect(report.totalBuildArea).toBeGreaterThanOrEqual(0);
    expect(report.buildingsUsed).toBeDefined();
    expect(report.totalMaterialCost).toBeDefined();
    expect(report.totalRawResources).toBeDefined();
  });

  it('returns error for infeasible problem', async () => {
    const options = createValidOptions({
      inputResources: [{
        key: 'Desc_OreIron_C',
        itemKey: 'Desc_OreIron_C',
        value: '1',
        weight: '1',
        unlimited: false,
      }],
      productionItems: [{
        key: 'prod-1',
        itemKey: 'Desc_IronPlate_C',
        mode: 'per-minute',
        value: '99999',
      }],
    });
    const solver = new ProductionSolver(options, mockGameData);
    const results = await solver.exec();

    expect(results.error).not.toBeNull();
  });

  it('handles maximize mode solving', async () => {
    const options = createValidOptions({
      productionItems: [{
        key: 'prod-1',
        itemKey: 'Desc_IronPlate_C',
        mode: 'maximize',
        value: '1',
      }],
    });
    const solver = new ProductionSolver(options, mockGameData);
    const results = await solver.exec();

    expect(results.error).toBeNull();
    expect(results.productionGraph).not.toBeNull();
  });
});

describe('NODE_TYPE', () => {
  it('exports expected node types', () => {
    expect(NODE_TYPE.FINAL_PRODUCT).toBe('FINAL_PRODUCT');
    expect(NODE_TYPE.SIDE_PRODUCT).toBe('SIDE_PRODUCT');
    expect(NODE_TYPE.INPUT_ITEM).toBe('INPUT_ITEM');
    expect(NODE_TYPE.HAND_GATHERED_RESOURCE).toBe('HAND_GATHERED_RESOURCE');
    expect(NODE_TYPE.RESOURCE).toBe('RESOURCE');
    expect(NODE_TYPE.RECIPE).toBe('RECIPE');
  });
});

describe('POINTS_ITEM_KEY', () => {
  it('is a defined string constant', () => {
    expect(typeof POINTS_ITEM_KEY).toBe('string');
    expect(POINTS_ITEM_KEY.length).toBeGreaterThan(0);
  });
});

describe('ProductionSolver game mode multipliers (recipe cost)', () => {
  // The game applies the recipe cost multiplier to integer *per-cycle quantities*,
  // then rounds to the nearest whole number, and converts back to perMinute.
  // This differs from naively multiplying the stored perMinute rate directly.
  //
  // To derive per-cycle quantities we use:
  //   craftTime = 60 / GCD(all perMinutes in the recipe)
  //   perCycleQty = perMinute / GCD
  //
  // Mock recipe maths:
  //   Iron Ingot: 30 ore/min → 30 ingots/min.  GCD = 30 → 1 ore/cycle, craftTime = 2 s
  //   Iron Plate: 30 ingots/min → 20 plates/min. GCD = 10 → 3 ingots/cycle, craftTime = 6 s

  it('1.5x: rounds per-cycle ingredient quantity rather than scaling perMinute directly', async () => {
    // Iron Ingot 1.5x: round(1 × 1.5) = 2 ore/cycle → 60 ore/min  (naive: 45/min)
    // Iron Plate 1.5x: round(3 × 1.5) = round(4.5) = 5 ingots/cycle → 50 ingots/min  (naive: 45/min)
    // For 10 plates/min: 0.5 constructor × 50 = 25 ingots → 25/30 smelter × 60 = 50 ore/min
    const options = createValidOptions({
      productionItems: [{ key: 'prod-1', itemKey: 'Desc_IronPlate_C', mode: 'per-minute', value: '10' }],
      gameModeOptions: { recipePartsCost: '1.5', powerConsumption: '1' },
    });
    const { productionGraph, error } = await new ProductionSolver(options, mockGameData).exec();

    expect(error).toBeNull();
    const oreNode = productionGraph!.nodes['Desc_OreIron_C'];
    // Correct (per-cycle rounding): 50 ore/min
    // Naive (direct ×1.5):          33.75 ore/min
    expect(oreNode.multiplier).toBeCloseTo(50, 2);
  });

  it('0.75x: per-cycle rounding leaves small quantities unchanged when they round back to original', async () => {
    // Iron Ingot 0.75x: round(1 × 0.75) = round(0.75) = 1 ore/cycle → 30 ore/min  (naive: 22.5/min)
    // Iron Plate 0.75x: round(3 × 0.75) = round(2.25) = 2 ingots/cycle → 20 ingots/min  (naive: 22.5/min)
    // For 10 plates/min: 0.5 constructor × 20 = 10 ingots → 1/3 smelter × 30 = 10 ore/min
    const options = createValidOptions({
      productionItems: [{ key: 'prod-1', itemKey: 'Desc_IronPlate_C', mode: 'per-minute', value: '10' }],
      gameModeOptions: { recipePartsCost: '0.75', powerConsumption: '1' },
    });
    const { productionGraph, error } = await new ProductionSolver(options, mockGameData).exec();

    expect(error).toBeNull();
    const oreNode = productionGraph!.nodes['Desc_OreIron_C'];
    // Correct (per-cycle rounding): 10 ore/min (rounds back to base rate — no effective discount)
    // Naive (direct ×0.75):         ≈ 8.44 ore/min
    expect(oreNode.multiplier).toBeCloseTo(10, 2);
  });

  it('recipe cost multiplier does not affect product output rates', async () => {
    // Products are never scaled; only ingredients change.
    const options = createValidOptions({
      productionItems: [{ key: 'prod-1', itemKey: 'Desc_IronPlate_C', mode: 'per-minute', value: '10' }],
      gameModeOptions: { recipePartsCost: '1.5', powerConsumption: '1' },
    });
    const { productionGraph, error } = await new ProductionSolver(options, mockGameData).exec();

    expect(error).toBeNull();
    const plateNode = productionGraph!.nodes['Desc_IronPlate_C'];
    expect(plateNode.multiplier).toBeCloseTo(10, 2);
  });

  it('0.25x: per-cycle quantities that round to zero are clamped to a minimum of 1', async () => {
    // Iron Ingot: per-cycle ore = 1. round(1 × 0.25) = round(0.25) = 0 → clamped to 1 → 30 ore/min
    // Iron Plate: per-cycle ingots = 3. round(3 × 0.25) = round(0.75) = 1 → 10 ingots/min
    // For 10 plates/min: 0.5 constructor × 10 = 5 ingots/min → 5/30 smelter × 30 = 5 ore/min
    //
    // Without the clamp: ore ingredient becomes 0/min, the ore resource node never appears
    // in the graph, and the plan incorrectly claims zero ore is needed.
    const options = createValidOptions({
      productionItems: [{ key: 'prod-1', itemKey: 'Desc_IronPlate_C', mode: 'per-minute', value: '10' }],
      gameModeOptions: { recipePartsCost: '0.25', powerConsumption: '1' },
    });
    const { productionGraph, error } = await new ProductionSolver(options, mockGameData).exec();

    expect(error).toBeNull();
    const oreNode = productionGraph!.nodes['Desc_OreIron_C'];
    expect(oreNode).toBeDefined();
    expect(oreNode.multiplier).toBeCloseTo(5, 2);
  });

  it('2x: exact doubling produces the same result whether using per-cycle or direct scaling', async () => {
    // Both approaches give the same result when perCycle * multiplier is already an integer.
    // Iron Ingot 2x: 1 × 2 = 2 → 60 ore/min; Iron Plate 2x: 3 × 2 = 6 → 60 ingots/min
    // For 10 plates/min: 0.5 constructor × 60 = 30 ingots → 1 smelter × 60 = 60 ore/min
    const options = createValidOptions({
      productionItems: [{ key: 'prod-1', itemKey: 'Desc_IronPlate_C', mode: 'per-minute', value: '10' }],
      gameModeOptions: { recipePartsCost: '2', powerConsumption: '1' },
    });
    const { productionGraph, error } = await new ProductionSolver(options, mockGameData).exec();

    expect(error).toBeNull();
    const oreNode = productionGraph!.nodes['Desc_OreIron_C'];
    expect(oreNode.multiplier).toBeCloseTo(60, 2);
  });
});
