import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useGetSharedFactory } from '../../api/modules/shared-factories/useGetSharedFactory';
import { GameData } from './types';
import { loadGameData } from './loadGameData';
import { DEFAULT_GAME_VERSION, SHARE_QUERY_PARAM } from './consts';
import { toDisplay } from '../../utilities/shared-factory/codec';
import { usePrevious } from '../../hooks/usePrevious';
import { FactoryOptions } from '../production/types';
import { usePageTitle } from '../../hooks/usePageTitle';
import { useLibraryContext } from '../library';


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


// PROVIDER
type PropTypes = { children: React.ReactNode };
export const GameDataProvider = ({ children }: PropTypes) => {
  const lib = useLibraryContext();
  const [gameData, setGameData] = useState<GameData | null>(null);
  const [gameVersion, setGameVersion] = useState('');
  const [initializer, setInitializer] = useState<FactoryInitializer | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingError, setLoadingError] = useState(false);
  const [reinitToken, setReinitToken] = useState(0);
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
    // Clear only the share keys we just imported — leave any other query params
    // (e.g. the prototype's ?variant=) intact so a refresh doesn't re-import the
    // shared factory while still preserving the rest of the URL.
    params.delete(SHARE_QUERY_PARAM);
    params.delete('f');
    const rest = params.toString();
    window.history.replaceState(null, '', rest ? `${window.location.pathname}?${rest}` : window.location.pathname);

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

  useEffect(() => {
    if (needToFetchGameData) {
      setLoading(true);
      setNeedToFetchGameData(false);
      setGameData(null);
      setInitializer(null);

      const params = new URLSearchParams(window.location.search);
      const shareKey = params.get(SHARE_QUERY_PARAM);
      const legacyEncoding = params.get('f');

      if (shareKey) {
        // Resolve the saved config first; finalizeLoad runs once it arrives so we
        // can load the bundle for the share's own game version (below).
        sharedFactory.request({ factoryKey: shareKey });
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
        setLoadingError(true);
        setLoading(false);
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

  const ctxValue = useMemo(() => {
    return {
      gameData,
      initializer,
      loading,
      loadingError,
      completedThisFrame,
      reinitToken,
      gameVersion,
      setGameVersion: handleSetGameVersion,
    }
  }, [completedThisFrame, gameData, gameVersion, handleSetGameVersion, initializer, loading, loadingError, reinitToken]);

  return (
    <GameDataContext.Provider value={ctxValue}>
      {children}
    </GameDataContext.Provider>
  );
}
