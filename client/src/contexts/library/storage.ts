import { nanoid } from 'nanoid';
import { LibraryFactory, LibraryMap } from './types';
import { FactoryOptions } from '../production/types';

// localStorage holds the shared library (the data); sessionStorage holds this
// tab's active-factory pointer, so two tabs can edit two factories independently.
const LIBRARY_KEY = 'factory-library';
const ACTIVE_ID_KEY = 'active-factory-id';

// Legacy single-factory persistence we migrate away from on first load.
const LEGACY_STATE_KEY = 'state';
const LEGACY_VERSION_KEY = 'game-version';

export function loadLibrary(): LibraryMap {
  try {
    const raw = window.localStorage.getItem(LIBRARY_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (e) {
    console.error(e);
    return {};
  }
}

export function writeLibrary(library: LibraryMap): void {
  try {
    window.localStorage.setItem(LIBRARY_KEY, JSON.stringify(library));
  } catch (e) {
    console.error(e);
    // Quota is the only expected failure; surface it rather than losing work silently.
    if (e instanceof DOMException && e.name === 'QuotaExceededError') {
      window.alert('Factory storage is full — delete some factories to keep saving.');
    }
  }
}

export function getActiveId(): string | null {
  try {
    return window.sessionStorage.getItem(ACTIVE_ID_KEY);
  } catch {
    return null;
  }
}

export function setActiveId(id: string): void {
  try {
    window.sessionStorage.setItem(ACTIVE_ID_KEY, id);
  } catch (e) {
    console.error(e);
  }
}

// Build a fresh library record. `config` is left undefined for brand-new/imported
// slots; the reducer initializes them and autosave fills `config` in on first edit.
export function makeFactory(
  gameVersion: string,
  opts: { config?: FactoryOptions; nickname?: string; sourceKey?: string } = {},
): LibraryFactory {
  const now = Date.now();
  return {
    id: nanoid(),
    nickname: opts.nickname,
    gameVersion,
    config: opts.config,
    sourceKey: opts.sourceKey,
    createdAt: now,
    updatedAt: now,
  };
}

// One-time adoption of the old single-factory sessionStorage state so existing
// in-progress work isn't lost on the first load after this feature ships. Returns
// the seeded factory (already written to the library) or null if nothing to migrate.
export function migrateFromSession(library: LibraryMap): LibraryFactory | null {
  if (Object.keys(library).length > 0) return null;
  try {
    const version = window.sessionStorage.getItem(LEGACY_VERSION_KEY);
    const stateJSON = window.sessionStorage.getItem(LEGACY_STATE_KEY);
    if (!version || !stateJSON) return null;
    const config = JSON.parse(stateJSON) as FactoryOptions;
    const factory = makeFactory(version, { config });
    writeLibrary({ [factory.id]: factory });
    window.sessionStorage.removeItem(LEGACY_STATE_KEY);
    window.sessionStorage.removeItem(LEGACY_VERSION_KEY);
    return factory;
  } catch (e) {
    console.error(e);
    return null;
  }
}

// Most-recently-edited factory, used when a fresh tab has no active pointer.
export function mostRecent(library: LibraryMap): LibraryFactory | null {
  const all = Object.values(library);
  if (all.length === 0) return null;
  return all.reduce((a, b) => (b.updatedAt > a.updatedAt ? b : a));
}
