import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useGetSharedFactory } from '../../api/modules/shared-factories/useGetSharedFactory';
import { unwrapSharedFactoryConfig } from '../../api/modules/shared-factories/unwrapSharedFactory';
import { get } from '../../api';
import { GameData } from './types';
import { loadGameData } from './loadGameData';
import { DEFAULT_GAME_VERSION, SHARE_QUERY_PARAM } from './consts';
import { toDisplay } from '../../utilities/shared-factory/codec';
import { parseShareKeys, MAX_SHARE_FACTORIES } from '../../utilities/shared-factory/share-url';
import { hydrateSharedFactory } from '../../utilities/shared-factory/hydrate';
import { usePrevious } from '../../hooks/usePrevious';
import { FactoryOptions } from '../production/types';
import { usePageTitle } from '../../hooks/usePageTitle';
import { deriveAutoLabel } from '../../utilities/factory-label';
import { useLibraryContext, FactoryImportInput } from '../library';
import { ImportPickerModal, IncomingFactory } from '../../containers/ProductionPlanner/ImportPickerModal';


// TYPE
export type FactoryInitializer = {
  // Raw share payload (decoded by the reducer) for URL share loads.
  factoryConfig: any | null,
  shareKey: string | null,
  legacyEncoding: string | null,
  // A stored library config loaded straight into the reducer. Null => reset.
  libraryConfig: FactoryOptions | null,
};

export type GameDataContextType = {
  gameData: GameData | null,
  initializer: FactoryInitializer | null,
  loading: boolean,
  loadingError: boolean,
  // A ?factory= share link that couldn't be resolved (invalid or past its 7-day
  // TTL). Non-fatal: the app still loads a normal factory; the UI surfaces this
  // so the user knows why their link didn't open. Cleared on the next load.
  shareError: boolean,
  clearShareError: () => void,
  completedThisFrame: boolean,
  // Bumped to reload the active factory into the reducer WITHOUT refetching game
  // data (a same-version factory switch). Different-version switches refetch instead.
  reinitToken: number,
  gameVersion: string,
  setGameVersion: (version: string) => void,
};


// CONTEXT
export const GameDataContext = createContext<GameDataContextType | null>(null);
GameDataContext.displayName = 'GameDataContext';


// HELPER HOOK
export function useGameDataContext() {
  const ctx = useContext(GameDataContext);
  if (!ctx) {
    throw new Error('GameDataContext is null');
  }
  return ctx;
}


// Remove the given query params from the URL in place (history.replaceState), keeping
// any other params so a refresh neither re-imports a consumed share nor drops unrelated
// state (e.g. the prototype's ?variant=).
function stripUrlParams(names: string[]) {
  const params = new URLSearchParams(window.location.search);
  names.forEach((n) => params.delete(n));
  const rest = params.toString();
  window.history.replaceState(null, '', rest ? `${window.location.pathname}?${rest}` : window.location.pathname);
}


// PROVIDER
type PropTypes = { children: React.ReactNode };
export const GameDataProvider = ({ children }: PropTypes) => {
  const lib = useLibraryContext();
  const [gameData, setGameData] = useState<GameData | null>(null);
  const [gameVersion, setGameVersion] = useState('');
  const [initializer, setInitializer] = useState<FactoryInitializer | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingError, setLoadingError] = useState(false);
  const [shareError, setShareError] = useState(false);
  const [reinitToken, setReinitToken] = useState(0);
  // The multi-share receive picker: resolved incoming factories + open state.
  const [importIncoming, setImportIncoming] = useState<IncomingFactory[]>([]);
  const [importOpen, setImportOpen] = useState(false);
  const prevLoading = usePrevious(loading);
  const [needToFetchGameData, setNeedToFetchGameData] = useState(true);
  const completedThisFrame = useMemo(() => !loading && loading !== prevLoading, [loading, prevLoading]);

  // The active factory id whose content is already reflected in the reducer. The
  // switch observer below only fires when the active id drifts from this.
  const handledActiveIdRef = useRef<string>(lib.activeId);

  // Only used for the ?factory=<key> share path — resolves the saved config.
  // Game data itself now comes from static bundles (loadGameData), never the API.
  const sharedFactory = useGetSharedFactory();

  const pageTitle = useMemo(() => {
    const base = 'Another... Yet Another Factory Planner';
    return (gameVersion ? `[${gameVersion}] ` : '') + base;
  }, [gameVersion]);

  usePageTitle(pageTitle);

  // Load the static game-data bundle for `version` and finalize the load:
  // strip the share params from the URL, import/select the library slot, and
  // publish the resolved gameData + initializer. `factoryConfig` is the decoded
  // share payload for the ?factory= path (null for legacy/library loads).
  const finalizeLoad = async ({ version, factoryConfig }: { version: string, factoryConfig: any | null }) => {
    let newGameData: GameData;
    try {
      newGameData = await loadGameData(version);
    } catch {
      setLoadingError(true);
      setLoading(false);
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const shareKey = params.get(SHARE_QUERY_PARAM);
    const legacyEncoding = params.get('f');
    // Clear only the share keys we just imported (see stripUrlParams).
    stripUrlParams([SHARE_QUERY_PARAM, 'f']);

    let libraryConfig: FactoryOptions | null = null;
    if (shareKey || legacyEncoding) {
      // Import the incoming URL factory as a new library slot (no dedupe). Its
      // config is filled in by autosave once the reducer loads the share payload.
      const imported = lib.importFactory({ gameVersion: version, sourceKey: shareKey ?? undefined });
      handledActiveIdRef.current = imported.id;
    } else {
      libraryConfig = lib.activeFactory?.config ?? null;
      handledActiveIdRef.current = lib.activeId;
    }

    // Keep setLoading(false) last: `completedThisFrame` fires the frame loading
    // clears, and gameData must already be present when it does (it gates the
    // ProductionProvider mount that consumes triggerInitialize).
    setGameVersion(version);
    setGameData(newGameData);
    setInitializer({
      factoryConfig: (shareKey || legacyEncoding) ? factoryConfig : null,
      shareKey,
      legacyEncoding,
      libraryConfig,
    });
    setLoading(false);
  };

  // Multi-share receive (`?factory=k1,k2,…`, >1 key). Unlike the single path this
  // never hydrates the active factory: it boots the planner normally, resolves each
  // key in parallel, and opens a picker so the recipient chooses what to import. The
  // share param is stripped up front so a refresh can't re-import.
  const resolveMultiShare = async (keys: string[]) => {
    stripUrlParams([SHARE_QUERY_PARAM]);

    // Boot the planner normally so it's usable while (and after) the picker is open.
    const version = lib.activeFactory?.gameVersion || gameVersion || DEFAULT_GAME_VERSION;
    void finalizeLoad({ version, factoryConfig: null });

    // Cap how many keys we resolve; extras past the cap surface as unresolvable rows.
    const capped = keys.slice(0, MAX_SHARE_FACTORIES);
    const overflow = keys.slice(MAX_SHARE_FACTORIES);

    const settled = await Promise.allSettled(
      capped.map((key) => get('/shared-factories/:factoryKey', { factoryKey: key })),
    );
    const incoming: IncomingFactory[] = await Promise.all(
      settled.map(async (res, idx): Promise<IncomingFactory> => {
        const key = capped[idx];
        if (res.status !== 'fulfilled') return { key, ok: false };
        const wire = unwrapSharedFactoryConfig(res.value);
        if (!wire) return { key, ok: false };
        try {
          const v = wire.gameVersion ? toDisplay(wire.gameVersion) : DEFAULT_GAME_VERSION;
          const gd = await loadGameData(v);
          // Hydrate once, here: the picker's label and the eventual import both reuse
          // this config, so handleImportShared never re-hydrates.
          const config = hydrateSharedFactory(wire, gd);
          return { key, ok: true, config, version: v, label: deriveAutoLabel(config, gd) };
        } catch {
          return { key, ok: false };
        }
      }),
    );
    overflow.forEach((key) => incoming.push({ key, ok: false }));

    // All keys dead (invalid/expired/over-cap): surface cohesively like a bad single
    // link instead of opening an empty picker.
    if (incoming.every((i) => !i.ok)) {
      setShareError(true);
      return;
    }
    setImportIncoming(incoming);
    setImportOpen(true);
  };

  // Import the picked resolved factories in ONE library commit (importFactories
  // selects the last + persists). Each config was already hydrated at resolve time,
  // so this is a plain map — no re-fetch, no re-hydrate.
  const handleImportShared = (chosen: IncomingFactory[]) => {
    setImportOpen(false);
    const inputs: FactoryImportInput[] = chosen
      .filter((i): i is Extract<IncomingFactory, { ok: true }> => i.ok)
      .map((i) => ({ config: i.config, gameVersion: i.version, sourceKey: i.key }));
    if (inputs.length) lib.importFactories(inputs);
  };

  useEffect(() => {
    if (needToFetchGameData) {
      setLoading(true);
      setNeedToFetchGameData(false);
      setGameData(null);
      setInitializer(null);
      setShareError(false);

      const params = new URLSearchParams(window.location.search);
      const shareKeys = parseShareKeys(params.get(SHARE_QUERY_PARAM));
      const legacyEncoding = params.get('f');

      if (shareKeys.length > 1) {
        // Multi-share link: boot normally + resolve the set for the import picker.
        void resolveMultiShare(shareKeys);
      } else if (shareKeys.length === 1) {
        // Single share — unchanged: resolve the saved config first; finalizeLoad runs
        // once it arrives so we can load the bundle for the share's own game version.
        sharedFactory.request({ factoryKey: shareKeys[0] });
      } else if (legacyEncoding) {
        // Legacy ?f= links never carried a server config; default the version.
        void finalizeLoad({ version: DEFAULT_GAME_VERSION, factoryConfig: null });
      } else {
        // Library-driven: load the active factory's game version.
        const version = lib.activeFactory?.gameVersion || gameVersion || DEFAULT_GAME_VERSION;
        void finalizeLoad({ version, factoryConfig: null });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needToFetchGameData]);

  useEffect(() => {
    if (sharedFactory.completedThisFrame) {
      if (sharedFactory.error) {
        // Invalid or expired ?factory= link (share links live 7 days — the
        // factories container's Cosmos TTL). Don't dead-end: drop the dead key
        // from the URL so finalizeLoad takes the normal library path (not an
        // import of a non-existent share) and a refresh won't retry, flag the
        // failure for the UI, then load a normal factory.
        stripUrlParams([SHARE_QUERY_PARAM]);
        setShareError(true);
        const version = lib.activeFactory?.gameVersion || gameVersion || DEFAULT_GAME_VERSION;
        void finalizeLoad({ version, factoryConfig: null });
        return;
      }
      const factoryConfig = sharedFactory.data?.factory_config || null;
      const version = factoryConfig?.gameVersion ? toDisplay(factoryConfig.gameVersion) : DEFAULT_GAME_VERSION;
      void finalizeLoad({ version, factoryConfig });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sharedFactory]);

  // Observe active-factory switches that don't go through a refetch. Same version
  // => reload the config into the reducer (instant); different version => refetch.
  useEffect(() => {
    if (loading) return;
    if (lib.activeId === handledActiveIdRef.current) return;
    const factory = lib.activeFactory;
    if (!factory) return;
    if (factory.gameVersion !== gameVersion) {
      setNeedToFetchGameData(true);
    } else {
      setInitializer({ factoryConfig: null, shareKey: null, legacyEncoding: null, libraryConfig: factory.config ?? null });
      handledActiveIdRef.current = lib.activeId;
      setReinitToken((t) => t + 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lib.activeId, loading]);

  // Version selector: retarget the active factory and refetch game data for it.
  const handleSetGameVersion = useCallback((version: string) => {
    if (version !== gameVersion) {
      lib.setActiveVersion(version);
      setNeedToFetchGameData(true);
    }
  }, [gameVersion, lib]);

  const clearShareError = useCallback(() => setShareError(false), []);

  const ctxValue = useMemo(() => {
    return {
      gameData,
      initializer,
      loading,
      loadingError,
      shareError,
      clearShareError,
      completedThisFrame,
      reinitToken,
      gameVersion,
      setGameVersion: handleSetGameVersion,
    }
  }, [clearShareError, completedThisFrame, gameData, gameVersion, handleSetGameVersion, initializer, loading, loadingError, shareError, reinitToken]);

  return (
    <GameDataContext.Provider value={ctxValue}>
      {children}
      <ImportPickerModal
        opened={importOpen}
        incoming={importIncoming}
        onCancel={() => setImportOpen(false)}
        onImport={handleImportShared}
      />
    </GameDataContext.Provider>
  );
}
