import { describe, it, expect } from 'vitest';
import { buildFlowModel } from './flow-model';
import { NODE_TYPE, ProductionGraph } from './models';
import { GameData } from '../../contexts/gameData/types';

// Minimal GameData stub — only the fields buildFlowModel reads.
const gameData = {
  buildings: {
    Build_Smelter: { name: 'Smelter' },
    Build_Constructor: { name: 'Constructor' },
  },
  recipes: {
    Recipe_IronIngot: { name: 'Iron Ingot', producedIn: 'Build_Smelter' },
    Recipe_IronPlate: { name: 'Iron Plate', producedIn: 'Build_Constructor' },
  },
  items: {
    Desc_OreIron: { name: 'Iron Ore' },
    Desc_IronIngot: { name: 'Iron Ingot' },
    Desc_IronPlate: { name: 'Iron Plate' },
  },
} as unknown as GameData;

// Iron Ore (raw) -> Iron Ingot recipe -> Iron Plate recipe -> Iron Plate (final)
const graph: ProductionGraph = {
  nodes: {
    ore: { id: 'ore', key: 'Desc_OreIron', type: NODE_TYPE.RESOURCE, multiplier: 30 },
    ingot: { id: 'ingot', key: 'Recipe_IronIngot', type: NODE_TYPE.RECIPE, multiplier: 1 },
    plate: { id: 'plate', key: 'Recipe_IronPlate', type: NODE_TYPE.RECIPE, multiplier: 2 },
    final: { id: 'final', key: 'Desc_IronPlate', type: NODE_TYPE.FINAL_PRODUCT, multiplier: 20 },
  },
  edges: [
    { key: 'Desc_OreIron', from: 'ore', to: 'ingot', productionRate: 30 },
    { key: 'Desc_IronIngot', from: 'ingot', to: 'plate', productionRate: 30 },
    { key: 'Desc_IronPlate', from: 'plate', to: 'final', productionRate: 20 },
  ],
};

describe('buildFlowModel', () => {
  it('produces one row per recipe node, sorted by name', () => {
    const model = buildFlowModel(graph, gameData);
    expect(model.recipes.map((r) => r.recipeName)).toEqual(['Iron Ingot', 'Iron Plate']);
  });

  it('maps building, count, inputs and outputs for a recipe', () => {
    const model = buildFlowModel(graph, gameData);
    const plate = model.recipes.find((r) => r.recipeKey === 'Recipe_IronPlate')!;

    expect(plate.buildingName).toBe('Constructor');
    expect(plate.buildingCount).toBe(2);

    expect(plate.inputs).toEqual([
      { itemKey: 'Desc_IronIngot', itemName: 'Iron Ingot', rate: 30, endpointKind: 'recipe', endpointLabel: 'Iron Ingot' },
    ]);
    expect(plate.outputs).toEqual([
      { itemKey: 'Desc_IronPlate', itemName: 'Iron Plate', rate: 20, endpointKind: 'final', endpointLabel: 'Iron Plate' },
    ]);
  });

  it('treats an edge between two recipes as an output of the source and input of the target', () => {
    const model = buildFlowModel(graph, gameData);
    const ingot = model.recipes.find((r) => r.recipeKey === 'Recipe_IronIngot')!;

    // raw ore in, ingot out (to the plate recipe)
    expect(ingot.inputs).toEqual([
      { itemKey: 'Desc_OreIron', itemName: 'Iron Ore', rate: 30, endpointKind: 'raw', endpointLabel: 'Iron Ore' },
    ]);
    expect(ingot.outputs).toEqual([
      { itemKey: 'Desc_IronIngot', itemName: 'Iron Ingot', rate: 30, endpointKind: 'recipe', endpointLabel: 'Iron Plate' },
    ]);
  });

  it('summarises raw inputs and final products from terminal item nodes', () => {
    const model = buildFlowModel(graph, gameData);
    expect(model.rawInputs).toEqual([{ itemKey: 'Desc_OreIron', itemName: 'Iron Ore', rate: 30 }]);
    expect(model.finalProducts).toEqual([{ itemKey: 'Desc_IronPlate', itemName: 'Iron Plate', rate: 20 }]);
  });

  it('ignores edges whose endpoints are missing', () => {
    const broken: ProductionGraph = {
      nodes: { ...graph.nodes },
      edges: [...graph.edges, { key: 'Desc_IronIngot', from: 'ghost', to: 'plate', productionRate: 5 }],
    };
    const model = buildFlowModel(broken, gameData);
    const plate = model.recipes.find((r) => r.recipeKey === 'Recipe_IronPlate')!;
    // the ghost edge is skipped, so the plate still has exactly its one real input
    expect(plate.inputs).toHaveLength(1);
  });
});
