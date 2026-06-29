import {
  FactoryOptions,
  ProductionItemOptions,
  InputItemOptions,
  WeightingOptions,
  GameModeOptions,
  NodeInfo,
} from '../../contexts/production/types';

/**
 * The single owner of the shared-factory wire contract.
 *
 * A "shared factory" travels between the client and the server as a flattened,
 * number-coerced JSON shape (`WireFactory`). The client stores the same data as
 * `FactoryOptions`, where numeric fields are kept as strings (they back text
 * inputs) and `allowedRecipes` is a map rather than a list. This module is the
 * one place that knows how to cross that boundary:
 *   - `encode` turns the client's `FactoryOptions` into the wire shape.
 *   - `decode` turns a wire payload back into the partial `FactoryOptions` the
 *     reducer applies on top of a fresh initial state.
 *   - the game-version vocabulary (`toEnumName` / `toDisplay`) lives here too,
 *     so display strings ("1.2") and enum names ("V1_2") are mapped in exactly
 *     one spot.
 *
 * Keep encode/decode inverse for the meaningful fields; round-trip stability is
 * asserted by codec.test.ts.
 */

// ---- Game version vocabulary (single source of truth) ----

const GV_1_1 = '1.1';
const GV_1_2 = '1.2';

/** Display string -> server enum name. */
const DISPLAY_TO_ENUM_NAME: Record<string, string> = {
  [GV_1_1]: 'V1_1',
  [GV_1_2]: 'V1_2',
};

/** Server enum name -> client display string. Includes legacy versions the API may still return. */
const ENUM_NAME_TO_DISPLAY: Record<string, string> = {
  V1_2: GV_1_2,
  V1_1: GV_1_1,
  U8: 'U8',
  U7: 'U7',
  U6: 'U6',
  U5: 'U5',
};

/** Maps a client display version ("1.2") to the server enum name ("V1_2"). Unknown values pass through. */
export function toEnumName(displayVersion: string): string {
  return DISPLAY_TO_ENUM_NAME[displayVersion] ?? displayVersion;
}

/** Maps a server enum name ("V1_2") back to the client display version ("1.2"). Unknown values pass through. */
export function toDisplay(enumName: string): string {
  return ENUM_NAME_TO_DISPLAY[enumName] ?? enumName;
}

// ---- Wire shape ----

export type WireProductionItem = {
  itemKey: string,
  mode: string,
  value: number,
};

export type WireInputItem = {
  itemKey: string,
  value: number,
  weight: number,
  unlimited: boolean,
};

export type WireWeightingOptions = {
  resources: number,
  power: number,
  complexity: number,
  buildings: number,
};

export type WireGameModeOptions = {
  recipePartsCost: number,
  powerConsumption: number,
};

export type WireFactory = {
  gameVersion: string,
  productionItems: WireProductionItem[],
  inputItems: WireInputItem[],
  inputResources: WireInputItem[],
  allowHandGatheredItems: boolean,
  weightingOptions: WireWeightingOptions,
  gameModeOptions: WireGameModeOptions,
  allowedRecipes: string[],
  /** Enabled building keys. Added after 1.2; absent on older shares (= all enabled). */
  allowedBuildings?: string[],
  nodesPositions: NodeInfo[],
};

/** The slice of FactoryOptions that LOAD_FROM_SHARED_FACTORY rebuilds from a wire payload. */
export type DecodedFactory = {
  productionItems: Pick<ProductionItemOptions, 'itemKey' | 'mode' | 'value'>[],
  inputItems: Pick<InputItemOptions, 'itemKey' | 'value' | 'weight' | 'unlimited'>[],
  inputResources: Pick<InputItemOptions, 'itemKey' | 'value' | 'weight' | 'unlimited'>[],
  allowHandGatheredItems: boolean,
  weightingOptions: WeightingOptions,
  /** Present only when the wire payload included game-mode options (added in 1.2). */
  gameModeOptions: GameModeOptions | null,
  /** Recipe keys that should be marked allowed. */
  allowedRecipes: string[],
  /** Enabled building keys, or null when the share predates building selection (= all enabled). */
  allowedBuildings: string[] | null,
  nodesPositions: NodeInfo[],
};

// ---- Encode: client FactoryOptions -> wire shape ----

// A factory is shareable only if it has at least one selected product; the API
// rejects an empty production list. encode() drops unselected placeholder rows, so
// this mirrors what would actually be sent.
export function canShareFactory(config: FactoryOptions): boolean {
  return config.productionItems.some((i) => i.itemKey);
}

export function encode(config: FactoryOptions, gameVersion: string): WireFactory {
  // Drop placeholder rows that have no item selected yet: they carry no information,
  // the solver ignores them, and the API rejects them (ItemKey must not be empty).
  return {
    gameVersion: toEnumName(gameVersion),
    productionItems: config.productionItems
      .filter((i) => i.itemKey)
      .map((i) => ({
        itemKey: i.itemKey,
        mode: i.mode,
        value: Number(i.value),
      })),
    inputItems: config.inputItems
      .filter((i) => i.itemKey)
      .map((i) => ({
        itemKey: i.itemKey,
        value: Number(i.value),
        weight: Number(i.weight),
        unlimited: i.unlimited,
      })),
    inputResources: config.inputResources.map((i) => ({
      itemKey: i.itemKey,
      value: Number(i.value),
      weight: Number(i.weight),
      unlimited: i.unlimited,
    })),
    allowHandGatheredItems: config.allowHandGatheredItems,
    weightingOptions: {
      resources: Number(config.weightingOptions.resources),
      power: Number(config.weightingOptions.power),
      complexity: Number(config.weightingOptions.complexity),
      buildings: Number(config.weightingOptions.buildings),
    },
    gameModeOptions: {
      recipePartsCost: Number(config.gameModeOptions.recipePartsCost),
      powerConsumption: Number(config.gameModeOptions.powerConsumption),
    },
    allowedRecipes: Object.keys(config.allowedRecipes).filter((key) => config.allowedRecipes[key]),
    allowedBuildings: Object.keys(config.allowedBuildings).filter((key) => config.allowedBuildings[key]),
    nodesPositions: config.nodesPositions,
  };
}

// ---- Decode: wire shape -> partial FactoryOptions ----

export function decode(wire: WireFactory): DecodedFactory {
  return {
    productionItems: wire.productionItems.map((i) => ({
      itemKey: i.itemKey,
      mode: i.mode,
      value: String(i.value),
    })),
    inputItems: wire.inputItems.map((i) => ({
      itemKey: i.itemKey,
      value: String(i.value),
      weight: String(i.weight),
      unlimited: i.unlimited,
    })),
    inputResources: wire.inputResources.map((i) => ({
      itemKey: i.itemKey,
      value: String(i.value),
      weight: String(i.weight),
      unlimited: i.unlimited,
    })),
    allowHandGatheredItems: wire.allowHandGatheredItems,
    weightingOptions: {
      resources: String(wire.weightingOptions.resources),
      power: String(wire.weightingOptions.power),
      complexity: String(wire.weightingOptions.complexity),
      buildings: String(wire.weightingOptions.buildings),
    },
    // gameModeOptions added in 1.2; pre-1.2 shared factories lack it.
    gameModeOptions: wire.gameModeOptions
      ? {
          recipePartsCost: String(wire.gameModeOptions.recipePartsCost),
          powerConsumption: String(wire.gameModeOptions.powerConsumption),
        }
      : null,
    allowedRecipes: wire.allowedRecipes,
    // Building selection added after 1.2; older shares lack it => null = leave all enabled.
    allowedBuildings: wire.allowedBuildings ?? null,
    nodesPositions: wire.nodesPositions,
  };
}
