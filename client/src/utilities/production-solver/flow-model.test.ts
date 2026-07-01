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
  it('produces one row per recipe node, in dependency order (producers first)', () => {
    const model = buildFlowModel(graph, gameData);
    expect(model.recipes.map((r) => r.recipeName)).toEqual(['Iron Ingot', 'Iron Plate']);
  });

  it('orders producers before consumers even when that contradicts alphabetical order', () => {
    // "Zzz Ingot" feeds "Aaa Plate": dependency order must put Zzz first despite the name.
    const gd = {
      buildings: { B: { name: 'Building' } },
      recipes: {
        Recipe_Z: { name: 'Zzz Ingot', producedIn: 'B' },
        Recipe_A: { name: 'Aaa Plate', producedIn: 'B' },
      },
      items: { Desc_Mid: { name: 'Mid' } },
    } as unknown as GameData;
    const g: ProductionGraph = {
      nodes: {
        z: { id: 'z', key: 'Recipe_Z', type: NODE_TYPE.RECIPE, multiplier: 1 },
        a: { id: 'a', key: 'Recipe_A', type: NODE_TYPE.RECIPE, multiplier: 1 },
      },
      edges: [{ key: 'Desc_Mid', from: 'z', to: 'a', productionRate: 10 }],
    };
    expect(buildFlowModel(g, gd).recipes.map((r) => r.recipeName)).toEqual(['Zzz Ingot', 'Aaa Plate']);
  });

  it('still returns every recipe when the graph contains a cycle', () => {
    // a → b → a (loop). No recipe has in-degree 0; all must still appear.
    const gd = {
      buildings: { B: { name: 'Building' } },
      recipes: {
        Recipe_A: { name: 'A', producedIn: 'B' },
        Recipe_B: { name: 'B', producedIn: 'B' },
      },
      items: { Desc_X: { name: 'X' }, Desc_Y: { name: 'Y' } },
    } as unknown as GameData;
    const g: ProductionGraph = {
      nodes: {
        a: { id: 'a', key: 'Recipe_A', type: NODE_TYPE.RECIPE, multiplier: 1 },
        b: { id: 'b', key: 'Recipe_B', type: NODE_TYPE.RECIPE, multiplier: 1 },
      },
      edges: [
        { key: 'Desc_X', from: 'a', to: 'b', productionRate: 1 },
        { key: 'Desc_Y', from: 'b', to: 'a', productionRate: 1 },
      ],
    };
    expect(buildFlowModel(g, gd).recipes.map((r) => r.recipeName).sort()).toEqual(['A', 'B']);
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
