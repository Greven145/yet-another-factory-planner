import { describe, it, expect } from 'vitest';
import { ProductionSolver } from './index';
import gameData_1_2 from '../../data/1.2';
import { getInitialState } from '../../contexts/production/defaults';
import { GameData } from '../../contexts/gameData/types';
import { FactoryOptions } from '../../contexts/production/types';

const gd = gameData_1_2 as unknown as GameData;

function baseOptions(): FactoryOptions {
  const s = getInitialState(gd);
  s.productionItems = [{ key: 'p1', itemKey: 'Desc_IronPlate_C', mode: 'per-minute', value: '100' }];
  return s;
}

describe('amplification against real 1.2 game data', () => {
  it('produces the same plan and zero boost usage with no budget', async () => {
    const { report, error } = await new ProductionSolver(baseOptions(), gd).exec();
    expect(error).toBeNull();
    expect(report!.amplification.sloopsUsed).toBe(0);
    expect(report!.amplification.shardsUsed).toBe(0);
  });

  it('amplifies real recipes and respects the somersloop budget', async () => {
    const opts = baseOptions();
    opts.amplificationOptions = { availableSloops: '20', availableShards: '0' };
    const { productionGraph, report, error } = await new ProductionSolver(opts, gd).exec();
    expect(error).toBeNull();
    // At least one amplified variant node should appear (real Desc_* producedIn keys resolve).
    const ampNodes = Object.keys(productionGraph!.nodes).filter((k) => k.includes('::AMP'));
    expect(ampNodes.length).toBeGreaterThan(0);
    expect(report!.amplification.sloopsUsed).toBeGreaterThan(0);
    // Reported usage is the whole-machine requirement (an integer), not the LP's fractional value.
    expect(Number.isInteger(report!.amplification.sloopsUsed)).toBe(true);
  });

  it('never exceeds a tight sloop/shard budget on a deep real chain', async () => {
    // A many-recipe target with a tiny sloop budget and a generous shard budget: the old
    // continuous relaxation smeared fractional boosts across ~24 recipes, each rounding up in
    // the report to a whole machine (1 sloop -> 2 used, 100 shards -> 141 used). Whole-machine
    // integer boosts must keep usage within budget.
    const opts = baseOptions();
    opts.productionItems = [{ key: 'p1', itemKey: 'Desc_Computer_C', mode: 'per-minute', value: '10' }];
    opts.amplificationOptions = { availableSloops: '1', availableShards: '100' };
    const { report, error } = await new ProductionSolver(opts, gd).exec();
    expect(error).toBeNull();
    expect(report!.amplification.sloopsUsed).toBeLessThanOrEqual(report!.amplification.sloopsAvailable);
    expect(report!.amplification.shardsUsed).toBeLessThanOrEqual(report!.amplification.shardsAvailable);
    expect(Number.isInteger(report!.amplification.sloopsUsed)).toBe(true);
    expect(Number.isInteger(report!.amplification.shardsUsed)).toBe(true);
  });

  it('overclocks real recipes when only shards are available (buildings-weighted)', async () => {
    const opts = baseOptions();
    opts.weightingOptions = { resources: '10', power: '1', complexity: '0', buildings: '1000' };
    opts.amplificationOptions = { availableSloops: '0', availableShards: '30' };
    const { productionGraph, report, error } = await new ProductionSolver(opts, gd).exec();
    expect(error).toBeNull();
    const ocNodes = Object.keys(productionGraph!.nodes).filter((k) => k.includes('::OC'));
    expect(ocNodes.length).toBeGreaterThan(0);
    expect(report!.amplification.shardsUsed).toBeGreaterThan(0);
    // Power shards go into whole machines (3 per overclocked machine), so usage is an integer.
    expect(Number.isInteger(report!.amplification.shardsUsed)).toBe(true);
    expect(report!.amplification.shardsUsed % 3).toBe(0);
  });
});
