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
  private allowedRecipes: RecipeSelectionMap;
  private allowedItems: ItemMap;
  private scale: number;
  private maximizeBalanceMode: MaximizeBalanceMode;
  private beltCapacity: number | null;
  private pipeCapacity: number | null;

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

    this.allowedRecipes = options.allowedRecipes;
    this.allowedItems = {};

    Object.entries(this.allowedRecipes).forEach(([recipeKey, allowed]) => {
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
            if (!this.allowedRecipes[recipeKey]) {
              throw new GraphError('CANNOT TARGET DISABLED RECIPE', 'Make sure the recipe you are targeting is enabled in the Recipes tab.');
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
        let solution: ProductionSolution;
        if (groupTargetKeys.length === 1) {
          solution = await this.productionSolverPass(groupTargetKeys, remainingInputs, glpk);
        } else {
          const maxima = new Map<string, number>();
          for (const targetKey of groupTargetKeys) {
            const individualSol = await this.productionSolverPass([targetKey], remainingInputs, glpk);
            const tempGraph = assembleGraph(individualSol, this.graphContext());
            const node = Object.values(tempGraph.nodes).find(n => n.key === targetKey && n.type === NODE_TYPE.FINAL_PRODUCT);
            maxima.set(targetKey, node?.multiplier ?? 0);
          }
          const balancedMaxima = this.maximizeBalanceMode === 'equal'
            ? new Map([...maxima.entries()].map(([k, v]) => [k, v > EPSILON ? 1 : 0]))
            : maxima;
          solution = await this.productionSolverPass(groupTargetKeys, remainingInputs, glpk, balancedMaxima);
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
      const report = buildReport(productionGraph, { gameData: this.gameData, inputs: this.inputs });

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

  private graphContext() {
    return {
      gameData: this.gameData,
      inputs: this.inputs,
      rateTargets: this.rateTargets,
      maximizeTargets: this.maximizeTargets,
      hasPointsTarget: this.hasPointsTarget,
    };
  }

  private async productionSolverPass(targetKeys: string[], remainingInputs: Inputs, glpk: GLPK, maxima?: Map<string, number>): Promise<ProductionSolution> {
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
      if (!this.allowedRecipes[recipeKey]) continue;
      const buildingInfo = this.gameData.buildings[recipeInfo.producedIn];
      const powerScore = buildingInfo.power > 0 ? buildingInfo.power * this.globalWeights.power : 0;
      const buildingsScore = this.globalWeights.buildings;
      let resourceScore = 0;

      for (const ingredient of recipeInfo.ingredients) {
        const inputInfo = this.inputs[ingredient.itemClass];
        if (inputInfo) {
          resourceScore += inputInfo.weight * ingredient.perMinute * this.globalWeights.resources;
        }
      }


      const recipeObjVar: Var = {
        name: recipeKey,
        coef: powerScore + resourceScore + buildingsScore,
      };
      model.objective.vars.push(recipeObjVar);
      objectiveVarMap.set(recipeKey, recipeObjVar);

      if (this.beltCapacity !== null || this.pipeCapacity !== null) {
        for (const product of recipeInfo.products) {
          if (!this.allowedItems[product.itemClass] || product.perMinute <= 0) continue;
          const isFluid = this.gameData.items[product.itemClass]?.isFluid ?? false;
          const capacity = isFluid ? this.pipeCapacity : this.beltCapacity;
          if (capacity !== null) {
            model.subjectTo.push({
              name: `${recipeKey}_${product.itemClass}_capacity`,
              vars: [{ name: recipeKey, coef: product.perMinute }],
              bnds: { type: glpk.GLP_UP, ub: capacity, lb: NaN },
            });
          }
        }
      }

      if (isRateTargetPass) {
        if (this.rateTargets[recipeKey]) {
          model.subjectTo.push({
            name: `${recipeKey} recipe constraint`,
            vars: [{ name: recipeKey, coef: 1 }],
            bnds: { type: glpk.GLP_LO, ub: 0, lb: this.rateTargets[recipeKey].value },
          });
        }
      }

      if (doPoints) {
        let pointCoef = 0;
        for (const product of recipeInfo.products) {
          if (!this.inputs[product.itemClass] || this.inputs[product.itemClass].type === NODE_TYPE.INPUT_ITEM) {
            pointCoef -= product.perMinute * getItemPoints(this.gameData, product.itemClass) / 1000;
          }
        }
        for (const ingredient of recipeInfo.ingredients) {
          if (!this.inputs[ingredient.itemClass] || this.inputs[ingredient.itemClass].type === NODE_TYPE.INPUT_ITEM) {
            pointCoef += ingredient.perMinute * getItemPoints(this.gameData, ingredient.itemClass) / 1000;
          }
        }
        pointsVars.push({ name: recipeKey, coef: pointCoef });
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

      for (const recipeKey of itemInfo.usedInRecipes) {
        if (!this.allowedRecipes[recipeKey]) continue;
        const recipeInfo = this.gameData.recipes[recipeKey];
        const target = recipeInfo.ingredients.find((i) => i.itemClass === itemKey)!;
        const v: Var = { name: recipeKey, coef: target.perMinute };
        vars.push(v);
        varsMap.set(recipeKey, v);

        if (!this.gameData.handGatheredItems[itemKey]) {
          binVars.push({ name: recipeKey, coef: -1 });
        }
      }

      for (const recipeKey of itemInfo.producedFromRecipes) {
        if (!this.allowedRecipes[recipeKey]) continue;
        const recipeInfo = this.gameData.recipes[recipeKey];
        const target = recipeInfo.products.find((p) => p.itemClass === itemKey)!;

        const existingVar = varsMap.get(recipeKey);
        if (existingVar) {
          existingVar.coef -= target.perMinute;
        } else {
          const v: Var = { name: recipeKey, coef: -target.perMinute };
          vars.push(v);
          varsMap.set(recipeKey, v);
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
      if (isRateTargetPass) {
        throw new GraphError('NO SOLUTION', 'This could be due to missing recipes, impossible demands, or any number of reasons. Double check your factory settings.');
      } else {
        throw new GraphError('SOLUTION IS UNBOUNDED', 'Somehow an infinite amount of items can be produced. Double check the inputs tab for infinite resources (including the hand gathered resources option).');
      }
    }


    const result: ProductionSolution = {};
    Object.entries(solution.result.vars).forEach(([key, val]) => {
      if (val > EPSILON) {
        if (this.gameData.recipes[key]) {
          result[key] = val;
        }
      }
    });
    return result;
  }

}

