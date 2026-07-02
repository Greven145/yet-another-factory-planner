// Belt/pipe transport requirements (balancer mode, part B1).
//
// Given the rate of an item flowing along one edge of the production graph, works
// out how it is physically carried: which conveyor/pipe tier and how many parallel
// lines. Counts against the tier the user selected in the Belt/Pipe Capacity option
// (the same value the solver constrains total node output against); when that option
// is disabled, auto-picks the smallest tier that carries the flow on a single line.
//
// Pure and data-only so it can be unit-tested without the solver or React.

// Conveyor and pipeline tiers, ascending. Mirrors the presets in
// PlannerOptions/ProductionTab (belts items/min, pipes m³/min) — keep in sync.
export const BELT_TIERS: ReadonlyArray<{ label: string, rate: number }> = [
  { label: 'Mk.1', rate: 60 },
  { label: 'Mk.2', rate: 120 },
  { label: 'Mk.3', rate: 240 },
  { label: 'Mk.4', rate: 480 },
  { label: 'Mk.5', rate: 780 },
  { label: 'Mk.6', rate: 1200 },
];

export const PIPE_TIERS: ReadonlyArray<{ label: string, rate: number }> = [
  { label: 'Mk.1', rate: 300 },
  { label: 'Mk.2', rate: 600 },
];

export type TransportCapacities = {
  // Selected tier capacity, or null when the option is disabled. Strings from state
  // should be parsed to numbers before being passed here.
  beltCapacity: number | null,
  pipeCapacity: number | null,
};

// Parses a raw capacity option (a string from state, or null when disabled) into a
// positive number, or null when disabled/invalid.
export function parseCapacity(value: string | null): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

// Resolves the raw belt/pipe capacity options into TransportCapacities, or undefined
// when the "belt/pipe needs" view is off (so callers skip transport annotation).
export function resolveTransportCaps(
  showTransport: boolean,
  beltCapacity: string | null,
  pipeCapacity: string | null,
): TransportCapacities | undefined {
  if (!showTransport) return undefined;
  return {
    beltCapacity: parseCapacity(beltCapacity),
    pipeCapacity: parseCapacity(pipeCapacity),
  };
}

export type TransportInfo = {
  medium: 'belt' | 'pipe',
  tierLabel: string,   // e.g. 'Mk.4'
  tierRate: number,    // capacity carried by one line at this tier
  lineCount: number,   // parallel lines needed: ceil(rate / tierRate)
  autoTier: boolean,   // true when the tier was auto-picked (option disabled)
};

// Describes how a flow of `rate` (items/min for belts, m³/min for pipes) is carried.
// Returns null for non-positive rates (nothing to transport).
export function describeTransport(
  rate: number,
  isFluid: boolean,
  caps: TransportCapacities,
): TransportInfo | null {
  if (!(rate > 0)) return null;

  const medium = isFluid ? 'pipe' : 'belt';
  const tiers = isFluid ? PIPE_TIERS : BELT_TIERS;
  const selected = isFluid ? caps.pipeCapacity : caps.beltCapacity;

  if (selected != null && selected > 0) {
    const tier = tiers.find((t) => t.rate === selected);
    return {
      medium,
      tierLabel: tier?.label ?? `${selected}/min`,
      tierRate: selected,
      lineCount: Math.ceil(rate / selected),
      autoTier: false,
    };
  }

  // Auto: smallest tier that carries the whole flow on one line; if it exceeds even
  // the top tier, use the top tier and count the parallel lines needed.
  const tier = tiers.find((t) => t.rate >= rate) ?? tiers[tiers.length - 1];
  return {
    medium,
    tierLabel: tier.label,
    tierRate: tier.rate,
    lineCount: Math.ceil(rate / tier.rate),
    autoTier: true,
  };
}

// Compact label for a transport requirement, e.g. "1× Mk.4" or "2× Mk.6".
export function formatTransport(info: TransportInfo): string {
  return `${info.lineCount}× ${info.tierLabel}`;
}
