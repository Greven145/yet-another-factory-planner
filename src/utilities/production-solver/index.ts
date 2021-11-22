import loadGLPK, { LP, Var } from 'glpk.js';
import { nanoid } from 'nanoid';
import { FactoryOptions } from '../../contexts/production';
import { buildings, items, recipes, resources, handGatheredItems } from '../../data';
import { RecipeMap } from '../../contexts/production';

const EPSILON = 1e-8;
const MAXIMIZE_OBJECTIVE_WEIGHT = 1e6;

export const NODE_TYPE = {
  FINAL_PRODUCT: 'FINAL_PRODUCT',
  SIDE_PRODUCT: 'SIDE_PRODUCT',
  INPUT_ITEM: 'INPUT_ITEM',
  HAND_GATHERED_RESOURCE: 'HAND_GATHERED_RESOURCE',
  RESOURCE: 'RESOURCE',
  RECIPE: 'RECIPE',
};

export const POINTS_ITEM_KEY = 'POINTS_ITEM_KEY';

type Inputs = {
  [key: string]: {
    amount: number,
    weight: number,
    type: string,
  }
};

type Outputs = {
  [key: string]: {
    value: number,
    recipe: string | null,
    maximize: boolean,
    isPoints: boolean,
  }
};

type GlobalWeights = {
  resources: number,
  power: number,
  buildArea: number,
};

type ProductionSolution = { [key: string]: number };
type ProductionAmount = { recipeKey: string, amount: number };
type ItemProductionTotals = {
  [key: string]: {
    producedBy: ProductionAmount[],
    usedBy: ProductionAmount[],
  }
};

export type SolverResults = {
  productionGraph: ProductionGraph | null,
  report: Report | null,
  timestamp: number,
  error: string,
};

export type Report = {
  pointsProduced: number,
  powerUsageEstimate: number,
  resourceEfficiencyScore: number,
  totalBuildArea: number,
  estimatedFoundations: number,
  buildingsUsed: {
    [key: string]: {
      count: number,
      materialCost: {
        [key: string]: number,
      }
    },
  },
  totalMaterialCost: {
    [key: string]: number,
  },
}

export type ProductionGraph = {
  nodes: { [key: string]: GraphNode },
  edges: GraphEdge[],
};

export type GraphNode = {
  id: string,
  key: string,
  type: string,
  multiplier: number,
};

export type GraphEdge = {
  key: string,
  from: string,
  to: string,
  productionRate: number,
};

export class ProductionSolver {
  private globalWeights: GlobalWeights;
  private inputs: Inputs;
  private outputs: Outputs;
  private allowedRecipes: RecipeMap;

  public constructor(options: FactoryOptions) {
    this.allowedRecipes = options.allowedRecipes;
    
    this.globalWeights = {
      resources: Number(options.weightingOptions.resources),
      power: Number(options.weightingOptions.power),
      buildArea: Number(options.weightingOptions.buildArea),
    };

    this.validateNumber(this.globalWeights.resources);
    this.validateNumber(this.globalWeights.power);
    this.validateNumber(this.globalWeights.buildArea);

    const maxGlobalWeight = Math.max(this.globalWeights.resources, this.globalWeights.power, this.globalWeights.buildArea);
    this.globalWeights.resources /= maxGlobalWeight;
    this.globalWeights.power /= maxGlobalWeight;
    this.globalWeights.buildArea /= (10 * maxGlobalWeight); // Extra factor of 10 to be closer to power numbers

    this.inputs = {};

    options.inputResources.forEach((item) => {
      const resourceData = resources[item.itemKey];
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
      Object.keys(handGatheredItems).forEach((item) => {
        this.inputs[item] = {
          amount: Infinity,
          weight: 1000,
          type: NODE_TYPE.HAND_GATHERED_RESOURCE,
        };
      });
    }

    this.outputs = {};
    const rateTargets: Outputs = {};
    const recipeTargets: Outputs = {};
    const maximizeTargets: Outputs = {};
    const sortedMaximizeTargets: Outputs = {};
    options.productionItems.forEach((item) => {
      if (!item.itemKey) return;
      const amount = Number(item.value);
      this.validateNumber(amount);
      if (!amount) return;
      switch (item.mode) {
        case 'per-minute':
          if (rateTargets[item.itemKey]) {
            rateTargets[item.itemKey].value += amount;
          } else {
            rateTargets[item.itemKey] = {
              value: amount,
              recipe: null,
              maximize: false,
              isPoints: item.itemKey === POINTS_ITEM_KEY,
            };
          }
          break;
        case 'maximize':
          if (maximizeTargets[item.itemKey]) {
            if (maximizeTargets[item.itemKey].value < amount) {
              maximizeTargets[item.itemKey].value = amount;
            }
          } else {
            maximizeTargets[item.itemKey] = {
              value: amount,
              recipe: null,
              maximize: true,
              isPoints: item.itemKey === POINTS_ITEM_KEY,
            };
          }
          break;
        default:
          const recipeKey = item.mode;
          const recipeInfo = recipes[recipeKey];
          if (recipeInfo) {
            if (!this.allowedRecipes[recipeKey]) {
              throw new Error('CANNOT TARGET A DISABLED RECIPE');
            }
            const target = recipeInfo.products.find((p) => p.itemClass === item.itemKey)!;
            if (rateTargets[item.itemKey]) {
              rateTargets[item.itemKey].value += target.perMinute * amount;
            } else {
              rateTargets[item.itemKey] = {
                value: target.perMinute * amount,
                recipe: null,
                maximize: false,
                isPoints: false,
              };
            }
            if (recipeTargets[recipeKey]) {
              recipeTargets[recipeKey].value += amount;
            } else {
              recipeTargets[recipeKey] = {
                value: amount,
                recipe: recipeKey,
                maximize: false,
                isPoints: false,
              };
            }
          } else {
            throw new Error('INVALID OUTPUT MODE SELECTION');
          }
      }
    });

    Object.entries(maximizeTargets)
      .sort((a, b) => {
        if (a[1].value > b[1].value) return 1;
        if (a[1].value < b[1].value) return -1;
        return 0;
      })
      .forEach(([key, val], index) => {
        sortedMaximizeTargets[key] = {
          ...val,
          value: index + 1,
        }
      });

    this.outputs = {
      ...rateTargets,
      ...recipeTargets,
      ...sortedMaximizeTargets,
    };
    if (Object.keys(this.outputs).length === 0) {
      throw new Error('NO OUTPUTS SET');
    }
  }

  private validateNumber(num: Number) {
    if (Number.isNaN(num)) {
      throw new Error('INVALID VALUE: NOT A NUMBER');
    } else if (num < 0) {
      throw new Error('INVALID VALUE: NEGATIVE NUMBER');
    }
  }

  public async exec(): Promise<SolverResults> {
    const timestamp = performance.now();
    try {
      const productionSolution = await this.solveProduction();
      if (Object.keys(productionSolution).length === 0) {
        throw new Error('SOLUTION IS EMPTY.');
      }
      const productionGraph = this.generateProductionGraph(productionSolution);
      const report = this.generateProductionReport(productionGraph);

      return {
        productionGraph,
        report,
        timestamp: timestamp,
        error: '',
      };
    } catch (e: any) {
      return {
        productionGraph: null,
        report: null,
        timestamp: timestamp,
        error: e.message,
      };
    }
  }

  private async solveProduction(): Promise<ProductionSolution> {
    const glpk = await loadGLPK();
    const model: LP = {
      name: 'production',
      objective: {
        name: 'score',
        direction: glpk.GLP_MIN,
        vars: [],
      },
      subjectTo: [],
    };

    const pointsVars: Var[] = [];

    for (const [recipeKey, recipeInfo] of Object.entries(recipes)) {
      if (!this.allowedRecipes[recipeKey]) continue;
      const buildingInfo = buildings[recipeInfo.producedIn];
      const powerScore = buildingInfo.power > 0 ? buildingInfo.power * this.globalWeights.power : 0;
      const areaScore = buildingInfo.area * this.globalWeights.buildArea;
      model.objective.vars.push({
        name: recipeKey,
        coef: powerScore + areaScore,
      });

      if (this.outputs[recipeKey]) {
        model.subjectTo.push({
          name: `${recipeKey} recipe constraint`,
          vars: [{ name: recipeKey, coef: 1 }],
          bnds: { type: glpk.GLP_LO, ub: 0, lb: this.outputs[recipeKey].value },
        });
      }

      if (this.outputs[POINTS_ITEM_KEY]) {
        let pointCoef = 0;
        for (const product of recipeInfo.products) {
          if (!this.inputs[product.itemClass]) {
            pointCoef -= product.perMinute * items[product.itemClass].sinkPoints / 1000;
          }
        }
        for (const ingredient of recipeInfo.ingredients) {
          if (!this.inputs[ingredient.itemClass]) {
            pointCoef += ingredient.perMinute * items[ingredient.itemClass].sinkPoints / 1000;
          } 
        }
        pointsVars.push({ name: recipeKey, coef: pointCoef });
      }
    }

    if (this.outputs[POINTS_ITEM_KEY]) {
      if (this.outputs[POINTS_ITEM_KEY].maximize) {
        pointsVars
          .map<Var>((v) => ({
            name: v.name,
            coef: v.coef * Math.pow(MAXIMIZE_OBJECTIVE_WEIGHT, this.outputs[POINTS_ITEM_KEY].value),
          }))
          .forEach((v) => {
            const existingVar = model.objective.vars.find((ov) => ov.name === v.name);
            if (existingVar) {
              existingVar.coef += v.coef;
            } else {
              model.objective.vars.push(v);
            }
          });
      } else {
        model.subjectTo.push({
          name: 'AWESOME Sink Points constraint',
          vars: pointsVars,
          bnds: { type: glpk.GLP_UP, ub: -this.outputs[POINTS_ITEM_KEY].value, lb: NaN },
        });
      }
    }

    for (const [itemKey, itemInfo] of Object.entries(items)) {
      const vars: Var[] = [];

      for (const recipeKey of itemInfo.usedInRecipes) {
        if (!this.allowedRecipes[recipeKey]) continue;
        const recipeInfo = recipes[recipeKey];
        const target = recipeInfo.ingredients.find((i) => i.itemClass === itemKey)!;
        vars.push({ name: recipeKey, coef: target.perMinute });
      }

      for (const recipeKey of itemInfo.producedFromRecipes) {
        if (!this.allowedRecipes[recipeKey]) continue;
        const recipeInfo = recipes[recipeKey];
        const target = recipeInfo.products.find((p) => p.itemClass === itemKey)!;
        const existingVar = vars.find((v) => v.name === recipeKey);
        if (existingVar) {
          existingVar.coef -= target.perMinute;
        } else {
          vars.push({ name: recipeKey, coef: -target.perMinute });
        }
      }

      if (vars.length === 0) continue;

      let objectiveVars: Var[] = [];

      if (this.inputs[itemKey]) {
        const inputInfo = this.inputs[itemKey];
        if (inputInfo.amount !== Infinity) {
          model.subjectTo.push({
            name: `${itemKey} resource constraint`,
            vars,
            bnds: { type: glpk.GLP_UP, ub: inputInfo.amount, lb: NaN },
          });
        }

        if (inputInfo.type === NODE_TYPE.RESOURCE || inputInfo.type === NODE_TYPE.HAND_GATHERED_RESOURCE) {
          objectiveVars = vars
            .filter((v) => v.coef > 0)
            .map<Var>((v) => ({
              name: v.name,
              coef: v.coef * inputInfo.weight * this.globalWeights.resources,
            }));
        }
      }

      else if (this.outputs[itemKey]) {
        const outputInfo = this.outputs[itemKey];
        if (outputInfo.maximize) {
          model.subjectTo.push({
            name: `${itemKey} final product constraint`,
            vars,
            bnds: { type: glpk.GLP_UP, ub: 0, lb: NaN },
          });

          objectiveVars = vars.map<Var>((v) => ({
            name: v.name,
            coef: v.coef * Math.pow(MAXIMIZE_OBJECTIVE_WEIGHT, outputInfo.value),
          }));

        } else {
          model.subjectTo.push({
            name: `${itemKey} final product constraint`,
            vars,
            bnds: { type: glpk.GLP_UP, ub: -outputInfo.value, lb: NaN },
          });
        }
      }

      else {
        model.subjectTo.push({
          name: `${itemKey} intermediates constraint`,
          vars,
          bnds: { type: glpk.GLP_UP, ub: 0, lb: NaN },
        });
      }

      objectiveVars.forEach((v) => {
        const existingVar = model.objective.vars.find((ov) => ov.name === v.name);
        if (existingVar) {
          existingVar.coef += v.coef;
        } else {
          model.objective.vars.push(v);
        }
      });
    }

    const solution = await glpk.solve(model, { msglev: glpk.GLP_MSG_OFF });
    if (solution.result.status !== glpk.GLP_OPT) {
      throw new Error("NO POSSIBLE SOLUTION");
    }

    const result: ProductionSolution = {};
    Object.entries(solution.result.vars).forEach(([key, val]) => {
      if (Math.abs(val) > EPSILON) {
        result[key] = val;
      }
    });
    return result;
  }

  private generateProductionGraph(productionSolution: ProductionSolution): ProductionGraph {
    const itemProductionTotals: ItemProductionTotals = {};
    const graph: ProductionGraph = {
      nodes: {},
      edges: [],
    };

    for (const [recipeKey, multiplier] of Object.entries(productionSolution)) {
      const recipeInfo = recipes[recipeKey];

      for (const product of recipeInfo.products) {
        const amount = multiplier * product.perMinute;
        if (!itemProductionTotals[product.itemClass]) {
          itemProductionTotals[product.itemClass] = {
            producedBy: [],
            usedBy: [],
          };
        }
        itemProductionTotals[product.itemClass].producedBy.push({ recipeKey, amount });
      }

      for (const ingredient of recipeInfo.ingredients) {
        const amount = multiplier * ingredient.perMinute;
        if (!itemProductionTotals[ingredient.itemClass]) {
          itemProductionTotals[ingredient.itemClass] = {
            producedBy: [],
            usedBy: [],
          };
        }
        itemProductionTotals[ingredient.itemClass].usedBy.push({ recipeKey, amount });
      }

      graph.nodes[recipeKey] = {
        id: nanoid(),
        key: recipeKey,
        type: NODE_TYPE.RECIPE,
        multiplier,
      };
    }

    for (const [itemKey, productionTotals] of Object.entries(itemProductionTotals)) {
      const { producedBy, usedBy } = productionTotals;
      let i = 0, j = 0;
      nextDemand:
      while (i < usedBy.length) {
        const usageInfo = usedBy[i];
        const usageNode = graph.nodes[usageInfo.recipeKey];

        while (j < producedBy.length) {
          const productionInfo = producedBy[j];
          const productionNode = graph.nodes[productionInfo.recipeKey];

          const outputRecipe = this.outputs[itemKey]?.recipe;
          if (outputRecipe && outputRecipe === productionInfo.recipeKey) {
            const outputInfo = this.outputs[itemKey];
            const recipeInfo = recipes[outputRecipe];
            const target = recipeInfo.products.find((p) => p.itemClass === itemKey)!;
            const recipeAmount = outputInfo.value * target.perMinute;
            productionInfo.amount -= recipeAmount;

            let itemNode = graph.nodes[itemKey];
            if (!itemNode) {
              itemNode = {
                id: nanoid(),
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
            i++;
            continue nextDemand;
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
          j++;
        }
        break;
      }

      while (i < usedBy.length) {
        const usageInfo = usedBy[i];
        const usageNode = graph.nodes[usageInfo.recipeKey];
        if (usageInfo.amount > EPSILON && this.inputs[itemKey]) {
          let itemNode = graph.nodes[itemKey];
          if (!itemNode) {
            const inputInfo = this.inputs[itemKey];
            itemNode = {
              id: nanoid(),
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
        if (productionInfo.amount > EPSILON) {
          let itemNode = graph.nodes[itemKey];
          if (!itemNode) {
            itemNode = {
              id: nanoid(),
              key: itemKey,
              type: this.outputs[itemKey] || this.outputs[POINTS_ITEM_KEY] ? NODE_TYPE.FINAL_PRODUCT : NODE_TYPE.SIDE_PRODUCT,
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

  private generateProductionReport(productionGraph: ProductionGraph): Report {
    const report: Report = {
      pointsProduced: 0,
      powerUsageEstimate: 0,
      resourceEfficiencyScore: 0,
      totalBuildArea: 0,
      estimatedFoundations: 0,
      buildingsUsed: {},
      totalMaterialCost: {},
    };

    for (const [key, node] of Object.entries(productionGraph.nodes)) {
      if (node.type === NODE_TYPE.RECIPE) {
        const recipeInfo = recipes[key];
        const buildingKey = recipeInfo.producedIn;
        const buildingInfo = buildings[buildingKey];

        report.powerUsageEstimate += node.multiplier * buildingInfo.power;
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

      const itemInfo = items[key];
      if (node.type === NODE_TYPE.FINAL_PRODUCT) {
        report.pointsProduced += node.multiplier * itemInfo.sinkPoints;
      } else if (node.type === NODE_TYPE.RESOURCE) {
        report.resourceEfficiencyScore += node.multiplier * this.inputs[key].weight;
      }
    }

    report.estimatedFoundations = Math.ceil(2 * (report.totalBuildArea / 64));

    return report;
  }
}
