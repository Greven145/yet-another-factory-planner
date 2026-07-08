import { describe, it, expect } from 'vitest';
import { buildProductionGoalOptions } from './index';
import { GameData } from '../../../../contexts/gameData/types';
import { POINTS_ITEM_KEY } from '../../../../utilities/production-solver/models';
import gameData_1_2 from '../../../../data/1.2';

describe('buildProductionGoalOptions', () => {
  it('always offers AWESOME Sink Points first', () => {
    const opts = buildProductionGoalOptions(gameData_1_2);
    expect(opts[0]).toEqual({ value: POINTS_ITEM_KEY, label: 'AWESOME Sink Points (x1000)' });
  });

  it('includes base resources that a recipe can produce (Crude Oil, Water, Nitrogen Gas)', () => {
    const values = new Set(buildProductionGoalOptions(gameData_1_2).map((o) => o.value));
    // These are base resources but each has a producing recipe (unpackage recipes), so they
    // are legitimate production goals. Regression guard for the dropped `!resources[key]` filter.
    expect(values.has('Desc_LiquidOil_C')).toBe(true); // Crude Oil <- Unpackage Oil
    expect(values.has('Desc_Water_C')).toBe(true);     // Water <- Unpackage Water
    expect(values.has('Desc_NitrogenGas_C')).toBe(true); // Nitrogen Gas <- Unpackage Nitrogen Gas
  });

  it('excludes resources that no recipe can produce (SAM)', () => {
    const values = new Set(buildProductionGoalOptions(gameData_1_2).map((o) => o.value));
    expect(values.has('Desc_SAM_C')).toBe(false);
  });

  it('excludes any item with no producing recipe and keeps producible ones', () => {
    const gameData = {
      items: {
        Producible: { name: 'Producible', producedFromRecipes: ['R1'] },
        RawOnly: { name: 'RawOnly', producedFromRecipes: [] },
      },
    } as unknown as GameData;

    const values = buildProductionGoalOptions(gameData).map((o) => o.value);
    expect(values).toContain('Producible');
    expect(values).not.toContain('RawOnly');
  });

  it('sorts item labels alphabetically after the points entry', () => {
    const gameData = {
      items: {
        b: { name: 'Beta', producedFromRecipes: ['R'] },
        a: { name: 'Alpha', producedFromRecipes: ['R'] },
        c: { name: 'Gamma', producedFromRecipes: ['R'] },
      },
    } as unknown as GameData;

    const labels = buildProductionGoalOptions(gameData).map((o) => o.label);
    expect(labels).toEqual(['AWESOME Sink Points (x1000)', 'Alpha', 'Beta', 'Gamma']);
  });
});
