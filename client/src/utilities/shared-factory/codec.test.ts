import { describe, it, expect } from 'vitest';
import { encode, decode, toEnumName, toDisplay, WireFactory } from './codec';
import { FactoryOptions } from '../../contexts/production/types';

function sampleConfig(): FactoryOptions {
  return {
    key: 'test-key',
    productionItems: [
      { key: 'p1', itemKey: 'Desc_IronPlate_C', mode: 'per-minute', value: '20' },
      { key: 'p2', itemKey: 'Desc_IronIngot_C', mode: 'maximize', value: '5' },
    ],
    inputItems: [
      { key: 'i1', itemKey: 'Desc_IronIngot_C', value: '100', weight: '0', unlimited: false },
    ],
    inputResources: [
      { key: 'r1', itemKey: 'Desc_OreIron_C', value: '5000', weight: '1', unlimited: false },
      { key: 'r2', itemKey: 'Desc_OreCopper_C', value: '2000', weight: '2', unlimited: false },
      { key: 'r3', itemKey: 'Desc_Water_C', value: '0', weight: '0', unlimited: true },
    ],
    allowHandGatheredItems: true,
    weightingOptions: { resources: '1000', power: '1', complexity: '0', buildings: '0' },
    gameModeOptions: { recipePartsCost: '1', powerConsumption: '1' },
    allowedRecipes: {
      Recipe_IronIngot_C: true,
      Recipe_IronPlate_C: true,
      Recipe_AlternateIronPlate_C: false,
    },
    allowedBuildings: {
      Build_SmelterMk1_C: true,
      Build_ConstructorMk1_C: true,
      Build_Blender_C: false,
    },
    nodesPositions: [{ key: 'node1', x: 10, y: 20 }],
    maximizeBalanceMode: 'TRUE_MAXIMIZE' as any,
    transportOptions: { beltCapacity: null, pipeCapacity: null },
  };
}

describe('game version vocabulary', () => {
  it('maps display strings to enum names', () => {
    expect(toEnumName('1.1')).toBe('V1_1');
    expect(toEnumName('1.2')).toBe('V1_2');
  });

  it('maps enum names back to display strings', () => {
    expect(toDisplay('V1_1')).toBe('1.1');
    expect(toDisplay('V1_2')).toBe('1.2');
  });

  it('passes through unknown values', () => {
    expect(toEnumName('U5')).toBe('U5');
    expect(toDisplay('weird')).toBe('weird');
  });

  it('round-trips known versions', () => {
    expect(toDisplay(toEnumName('1.1'))).toBe('1.1');
    expect(toDisplay(toEnumName('1.2'))).toBe('1.2');
  });
});

describe('encode', () => {
  it('coerces string fields to numbers and flattens allowedRecipes', () => {
    const wire = encode(sampleConfig(), '1.2');
    expect(wire.gameVersion).toBe('V1_2');
    expect(wire.productionItems[0]).toEqual({ itemKey: 'Desc_IronPlate_C', mode: 'per-minute', value: 20 });
    expect(typeof wire.weightingOptions.resources).toBe('number');
    expect(wire.gameModeOptions).toEqual({ recipePartsCost: 1, powerConsumption: 1 });
    // only enabled recipes survive the flatten
    expect(wire.allowedRecipes).toEqual(['Recipe_IronIngot_C', 'Recipe_IronPlate_C']);
    // allowedBuildings flattens the same way: only the enabled set is stored
    expect(wire.allowedBuildings).toEqual(['Build_SmelterMk1_C', 'Build_ConstructorMk1_C']);
  });
});

describe('decode', () => {
  it('coerces numbers back to strings', () => {
    const decoded = decode(encode(sampleConfig(), '1.2'));
    expect(decoded.productionItems[0].value).toBe('20');
    expect(decoded.weightingOptions.resources).toBe('1000');
    expect(decoded.gameModeOptions).toEqual({ recipePartsCost: '1', powerConsumption: '1' });
  });

  it('yields null gameModeOptions when the wire payload omits them (pre-1.2 share)', () => {
    const wire = encode(sampleConfig(), '1.1') as Partial<WireFactory>;
    delete wire.gameModeOptions;
    const decoded = decode(wire as WireFactory);
    expect(decoded.gameModeOptions).toBeNull();
  });

  it('yields null allowedBuildings when the wire payload omits them (pre-feature share)', () => {
    const wire = encode(sampleConfig(), '1.2') as Partial<WireFactory>;
    delete wire.allowedBuildings;
    const decoded = decode(wire as WireFactory);
    expect(decoded.allowedBuildings).toBeNull();
  });
});

describe('round-trip decode(encode(x))', () => {
  it('preserves all meaningful fields', () => {
    const config = sampleConfig();
    const decoded = decode(encode(config, '1.2'));

    expect(decoded.productionItems).toEqual([
      { itemKey: 'Desc_IronPlate_C', mode: 'per-minute', value: '20' },
      { itemKey: 'Desc_IronIngot_C', mode: 'maximize', value: '5' },
    ]);
    expect(decoded.inputItems).toEqual([
      { itemKey: 'Desc_IronIngot_C', value: '100', weight: '0', unlimited: false },
    ]);
    expect(decoded.inputResources).toEqual([
      { itemKey: 'Desc_OreIron_C', value: '5000', weight: '1', unlimited: false },
      { itemKey: 'Desc_OreCopper_C', value: '2000', weight: '2', unlimited: false },
      { itemKey: 'Desc_Water_C', value: '0', weight: '0', unlimited: true },
    ]);
    expect(decoded.allowHandGatheredItems).toBe(true);
    expect(decoded.weightingOptions).toEqual(config.weightingOptions);
    expect(decoded.gameModeOptions).toEqual(config.gameModeOptions);
    // allowedRecipes is map -> filtered list on encode; decode yields the enabled keys
    expect(decoded.allowedRecipes).toEqual(['Recipe_IronIngot_C', 'Recipe_IronPlate_C']);
    expect(decoded.allowedBuildings).toEqual(['Build_SmelterMk1_C', 'Build_ConstructorMk1_C']);
    expect(decoded.nodesPositions).toEqual(config.nodesPositions);
  });
});
