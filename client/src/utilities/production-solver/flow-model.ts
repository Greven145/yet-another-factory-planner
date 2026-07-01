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

  const byItemName = (a: { itemName: string }, b: { itemName: string }) => a.itemName.localeCompare(b.itemName);
  rawInputs.sort(byItemName);
  finalProducts.sort(byItemName);

  const recipes = orderByDependency(Array.from(rows.values()), graph);

  return { recipes, rawInputs, finalProducts };
}

// Orders recipe rows so producers come before the recipes that consume them
// (raw → intermediate → final), reading top-to-bottom the way the graph flows
// left-to-right. A recipe→recipe edge means the source feeds the target. Uses
// Kahn's algorithm, tie-broken by recipe name for determinism; any recipes left
// in a cycle (loop warning) are appended by name so output is always stable.
function orderByDependency(rows: FlowRecipeRow[], graph: ProductionGraph): FlowRecipeRow[] {
  const rowById = new Map(rows.map((r) => [r.id, r]));
  const consumers = new Map<string, Set<string>>(rows.map((r) => [r.id, new Set<string>()]));
  const inDegree = new Map<string, number>(rows.map((r) => [r.id, 0]));

  for (const edge of graph.edges) {
    if (edge.from === edge.to) continue;
    if (!rowById.has(edge.from) || !rowById.has(edge.to)) continue;
    const feeds = consumers.get(edge.from)!;
    if (!feeds.has(edge.to)) {
      feeds.add(edge.to);
      inDegree.set(edge.to, inDegree.get(edge.to)! + 1);
    }
  }

  const byName = (a: FlowRecipeRow, b: FlowRecipeRow) => a.recipeName.localeCompare(b.recipeName);
  const ready = rows.filter((r) => inDegree.get(r.id) === 0).sort(byName);
  const ordered: FlowRecipeRow[] = [];
  const seen = new Set<string>();

  while (ready.length > 0) {
    const node = ready.shift()!;
    if (seen.has(node.id)) continue;
    seen.add(node.id);
    ordered.push(node);
    for (const consumerId of consumers.get(node.id)!) {
      inDegree.set(consumerId, inDegree.get(consumerId)! - 1);
      if (inDegree.get(consumerId) === 0) ready.push(rowById.get(consumerId)!);
    }
    ready.sort(byName);
  }

  if (ordered.length < rows.length) {
    ordered.push(...rows.filter((r) => !seen.has(r.id)).sort(byName));
  }
  return ordered;
}
