// Somersloop (production amplification) and Power Shard (overclocking) modeling.
//
// The solver expresses each way of running a machine as a distinct "variant" of a
// recipe, so a linear program can pick among them. A variant's LP variable value is
// measured in *physical buildings of that variant*, and these multipliers convert it
// to throughput/power:
//   - inputMult / outputMult scale the recipe's per-minute ingredient/product rates
//   - powerMult scales the building's base power draw
//   - sloops / shards are consumed per building (checked against the global budgets)
//
// Game mechanics (Satisfactory 1.0/1.1/1.2, verified against satisfactory.wiki.gg):
//   - Overclocking: 3 power-shard slots -> up to 250% clock. Throughput scales
//     LINEARLY (inputs AND outputs); power scales by (clock/100)^1.321928.
//     Full = 2.5x throughput, 2.5^1.321928 = 3.3577x power.
//   - Amplification: somersloops boost OUTPUT ONLY (inputs unchanged). Output
//     x(1 + filled/total), power x(1 + filled/total)^2. Full = 2x output, 4x power.
//   - They stack multiplicatively: full both = 2.5x input, 5x output, 13.431x power.
//
// Slot counts are fixed in vanilla and are NOT present in the game-data JSON (nor
// carried through ParseDocs), so they live here as hand-maintained constants keyed
// by building class. Only full-boost variants are modeled (max sloops / 250% clock);
// partial overclock/amplification tiers are a deliberate future extension.
//
// Out of scope: extractor/miner overclocking (raw extraction is not a recipe in the
// solver) and generators / the Alien Power Augmenter (sloops there feed power, not
// production).

/** Somersloop slots per building. Buildings not listed have 0 (Packager, generators). */
export const SLOOP_SLOTS: Record<string, number> = {
  Desc_SmelterMk1_C: 1,
  Desc_ConstructorMk1_C: 1,
  Desc_AssemblerMk1_C: 2,
  Desc_FoundryMk1_C: 2,
  Desc_OilRefinery_C: 2,
  Desc_Converter_C: 2,
  Desc_ManufacturerMk1_C: 4,
  Desc_Blender_C: 4,
  Desc_HadronCollider_C: 4, // Particle Accelerator
  Desc_QuantumEncoder_C: 4,
};

/** Power-shard slots on any overclockable production building. */
export const SHARD_SLOTS = 3;

// Amplification (full: all somersloop slots filled).
export const AMP_OUTPUT_MULT = 2;
export const AMP_POWER_MULT = 4; // (1 + 1)^2

// Overclocking (full: 250% clock via 3 shards).
export const OC_THROUGHPUT_MULT = 2.5;
export const OC_POWER_EXPONENT = 1.321928; // log2(2.5)
export const OC_POWER_MULT = OC_THROUGHPUT_MULT ** OC_POWER_EXPONENT; // ~3.3577

export type VariantSuffix = '' | 'AMP' | 'OC' | 'AMPOC';

export type RecipeVariant = {
  suffix: VariantSuffix,
  inputMult: number,
  outputMult: number,
  powerMult: number,
  sloops: number, // per building
  shards: number, // per building
};

/** Somersloop slots for a building class (0 if it cannot take sloops). */
export function sloopSlotsFor(buildingKey: string): number {
  return SLOOP_SLOTS[buildingKey] ?? 0;
}

/** The full descriptor for a variant suffix, given the building's somersloop slots. */
export function buildVariant(suffix: VariantSuffix, sloopSlots: number): RecipeVariant {
  switch (suffix) {
    case 'AMP':
      return { suffix, inputMult: 1, outputMult: AMP_OUTPUT_MULT, powerMult: AMP_POWER_MULT, sloops: sloopSlots, shards: 0 };
    case 'OC':
      return { suffix, inputMult: OC_THROUGHPUT_MULT, outputMult: OC_THROUGHPUT_MULT, powerMult: OC_POWER_MULT, sloops: 0, shards: SHARD_SLOTS };
    case 'AMPOC':
      return {
        suffix,
        inputMult: OC_THROUGHPUT_MULT,
        outputMult: OC_THROUGHPUT_MULT * AMP_OUTPUT_MULT,
        powerMult: OC_POWER_MULT * AMP_POWER_MULT,
        sloops: sloopSlots,
        shards: SHARD_SLOTS,
      };
    case '':
    default:
      return { suffix: '', inputMult: 1, outputMult: 1, powerMult: 1, sloops: 0, shards: 0 };
  }
}

/**
 * The variants the solver should offer for a recipe produced in `buildingKey`.
 * Always includes the base variant. Boost variants are gated on both the building
 * supporting the boost and the corresponding global budget being non-zero, so with
 * both budgets at 0 the LP is identical to the un-boosted model.
 */
export function getRecipeVariants(
  buildingKey: string,
  buildingPower: number,
  availableSloops: number,
  availableShards: number,
): RecipeVariant[] {
  const sloopSlots = sloopSlotsFor(buildingKey);
  const canAmp = sloopSlots > 0 && availableSloops > 0;
  // Overclocking only applies to power consumers; generators (power < 0) are out of scope.
  const canOc = buildingPower > 0 && availableShards > 0;

  const variants: RecipeVariant[] = [buildVariant('', sloopSlots)];
  if (canAmp) variants.push(buildVariant('AMP', sloopSlots));
  if (canOc) variants.push(buildVariant('OC', sloopSlots));
  if (canAmp && canOc) variants.push(buildVariant('AMPOC', sloopSlots));
  return variants;
}

/** Short human-readable suffix for a boosted node's name (empty for the base variant). */
export function variantLabel(suffix: VariantSuffix | undefined): string {
  switch (suffix) {
    case 'AMP': return ' (amplified)';
    case 'OC': return ' (overclocked 250%)';
    case 'AMPOC': return ' (amplified + OC 250%)';
    default: return '';
  }
}

const VARIANT_SEP = '::';

/** Build the LP variable / graph-node key for a recipe variant. Base variant keeps the bare recipe key. */
export function variantKey(recipeKey: string, suffix: VariantSuffix): string {
  return suffix ? `${recipeKey}${VARIANT_SEP}${suffix}` : recipeKey;
}

/** Split a variant key back into its base recipe key and suffix. */
export function parseVariantKey(key: string): { baseRecipeKey: string, suffix: VariantSuffix } {
  const idx = key.indexOf(VARIANT_SEP);
  if (idx === -1) return { baseRecipeKey: key, suffix: '' };
  return { baseRecipeKey: key.slice(0, idx), suffix: key.slice(idx + VARIANT_SEP.length) as VariantSuffix };
}
