import React, { createContext, useContext, useReducer, useEffect, useMemo, useRef } from 'react';
import { usePrevious } from '../../hooks/usePrevious';
import { useSessionStorage } from '../../hooks/useSessionStorage';
import { usePostSharedFactory } from '../../api/modules/shared-factories/usePostSharedFactory';
import { reducer, FactoryAction, getInitialState } from './reducer';
import { FactoryOptions } from './types';
import { FactoryInitializer } from '../gameData';
import { GameData } from '../gameData/types';
import { SHARE_QUERY_PARAM } from '../gameData/consts';
import { SolverResults } from '../../utilities/production-solver/models';
import { useSolverRun } from './useSolverRun';


export type ShareLinkProps = { link: string, copyToClipboard: boolean, loading: boolean };

// TYPE
export type ProductionContextType = {
  state: FactoryOptions,
  dispatch: React.Dispatch<FactoryAction>,
  gameData: GameData,
  calculating: boolean,
  solverResults: SolverResults | null,
  calculate: () => void,
  autoCalculate: boolean,
  setAutoCalculate: (value: boolean) => void,
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
  children: React.ReactNode,
};
export const ProductionProvider = ({ gameData, gameVersion, initializer, triggerInitialize, children }: PropTypes) => {
  const [state, dispatch] = useReducer(reducer, getInitialState(gameData));
  const prevState = usePrevious(state);

  const [autoCalculate, setAutoCalculate] = useSessionStorage<'false' | 'true'>({ key: 'auto-calculate', defaultValue: 'true' });
  const autoCalculateBool = autoCalculate === 'true' ? true : false;

  const postSharedFactory = usePostSharedFactory();

  // Solver orchestration (worker lifecycle, debounced solve, stale-result discipline,
  // and the calculating flag) lives in useSolverRun. The provider only decides WHEN to solve.
  const { solverResults, calculating, calculate: handleCalculateFactory } = useSolverRun(state, gameData);

  // Set to true in triggerInitialize effect so the state-change effect runs the solve after dispatch applies.
  const forceCalculateRef = useRef(false);

  const handleSetAutoCalculate = (checked: boolean) => {
    setAutoCalculate(checked ? 'true' : 'false');
    if (checked) {
      handleCalculateFactory();
    }
  };

  const handleGenerateShareLink = () => {
    postSharedFactory.request({ factoryConfig: state, gameVersion });
  };

  const shareLink: ShareLinkProps = useMemo(() => {
    let link = '';
    const key = postSharedFactory.data?.key || initializer?.shareKey;
    if (key) {
      link = `${window.location.protocol}//${window.location.host}${window.location.pathname}?${SHARE_QUERY_PARAM}=${key}`;
    }
    return {
      link,
      copyToClipboard: !!postSharedFactory.data?.key,
      loading: postSharedFactory.loading,
    }
  }, [initializer?.shareKey, postSharedFactory.data?.key, postSharedFactory.loading]);
  
  useEffect(() => {
    if (triggerInitialize) {
      if (initializer?.factoryConfig) {
        dispatch({ type: 'LOAD_FROM_SHARED_FACTORY', config: initializer.factoryConfig, gameData });
      } else if (initializer?.legacyEncoding) {
        dispatch({ type: 'LOAD_FROM_LEGACY_ENCODING', encoding: initializer.legacyEncoding, gameData });
      } else if (initializer?.sessionState) {
        dispatch({ type: 'LOAD_FROM_SESSION_STORAGE', sessionState: initializer?.sessionState, gameData });
      } else {
        dispatch({ type: 'RESET_FACTORY', gameData });
      }
      // Don't call handleCalculateFactory() here — state hasn't updated yet (dispatch is async).
      // Set the flag so the state-change effect below runs the solve after the new state is applied.
      forceCalculateRef.current = true;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerInitialize]);

  useEffect(() => {
    if (prevState !== undefined && prevState !== state && (autoCalculateBool || forceCalculateRef.current)) {
      forceCalculateRef.current = false;
      handleCalculateFactory();
    }
  }, [autoCalculateBool, handleCalculateFactory, prevState, state]);

  useEffect(() => {
      try {
        window.sessionStorage.setItem('game-version', gameVersion);
        window.sessionStorage.setItem('state', JSON.stringify(state));
      } catch (e) {
        console.error(e);
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
      autoCalculate: autoCalculateBool,
      setAutoCalculate: handleSetAutoCalculate,
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
    autoCalculateBool,
    shareLink,
  ]);

  return (
    <ProductionContext.Provider value={ctxValue}>
      {children}
    </ProductionContext.Provider>
  );
}
