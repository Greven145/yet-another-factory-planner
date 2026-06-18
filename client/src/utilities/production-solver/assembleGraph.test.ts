import { assembleGraph } from './assembleGraph';
import { NODE_TYPE } from './models';
import { GraphContext, Inputs, ProductionSolution, RateTargets } from './internals';
import { GameData } from '../../contexts/gameData/types';

const gameData: GameData = {
  buildings: {
    'Build_SmelterMk1_C': { slug: 'smelter', name: 'Smelter', power: 4, area: 50, buildCost: [], isFicsmas: false },
    'Build_ConstructorMk1_C': { slug: 'constructor', name: 'Constructor', power: 4, area: 100, buildCost: [], isFicsmas: false },
  },
  recipes: {
    'Recipe_IronIngot_C': {
      slug: 'iron_ingot', name: 'Iron Ingot', isAlternate: false,
      ingredients: [{ itemClass: 'Desc_OreIron_C', perMinute: 30 }],
      products: [{ itemClass: 'Desc_IronIngot_C', perMinute: 30 }],
      producedIn: 'Build_SmelterMk1_C', isFicsmas: false,
    },
    'Recipe_IronPlate_C': {
      slug: 'iron_plate', name: 'Iron Plate', isAlternate: false,
      ingredients: [{ itemClass: 'Desc_IronIngot_C', perMinute: 30 }],
      products: [{ itemClass: 'Desc_IronPlate_C', perMinute: 20 }],
      producedIn: 'Build_ConstructorMk1_C', isFicsmas: false,
    },
  },
  resources: {
    'Desc_OreIron_C': { itemClass: 'Desc_OreIron_C', maxExtraction: 70380, relativeValue: 1 },
  },
  items: {
    'Desc_OreIron_C': { slug: 'iron_ore', name: 'Iron Ore', sinkPoints: 1, isFluid: false, usedInRecipes: ['Recipe_IronIngot_C'], producedFromRecipes: [], isFicsmas: false },
    'Desc_IronIngot_C': { slug: 'iron_ingot', name: 'Iron Ingot', sinkPoints: 2, isFluid: false, usedInRecipes: ['Recipe_IronPlate_C'], producedFromRecipes: ['Recipe_IronIngot_C'], isFicsmas: false },
    'Desc_IronPlate_C': { slug: 'iron_plate', name: 'Iron Plate', sinkPoints: 6, isFluid: false, usedInRecipes: [], producedFromRecipes: ['Recipe_IronPlate_C'], isFicsmas: false },
  },
  handGatheredItems: {},
};

const inputs: Inputs = {
  'Desc_OreIron_C': { amount: Infinity, weight: 1, type: NODE_TYPE.RESOURCE },
};

const rateTargets: RateTargets = {
  'Desc_IronPlate_C': { value: 30, recipe: null, isPoints: false },
};

const context: GraphContext = {
  gameData,
  inputs,
  rateTargets,
  maximizeTargets: [],
  hasPointsTarget: false,
};

describe('assembleGraph', () => {
  it('builds recipe nodes carrying their solution multipliers', () => {
    const solution: ProductionSolution = { 'Recipe_IronIngot_C': 1.5, 'Recipe_IronPlate_C': 1.5 };
    const graph = assembleGraph(solution, context);
    expect(graph.nodes['Recipe_IronIngot_C'].type).toBe(NODE_TYPE.RECIPE);
    expect(graph.nodes['Recipe_IronIngot_C'].multiplier).toBeCloseTo(1.5);
    expect(graph.nodes['Recipe_IronPlate_C'].multiplier).toBeCloseTo(1.5);
  });

  it('creates a RESOURCE node for unproduced inputs and connects it to its consumer', () => {
    const solution: ProductionSolution = { 'Recipe_IronIngot_C': 1.5, 'Recipe_IronPlate_C': 1.5 };
    const graph = assembleGraph(solution, context);
    const ore = graph.nodes['Desc_OreIron_C'];
    expect(ore.type).toBe(NODE_TYPE.RESOURCE);
    // 1.5 multiplier * 30/min = 45 ore consumed
    expect(ore.multiplier).toBeCloseTo(45);
    const oreEdge = graph.edges.find((e) => e.key === 'Desc_OreIron_C');
    expect(oreEdge).toMatchObject({ from: 'Desc_OreIron_C', to: 'Recipe_IronIngot_C' });
    expect(oreEdge!.productionRate).toBeCloseTo(45);
  });

  it('creates a FINAL_PRODUCT node for rate-targeted items', () => {
    const solution: ProductionSolution = { 'Recipe_IronIngot_C': 1.5, 'Recipe_IronPlate_C': 1.5 };
    const graph = assembleGraph(solution, context);
    const plate = graph.nodes['Desc_IronPlate_C'];
    expect(plate.type).toBe(NODE_TYPE.FINAL_PRODUCT);
    // 1.5 * 20/min = 30 plate
    expect(plate.multiplier).toBeCloseTo(30);
  });

  it('routes intermediate production from producer to consumer', () => {
    const solution: ProductionSolution = { 'Recipe_IronIngot_C': 1.5, 'Recipe_IronPlate_C': 1.5 };
    const graph = assembleGraph(solution, context);
    const ingotEdge = graph.edges.find((e) => e.key === 'Desc_IronIngot_C');
    expect(ingotEdge).toMatchObject({ from: 'Recipe_IronIngot_C', to: 'Recipe_IronPlate_C' });
    // 1.5 * 30/min = 45 ingot moved
    expect(ingotEdge!.productionRate).toBeCloseTo(45);
  });

  it('marks untargeted leftover production as a SIDE_PRODUCT', () => {
    // Run only the smelter so its ingot output is consumed by nobody.
    const solution: ProductionSolution = { 'Recipe_IronIngot_C': 1 };
    const graph = assembleGraph(solution, {
      gameData, inputs,
      rateTargets: {},
      maximizeTargets: [],
      hasPointsTarget: false,
    });
    expect(graph.nodes['Desc_IronIngot_C'].type).toBe(NODE_TYPE.SIDE_PRODUCT);
    expect(graph.nodes['Desc_IronIngot_C'].multiplier).toBeCloseTo(30);
  });

  it('marks leftover production as FINAL_PRODUCT when it is a points target item', () => {
    const solution: ProductionSolution = { 'Recipe_IronIngot_C': 1 };
    const graph = assembleGraph(solution, {
      gameData, inputs,
      rateTargets: {},
      maximizeTargets: [],
      hasPointsTarget: true,
    });
    // ingot has sinkPoints 2 > 0, and hasPointsTarget is set
    expect(graph.nodes['Desc_IronIngot_C'].type).toBe(NODE_TYPE.FINAL_PRODUCT);
  });
});
