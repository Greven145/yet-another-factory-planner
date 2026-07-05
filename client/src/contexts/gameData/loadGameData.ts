import { GameData } from './types';
import { GV_1_1, GV_1_2 } from './consts';

// Loads the Satisfactory game data for a display version ('1.1' / '1.2') from
// static bundled JSON via dynamic import(). Each version resolves to its own
// hashed Vite chunk (see ../../data/<version>/index.ts), so the ~168 KB payload
// is served from the SWA CDN and never triggers an API `/initialize` call.
//
// Unknown / absent versions fall back to the default bundle (1.2). The literal
// import specifiers are intentional: Vite needs static strings to code-split.
export async function loadGameData(version: string): Promise<GameData> {
  switch (version) {
    case GV_1_1:
      return (await import('../../data/1.1')).default;
    case GV_1_2:
    default:
      return (await import('../../data/1.2')).default;
  }
}
