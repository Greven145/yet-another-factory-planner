import React, { createContext, useCallback, useContext, useMemo } from 'react';
import { useLocalStorage } from '@mantine/hooks';
import {
  EXPERIMENTAL_FLAGS,
  EXPERIMENTAL_FLAGS_STORAGE_KEY,
  ExperimentalFlagKey,
  defaultFlagState,
  mergeFlagState,
} from './consts';
import { ExperimentalContextType, ExperimentalFlagState } from './types';


// CONTEXT
export const ExperimentalContext = createContext<ExperimentalContextType | null>(null);
ExperimentalContext.displayName = 'ExperimentalContext';


// HELPER HOOKS
export function useExperimentalContext() {
  const ctx = useContext(ExperimentalContext);
  if (!ctx) {
    throw new Error('ExperimentalContext is null');
  }
  return ctx;
}

export function useExperimentalFlag(key: ExperimentalFlagKey) {
  return useExperimentalContext().isEnabled(key);
}


// PROVIDER
type PropTypes = { children: React.ReactNode };
export const ExperimentalProvider = ({ children }: PropTypes) => {
  const [raw, setRaw] = useLocalStorage<ExperimentalFlagState>({
    key: EXPERIMENTAL_FLAGS_STORAGE_KEY,
    defaultValue: defaultFlagState(),
    getInitialValueInEffect: false,
  });

  // Derive the live state from the RAW stored value so unknown/removed keys are
  // dropped and missing keys stay false, regardless of what was persisted.
  const state = useMemo(() => mergeFlagState(raw), [raw]);

  const isEnabled = useCallback((key: ExperimentalFlagKey) => state[key], [state]);

  const setEnabled = useCallback(
    (key: ExperimentalFlagKey, value: boolean) =>
      setRaw((prev) => ({ ...mergeFlagState(prev), [key]: value })),
    [setRaw],
  );

  const ctxValue = useMemo<ExperimentalContextType>(() => ({
    flags: EXPERIMENTAL_FLAGS,
    state,
    isEnabled,
    setEnabled,
  }), [state, isEnabled, setEnabled]);

  return (
    <ExperimentalContext.Provider value={ctxValue}>
      {children}
    </ExperimentalContext.Provider>
  );
};
