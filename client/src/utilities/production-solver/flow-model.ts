import { GameData } from '../../contexts/gameData/types';
import { GraphNode, NODE_TYPE, ProductionGraph } from './models';

// An accessible, DOM-friendly view-model of the production graph (issue #92, ADR 0002).
// Derived purely from `ProductionGraph` (nodes + edges) so the Flow tab can render a
// non-canvas, screen-reader-navigable equivalent of the Cytoscape graph.

export type FlowEndpointKind = 'recipe' | 'raw' | 'final' | 'side' | 'item';

// One side of an item flowing into or out of a recipe, plus the node on the other end.
export type FlowConnection = {
  itemKey: string,
  itemName: string,
  rate: number,
  endpointKind: FlowEndpointKind,
  endpointLabel: string,
};

// One row of the Flow table: a recipe node, its building, and its item flows.
export type FlowRecipeRow = {
  id: string,
  recipeKey: string,
  recipeName: string,
  buildingKey: string,
  buildingName: string,
  buildingCount: number,
  inputs: FlowConnection[],
  outputs: FlowConnection[],
};

// A terminal item node (a raw input the plan consumes, or a final product it yields).
export type FlowTerminal = {
  itemKey: string,
  itemName: string,
  rate: number,
};

export type FlowModel = {
  recipes: FlowRecipeRow[],
  rawInputs: FlowTerminal[],
  finalProducts: FlowTerminal[],
};

const RAW_NODE_TYPES = new Set<string>([
  NODE_TYPE.RESOURCE,
  NODE_TYPE.INPUT_ITEM,
  NODE_TYPE.HAND_GATHERED_RESOURCE,
]);

function endpointKind(node: GraphNode): FlowEndpointKind {
  if (node.type === NODE_TYPE.RECIPE) return 'recipe';
  if (node.type === NODE_TYPE.FINAL_PRODUCT) return 'final';
  if (node.type === NODE_TYPE.SIDE_PRODUCT) return 'side';
  if (RAW_NODE_TYPES.has(node.type)) return 'raw';
  return 'item';
}

function endpointLabel(node: GraphNode, gameData: GameData): string {
  if (node.type === NODE_TYPE.RECIPE) {
    return gameData.recipes[node.key]?.name ?? node.key;
  }
  return gameData.items[node.key]?.name ?? node.key;
}

function itemName(itemKey: string, gameData: GameData): string {
  return gameData.items[itemKey]?.name ?? itemKey;
}

// Builds the Flow view-model. Each recipe node becomes a row; every edge touching a
// recipe node is attached as an output of its source recipe and/or an input of its
// target recipe. Terminal item nodes (raw inputs / final products) are summarised
// separately so the table has clear "from raw" / "to final" anchors.
export function buildFlowModel(graph: ProductionGraph, gameData: GameData): FlowModel {
  const rows = new Map<string, FlowRecipeRow>();
  const rawInputs: FlowTerminal[] = [];
  const finalProducts: FlowTerminal[] = [];

  for (const node of Object.values(graph.nodes)) {
    if (node.type === NODE_TYPE.RECIPE) {
      const recipe = gameData.recipes[node.key];
      const buildingKey = recipe?.producedIn ?? '';
      rows.set(node.id, {
        id: node.id,
        recipeKey: node.key,
        recipeName: recipe?.name ?? node.key,
        buildingKey,
        buildingName: gameData.buildings[buildingKey]?.name ?? buildingKey,
        buildingCount: node.multiplier,
        inputs: [],
        outputs: [],
      });
    } else if (RAW_NODE_TYPES.has(node.type)) {
      rawInputs.push({ itemKey: node.key, itemName: itemName(node.key, gameData), rate: node.multiplier });
    } else if (node.type === NODE_TYPE.FINAL_PRODUCT) {
      finalProducts.push({ itemKey: node.key, itemName: itemName(node.key, gameData), rate: node.multiplier });
    }
  }

  for (const edge of graph.edges) {
    const fromNode = graph.nodes[edge.from];
    const toNode = graph.nodes[edge.to];
    if (!fromNode || !toNode) continue;

    const name = itemName(edge.key, gameData);

    const sourceRow = rows.get(edge.from);
    if (sourceRow) {
      sourceRow.outputs.push({
        itemKey: edge.key,
        itemName: name,
        rate: edge.productionRate,
        endpointKind: endpointKind(toNode),
        endpointLabel: endpointLabel(toNode, gameData),
      });
    }

    const targetRow = rows.get(edge.to);
    if (targetRow) {
      targetRow.inputs.push({
        itemKey: edge.key,
        itemName: name,
        rate: edge.productionRate,
        endpointKind: endpointKind(fromNode),
        endpointLabel: endpointLabel(fromNode, gameData),
      });
    }
  }

  const byName = (a: { itemName: string }, b: { itemName: string }) => a.itemName.localeCompare(b.itemName);
  rawInputs.sort(byName);
  finalProducts.sort(byName);

  const recipes = Array.from(rows.values()).sort((a, b) => a.recipeName.localeCompare(b.recipeName));

  return { recipes, rawInputs, finalProducts };
}
