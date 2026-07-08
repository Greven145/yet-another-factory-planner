import { describe, it, expect } from 'vitest';
import { buildBundle, parseBundle, serializeBundle, EXPORT_ENVELOPE_VERSION, EXPORT_APP_NAME } from './index';
import { LibraryFactory } from '../../contexts/library/types';
import { FactoryOptions } from '../../contexts/production/types';

function sampleConfig(itemKey = 'Desc_IronPlate_C'): FactoryOptions {
  return {
    key: 'k',
    productionItems: [{ key: 'p1', itemKey, mode: 'per-minute', value: '20' }],
    inputItems: [],
    inputResources: [],
    allowHandGatheredItems: false,
    weightingOptions: { resources: '1', power: '1', complexity: '1', buildings: '1' },
    gameModeOptions: { recipePartsCost: '0', powerConsumption: '0' },
    allowedRecipes: { Recipe_IronPlate_C: true },
    allowedBuildings: {},
    nodesPositions: [],
    maximizeBalanceMode: 'proportional',
    transportOptions: { beltCapacity: null, pipeCapacity: null },
  };
}

function factory(id: string, gameVersion = '1.2'): LibraryFactory {
  return { id, nickname: `Nick ${id}`, gameVersion, config: sampleConfig(), createdAt: 1, updatedAt: 2 };
}

describe('buildBundle', () => {
  it('wraps factories in a versioned envelope and drops library-local fields', () => {
    const bundle = buildBundle([factory('a')]);
    expect(bundle.app).toBe(EXPORT_APP_NAME);
    expect(bundle.envelopeVersion).toBe(EXPORT_ENVELOPE_VERSION);
    expect(bundle.factories).toHaveLength(1);
    // createdAt/updatedAt are library-local and must not travel in the file.
    expect(bundle.factories[0]).not.toHaveProperty('createdAt');
    expect(bundle.factories[0]).not.toHaveProperty('updatedAt');
    expect(bundle.factories[0].config).toEqual(sampleConfig());
  });
});

describe('parseBundle', () => {
  it('round-trips a serialized bundle back to importable factories', () => {
    const raw = serializeBundle([factory('a'), factory('b')]);
    const res = parseBundle(raw);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.factories).toHaveLength(2);
      expect(res.warnings).toHaveLength(0);
      expect(res.factories[0]).toEqual({ config: sampleConfig(), gameVersion: '1.2', nickname: 'Nick a', sourceKey: undefined });
    }
  });

  it('rejects malformed JSON', () => {
    const res = parseBundle('{ not json ');
    expect(res).toMatchObject({ ok: false });
    if (!res.ok) expect(res.error).toMatch(/not valid json/i);
  });

  it('rejects a file that is not an export envelope', () => {
    const res = parseBundle(JSON.stringify({ hello: 'world' }));
    expect(res).toMatchObject({ ok: false });
    if (!res.ok) expect(res.error).toMatch(/not a factory export/i);
  });

  it('refuses a newer envelope version', () => {
    const res = parseBundle(JSON.stringify({ app: EXPORT_APP_NAME, envelopeVersion: 99, exportedAt: '', factories: [] }));
    expect(res).toMatchObject({ ok: false });
    if (!res.ok) expect(res.error).toMatch(/newer version/i);
  });

  it('warns on an unknown game version but still imports the factory', () => {
    const raw = JSON.stringify({
      app: EXPORT_APP_NAME, envelopeVersion: 1, exportedAt: '',
      factories: [{ id: 'x', nickname: 'Future', gameVersion: '9.9', config: sampleConfig() }],
    });
    const res = parseBundle(raw);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.factories).toHaveLength(1);
      expect(res.warnings[0]).toMatch(/unknown game version/i);
    }
  });

  it('drops a factory with no game version but keeps valid siblings', () => {
    const raw = JSON.stringify({
      app: EXPORT_APP_NAME, envelopeVersion: 1, exportedAt: '',
      factories: [{ id: 'bad', nickname: 'Bad' }, { id: 'ok', gameVersion: '1.2', config: sampleConfig() }],
    });
    const res = parseBundle(raw);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.factories).toHaveLength(1);
      expect(res.warnings[0]).toMatch(/no game version/i);
    }
  });

  it('errors when the file has no importable factories', () => {
    const raw = JSON.stringify({ app: EXPORT_APP_NAME, envelopeVersion: 1, exportedAt: '', factories: [{ id: 'bad' }] });
    const res = parseBundle(raw);
    expect(res).toMatchObject({ ok: false });
    if (!res.ok) expect(res.error).toMatch(/no importable factories/i);
  });
});
