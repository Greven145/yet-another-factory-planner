import { FactoryOptions } from '../contexts/production/types';
import { GameData } from '../contexts/gameData/types';
import { LibraryFactory } from '../contexts/library/types';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

// Auto-label a factory from its production outputs, e.g.
// "Reinforced Iron Plate ×30, Rotor (max)". Empty factory => "Empty factory".
export function deriveAutoLabel(config: FactoryOptions | undefined, gameData: GameData): string {
  const parts = (config?.productionItems ?? [])
    .filter((p) => p.itemKey)
    .map((p) => {
      const name = gameData.items[p.itemKey]?.name ?? p.itemKey;
      if (p.mode === 'per-minute') return `${name} ×${p.value || '0'}`;
      return `${name} (max)`;
    });
  if (parts.length === 0) return 'Empty factory';
  return parts.join(', ');
}

// A nickname overrides the auto-label; otherwise derive from outputs.
export function labelOf(factory: LibraryFactory, gameData: GameData): string {
  return factory.nickname || deriveAutoLabel(factory.config, gameData);
}

export function relativeTime(ms: number): string {
  const diff = Date.now() - ms;
  if (diff < MINUTE) return 'just now';
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}m ago`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h ago`;
  return `${Math.floor(diff / DAY)}d ago`;
}
