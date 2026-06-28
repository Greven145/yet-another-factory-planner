import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useGetInitialize } from '../../api/modules/initialize/useGetInitialize';
import { GameData } from './types';
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

  const getInitialize = useGetInitialize();

  const pageTitle = useMemo(() => {
    const base = 'Another... Yet Another Factory Planner';
    return (gameVersion ? `[${gameVersion}] ` : '') + base;
  }, [gameVersion]);

  usePageTitle(pageTitle);

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
        getInitialize.request({ factoryKey: shareKey });
      } else if (legacyEncoding) {
        getInitialize.request({ gameVersion: DEFAULT_GAME_VERSION });
      } else {
        // Library-driven: fetch the active factory's game version.
        const version = lib.activeFactory?.gameVersion || gameVersion || DEFAULT_GAME_VERSION;
        getInitialize.request({ gameVersion: version });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needToFetchGameData]);

  useEffect(() => {
    if (getInitialize.completedThisFrame) {
      if (getInitialize.error) {
        setLoadingError(true);
      }
      const newGameData = getInitialize.data?.game_data || null;
      const factoryConfig = getInitialize.data?.factory_config || null;

      const params = new URLSearchParams(window.location.search);
      const shareKey = params.get(SHARE_QUERY_PARAM);
      const legacyEncoding = params.get('f');
      window.history.replaceState(null, '', `${window.location.pathname}`);

      // Resolve the version this load landed on.
      let version: string;
      if (factoryConfig?.gameVersion) {
        version = toDisplay(factoryConfig.gameVersion);
      } else if (legacyEncoding) {
        version = DEFAULT_GAME_VERSION;
      } else {
        version = lib.activeFactory?.gameVersion || gameVersion || DEFAULT_GAME_VERSION;
      }

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

      setGameVersion(version);
      setGameData(newGameData);
      setInitializer({
        factoryConfig: (shareKey || legacyEncoding) ? factoryConfig : null,
        shareKey,
        legacyEncoding,
        libraryConfig,
      });
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getInitialize]);

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
