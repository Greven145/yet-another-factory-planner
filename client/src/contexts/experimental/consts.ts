export const EXPERIMENTAL_FLAGS_STORAGE_KEY = 'experimental-flags';

export const EXPERIMENTAL_FLAGS = [
  {
    key: 'balancer-view',
    label: 'Balancer view',
    description: 'Adds “Dedicated lines” and “Belt/pipe needs” view toggles to the results header.',
  },
] as const;

export type ExperimentalFlagKey = (typeof EXPERIMENTAL_FLAGS)[number]['key'];

export function defaultFlagState(): Record<ExperimentalFlagKey, boolean> {
  return Object.fromEntries(EXPERIMENTAL_FLAGS.map((f) => [f.key, false])) as Record<ExperimentalFlagKey, boolean>;
}

// Overlay only KNOWN keys whose value is a boolean; drop unknown/removed keys;
// missing keys stay false. Accepts unknown (raw parsed JSON) defensively.
export function mergeFlagState(stored: unknown): Record<ExperimentalFlagKey, boolean> {
  const next = defaultFlagState();
  if (stored && typeof stored === 'object') {
    for (const f of EXPERIMENTAL_FLAGS) {
      const v = (stored as Record<string, unknown>)[f.key];
      if (typeof v === 'boolean') next[f.key] = v;
    }
  }
  return next;
}
