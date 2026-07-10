import { describe, it, expect, vi } from 'vitest';
import { hydrateSharedFactory } from './hydrate';
import { encode } from './codec';
import { FactoryOptions } from '../../contexts/production/types';
import { GameData } from '../../contexts/gameData/types';

// Minimal game data fixture (mirrors reducer.test.ts) so hydrate can build a fresh
// initial state and map the decoded payload onto it.
const mockGameData: GameData = {
  buildings: {
    Build_ConstructorMk1_C: { slug: 'constructor', name: 'Constructor', power: 4, area: 100, buildCost: [], isFicsmas: false },
    Build_SmelterMk1_C: { slug: 'smelter', name: 'Smelter', power: 4, area: 54, buildCost: [], isFicsmas: false },
  },
  recipes: {
    Recipe_IronIngot_C: { slug: 'iron_ingot', name: 'Iron Ingot', isAlternate: false, ingredients: [{ itemClass: 'Desc_OreIron_C', perMinute: 30 }], products: [{ itemClass: 'Desc_IronIngot_C', perMinute: 30 }], producedIn: 'Build_SmelterMk1_C', isFicsmas: false },
    Recipe_IronPlate_C: { slug: 'iron_plate', name: 'Iron Plate', isAlternate: false, ingredients: [{ itemClass: 'Desc_IronIngot_C', perMinute: 30 }], products: [{ itemClass: 'Desc_IronPlate_C', perMinute: 20 }], producedIn: 'Build_ConstructorMk1_C', isFicsmas: false },
    Recipe_AlternateIronPlate_C: { slug: 'alt_iron_plate', name: 'Alternate Iron Plate', isAlternate: true, ingredients: [{ itemClass: 'Desc_IronIngot_C', perMinute: 20 }], products: [{ itemClass: 'Desc_IronPlate_C', perMinute: 25 }], producedIn: 'Build_ConstructorMk1_C', isFicsmas: false },
  },
  resources: {
    Desc_OreIron_C: { itemClass: 'Desc_OreIron_C', maxExtraction: 70380, relativeValue: 1 },
    Desc_OreCopper_C: { itemClass: 'Desc_OreCopper_C', maxExtraction: 28860, relativeValue: 2 },
    Desc_Water_C: { itemClass: 'Desc_Water_C', maxExtraction: null, relativeValue: 0 },
  },
  items: {
    Desc_OreIron_C: { slug: 'iron_ore', name: 'Iron Ore', sinkPoints: 1, isFluid: false, usedInRecipes: [], producedFromRecipes: [], isFicsmas: false },
    Desc_IronIngot_C: { slug: 'iron_ingot', name: 'Iron Ingot', sinkPoints: 2, isFluid: false, usedInRecipes: [], producedFromRecipes: [], isFicsmas: false },
    Desc_IronPlate_C: { slug: 'iron_plate', name: 'Iron Plate', sinkPoints: 6, isFluid: false, usedInRecipes: [], producedFromRecipes: [], isFicsmas: false },
  },
  handGatheredItems: {},
};

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
    weightingOptions: { resources: '500', power: '10', complexity: '5', buildings: '3' },
    gameModeOptions: { recipePartsCost: '1', powerConsumption: '1' },
    allowedRecipes: {
      Recipe_IronIngot_C: true,
      Recipe_IronPlate_C: true,
      Recipe_AlternateIronPlate_C: false,
    },
    allowedBuildings: {
      Build_SmelterMk1_C: true,
      Build_ConstructorMk1_C: false,
    },
    nodesPositions: [{ key: 'node1', x: 10, y: 20 }],
    maximizeBalanceMode: 'TRUE_MAXIMIZE' as any,
    transportOptions: { beltCapacity: null, pipeCapacity: null },
  };
}

describe('hydrateSharedFactory', () => {
  it('round-trips encode -> wire -> hydrate for the meaningful fields', () => {
    const config = sampleConfig();
    const wire = encode(config, '1.2');
    const result = hydrateSharedFactory(wire, mockGameData);

    expect(result.productionItems).toHaveLength(2);
    expect(result.productionItems[0]).toMatchObject({ itemKey: 'Desc_IronPlate_C', mode: 'per-minute', value: '20' });
    expect(result.productionItems[1]).toMatchObject({ itemKey: 'Desc_IronIngot_C', mode: 'maximize', value: '5' });

    expect(result.inputItems).toHaveLength(1);
    expect(result.inputItems[0]).toMatchObject({ itemKey: 'Desc_IronIngot_C', value: '100', weight: '0', unlimited: false });

    const iron = result.inputResources.find((r) => r.itemKey === 'Desc_OreIron_C')!;
    expect(iron.value).toBe('5000');
    expect(iron.weight).toBe('1');

    expect(result.allowHandGatheredItems).toBe(true);
    expect(result.weightingOptions).toEqual(config.weightingOptions);
    expect(result.gameModeOptions).toEqual(config.gameModeOptions);

    expect(result.allowedRecipes.Recipe_IronIngot_C).toBe(true);
    expect(result.allowedRecipes.Recipe_IronPlate_C).toBe(true);
    // alternate stays off (encode drops it; hydrate only flips listed keys on)
    expect(result.allowedRecipes.Recipe_AlternateIronPlate_C).toBe(false);

    // allowedBuildings is a full overwrite from the enabled set
    expect(result.allowedBuildings.Build_SmelterMk1_C).toBe(true);
    expect(result.allowedBuildings.Build_ConstructorMk1_C).toBe(false);

    expect(result.nodesPositions).toEqual(config.nodesPositions);
  });

  it('leaves all buildings enabled when the wire omits allowedBuildings (pre-feature share)', () => {
    const wire = encode(sampleConfig(), '1.2') as any;
    delete wire.allowedBuildings;
    const result = hydrateSharedFactory(wire, mockGameData);
    expect(result.allowedBuildings.Build_SmelterMk1_C).toBe(true);
    expect(result.allowedBuildings.Build_ConstructorMk1_C).toBe(true);
  });

  it('falls back to a fresh initial state on a malformed payload', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = hydrateSharedFactory(null as any, mockGameData);
    expect(result.productionItems).toEqual([]);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
