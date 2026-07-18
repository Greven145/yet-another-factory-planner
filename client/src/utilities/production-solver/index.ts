import loadGLPK, { GLPK, LP, Var } from 'glpk.js';
import { FactoryOptions, RecipeSelectionMap } from '../../contexts/production/types';
import { MaximizeBalanceMode } from '../../contexts/production/consts';
import { GameData } from '../../contexts/gameData/types';
import { GraphError } from '../error/GraphError';
import {
  NODE_TYPE,
  POINTS_ITEM_KEY,
  ProductionGraph,
  Report,
  SolverResults,
} from './models';
import {
  EPSILON,
  RATE_TARGET_KEY,
  Inputs,
  RateTargets,
  MaximizeTargets,
  ProductionSolution,
  getItemPoints,
} from './internals';
import { assembleGraph } from './assembleGraph';
import { buildReport } from './buildReport';
import {
  RecipeVariant,
  getRecipeVariants,
  buildVariant,
  sloopSlotsFor,
  variantKey,
  parseVariantKey,
} from './amplification';

export {
  NODE_TYPE,
  POINTS_ITEM_KEY,
} from './models';

export type {
  GraphEdge,
  GraphNode,
  ProducedItemInformation,
  ProductionGraph,
  Report,
  SolverResults,
} from './models';

const MIN_RESOURCE_WEIGHT = 0.0001;

// A solved recipe multiplier (building count) below the cull threshold is GLPK numerical noise
// rather than a real production step, so it is dropped from the solution. The threshold is
// scale-relative because LP noise magnitude tracks the problem's variable magnitudes: a large
// factory can leave a whole degenerate chain sitting at ~1e-5 buildings (e.g. a trace of a
// resource routed through pure-iron -> wire -> cable -> computer). MIN_RECIPE_MULTIPLIER is the
// absolute floor for tiny factories; RECIPE_NOISE_SCALE_FACTOR * scale dominates for larger ones.
// Both sit an order of magnitude above GLPK's tolerances yet far below any meaningful recipe.
const MIN_RECIPE_MULTIPLIER = 1e-6;
const RECIPE_NOISE_SCALE_FACTOR = 1e-6;

// GCD helpers used to derive per-cycle ingredient quantities from stored perMinute rates.
// perMinute = 60 * quantity / craftTime, so GCD(all perMinutes) = 60 / craftTime,
// and quantity = perMinute / GCD. We scale to integers to avoid floating-point drift.
function gcdIntegers(a: number, b: number): number {
  while (b > 0) { [a, b] = [b, a % b]; }
  return a;
}
function gcdFloats(a: number, b: number): number {
  const scale = 1e6;
  return gcdIntegers(Math.round(a * scale), Math.round(b * scale)) / scale;
}
const MAXIMIZE_WEIGHT = 1e5;
const ENFORCE_BIN_WEIGHT = 1000;
const TIME_LIMIT = 3.0;

type GlobalWeights = {
  resources: number,
  power: number,
  complexity: number,
  buildings: number
};

type ItemMap = {
  [key: string]: boolean;
}

let _glpkInstance: Awaited<ReturnType<typeof loadGLPK>> | null = null;
async function getGLPK() {
  if (!_glpkInstance) {
    _glpkInstance = await loadGLPK();
  }
  return _glpkInstance;
}

export class ProductionSolver {
  private gameData: GameData;
  private globalWeights: GlobalWeights;
  private inputs: Inputs;
  private rateTargets: RateTargets;
  private maximizeTargets: MaximizeTargets[];
  private hasPointsTarget: boolean;
  // allowedRecipes ANDed with the building filter: a recipe is usable only if its
  // own toggle is on AND its producing building is enabled. This is the single map
  // every solver pass gates on.
  private effectiveAllowedRecipes: RecipeSelectionMap;
  private allowedItems: ItemMap;
  private scale: number;
  private maximizeBalanceMode: MaximizeBalanceMode;
  private beltCapacity: number | null;
  private pipeCapacity: number | null;
  // Somersloop / power-shard budgets, and the boost variants each allowed recipe may run.
  // With both budgets 0 every recipe maps to a single base variant, so the LP is identical
  // to the un-boosted model.
  private availableSloops: number;
  private availableShards: number;
  private variantsByRecipe: Map<string, RecipeVariant[]>;

  public constructor(options: FactoryOptions, gameData: GameData) {
    // Apply 1.2 Game Mode cost multipliers (default 1 = no scaling, e.g. for 1.1 or default mode).
    const recipeCostMultiplier = options.gameModeOptions ? Number(options.gameModeOptions.recipePartsCost) : 1;
    const powerMultiplier = options.gameModeOptions ? Number(options.gameModeOptions.powerConsumption) : 1;
    this.validateNumber(recipeCostMultiplier);
    this.validateNumber(powerMultiplier);
    this.gameData = ProductionSolver.applyGameModeMultipliers(gameData, recipeCostMultiplier, powerMultiplier);
    this.maximizeBalanceMode = options.maximizeBalanceMode;

    const rawBelt = options.transportOptions?.beltCapacity;
    const parsedBelt = rawBelt != null ? Number(rawBelt) : NaN;
    this.beltCapacity = !Number.isNaN(parsedBelt) && parsedBelt > 0 ? parsedBelt : null;

    const rawPipe = options.transportOptions?.pipeCapacity;
    const parsedPipe = rawPipe != null ? Number(rawPipe) : NaN;
    this.pipeCapacity = !Number.isNaN(parsedPipe) && parsedPipe > 0 ? parsedPipe : null;

    this.availableSloops = options.amplificationOptions ? Number(options.amplificationOptions.availableSloops) : 0;
    this.availableShards = options.amplificationOptions ? Number(options.amplificationOptions.availableShards) : 0;
    this.validateNumber(this.availableSloops);
    this.validateNumber(this.availableShards);

    const allowedRecipes = options.allowedRecipes;
    // allowedBuildings may be absent on state restored from very old session storage;
    // the reducer backfills it, but guard here too (an unknown building => allowed).
    const allowedBuildings = options.allowedBuildings ?? {};
    this.effectiveAllowedRecipes = {};
    Object.entries(allowedRecipes).forEach(([recipeKey, allowed]) => {
      const recipeInfo = this.gameData.recipes[recipeKey];
      const buildingAllowed = allowedBuildings[recipeInfo.producedIn] !== false;
      this.effectiveAllowedRecipes[recipeKey] = allowed && buildingAllowed;
    });

    this.allowedItems = {};

    Object.entries(this.effectiveAllowedRecipes).forEach(([recipeKey, allowed]) => {
      if (!allowed) return;
      const recipeInfo = this.gameData.recipes[recipeKey];
      recipeInfo.ingredients.forEach((i) => {
        this.allowedItems[i.itemClass] = true;
      });
      recipeInfo.products.forEach((p) => {
        this.allowedItems[p.itemClass] = true;
      });
    });

    this.globalWeights = {
      resources: Number(options.weightingOptions.resources),
      power: Number(options.weightingOptions.power),
      complexity: Number(options.weightingOptions.complexity),
      buildings: Number(options.weightingOptions.buildings),
    };

    this.validateNumber(this.globalWeights.resources);
    this.validateNumber(this.globalWeights.power);
    this.validateNumber(this.globalWeights.complexity);
    this.validateNumber(this.globalWeights.buildings);

    const maxGlobalWeight = Math.max(
      this.globalWeights.resources,
      this.globalWeights.power,
      this.globalWeights.complexity,
      this.globalWeights.buildings
    );

    this.globalWeights.resources = (this.globalWeights.resources / maxGlobalWeight) + MIN_RESOURCE_WEIGHT;
    this.globalWeights.power = (this.globalWeights.power / maxGlobalWeight);
    this.globalWeights.complexity = 1000 * (this.globalWeights.complexity / maxGlobalWeight);
    this.globalWeights.buildings = (this.globalWeights.buildings / maxGlobalWeight);

    this.inputs = {};

    options.inputResources.forEach((item) => {
      const resourceData = this.gameData.resources[item.itemKey];
      if (!resourceData) return;
      const amount = item.unlimited ? Infinity : Number(item.value);
      this.validateNumber(amount);
      if (!amount) return;
      const weight = Number(item.weight);
      this.validateNumber(weight);
      this.inputs[item.itemKey] = {
        amount,
        weight,
        type: NODE_TYPE.RESOURCE,
      }
    });

    const maxResourceWeight = Math.max(...Object.values(this.inputs).map((i) => i.weight));
    Object.values(this.inputs).forEach((i) => { i.weight /= maxResourceWeight });

    options.inputItems.forEach((item) => {
      if (!item.itemKey) return;
      const amount = item.unlimited ? Infinity : Number(item.value);
      this.validateNumber(amount);
      if (!amount) return;
      if (!this.inputs[item.itemKey]) {
        this.inputs[item.itemKey] = {
          amount,
          weight: 0,
          type: NODE_TYPE.INPUT_ITEM,
        }
      } else {
        this.inputs[item.itemKey].amount += amount;
      }
    });

    if (options.allowHandGatheredItems) {
      Object.keys(this.gameData.handGatheredItems).forEach((item) => {
        this.inputs[item] = {
          amount: Infinity,
          weight: 1000,
          type: NODE_TYPE.HAND_GATHERED_RESOURCE,
        };
      });
    }

    this.inputs['Desc_Gift_C'] = {
      amount: Infinity,
      weight: 1000,
      type: NODE_TYPE.HAND_GATHERED_RESOURCE,
    };

    this.rateTargets = {};
    this.maximizeTargets = [];
    this.hasPointsTarget = false;
    this.scale = 0;

    const perMinTargets: RateTargets = {};
    const recipeTargets: RateTargets = {};
    options.productionItems.forEach((item) => {
      if (!item.itemKey) return;
      const amount = Number(item.value);
      this.validateNumber(amount);
      if (!amount) return;
      if (this.inputs[item.itemKey]) throw new GraphError('INVALID INPUT', 'You can\'t set the same item as both an input and an output. Double check your factory settings.');
      const isPoints = item.itemKey === POINTS_ITEM_KEY;
      if (isPoints) {
        this.hasPointsTarget = true;
      }
      switch (item.mode) {
        case 'per-minute':
          this.scale += amount;
          if (perMinTargets[item.itemKey]) {
            perMinTargets[item.itemKey].value += amount;
          } else {
            perMinTargets[item.itemKey] = {
              value: amount,
              recipe: null,
              isPoints,
            };
          }
          break;
        case 'maximize':
          const existingTarget = this.maximizeTargets.find((t) => t.key === item.itemKey);
          if (existingTarget) {
            if (existingTarget.priority < amount) {
              existingTarget.priority = amount;
            }
          } else {
            this.maximizeTargets.push({
              key: item.itemKey,
              priority: amount,
            });
          }
          break;
        default:
          const recipeKey = item.mode;
          const recipeInfo = this.gameData.recipes[recipeKey];
          if (recipeInfo) {
            if (!this.effectiveAllowedRecipes[recipeKey]) {
              throw new GraphError('CANNOT TARGET DISABLED RECIPE', 'Make sure the recipe you are targeting is enabled in the Recipes tab and its building is enabled in the Buildings tab.');
            }
            const target = recipeInfo.products.find((p) => p.itemClass === item.itemKey)!;
            this.scale += target.perMinute * amount;
            if (perMinTargets[item.itemKey]) {
              perMinTargets[item.itemKey].value += target.perMinute * amount;
            } else {
              perMinTargets[item.itemKey] = {
                value: target.perMinute * amount,
                recipe: null,
                isPoints: false,
              };
            }
            if (recipeTargets[recipeKey]) {
              recipeTargets[recipeKey].value += amount;
            } else {
              recipeTargets[recipeKey] = {
                value: amount,
                recipe: recipeKey,
                isPoints: false,
              };
            }
          } else {
            throw new GraphError('INVALID OUTPUT MODE SELECTION', 'Something really broke... Try refreshing or resetting your factory.');
          }
      }
    });

    if (this.scale === 0) {
      this.scale = 1;
    }

    this.maximizeTargets.sort((a, b) => b.priority - a.priority);

    this.rateTargets = {
      ...perMinTargets,
      ...recipeTargets,
    };
    if (Object.keys(this.rateTargets).length === 0 && this.maximizeTargets.length === 0) {
      throw new GraphError('NO OUTPUTS SET', 'Open the control panel to get started.');
    }

    // Precompute the boost variants offered per allowed recipe. Recipes pinned as a
    // recipe-mode production target keep a fixed building count, so they stay base-only —
    // boosting them would contradict the user's explicit "run N of this recipe" intent and
    // muddy the recipe-target graph edge that routes their output.
    const recipeTargetKeys = new Set(Object.keys(recipeTargets));
    this.variantsByRecipe = new Map();
    for (const [recipeKey, allowed] of Object.entries(this.effectiveAllowedRecipes)) {
      if (!allowed) continue;
      const recipeInfo = this.gameData.recipes[recipeKey];
      const buildingInfo = this.gameData.buildings[recipeInfo.producedIn];
      const variants = recipeTargetKeys.has(recipeKey)
        ? [buildVariant('', 0)]
        : getRecipeVariants(recipeInfo.producedIn, buildingInfo.power, this.availableSloops, this.availableShards);
      this.variantsByRecipe.set(recipeKey, variants);
    }
  }

  private variantsFor(recipeKey: string): RecipeVariant[] {
    return this.variantsByRecipe.get(recipeKey) ?? [buildVariant('', 0)];
  }

  private validateNumber(num: number) {
    if (Number.isNaN(num)) {
      throw new GraphError('INVALID VALUE: NOT A NUMBER', 'Double check your factory settings.');
    } else if (num < 0) {
      throw new GraphError('INVALID VALUE: NEGATIVE NUMBER', 'Double check your factory settings.');
    }
  }

  // Returns a copy of gameData with 1.2 Game Mode multipliers baked in: recipe ingredient costs
  // scaled by recipeCostMultiplier (outputs untouched) and consumer power scaled by powerMultiplier
  // (generators, power < 0, left alone). All downstream solver/report logic then reads scaled values.
  //
  // The game applies the cost multiplier to the integer *per-cycle quantities*, not to the stored
  // perMinute rates directly. The cycle time is derived from the GCD of all perMinute values in the
  // recipe (ingredients + products): craftTime = 60 / GCD, perCycleQty = perMinute / GCD.
  // Scaled quantities are rounded to the nearest whole number (minimum 1 per the game's floor).
  private static applyGameModeMultipliers(gameData: GameData, recipeCostMultiplier: number, powerMultiplier: number): GameData {
    if (recipeCostMultiplier === 1 && powerMultiplier === 1) {
      return gameData;
    }

    const recipes: GameData['recipes'] = {};
    for (const [key, recipe] of Object.entries(gameData.recipes)) {
      if (recipeCostMultiplier === 1) {
        recipes[key] = recipe;
      } else {
        const allRates = [
          ...recipe.ingredients.map((i) => i.perMinute),
          ...recipe.products.map((p) => p.perMinute),
        ];
        const gcd = allRates.reduce(gcdFloats);
        recipes[key] = {
          ...recipe,
          ingredients: recipe.ingredients.map((i) => {
            const perCycle = Math.round(i.perMinute / gcd);
            const scaledPerCycle = Math.max(1, Math.round(perCycle * recipeCostMultiplier));
            return { ...i, perMinute: scaledPerCycle * gcd };
          }),
        };
      }
    }

    const buildings: GameData['buildings'] = {};
    for (const [key, building] of Object.entries(gameData.buildings)) {
      buildings[key] = (powerMultiplier === 1 || building.power <= 0) ? building : {
        ...building,
        power: building.power * powerMultiplier,
      };
    }

    return { ...gameData, recipes, buildings };
  }

  public async exec(): Promise<SolverResults> {
    const timestamp = performance.now();
    try {
      const glpk = await getGLPK();
      const productionSolution = await this.productionSolverPass([RATE_TARGET_KEY], this.inputs, glpk);
      let productionGraph = assembleGraph(productionSolution, this.graphContext());

      const priorityGroups = new Map<number, string[]>();
      for (const target of this.maximizeTargets) {
        if (!priorityGroups.has(target.priority)) {
          priorityGroups.set(target.priority, []);
        }
        priorityGroups.get(target.priority)!.push(target.key);
      }
      const sortedPriorities = [...priorityGroups.keys()].sort((a, b) => b - a);

      for (const priority of sortedPriorities) {
        const groupTargetKeys = priorityGroups.get(priority)!;
        const remainingInputs: Inputs = {};
        for (const [inputKey, input] of Object.entries(this.inputs)) {
          const inputNode = Object.values(productionGraph.nodes).find((n) => n.key === inputKey);
          let usedAmount = 0;
          if (inputNode) {
            usedAmount = inputNode.multiplier;
          }
          const diff = input.amount - usedAmount;
          if (diff > EPSILON) {
            remainingInputs[inputKey] = {
              ...input,
              amount: diff,
            };
          }
        }
        // Feed leftover byproducts from prior passes forward as zero-cost inputs so a
        // resource-wasteful earlier pass doesn't strand a precursor a maximize goal could
        // consume (e.g. Heavy Oil Residue -> Fuel). Otherwise these side products are simply
        // discarded between passes and the maximize target can be starved to zero.
        for (const [itemKey, info] of Object.entries(this.surplusByproducts(productionSolution))) {
          if (!remainingInputs[itemKey]) {
            remainingInputs[itemKey] = info;
          }
        }
        let solution: ProductionSolution;
        if (groupTargetKeys.length === 1) {
          solution = await this.productionSolverPass(groupTargetKeys, remainingInputs, glpk, undefined, productionSolution);
        } else {
          const maxima = new Map<string, number>();
          for (const targetKey of groupTargetKeys) {
            const individualSol = await this.productionSolverPass([targetKey], remainingInputs, glpk, undefined, productionSolution);
            const tempGraph = assembleGraph(individualSol, this.graphContext());
            const node = Object.values(tempGraph.nodes).find(n => n.key === targetKey && n.type === NODE_TYPE.FINAL_PRODUCT);
            maxima.set(targetKey, node?.multiplier ?? 0);
          }
          const balancedMaxima = this.maximizeBalanceMode === 'equal'
            ? new Map([...maxima.entries()].map(([k, v]) => [k, v > EPSILON ? 1 : 0]))
            : maxima;
          solution = await this.productionSolverPass(groupTargetKeys, remainingInputs, glpk, balancedMaxima, productionSolution);
        }
        for (const [key, multiplier] of Object.entries(solution)) {
          if (productionSolution[key]) {
            productionSolution[key] += multiplier;
          } else {
            productionSolution[key] = multiplier;
          }
        }
        productionGraph = assembleGraph(productionSolution, this.graphContext());
      }

      if (Object.keys(productionGraph.nodes).length === 0) {
        throw new GraphError('SOLUTION IS EMPTY', 'For some reason the solution for your parameters is an empty factory. Double check that your factory settings make sense.');
      }
      const report = buildReport(productionGraph, {
        gameData: this.gameData,
        inputs: this.inputs,
        availableSloops: this.availableSloops,
        availableShards: this.availableShards,
      });

      return {
        productionGraph,
        report,
        timestamp,
        computeTime: performance.now() - timestamp,
        error: null,
      };
    } catch (e: unknown) {
      return {
        productionGraph: null,
        report: null,
        timestamp,
        computeTime: performance.now() - timestamp,
        error: e as GraphError,
      };
    }
  }

  // Net leftover byproducts of a cumulative solution, exposed as zero-cost, finite inputs
  // for subsequent maximize passes. Only genuine side products are recyclable: primary
  // inputs, delivered rate/maximize targets, and the points item are excluded so we never
  // feed a final product back into the factory to be re-consumed.
  private surplusByproducts(solution: ProductionSolution): Inputs {
    const net: { [key: string]: number } = {};
    for (const [key, multiplier] of Object.entries(solution)) {
      const { baseRecipeKey, suffix } = parseVariantKey(key);
      const recipeInfo = this.gameData.recipes[baseRecipeKey];
      if (!recipeInfo) continue;
      const variant = buildVariant(suffix, sloopSlotsFor(recipeInfo.producedIn));
      for (const product of recipeInfo.products) {
        net[product.itemClass] = (net[product.itemClass] ?? 0) + multiplier * product.perMinute * variant.outputMult;
      }
      for (const ingredient of recipeInfo.ingredients) {
        net[ingredient.itemClass] = (net[ingredient.itemClass] ?? 0) - multiplier * ingredient.perMinute * variant.inputMult;
      }
    }
    const surplus: Inputs = {};
    for (const [itemKey, amount] of Object.entries(net)) {
      if (amount <= EPSILON) continue;
      if (this.inputs[itemKey]) continue;
      if (this.rateTargets[itemKey]) continue;
      if (this.maximizeTargets.some((t) => t.key === itemKey)) continue;
      if (itemKey === POINTS_ITEM_KEY) continue;
      surplus[itemKey] = { amount, weight: 0, type: NODE_TYPE.SIDE_PRODUCT };
    }
    return surplus;
  }

  private graphContext() {
    return {
      gameData: this.gameData,
      inputs: this.inputs,
      rateTargets: this.rateTargets,
      maximizeTargets: this.maximizeTargets,
      hasPointsTarget: this.hasPointsTarget,
    };
  }

  private async productionSolverPass(targetKeys: string[], remainingInputs: Inputs, glpk: GLPK, maxima?: Map<string, number>, priorSolution?: ProductionSolution): Promise<ProductionSolution> {
    const isRateTargetPass = targetKeys.length === 1 && targetKeys[0] === RATE_TARGET_KEY;
    const targetItemVars = new Map<string, Var[]>();
    const model: LP = {
      name: 'production',
      objective: {
        name: 'score',
        direction: glpk.GLP_MIN,
        vars: [],
      },
      subjectTo: [],
      binaries: [],
    };

    const doPoints = (isRateTargetPass && this.rateTargets[POINTS_ITEM_KEY]) || targetKeys.includes(POINTS_ITEM_KEY);
    const pointsVars: Var[] = [];
    const objectiveVarMap = new Map<string, Var>();

    for (const [recipeKey, recipeInfo] of Object.entries(this.gameData.recipes)) {
      if (!this.effectiveAllowedRecipes[recipeKey]) continue;
      const buildingInfo = this.gameData.buildings[recipeInfo.producedIn];

      // Each recipe expands into one LP variable per boost variant (base + amplified /
      // overclocked / both). A variant's value is measured in physical buildings of that
      // variant; the variant multipliers scale throughput and power accordingly.
      for (const variant of this.variantsFor(recipeKey)) {
        const vKey = variantKey(recipeKey, variant.suffix);

        // Overclocking (variant.powerMult) raises consumer power super-linearly; amplification
        // (also folded into powerMult) squares it. Generators (power < 0) never get boost variants.
        const powerScore = buildingInfo.power > 0 ? buildingInfo.power * variant.powerMult * this.globalWeights.power : 0;
        const buildingsScore = this.globalWeights.buildings;
        let resourceScore = 0;

        for (const ingredient of recipeInfo.ingredients) {
          const inputInfo = this.inputs[ingredient.itemClass];
          if (inputInfo) {
            // Amplification leaves inputs unchanged (inputMult 1); overclocking scales them.
            resourceScore += inputInfo.weight * ingredient.perMinute * variant.inputMult * this.globalWeights.resources;
          }
        }

        const recipeObjVar: Var = {
          name: vKey,
          coef: powerScore + resourceScore + buildingsScore,
        };
        model.objective.vars.push(recipeObjVar);
        objectiveVarMap.set(vKey, recipeObjVar);

        if (this.beltCapacity !== null || this.pipeCapacity !== null) {
          for (const product of recipeInfo.products) {
            if (!this.allowedItems[product.itemClass] || product.perMinute <= 0) continue;
            const isFluid = this.gameData.items[product.itemClass]?.isFluid ?? false;
            const capacity = isFluid ? this.pipeCapacity : this.beltCapacity;
            if (capacity !== null) {
              const perMin = product.perMinute * variant.outputMult;
              // Tighten the cap by output already allocated to this variant in prior passes, so the
              // cumulative total across all summed passes stays within a single belt/pipe (issue #130).
              const priorMultiplier = priorSolution?.[vKey] ?? 0;
              const ub = Math.max(0, capacity - priorMultiplier * perMin);
              model.subjectTo.push({
                name: `${vKey}_${product.itemClass}_capacity`,
                vars: [{ name: vKey, coef: perMin }],
                bnds: { type: glpk.GLP_UP, ub, lb: NaN },
              });
            }
          }
        }

        if (doPoints) {
          let pointCoef = 0;
          for (const product of recipeInfo.products) {
            if (!this.inputs[product.itemClass] || this.inputs[product.itemClass].type === NODE_TYPE.INPUT_ITEM) {
              pointCoef -= product.perMinute * variant.outputMult * getItemPoints(this.gameData, product.itemClass) / 1000;
            }
          }
          for (const ingredient of recipeInfo.ingredients) {
            if (!this.inputs[ingredient.itemClass] || this.inputs[ingredient.itemClass].type === NODE_TYPE.INPUT_ITEM) {
              pointCoef += ingredient.perMinute * variant.inputMult * getItemPoints(this.gameData, ingredient.itemClass) / 1000;
            }
          }
          pointsVars.push({ name: vKey, coef: pointCoef });
        }
      }

      // Recipe-mode targets pin a building count. These recipes are base-only (see
      // variantsByRecipe), so the sum below is a single variable in practice.
      if (isRateTargetPass && this.rateTargets[recipeKey]) {
        model.subjectTo.push({
          name: `${recipeKey} recipe constraint`,
          vars: this.variantsFor(recipeKey).map((variant) => ({ name: variantKey(recipeKey, variant.suffix), coef: 1 })),
          bnds: { type: glpk.GLP_LO, ub: 0, lb: this.rateTargets[recipeKey].value },
        });
      }
    }


    if (doPoints) {
      let intrinsicPoints = 0;
      for (const [itemKey, inputInfo] of Object.entries(remainingInputs)) {
        if (inputInfo.type === NODE_TYPE.INPUT_ITEM) {
          intrinsicPoints += getItemPoints(this.gameData, itemKey) * inputInfo.amount;
        }
      }
      if (isRateTargetPass) {
        for (const [itemKey, targetInfo] of Object.entries(this.rateTargets)) {
          if (itemKey !== POINTS_ITEM_KEY) {
            intrinsicPoints -= getItemPoints(this.gameData, itemKey) * targetInfo.value;
          }
        }
        model.subjectTo.push({
          name: 'AWESOME Sink Points constraint',
          vars: pointsVars,
          bnds: { type: glpk.GLP_UP, ub: -this.rateTargets[POINTS_ITEM_KEY].value - intrinsicPoints, lb: NaN },
        });
      } else if (targetKeys.includes(POINTS_ITEM_KEY)) {
        pointsVars.forEach((v) => {
          const existingVar = objectiveVarMap.get(v.name);
          if (existingVar) {
            existingVar.coef += v.coef * MAXIMIZE_WEIGHT;
          } else {
            const newVar: Var = { name: v.name, coef: v.coef * MAXIMIZE_WEIGHT };
            model.objective.vars.push(newVar);
            objectiveVarMap.set(v.name, newVar);
          }
        });
      }
    }


    for (const [itemKey, itemInfo] of Object.entries(this.gameData.items)) {
      if (!this.allowedItems[itemKey]) continue;
      const vars: Var[] = [];
      const varsMap = new Map<string, Var>();

      const binKey = `${itemKey}_BIN`;
      const binVars: Var[] = [];

      // Consumption: each variant consumes inputs scaled by inputMult (amplification = 1,
      // overclock = 2.5). One LP variable per variant, keyed by its suffixed name.
      for (const recipeKey of itemInfo.usedInRecipes) {
        if (!this.effectiveAllowedRecipes[recipeKey]) continue;
        const recipeInfo = this.gameData.recipes[recipeKey];
        const target = recipeInfo.ingredients.find((i) => i.itemClass === itemKey)!;
        for (const variant of this.variantsFor(recipeKey)) {
          const vKey = variantKey(recipeKey, variant.suffix);
          const v: Var = { name: vKey, coef: target.perMinute * variant.inputMult };
          vars.push(v);
          varsMap.set(vKey, v);

          if (!this.gameData.handGatheredItems[itemKey]) {
            binVars.push({ name: vKey, coef: -1 });
          }
        }
      }

      // Production: each variant produces outputs scaled by outputMult (amplification = 2,
      // overclock = 2.5, both = 5).
      for (const recipeKey of itemInfo.producedFromRecipes) {
        if (!this.effectiveAllowedRecipes[recipeKey]) continue;
        const recipeInfo = this.gameData.recipes[recipeKey];
        const target = recipeInfo.products.find((p) => p.itemClass === itemKey)!;
        for (const variant of this.variantsFor(recipeKey)) {
          const vKey = variantKey(recipeKey, variant.suffix);
          const produced = target.perMinute * variant.outputMult;
          const existingVar = varsMap.get(vKey);
          if (existingVar) {
            existingVar.coef -= produced;
          } else {
            const v: Var = { name: vKey, coef: -produced };
            vars.push(v);
            varsMap.set(vKey, v);
          }
        }
      }

      if (isRateTargetPass) {
        if (this.globalWeights.complexity > 0 && binVars.length > 0) {
          model.binaries!.push(binKey);
          model.objective.vars.push({ name: binKey, coef: this.globalWeights.complexity });
          model.subjectTo.push({
            name: `${binKey} constraint`,
            vars: [
              { name: binKey, coef: ENFORCE_BIN_WEIGHT * Math.sqrt(this.scale) },
              ...binVars,
            ],
            bnds: { type: glpk.GLP_LO, ub: NaN, lb: 0 },
          });
        }
      }

      if (vars.length === 0) continue;

      if (remainingInputs[itemKey]) {
        const inputInfo = remainingInputs[itemKey];
        if (inputInfo.amount !== Infinity) {
          model.subjectTo.push({
            name: `${itemKey} resource constraint`,
            vars,
            bnds: { type: glpk.GLP_UP, ub: inputInfo.amount, lb: NaN },
          });
        }
      }

      else if (isRateTargetPass && this.rateTargets[itemKey]) {
        const outputInfo = this.rateTargets[itemKey];
        model.subjectTo.push({
          name: `${itemKey} final product constraint`,
          vars,
          bnds: { type: glpk.GLP_UP, ub: -outputInfo.value, lb: NaN },
        });
      }

      else if (targetKeys.includes(itemKey)) {
        targetItemVars.set(itemKey, [...vars]);
        model.subjectTo.push({
          name: `${itemKey} final product constraint`,
          vars,
          bnds: { type: glpk.GLP_UP, ub: 0, lb: NaN },
        });

        vars.forEach((v) => {
          const existingVar = objectiveVarMap.get(v.name);
          if (existingVar) {
            existingVar.coef += v.coef * MAXIMIZE_WEIGHT;
          } else {
            const newVar: Var = { name: v.name, coef: v.coef * MAXIMIZE_WEIGHT };
            model.objective.vars.push(newVar);
            objectiveVarMap.set(v.name, newVar);
          }
        });
      }

      else {
        model.subjectTo.push({
          name: `${itemKey} intermediates constraint`,
          vars,
          bnds: { type: glpk.GLP_UP, ub: 0, lb: NaN },
        });
      }
    }

    // Global somersloop / power-shard budgets: the total slots consumed across every boost
    // variant may not exceed what the user has available. This is a continuous relaxation —
    // fractional buildings consume fractional slots — so the reported usage should be rounded
    // up when built in-game. Only added when the corresponding budget is set (and thus boost
    // variants exist), so the un-boosted model gains no constraints.
    if (this.availableSloops > 0) {
      const sloopVars: Var[] = [];
      for (const [recipeKey, variants] of this.variantsByRecipe) {
        for (const variant of variants) {
          if (variant.sloops > 0) sloopVars.push({ name: variantKey(recipeKey, variant.suffix), coef: variant.sloops });
        }
      }
      if (sloopVars.length > 0) {
        model.subjectTo.push({
          name: 'somersloop budget',
          vars: sloopVars,
          bnds: { type: glpk.GLP_UP, ub: this.availableSloops, lb: NaN },
        });
      }
    }
    if (this.availableShards > 0) {
      const shardVars: Var[] = [];
      for (const [recipeKey, variants] of this.variantsByRecipe) {
        for (const variant of variants) {
          if (variant.shards > 0) shardVars.push({ name: variantKey(recipeKey, variant.suffix), coef: variant.shards });
        }
      }
      if (shardVars.length > 0) {
        model.subjectTo.push({
          name: 'power shard budget',
          vars: shardVars,
          bnds: { type: glpk.GLP_UP, ub: this.availableShards, lb: NaN },
        });
      }
    }

    if (maxima && targetKeys.length > 1) {
      const producibleKeys = targetKeys.filter(k => (maxima.get(k) ?? 0) > EPSILON);
      if (producibleKeys.length > 1) {
        const referenceKey = producibleKeys[0];
        const referenceVars = targetItemVars.get(referenceKey) ?? [];
        const referenceMax = maxima.get(referenceKey)!;
        for (let i = 1; i < producibleKeys.length; i++) {
          const otherKey = producibleKeys[i];
          const otherVars = targetItemVars.get(otherKey) ?? [];
          const otherMax = maxima.get(otherKey)!;
          // Proportionality: net_production_reference / referenceMax = net_production_other / otherMax
          // Since vars encode (consumption - production), net_production = -sum(vars * x)
          // → otherMax * sum(referenceVars * x) - referenceMax * sum(otherVars * x) = 0
          const coefMap = new Map<string, number>();
          for (const v of referenceVars) {
            coefMap.set(v.name, (coefMap.get(v.name) ?? 0) + otherMax * v.coef);
          }
          for (const v of otherVars) {
            coefMap.set(v.name, (coefMap.get(v.name) ?? 0) - referenceMax * v.coef);
          }
          const constraintVars: Var[] = [...coefMap.entries()]
            .filter(([, coef]) => Math.abs(coef) > EPSILON)
            .map(([name, coef]) => ({ name, coef }));
          if (constraintVars.length > 0) {
            model.subjectTo.push({
              name: `${referenceKey}_${otherKey}_proportional`,
              vars: constraintVars,
              bnds: { type: glpk.GLP_FX, ub: 0, lb: 0 },
            });
          }
        }
      }
    }

    const solution = await glpk.solve(model, { msglev: glpk.GLP_MSG_OFF, tmlim: TIME_LIMIT });
    if (solution.time > TIME_LIMIT) {
      throw new GraphError('TIMED OUT', 'Try setting the complexity weight to 0. Unfortunately it is currently very slow for large factories. For complex factories, you might try the Buildings optimizer instead.');
    }
    if (solution.result.status !== glpk.GLP_OPT && solution.result.status !== glpk.GLP_FEAS) {
      // If a belt/pipe capacity limit is set, check whether it is what made the solve infeasible by
      // re-solving without the capacity constraints. If that succeeds, the cap is the culprit and we
      // can explain exactly why instead of throwing a generic error (issue #130).
      if (this.beltCapacity !== null || this.pipeCapacity !== null) {
        const probe = { ...model, subjectTo: model.subjectTo.filter((c) => !c.name.endsWith('_capacity')) };
        const probeSolution = await glpk.solve(probe, { msglev: glpk.GLP_MSG_OFF, tmlim: TIME_LIMIT });
        if (probeSolution.result.status === glpk.GLP_OPT || probeSolution.result.status === glpk.GLP_FEAS) {
          const limits: string[] = [];
          if (this.beltCapacity !== null) limits.push(`belt ${this.beltCapacity}/min`);
          if (this.pipeCapacity !== null) limits.push(`pipe ${this.pipeCapacity}/min`);
          throw new GraphError(
            'BELT/PIPE CAPACITY TOO LOW',
            `Your transport capacity limit (${limits.join(', ')}) is too low to satisfy this factory. A single recipe's output for one item cannot exceed one belt/pipe, so a target needs more throughput than one belt can carry. Raise or clear the belt/pipe capacity in the Production tab.`,
          );
        }
      }
      if (isRateTargetPass) {
        throw new GraphError('NO SOLUTION', 'This could be due to missing recipes, impossible demands, or any number of reasons. Double check your factory settings.');
      } else {
        throw new GraphError('SOLUTION IS UNBOUNDED', 'Somehow an infinite amount of items can be produced. Double check the inputs tab for infinite resources (including the hand gathered resources option).');
      }
    }


    // Cull solver numerical noise: GLPK leaves tiny nonzero values on variables that are really 0.
    // Keeping them spawns phantom recipe/side-product nodes (a lone Heavy Oil Residue recipe at
    // ~8e-7 buildings, or a whole degenerate iron -> wire -> cable -> computer chain at ~1e-5).
    const cullThreshold = Math.max(MIN_RECIPE_MULTIPLIER, this.scale * RECIPE_NOISE_SCALE_FACTOR);
    const result: ProductionSolution = {};
    Object.entries(solution.result.vars).forEach(([key, val]) => {
      if (val > cullThreshold) {
        // Keep the variant key intact (assembleGraph/buildReport re-derive the boost from it),
        // but validate against the underlying base recipe so binary/budget vars are dropped.
        if (this.gameData.recipes[parseVariantKey(key).baseRecipeKey]) {
          result[key] = val;
        }
      }
    });
    return result;
  }

}

