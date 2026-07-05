// Barrel for the 1.1 game-data bundle. Importing all five payloads through a
// single module means Vite emits ONE hashed chunk per game version (dynamic
// `import('../../data/1.1')` in loadGameData splits it off the main bundle).
import buildings from './buildings.json';
import recipes from './recipes.json';
import resources from './resources.json';
import items from './items.json';
import handGatheredItems from './handGatheredItems.json';
import { GameData } from '../../contexts/gameData/types';

const gameData = { buildings, recipes, resources, items, handGatheredItems } as unknown as GameData;
export default gameData;
