import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { FactoryOptions } from '../production/types';
import { DEFAULT_GAME_VERSION, SHARE_QUERY_PARAM } from '../gameData/consts';
import { LibraryFactory, LibraryMap } from './types';
import {
  getActiveId,
  loadLibrary,
  makeFactory,
  migrateFromSession,
  mostRecent,
  setActiveId as persistActiveId,
  writeLibrary,
} from './storage';


// One factory to import: a config + version, optionally a nickname and the share
// key it came from. Id and timestamps are minted fresh on import (import = copy).
export type FactoryImportInput = {
  config?: FactoryOptions;
  gameVersion: string;
  nickname?: string;
  sourceKey?: string;
};

// TYPE
export type LibraryContextType = {
  factories: LibraryFactory[]; // stable display order (createdAt asc)
  activeId: string;
  activeFactory: LibraryFactory | undefined;
  select: (id: string) => void;
  create: () => LibraryFactory;
  duplicate: (id: string) => void;
  rename: (id: string, nickname: string) => void;
  remove: (id: string) => void;
  saveActiveConfig: (config: FactoryOptions) => void;
  setActiveVersion: (gameVersion: string) => void;
  importFactory: (input: { config?: FactoryOptions; gameVersion: string; sourceKey?: string }) => LibraryFactory;
  importFactories: (inputs: FactoryImportInput[]) => LibraryFactory[];
};


// CONTEXT
export const LibraryContext = createContext<LibraryContextType | null>(null);
LibraryContext.displayName = 'LibraryContext';


// HELPER HOOK
export function useLibraryContext() {
  const ctx = useContext(LibraryContext);
  if (!ctx) {
    throw new Error('LibraryContext is null');
  }
  return ctx;
}


// Resolve the library + this tab's active factory on first mount, before the
// game-data layer reads it. Migrates legacy sessionStorage state, honours the
// per-tab active pointer, falls back to the most-recently-edited factory, and
// creates an empty factory when the library is empty and no URL factory is present
// (a URL share/legacy link is imported by the game-data layer instead).
function resolveInitial(): { library: LibraryMap; activeId: string } {
  let library = loadLibrary();
  if (migrateFromSession(library)) {
    library = loadLibrary();
  }

  const params = new URLSearchParams(window.location.search);
  const hasUrlFactory = !!(params.get(SHARE_QUERY_PARAM) || params.get('f'));

  let activeId = getActiveId() ?? '';
  if (!activeId || !library[activeId]) {
    activeId = mostRecent(library)?.id ?? '';
  }

  if (!hasUrlFactory && !activeId) {
    const factory = makeFactory(DEFAULT_GAME_VERSION);
    library = { ...library, [factory.id]: factory };
    writeLibrary(library);
    activeId = factory.id;
  }

  if (activeId) persistActiveId(activeId);
  return { library, activeId };
}


// PROVIDER
type PropTypes = { children: React.ReactNode };
export const LibraryProvider = ({ children }: PropTypes) => {
  const initial = useRef<{ library: LibraryMap; activeId: string } | null>(null);
  if (!initial.current) initial.current = resolveInitial();

  const [library, setLibrary] = useState<LibraryMap>(initial.current.library);
  const [activeId, setActiveId] = useState<string>(initial.current.activeId);

  // Persist a mutated map and update React state in one step.
  const commit = useCallback((next: LibraryMap) => {
    writeLibrary(next);
    setLibrary(next);
  }, []);

  const selectId = useCallback((id: string) => {
    persistActiveId(id);
    setActiveId(id);
  }, []);

  const select = useCallback((id: string) => {
    if (id !== activeId) selectId(id);
  }, [activeId, selectId]);

  // Add a freshly-built factory to the library and make it active.
  const addFactory = useCallback((factory: LibraryFactory): LibraryFactory => {
    commit({ ...library, [factory.id]: factory });
    selectId(factory.id);
    return factory;
  }, [commit, library, selectId]);

  const create = useCallback((): LibraryFactory => {
    const gameVersion = library[activeId]?.gameVersion ?? DEFAULT_GAME_VERSION;
    return addFactory(makeFactory(gameVersion));
  }, [activeId, addFactory, library]);

  const importFactory = useCallback(
    (input: { config?: FactoryOptions; gameVersion: string; sourceKey?: string }): LibraryFactory =>
      addFactory(makeFactory(input.gameVersion, { config: input.config, sourceKey: input.sourceKey })),
    [addFactory],
  );

  // Batch-import factories in ONE commit. addFactory/importFactory each close over
  // the render's `library`, so calling them in a loop makes every call overwrite the
  // previous (last-write-wins). This adds them all via a single functional update, so
  // a multi-factory file lands intact. Nicknames from the file are preserved; ids are
  // re-minted (import = copy). The last imported factory becomes active.
  const importFactories = useCallback((inputs: FactoryImportInput[]): LibraryFactory[] => {
    if (inputs.length === 0) return [];
    const created = inputs.map((i) => makeFactory(i.gameVersion, { config: i.config, nickname: i.nickname, sourceKey: i.sourceKey }));
    setLibrary((prev) => {
      const next = { ...prev };
      for (const f of created) next[f.id] = f;
      writeLibrary(next);
      return next;
    });
    selectId(created[created.length - 1].id);
    return created;
  }, [selectId]);

  const duplicate = useCallback((id: string) => {
    const src = library[id];
    if (!src) return;
    addFactory(makeFactory(src.gameVersion, {
      config: src.config,
      nickname: src.nickname ? `${src.nickname} (copy)` : undefined,
    }));
  }, [addFactory, library]);

  const rename = useCallback((id: string, nickname: string) => {
    const src = library[id];
    if (!src) return;
    const trimmed = nickname.trim();
    commit({ ...library, [id]: { ...src, nickname: trimmed || undefined, updatedAt: Date.now() } });
  }, [commit, library]);

  const remove = useCallback((id: string) => {
    const next = { ...library };
    delete next[id];
    commit(next);
    if (id === activeId) {
      const fallback = mostRecent(next) ?? makeFactory(library[id]?.gameVersion ?? DEFAULT_GAME_VERSION);
      if (!next[fallback.id]) commit({ ...next, [fallback.id]: fallback });
      selectId(fallback.id);
    }
  }, [activeId, commit, library, selectId]);

  // Autosave: write the live reducer state into the active slot. Called on every
  // production state change, so this is the hot path.
  const saveActiveConfig = useCallback((config: FactoryOptions) => {
    setLibrary((prev) => {
      const src = prev[activeId];
      if (!src) return prev;
      const next = { ...prev, [activeId]: { ...src, config, updatedAt: Date.now() } };
      writeLibrary(next);
      return next;
    });
  }, [activeId]);

  // Version selector: retarget the active factory to a new game version and drop
  // its config (recipes/items differ across versions, so it resets on reload).
  const setActiveVersion = useCallback((gameVersion: string) => {
    setLibrary((prev) => {
      const src = prev[activeId];
      if (!src || src.gameVersion === gameVersion) return prev;
      const next = { ...prev, [activeId]: { ...src, gameVersion, config: undefined, updatedAt: Date.now() } };
      writeLibrary(next);
      return next;
    });
  }, [activeId]);

  const factories = useMemo(
    () => Object.values(library).sort((a, b) => a.createdAt - b.createdAt),
    [library],
  );
  const activeFactory = library[activeId];

  const ctxValue = useMemo<LibraryContextType>(() => ({
    factories,
    activeId,
    activeFactory,
    select,
    create,
    duplicate,
    rename,
    remove,
    saveActiveConfig,
    setActiveVersion,
    importFactory,
    importFactories,
  }), [factories, activeId, activeFactory, select, create, duplicate, rename, remove, saveActiveConfig, setActiveVersion, importFactory, importFactories]);

  return (
    <LibraryContext.Provider value={ctxValue}>
      {children}
    </LibraryContext.Provider>
  );
};
