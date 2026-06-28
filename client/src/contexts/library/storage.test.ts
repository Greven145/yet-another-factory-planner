import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getActiveId,
  loadLibrary,
  makeFactory,
  migrateFromSession,
  mostRecent,
  setActiveId,
  writeLibrary,
} from './storage';
import { LibraryMap } from './types';
import { FactoryOptions } from '../production/types';

const LIBRARY_KEY = 'factory-library';

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  vi.restoreAllMocks();
});

describe('loadLibrary / writeLibrary', () => {
  it('returns an empty map when nothing is stored', () => {
    expect(loadLibrary()).toEqual({});
  });

  it('round-trips a written map', () => {
    const factory = makeFactory('1.2');
    const map: LibraryMap = { [factory.id]: factory };
    writeLibrary(map);
    expect(loadLibrary()).toEqual(map);
  });

  it('returns an empty map on malformed JSON', () => {
    window.localStorage.setItem(LIBRARY_KEY, '{ not json');
    expect(loadLibrary()).toEqual({});
  });

  it('surfaces a quota error via window.alert instead of throwing', () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });

    expect(() => writeLibrary({ a: makeFactory('1.2') })).not.toThrow();
    expect(alertSpy).toHaveBeenCalledOnce();
  });
});

describe('active-id pointer', () => {
  it('returns null when unset', () => {
    expect(getActiveId()).toBeNull();
  });

  it('round-trips through sessionStorage', () => {
    setActiveId('abc');
    expect(getActiveId()).toBe('abc');
  });
});

describe('makeFactory', () => {
  it('produces a unique id with equal created/updated timestamps', () => {
    const a = makeFactory('1.2');
    const b = makeFactory('1.2');
    expect(a.id).not.toBe(b.id);
    expect(a.createdAt).toBe(a.updatedAt);
  });

  it('leaves config undefined and carries the game version by default', () => {
    const f = makeFactory('1.1');
    expect(f.gameVersion).toBe('1.1');
    expect(f.config).toBeUndefined();
    expect(f.nickname).toBeUndefined();
    expect(f.sourceKey).toBeUndefined();
  });

  it('passes through nickname, config, and sourceKey', () => {
    const config = { key: 'c' } as unknown as FactoryOptions;
    const f = makeFactory('1.2', { config, nickname: 'Base', sourceKey: 'key123' });
    expect(f.config).toBe(config);
    expect(f.nickname).toBe('Base');
    expect(f.sourceKey).toBe('key123');
  });
});

describe('migrateFromSession', () => {
  const legacyConfig = { key: 'legacy' } as unknown as FactoryOptions;

  function seedLegacySession() {
    window.sessionStorage.setItem('game-version', '1.1');
    window.sessionStorage.setItem('state', JSON.stringify(legacyConfig));
  }

  it('adopts legacy session state into an empty library and clears the legacy keys', () => {
    seedLegacySession();
    const seeded = migrateFromSession({});

    expect(seeded).not.toBeNull();
    expect(seeded!.gameVersion).toBe('1.1');
    expect(seeded!.config).toEqual(legacyConfig);
    // Written to the library...
    expect(loadLibrary()[seeded!.id]).toEqual(seeded);
    // ...and the legacy keys are gone.
    expect(window.sessionStorage.getItem('state')).toBeNull();
    expect(window.sessionStorage.getItem('game-version')).toBeNull();
  });

  it('is a no-op when the library is already populated', () => {
    seedLegacySession();
    const existing = makeFactory('1.2');
    expect(migrateFromSession({ [existing.id]: existing })).toBeNull();
    // Legacy keys are left untouched in this case.
    expect(window.sessionStorage.getItem('state')).not.toBeNull();
  });

  it('returns null when there is no legacy state to migrate', () => {
    expect(migrateFromSession({})).toBeNull();
  });
});

describe('mostRecent', () => {
  it('returns null for an empty library', () => {
    expect(mostRecent({})).toBeNull();
  });

  it('returns the factory with the greatest updatedAt', () => {
    const older = { ...makeFactory('1.2'), updatedAt: 100 };
    const newer = { ...makeFactory('1.2'), updatedAt: 200 };
    const map: LibraryMap = { [older.id]: older, [newer.id]: newer };
    expect(mostRecent(map)).toBe(newer);
  });
});
