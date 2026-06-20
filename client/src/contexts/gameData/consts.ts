export const GV_1_1 = '1.1';
export const GV_1_2 = '1.2';
export const DEFAULT_GAME_VERSION = GV_1_2;

export const SHARE_QUERY_PARAM = 'factory';

export const GAME_VERSION_OPTIONS = [
  { value: GV_1_2, label: '1.2 (Current)' },
  { value: GV_1_1, label: '1.1' },
];

// The game-version vocabulary lives in the shared-factory codec; re-export its
// enum-name -> display mapping so callers don't redefine it here.
export { toDisplay as apiGameVersionToDisplay } from '../../utilities/shared-factory/codec';
