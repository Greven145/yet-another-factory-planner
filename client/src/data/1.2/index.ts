// Barrel for the 1.2 game-data bundle. See ../1.1/index.ts for why the five
// payloads are assembled behind a single dynamically-imported module.
import buildings from './buildings.json';
import recipes from './recipes.json';
import resources from './resources.json';
import items from './items.json';
import handGatheredItems from './handGatheredItems.json';
import { GameData } from '../../contexts/gameData/types';

const gameData = { buildings, recipes, resources, items, handGatheredItems } as unknown as GameData;
export default gameData;
