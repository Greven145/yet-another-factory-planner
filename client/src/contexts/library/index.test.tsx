import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { LibraryProvider, useLibraryContext } from './index';
import { loadLibrary, getActiveId } from './storage';
import { FactoryOptions } from '../production/types';

// Drive the provider through its public hook. Fake timers give every mutation a
// distinct, monotonic timestamp so createdAt ordering and updatedAt bumps are
// deterministic instead of racing on the wall clock.
function setup() {
  return renderHook(() => useLibraryContext(), { wrapper: LibraryProvider });
}

const tick = () => act(() => { vi.advanceTimersByTime(10); });

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-06-28T00:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('LibraryProvider initial mount', () => {
  it('auto-creates one factory, sets it active, and persists it', () => {
    const { result } = setup();
    expect(result.current.factories).toHaveLength(1);
    expect(result.current.activeId).toBe(result.current.factories[0].id);
    expect(result.current.activeFactory).toBeDefined();

    // Persisted to localStorage + the session pointer.
    const stored = loadLibrary();
    expect(Object.keys(stored)).toHaveLength(1);
    expect(getActiveId()).toBe(result.current.activeId);
  });
});

describe('create', () => {
  it('adds a slot inheriting the active version, makes it active, keeps createdAt order', () => {
    const { result } = setup();
    const firstId = result.current.activeId;

    tick();
    act(() => { result.current.create(); });

    expect(result.current.factories).toHaveLength(2);
    // Sorted by createdAt asc → the original stays first, the new one is last/active.
    expect(result.current.factories[0].id).toBe(firstId);
    const newId = result.current.factories[1].id;
    expect(result.current.activeId).toBe(newId);
    expect(result.current.activeFactory!.gameVersion).toBe('1.2');
    expect(Object.keys(loadLibrary())).toHaveLength(2);
  });

  it('inherits a non-default active version', () => {
    const { result } = setup();
    tick();
    act(() => { result.current.setActiveVersion('1.1'); });
    tick();
    act(() => { result.current.create(); });
    expect(result.current.activeFactory!.gameVersion).toBe('1.1');
  });
});

describe('duplicate', () => {
  it('copies the config and appends " (copy)" to a nicknamed source', () => {
    const { result } = setup();
    const config = { key: 'cfg' } as unknown as FactoryOptions;

    act(() => { result.current.saveActiveConfig(config); });
    act(() => { result.current.rename(result.current.activeId, 'Base'); });
    const srcId = result.current.activeId;

    tick();
    act(() => { result.current.duplicate(srcId); });

    expect(result.current.factories).toHaveLength(2);
    const copy = result.current.activeFactory!;
    expect(copy.id).not.toBe(srcId);
    expect(copy.nickname).toBe('Base (copy)');
    expect(copy.config).toEqual(config);
  });

  it('does nothing for an unknown id', () => {
    const { result } = setup();
    act(() => { result.current.duplicate('does-not-exist'); });
    expect(result.current.factories).toHaveLength(1);
  });
});

describe('rename', () => {
  it('trims whitespace', () => {
    const { result } = setup();
    act(() => { result.current.rename(result.current.activeId, '  Steel  '); });
    expect(result.current.activeFactory!.nickname).toBe('Steel');
  });

  it('clears the nickname when given an empty string', () => {
    const { result } = setup();
    act(() => { result.current.rename(result.current.activeId, 'Temp'); });
    act(() => { result.current.rename(result.current.activeId, '   '); });
    expect(result.current.activeFactory!.nickname).toBeUndefined();
  });
});

describe('remove', () => {
  it('selects the most-recent remaining factory when the active one is removed', () => {
    const { result } = setup();
    const firstId = result.current.activeId;
    tick();
    act(() => { result.current.create(); });
    const secondId = result.current.activeId;

    // Re-select the first, then remove it → the (newer) second should become active.
    act(() => { result.current.select(firstId); });
    act(() => { result.current.remove(firstId); });

    expect(result.current.factories).toHaveLength(1);
    expect(result.current.activeId).toBe(secondId);
  });

  it('creates a fresh factory when the last one is removed', () => {
    const { result } = setup();
    const onlyId = result.current.activeId;
    act(() => { result.current.remove(onlyId); });

    expect(result.current.factories).toHaveLength(1);
    expect(result.current.activeId).not.toBe(onlyId);
    expect(Object.keys(loadLibrary())).toHaveLength(1);
  });
});

describe('saveActiveConfig', () => {
  it('writes config and bumps updatedAt on the active slot only', () => {
    const { result } = setup();
    tick();
    act(() => { result.current.create(); });
    const otherId = result.current.factories[0].id;
    const otherBefore = result.current.factories[0].updatedAt;

    const config = { key: 'live' } as unknown as FactoryOptions;
    tick();
    act(() => { result.current.saveActiveConfig(config); });

    expect(result.current.activeFactory!.config).toEqual(config);
    expect(result.current.activeFactory!.updatedAt).toBeGreaterThan(result.current.activeFactory!.createdAt);
    // The non-active factory is untouched.
    const other = result.current.factories.find((f) => f.id === otherId)!;
    expect(other.updatedAt).toBe(otherBefore);
    // Persisted.
    expect(loadLibrary()[result.current.activeId].config).toEqual(config);
  });
});

describe('setActiveVersion', () => {
  it('retargets the version and clears the config', () => {
    const { result } = setup();
    act(() => { result.current.saveActiveConfig({ key: 'x' } as unknown as FactoryOptions); });
    act(() => { result.current.setActiveVersion('1.1'); });

    expect(result.current.activeFactory!.gameVersion).toBe('1.1');
    expect(result.current.activeFactory!.config).toBeUndefined();
  });

  it('is a no-op when the version is unchanged', () => {
    const { result } = setup();
    const config = { key: 'keep' } as unknown as FactoryOptions;
    act(() => { result.current.saveActiveConfig(config); });
    act(() => { result.current.setActiveVersion('1.2'); }); // already 1.2

    expect(result.current.activeFactory!.config).toEqual(config);
  });
});

describe('importFactory', () => {
  it('adds a slot carrying the sourceKey and makes it active', () => {
    const { result } = setup();
    const config = { key: 'imported' } as unknown as FactoryOptions;

    tick();
    act(() => { result.current.importFactory({ config, gameVersion: '1.1', sourceKey: 'shareKey1' }); });

    expect(result.current.factories).toHaveLength(2);
    const imported = result.current.activeFactory!;
    expect(imported.config).toEqual(config);
    expect(imported.gameVersion).toBe('1.1');
    expect(imported.sourceKey).toBe('shareKey1');
    expect(loadLibrary()[imported.id].sourceKey).toBe('shareKey1');
  });
});

describe('importFactories', () => {
  it('adds every factory in one commit (a multi-factory import is not clobbered)', () => {
    const { result } = setup();
    const a = { key: 'a' } as unknown as FactoryOptions;
    const b = { key: 'b' } as unknown as FactoryOptions;

    tick();
    act(() => {
      result.current.importFactories([
        { config: a, gameVersion: '1.2', nickname: 'Alpha' },
        { config: b, gameVersion: '1.1', nickname: 'Beta' },
      ]);
    });

    // 1 auto-created + 2 imported — the earlier per-factory loop dropped all but the last.
    expect(result.current.factories).toHaveLength(3);
    const nicks = result.current.factories.map((f) => f.nickname);
    expect(nicks).toContain('Alpha');
    expect(nicks).toContain('Beta');
    // Persisted, and the last import is active.
    expect(Object.keys(loadLibrary())).toHaveLength(3);
    expect(result.current.activeFactory!.nickname).toBe('Beta');
  });

  it('is a no-op for an empty list', () => {
    const { result } = setup();
    tick();
    act(() => { result.current.importFactories([]); });
    expect(result.current.factories).toHaveLength(1);
  });
});
