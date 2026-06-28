import React, { createContext, useContext, useReducer, useEffect, useMemo } from 'react';
import { usePrevious } from '../../hooks/usePrevious';
import { usePostSharedFactory } from '../../api/modules/shared-factories/usePostSharedFactory';
import { reducer, FactoryAction, getInitialState } from './reducer';
import { FactoryOptions } from './types';
import { FactoryInitializer } from '../gameData';
import { GameData } from '../gameData/types';
import { SHARE_QUERY_PARAM } from '../gameData/consts';
import { SolverResults } from '../../utilities/production-solver/models';
import { useSolverRun } from './useSolverRun';
import { useLibraryContext } from '../library';


export type ShareLinkProps = { link: string, copyToClipboard: boolean, loading: boolean };

// TYPE
export type ProductionContextType = {
  state: FactoryOptions,
  dispatch: React.Dispatch<FactoryAction>,
  gameData: GameData,
  calculating: boolean,
  solverResults: SolverResults | null,
  calculate: () => void,
  generateShareLink: () => void,
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

  const handleGenerateShareLink = () => {
    postSharedFactory.request({ factoryConfig: state, gameVersion });
  };

  const shareLink: ShareLinkProps = useMemo(() => {
    let link = '';
    const key = postSharedFactory.data?.key;
    if (key) {
      link = `${window.location.protocol}//${window.location.host}${window.location.pathname}?${SHARE_QUERY_PARAM}=${key}`;
    }
    return {
      link,
      copyToClipboard: !!postSharedFactory.data?.key,
      loading: postSharedFactory.loading,
    }
  }, [postSharedFactory.data?.key, postSharedFactory.loading]);

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

  // Initial load (and after a different-version refetch remounts this provider).
  useEffect(() => {
    if (triggerInitialize) {
      loadFromInitializer();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerInitialize]);

  // Same-version factory switch: reload the new active config without a refetch.
  useEffect(() => {
    if (reinitToken > 0) {
      loadFromInitializer();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reinitToken]);

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
