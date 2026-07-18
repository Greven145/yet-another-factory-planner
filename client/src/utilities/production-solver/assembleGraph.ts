import { NODE_TYPE, ProductionGraph } from './models';
import {
  EPSILON,
  RESIDUAL_BALANCE_TOLERANCE,
  GraphContext,
  ItemProductionTotals,
  ProductionSolution,
  getItemPoints,
} from './internals';
import { buildVariant, parseVariantKey, sloopSlotsFor } from './amplification';

// Pure assembly of a production graph from a solver solution. Builds recipe nodes,
// item nodes (final products, side products, inputs, resources), and the edges that
// connect production to consumption. Behavior is identical to the former
// ProductionSolver.generateProductionGraph method.
export function assembleGraph(
  productionSolution: ProductionSolution,
  context: GraphContext,
): ProductionGraph {
  const { gameData, inputs, rateTargets, maximizeTargets, hasPointsTarget } = context;
  const itemProductionTotals: ItemProductionTotals = {};
  const graph: ProductionGraph = {
    nodes: {},
    edges: [],
  };

  for (const [recipeKey, multiplier] of Object.entries(productionSolution)) {
    // recipeKey may be a boost-variant key (e.g. "Recipe_X_C::AMP"); resolve to the base
    // recipe and the variant multipliers. producedBy/usedBy are keyed by the variant key so
    // each variant is its own graph node, while node.key stays the base recipe for lookups.
    const { baseRecipeKey, suffix } = parseVariantKey(recipeKey);
    const recipeInfo = gameData.recipes[baseRecipeKey];
    const variant = buildVariant(suffix, sloopSlotsFor(recipeInfo.producedIn));

    for (const product of recipeInfo.products) {
      const amount = multiplier * product.perMinute * variant.outputMult;
      if (!itemProductionTotals[product.itemClass]) {
        itemProductionTotals[product.itemClass] = {
          producedBy: [],
          usedBy: [],
        };
      }
      itemProductionTotals[product.itemClass].producedBy.push({ recipeKey, amount });
    }

    for (const ingredient of recipeInfo.ingredients) {
      const amount = multiplier * ingredient.perMinute * variant.inputMult;
      if (!itemProductionTotals[ingredient.itemClass]) {
        itemProductionTotals[ingredient.itemClass] = {
          producedBy: [],
          usedBy: [],
        };
      }
      itemProductionTotals[ingredient.itemClass].usedBy.push({ recipeKey, amount });
    }

    graph.nodes[recipeKey] = {
      id: recipeKey,
      key: baseRecipeKey,
      type: NODE_TYPE.RECIPE,
      multiplier,
      // Only boosted nodes carry a suffix; base nodes stay identical to the un-boosted shape.
      ...(suffix ? { suffix } : {}),
    };
  }

  for (const [itemKey, productionTotals] of Object.entries(itemProductionTotals)) {
    const { producedBy, usedBy } = productionTotals;
    // A near-balanced intermediate (produced ≈ consumed) leaves a tiny residual after matching
    // because the LP solution is only balanced to ~1e-6 relative precision. Emitting that as a
    // side product spawns a phantom "0.00" node, so cull leftovers that are negligible relative
    // to the item's total production. (Absolute EPSILON alone is far too loose for large flows.)
    const totalProduced = producedBy.reduce((sum, p) => sum + p.amount, 0);
    const sideProductThreshold = Math.max(EPSILON, totalProduced * RESIDUAL_BALANCE_TOLERANCE);
    let i = 0, j = 0;
    nextDemand:
    while (i < usedBy.length) {
      const usageInfo = usedBy[i];
      const usageNode = graph.nodes[usageInfo.recipeKey];

      while (j < producedBy.length) {
        const productionInfo = producedBy[j];
        const productionNode = graph.nodes[productionInfo.recipeKey];

        const outputRecipe = rateTargets[itemKey]?.recipe;
        if (outputRecipe && outputRecipe === productionInfo.recipeKey) {
          const outputInfo = rateTargets[itemKey];
          const recipeInfo = gameData.recipes[outputRecipe];
          const target = recipeInfo.products.find((p) => p.itemClass === itemKey)!;
          const recipeAmount = outputInfo.value * target.perMinute;
          productionInfo.amount -= recipeAmount;

          let itemNode = graph.nodes[itemKey];
          if (!itemNode) {
            itemNode = {
              id: itemKey,
              key: itemKey,
              type: NODE_TYPE.FINAL_PRODUCT,
              multiplier: recipeAmount,
            }
            graph.nodes[itemKey] = itemNode;
          } else {
            graph.nodes[itemKey].multiplier += recipeAmount;
          }
          graph.edges.push({
            key: itemKey,
            from: productionNode.id,
            to: itemNode.id,
            productionRate: recipeAmount,
          });
        }

        if (productionInfo.amount < EPSILON) {
          j++
          continue;
        }

        if (usageInfo.amount <= productionInfo.amount) {
          graph.edges.push({
            key: itemKey,
            from: productionNode.id,
            to: usageNode.id,
            productionRate: usageInfo.amount,
          });
          productionInfo.amount -= usageInfo.amount;
          usageInfo.amount = 0;
        } else {
          graph.edges.push({
            key: itemKey,
            from: productionNode.id,
            to: usageNode.id,
            productionRate: productionInfo.amount,
          });
          usageInfo.amount -= productionInfo.amount;
          productionInfo.amount = 0;
        }

        if (usageInfo.amount < EPSILON) {
          i++;
          continue nextDemand;
        }
        j++;
      }
      break;
    }

    while (i < usedBy.length) {
      const usageInfo = usedBy[i];
      const usageNode = graph.nodes[usageInfo.recipeKey];
      if (usageInfo.amount > EPSILON && inputs[itemKey]) {
        let itemNode = graph.nodes[itemKey];
        if (!itemNode) {
          const inputInfo = inputs[itemKey];
          itemNode = {
            id: itemKey,
            key: itemKey,
            type: inputInfo.type,
            multiplier: usageInfo.amount,
          };
          graph.nodes[itemKey] = itemNode;
        } else {
          itemNode.multiplier += usageInfo.amount;
        }
        graph.edges.push({
          key: itemKey,
          from: itemNode.id,
          to: usageNode.id,
          productionRate: usageInfo.amount,
        });
        usageInfo.amount = 0;
      }
      i++;
    }

    while (j < producedBy.length) {
      const productionInfo = producedBy[j];
      const productionNode = graph.nodes[productionInfo.recipeKey];
      if (productionInfo.amount > sideProductThreshold) {
        let itemNode = graph.nodes[itemKey];
        if (!itemNode) {
          let nodeType = NODE_TYPE.SIDE_PRODUCT;
          if (rateTargets[itemKey] || maximizeTargets.find((t) => t.key === itemKey)) {
            nodeType = NODE_TYPE.FINAL_PRODUCT;
          } else if (hasPointsTarget && getItemPoints(gameData, itemKey) > 0) {
            nodeType = NODE_TYPE.FINAL_PRODUCT;
          }
          itemNode = {
            id: itemKey,
            key: itemKey,
            type: nodeType,
            multiplier: productionInfo.amount
          };
          graph.nodes[itemKey] = itemNode;
        } else {
          itemNode.multiplier += productionInfo.amount;
        }
        graph.edges.push({
          key: itemKey,
          from: productionNode.id,
          to: itemNode.id,
          productionRate: productionInfo.amount,
        });
        productionInfo.amount = 0;
      }
      j++;
    }
  }

  return graph;
}
