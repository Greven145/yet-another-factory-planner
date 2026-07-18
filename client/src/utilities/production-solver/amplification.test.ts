import { describe, it, expect } from 'vitest';
import {
  buildVariant,
  getRecipeVariants,
  sloopSlotsFor,
  variantKey,
  parseVariantKey,
  OC_POWER_MULT,
} from './amplification';

describe('amplification variant multipliers', () => {
  it('base variant is a no-op', () => {
    expect(buildVariant('', 1)).toEqual({ suffix: '', inputMult: 1, outputMult: 1, powerMult: 1, sloops: 0, shards: 0 });
  });

  it('full amplification: 2x output, 4x power, no extra input, consumes all sloop slots', () => {
    const v = buildVariant('AMP', 4);
    expect(v.inputMult).toBe(1);
    expect(v.outputMult).toBe(2);
    expect(v.powerMult).toBe(4);
    expect(v.sloops).toBe(4);
    expect(v.shards).toBe(0);
  });

  it('full overclock: 2.5x throughput both sides, ~3.3577x power, consumes 3 shards', () => {
    const v = buildVariant('OC', 1);
    expect(v.inputMult).toBe(2.5);
    expect(v.outputMult).toBe(2.5);
    expect(v.powerMult).toBeCloseTo(3.3577, 3);
    expect(v.sloops).toBe(0);
    expect(v.shards).toBe(3);
  });

  it('combined amp+oc: 2.5x input, 5x output, ~13.431x power, consumes sloops and shards', () => {
    const v = buildVariant('AMPOC', 2);
    expect(v.inputMult).toBe(2.5);
    expect(v.outputMult).toBe(5);
    expect(v.powerMult).toBeCloseTo(13.431, 2);
    expect(v.sloops).toBe(2);
    expect(v.shards).toBe(3);
  });

  it('OC_POWER_MULT equals 2.5 raised to log2(2.5)', () => {
    expect(OC_POWER_MULT).toBeCloseTo(3.3577, 3);
  });
});

describe('slot data', () => {
  it('maps known buildings to their somersloop slot counts', () => {
    expect(sloopSlotsFor('Desc_SmelterMk1_C')).toBe(1);
    expect(sloopSlotsFor('Desc_ConstructorMk1_C')).toBe(1);
    expect(sloopSlotsFor('Desc_AssemblerMk1_C')).toBe(2);
    expect(sloopSlotsFor('Desc_ManufacturerMk1_C')).toBe(4);
    expect(sloopSlotsFor('Desc_HadronCollider_C')).toBe(4);
  });

  it('returns 0 for buildings without sloop slots', () => {
    expect(sloopSlotsFor('Desc_Packager_C')).toBe(0);
    expect(sloopSlotsFor('Desc_GeneratorNuclear_C')).toBe(0);
    expect(sloopSlotsFor('Desc_UnknownBuilding_C')).toBe(0);
  });
});

describe('getRecipeVariants gating', () => {
  const power = 4; // a positive-power consumer

  it('offers only the base variant when both budgets are 0', () => {
    const variants = getRecipeVariants('Desc_ConstructorMk1_C', power, 0, 0);
    expect(variants.map((v) => v.suffix)).toEqual(['']);
  });

  it('adds AMP when sloops are available and the building has slots', () => {
    const variants = getRecipeVariants('Desc_ConstructorMk1_C', power, 10, 0);
    expect(variants.map((v) => v.suffix)).toEqual(['', 'AMP']);
  });

  it('does not add AMP for a building without sloop slots', () => {
    const variants = getRecipeVariants('Desc_Packager_C', power, 10, 0);
    expect(variants.map((v) => v.suffix)).toEqual(['']);
  });

  it('adds OC when shards are available and the building consumes power', () => {
    const variants = getRecipeVariants('Desc_ConstructorMk1_C', power, 0, 10);
    expect(variants.map((v) => v.suffix)).toEqual(['', 'OC']);
  });

  it('does not add OC for a generator (power < 0)', () => {
    const variants = getRecipeVariants('Desc_GeneratorNuclear_C', -2500, 0, 10);
    expect(variants.map((v) => v.suffix)).toEqual(['']);
  });

  it('offers all four variants when both budgets are available', () => {
    const variants = getRecipeVariants('Desc_ManufacturerMk1_C', power, 10, 10);
    expect(variants.map((v) => v.suffix)).toEqual(['', 'AMP', 'OC', 'AMPOC']);
  });
});

describe('variant key round-trip', () => {
  it('keeps the bare recipe key for the base variant', () => {
    expect(variantKey('Recipe_IronPlate_C', '')).toBe('Recipe_IronPlate_C');
    expect(parseVariantKey('Recipe_IronPlate_C')).toEqual({ baseRecipeKey: 'Recipe_IronPlate_C', suffix: '' });
  });

  it('suffixes and parses boost variants', () => {
    const key = variantKey('Recipe_IronPlate_C', 'AMPOC');
    expect(key).toBe('Recipe_IronPlate_C::AMPOC');
    expect(parseVariantKey(key)).toEqual({ baseRecipeKey: 'Recipe_IronPlate_C', suffix: 'AMPOC' });
  });
});
