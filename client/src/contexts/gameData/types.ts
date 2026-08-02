export type ItemRate = {
  itemClass: string,
  perMinute: number,
};

export type ItemQuantity = {
  itemClass: string,
  quantity: number,
};

export type BuildingsInfo = {
  slug: string,
  name: string,
  power: number,
  area: number,
  buildCost: ItemQuantity[],
  isFicsmas: boolean,
};

export type RecipeInfo = {
  slug: string,
  name: string,
  isAlternate: boolean,
  ingredients: ItemRate[],
  products: ItemRate[],
  producedIn: string,
  isFicsmas: boolean,
  // Real craft time in seconds (mManufactoringDuration from the game's Docs.json), when known.
  // Lets applyGameModeMultipliers derive true per-cycle quantities instead of guessing from the
  // GCD of perMinute rates, which is ambiguous when a recipe's amounts share a common factor
  // (see issue #198). Absent for recipes parsed before this field existed, and for the synthetic
  // nuclear/plutonium power "recipes", which fall back to the GCD heuristic.
  craftTime?: number | null,
};

export type ResourceInfo = {
  itemClass: string,
  maxExtraction: number | null,
  relativeValue: number,
};

export type ItemInfo = {
  slug: string,
  name: string,
  sinkPoints: number,
  isFluid: boolean,
  usedInRecipes: string[],
  producedFromRecipes: string[],
  isFicsmas: boolean,
};

export type BuildingMap = { [key: string]: BuildingsInfo };
export type RecipeMap = { [key: string]: RecipeInfo };
export type ResourceMap = { [key: string]: ResourceInfo };
export type ItemMap = { [key: string]: ItemInfo };
export type HandGatheredItemMap = { [key: string]: string };

export type GameData = {
  buildings: BuildingMap,
  recipes: RecipeMap,
  resources: ResourceMap,
  items: ItemMap,
  handGatheredItems: HandGatheredItemMap,
}
