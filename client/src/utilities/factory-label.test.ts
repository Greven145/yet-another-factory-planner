import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { deriveAutoLabel, labelOf, relativeTime } from './factory-label';
import { FactoryOptions, ProductionItemOptions } from '../contexts/production/types';
import { GameData } from '../contexts/gameData/types';
import { LibraryFactory } from '../contexts/library/types';

// deriveAutoLabel/labelOf only read gameData.items[key]?.name, so a partial
// items map is enough — the rest of GameData is irrelevant here.
const gameData = {
  items: {
    Desc_IronPlate_C: { name: 'Iron Plate' },
    Desc_Rotor_C: { name: 'Rotor' },
  },
} as unknown as GameData;

function product(over: Partial<ProductionItemOptions>): ProductionItemOptions {
  return { key: 'k', itemKey: 'Desc_IronPlate_C', mode: 'per-minute', value: '30', ...over };
}

function config(productionItems: ProductionItemOptions[]): FactoryOptions {
  return { productionItems } as FactoryOptions;
}

describe('deriveAutoLabel', () => {
  it('returns "Empty factory" for an undefined config', () => {
    expect(deriveAutoLabel(undefined, gameData)).toBe('Empty factory');
  });

  it('returns "Empty factory" when there are no production items', () => {
    expect(deriveAutoLabel(config([]), gameData)).toBe('Empty factory');
  });

  it('formats a per-minute goal as "Name ×N"', () => {
    expect(deriveAutoLabel(config([product({ mode: 'per-minute', value: '30' })]), gameData))
      .toBe('Iron Plate ×30');
  });

  it('formats a non-per-minute goal as "Name (max)"', () => {
    expect(deriveAutoLabel(config([product({ mode: 'maximize', value: '0' })]), gameData))
      .toBe('Iron Plate (max)');
  });

  it('joins multiple goals with ", "', () => {
    const label = deriveAutoLabel(
      config([
        product({ itemKey: 'Desc_IronPlate_C', mode: 'per-minute', value: '30' }),
        product({ itemKey: 'Desc_Rotor_C', mode: 'maximize', value: '0' }),
      ]),
      gameData,
    );
    expect(label).toBe('Iron Plate ×30, Rotor (max)');
  });

  it('falls back to the raw itemKey when the item is unknown', () => {
    expect(deriveAutoLabel(config([product({ itemKey: 'Desc_Unknown_C' })]), gameData))
      .toBe('Desc_Unknown_C ×30');
  });

  it('ignores placeholder rows with an empty itemKey', () => {
    const label = deriveAutoLabel(
      config([
        product({ itemKey: '' }),
        product({ itemKey: 'Desc_IronPlate_C', mode: 'per-minute', value: '12' }),
      ]),
      gameData,
    );
    expect(label).toBe('Iron Plate ×12');
  });

  it('shows ×0 when a per-minute value is empty', () => {
    expect(deriveAutoLabel(config([product({ mode: 'per-minute', value: '' })]), gameData))
      .toBe('Iron Plate ×0');
  });
});

describe('labelOf', () => {
  const base: LibraryFactory = {
    id: '1',
    gameVersion: '1.2',
    config: config([product({ mode: 'per-minute', value: '30' })]),
    createdAt: 0,
    updatedAt: 0,
  };

  it('uses the nickname when set', () => {
    expect(labelOf({ ...base, nickname: 'My Base' }, gameData)).toBe('My Base');
  });

  it('derives from outputs when there is no nickname', () => {
    expect(labelOf(base, gameData)).toBe('Iron Plate ×30');
  });

  it('derives from outputs when the nickname is an empty string', () => {
    expect(labelOf({ ...base, nickname: '' }, gameData)).toBe('Iron Plate ×30');
  });
});

describe('relativeTime', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-28T12:00:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const now = () => Date.now();

  it('returns "just now" under a minute', () => {
    expect(relativeTime(now() - 30_000)).toBe('just now');
  });

  it('returns minutes within the hour', () => {
    expect(relativeTime(now() - 5 * 60_000)).toBe('5m ago');
  });

  it('returns hours within the day', () => {
    expect(relativeTime(now() - 3 * 60 * 60_000)).toBe('3h ago');
  });

  it('returns days beyond a day', () => {
    expect(relativeTime(now() - 2 * 24 * 60 * 60_000)).toBe('2d ago');
  });
});
