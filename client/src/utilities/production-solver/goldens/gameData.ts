import gameDataSnapshot from './data/game-data.json';
import { GameData } from '../../../contexts/gameData/types';

/**
 * Game versions the golden corpus can target. Each case in the corpus tags the
 * version whose GameData it should solve against.
 *
 * NOTE: as of capture, the API's `V1_1.resx` and `V1_2.resx` game-data sources
 * are byte-identical (verified md5-equal), so both versions resolve to a single
 * committed snapshot (`data/game-data.json`). When the two versions diverge in
 * the source data, drop a `data/game-data-1.1.json` and branch on `version`
 * below — the corpus already carries the version tag needed to pick correctly.
 */
export const GOLDEN_GAME_VERSIONS = ['1.1', '1.2'] as const;
export type GoldenGameVersion = (typeof GOLDEN_GAME_VERSIONS)[number];

// Static JSON import: Vite resolves it at transform time (works in the jsdom test
// env where import.meta.url is not a file:// URL). Test-only importer, so it is
// tree-shaken out of the production bundle.
const snapshot = gameDataSnapshot as unknown as GameData;

/** The committed, hermetic GameData snapshot for a given golden game version. */
export function loadGoldenGameData(_version: GoldenGameVersion): GameData {
  return snapshot;
}
