import { GameData } from '../../contexts/gameData/types';
import { GraphEdge, GraphNode, NODE_TYPE, ProductionGraph } from './models';

// "Dedicated lines" (balancer) view — issue TBD.
//
// The solved graph aggregates each recipe into a single node whose output can fan
// out to several consumers (one recipe→consumer edge per consumer). This transform
// decomposes that into dedicated production lines: every recipe node is duplicated
// so it feeds exactly ONE consumer of its primary product, and its ingredient demand
// is split proportionally across the copies. Because we process consumers before
// producers, the split cascades all the way upstream — a shared intermediate like
// iron ingot is duplicated per downstream path.
//
// Byproduct recipes (a node whose recipe emits a main product plus a byproduct, e.g.
// base Rubber → Rubber + Heavy Oil Residue): a single machine physically produces
// both outputs at once, so it cannot be dedicated to one consumer outright. We split
// it by its PRIMARY product (the recipe's first-listed product) and carry each copy's
// byproduct output onward, scaled to that copy's share. Each copy then feeds one
// primary consumer plus a proportional slice of every byproduct — the honest best a
// dedicated line can do for a co-product recipe.
//
// Purely a post-processing view over `ProductionGraph`; the LP solve is untouched.
// Recipe copies carry fractional multipliers (e.g. 1.8× / 1.2×), shown as-is.

export function decomposeGraph(graph: ProductionGraph, gameData?: GameData): ProductionGraph {
  const nodes: { [id: string]: GraphNode } = {};
  for (const node of Object.values(graph.nodes)) {
    nodes[node.id] = { ...node };
  }
  let edges: GraphEdge[] = graph.edges.map((e) => ({ ...e }));

  const recipeIds = Object.values(nodes)
    .filter((n) => n.type === NODE_TYPE.RECIPE)
    .map((n) => n.id);

  let cloneCounter = 0;
  for (const nodeId of consumersFirstOrder(recipeIds, edges)) {
    const node = nodes[nodeId];
    if (!node || node.type !== NODE_TYPE.RECIPE) continue;

    const outEdges = edges.filter((e) => e.from === nodeId);
    if (outEdges.length <= 1) continue;

    // Split by the recipe's primary product; other products ride along as byproducts.
    const primaryKey = primaryProduct(node.key, outEdges, gameData);
    const primaryEdges = outEdges.filter((e) => e.key === primaryKey);
    if (primaryEdges.length <= 1) continue; // primary already feeds a single consumer

    const totalPrimary = primaryEdges.reduce((sum, e) => sum + e.productionRate, 0);
    if (totalPrimary <= 0) continue;

    const byproductEdges = outEdges.filter((e) => e.key !== primaryKey);
    const inEdges = edges.filter((e) => e.to === nodeId);

    // Drop the original node plus its in/out edges; re-emit a dedicated copy per
    // primary-product consumer with proportionally scaled ingredients and byproducts.
    const touched = new Set<GraphEdge>([...outEdges, ...inEdges]);
    edges = edges.filter((e) => !touched.has(e));
    delete nodes[nodeId];

    for (const primaryEdge of primaryEdges) {
      const fraction = primaryEdge.productionRate / totalPrimary;
      const cloneId = `${nodeId}::c${cloneCounter++}`;
      nodes[cloneId] = { ...node, id: cloneId, multiplier: node.multiplier * fraction };
      edges.push({ ...primaryEdge, from: cloneId });
      for (const inEdge of inEdges) {
        edges.push({ ...inEdge, to: cloneId, productionRate: inEdge.productionRate * fraction });
      }
      for (const byproductEdge of byproductEdges) {
        edges.push({ ...byproductEdge, from: cloneId, productionRate: byproductEdge.productionRate * fraction });
      }
    }
  }

  return { nodes, edges };
}

// Chooses the product to split a recipe node on. Prefers the recipe's first-listed
// product (the game's convention for a recipe's main output, byproducts follow), and
// falls back — when game data is unavailable or the listed product isn't present as an
// edge — to the highest-throughput output, tie-broken by item key for determinism.
function primaryProduct(recipeKey: string, outEdges: GraphEdge[], gameData?: GameData): string {
  const presentKeys = new Set(outEdges.map((e) => e.key));

  const listed = gameData?.recipes?.[recipeKey]?.products?.[0]?.itemClass;
  if (listed && presentKeys.has(listed)) return listed;

  const rateByKey = new Map<string, number>();
  for (const edge of outEdges) {
    rateByKey.set(edge.key, (rateByKey.get(edge.key) ?? 0) + edge.productionRate);
  }
  return [...rateByKey.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];
}

// Orders recipe nodes so every recipe is processed AFTER all the recipes it feeds
// (consumers first). Splitting a node then adds scaled edges to its upstream
// producers, which are processed later and split in turn — cascading the
// decomposition to the source. Kahn's algorithm over recipe→recipe edges, peeling
// from the sink side (out-degree 0); nodes left in a cycle are appended in a stable
// order so a looping plan still produces a deterministic result.
function consumersFirstOrder(recipeIds: string[], edges: GraphEdge[]): string[] {
  const recipeSet = new Set(recipeIds);
  const recipeConsumers = new Map<string, Set<string>>(recipeIds.map((id) => [id, new Set<string>()]));
  const recipeProducers = new Map<string, Set<string>>(recipeIds.map((id) => [id, new Set<string>()]));

  for (const edge of edges) {
    if (edge.from === edge.to) continue;
    if (!recipeSet.has(edge.from) || !recipeSet.has(edge.to)) continue;
    recipeConsumers.get(edge.from)!.add(edge.to);
    recipeProducers.get(edge.to)!.add(edge.from);
  }

  const outDegree = new Map<string, number>(recipeIds.map((id) => [id, recipeConsumers.get(id)!.size]));
  const ready = recipeIds.filter((id) => outDegree.get(id) === 0).sort();
  const order: string[] = [];
  const seen = new Set<string>();

  while (ready.length > 0) {
    const id = ready.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    order.push(id);
    for (const producer of recipeProducers.get(id)!) {
      outDegree.set(producer, outDegree.get(producer)! - 1);
      if (outDegree.get(producer) === 0) ready.push(producer);
    }
    ready.sort();
  }

  if (order.length < recipeIds.length) {
    order.push(...recipeIds.filter((id) => !seen.has(id)).sort());
  }
  return order;
}
