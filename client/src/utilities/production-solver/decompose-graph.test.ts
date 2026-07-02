import { describe, it, expect } from 'vitest';
import { decomposeGraph } from './decompose-graph';
import { NODE_TYPE, ProductionGraph } from './models';
import { GameData } from '../../contexts/gameData/types';

// Helpers for asserting over the decomposed graph.
const recipeNodes = (g: ProductionGraph) =>
  Object.values(g.nodes).filter((n) => n.type === NODE_TYPE.RECIPE);
const outEdges = (g: ProductionGraph, id: string) => g.edges.filter((e) => e.from === id);
const edgesByKey = (g: ProductionGraph, key: string) => g.edges.filter((e) => e.key === key);
const nodesWithKey = (g: ProductionGraph, key: string) =>
  Object.values(g.nodes).filter((n) => n.key === key);

describe('decomposeGraph', () => {
  it('leaves a graph unchanged when every recipe already feeds a single consumer', () => {
    // ore -> ingot -> plate -> final. No shared producers.
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
    const out = decomposeGraph(graph);
    expect(recipeNodes(out)).toHaveLength(2);
    expect(out.edges).toHaveLength(3);
  });

  it('splits a recipe that feeds two consumers into one dedicated copy each', () => {
    // ingot (3×, 90/min) feeds plate (60) and rod (30).
    const graph: ProductionGraph = {
      nodes: {
        ingot: { id: 'ingot', key: 'Recipe_IronIngot', type: NODE_TYPE.RECIPE, multiplier: 3 },
        plate: { id: 'plate', key: 'Recipe_IronPlate', type: NODE_TYPE.RECIPE, multiplier: 2 },
        rod: { id: 'rod', key: 'Recipe_IronRod', type: NODE_TYPE.RECIPE, multiplier: 1 },
      },
      edges: [
        { key: 'Desc_IronIngot', from: 'ingot', to: 'plate', productionRate: 60 },
        { key: 'Desc_IronIngot', from: 'ingot', to: 'rod', productionRate: 30 },
      ],
    };
    const out = decomposeGraph(graph);

    const ingotCopies = nodesWithKey(out, 'Recipe_IronIngot');
    expect(ingotCopies).toHaveLength(2);
    // Multipliers split proportionally to output share: 3 × 60/90 and 3 × 30/90.
    expect(ingotCopies.map((n) => n.multiplier).sort((a, b) => a - b)).toEqual([1, 2]);
    // Every ingot copy now feeds exactly one consumer.
    for (const copy of ingotCopies) {
      expect(outEdges(out, copy.id)).toHaveLength(1);
    }
  });

  it('cascades the split upstream so shared intermediates are duplicated per path', () => {
    // ore -> ingot -> {plate, rod}. Splitting ingot must also duplicate ore's edge,
    // and ore's ingredient flow to each ingot copy scales proportionally.
    const graph: ProductionGraph = {
      nodes: {
        ore: { id: 'ore', key: 'Desc_OreIron', type: NODE_TYPE.RESOURCE, multiplier: 90 },
        ingot: { id: 'ingot', key: 'Recipe_IronIngot', type: NODE_TYPE.RECIPE, multiplier: 3 },
        plate: { id: 'plate', key: 'Recipe_IronPlate', type: NODE_TYPE.RECIPE, multiplier: 2 },
        rod: { id: 'rod', key: 'Recipe_IronRod', type: NODE_TYPE.RECIPE, multiplier: 1 },
      },
      edges: [
        { key: 'Desc_OreIron', from: 'ore', to: 'ingot', productionRate: 90 },
        { key: 'Desc_IronIngot', from: 'ingot', to: 'plate', productionRate: 60 },
        { key: 'Desc_IronIngot', from: 'ingot', to: 'rod', productionRate: 30 },
      ],
    };
    const out = decomposeGraph(graph);

    // ore is a resource terminal — never duplicated — but now feeds two ingot copies.
    expect(nodesWithKey(out, 'Desc_OreIron')).toHaveLength(1);
    const oreEdges = outEdges(out, 'ore');
    expect(oreEdges).toHaveLength(2);
    expect(oreEdges.map((e) => e.productionRate).sort((a, b) => a - b)).toEqual([30, 60]);
  });

  it('leaves a byproduct recipe whole when its primary product feeds a single consumer', () => {
    // Main product (Fuel) → one consumer; byproduct (Resin) → another. The primary
    // product isn't shared, so there's nothing to dedicate — the node stays whole.
    const graph: ProductionGraph = {
      nodes: {
        refinery: { id: 'refinery', key: 'Recipe_Fuel', type: NODE_TYPE.RECIPE, multiplier: 1 },
        a: { id: 'a', key: 'Recipe_A', type: NODE_TYPE.RECIPE, multiplier: 1 },
        b: { id: 'b', key: 'Recipe_B', type: NODE_TYPE.RECIPE, multiplier: 1 },
      },
      edges: [
        { key: 'Desc_Fuel', from: 'refinery', to: 'a', productionRate: 40 },
        { key: 'Desc_PolymerResin', from: 'refinery', to: 'b', productionRate: 20 },
      ],
    };
    const out = decomposeGraph(graph);
    expect(nodesWithKey(out, 'Recipe_Fuel')).toHaveLength(1);
    expect(outEdges(out, 'refinery')).toHaveLength(2);
  });

  it('splits a byproduct recipe by its primary product, carrying the byproduct proportionally', () => {
    // Base-Rubber shape: Rubber (primary, 2 consumers) + Heavy Oil Residue (byproduct,
    // 1 consumer). gameData lists Rubber first, so it's the split axis.
    const gameData = {
      recipes: {
        Recipe_Rubber: { products: [{ itemClass: 'Desc_Rubber' }, { itemClass: 'Desc_HeavyOilResidue' }] },
      },
    } as unknown as GameData;
    const graph: ProductionGraph = {
      nodes: {
        rubber: { id: 'rubber', key: 'Recipe_Rubber', type: NODE_TYPE.RECIPE, multiplier: 4 },
        tire: { id: 'tire', key: 'Recipe_Tire', type: NODE_TYPE.RECIPE, multiplier: 1 },
        plate: { id: 'plate', key: 'Recipe_Plate', type: NODE_TYPE.RECIPE, multiplier: 1 },
        fuel: { id: 'fuel', key: 'Recipe_Fuel', type: NODE_TYPE.RECIPE, multiplier: 1 },
      },
      edges: [
        { key: 'Desc_Rubber', from: 'rubber', to: 'tire', productionRate: 60 },
        { key: 'Desc_Rubber', from: 'rubber', to: 'plate', productionRate: 20 },
        { key: 'Desc_HeavyOilResidue', from: 'rubber', to: 'fuel', productionRate: 80 },
      ],
    };
    const out = decomposeGraph(graph, gameData);

    // Rubber node splits per primary (Rubber) consumer: 4 × 60/80 and 4 × 20/80.
    const copies = nodesWithKey(out, 'Recipe_Rubber');
    expect(copies).toHaveLength(2);
    expect(copies.map((n) => n.multiplier).sort((a, b) => a - b)).toEqual([1, 3]);
    // Each copy feeds exactly one Rubber consumer.
    for (const copy of copies) {
      expect(outEdges(out, copy.id).filter((e) => e.key === 'Desc_Rubber')).toHaveLength(1);
    }
    // The byproduct is carried by each copy, split proportionally, conserving the total.
    const residueEdges = edgesByKey(out, 'Desc_HeavyOilResidue');
    expect(residueEdges).toHaveLength(2);
    expect(residueEdges.reduce((s, e) => s + e.productionRate, 0)).toBeCloseTo(80);
  });

  it('does not throw and returns every recipe when the graph contains a cycle', () => {
    const graph: ProductionGraph = {
      nodes: {
        a: { id: 'a', key: 'Recipe_A', type: NODE_TYPE.RECIPE, multiplier: 1 },
        b: { id: 'b', key: 'Recipe_B', type: NODE_TYPE.RECIPE, multiplier: 1 },
      },
      edges: [
        { key: 'Desc_X', from: 'a', to: 'b', productionRate: 10 },
        { key: 'Desc_Y', from: 'b', to: 'a', productionRate: 10 },
      ],
    };
    const out = decomposeGraph(graph);
    expect(nodesWithKey(out, 'Recipe_A')).toHaveLength(1);
    expect(nodesWithKey(out, 'Recipe_B')).toHaveLength(1);
  });

  it('does not mutate the input graph', () => {
    const graph: ProductionGraph = {
      nodes: {
        ingot: { id: 'ingot', key: 'Recipe_IronIngot', type: NODE_TYPE.RECIPE, multiplier: 3 },
        plate: { id: 'plate', key: 'Recipe_IronPlate', type: NODE_TYPE.RECIPE, multiplier: 2 },
        rod: { id: 'rod', key: 'Recipe_IronRod', type: NODE_TYPE.RECIPE, multiplier: 1 },
      },
      edges: [
        { key: 'Desc_IronIngot', from: 'ingot', to: 'plate', productionRate: 60 },
        { key: 'Desc_IronIngot', from: 'ingot', to: 'rod', productionRate: 30 },
      ],
    };
    const edgeCountBefore = graph.edges.length;
    const nodeCountBefore = Object.keys(graph.nodes).length;
    decomposeGraph(graph);
    expect(graph.edges).toHaveLength(edgeCountBefore);
    expect(Object.keys(graph.nodes)).toHaveLength(nodeCountBefore);
  });
});
