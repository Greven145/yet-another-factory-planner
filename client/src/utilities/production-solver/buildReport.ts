import { ItemRate } from '../../contexts/gameData/types';
import { NODE_TYPE, ProducedItemInformation, ProductionGraph, Report } from './models';
import { ReportContext, getItemPoints } from './internals';
import { buildVariant, sloopSlotsFor } from './amplification';

// Pure computation of the production report (power breakdown, build area, foundations,
// buildings used, material costs, raw resources, items-per-step recap, loop warning)
// from an assembled production graph. Behavior is identical to the former
// ProductionSolver.generateProductionReport method.
export function buildReport(productionGraph: ProductionGraph, context: ReportContext): Report {
  const { gameData, inputs, availableSloops, availableShards } = context;
  const report: Report = {
    pointsProduced: 0,
    powerUsageEstimate: {
      production: 0,
      extraction: 0,
      generators: 0,
      total: 0,
    },
    resourceEfficiencyScore: 0,
    totalBuildArea: 0,
    estimatedFoundations: 0,
    buildingsUsed: {},
    totalMaterialCost: {},
    totalRawResources: {},
    totalItemsRecap: [],
    loopWarning: false,
    amplification: {
      sloopsUsed: 0,
      sloopsAvailable: availableSloops,
      shardsUsed: 0,
      shardsAvailable: availableShards,
    },
  };

  report.totalItemsRecap = generateItemsPerStep(productionGraph, gameData);

  for (const [key, node] of Object.entries(productionGraph.nodes)) {
    if (gameData.resources[node.key])
    {
      report.totalRawResources[gameData.items[node.key].name] = node.multiplier;
    }
    if (node.type === NODE_TYPE.RECIPE) {
      // node.key is the base recipe (the map key may be a boost-variant key); the variant
      // scales power and tallies the somersloops/power shards this node consumes.
      const recipeInfo = gameData.recipes[node.key];
      const buildingKey = recipeInfo.producedIn;
      const buildingInfo = gameData.buildings[buildingKey];
      const variant = buildVariant(node.suffix ?? '', sloopSlotsFor(buildingKey));
      // Somersloops and power shards are placed in whole machines, so the real requirement
      // is per-machine slots x the (rounded-up) machine count — never a fraction. This matches
      // how buildingsUsed.count and material costs round up below.
      const machineCount = Math.ceil(node.multiplier);
      report.amplification.sloopsUsed += machineCount * variant.sloops;
      report.amplification.shardsUsed += machineCount * variant.shards;
      const power = node.multiplier * buildingInfo.power * variant.powerMult;
      if (power < 0) {
        report.powerUsageEstimate.generators += -power;
      } else {
        report.powerUsageEstimate.production += power;
      }
      report.powerUsageEstimate.total += power;
      report.totalBuildArea += Math.ceil(node.multiplier) * buildingInfo.area;
      if (!report.buildingsUsed[buildingKey]) {
        report.buildingsUsed[buildingKey] = {
          count: Math.ceil(node.multiplier),
          materialCost: {},
        };
      } else {
        report.buildingsUsed[buildingKey].count += Math.ceil(node.multiplier);
      }

      for (const ingredient of buildingInfo.buildCost) {
        const amount = Math.ceil(node.multiplier) * ingredient.quantity;
        if (!report.buildingsUsed[buildingKey].materialCost[ingredient.itemClass]) {
          report.buildingsUsed[buildingKey].materialCost[ingredient.itemClass] = amount;
        } else {
          report.buildingsUsed[buildingKey].materialCost[ingredient.itemClass] += amount;
        }
        if (!report.totalMaterialCost[ingredient.itemClass]) {
          report.totalMaterialCost[ingredient.itemClass] = amount;
        } else {
          report.totalMaterialCost[ingredient.itemClass] += amount;
        }
      }
      continue;
    }

    if (node.type === NODE_TYPE.FINAL_PRODUCT) {
      report.pointsProduced += node.multiplier * getItemPoints(gameData, key);
    } else if (node.type === NODE_TYPE.RESOURCE) {
      report.resourceEfficiencyScore += node.multiplier * inputs[key].weight;
      let power = 0;
      if (key === 'Desc_Water_C') {
        power = node.multiplier / 120 * gameData.buildings['Desc_WaterPump_C'].power;

        const numExtractors = Math.ceil(node.multiplier / 120);
        report.buildingsUsed['Desc_WaterPump_C'] = {
          count: numExtractors,
          materialCost: {},
        };
        for (const ingredient of gameData.buildings['Desc_WaterPump_C'].buildCost) {
          const amount = numExtractors * ingredient.quantity;
          report.buildingsUsed['Desc_WaterPump_C'].materialCost[ingredient.itemClass] = amount;
          if (!report.totalMaterialCost[ingredient.itemClass]) {
            report.totalMaterialCost[ingredient.itemClass] = amount;
          } else {
            report.totalMaterialCost[ingredient.itemClass] += amount;
          }
        }

      } else if (key === 'Desc_LiquidOil_C') {
        power = node.multiplier / 120 * gameData.buildings['Desc_OilPump_C'].power;
      } else if (key === 'Desc_NitrogenGas_C') {
        // SKIP
      } else {
        power = node.multiplier / 240 * gameData.buildings['Desc_MinerMk3_C'].power;
      }
      report.powerUsageEstimate.extraction += power;
      report.powerUsageEstimate.total += power;
    }
  }

  report.estimatedFoundations = Math.ceil(2 * (report.totalBuildArea / 64));

  report.loopWarning = hasLoop(productionGraph);

  return report;
}

//Sort all items/resources involved in the factory by the MINIMUM number of steps needed to produce them in the chain
function generateItemsPerStep(productionGraph: ProductionGraph, gameData: ReportContext['gameData']): ProducedItemInformation[] {
  let itemsList = [] as ProducedItemInformation[];
  let step = 1;
  let nodes = productionGraph.nodes;
  let keys = Object.keys(nodes);
  let usedKeys = [] as string[];

  //We only need raw resources and recipes, remove final products and side products
  keys = keys.filter((key) => nodes[key].type === 'RESOURCE' || nodes[key].type === 'RECIPE');

  //First get all the items used and produced
  for (var edge of productionGraph.edges){
    AddItemAndAmountToItemList(itemsList, edge.key, edge.productionRate, step, gameData);
  }

  //Preload raw resources since no recipe produces them
  for (var key of keys){
    if (gameData.resources[key])
    {
      usedKeys.push(key);
    }
  }

  keys = keys.filter((key) => !usedKeys.includes(key));
  //We use this to keep the currently worked on recipes out of the current loop
  //Otherwise we can have cases where a recipe we just added to the current step contributes
  //to another recipe that should have been in the next step
  let loopKeys = [] as string[];

  let ingredientKeyFilter = (ingredient:ItemRate) => usedKeys.includes(ingredient.itemClass);
  let unusedKeyFilter = (key:string) => !usedKeys.includes(key);

  while (keys.length > 0){
    for (key of keys){
      // `key` is the node map key, which may be a boost-variant key; the underlying recipe
      // (same ingredients/products) is found via the node's base recipe key.
      const recipe = gameData.recipes[nodes[key].key];
      const applicableIngredientsAmount = recipe.ingredients.filter(ingredientKeyFilter).length;
      if (applicableIngredientsAmount === recipe.ingredients.length){
        for (var product of recipe.products){
          if (!gameData.resources[product.itemClass])
          {
            UpdateStepInItemList(itemsList, product.itemClass, step+1);
          }
          if (!loopKeys.includes(product.itemClass)){
            loopKeys.push(product.itemClass);
          }
        }
        loopKeys.push(key);
      }
    }

    if ( usedKeys.length < loopKeys.length ||
         !usedKeys.slice(-loopKeys.length).every((key, index) => key === loopKeys[index] )) {
      usedKeys = [...usedKeys, ...loopKeys];
      keys = keys.filter(unusedKeyFilter);
      step++;
    } else {
      keys = [];
    }
  }

  return itemsList;
}

function AddItemAndAmountToItemList(itemsList: ProducedItemInformation[], key: string, amount: number, step: number, gameData: ReportContext['gameData']) {
  let existingItems = itemsList.filter(item => item.key === key);
  if (existingItems && existingItems.length > 0){
    existingItems[0].amount += amount;
  }
  else {
    itemsList.push({
      key: key,
      amount: amount,
      name: gameData.items[key].name,
      step: step
    });
  }
}

function UpdateStepInItemList(itemsList: ProducedItemInformation[], key: string, step: number){
  let item = itemsList.find(item => item.key === key);
  if (item){
    item.step = step;
  }
}

function hasLoop(productionGraph: ProductionGraph): boolean {
  const adjacency = new Map<string, string[]>();
  for (const edge of productionGraph.edges) {
    if (!adjacency.has(edge.from)) adjacency.set(edge.from, []);
    adjacency.get(edge.from)!.push(edge.to);
  }

  const visited = new Set<string>();
  const stack = new Set<string>();

  function dfs(node: string): boolean {
    visited.add(node);
    stack.add(node);

    for (const edge of (adjacency.get(node) ?? [])) {
      if ( stack.has(edge) ) {
        return true;
      } else if (!visited.has(edge)) {
        if ( dfs(edge) ) {
          return true;
        }
      }
    }

    stack.delete(node);
    return false;
  }

  for (const node of Object.keys(productionGraph.nodes).map((k) => productionGraph.nodes[k])) {
    if (!visited.has(node.id)) {
      if (dfs(node.id)) {
        return true;
      }
    }
  }

  return false;
}
