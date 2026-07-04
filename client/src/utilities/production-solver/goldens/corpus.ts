import type {
  FactoryOptions,
  ProductionItemOptions,
  InputItemOptions,
} from '../../../contexts/production/types';
import type { GameData } from '../../../contexts/gameData/types';
import { getInitialState } from '../../../contexts/production/reducer';
import { POINTS_ITEM_KEY } from '../models';
import {
  GOLDEN_GAME_VERSIONS,
  GoldenGameVersion,
  loadGoldenGameData,
} from './gameData';
// Seeds are committed JSON, imported statically. (Vite only asset-resolves the
// game-data.json `new URL(..., import.meta.url)` path under vitest — a readFileSync
// against ./seeds/* resolves to a non-file URL and throws — so import them directly.)
import seedRateFuelMaximize from './seeds/packagedoil-rate-fuel-maximize.json';
import seedFuelComplexityMax from './seeds/packagedoil-fuel-complexity-max.json';
import seedFuelBothRate from './seeds/packagedoil-fuel-both-rate.json';
import seedEightTargetsIronCapped from './seeds/eight-targets-iron-capped.json';

/**
 * A single golden regression case. A separate driver re-solves `input` against the
 * committed GameData snapshot for `gameVersion` and diffs the result against a stored
 * fixture. `expectError` marks cases whose solve should yield `SolverResults.error`
 * (a null graph) rather than a factory.
 *
 * `name` is unique, kebab-case, and stable: it becomes the fixture filename AND the
 * deterministic `input.key`, so nothing about a case is allowed to depend on random
 * ids (see `finalize`).
 */
export type GoldenCase = {
  name: string;
  gameVersion: '1.1' | '1.2';
  input: FactoryOptions;
  expectError?: boolean;
};

// ---------------------------------------------------------------------------
// Determinism plumbing
//
// getInitialState() seeds `key` (and every added production/input item) with
// nanoid(), which would make the serialized corpus non-reproducible run-to-run.
// Every generated case is therefore funneled through `finalize`, which overwrites
// those ids with a fixed, name-derived scheme. Resource keys are already the
// deterministic resource itemClass, so they are left untouched.
// ---------------------------------------------------------------------------

function finalize(
  name: string,
  gameVersion: GoldenGameVersion,
  input: FactoryOptions,
  expectError?: boolean,
): GoldenCase {
  input.key = name;
  input.productionItems.forEach((p, i) => { p.key = `${name}-prod-${i}`; });
  input.inputItems.forEach((item, i) => { item.key = `${name}-input-${i}`; });
  return expectError
    ? { name, gameVersion, input, expectError: true }
    : { name, gameVersion, input };
}

/**
 * Build a case from a mutation applied to a fresh `getInitialState` base, then
 * stamp deterministic keys. `mutate` receives the GameData snapshot so recipe/
 * building keys can be DERIVED (never hardcoded) at generation time.
 */
function makeCase(
  name: string,
  gameVersion: GoldenGameVersion,
  mutate: (input: FactoryOptions, gameData: GameData) => void,
  expectError?: boolean,
): GoldenCase {
  const gameData = loadGoldenGameData(gameVersion);
  const input = getInitialState(gameData);
  mutate(input, gameData);
  return finalize(name, gameVersion, input, expectError);
}

// --- production-item builders (keys are filled in by finalize) ---

// All FactoryOptions numeric fields are strings; these helpers enforce that.
const rate = (itemKey: string, value: number): ProductionItemOptions =>
  ({ key: '', itemKey, mode: 'per-minute', value: String(value) });

const maximize = (itemKey: string, priority: number): ProductionItemOptions =>
  ({ key: '', itemKey, mode: 'maximize', value: String(priority) });

const recipeTarget = (itemKey: string, recipeKey: string, buildings: number): ProductionItemOptions =>
  ({ key: '', itemKey, mode: recipeKey, value: String(buildings) });

const pointsTarget = (value: number): ProductionItemOptions =>
  ({ key: '', itemKey: POINTS_ITEM_KEY, mode: 'per-minute', value: String(value) });

const freeInput = (itemKey: string, value: number): InputItemOptions =>
  ({ key: '', itemKey, value: String(value), weight: '0', unlimited: false });

// --- mutation helpers ---

/** The single non-alternate recipe whose primary product is `itemKey`. */
function baseRecipeFor(gameData: GameData, itemKey: string): string {
  const found = Object.entries(gameData.recipes).find(
    ([, r]) => !r.isAlternate && r.products[0]?.itemClass === itemKey,
  );
  if (!found) throw new Error(`no base recipe produces ${itemKey}`);
  return found[0];
}

/** Every alternate recipe whose product set includes `itemKey`. */
function alternateRecipesFor(gameData: GameData, itemKey: string): string[] {
  return Object.entries(gameData.recipes)
    .filter(([, r]) => r.isAlternate && r.products.some((p) => p.itemClass === itemKey))
    .map(([k]) => k);
}

/** Pin an input resource to a finite cap (unlimited off). */
function limitResource(input: FactoryOptions, itemKey: string, value: number): void {
  const r = input.inputResources.find((x) => x.itemKey === itemKey);
  if (r) { r.value = String(value); r.unlimited = false; }
}

// ---------------------------------------------------------------------------
// The corpus. Breadth over depth: every case is deliberately tiny so solves stay
// fast and byte-stable. MILP (complexity > 0) cases are kept minimal to avoid the
// solver's 3s TIME_LIMIT.
// ---------------------------------------------------------------------------

const GENERATED: GoldenCase[] = [
  // --- Axis 1: target modes ---
  makeCase('rate-ironplate-60', '1.1', (input) => {
    input.productionItems = [rate('Desc_IronPlate_C', 60)];
  }),
  makeCase('rate-multi-item', '1.2', (input) => {
    input.productionItems = [
      rate('Desc_IronPlate_C', 60),
      rate('Desc_IronRod_C', 30),
      rate('Desc_Wire_C', 45),
    ];
  }),
  makeCase('rate-cable-chain', '1.2', (input) => {
    input.productionItems = [rate('Desc_Cable_C', 30)];
  }),
  makeCase('rate-concrete-60', '1.2', (input) => {
    input.productionItems = [rate('Desc_Cement_C', 60)];
  }),
  makeCase('rate-plastic-30', '1.2', (input) => {
    input.productionItems = [rate('Desc_Plastic_C', 30)];
  }),
  makeCase('rate-liquidfuel-60', '1.2', (input) => {
    input.productionItems = [rate('Desc_LiquidFuel_C', 60)];
  }),
  makeCase('maximize-ironplate-single', '1.2', (input) => {
    input.productionItems = [maximize('Desc_IronPlate_C', 1)];
  }),
  makeCase('maximize-wire-single', '1.1', (input) => {
    input.productionItems = [maximize('Desc_Wire_C', 1)];
  }),
  makeCase('recipe-target-ironingot-2', '1.2', (input, gameData) => {
    input.productionItems = [
      recipeTarget('Desc_IronIngot_C', baseRecipeFor(gameData, 'Desc_IronIngot_C'), 2),
    ];
  }),
  makeCase('recipe-target-ironplate-3', '1.2', (input, gameData) => {
    input.productionItems = [
      recipeTarget('Desc_IronPlate_C', baseRecipeFor(gameData, 'Desc_IronPlate_C'), 3),
    ];
  }),
  makeCase('points-target-rate', '1.2', (input) => {
    input.productionItems = [pointsTarget(1000)];
  }),

  // --- Axis 2: multi-maximize + balance mode ---
  makeCase('multi-maximize-proportional', '1.2', (input) => {
    input.productionItems = [maximize('Desc_IronPlate_C', 1), maximize('Desc_IronRod_C', 1)];
    input.maximizeBalanceMode = 'proportional';
  }),
  makeCase('multi-maximize-equal', '1.2', (input) => {
    input.productionItems = [maximize('Desc_IronPlate_C', 1), maximize('Desc_IronRod_C', 1)];
    input.maximizeBalanceMode = 'equal';
  }),
  makeCase('multi-maximize-distinct-priority', '1.2', (input) => {
    input.productionItems = [maximize('Desc_IronPlate_C', 2), maximize('Desc_IronRod_C', 1)];
  }),
  makeCase('multi-maximize-three-equal', '1.2', (input) => {
    input.productionItems = [
      maximize('Desc_IronPlate_C', 1),
      maximize('Desc_IronRod_C', 1),
      maximize('Desc_Wire_C', 1),
    ];
    input.maximizeBalanceMode = 'equal';
  }),

  // --- Axis 3: weightings (keep MILP cases tiny) ---
  makeCase('weight-complexity-zero-baseline', '1.2', (input) => {
    input.productionItems = [rate('Desc_IronPlate_C', 60)];
    input.weightingOptions = { resources: '1000', power: '1', complexity: '0', buildings: '0' };
  }),
  makeCase('weight-complexity-nonzero-small', '1.2', (input) => {
    input.productionItems = [rate('Desc_IronPlate_C', 60)];
    input.weightingOptions = { resources: '1000', power: '1', complexity: '10', buildings: '0' };
  }),
  makeCase('weight-buildings-single-nonzero', '1.2', (input) => {
    input.productionItems = [rate('Desc_IronPlate_C', 60)];
    input.weightingOptions = { resources: '1', power: '1', complexity: '0', buildings: '1000' };
  }),
  makeCase('weight-power-priority', '1.2', (input) => {
    input.productionItems = [rate('Desc_IronPlate_C', 60)];
    input.weightingOptions = { resources: '1', power: '1000', complexity: '0', buildings: '1' };
  }),
  makeCase('weight-resources-complexity-swap', '1.2', (input) => {
    input.productionItems = [rate('Desc_IronPlate_C', 60)];
    input.weightingOptions = { resources: '1', power: '1', complexity: '1000', buildings: '0' };
  }),

  // --- Axis 4: game mode multipliers ---
  makeCase('gamemode-recipeparts-2x', '1.2', (input) => {
    input.productionItems = [rate('Desc_IronPlate_C', 60)];
    input.gameModeOptions = { recipePartsCost: '2', powerConsumption: '1' };
  }),
  makeCase('gamemode-power-half', '1.2', (input) => {
    input.productionItems = [rate('Desc_IronPlate_C', 60)];
    input.gameModeOptions = { recipePartsCost: '1', powerConsumption: '0.5' };
  }),
  makeCase('gamemode-both-multipliers', '1.2', (input) => {
    input.productionItems = [rate('Desc_IronPlate_C', 60)];
    input.gameModeOptions = { recipePartsCost: '2', powerConsumption: '0.5' };
  }),

  // --- Axis 5: transport caps ---
  makeCase('transport-belt-120-fits', '1.2', (input) => {
    input.productionItems = [rate('Desc_IronIngot_C', 100)];
    input.transportOptions = { beltCapacity: '120', pipeCapacity: null };
  }),
  makeCase('transport-pipe-300-fits', '1.2', (input) => {
    input.productionItems = [rate('Desc_LiquidFuel_C', 60)];
    input.transportOptions = { beltCapacity: null, pipeCapacity: '300' };
  }),

  // --- Axis 6: disabled recipes / buildings ---
  makeCase('alt-recipes-enabled', '1.2', (input, gameData) => {
    input.productionItems = [maximize('Desc_IronIngot_C', 1)];
    alternateRecipesFor(gameData, 'Desc_IronIngot_C').forEach((k) => {
      input.allowedRecipes[k] = true;
    });
  }),
  makeCase('building-disabled-fallback', '1.2', (input, gameData) => {
    // Disable the standard smelter route and open the foundry alternate, forcing the
    // iron-ingot supply chain onto a different building.
    input.productionItems = [rate('Desc_IronIngot_C', 30)];
    input.allowedRecipes['Recipe_Alternate_IngotIron_C'] = true;
    input.allowedBuildings['Desc_SmelterMk1_C'] = false;
  }),

  // --- Axis 7: hand-gathered / limited resource / free input ---
  makeCase('hand-gathered-on', '1.2', (input) => {
    input.productionItems = [rate('Desc_IronPlate_C', 60)];
    input.allowHandGatheredItems = true;
  }),
  makeCase('limited-resource-finite', '1.2', (input) => {
    // Bound a maximize target by capping its sole raw input.
    input.productionItems = [maximize('Desc_IronIngot_C', 1)];
    limitResource(input, 'Desc_OreIron_C', 120);
  }),
  makeCase('free-input-item', '1.2', (input) => {
    // A zero-weight free ingot supply the solver can lean on instead of smelting.
    input.productionItems = [rate('Desc_IronPlate_C', 60)];
    input.inputItems = [freeInput('Desc_IronIngot_C', 60)];
  }),

  // --- Axis 8: error paths (verified against solver error conditions) ---
  makeCase('error-no-outputs', '1.2', (input) => {
    // Empty target set -> "SOLUTION IS EMPTY".
    input.productionItems = [];
  }, true),
  makeCase('error-target-disabled-recipe', '1.2', (input, gameData) => {
    // Disable the only recipe that can make the target, with no input to source it -> infeasible.
    input.productionItems = [rate('Desc_IronIngot_C', 60)];
    input.allowedRecipes[baseRecipeFor(gameData, 'Desc_IronIngot_C')] = false;
  }, true),
  makeCase('error-infeasible-resource-starved', '1.2', (input) => {
    // Far more plate demanded than 1 ore/min could ever supply -> infeasible.
    input.productionItems = [rate('Desc_IronPlate_C', 99999)];
    limitResource(input, 'Desc_OreIron_C', 1);
  }, true),
  makeCase('error-transport-belt-too-low', '1.2', (input) => {
    // 100/min target through a 60/min belt -> "BELT/PIPE CAPACITY TOO LOW".
    input.productionItems = [rate('Desc_IronIngot_C', 100)];
    input.transportOptions = { beltCapacity: '60', pipeCapacity: null };
  }, true),

  // --- Axis 9: complex / real-world-shaped factories (hand-authored) ---

  // Deep end-game chain: AI Expansion Server pulls the whole quantum tree
  // (Space Elevator Part 6, Temporal Processor, Quantum Oscillator, Quantum Energy)
  // and emits a Dark Energy byproduct. Small rate keeps the (large) graph fast.
  makeCase('complex-ai-expansion-server', '1.2', (input) => {
    input.productionItems = [rate('Desc_SpaceElevatorPart_12_C', 2)];
    input.allowHandGatheredItems = true;
  }, false),

  // Plastic <-> Rubber recycling loop: enabling both Recycled recipes (Rubber+Fuel
  // -> Plastic and Plastic+Fuel -> Rubber) creates a genuine production cycle,
  // exercising the loop detection / loopWarning path.
  makeCase('plastic-rubber-recycle-loop', '1.2', (input) => {
    input.productionItems = [rate('Desc_Plastic_C', 30), rate('Desc_Rubber_C', 30)];
    input.allowedRecipes['Recipe_Alternate_Plastic_1_C'] = true;      // Recycled Plastic
    input.allowedRecipes['Recipe_Alternate_RecycledRubber_C'] = true; // Recycled Rubber
  }, false),

  // Inputs added: supply Reinforced Iron Plate and Iron Rod as weighted (non-free)
  // inputs so the solver trades off importing intermediates vs building them.
  makeCase('inputs-added-modular-frame', '1.2', (input) => {
    input.productionItems = [rate('Desc_ModularFrame_C', 10)];
    input.inputItems = [
      { key: '', itemKey: 'Desc_IronPlateReinforced_C', value: '15', weight: '10', unlimited: false },
      { key: '', itemKey: 'Desc_IronRod_C', value: '60', weight: '5', unlimited: false },
    ];
  }, false),

  // A recipe the default solution WOULD use is disabled: turn off base Iron Plate and
  // open the Coated Iron Plate alternate (Iron Ingot + Plastic), forcing the plate
  // supply onto an entirely different, deeper route.
  makeCase('used-recipe-disabled-coated-plate', '1.2', (input) => {
    input.productionItems = [rate('Desc_IronPlate_C', 60)];
    input.allowedRecipes['Recipe_IronPlate_C'] = false;               // disable the used base recipe
    input.allowedRecipes['Recipe_Alternate_CoatedIronPlate_C'] = true; // force the alternate
  }, false),

  // Fuel plan with the Blender turned off: enable the (Blender-only) Diluted Fuel
  // alternate but disable the Blender building, so the solver must fall back to the
  // refinery Fuel / Residual Fuel routes instead of the efficient blended one.
  makeCase('fuel-plan-blender-off', '1.2', (input) => {
    input.productionItems = [maximize('Desc_LiquidFuel_C', 1)];
    input.allowedRecipes['Recipe_Alternate_DilutedFuel_C'] = true;
    input.allowedBuildings['Desc_Blender_C'] = false;
  }, false),
];

// ---------------------------------------------------------------------------
// Combinatorial interaction coverage. The OFAT cases above move one axis at a
// time; these take the full cartesian product of the highest-risk axes so every
// COMBINATION of {target mode x LP/MILP x game-mode x transport} is exercised
// (interaction bugs OFAT can't see). Each combo is deliberately tiny so MILP
// solves stay well under the 3s TIME_LIMIT. `expectError` is left undefined:
// whatever the solver does is frozen in the baseline and drift is caught by the
// output diff.
// ---------------------------------------------------------------------------

type TargetAxis = { id: string; apply: (input: FactoryOptions, gameData: GameData) => void };

const AXIS_TARGET: TargetAxis[] = [
  { id: 'rate', apply: (input) => { input.productionItems = [rate('Desc_IronPlate_C', 60)]; } },
  { id: 'max', apply: (input) => { input.productionItems = [maximize('Desc_IronPlate_C', 1)]; } },
  { id: 'recipe', apply: (input, gd) => { input.productionItems = [recipeTarget('Desc_IronIngot_C', baseRecipeFor(gd, 'Desc_IronIngot_C'), 2)]; } },
  // NOTE: a `points` target is deliberately excluded from the interaction cartesian.
  // Points maximization produces huge item throughput (blows any belt cap -> mass
  // duplicate BELT-TOO-LOW errors) and, crossed with MILP, is a hard enough program
  // to hit the solver's 3s TIME_LIMIT -> a wall-clock-dependent "TIMED OUT" that would
  // be flaky across machines. Points is covered on its own in the OFAT set instead.
];

const AXIS_COMPLEXITY: { id: string; complexity: string }[] = [
  { id: 'lp', complexity: '0' },
  { id: 'milp', complexity: '1000' },
];

const AXIS_GAMEMODE: { id: string; opts: FactoryOptions['gameModeOptions'] }[] = [
  { id: 'gmstd', opts: { recipePartsCost: '1', powerConsumption: '1' } },
  { id: 'gmparts2', opts: { recipePartsCost: '2', powerConsumption: '1' } },
  { id: 'gmpowhalf', opts: { recipePartsCost: '1', powerConsumption: '0.5' } },
];

const AXIS_TRANSPORT: { id: string; opts: FactoryOptions['transportOptions'] }[] = [
  { id: 'txnone', opts: { beltCapacity: null, pipeCapacity: null } },
  { id: 'txbelt240', opts: { beltCapacity: '240', pipeCapacity: '600' } },
  { id: 'txbelt120', opts: { beltCapacity: '120', pipeCapacity: '300' } },
];

const INTERACTIONS: GoldenCase[] = [];
for (const t of AXIS_TARGET) {
  for (const c of AXIS_COMPLEXITY) {
    for (const g of AXIS_GAMEMODE) {
      for (const tx of AXIS_TRANSPORT) {
        const name = `x-${t.id}-${c.id}-${g.id}-${tx.id}`;
        INTERACTIONS.push(makeCase(name, '1.2', (input, gameData) => {
          t.apply(input, gameData);
          input.weightingOptions = { resources: '1000', power: '1', complexity: c.complexity, buildings: '0' };
          input.gameModeOptions = g.opts;
          input.transportOptions = tx.opts;
        }));
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Committed seed factories: real, hand-captured configs. All seeds are 1.2. The
// case name matches the source filename (it becomes the fixture filename); the
// seed's own committed `input.key` is already deterministic, so it is left as-is.
// ---------------------------------------------------------------------------

const SEED_ENTRIES: [string, unknown][] = [
  ['packagedoil-rate-fuel-maximize', seedRateFuelMaximize],
  ['packagedoil-fuel-complexity-max', seedFuelComplexityMax],
  ['packagedoil-fuel-both-rate', seedFuelBothRate],
  ['eight-targets-iron-capped', seedEightTargetsIronCapped],
];

const SEEDS: GoldenCase[] = SEED_ENTRIES.map(([name, data]) => ({
  name,
  gameVersion: '1.2',
  input: data as FactoryOptions,
}));

export const CORPUS: GoldenCase[] = [...GENERATED, ...INTERACTIONS, ...SEEDS];

// Referenced so `GOLDEN_GAME_VERSIONS` stays a live import even if all cases are
// authored with literal versions; also documents the invariant the sanity test checks.
export const CORPUS_GAME_VERSIONS = GOLDEN_GAME_VERSIONS;
