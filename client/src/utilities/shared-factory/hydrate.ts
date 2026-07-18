import { FactoryOptions } from '../../contexts/production/types';
import { GameData } from '../../contexts/gameData/types';
import { DEFAULT_MAXIMIZE_BALANCE_MODE } from '../../contexts/production/consts';
import {
  getInitialState,
  getDefaultProductionItem,
  getDefaultInputItem,
  getInitialTransportOptions,
} from '../../contexts/production/defaults';
import { decode, WireFactory } from './codec';

// The wire -> FactoryOptions transform for an incoming shared factory. This was
// inline in the reducer's LOAD_FROM_SHARED_FACTORY case; it now lives here so the
// receive-side (single URL share AND multi-share picker) can hydrate a payload
// without going through the active-factory reducer. The reducer delegates to this,
// so behavior — including the try/catch that falls back to a fresh initial state —
// is identical. Round-trip stability is asserted by hydrate.test.ts.
export function hydrateSharedFactory(wire: WireFactory, gameData: GameData): FactoryOptions {
  try {
    const decoded = decode(wire);
    const newState: FactoryOptions = getInitialState(gameData);
    newState.productionItems = decoded.productionItems.map((i) => ({
      ...getDefaultProductionItem(),
      itemKey: i.itemKey,
      mode: i.mode,
      value: i.value,
    }));
    newState.inputItems = decoded.inputItems.map((i) => ({
      ...getDefaultInputItem(),
      itemKey: i.itemKey,
      value: i.value,
      weight: i.weight,
      unlimited: i.unlimited,
    }));
    newState.inputResources.forEach((r) => {
      const resourceOptions = decoded.inputResources.find((i) => r.itemKey === i.itemKey);
      if (resourceOptions) {
        r.value = resourceOptions.value;
        r.weight = resourceOptions.weight;
        r.unlimited = resourceOptions.unlimited;
      }
    });
    newState.allowHandGatheredItems = decoded.allowHandGatheredItems;
    newState.weightingOptions = decoded.weightingOptions;
    // gameModeOptions added in 1.2; keep the 1x default for pre-1.2 shared factories that lack it.
    if (decoded.gameModeOptions) {
      newState.gameModeOptions = decoded.gameModeOptions;
    }
    // amplificationOptions added after 1.2; keep the 0/0 default when absent.
    if (decoded.amplificationOptions) {
      newState.amplificationOptions = decoded.amplificationOptions;
    }
    decoded.allowedRecipes.forEach((key) => {
      if (newState.allowedRecipes[key] != null) {
        newState.allowedRecipes[key] = true;
      }
    });
    // allowedBuildings stores the ENABLED set and defaults to all-on, so a
    // present list is a full overwrite: each known building is on iff it's in
    // the decoded set. Absent (pre-feature shares) => keep the all-on default.
    if (decoded.allowedBuildings) {
      const enabled = new Set(decoded.allowedBuildings);
      Object.keys(newState.allowedBuildings).forEach((key) => {
        newState.allowedBuildings[key] = enabled.has(key);
      });
    }
    newState.nodesPositions = decoded.nodesPositions;
    // maximizeBalanceMode/transportOptions aren't part of the share wire shape;
    // read them defensively from the raw payload for any client-side persisted config.
    newState.maximizeBalanceMode = (wire as any).maximizeBalanceMode ?? DEFAULT_MAXIMIZE_BALANCE_MODE;
    newState.transportOptions = (wire as any).transportOptions ?? getInitialTransportOptions();
    return newState;
  } catch (e) {
    console.error(e);
    return getInitialState(gameData);
  }
}
