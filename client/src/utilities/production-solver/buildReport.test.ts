import { buildReport } from './buildReport';
import { NODE_TYPE, ProductionGraph } from './models';
import { ReportContext, Inputs } from './internals';
import { GameData } from '../../contexts/gameData/types';

// Game data sized so the report numbers are easy to compute by hand.
const gameData: GameData = {
  buildings: {
    'Build_SmelterMk1_C': {
      slug: 'smelter', name: 'Smelter', power: 4, area: 50,
      buildCost: [{ itemClass: 'Desc_IronRod_C', quantity: 5 }],
      isFicsmas: false,
    },
    'Build_ConstructorMk1_C': {
      slug: 'constructor', name: 'Constructor', power: 4, area: 100,
      buildCost: [{ itemClass: 'Desc_IronRod_C', quantity: 2 }],
      isFicsmas: false,
    },
    // Used only by the hard-coded extraction-rate branches.
    'Desc_MinerMk3_C': { slug: 'miner', name: 'Miner Mk.3', power: 240, area: 0, buildCost: [], isFicsmas: false },
    'Desc_WaterPump_C': {
      slug: 'water', name: 'Water Extractor', power: 120, area: 0,
      buildCost: [{ itemClass: 'Desc_IronRod_C', quantity: 10 }],
      isFicsmas: false,
    },
    'Desc_OilPump_C': { slug: 'oil', name: 'Oil Extractor', power: 240, area: 0, buildCost: [], isFicsmas: false },
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
    'Desc_IronRod_C': { slug: 'iron_rod', name: 'Iron Rod', sinkPoints: 4, isFluid: false, usedInRecipes: [], producedFromRecipes: [], isFicsmas: false },
  },
  handGatheredItems: {},
};

const inputs: Inputs = {
  'Desc_OreIron_C': { amount: Infinity, weight: 0.5, type: NODE_TYPE.RESOURCE },
};

const context: ReportContext = { gameData, inputs };

// A complete iron-ore -> ingot -> plate chain produced graph.
//  - Smelter recipe at multiplier 1 (30 ore -> 30 ingot)
//  - Constructor recipe at multiplier 1.5 (45 ingot -> 30 plate); ceil -> 2 buildings
//  - Resource node for iron ore (extraction via MinerMk3)
//  - Final product node for iron plate (sink points)
function makeGraph(): ProductionGraph {
  return {
    nodes: {
      'Recipe_IronIngot_C': { id: 'Recipe_IronIngot_C', key: 'Recipe_IronIngot_C', type: NODE_TYPE.RECIPE, multiplier: 1 },
      'Recipe_IronPlate_C': { id: 'Recipe_IronPlate_C', key: 'Recipe_IronPlate_C', type: NODE_TYPE.RECIPE, multiplier: 1.5 },
      'Desc_OreIron_C': { id: 'Desc_OreIron_C', key: 'Desc_OreIron_C', type: NODE_TYPE.RESOURCE, multiplier: 30 },
      'Desc_IronPlate_C': { id: 'Desc_IronPlate_C', key: 'Desc_IronPlate_C', type: NODE_TYPE.FINAL_PRODUCT, multiplier: 30 },
    },
    edges: [
      { key: 'Desc_OreIron_C', from: 'Desc_OreIron_C', to: 'Recipe_IronIngot_C', productionRate: 30 },
      { key: 'Desc_IronIngot_C', from: 'Recipe_IronIngot_C', to: 'Recipe_IronPlate_C', productionRate: 30 },
      { key: 'Desc_IronPlate_C', from: 'Recipe_IronPlate_C', to: 'Desc_IronPlate_C', productionRate: 30 },
    ],
  };
}

describe('buildReport', () => {
  it('computes the power breakdown across production, extraction, and generators', () => {
    const report = buildReport(makeGraph(), context);
    // production: smelter 1*4 + constructor 1.5*4 = 4 + 6 = 10
    expect(report.powerUsageEstimate.production).toBeCloseTo(10);
    // extraction: ore via MinerMk3 -> 30/240 * 240 = 30
    expect(report.powerUsageEstimate.extraction).toBeCloseTo(30);
    expect(report.powerUsageEstimate.generators).toBe(0);
    // total = production + extraction
    expect(report.powerUsageEstimate.total).toBeCloseTo(40);
  });

  it('routes negative power into generators', () => {
    const g = makeGraph();
    // Override the smelter to act as a generator (negative power building).
    const gd: GameData = {
      ...gameData,
      buildings: { ...gameData.buildings, 'Build_SmelterMk1_C': { ...gameData.buildings['Build_SmelterMk1_C'], power: -50 } },
    };
    const report = buildReport(g, { gameData: gd, inputs });
    expect(report.powerUsageEstimate.generators).toBeCloseTo(50);
    // production now only the constructor: 1.5 * 4 = 6
    expect(report.powerUsageEstimate.production).toBeCloseTo(6);
    // total = -50 (smelter) + 6 (constructor) + 30 (extraction) = -14
    expect(report.powerUsageEstimate.total).toBeCloseTo(-14);
  });

  it('computes build area, estimated foundations, and building counts (ceiling per recipe)', () => {
    const report = buildReport(makeGraph(), context);
    // area: smelter ceil(1)*50 + constructor ceil(1.5)=2 * 100 = 50 + 200 = 250
    expect(report.totalBuildArea).toBe(250);
    // foundations: ceil(2 * 250/64) = ceil(7.8125) = 8
    expect(report.estimatedFoundations).toBe(8);
    expect(report.buildingsUsed['Build_SmelterMk1_C'].count).toBe(1);
    expect(report.buildingsUsed['Build_ConstructorMk1_C'].count).toBe(2);
  });

  it('accumulates material cost from building build costs (using ceil counts)', () => {
    const report = buildReport(makeGraph(), context);
    // smelter: 1 * 5 = 5 rods; constructor: 2 * 2 = 4 rods => total 9
    expect(report.buildingsUsed['Build_SmelterMk1_C'].materialCost['Desc_IronRod_C']).toBe(5);
    expect(report.buildingsUsed['Build_ConstructorMk1_C'].materialCost['Desc_IronRod_C']).toBe(4);
    expect(report.totalMaterialCost['Desc_IronRod_C']).toBe(9);
  });

  it('reports raw resources by item name and resource efficiency score', () => {
    const report = buildReport(makeGraph(), context);
    expect(report.totalRawResources['Iron Ore']).toBe(30);
    // efficiency: multiplier 30 * weight 0.5 = 15
    expect(report.resourceEfficiencyScore).toBeCloseTo(15);
  });

  it('sums sink points only over final products', () => {
    const report = buildReport(makeGraph(), context);
    // plate final product: 30 * 6 points = 180
    expect(report.pointsProduced).toBe(180);
  });

  it('zeroes sink points for Ficsmas final products', () => {
    const gd: GameData = {
      ...gameData,
      items: { ...gameData.items, 'Desc_IronPlate_C': { ...gameData.items['Desc_IronPlate_C'], isFicsmas: true } },
    };
    const report = buildReport(makeGraph(), { gameData: gd, inputs });
    expect(report.pointsProduced).toBe(0);
  });

  it('emits water-extractor buildings and material cost for water resource nodes', () => {
    const graph: ProductionGraph = {
      nodes: {
        'Desc_Water_C': { id: 'Desc_Water_C', key: 'Desc_Water_C', type: NODE_TYPE.RESOURCE, multiplier: 300 },
      },
      edges: [],
    };
    const gd: GameData = {
      ...gameData,
      items: { ...gameData.items, 'Desc_Water_C': { slug: 'water', name: 'Water', sinkPoints: 0, isFluid: true, usedInRecipes: [], producedFromRecipes: [], isFicsmas: false } },
      resources: { ...gameData.resources, 'Desc_Water_C': { itemClass: 'Desc_Water_C', maxExtraction: null, relativeValue: 1 } },
    };
    const waterInputs: Inputs = { 'Desc_Water_C': { amount: Infinity, weight: 1, type: NODE_TYPE.RESOURCE } };
    const report = buildReport(graph, { gameData: gd, inputs: waterInputs });
    // numExtractors = ceil(300/120) = 3; rods = 3 * 10 = 30
    expect(report.buildingsUsed['Desc_WaterPump_C'].count).toBe(3);
    expect(report.buildingsUsed['Desc_WaterPump_C'].materialCost['Desc_IronRod_C']).toBe(30);
    expect(report.totalMaterialCost['Desc_IronRod_C']).toBe(30);
    // extraction power = 300/120 * 120 = 300
    expect(report.powerUsageEstimate.extraction).toBeCloseTo(300);
  });

  it('builds an items-per-step recap ordered by chain depth', () => {
    const report = buildReport(makeGraph(), context);
    const byKey = Object.fromEntries(report.totalItemsRecap.map((r) => [r.key, r]));
    // ore is a raw resource (step 1), ingot one step in, plate two steps in
    expect(byKey['Desc_OreIron_C'].step).toBe(1);
    expect(byKey['Desc_IronIngot_C'].step).toBe(2);
    expect(byKey['Desc_IronPlate_C'].step).toBe(3);
    // amounts aggregate edge production rates per item
    expect(byKey['Desc_IronPlate_C'].amount).toBe(30);
    expect(byKey['Desc_IronPlate_C'].name).toBe('Iron Plate');
  });

  it('flags loopWarning false for an acyclic graph', () => {
    const report = buildReport(makeGraph(), context);
    expect(report.loopWarning).toBe(false);
  });

  it('flags loopWarning true when the graph contains a cycle', () => {
    const graph: ProductionGraph = {
      nodes: {
        'A': { id: 'A', key: 'A', type: NODE_TYPE.RECIPE, multiplier: 0 },
        'B': { id: 'B', key: 'B', type: NODE_TYPE.RECIPE, multiplier: 0 },
      },
      edges: [
        { key: 'Desc_IronIngot_C', from: 'A', to: 'B', productionRate: 1 },
        { key: 'Desc_IronIngot_C', from: 'B', to: 'A', productionRate: 1 },
      ],
    };
    // Recipe nodes need recipe data for the items-per-step pass; supply minimal entries.
    const gd: GameData = {
      ...gameData,
      recipes: {
        ...gameData.recipes,
        'A': { slug: 'a', name: 'A', isAlternate: false, ingredients: [], products: [], producedIn: 'Build_SmelterMk1_C', isFicsmas: false },
        'B': { slug: 'b', name: 'B', isAlternate: false, ingredients: [], products: [], producedIn: 'Build_SmelterMk1_C', isFicsmas: false },
      },
    };
    const report = buildReport(graph, { gameData: gd, inputs });
    expect(report.loopWarning).toBe(true);
  });
});
