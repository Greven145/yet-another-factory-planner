export const GV_1_1 = '1.1';
export const GV_1_2 = '1.2';
export const DEFAULT_GAME_VERSION = GV_1_2;

export const SHARE_QUERY_PARAM = 'factory';

export const GAME_VERSION_OPTIONS = [
  { value: GV_1_2, label: '1.2 (Current)' },
  { value: GV_1_1, label: '1.1' },
];

/** Maps API enum names back to client display values */
export const API_GAME_VERSION_TO_DISPLAY: Record<string, string> = {
  V1_2: GV_1_2,
  V1_1: GV_1_1,
  U8: 'U8',
  U7: 'U7',
  U6: 'U6',
  U5: 'U5',
};
