import React, { createContext, useContext, useReducer, useEffect, useMemo } from 'react';
import { usePrevious } from '../../hooks/usePrevious';
import { usePostSharedFactory } from '../../api/modules/shared-factories/usePostSharedFactory';
import { reducer, FactoryAction, getInitialState } from './reducer';
import { FactoryOptions } from './types';
import { FactoryInitializer } from '../gameData';
import { GameData } from '../gameData/types';
import { buildShareUrl } from '../../utilities/shared-factory/share-url';
import { SolverResults } from '../../utilities/production-solver/models';
import { useSolverRun } from './useSolverRun';
import { useLibraryContext } from '../library';


export type ShareLinkProps = { loading: boolean };

// TYPE
export type ProductionContextType = {
  state: FactoryOptions,
  dispatch: React.Dispatch<FactoryAction>,
  gameData: GameData,
  calculating: boolean,
  solverResults: SolverResults | null,
  calculate: () => void,
  generateShareLink: () => Promise<string>,
  shareLink: ShareLinkProps,
};


// CONTEXT
export const ProductionContext = createContext<ProductionContextType | null>(null);
ProductionContext.displayName = 'ProductionContext';


// HELPER HOOK
export function useProductionContext() {
  const ctx = useContext(ProductionContext);
  if (!ctx) {
    throw new Error('ProductionContext is null');
  }
  return ctx;
}


// PROVIDER
type PropTypes = {
  gameData: GameData,
  gameVersion: string,
  initializer: FactoryInitializer | null,
  triggerInitialize: boolean,
  reinitToken: number,
  children: React.ReactNode,
};
export const ProductionProvider = ({ gameData, gameVersion, initializer, triggerInitialize, reinitToken, children }: PropTypes) => {
  const lib = useLibraryContext();
  const [state, dispatch] = useReducer(reducer, getInitialState(gameData));
  const prevState = usePrevious(state);

  const postSharedFactory = usePostSharedFactory();

  // Solver orchestration (worker lifecycle, debounced solve, stale-result discipline,
  // and the calculating flag) lives in useSolverRun. The provider only decides WHEN to solve.
  const { solverResults, calculating, calculate: handleCalculateFactory } = useSolverRun(state, gameData);

  // Await the POST and resolve to the full share link so the caller can copy it inside
  // the originating click gesture (see #182). Rejects if the server never returned a
  // key, letting the Share UI drop to its manual-copy fallback.
  const handleGenerateShareLink = async (): Promise<string> => {
    const result = await postSharedFactory.request({ factoryConfig: state, gameVersion });
    const key = result?.key;
    if (!key) {
      throw new Error('Failed to generate a share link');
    }
    return buildShareUrl([key]);
  };

  // The share link itself is returned by handleGenerateShareLink (awaited inside the
  // Share click), so the context only needs to expose the in-flight state for the
  // button's spinner — it no longer rebuilds the URL here.
  const shareLink: ShareLinkProps = useMemo(() => ({
    loading: postSharedFactory.loading,
  }), [postSharedFactory.loading]);

  // Load the active factory's content into the reducer. Shared/legacy take priority
  // (URL imports), then a stored library config, else a fresh/empty factory.
  const loadFromInitializer = () => {
    if (initializer?.factoryConfig) {
      dispatch({ type: 'LOAD_FROM_SHARED_FACTORY', config: initializer.factoryConfig, gameData });
    } else if (initializer?.legacyEncoding) {
      dispatch({ type: 'LOAD_FROM_LEGACY_ENCODING', encoding: initializer.legacyEncoding, gameData });
    } else if (initializer?.libraryConfig) {
      dispatch({ type: 'LOAD_FROM_LIBRARY', config: initializer.libraryConfig, gameData });
    } else {
      dispatch({ type: 'RESET_FACTORY', gameData });
    }
  };

  // Load the active factory whenever game data tells us to: on the initial load /
  // different-version refetch (triggerInitialize), or a same-version switch that
  // reloads without a refetch (reinitToken).
  useEffect(() => {
    if (triggerInitialize || reinitToken > 0) {
      loadFromInitializer();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerInitialize, reinitToken]);

  // Performance is good enough to always auto-solve on any state change. The initial
  // state (prevState === undefined) is skipped; the load dispatch above produces the
  // first real state change, which triggers the initial solve.
  useEffect(() => {
    if (prevState !== undefined && prevState !== state) {
      handleCalculateFactory();
    }
  }, [handleCalculateFactory, prevState, state]);

  // Autosave the live reducer state into the active library slot. Skipped on the
  // initial (pre-load) state so it never clobbers a stored config before it loads.
  useEffect(() => {
    if (prevState !== undefined) {
      lib.saveActiveConfig(state);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const ctxValue = useMemo(() => {
    return {
      state,
      dispatch,
      gameData,
      calculating,
      solverResults,
      calculate: handleCalculateFactory,
      generateShareLink: handleGenerateShareLink,
      shareLink,
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    state,
    gameData,
    calculating,
    solverResults,
    handleCalculateFactory,
    shareLink,
  ]);

  return (
    <ProductionContext.Provider value={ctxValue}>
      {children}
    </ProductionContext.Provider>
  );
}
