import { EXPERIMENTAL_FLAGS, ExperimentalFlagKey } from './consts';

export type ExperimentalFlagDefinition = (typeof EXPERIMENTAL_FLAGS)[number];
export type ExperimentalFlagState = Record<ExperimentalFlagKey, boolean>;

export type ExperimentalContextType = {
  flags: readonly ExperimentalFlagDefinition[];
  isEnabled: (key: ExperimentalFlagKey) => boolean;
  setEnabled: (key: ExperimentalFlagKey, value: boolean) => void;
};
