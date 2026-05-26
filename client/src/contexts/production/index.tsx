import React, { createContext, useContext, useReducer, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import debounce from 'lodash/debounce';
import { usePrevious } from '../../hooks/usePrevious';
import { useSessionStorage } from '../../hooks/useSessionStorage';
import { GraphError } from '../../utilities/error/GraphError';
import { usePostSharedFactory } from '../../api/modules/shared-factories/usePostSharedFactory';
import { reducer, FactoryAction, getInitialState } from './reducer';
import { FactoryOptions } from './types';
import { FactoryInitializer } from '../gameData';
import { GameData } from '../gameData/types';
import { SHARE_QUERY_PARAM } from '../gameData/consts';
import { useGlobalContext } from '../global';
import { SolverResults } from '../../utilities/production-solver/models';
import type { WorkerOutput } from '../../utilities/production-solver/solver.worker';


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


const _setCalculating = debounce((value: boolean, setCalculating: React.Dispatch<React.SetStateAction<boolean>>) => {
  setCalculating(value);
}, 300, { leading: false, trailing: true });


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
  const [solverResults, setSolverResults] = useState<SolverResults | null>(null);

  const [calculating, setCalculating] = useState(false);
  const [autoCalculate, setAutoCalculate] = useSessionStorage<'false' | 'true'>({ key: 'auto-calculate', defaultValue: 'true' });
  const autoCalculateBool = autoCalculate === 'true' ? true : false;

  const ctx = useGlobalContext();

  const postSharedFactory = usePostSharedFactory();

  // Debounced post ref: 300ms leading+trailing, matching the previous module-level debounce.
  const debouncedSolveRef = useRef<ReturnType<typeof debounce> | null>(null);

  useEffect(() => {
    const worker = new Worker(
      new URL('../../utilities/production-solver/solver.worker.ts', import.meta.url),
      { type: 'module' },
    );

    worker.onmessage = (event: MessageEvent<WorkerOutput>) => {
      const data = event.data;
      if (data.ok) {
        setSolverResults((prevState) => {
          if (!prevState || prevState.timestamp < data.results.timestamp) {
            console.log(`Computed in: ${data.results.computeTime}ms`);
            return data.results;
          }
          return prevState;
        });
      } else {
        setSolverResults({
          productionGraph: null,
          report: null,
          timestamp: performance.now(),
          computeTime: 0,
          error: new GraphError(data.message, data.helpText),
        });
      }
      _setCalculating(false, setCalculating);
    };

    worker.onerror = (e) => {
      setSolverResults({
        productionGraph: null,
        report: null,
        timestamp: performance.now(),
        computeTime: 0,
        error: new GraphError(e.message ?? 'Worker error'),
      });
      _setCalculating(false, setCalculating);
    };

    const debouncedSolve = debounce((state: FactoryOptions, gameData: GameData) => {
      _setCalculating(true, setCalculating);
      worker.postMessage({ state, gameData });
    }, 300, { leading: true, trailing: true });

    debouncedSolveRef.current = debouncedSolve;

    return () => {
      debouncedSolve.cancel();
      worker.terminate();
      debouncedSolveRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCalculateFactory = useCallback(() => {
    ctx.refreshTip();
    debouncedSolveRef.current?.(state, gameData);
  }, [ctx, gameData, state]);

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
      handleCalculateFactory();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerInitialize]);

  useEffect(() => {
    if (autoCalculateBool && prevState !== state) {
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
